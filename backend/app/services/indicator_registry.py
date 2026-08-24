"""지표 레지스트리 - 지표 하나의 정보를 한 곳에 모은다

예전에는 "RSI 가 무엇인지"를 아는 곳이 일곱 군데였다 (계산 함수, 이름→함수 매핑,
차트용 추출, AI enum 두 곳, 프론트 선택지, 프론트 차트). 지표를 하나 추가하려면
전부 찾아다녀야 했고, 한 곳을 빠뜨리면 UI 에는 있는데 계산은 안 되거나 조용히
종가를 돌려주는 식으로 틀렸다.

이제 지표는 여기 IndicatorSpec 하나로 정의하고 나머지는 이 표를 읽는다.
- strategy: spec.compute 로 계산. if/elif 사슬 없음. 모르는 이름은 즉시 에러
- analyzer: spec.outputs / display 를 보고 차트 데이터를 만든다
- ai_strategy: enum 과 설명을 여기서 뽑는다
- GET /api/indicators: 프론트가 선택지·파라미터·기본값을 받아간다

새 지표를 추가하려면: 계산 함수 하나 + 아래 REGISTRY 에 한 항목.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal

import pandas as pd

from app.services import indicators

# 템플릿 이름 (schemas.condition 의 templateType 과 같다)
T_VALUE = "indicator_vs_value"
T_CROSS = "indicator_cross"
T_PRICE_CROSS = "price_cross"
T_BAND = "band_touch"
T_MACD = "macd_signal"
T_STOCH = "stochastic"


@dataclass(frozen=True)
class ParamSpec:
    """지표 파라미터 하나. UI 는 이 목록만큼 숫자 슬롯을 그린다"""

    name: str
    label: str
    default: float
    min: float
    max: float
    step: float = 1
    integer: bool = True

    def coerce(self, value: Any) -> float:
        """범위 안으로 자르고, 정수 파라미터는 정수로"""
        try:
            v = float(value)
        except (TypeError, ValueError):
            v = self.default
        v = max(self.min, min(self.max, v))
        return int(round(v)) if self.integer else v


# 출력 선 하나를 차트에 어떻게 그릴지
OutputRole = Literal[
    "line", "band_upper", "band_middle", "band_lower", "signal", "histogram", "k", "d"
]


@dataclass(frozen=True)
class OutputSpec:
    key: str
    label: str
    role: OutputRole = "line"


@dataclass(frozen=True)
class IndicatorSpec:
    name: str
    label: str
    description: str
    params: tuple[ParamSpec, ...]
    outputs: tuple[OutputSpec, ...]  # outputs[0] 이 조건 비교에 쓰는 대표 선
    display: Literal["overlay", "pane"]  # 가격 위에 겹치나, 별도 패널이냐
    templates: frozenset[str]  # 이 지표를 고를 수 있는 템플릿
    compute: Callable[[pd.DataFrame, dict[str, float]], dict[str, pd.Series]]
    value_range: tuple[float, float] | None = None  # RSI (0,100) 처럼 고정 범위
    inputs: frozenset[str] = frozenset({"close"})
    # 차트 보조선 (RSI 70/30 같은). 조건에서 값을 뽑아 쓰므로 기본은 없음
    band_type: str | None = None  # band_touch 의 bandType 값과 매칭 (bollinger 등)
    legacy_type: str = field(default="")  # 옛 프론트가 아는 type 문자열 (sma, rsi, bb ...)

    @property
    def primary_key(self) -> str:
        return self.outputs[0].key

    def default_params(self) -> dict[str, float]:
        return {p.name: p.default for p in self.params}

    def resolve_params(
        self, raw: dict[str, Any] | None, legacy_period: int | None = None
    ) -> dict[str, float]:
        """요청의 params 를 스펙에 맞게 정리한다

        - 없는 키는 기본값
        - 범위 밖은 잘라냄
        - 옛 요청(indicatorPeriod 만 있음)은 첫 번째 파라미터로 받아들인다.
          모든 지표의 첫 파라미터가 "기간" 역할이라 자연스럽다
        """
        out = self.default_params()
        if raw:
            for p in self.params:
                if p.name in raw and raw[p.name] is not None:
                    out[p.name] = p.coerce(raw[p.name])
        elif legacy_period is not None and self.params:
            first = self.params[0]
            out[first.name] = first.coerce(legacy_period)
        return out

    def warmup_bars(self, params: dict[str, float]) -> int:
        """이 지표가 안정되기 위해 필요한 앞 구간 봉 수 (가장 큰 기간 파라미터)"""
        periods = [params[p.name] for p in self.params if p.integer]
        return int(max(periods)) if periods else 0

    def to_public(self) -> dict[str, Any]:
        """API 응답용 (프론트 선택지·슬롯·차트 힌트)"""
        return {
            "name": self.name,
            "label": self.label,
            "description": self.description,
            "display": self.display,
            "valueRange": list(self.value_range) if self.value_range else None,
            "templates": sorted(self.templates),
            "bandType": self.band_type,
            "params": [
                {
                    "name": p.name,
                    "label": p.label,
                    "default": p.default,
                    "min": p.min,
                    "max": p.max,
                    "step": p.step,
                    "integer": p.integer,
                }
                for p in self.params
            ],
            "outputs": [{"key": o.key, "label": o.label, "role": o.role} for o in self.outputs],
        }


# ---------------------------------------------------------------------------
# 계산 함수 어댑터: (df, params) -> {output_key: Series}
# ---------------------------------------------------------------------------


def _rsi(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    return {"value": indicators.rsi(df["close"], int(p["period"]))}


def _sma(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    return {"value": indicators.sma(df["close"], int(p["period"]))}


def _ema(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    return {"value": indicators.ema(df["close"], int(p["period"]))}


def _macd(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    macd_line, signal_line, hist = indicators.macd(
        df["close"], int(p["fast"]), int(p["slow"]), int(p["signal"])
    )
    return {"macd": macd_line, "signal": signal_line, "histogram": hist}


def _bollinger(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    upper, middle, lower = indicators.bollinger_bands(
        df["close"], int(p["period"]), float(p["std"])
    )
    return {"middle": middle, "upper": upper, "lower": lower}


def _keltner(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    upper, middle, lower = indicators.keltner_channel(
        df["high"], df["low"], df["close"], int(p["period"]), float(p["multiplier"])
    )
    return {"middle": middle, "upper": upper, "lower": lower}


def _envelope(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    upper, middle, lower = indicators.envelope(df["close"], int(p["period"]), float(p["percent"]))
    return {"middle": middle, "upper": upper, "lower": lower}


def _stoch(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    k, d = indicators.stochastic(
        df["high"], df["low"], df["close"], int(p["period"]), int(p["smooth_k"]), int(p["smooth_d"])
    )
    return {"k": k, "d": d}


def _atr(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    return {"value": indicators.atr(df["high"], df["low"], df["close"], int(p["period"]))}


def _wma(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    return {"value": indicators.wma(df["close"], int(p["period"]))}


def _vwap(df: pd.DataFrame, p: dict[str, float]) -> dict[str, pd.Series]:
    return {
        "value": indicators.vwap(df["high"], df["low"], df["close"], df["volume"], int(p["period"]))
    }


_BAND_OUTPUTS = (
    OutputSpec("middle", "중간", "band_middle"),
    OutputSpec("upper", "상단", "band_upper"),
    OutputSpec("lower", "하단", "band_lower"),
)

# ---------------------------------------------------------------------------
# 레지스트리
# ---------------------------------------------------------------------------

_SPECS: tuple[IndicatorSpec, ...] = (
    IndicatorSpec(
        name="RSI",
        label="RSI",
        description="상대강도지수. 0~100, 70 위 과매수 / 30 아래 과매도",
        params=(ParamSpec("period", "기간", 14, 2, 200),),
        outputs=(OutputSpec("value", "RSI"),),
        display="pane",
        value_range=(0, 100),
        templates=frozenset({T_VALUE}),
        compute=_rsi,
        legacy_type="rsi",
    ),
    IndicatorSpec(
        name="SMA",
        label="SMA",
        description="단순이동평균",
        params=(ParamSpec("period", "기간", 20, 1, 500),),
        outputs=(OutputSpec("value", "SMA"),),
        display="overlay",
        templates=frozenset({T_VALUE, T_CROSS, T_PRICE_CROSS}),
        compute=_sma,
        legacy_type="sma",
    ),
    IndicatorSpec(
        name="EMA",
        label="EMA",
        description="지수이동평균",
        params=(ParamSpec("period", "기간", 20, 1, 500),),
        outputs=(OutputSpec("value", "EMA"),),
        display="overlay",
        templates=frozenset({T_VALUE, T_CROSS, T_PRICE_CROSS}),
        compute=_ema,
        legacy_type="ema",
    ),
    IndicatorSpec(
        name="MACD",
        label="MACD",
        description="이동평균 수렴·확산. MACD 선, 시그널 선, 히스토그램",
        params=(
            ParamSpec("fast", "단기", 12, 1, 200),
            ParamSpec("slow", "장기", 26, 2, 500),
            ParamSpec("signal", "시그널", 9, 1, 200),
        ),
        outputs=(
            OutputSpec("macd", "MACD"),
            OutputSpec("signal", "시그널", "signal"),
            OutputSpec("histogram", "히스토그램", "histogram"),
        ),
        display="pane",
        templates=frozenset({T_VALUE, T_MACD}),
        compute=_macd,
        legacy_type="macd",
    ),
    IndicatorSpec(
        name="BB",
        label="볼린저밴드",
        description="SMA ± 표준편차 × 배수",
        params=(
            ParamSpec("period", "기간", 20, 2, 500),
            ParamSpec("std", "표준편차 배수", 2.0, 0.1, 10, step=0.1, integer=False),
        ),
        outputs=_BAND_OUTPUTS,
        display="overlay",
        templates=frozenset({T_VALUE, T_BAND}),
        compute=_bollinger,
        band_type="bollinger",
        legacy_type="bb",
    ),
    IndicatorSpec(
        name="KELTNER",
        label="켈트너채널",
        description="EMA ± ATR × 배수",
        params=(
            ParamSpec("period", "기간", 20, 2, 500),
            ParamSpec("multiplier", "ATR 배수", 2.0, 0.1, 10, step=0.1, integer=False),
        ),
        outputs=_BAND_OUTPUTS,
        display="overlay",
        templates=frozenset({T_BAND}),
        compute=_keltner,
        inputs=frozenset({"high", "low", "close"}),
        band_type="keltner",
        legacy_type="bb",
    ),
    IndicatorSpec(
        name="ENVELOPE",
        label="엔벨로프",
        description="SMA ± 퍼센트",
        params=(
            ParamSpec("period", "기간", 20, 1, 500),
            ParamSpec("percent", "폭 (%)", 10.0, 0.1, 50, step=0.1, integer=False),
        ),
        outputs=_BAND_OUTPUTS,
        display="overlay",
        templates=frozenset({T_BAND}),
        compute=_envelope,
        band_type="envelope",
        legacy_type="bb",
    ),
    IndicatorSpec(
        name="WMA",
        label="가중이동평균",
        description="최근 봉에 큰 가중치를 주는 이동평균",
        params=(ParamSpec("period", "기간", 20, 1, 500),),
        outputs=(OutputSpec("value", "WMA"),),
        display="overlay",
        templates=frozenset({T_VALUE, T_CROSS, T_PRICE_CROSS}),
        compute=_wma,
        legacy_type="sma",  # 옛 프론트 폴백: 오버레이 한 줄 선
    ),
    IndicatorSpec(
        name="VWAP",
        label="거래량가중평균가",
        description="최근 N 봉의 거래량 가중 평균가 (롤링)",
        params=(ParamSpec("period", "기간", 20, 1, 500),),
        outputs=(OutputSpec("value", "VWAP"),),
        display="overlay",
        templates=frozenset({T_VALUE, T_CROSS, T_PRICE_CROSS}),
        compute=_vwap,
        inputs=frozenset({"high", "low", "close", "volume"}),
        legacy_type="sma",
    ),
    IndicatorSpec(
        name="ATR",
        label="ATR (평균 실제 범위)",
        description="변동성. 최근 N 봉 True Range 의 RMA",
        params=(ParamSpec("period", "기간", 14, 1, 200),),
        outputs=(OutputSpec("value", "ATR"),),
        display="pane",
        templates=frozenset({T_VALUE}),
        compute=_atr,
        inputs=frozenset({"high", "low", "close"}),
        legacy_type="rsi",  # 옛 프론트 폴백: 패널 한 줄 선
    ),
    IndicatorSpec(
        name="STOCH",
        label="스토캐스틱",
        description="%K 와 %D. 0~100",
        params=(
            ParamSpec("period", "기간", 14, 1, 200),
            ParamSpec("smooth_k", "%K 스무딩", 3, 1, 50),
            ParamSpec("smooth_d", "%D 스무딩", 3, 1, 50),
        ),
        outputs=(OutputSpec("k", "%K", "k"), OutputSpec("d", "%D", "d")),
        display="pane",
        value_range=(0, 100),
        templates=frozenset({T_VALUE, T_STOCH}),
        compute=_stoch,
        inputs=frozenset({"high", "low", "close"}),
        legacy_type="stoch",
    ),
)

REGISTRY: dict[str, IndicatorSpec] = {s.name: s for s in _SPECS}

# 옛 이름 호환 ("MA" 는 SMA 로)
_ALIASES = {"MA": "SMA"}

# band_touch 의 bandType -> 스펙
_BY_BAND_TYPE: dict[str, IndicatorSpec] = {s.band_type: s for s in _SPECS if s.band_type}


def get_spec(name: str | None) -> IndicatorSpec:
    """이름으로 스펙을 찾는다. 모르는 이름은 에러 (조용히 종가로 바꾸지 않는다)"""
    if not name:
        raise ValueError("지표 이름이 없습니다")
    key = _ALIASES.get(name.upper(), name.upper())
    spec = REGISTRY.get(key)
    if spec is None:
        raise ValueError(f"지원하지 않는 지표: {name} (가능: {', '.join(REGISTRY)})")
    return spec


def get_band_spec(band_type: str | None) -> IndicatorSpec:
    spec = _BY_BAND_TYPE.get(band_type or "bollinger")
    if spec is None:
        raise ValueError(f"지원하지 않는 밴드 종류: {band_type} (가능: {', '.join(_BY_BAND_TYPE)})")
    return spec


def compute(
    df: pd.DataFrame, spec: IndicatorSpec, params: dict[str, float]
) -> dict[str, pd.Series]:
    missing = spec.inputs - set(df.columns)
    if missing:
        raise ValueError(f"{spec.name} 계산에 필요한 컬럼이 없습니다: {sorted(missing)}")
    return spec.compute(df, params)


def band_types() -> list[str]:
    """band_touch 에서 고를 수 있는 bandType 목록"""
    return [s.band_type for s in _SPECS if s.band_type]


def names_for_template(template: str) -> list[str]:
    return [s.name for s in _SPECS if template in s.templates]


def public_list() -> list[dict[str, Any]]:
    return [s.to_public() for s in _SPECS]
