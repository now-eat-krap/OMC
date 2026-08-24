# 전략 파싱 및 시그널 생성
# 조건 리스트를 기반으로 매수/매도 시그널 생성

from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.schemas import SentenceCondition
from app.services import expression as expression_engine
from app.services import indicator_registry as registry

# 청산 조건 종류 (order_func_nb 에 넘기는 정수 코드)
EXIT_KIND_SIGNAL = 0  # 미리 계산한 불리언 시그널
EXIT_KIND_PROFIT = 1  # 진입가 대비 수익률 >= value%
EXIT_KIND_LOSS = 2  # 진입가 대비 수익률 <= -value%

# 조건 사이 논리 연산자 (정수 코드)
EXIT_OP_AND = 0
EXIT_OP_OR = 1


@dataclass
class ExitConditionSet:
    """청산 조건을 시뮬레이션 루프가 평가할 수 있는 형태로 풀어놓은 것

    profit_loss 조건은 진입가를 알아야 판단할 수 있는데, 진입가는 시뮬레이션을
    돌려봐야 나옵니다. 그래서 청산 조건은 미리 하나의 시그널로 합치지 않고
    조건별로 쪼개 두었다가 order_func_nb 가 봉마다 진입가를 보며 합칩니다.

    signals: (n_bars, n_conds) bool. kind 가 SIGNAL 인 열만 의미가 있습니다
    kinds:   (n_conds,) int. EXIT_KIND_*
    values:  (n_conds,) float. PROFIT/LOSS 의 임계 퍼센트(양수)
    ops:     (n_conds-1,) int. 조건 i 와 i+1 사이 연산자. 왼쪽부터 차례로 적용
    """

    signals: np.ndarray
    kinds: np.ndarray
    values: np.ndarray
    ops: np.ndarray

    @property
    def has_positional(self) -> bool:
        """진입가가 필요한 조건(익절/손절)이 하나라도 있는가"""
        return bool((self.kinds != EXIT_KIND_SIGNAL).any())

    def shifted(self, periods: int = 1) -> "ExitConditionSet":
        """시그널 열을 periods 만큼 뒤로 민다 (어제 신호 → 오늘 체결)"""
        shifted = np.zeros_like(self.signals)
        if periods < self.signals.shape[0]:
            shifted[periods:] = self.signals[:-periods]
        return ExitConditionSet(shifted, self.kinds, self.values, self.ops)

    def __getitem__(self, mask) -> "ExitConditionSet":
        """봉 축으로 마스킹 (기간 트림용)"""
        return ExitConditionSet(self.signals[mask], self.kinds, self.values, self.ops)


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

    def compile_exit_conditions(
        self,
        df: pd.DataFrame,
        conditions: list[SentenceCondition],
    ) -> ExitConditionSet:
        """청산 조건을 조건별 배열로 풀어 놓는다

        generate_signal 과 달리 하나로 합치지 않습니다. profit_loss 는 여기서
        평가할 수 없으므로(진입가 미정) 종류/임계값만 기록하고, 나머지 조건은
        평소처럼 불리언 시그널로 계산해 둡니다. 합치는 건 order_func_nb 가 합니다.
        연산자 적용 순서(왼쪽부터 차례로)는 generate_signal 과 같습니다.
        """
        n_bars = len(df)
        n = len(conditions)
        signals = np.zeros((n_bars, max(n, 1)), dtype=np.bool_)
        kinds = np.zeros(max(n, 1), dtype=np.int64)
        values = np.zeros(max(n, 1), dtype=np.float64)
        ops = np.zeros(max(n - 1, 0), dtype=np.int64)

        if n == 0:
            # 조건이 없으면 "항상 False" 하나로 둔다 (numba 쪽에서 빈 배열 분기 불필요)
            return ExitConditionSet(signals, kinds, values, ops)

        for i, condition in enumerate(conditions):
            if condition.templateType == "profit_loss":
                direction = condition.profitDirection or "profit"
                kinds[i] = EXIT_KIND_LOSS if direction == "loss" else EXIT_KIND_PROFIT
                # UI 슬라이더가 음수도 허용하므로 부호는 버리고 방향은 profitDirection 으로 정한다
                values[i] = abs(float(condition.value if condition.value is not None else 10.0))
            else:
                kinds[i] = EXIT_KIND_SIGNAL
                signals[:, i] = self._evaluate_condition(df, condition).to_numpy(dtype=np.bool_)

            if i < n - 1:
                ops[i] = EXIT_OP_OR if (condition.nextOperator or "AND") == "OR" else EXIT_OP_AND

        return ExitConditionSet(signals, kinds, values, ops)

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
            indicator_values = self._primary_series(
                df, condition.indicator or "RSI", condition.params, condition.indicatorPeriod
            )
            value = condition.value if condition.value is not None else 30
            return self._compare(indicator_values, value, condition.comparison or "lt")

        # 2. 지표 크로스
        elif template == "indicator_cross":
            fast = self._primary_series(
                df, condition.indicator or "SMA", condition.params, condition.indicatorPeriod or 5
            )
            slow = self._primary_series(
                df,
                condition.targetIndicator or "SMA",
                condition.targetParams,
                condition.targetPeriod or 20,
            )
            return self._cross(fast, slow, condition.crossDirection or "above")

        # 3. 가격 돌파
        elif template == "price_cross":
            price = df[condition.priceType or "close"]
            # 옛 프론트는 상대 지표를 targetIndicator/targetPeriod 에, AI 는 indicator/
            # indicatorPeriod 에 넣는다. 둘 다 받는다
            name = condition.targetIndicator or condition.indicator or "SMA"
            params = condition.targetParams or condition.params
            legacy = condition.targetPeriod or condition.indicatorPeriod or 20
            indicator = self._primary_series(df, name, params, legacy)
            return self._cross(price, indicator, condition.crossDirection or "above")

        # 4. 수익/손실
        # 진입가를 알아야 판단할 수 있어 여기서는 계산하지 못한다. 청산 조건은
        # compile_exit_conditions 가 따로 풀어 order_func_nb 가 봉마다 평가한다.
        # 매수 조건에 들어오면 포지션이 없으니 항상 False 가 맞다.
        elif template == "profit_loss":
            return pd.Series(False, index=df.index)

        # 5. 밴드 터치 / 돌파 / 이탈
        elif template == "band_touch":
            # bandType 대로 계산한다 (볼린저 / 켈트너 / 엔벨로프). 예전에는 무엇을 골라도
            # 볼린저였다
            spec = registry.get_band_spec(condition.bandType)
            params = spec.resolve_params(condition.params, condition.indicatorPeriod)
            out = registry.compute(df, spec, params)
            upper, middle, lower = out["upper"], out["middle"], out["lower"]
            price = df[condition.priceType or "low"]
            position = condition.bandPosition or "lower"

            if position == "upper":
                band = upper
            elif position == "middle":
                band = middle
            else:
                band = lower

            touch_type = condition.touchType or "touch"
            if touch_type == "cross":
                # 돌파: 그 봉에서 밴드를 가로지름 (상단·중간은 위로, 하단은 아래로)
                return self._cross(price, band, "below" if position == "lower" else "above")
            if touch_type == "exit":
                # 이탈: 밴드 바깥에 있는 상태. 상단은 위, 하단은 아래.
                # 중간선은 바깥이 없으니 돌파와 같게 본다
                if position == "upper":
                    return price > band
                if position == "lower":
                    return price < band
                return self._cross(price, band, "above")
            # 터치: 밴드 ±0.1% 안
            return (price <= band * 1.001) & (price >= band * 0.999)

        # 6. MACD 시그널 (params: fast/slow/signal. 예전엔 12/26/9 고정이었다)
        elif template == "macd_signal":
            spec = registry.get_spec("MACD")
            out = registry.compute(df, spec, spec.resolve_params(condition.params))
            return self._cross(out["macd"], out["signal"], condition.crossDirection or "above")

        # 7. 스토캐스틱 (params: period/smooth_k/smooth_d)
        elif template == "stochastic":
            spec = registry.get_spec("STOCH")
            params = spec.resolve_params(condition.params, condition.indicatorPeriod)
            out = registry.compute(df, spec, params)
            return self._cross(out["k"], out["d"], condition.crossDirection or "above")

        # 8. 캔들 패턴
        elif template == "candle_pattern":
            return self._detect_candle_pattern(df, condition.candlePattern or "hammer")

        # 9. 거래량
        elif template == "volume":
            avg_volume = df["volume"].rolling(window=condition.volumePeriod or 20).mean()
            threshold = avg_volume * (condition.volumeMultiplier or 2)
            return self._compare(df["volume"], threshold, condition.comparison or "gte")

        # 10-2 에서 처리. (순서 유지를 위해 아래 두 분기 사이에 둔다)
        # 10. 가격 변동
        elif template == "price_change":
            pct_change = df["close"].pct_change() * 100
            threshold = condition.priceChangePercent or 5

            if condition.priceChangeDirection == "up":
                return pct_change >= threshold
            else:
                return pct_change <= -threshold

        # 11. 커스텀 식 (Pine 부분집합). 파싱·화이트리스트 검증은 expression 모듈이 한다
        elif template == "expression":
            if not condition.expression:
                raise ValueError("expression 템플릿에는 식이 필요합니다")
            return expression_engine.evaluate_signal(df, condition.expression)

        return pd.Series(False, index=df.index)

    def _primary_series(
        self,
        df: pd.DataFrame,
        name: str,
        params: dict | None,
        legacy_period: int | None,
    ) -> pd.Series:
        """지표의 대표 선 (레지스트리 outputs[0]) 을 계산한다

        MACD 는 MACD 선, 볼린저는 중간선, 스토캐스틱은 %K. 모르는 이름은 레지스트리가
        에러를 낸다. 예전 _calculate_indicator 는 모르는 이름에 종가를 돌려줬다
        """
        spec = registry.get_spec(name)
        resolved = spec.resolve_params(params, legacy_period)
        return registry.compute(df, spec, resolved)[spec.primary_key]

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
