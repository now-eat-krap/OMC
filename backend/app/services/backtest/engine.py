# VectorBT 백테스트 실행 엔진
# 핵심 백테스트 로직 담당

import logging
import time

import numpy as np
import vectorbt as vbt
from numba import njit
from vectorbt.portfolio import nb as portfolio_nb

from app.core.config import get_coin_precision
from app.schemas import BacktestRequest, BacktestResult, SentenceCondition
from app.services.backtest.analyzer import ResultAnalyzer
from app.services.backtest.strategy import (
    EXIT_KIND_LOSS,
    EXIT_KIND_PROFIT,
    EXIT_KIND_SIGNAL,
    EXIT_OP_AND,
    StrategyParser,
)
from app.services.data import DataService
from app.utils import safe_float
from app.utils.date_utils import adjust_start_date_for_timeframe

logger = logging.getLogger(__name__)


# =============================================================================
# Numba JIT 주문 함수 (모듈 레벨)
# =============================================================================
# 주의: 반드시 모듈 레벨에 정의해야 합니다.
# 메서드 내부에 클로저로 정의하면 요청마다 새 함수 객체가 생성되어
# Numba가 매번 재컴파일합니다 (요청당 수 초의 컴파일 오버헤드).
# 모듈 레벨 정의 시 프로세스당 1회만 컴파일되며,
# 워커 기동 시 warmup_numba_jit()이 이 경로를 미리 컴파일합니다.
@njit
def _eval_exit_cond_nb(k, idx, entry_price, prev_close, signals, kinds, values):
    """청산 조건 k 하나를 현재 봉에서 평가한다

    익절/손절은 '전 봉 종가가 진입가 대비 몇 %인가'로 판단한다. 다른 조건들이
    전 봉 종가 기준 시그널을 한 칸 밀어서 이번 봉 시가에 체결하는 것과 같은
    규칙이다. 진입 봉에서는 prev_close 가 진입 전 가격이므로 평가하지 않는다.
    """
    kind = kinds[k]
    if kind == EXIT_KIND_SIGNAL:
        return signals[idx, k]
    if entry_price <= 0.0 or prev_close <= 0.0:
        return False
    pnl_pct = (prev_close / entry_price - 1.0) * 100.0
    if kind == EXIT_KIND_PROFIT:
        return pnl_pct >= values[k]
    if kind == EXIT_KIND_LOSS:
        return pnl_pct <= -values[k]
    return False


@njit
def _should_exit_nb(idx, entry_price, prev_close, signals, kinds, values, ops):
    """청산 조건 전체를 왼쪽부터 차례로 AND/OR 결합한다 (StrategyParser 와 같은 순서)"""
    n = kinds.shape[0]
    result = _eval_exit_cond_nb(0, idx, entry_price, prev_close, signals, kinds, values)
    for k in range(n - 1):
        nxt = _eval_exit_cond_nb(k + 1, idx, entry_price, prev_close, signals, kinds, values)
        if ops[k] == EXIT_OP_AND:
            result = result and nxt
        else:
            result = result or nxt
    return result


@njit
def order_func_nb(
    c,
    entries,
    exit_signals,
    exit_kinds,
    exit_values,
    exit_ops,
    open_prices,
    close_prices,
    prec_mult,
    fees,
    slippage,
):
    """주문 함수 - 각 봉마다 호출

    c: OrderContext (현재 상태 정보 포함)
    복리 재투자 + 코인별 정밀도 버림 처리를 수행합니다.

    청산 조건은 미리 합쳐진 하나의 배열이 아니라 조건별 배열로 받는다.
    익절/손절은 진입가를 알아야 해서 여기서만 판단할 수 있기 때문이다.
    진입가는 vectorbt 가 채워 주는 c.pos_record_now['entry_price'] (슬리피지 반영
    체결가) 를 쓴다. trades 의 Avg Entry Price 와 같은 값이다.
    """
    idx = c.i

    # 현재 포지션 보유 여부
    has_position = c.position_now > 0

    # 청산 (포지션 보유 중 + 청산 조건 충족)
    if has_position:
        entry_price = c.pos_record_now["entry_price"]
        prev_close = close_prices[idx - 1] if idx > 0 else 0.0
        if _should_exit_nb(
            idx, entry_price, prev_close, exit_signals, exit_kinds, exit_values, exit_ops
        ):
            return portfolio_nb.order_nb(
                size=-c.position_now,
                price=open_prices[idx],
                fees=fees,
                slippage=slippage,
            )

    # 진입 시그널 (포지션 없음 + 진입 시그널)
    if not has_position and entries[idx]:
        price = open_prices[idx]

        # 정수 연산으로 버림 처리 (부동소수점 오차 방지)
        raw_qty = c.cash_now / price
        floored_qty = np.floor(raw_qty * prec_mult) / prec_mult

        if floored_qty > 0:
            return portfolio_nb.order_nb(
                size=floored_qty,
                price=price,
                fees=fees,
                slippage=slippage,
            )

    return portfolio_nb.order_nb(size=np.nan)


