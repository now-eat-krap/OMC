"""밴드형 지표와 band_touch 조건 테스트

UI 가 노출하는 bandType(볼린저/켈트너/엔벨로프)과 touchType(터치/돌파/이탈)이
실제로 다르게 계산되는지, 모르는 지표 이름이 조용히 종가로 바뀌지 않는지 확인한다.
"""

import numpy as np
import pandas as pd
import pytest

from app.schemas import SentenceCondition
from app.services import indicators
from app.services.backtest.strategy import StrategyParser


def _df(n=60, seed=0):
    rng = np.random.default_rng(seed)
    close = 100 + np.cumsum(rng.normal(0, 1, n))
    high = close + rng.uniform(0.2, 1.5, n)
    low = close - rng.uniform(0.2, 1.5, n)
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    return pd.DataFrame(
        {"open": close, "high": high, "low": low, "close": close, "volume": 1.0}, index=idx
    )


class TestBandIndicators:
    def test_three_band_types_differ(self):
        df = _df()
        b = indicators.bands(df, "bollinger", 20)
        k = indicators.bands(df, "keltner", 20)
        e = indicators.bands(df, "envelope", 20)
        # 상단 밴드 마지막 값이 셋 다 다르다 (같으면 같은 계산을 돌려준 것)
        tops = {round(float(x[0].iloc[-1]), 6) for x in (b, k, e)}
        assert len(tops) == 3
        # 상단 > 중간 > 하단
        for upper, middle, lower in (b, k, e):
            assert upper.iloc[-1] > middle.iloc[-1] > lower.iloc[-1]

    def test_envelope_is_symmetric_percent(self):
        df = _df()
        upper, middle, lower = indicators.envelope(df["close"], 20, 10.0)
        assert np.isclose(upper.iloc[-1], middle.iloc[-1] * 1.10)
        assert np.isclose(lower.iloc[-1], middle.iloc[-1] * 0.90)

    def test_keltner_uses_atr_width(self):
        df = _df()
        upper, middle, lower = indicators.keltner_channel(
            df["high"], df["low"], df["close"], 20, 2.0
        )
        width = indicators.atr(df["high"], df["low"], df["close"], 20).iloc[-1] * 2.0
        assert np.isclose(upper.iloc[-1] - middle.iloc[-1], width)
        assert np.isclose(middle.iloc[-1] - lower.iloc[-1], width)

    def test_atr_first_values_nan_then_positive(self):
        df = _df()
        a = indicators.atr(df["high"], df["low"], df["close"], 14)
        assert a.iloc[:13].isna().all()
        assert (a.iloc[13:] > 0).all()

    def test_unknown_band_type_raises(self):
        with pytest.raises(ValueError, match="밴드 종류"):
            indicators.bands(_df(), "donchian", 20)


class TestBandTouchCondition:
    def _cond(self, **kw):
        base = dict(
            id="c",
            templateType="band_touch",
            bandType="bollinger",
            bandPosition="upper",
            touchType="touch",
            indicatorPeriod=20,
            priceType="close",
        )
        base.update(kw)
        return SentenceCondition(**base)

    def test_band_type_changes_signal(self):
        df = _df()
        p = StrategyParser()
        sigs = {
            bt: p.generate_signal(df, [self._cond(bandType=bt, touchType="exit")])
            for bt in ("bollinger", "keltner", "envelope")
        }
        # 세 종류가 모두 같은 신호면 bandType 이 무시된 것
        assert not (
            sigs["bollinger"].equals(sigs["keltner"]) and sigs["bollinger"].equals(sigs["envelope"])
        )

    def test_exit_means_outside_band(self):
        df = _df()
        p = StrategyParser()
        upper, _, lower = indicators.bands(df, "bollinger", 20)
        close = df["close"]
        sig_up = p.generate_signal(df, [self._cond(bandPosition="upper", touchType="exit")])
        sig_lo = p.generate_signal(df, [self._cond(bandPosition="lower", touchType="exit")])
        assert sig_up.equals(close > upper)
        assert sig_lo.equals(close < lower)
        # 이탈은 터치와 다르다
        sig_touch = p.generate_signal(df, [self._cond(bandPosition="upper", touchType="touch")])
        assert not sig_up.equals(sig_touch)


class TestUnknownIndicator:
    def test_unknown_indicator_raises_instead_of_close(self):
        df = _df()
        cond = SentenceCondition(
            id="c",
            templateType="indicator_vs_value",
            indicator="FOOBAR",
            indicatorPeriod=20,
            comparison="gt",
            value=50,
        )
        with pytest.raises(ValueError, match="지원하지 않는 지표"):
            StrategyParser().generate_signal(df, [cond])
