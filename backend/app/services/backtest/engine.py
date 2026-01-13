# VectorBT 백테스트 실행 엔진
# 핵심 백테스트 로직 담당

import logging
import time

import numpy as np
import vectorbt as vbt

from app.core.config import get_coin_precision
from app.schemas import BacktestRequest, BacktestResult, SentenceCondition
from app.services.backtest.analyzer import ResultAnalyzer
from app.services.backtest.strategy import StrategyParser
from app.services.data import DataService
from app.utils import safe_float
from app.utils.date_utils import adjust_start_date_for_timeframe

logger = logging.getLogger(__name__)


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

    async def run(self, request: BacktestRequest) -> BacktestResult:
        """백테스트 실행

        Args:
            request: 백테스트 요청

        Returns:
            BacktestResult
        """
        profiling = {}
        total_start = time.perf_counter()

        # 0. Warmup 기간 계산
        step_start = time.perf_counter()
        all_conditions = request.buyConditions + request.sellConditions
        warmup_period = self._calculate_warmup_period(all_conditions)
        profiling["0_warmup_calc"] = time.perf_counter() - step_start

        # 1. OHLCV 데이터 수집 (warmup 포함)
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
        step_start = time.perf_counter()
        buy_signal = self.strategy_parser.generate_signal(df, request.buyConditions)
        profiling["2a_buy_signal"] = time.perf_counter() - step_start

        step_start = time.perf_counter()
        sell_signal = self.strategy_parser.generate_signal(df, request.sellConditions)
        profiling["2b_sell_signal"] = time.perf_counter() - step_start

        # 3. 요청 기간으로 데이터 트림 (warmup 제외)
        step_start = time.perf_counter()
        if request.startDate:
            adjusted_start_date = adjust_start_date_for_timeframe(
                request.startDate, request.timeframe
            )
            start_filter = df.index >= adjusted_start_date
            df_trimmed = df[start_filter]
            buy_signal = buy_signal[start_filter]
            sell_signal = sell_signal[start_filter]
        else:
            df_trimmed = df

        valid_timestamps = set(df_trimmed.reset_index()["timestamp"].tolist())
        profiling["3_data_trim"] = time.perf_counter() - step_start
        profiling["trimmed_rows"] = len(df_trimmed)

        # 4. 시그널 없으면 빈 결과 반환
        if not buy_signal.any() and not sell_signal.any():
            ohlcv_data = self.result_analyzer.build_ohlcv(df_trimmed)
            indicators_data = self.result_analyzer.extract_indicators(
                df, all_conditions, valid_timestamps
            )

            profiling["total"] = time.perf_counter() - total_start
            logger.info(f"[PROFILING - No Trades] {profiling}")

            return BacktestResult(
                totalReturn=0,
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
        entries_shifted = buy_signal.shift(1).fillna(False).astype(bool)
        exits_shifted = sell_signal.shift(1).fillna(False).astype(bool)

        # 최소주문수량 적용을 위한 precision 조회
        amount_prec, price_prec = get_coin_precision(request.symbol)
        precision_mult = 10**amount_prec

        # 배열 준비 (numpy)
        entries_arr = entries_shifted.values.astype(np.bool_)
        exits_arr = exits_shifted.values.astype(np.bool_)
        open_arr = open_price.values.astype(np.float64)
        fees_rate = request.feeRate / 100
        slippage_rate = request.slippage / 100

        # Numba JIT 컴파일된 주문 함수
        from numba import njit
        from vectorbt.portfolio import nb

        @njit
        def order_func_nb(c, entries, exits, open_prices, prec_mult, fees, slippage):
            """
            주문 함수 - 각 봉마다 호출
            c: OrderContext (현재 상태 정보 포함)
            """
            idx = c.i

            # 현재 포지션 보유 여부
            has_position = c.position_now > 0

            # 청산 시그널 (포지션 보유 중 + 청산 시그널)
            if has_position and exits[idx]:
                return nb.order_nb(
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
                    return nb.order_nb(
                        size=floored_qty,
                        price=price,
                        fees=fees,
                        slippage=slippage,
                    )

            return nb.order_nb(size=np.nan)

        # from_order_func로 포트폴리오 시뮬레이션
        # wrapper_kwargs로 datetime 인덱스 명시적 전달
        portfolio = vbt.Portfolio.from_order_func(
            close.to_frame(),  # pandas DataFrame으로 전달
            order_func_nb,
            entries_arr,
            exits_arr,
            open_arr,
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

            logger.info(f"""
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
        step_start = time.perf_counter()

        total_return = safe_float(portfolio.total_return() * 100)

        # USDT 절대값 계산
        equity = portfolio.value()
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
            logger.info(f"VectorBT Sharpe Ratio: {sharpe_ratio}")
        except (ValueError, TypeError) as e:
            logger.error(f"샤프 비율 계산 오류: {e}")
            sharpe_ratio = None

        trades_closed = portfolio.trades.closed
        _count = trades_closed.count()
        closed_count = int(_count.iloc[0]) if hasattr(_count, "iloc") else int(_count)

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

        # 수익 곡선
        step_start = time.perf_counter()
        equity = portfolio.value()
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
        logger.info(f"""
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

        # precision 정보 조회
        amount_prec, price_prec = get_coin_precision(request.symbol)

        return BacktestResult(
            symbol=request.symbol,
            amountPrecision=amount_prec,
            pricePrecision=price_prec,
            totalReturn=total_return,
            totalReturnUsdt=total_return_usdt,
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
