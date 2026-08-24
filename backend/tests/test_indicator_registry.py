"""지표 레지스트리 테스트 - 스펙 정합성, 파라미터 해석, 옛 필드 호환, 계산 일치"""

import numpy as np
import pandas as pd
import pytest

from app.schemas import SentenceCondition
from app.services import indicator_registry as registry
from app.services import indicators
from app.services.backtest.analyzer import ResultAnalyzer
from app.services.backtest.strategy import StrategyParser


def _df(n=80, seed=1):
    rng = np.random.default_rng(seed)
    close = 100 + np.cumsum(rng.normal(0, 1, n))
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    return pd.DataFrame(
        {
            "timestamp": (idx.astype("int64") // 10**6),
            "open": close,
            "high": close + 1,
            "low": close - 1,
            "close": close,
            "volume": 1.0,
        },
        index=idx,
    )


class TestSpecs:
    def test_every_spec_is_consistent(self):
        for spec in registry.REGISTRY.values():
            assert spec.outputs, spec.name
            assert spec.params, spec.name
            # 대표 선은 outputs[0]
            out = registry.compute(_df(), spec, spec.default_params())
            assert set(out) == {o.key for o in spec.outputs}, spec.name
            assert spec.primary_key in out
            # API 직렬화
            pub = spec.to_public()
            assert pub["name"] == spec.name and pub["params"][0]["name"] == spec.params[0].name

    def test_unknown_name_raises(self):
        with pytest.raises(ValueError, match="지원하지 않는 지표"):
            registry.get_spec("FOOBAR")

    def test_alias_ma_is_sma(self):
        assert registry.get_spec("MA").name == "SMA"
        assert registry.get_spec("sma").name == "SMA"

    def test_band_types(self):
        assert registry.band_types() == ["bollinger", "keltner", "envelope"]
        assert registry.get_band_spec("keltner").name == "KELTNER"
        with pytest.raises(ValueError):
            registry.get_band_spec("donchian")


class TestResolveParams:
    def test_defaults_when_missing(self):
        spec = registry.get_spec("MACD")
        assert spec.resolve_params(None) == {"fast": 12, "slow": 26, "signal": 9}

    def test_legacy_period_fills_first_param(self):
        assert registry.get_spec("RSI").resolve_params(None, 13) == {"period": 13}
        # 밴드의 첫 파라미터도 기간
        assert registry.get_spec("BB").resolve_params(None, 30) == {"period": 30, "std": 2.0}

    def test_params_win_over_legacy(self):
        assert registry.get_spec("RSI").resolve_params({"period": 9}, 14) == {"period": 9}

    def test_clamped_and_typed(self):
        spec = registry.get_spec("BB")
        p = spec.resolve_params({"period": 9999, "std": "2.5"})
        assert p["period"] == 500 and isinstance(p["period"], int)
        assert p["std"] == 2.5 and isinstance(p["std"], float)

    def test_partial_params_keep_defaults(self):
        assert registry.get_spec("MACD").resolve_params({"fast": 8}) == {
            "fast": 8,
            "slow": 26,
            "signal": 9,
        }


class TestComputeMatchesDirectFunctions:
    def test_rsi_sma_ema(self):
        df = _df()
        assert registry.compute(df, registry.get_spec("RSI"), {"period": 14})["value"].equals(
            indicators.rsi(df["close"], 14)
        )
        assert registry.compute(df, registry.get_spec("EMA"), {"period": 20})["value"].equals(
            indicators.ema(df["close"], 20)
        )

    def test_macd_and_bands(self):
        df = _df()
        out = registry.compute(df, registry.get_spec("MACD"), {"fast": 12, "slow": 26, "signal": 9})
        m, s, h = indicators.macd(df["close"])
        assert out["macd"].equals(m) and out["signal"].equals(s) and out["histogram"].equals(h)
        out = registry.compute(df, registry.get_spec("BB"), {"period": 20, "std": 2.0})
        u, mid, lo = indicators.bollinger_bands(df["close"], 20, 2.0)
        assert out["upper"].equals(u) and out["middle"].equals(mid) and out["lower"].equals(lo)


class TestStrategyUsesParams:
    def test_rsi_period_from_params_vs_legacy_identical(self):
        df = _df()
        p = StrategyParser()
        a = p.generate_signal(
            df,
            [
                SentenceCondition(
                    id="a",
                    templateType="indicator_vs_value",
                    indicator="RSI",
                    indicatorPeriod=9,
                    comparison="lt",
                    value=40,
                )
            ],
        )
        b = p.generate_signal(
            df,
            [
                SentenceCondition(
                    id="b",
                    templateType="indicator_vs_value",
                    indicator="RSI",
                    params={"period": 9},
                    comparison="lt",
                    value=40,
                )
            ],
        )
        assert a.equals(b)

    def test_macd_params_change_signal(self):
        df = _df(200)
        p = StrategyParser()
        default = p.generate_signal(
            df, [SentenceCondition(id="a", templateType="macd_signal", crossDirection="above")]
        )
        fast = p.generate_signal(
            df,
            [
                SentenceCondition(
                    id="b",
                    templateType="macd_signal",
                    crossDirection="above",
                    params={"fast": 5, "slow": 10, "signal": 3},
                )
            ],
        )
        assert not default.equals(fast)

    def test_bollinger_std_changes_signal(self):
        df = _df(200)
        p = StrategyParser()
        c = dict(
            templateType="band_touch",
            bandType="bollinger",
            bandPosition="upper",
            touchType="exit",
            priceType="close",
        )
        s2 = p.generate_signal(
            df, [SentenceCondition(id="a", params={"period": 20, "std": 2.0}, **c)]
        )
        s1 = p.generate_signal(
            df, [SentenceCondition(id="b", params={"period": 20, "std": 1.0}, **c)]
        )
        assert s1.sum() > s2.sum()  # 좁은 밴드가 더 자주 이탈


class TestAnalyzerExtract:
    def test_extracts_with_metadata_and_legacy_fields(self):
        df = _df(120)
        conds = [
            SentenceCondition(
                id="a",
                templateType="indicator_vs_value",
                indicator="RSI",
                indicatorPeriod=14,
                comparison="lt",
                value=30,
            ),
            SentenceCondition(
                id="b",
                templateType="indicator_vs_value",
                indicator="RSI",
                indicatorPeriod=14,
                comparison="gt",
                value=70,
            ),
            SentenceCondition(
                id="c",
                templateType="macd_signal",
                crossDirection="above",
                params={"fast": 8, "slow": 21, "signal": 5},
            ),
            SentenceCondition(
                id="d",
                templateType="band_touch",
                bandType="keltner",
                bandPosition="lower",
                touchType="touch",
                indicatorPeriod=20,
            ),
        ]
        out = {i.name: i for i in ResultAnalyzer().extract_indicators(df, conds)}
        assert set(out) == {"RSI(14)", "MACD(8,21,5)", "Keltner(20)"}
        rsi = out["RSI(14)"]
        assert rsi.type == "rsi" and rsi.display == "pane" and rsi.valueRange == [0, 100]
        assert rsi.rsiOverbought == 70 and rsi.rsiOversold == 30 and rsi.levels == [30.0, 70.0]
        macd = out["MACD(8,21,5)"]
        assert (
            macd.signalLine
            and macd.histogram
            and macd.params == {"fast": 8, "slow": 21, "signal": 5}
        )
        kel = out["Keltner(20)"]
        assert kel.type == "bb" and kel.upperBand and kel.lowerBand and kel.indicator == "KELTNER"
