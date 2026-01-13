# 전략 파싱 및 시그널 생성
# 조건 리스트를 기반으로 매수/매도 시그널 생성


import pandas as pd

from app.schemas import SentenceCondition
from app.services import indicators


class StrategyParser:
    """전략 조건 파싱 및 시그널 생성 클래스"""

    def generate_signal(
        self,
        df: pd.DataFrame,
        conditions: list[SentenceCondition],
    ) -> pd.Series:
        """조건 리스트를 기반으로 시그널 생성

        Args:
            df: OHLCV DataFrame
            conditions: 조건 리스트

        Returns:
            Boolean Series (True = 시그널 발생)
        """
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
        """단일 조건 평가

        Args:
            df: OHLCV DataFrame
            condition: 평가할 조건

        Returns:
            Boolean Series
        """
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

        # 4. 수익/손실 (포지션 기반이라 별도 처리 필요)
        elif template == "profit_loss":
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

        # 8. 캔들 패턴
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
        """지표 계산 - indicators 모듈 사용

        Args:
            df: OHLCV DataFrame
            indicator: 지표 종류 (RSI, SMA, EMA, MACD, BB, STOCH)
            period: 지표 기간

        Returns:
            지표 Series
        """
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
        """볼린저밴드 계산"""
        return indicators.bollinger_bands(df["close"], period, std_dev)

    def _calculate_macd(
        self,
        df: pd.DataFrame,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
    ):
        """MACD 계산"""
        return indicators.macd(df["close"], fast, slow, signal)

    def _calculate_stochastic(
        self,
        df: pd.DataFrame,
        period: int = 14,
        smooth_k: int = 3,
        smooth_d: int = 3,
    ):
        """스토캐스틱 계산"""
        return indicators.stochastic(df["high"], df["low"], df["close"], period, smooth_k, smooth_d)

    def _compare(
        self,
        series: pd.Series,
        value: float,
        operator: str,
    ) -> pd.Series:
        """비교 연산

        Args:
            series: 비교할 Series
            value: 비교 대상 값 (또는 Series)
            operator: 비교 연산자 (gt, lt, gte, lte)

        Returns:
            Boolean Series
        """
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
        """크로스 감지

        Args:
            fast: 빠른 라인 Series
            slow: 느린 라인 Series
            direction: 방향 (above = 상향 돌파, below = 하향 돌파)

        Returns:
            Boolean Series (크로스 발생 지점)
        """
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
        """캔들 패턴 감지

        Args:
            df: OHLCV DataFrame
            pattern: 패턴 이름

        Returns:
            Boolean Series (패턴 감지 지점)
        """
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
