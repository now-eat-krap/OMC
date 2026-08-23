# 조건 모델 정의
# 프론트엔드의 SentenceCondition과 동일한 구조

from typing import Literal

from pydantic import BaseModel


class SentenceCondition(BaseModel):
    """문장형 조건 모델 - 프론트엔드와 동일 구조"""

    id: str
    templateType: Literal[
        "indicator_vs_value",
        "indicator_cross",
        "price_cross",
        "profit_loss",
        "band_touch",
        "macd_signal",
        "stochastic",
        "candle_pattern",
        "volume",
        "price_change",
    ]

    # 기본 슬롯
    indicator: str | None = None
    indicatorPeriod: int | None = None  # 옛 필드. params 가 없을 때 첫 파라미터(기간)로 쓴다
    targetIndicator: str | None = None
    targetPeriod: int | None = None  # 옛 필드. targetParams 가 없을 때 첫 파라미터로 쓴다

    # 지표 파라미터. 키는 지표 레지스트리(indicator_registry)가 정한다.
    # 예: RSI {"period": 14}, MACD {"fast": 12, "slow": 26, "signal": 9}, BB {"period": 20, "std": 2}
    # 템플릿이 지표를 하나만 쓰면(macd_signal, stochastic, band_touch) params 가 그 지표 것이다
    params: dict[str, float] | None = None
    targetParams: dict[str, float] | None = None  # indicator_cross 의 상대 지표용
    comparison: Literal["gt", "lt", "gte", "lte"] | None = None
    crossDirection: Literal["above", "below"] | None = None
    value: float | None = None
    priceType: Literal["close", "high", "low", "open"] | None = None
    profitDirection: Literal["profit", "loss"] | None = None

    # 밴드 터치용
    bandType: Literal["bollinger", "keltner", "envelope"] | None = None
    bandPosition: Literal["upper", "middle", "lower"] | None = None
    touchType: Literal["touch", "cross", "exit"] | None = None

    # MACD/스토캐스틱용
    macdType: str | None = None
    stochType: str | None = None

    # 캔들 패턴용
    candlePattern: str | None = None

    # 거래량용
    volumeMultiplier: float | None = None
    volumePeriod: int | None = None

    # 가격 변동용
    priceChangePercent: float | None = None
    priceChangeDirection: Literal["up", "down"] | None = None

    # 다음 조건과의 논리 연산자
    nextOperator: Literal["AND", "OR"] | None = "AND"