def buy_and_hold_return(
    open_prices: np.ndarray,
    close_prices: np.ndarray,
    initial_capital: float,
    fee_rate: float,
    slippage_rate: float,
    precision_mult: int,
) -> tuple[float, float]:
    """기준선: 첫 봉 시가에 전액 매수해 마지막 봉 종가까지 들고 있었을 때

    전략과 같은 가정을 씁니다. 진입은 슬리피지와 수수료를 떼고, 수량은 코인별 최소
    주문 단위로 버림합니다. 청산은 하지 않습니다. 전략의 미청산 포지션을 마지막 종가로
    평가하는 것과 같은 기준이라 둘을 나란히 놓고 비교할 수 있습니다.

    Returns:
        (수익률 %, 수익액)
    """
    if len(open_prices) == 0 or initial_capital <= 0:
        return 0.0, 0.0
    fill = float(open_prices[0]) * (1.0 + slippage_rate)
    if fill <= 0:
        return 0.0, 0.0
    # 수수료까지 포함해 자본 안에서 살 수 있는 최대 수량을 최소 단위로 버림
    qty = np.floor(initial_capital / (fill * (1.0 + fee_rate)) * precision_mult) / precision_mult
    if qty <= 0:
        return 0.0, 0.0
    spent = qty * fill * (1.0 + fee_rate)
    final_value = (initial_capital - spent) + qty * float(close_prices[-1])
    pnl = final_value - initial_capital
    return safe_float(pnl / initial_capital * 100.0), safe_float(pnl)


