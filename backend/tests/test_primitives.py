"""원시 함수(WMA/VWAP/ATR/stdev/highest/lowest/change/crossover)와 레지스트리 등록 테스트"""

import numpy as np
import pandas as pd
import pytest

from app.schemas import SentenceCondition
from app.services import indicator_registry as registry
from app.services import indicators
from app.services.backtest.strategy import StrategyParser


def _df(n=60, seed=2):
    rng = np.random.default_rng(seed)
    close = 100 + np.cumsum(rng.normal(0, 1, n))
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    return pd.DataFrame(
        {
            "open": close,
            "high": close + rng.uniform(0.2, 1.5, n),
            "low": close - rng.uniform(0.2, 1.5, n),
            "close": close,
            "volume": rng.uniform(1, 10, n),
        },
        index=idx,
    )


class TestFunctions:
    def test_wma_weights_recent_more(self):
        # 상승 시계열에서는 WMA > SMA (최근 봉 가중치가 크므로)
        close = pd.Series(np.arange(1.0, 61.0))
        w = indicators.wma(close, 10)
        s = indicators.sma(close, 10)
        assert w.iloc[9:].gt(s.iloc[9:]).all()
        # 손계산: [1..5] 의 WMA(5) = (1*1+2*2+3*3+4*4+5*5)/15
        assert np.isclose(indicators.wma(pd.Series([1.0, 2, 3, 4, 5]), 5).iloc[-1], 55 / 15)
        assert indicators.wma(close, 10).iloc[:9].isna().all()

    def test_vwap_between_low_and_high(self):
        df = _df()
        v = indicators.vwap(df["high"], df["low"], df["close"], df["volume"], 20)
        valid = v.iloc[19:]
        assert (valid >= indicators.lowest(df["low"], 20).iloc[19:]).all()
        assert (valid <= indicators.highest(df["high"], 20).iloc[19:]).all()

    def test_vwap_weights_by_volume(self):
        # 거래량이 한 봉에 몰리면 VWAP 은 그 봉의 typical price
        high = pd.Series([10.0, 20.0])
        low = pd.Series([10.0, 20.0])
        close = pd.Series([10.0, 20.0])
        vol = pd.Series([0.0, 5.0])
        v = indicators.vwap(high, low, close, vol, 2)
        assert np.isclose(v.iloc[-1], 20.0)

    def test_stdev_population(self):
        close = pd.Series([1.0, 2.0, 3.0, 4.0])
        # 모집단 표준편차 (TV ta.stdev): [1..4] 의 ddof=0
        assert np.isclose(indicators.stdev(close, 4).iloc[-1], np.std([1, 2, 3, 4]))

    def test_highest_lowest_change(self):
        s = pd.Series([3.0, 1.0, 4.0, 1.0, 5.0])
        assert indicators.highest(s, 3).iloc[-1] == 5.0
        assert indicators.lowest(s, 3).iloc[-1] == 1.0
        assert indicators.change(s).iloc[-1] == 4.0
        assert indicators.change(s, 2).iloc[-1] == 1.0

    def test_crossover_crossunder(self):
        a = pd.Series([1.0, 1.0, 3.0, 3.0, 1.0])
        b = pd.Series([2.0, 2.0, 2.0, 2.0, 2.0])
        up = indicators.crossover(a, b)
        dn = indicators.crossunder(a, b)
        assert up.tolist() == [False, False, True, False, False]
        assert dn.tolist() == [False, False, False, False, True]


class TestRegistryEntries:
    def test_new_specs_registered(self):
        for name, display, template in (
            ("ATR", "pane", "indicator_vs_value"),
            ("WMA", "overlay", "indicator_cross"),
            ("VWAP", "overlay", "price_cross"),
        ):
            spec = registry.get_spec(name)
            assert spec.display == display
            assert template in spec.templates
            out = registry.compute(_df(), spec, spec.default_params())
            assert spec.primary_key in out

    def test_strategy_can_use_new_indicators(self):
        df = _df(120)
        p = StrategyParser()
        # ATR 값 비교
        sig = p.generate_signal(
            df,
            [
                SentenceCondition(
                    id="a",
                    templateType="indicator_vs_value",
                    indicator="ATR",
                    params={"period": 14},
                    comparison="gt",
                    value=0,
                )
            ],
        )
        assert sig.iloc[20:].all()  # ATR > 0 은 워밍업 후 항상 참
        # WMA 가 SMA 를 교차
        sig2 = p.generate_signal(
            df,
            [
                SentenceCondition(
                    id="b",
                    templateType="indicator_cross",
                    indicator="WMA",
                    params={"period": 5},
                    targetIndicator="SMA",
                    targetParams={"period": 20},
                    crossDirection="above",
                )
            ],
        )
        assert sig2.dtype == bool
        # 종가가 VWAP 돌파
        sig3 = p.generate_signal(
            df,
            [
                SentenceCondition(
                    id="c",
                    templateType="price_cross",
                    priceType="close",
                    targetIndicator="VWAP",
                    targetParams={"period": 20},
                    crossDirection="above",
                )
            ],
        )
        assert sig3.any()

    def test_vwap_requires_volume_column(self):
        df = _df().drop(columns=["volume"])
        with pytest.raises(ValueError, match="필요한 컬럼"):
            registry.compute(df, registry.get_spec("VWAP"), {"period": 20})
