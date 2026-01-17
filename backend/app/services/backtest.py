# VectorBT 백테스트 서비스
# 조건 파싱 및 시그널 생성

import math
from datetime import datetime

import pandas as pd
import vectorbt as vbt

from app.config import get_coin_precision
from app.models import (
    BacktestRequest,
    BacktestResult,
    IndicatorData,
    IndicatorDataPoint,
    OHLCVData,
    SentenceCondition,
    TradeRecord,
)
from app.services import indicators
from app.services.data import DataService


def safe_float(value, default=0.0):
    """inf, -inf, nan 값을 안전한 값으로 변환"""
    if value is None:
        return default
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default


class BacktestService:
    """VectorBT 기반 백테스트 서비스"""

    def __init__(self):
        self.data_service = DataService()

    def _calculate_warmup_period(self, conditions: list[SentenceCondition]) -> int:
        """조건에서 필요한 최대 warmup 기간 계산"""
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

        # 최소 250일의 warmup 보장 (RSI 등 수렴형 지표가 정확한 값에 도달하려면 충분한 과거 데이터 필요)
        return max(max_period + 10, 1000)

    async def run(self, request: BacktestRequest) -> BacktestResult:
        """백테스트 실행"""
        import logging
        import time

        logger = logging.getLogger(__name__)
        profiling = {}  # 프로파일링 결과 저장
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
            limit=1000 + warmup_period,  # warmup 기간만큼 추가
            start_date=request.startDate,
            end_date=request.endDate,
            include_warmup=warmup_period,  # warmup 캔들 포함
        )
        profiling["1_data_fetch"] = time.perf_counter() - step_start

        if df_full.empty:
            raise ValueError("해당 기간에 데이터가 없습니다.")

        # warmup 포함된 전체 데이터로 지표 계산 (warmup 덕분에 지표가 처음부터 유효)
        df = df_full
        profiling["data_rows"] = len(df)

        # 2. 매수/매도 시그널 생성 (전체 데이터로 계산)
        step_start = time.perf_counter()
        buy_signal = self._generate_signal(df, request.buyConditions)
        profiling["2a_buy_signal"] = time.perf_counter() - step_start

        step_start = time.perf_counter()
        sell_signal = self._generate_signal(df, request.sellConditions)
        profiling["2b_sell_signal"] = time.perf_counter() - step_start

        # 3. 요청 기간으로 데이터 트림 (warmup 제외)
        step_start = time.perf_counter()
        # startDate 이후 데이터만 사용하여 응답
        if request.startDate:
            # 주봉/월봉은 시작일을 해당 기간의 시작점으로 조정
            adjusted_start_date = request.startDate
            start_dt = datetime.strptime(request.startDate, "%Y-%m-%d")

            if request.timeframe in ["1w", "w", "W"]:
                # 해당 주의 월요일로 조정
                days_since_monday = start_dt.weekday()
                adjusted_start_dt = start_dt - pd.Timedelta(days=days_since_monday)
                adjusted_start_date = adjusted_start_dt.strftime("%Y-%m-%d")
            elif request.timeframe in ["1M", "M"]:
                # 해당 월의 1일로 조정
                adjusted_start_dt = start_dt.replace(day=1)
                adjusted_start_date = adjusted_start_dt.strftime("%Y-%m-%d")

            start_filter = df.index >= adjusted_start_date
            df_trimmed = df[start_filter]
            buy_signal = buy_signal[start_filter]
            sell_signal = sell_signal[start_filter]
        else:
            df_trimmed = df

        # 트림된 데이터의 타임스탬프 집합 (필터링용)
        valid_timestamps = set(df_trimmed.reset_index()["timestamp"].tolist())
        profiling["3_data_trim"] = time.perf_counter() - step_start
        profiling["trimmed_rows"] = len(df_trimmed)

        # 4. VectorBT 포트폴리오 시뮬레이션 (트림된 데이터로)
        close = df_trimmed["close"]

        # 시그널이 없으면 거래 없이 OHLCV와 지표만 반환
        if not buy_signal.any() and not sell_signal.any():
            # OHLCV 데이터 (차트용) - 트림된 데이터만
            step_start = time.perf_counter()
            # to_dict('records') 사용으로 iterrows() 대비 50~100배 빠름
            df_records = df_trimmed.reset_index().to_dict("records")
            ohlcv_data = [
                OHLCVData(
                    timestamp=int(row["timestamp"]),
                    open=safe_float(row["open"]),
                    high=safe_float(row["high"]),
                    low=safe_float(row["low"]),
                    close=safe_float(row["close"]),
                    volume=safe_float(row["volume"]),
                )
                for row in df_records
            ]
            profiling["ohlcv_build"] = time.perf_counter() - step_start

            # 사용된 지표 데이터 추출 (전체 df로 계산 후 트림)
            step_start = time.perf_counter()
            indicators_data = self._extract_indicators(
                df, request.buyConditions + request.sellConditions, valid_timestamps
            )
            profiling["indicators_extract"] = time.perf_counter() - step_start

            profiling["total"] = time.perf_counter() - total_start
            logger.debug(f"[PROFILING - No Trades] {profiling}")

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

        # VectorBT 포트폴리오 생성
        step_start = time.perf_counter()

        # timeframe을 VectorBT freq 형식으로 매핑
        # 주의: pandas는 'M'(월), 'W'(주)를 timedelta로 지원하지 않음 (가변적 길이)
        # 따라서 월봉/주봉은 None으로 설정 (Sharpe Ratio 등 시간 기반 통계는 부정확할 수 있음)
        freq_map = {
            "15m": "15min",  # 15분
            "1h": "1H",  # 1시간
            "4h": "4H",  # 4시간
            "1d": "1D",  # 1일
            "1w": None,  # 1주 - pandas timedelta 미지원
            "1M": None,  # 1월 - pandas timedelta 미지원
        }
        vbt_freq = freq_map.get(request.timeframe, "1D")  # 기본값 1일

        # 시가(open) 데이터 준비
        open_price = df_trimmed["open"]

        # 신호를 1기간 shift하여 현실적인 매매 시뮬레이션
        # "어제 신호 발생 → 오늘 시가에서 진입" 방식
        entries_shifted = buy_signal.shift(1).fillna(False)
        exits_shifted = sell_signal.shift(1).fillna(False)
        # positionSize
        portfolio = vbt.Portfolio.from_signals(
            close=close,
            open=open_price,  # 시가 데이터 제공
            entries=entries_shifted,
            exits=exits_shifted,
            init_cash=request.initialCapital,
            fees=request.feeRate / 100,  # 퍼센트를 비율로
            slippage=request.slippage / 100,
            freq=vbt_freq,
            # 진입/청산 가격을 시가로 설정
            price=open_price,
            accumulate=False,
        )
        profiling["4_vbt_portfolio"] = time.perf_counter() - step_start

        # 5. 결과 추출 - 개별 속성 접근으로 최적화 (stats() 전체 호출 대신)
        step_start = time.perf_counter()

        # 필요한 통계만 개별적으로 추출 (stats() 전체 호출보다 훨씬 빠름)
        total_return = safe_float(portfolio.total_return() * 100)  # 비율 → 퍼센트

        # max_drawdown, sharpe_ratio는 freq에 의존하므로 try-except로 감싸기
        # 주봉/월봉에서는 pandas가 'W-MON', 'MS' 등으로 freq를 추론하여 오류 발생 가능
        try:
            max_dd = safe_float(portfolio.max_drawdown() * 100)  # 비율 → 퍼센트
        except (ValueError, TypeError):
            # freq 관련 오류 시 수동 계산
            equity = portfolio.value()
            peak = equity.cummax()
            drawdown = (peak - equity) / peak * 100
            max_dd = safe_float(drawdown.max())

        try:
            sharpe_ratio = safe_float(portfolio.sharpe_ratio())
        except (ValueError, TypeError):
            # freq 관련 오류 시 0으로 설정 (연간화 계산 불가)
            sharpe_ratio = 0.0

        # 통계는 확정된 거래(closed)만 사용 - 기간 끝 강제 청산 제외
        trades_closed = portfolio.trades.closed
        closed_count = int(trades_closed.count())

        # win_rate, profit_factor는 확정된 거래만으로 계산
        if closed_count > 0:
            _win_rate = trades_closed.win_rate
            _profit_factor = trades_closed.profit_factor
            # callable인 경우 호출
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
        equity_curve = [
            {"date": ts.isoformat(), "value": safe_float(val)} for ts, val in equity.items()
        ]
        profiling["5b_equity_curve"] = time.perf_counter() - step_start

        # 거래 내역 - 전체 trades 사용 (미실현 손익 포함)
        step_start = time.perf_counter()
        trades_obj = portfolio.trades
        trades_df = trades_obj.records_readable
        trade_records = []
        cumulative_pnl = 0  # 누적 손익 추적

        # 마지막 봉의 타임스탬프 (미실현 손익 판단용)
        last_timestamp = df_trimmed.index[-1] if len(df_trimmed) > 0 else None

        if len(trades_df) > 0:
            # to_dict('records') 사용으로 iterrows() 대비 빠름
            trades_list = trades_df.to_dict("records")
            for trade in trades_list:
                pnl = float(trade.get("PnL", 0))
                cumulative_pnl += pnl

                # 수수료 계산 (진입 + 청산 수수료)
                entry_fees = safe_float(trade.get("Entry Fees", 0))
                exit_fees = safe_float(trade.get("Exit Fees", 0))
                total_fee = entry_fees + exit_fees

                # 슬리피지는 VectorBT가 직접 제공하지 않으므로 가격 차이에서 추정
                # 현재는 설정된 슬리피지 비율로 계산
                entry_price = float(trade.get("Avg Entry Price", 0))
                size = safe_float(trade.get("Size", 0))
                slippage_amount = entry_price * size * (request.slippage / 100)

                # 청산 시점이 마지막 봉이면 미실현 손익으로 표시
                exit_timestamp = trade.get("Exit Timestamp", None)
                is_open = (
                    (exit_timestamp == last_timestamp) if last_timestamp is not None else False
                )

                trade_records.append(
                    TradeRecord(
                        entryTime=str(trade.get("Entry Timestamp", "")),
                        exitTime=str(trade.get("Exit Timestamp", "")),
                        entryPrice=entry_price,
                        exitPrice=float(trade.get("Avg Exit Price", 0)),
                        pnl=pnl,
                        pnlPercent=float(trade.get("Return", 0) * 100),
                        type="long",
                        fee=safe_float(total_fee),
                        slippage=safe_float(slippage_amount),
                        size=size,
                        runup=safe_float(trade.get("Max Return", 0) * 100),  # VectorBT의 Max Return
                        drawdown=safe_float(
                            trade.get("Max DD", 0) * 100
                        ),  # VectorBT의 Max Drawdown
                        cumulativePnl=safe_float(cumulative_pnl),
                        isOpen=is_open,  # 미실현 손익 여부
                    )
                )
        profiling["5c_trades"] = time.perf_counter() - step_start
        profiling["trade_count"] = len(trade_records)
        profiling["closed_trades"] = closed_count

        # 수익/손실 거래 수 - 확정된 거래만 계산
        profit_trades = len([t for t in trade_records if t.pnl > 0 and not t.isOpen])
        loss_trades = len([t for t in trade_records if t.pnl <= 0 and not t.isOpen])

        # OHLCV 데이터 (차트용) - 트림된 데이터만
        step_start = time.perf_counter()
        # to_dict('records') 사용으로 iterrows() 대비 50~100배 빠름
        df_records = df_trimmed.reset_index().to_dict("records")
        ohlcv_data = [
            OHLCVData(
                timestamp=int(row["timestamp"]),
                open=safe_float(row["open"]),
                high=safe_float(row["high"]),
                low=safe_float(row["low"]),
                close=safe_float(row["close"]),
                volume=safe_float(row["volume"]),
            )
            for row in df_records
        ]
        profiling["6_ohlcv_build"] = time.perf_counter() - step_start

        # 6. 사용된 지표 데이터 추출 (전체 df로 계산 후 트림)
        step_start = time.perf_counter()
        indicators_data = self._extract_indicators(
            df, request.buyConditions + request.sellConditions, valid_timestamps
        )
        profiling["7_indicators"] = time.perf_counter() - step_start

        profiling["total"] = time.perf_counter() - total_start

        # 프로파일링 결과 로깅
        logger.debug(f"[PROFILING] {profiling}")

        # 각 단계별 시간 상세 로깅
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

        # config에서 precision 정보 조회 (API 호출 없음)
        amount_prec, price_prec = get_coin_precision(request.symbol)

        return BacktestResult(
            symbol=request.symbol,
            amountPrecision=amount_prec,
            pricePrecision=price_prec,
            totalReturn=total_return,
            winRate=win_rate,
            maxDrawdown=max_dd,
            totalTrades=closed_count,  # 확정된 거래 수
            profitTrades=profit_trades,
            lossTrades=loss_trades,
            sharpeRatio=sharpe_ratio,
            profitFactor=profit_factor,
            equityCurve=equity_curve,
            trades=trade_records,
            ohlcv=ohlcv_data,
            indicators=indicators_data,
        )

    def _generate_signal(
        self,
        df: pd.DataFrame,
        conditions: list[SentenceCondition],
    ) -> pd.Series:
        """조건 리스트를 기반으로 시그널 생성"""

        if not conditions:
            return pd.Series(False, index=df.index)

        # 각 조건별 시그널 생성
        signals = []
        operators = []

        for i, condition in enumerate(conditions):
            signal = self._evaluate_condition(df, condition)
            signals.append(signal)

            if i < len(conditions) - 1:
                operators.append(condition.nextOperator or "AND")

        # 조건들을 논리 연산으로 결합
        result = signals[0]
        for i, op in enumerate(operators):
            if op == "AND":
                result = result & signals[i + 1]
            else:  # OR
                result = result | signals[i + 1]

        return result

    def _evaluate_condition(
        self,
        df: pd.DataFrame,
        condition: SentenceCondition,
    ) -> pd.Series:
        """단일 조건 평가"""

        template = condition.templateType

        # 1. 지표 vs 값
        if template == "indicator_vs_value":
            indicator_values = self._calculate_indicator(
                df,
                condition.indicator or "RSI",
                condition.indicatorPeriod or 14,
            )
            value = condition.value or 30
            return self._compare(indicator_values, value, condition.comparison or "lt")

        # 2. 지표 크로스
        elif template == "indicator_cross":
            fast = self._calculate_indicator(
                df,
                condition.indicator or "SMA",
                condition.indicatorPeriod or 5,
            )
            slow = self._calculate_indicator(
                df,
                condition.targetIndicator or "SMA",
                condition.targetPeriod or 20,
            )
            return self._cross(fast, slow, condition.crossDirection or "above")

        # 3. 가격 돌파
        elif template == "price_cross":
            price = df[condition.priceType or "close"]
            indicator = self._calculate_indicator(
                df,
                condition.targetIndicator or "SMA",
                condition.targetPeriod or 20,
            )
            return self._cross(price, indicator, condition.crossDirection or "above")

        # 4. 수익/손실 (이건 포지션 기반이라 별도 처리 필요)
        elif template == "profit_loss":
            # 현재는 간단히 False 반환 (포지션 진입 후 처리 필요)
            return pd.Series(False, index=df.index)

        # 5. 밴드 터치
        elif template == "band_touch":
            upper, middle, lower = self._calculate_bollinger(
                df,
                condition.indicatorPeriod or 20,
            )
            price = df[condition.priceType or "low"]

            if condition.bandPosition == "upper":
                band = upper
            elif condition.bandPosition == "middle":
                band = middle
            else:
                band = lower

            if condition.touchType == "cross":
                return self._cross(
                    price, band, "below" if condition.bandPosition == "lower" else "above"
                )
            else:  # touch
                return (price <= band * 1.001) & (price >= band * 0.999)

        # 6. MACD 시그널
        elif template == "macd_signal":
            macd, signal, _ = self._calculate_macd(df)
            return self._cross(macd, signal, condition.crossDirection or "above")

        # 7. 스토캐스틱
        elif template == "stochastic":
            k, d = self._calculate_stochastic(df, condition.indicatorPeriod or 14)
            return self._cross(k, d, condition.crossDirection or "above")

        # 8. 캔들 패턴 (간단한 구현)
        elif template == "candle_pattern":
            return self._detect_candle_pattern(df, condition.candlePattern or "hammer")

        # 9. 거래량
        elif template == "volume":
            avg_volume = df["volume"].rolling(window=condition.volumePeriod or 20).mean()
            threshold = avg_volume * (condition.volumeMultiplier or 2)
            return self._compare(df["volume"], threshold, condition.comparison or "gte")

        # 10. 가격 변동
        elif template == "price_change":
            pct_change = df["close"].pct_change() * 100
            threshold = condition.priceChangePercent or 5

            if condition.priceChangeDirection == "up":
                return pct_change >= threshold
            else:
                return pct_change <= -threshold

        return pd.Series(False, index=df.index)

    def _calculate_indicator(
        self,
        df: pd.DataFrame,
        indicator: str,
        period: int,
    ) -> pd.Series:
        """지표 계산 - indicators 모듈 사용"""

        close = df["close"]
        high = df["high"]
        low = df["low"]

        if indicator == "RSI":
            return indicators.rsi(close, period)
        elif indicator in ["SMA", "MA"]:
            return indicators.sma(close, period)
        elif indicator == "EMA":
            return indicators.ema(close, period)
        elif indicator == "MACD":
            macd_line, _, _ = indicators.macd(close)
            return macd_line
        elif indicator == "BB":
            _, middle, _ = indicators.bollinger_bands(close, period)
            return middle
        elif indicator == "STOCH":
            k, _ = indicators.stochastic(high, low, close, period)
            return k

        return close  # 기본값

    def _calculate_bollinger(
        self,
        df: pd.DataFrame,
        period: int = 20,
        std_dev: float = 2.0,
    ):
        """볼린저밴드 계산 - indicators 모듈 사용"""
        return indicators.bollinger_bands(df["close"], period, std_dev)

    def _calculate_macd(
        self,
        df: pd.DataFrame,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
    ):
        """MACD 계산 - indicators 모듈 사용"""
        return indicators.macd(df["close"], fast, slow, signal)

    def _calculate_stochastic(
        self,
        df: pd.DataFrame,
        period: int = 14,
        smooth_k: int = 3,
        smooth_d: int = 3,
    ):
        """스토캐스틱 계산 - indicators 모듈 사용"""
        return indicators.stochastic(df["high"], df["low"], df["close"], period, smooth_k, smooth_d)

    def _compare(
        self,
        series: pd.Series,
        value: float,
        operator: str,
    ) -> pd.Series:
        """비교 연산"""
        if isinstance(value, pd.Series):
            if operator == "gt":
                return series > value
            elif operator == "lt":
                return series < value
            elif operator == "gte":
                return series >= value
            elif operator == "lte":
                return series <= value
        else:
            if operator == "gt":
                return series > value
            elif operator == "lt":
                return series < value
            elif operator == "gte":
                return series >= value
            elif operator == "lte":
                return series <= value
        return series > value

    def _cross(
        self,
        fast: pd.Series,
        slow: pd.Series,
        direction: str,
    ) -> pd.Series:
        """크로스 감지"""
        if direction == "above":
            # 상향 돌파: 이전에는 아래였는데 현재는 위
            return (fast > slow) & (fast.shift(1) <= slow.shift(1))
        else:
            # 하향 돌파: 이전에는 위였는데 현재는 아래
            return (fast < slow) & (fast.shift(1) >= slow.shift(1))

    def _detect_candle_pattern(
        self,
        df: pd.DataFrame,
        pattern: str,
    ) -> pd.Series:
        """캔들 패턴 감지 (간단한 구현)"""

        open_ = df["open"]
        high = df["high"]
        low = df["low"]
        close = df["close"]

        body = abs(close - open_)
        upper_shadow = high - pd.concat([close, open_], axis=1).max(axis=1)
        lower_shadow = pd.concat([close, open_], axis=1).min(axis=1) - low

        if pattern == "hammer":
            # 망치형: 아래 그림자가 몸통의 2배 이상, 위 그림자 작음
            return (lower_shadow >= body * 2) & (upper_shadow <= body * 0.5)

        elif pattern == "shooting_star":
            # 유성형: 위 그림자가 몸통의 2배 이상, 아래 그림자 작음
            return (upper_shadow >= body * 2) & (lower_shadow <= body * 0.5)

        elif pattern == "doji":
            # 도지: 몸통이 매우 작음
            avg_body = body.rolling(window=20).mean()
            return body < avg_body * 0.1

        elif pattern == "engulfing_bull":
            # 상승 장악형: 이전 음봉을 현재 양봉이 감싸는 형태
            prev_bearish = close.shift(1) < open_.shift(1)
            curr_bullish = close > open_
            engulf = (close > open_.shift(1)) & (open_ < close.shift(1))
            return prev_bearish & curr_bullish & engulf

        elif pattern == "engulfing_bear":
            # 하락 장악형: 이전 양봉을 현재 음봉이 감싸는 형태
            prev_bullish = close.shift(1) > open_.shift(1)
            curr_bearish = close < open_
            engulf = (close < open_.shift(1)) & (open_ > close.shift(1))
            return prev_bullish & curr_bearish & engulf

        return pd.Series(False, index=df.index)

    def _extract_indicators(
        self,
        df: pd.DataFrame,
        conditions: list[SentenceCondition],
        valid_timestamps: set = None,  # 유효한 타임스탬프 집합 (필터링용)
    ) -> list[IndicatorData]:
        """조건에서 사용된 지표 데이터 추출

        Args:
            valid_timestamps: 응답에 포함할 타임스탬프 집합 (None이면 전체)
        """

        indicator_list = []
        seen = set()  # 중복 방지

        # 타임스탬프 배열 생성
        all_timestamps = df.reset_index()["timestamp"].tolist()

        # 유효한 타임스탬프만 필터링
        if valid_timestamps:
            timestamps = [ts for ts in all_timestamps if ts in valid_timestamps]
            # 해당 인덱스도 추출
            valid_indices = [i for i, ts in enumerate(all_timestamps) if ts in valid_timestamps]
        else:
            timestamps = all_timestamps
            valid_indices = list(range(len(all_timestamps)))

        for condition in conditions:
            # 1. indicator_vs_value, indicator_cross 템플릿
            if condition.indicator and condition.indicatorPeriod:
                key = f"{condition.indicator}_{condition.indicatorPeriod}"
                if key not in seen:
                    seen.add(key)
                    ind_data = self._get_indicator_data(
                        df,
                        condition.indicator,
                        condition.indicatorPeriod,
                        timestamps,
                        valid_indices,
                    )
                    if ind_data:
                        indicator_list.append(ind_data)

            # 2. targetIndicator (크로스용)
            if condition.targetIndicator and condition.targetPeriod:
                key = f"{condition.targetIndicator}_{condition.targetPeriod}"
                if key not in seen:
                    seen.add(key)
                    ind_data = self._get_indicator_data(
                        df,
                        condition.targetIndicator,
                        condition.targetPeriod,
                        timestamps,
                        valid_indices,
                    )
                    if ind_data:
                        indicator_list.append(ind_data)

            # 3. MACD 시그널 템플릿
            if condition.templateType == "macd_signal":
                key = "MACD_12_26_9"
                if key not in seen:
                    seen.add(key)
                    macd, signal, histogram = self._calculate_macd(df)
                    # valid_indices로 필터링
                    macd_vals = [macd.values[i] for i in valid_indices]
                    signal_vals = [signal.values[i] for i in valid_indices]
                    hist_vals = [histogram.values[i] for i in valid_indices]
                    indicator_list.append(
                        IndicatorData(
                            name="MACD",
                            type="macd",
                            period=12,
                            data=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, macd_vals)
                            ],
                            signalLine=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, signal_vals)
                            ],
                            histogram=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, hist_vals)
                            ],
                        )
                    )

            # 4. 스토캐스틱 템플릿
            if condition.templateType == "stochastic":
                period = condition.indicatorPeriod or 14
                key = f"STOCH_{period}"
                if key not in seen:
                    seen.add(key)
                    k, d = self._calculate_stochastic(df, period)
                    # valid_indices로 필터링
                    k_vals = [k.values[i] for i in valid_indices]
                    d_vals = [d.values[i] for i in valid_indices]
                    indicator_list.append(
                        IndicatorData(
                            name=f"Stochastic({period})",
                            type="stoch",
                            period=period,
                            data=[],
                            kLine=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, k_vals)
                            ],
                            dLine=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, d_vals)
                            ],
                        )
                    )

            # 5. 볼린저밴드 템플릿
            if condition.templateType == "band_touch" and condition.bandType == "bollinger":
                period = condition.indicatorPeriod or 20
                key = f"BB_{period}"
                if key not in seen:
                    seen.add(key)
                    upper, middle, lower = self._calculate_bollinger(df, period)
                    # valid_indices로 필터링
                    upper_vals = [upper.values[i] for i in valid_indices]
                    middle_vals = [middle.values[i] for i in valid_indices]
                    lower_vals = [lower.values[i] for i in valid_indices]
                    indicator_list.append(
                        IndicatorData(
                            name=f"Bollinger({period})",
                            type="bb",
                            period=period,
                            data=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, middle_vals)
                            ],
                            upperBand=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, upper_vals)
                            ],
                            lowerBand=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, lower_vals)
                            ],
                        )
                    )

        return indicator_list

    def _get_indicator_data(
        self,
        df: pd.DataFrame,
        indicator: str,
        period: int,
        timestamps: list[int],
        valid_indices: list[int] = None,
    ) -> IndicatorData | None:
        """단일 지표 데이터 생성

        Args:
            valid_indices: 응답에 포함할 인덱스 리스트 (None이면 전체)
        """

        values = self._calculate_indicator(df, indicator, period)

        # valid_indices로 필터링
        if valid_indices:
            filtered_values = [values.values[i] for i in valid_indices]
        else:
            filtered_values = values.values

        if indicator == "RSI":
            return IndicatorData(
                name=f"RSI({period})",
                type="rsi",
                period=period,
                data=[
                    IndicatorDataPoint(timestamp=int(ts), value=float(v) if not pd.isna(v) else 0)
                    for ts, v in zip(timestamps, filtered_values)
                ],
            )
        elif indicator in ["SMA", "MA"]:
            return IndicatorData(
                name=f"SMA({period})",
                type="sma",
                period=period,
                data=[
                    IndicatorDataPoint(timestamp=int(ts), value=float(v) if not pd.isna(v) else 0)
                    for ts, v in zip(timestamps, filtered_values)
                ],
            )
        elif indicator == "EMA":
            return IndicatorData(
                name=f"EMA({period})",
                type="ema",
                period=period,
                data=[
                    IndicatorDataPoint(timestamp=int(ts), value=float(v) if not pd.isna(v) else 0)
                    for ts, v in zip(timestamps, filtered_values)
                ],
            )

        return None