class BacktestEngine:
    """VectorBT 기반 백테스트 엔진

    역할:
    - 데이터 수집 (DataService 사용)
    - 시그널 생성 (StrategyParser 사용)
    - VectorBT 포트폴리오 시뮬레이션
    - 결과 분석 (ResultAnalyzer 사용)
    """

    def __init__(self):
        self.data_service = DataService()
        self.strategy_parser = StrategyParser()
        self.result_analyzer = ResultAnalyzer()

    def _calculate_warmup_period(self, conditions: list[SentenceCondition]) -> int:
        """조건에서 필요한 최대 warmup 기간 계산

        Args:
            conditions: 매수/매도 조건 리스트

        Returns:
            warmup 캔들 수
        """
        max_period = 0

        for condition in conditions:
            # 지표 기간
            if condition.indicatorPeriod:
                max_period = max(max_period, condition.indicatorPeriod)

            # 타겟 지표 기간 (크로스용)
            if condition.targetPeriod:
                max_period = max(max_period, condition.targetPeriod)

            # MACD는 기본적으로 26일 필요
            if condition.templateType == "macd_signal":
                max_period = max(max_period, 35)  # 26 + 9 여유분

            # 볼린저밴드
            if condition.templateType == "band_touch":
                max_period = max(max_period, condition.indicatorPeriod or 20)

            # 스토캐스틱
            if condition.templateType == "stochastic":
                max_period = max(max_period, condition.indicatorPeriod or 14)

        # 최소 1000개의 warmup 보장 (RSI 등 수렴형 지표가 정확한 값에 도달)
        return max(max_period + 10, 1000)

    async def run(self, request: BacktestRequest, on_progress: callable = None) -> BacktestResult:
        """백테스트 실행

        Args:
            request: 백테스트 요청
            on_progress: 진행률 콜백 함수 (message: str, percent: int)

        Returns:
            BacktestResult
        """

        # 헬퍼 내부 함수: 진행률 업데이트
        def update(msg: str, p: int):
            if on_progress:
                try:
                    on_progress(msg, p)
                except Exception:
                    pass  # 콜백 에러는 무시

        profiling = {}
        total_start = time.perf_counter()

        update("데이터 준비 중...", 0)

        # 0. Warmup 기간 계산
        step_start = time.perf_counter()
        all_conditions = request.buyConditions + request.sellConditions
        warmup_period = self._calculate_warmup_period(all_conditions)
        profiling["0_warmup_calc"] = time.perf_counter() - step_start

        # 1. OHLCV 데이터 수집 (warmup 포함)
        update("데이터 수집 중...", 10)
        step_start = time.perf_counter()
        df_full = self.data_service.get_ohlcv_dataframe(
            symbol=request.symbol,
            timeframe=request.timeframe,
            limit=1000 + warmup_period,
            start_date=request.startDate,
            end_date=request.endDate,
            include_warmup=warmup_period,
        )
        profiling["1_data_fetch"] = time.perf_counter() - step_start

        if df_full.empty:
            raise ValueError("해당 기간에 데이터가 없습니다.")

        df = df_full
        profiling["data_rows"] = len(df)

        # 2. 매수/매도 시그널 생성
        update("거래 시그널 분석 중...", 30)
        step_start = time.perf_counter()
        buy_signal = self.strategy_parser.generate_signal(df, request.buyConditions)
        profiling["2a_buy_signal"] = time.perf_counter() - step_start

        # 청산 조건은 하나로 합치지 않고 조건별로 풀어 둔다. 익절/손절은 진입가를
        # 알아야 해서 시뮬레이션 루프(order_func_nb) 안에서만 판단할 수 있다
        step_start = time.perf_counter()
        exit_set = self.strategy_parser.compile_exit_conditions(df, request.sellConditions)
        profiling["2b_sell_signal"] = time.perf_counter() - step_start

        # 3. 요청 기간으로 데이터 트림 (warmup 제외)
        update("데이터 전처리 중...", 40)
        step_start = time.perf_counter()
        if request.startDate:
            adjusted_start_date = adjust_start_date_for_timeframe(
                request.startDate, request.timeframe
            )
            start_filter = df.index >= adjusted_start_date
            df_trimmed = df[start_filter]
            buy_signal = buy_signal[start_filter]
            exit_set = exit_set[np.asarray(start_filter)]
        else:
            df_trimmed = df

        valid_timestamps = set(df_trimmed.reset_index()["timestamp"].tolist())
        profiling["3_data_trim"] = time.perf_counter() - step_start
        profiling["trimmed_rows"] = len(df_trimmed)

        # 기준선(그냥 샀다면). 거래 유무와 무관하게 같은 기간으로 계산한다
        amount_prec, price_prec = get_coin_precision(request.symbol)
        precision_mult = 10**amount_prec
        buy_hold_pct, buy_hold_usdt = buy_and_hold_return(
            df_trimmed["open"].to_numpy(dtype=np.float64),
            df_trimmed["close"].to_numpy(dtype=np.float64),
            float(request.initialCapital),
            request.feeRate / 100,
            request.slippage / 100,
            precision_mult,
        )

        # 4. 진입 시그널이 없으면 거래가 생길 수 없으므로 빈 결과 반환
        if not buy_signal.any():
            update("결과 정리 중...", 90)
            ohlcv_data = self.result_analyzer.build_ohlcv(df_trimmed)
            indicators_data = self.result_analyzer.extract_indicators(
                df, all_conditions, valid_timestamps
            )

            profiling["total"] = time.perf_counter() - total_start
            logger.debug(f"[PROFILING - No Trades] {profiling}")

            update("완료", 100)

            return BacktestResult(
                symbol=request.symbol,
                amountPrecision=amount_prec,
                pricePrecision=price_prec,
                totalReturn=0,
                buyHoldReturn=buy_hold_pct,
                buyHoldReturnUsdt=buy_hold_usdt,
                winRate=0,
                maxDrawdown=0,
                totalTrades=0,
                profitTrades=0,
                lossTrades=0,
                sharpeRatio=0,
                profitFactor=0,
                equityCurve=[],
                trades=[],
                ohlcv=ohlcv_data,
                indicators=indicators_data,
            )

        # 5. VectorBT 포트폴리오 시뮬레이션 (from_order_func: 복리 + 정확한 버림 처리)
        update("포트폴리오 시뮬레이션 중...", 50)
        step_start = time.perf_counter()
        close = df_trimmed["close"]
        open_price = df_trimmed["open"]

        # timeframe을 VectorBT freq 형식으로 매핑
        freq_map = {
            "15m": "15min",
            "1h": "1H",
            "4h": "4H",
            "1d": "1D",
            "1w": None,
            "1M": None,
        }
        vbt_freq = freq_map.get(request.timeframe, "1D")

        # 신호를 1기간 shift하여 "어제 신호 → 오늘 시가 진입" 시뮬레이션
        # (익절/손절은 order_func_nb 가 전 봉 종가로 판단하므로 같은 규칙이 적용된다)
        # fill_value 로 채워야 bool dtype 이 유지된다. fillna(False) 는 object 로 올라갔다
        # 내려오면서 pandas 가 downcasting 폐기 경고를 낸다
        entries_shifted = buy_signal.shift(1, fill_value=False).astype(bool)
        exit_set = exit_set.shifted(1)

        # (precision_mult 는 위 기준선 계산에서 이미 구했다)

        # 배열 준비 (numpy)
        entries_arr = entries_shifted.values.astype(np.bool_)
        open_arr = open_price.values.astype(np.float64)
        close_arr = close.values.astype(np.float64)
        fees_rate = request.feeRate / 100
        slippage_rate = request.slippage / 100

        # from_order_func로 포트폴리오 시뮬레이션
        # (order_func_nb는 모듈 레벨 정의 - 재컴파일 방지, 상단 주석 참고)
        # close 는 Series 로 넘긴다. DataFrame 으로 넘기면 value()/total_return() 등이
        # 전부 열 하나짜리 DataFrame/Series 로 나와서 스칼라가 필요한 곳마다
        # float(Series) 를 해야 했고, 이게 pandas 에서 폐기 예정(FutureWarning)이다.
        # Series 면 통계는 스칼라, value() 는 봉 단위 Series 로 바로 나온다
        portfolio = vbt.Portfolio.from_order_func(
            close,
            order_func_nb,
            entries_arr,
            exit_set.signals,
            exit_set.kinds,
            exit_set.values,
            exit_set.ops,
            open_arr,
            close_arr,
            precision_mult,
            fees_rate,
            slippage_rate,
            init_cash=request.initialCapital,
            freq=vbt_freq,
        )
        profiling["4_vbt_portfolio"] = time.perf_counter() - step_start

        # ========== 디버그 로그 ==========
        orders = portfolio.orders.records_readable
        if len(orders) > 0:
            first_order = orders.iloc[0]
            first_entry_idx = entries_shifted[entries_shifted].index[0]
            first_entry_price = open_price.loc[first_entry_idx]

            expected_qty = request.initialCapital / first_entry_price
            expected_floored = np.floor(expected_qty * precision_mult) / precision_mult

            logger.debug(f"""
========== ORDER DEBUG (from_order_func) ==========
초기 자본금: {request.initialCapital}
첫 진입 가격: {first_entry_price}
이론상 수량: {expected_qty}
버림 처리 (precision={amount_prec}): {expected_floored}
VectorBT 실제 수량: {first_order["Size"]}
차이: {expected_floored - first_order["Size"]}
===================================================
""")

        # 6. 결과 추출
        update("결과 정리 중...", 90)
        step_start = time.perf_counter()

        total_return = safe_float(portfolio.total_return() * 100)

        # 포트폴리오 가치 시계열 (봉 단위 Series). close 를 Series 로 넘겼으므로 바로
        # Series 다. 혹시 2차원으로 오면 첫 열을 꺼낸다 (analyzer 에도 같은 방어가 있다)
        equity = portfolio.value()
        if getattr(equity, "ndim", 1) == 2:
            equity = equity.iloc[:, 0]

        # USDT 절대값 계산
        final_equity = float(equity.iloc[-1])
        total_return_usdt = safe_float(final_equity - request.initialCapital)

        try:
            max_dd = safe_float(portfolio.max_drawdown() * 100)
        except (ValueError, TypeError):
            peak = equity.cummax()
            drawdown = (peak - equity) / peak * 100
            max_dd = safe_float(drawdown.max())

        # 최대 낙폭 USDT 계산 (고점 대비 최대 하락액)
        peak = equity.cummax()
        drawdown_usdt = peak - equity
        max_dd_usdt = safe_float(drawdown_usdt.max())

        try:
            # VectorBT 기본 샤프 비율 사용
            sharpe_ratio = safe_float(portfolio.sharpe_ratio())
            logger.debug(f"VectorBT Sharpe Ratio: {sharpe_ratio}")
        except (ValueError, TypeError) as e:
            logger.error(f"샤프 비율 계산 오류: {e}")
            sharpe_ratio = None

        trades_closed = portfolio.trades.closed
        closed_count = int(trades_closed.count())

        if closed_count > 0:
            _win_rate = trades_closed.win_rate
            _profit_factor = trades_closed.profit_factor
            win_rate = safe_float((_win_rate() if callable(_win_rate) else _win_rate) * 100)
            profit_factor = safe_float(
                _profit_factor() if callable(_profit_factor) else _profit_factor
            )
        else:
            win_rate = 0.0
            profit_factor = 0.0

        profiling["5a_stats"] = time.perf_counter() - step_start

        # 수익 곡선 (위에서 Series 로 만든 equity 를 그대로 쓴다)
        step_start = time.perf_counter()
        equity_curve = self.result_analyzer.build_equity_curve(equity)
        profiling["5b_equity_curve"] = time.perf_counter() - step_start

        # 거래 내역
        step_start = time.perf_counter()
        trades_df = portfolio.trades.records_readable

        last_timestamp = df_trimmed.index[-1] if len(df_trimmed) > 0 else None
        trade_records = self.result_analyzer.build_trades(
            trades_df, request.slippage, last_timestamp, df_ohlcv=df_trimmed
        )
        profiling["5c_trades"] = time.perf_counter() - step_start
        profiling["trade_count"] = len(trade_records)
        profiling["closed_trades"] = closed_count

        # 수익/손실 거래 수
        profit_trades = len([t for t in trade_records if t.pnl > 0 and not t.isOpen])
        loss_trades = len([t for t in trade_records if t.pnl <= 0 and not t.isOpen])

        # OHLCV 데이터
        step_start = time.perf_counter()
        ohlcv_data = self.result_analyzer.build_ohlcv(df_trimmed)
        profiling["6_ohlcv_build"] = time.perf_counter() - step_start

        # 지표 데이터
        step_start = time.perf_counter()
        indicators_data = self.result_analyzer.extract_indicators(
            df, all_conditions, valid_timestamps
        )
        profiling["7_indicators"] = time.perf_counter() - step_start

        profiling["total"] = time.perf_counter() - total_start

        # 프로파일링 로깅
        logger.debug(f"""
========== BACKTEST PROFILING REPORT ==========
Symbol: {request.symbol}, Timeframe: {request.timeframe}
Data rows (with warmup): {profiling.get("data_rows", 0)}
Data rows (trimmed): {profiling.get("trimmed_rows", 0)}
Trade count: {profiling.get("trade_count", 0)}
-----------------------------------------------
0. Warmup calc:     {profiling.get("0_warmup_calc", 0) * 1000:.2f}ms
1. Data fetch:      {profiling.get("1_data_fetch", 0) * 1000:.2f}ms ⭐
2a. Buy signal:     {profiling.get("2a_buy_signal", 0) * 1000:.2f}ms
2b. Sell signal:    {profiling.get("2b_sell_signal", 0) * 1000:.2f}ms
3. Data trim:       {profiling.get("3_data_trim", 0) * 1000:.2f}ms
4. VBT Portfolio:   {profiling.get("4_vbt_portfolio", 0) * 1000:.2f}ms ⭐
5a. Stats:          {profiling.get("5a_stats", 0) * 1000:.2f}ms
5b. Equity curve:   {profiling.get("5b_equity_curve", 0) * 1000:.2f}ms
5c. Trades:         {profiling.get("5c_trades", 0) * 1000:.2f}ms
6. OHLCV build:     {profiling.get("6_ohlcv_build", 0) * 1000:.2f}ms
7. Indicators:      {profiling.get("7_indicators", 0) * 1000:.2f}ms
-----------------------------------------------
TOTAL:              {profiling.get("total", 0) * 1000:.2f}ms
===============================================
""")

        return BacktestResult(
            symbol=request.symbol,
            amountPrecision=amount_prec,
            pricePrecision=price_prec,
            totalReturn=total_return,
            totalReturnUsdt=total_return_usdt,
            buyHoldReturn=buy_hold_pct,
            buyHoldReturnUsdt=buy_hold_usdt,
            winRate=win_rate,
            maxDrawdown=max_dd,
            maxDrawdownUsdt=max_dd_usdt,
            totalTrades=closed_count,
            profitTrades=profit_trades,
            lossTrades=loss_trades,
            sharpeRatio=sharpe_ratio,
            profitFactor=profit_factor,
            equityCurve=equity_curve,
            trades=trade_records,
            ohlcv=ohlcv_data,
            indicators=indicators_data,
        )
