"""커스텀 식 파서·평가기 테스트 - 값 일치, 문법 거부, 조건 통합, warmup"""

import numpy as np
import pandas as pd
import pytest

from app.schemas import SentenceCondition
from app.services import expression as ex
from app.services import indicators
from app.services.backtest.strategy import StrategyParser


def _df(n=120, seed=3):
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


class TestEvaluate:
    def test_matches_direct_functions(self):
        df = _df()
        assert ex.evaluate(df, "ta.rsi(close, 14)").equals(indicators.rsi(df["close"], 14))
        assert ex.evaluate(df, "ta.atr(14)").equals(
            indicators.atr(df["high"], df["low"], df["close"], 14)
        )
        # 켈트너 상단을 식으로
        expr = ex.evaluate(df, "ta.ema(close, 20) + 2 * ta.atr(20)")
        upper, _, _ = indicators.keltner_channel(df["high"], df["low"], df["close"], 20, 2.0)
        pd.testing.assert_series_equal(expr, upper)

    def test_arithmetic_history_and_derived_series(self):
        df = _df()
        # z-score
        z = ex.evaluate(df, "(close - ta.sma(close, 20)) / ta.stdev(close, 20)")
        manual = (df["close"] - indicators.sma(df["close"], 20)) / indicators.stdev(df["close"], 20)
        pd.testing.assert_series_equal(z, manual)
        # 과거 참조
        assert ex.evaluate(df, "close[1]").equals(df["close"].shift(1))
        assert ex.evaluate(df, "ta.sma(close, 5)[2]").equals(
            indicators.sma(df["close"], 5).shift(2)
        )
        # 파생 시리즈
        assert ex.evaluate(df, "hlc3").equals((df["high"] + df["low"] + df["close"]) / 3)

    def test_boolean_logic(self):
        df = _df()
        sig = ex.evaluate_signal(df, "ta.rsi(close,14) < 30 or ta.rsi(close,14) > 70")
        r = indicators.rsi(df["close"], 14)
        assert sig.equals(((r < 30) | (r > 70)).fillna(False))
        cross = ex.evaluate_signal(df, "ta.crossover(ta.wma(close,10), ta.sma(close,30))")
        assert cross.dtype == bool
        # not
        assert ex.evaluate_signal(df, "not (close > close[1])").equals(
            (~(df["close"] > df["close"].shift(1)).fillna(False)).fillna(False)
        )

    def test_numeric_expression_rejected_as_signal(self):
        with pytest.raises(ex.ExpressionError, match="참/거짓"):
            ex.evaluate_signal(_df(), "ta.sma(close, 20)")


class TestRejects:
    @pytest.mark.parametrize(
        "expr,msg",
        [
            ("__import__('os')", "함수는 ta"),
            ("close.mean()", "함수는 ta"),
            ("ta.sma(close, 20).mean()", "함수는 ta"),
            ("lambda x: x", "지원하지 않는 문법"),
            ("[x for x in close]", "지원하지 않는 문법"),
            ("foo", "모르는 이름"),
            ("ta.supertrend(close, 10)", "모르는 함수"),
            ("math.exp(close)", "모르는 함수"),
            ("ta.sma(close, volume)", "정수 리터럴"),
            ("ta.sma(close, 99999)", "1~1000"),
            ("close[volume]", "정수만"),
            ("close and volume", "참/거짓 식"),
            ("1 < close < 100", "하나씩"),
            ("ta.sma(close, length=20)", "키워드 인자"),
            ("", "비어"),
        ],
    )
    def test_rejected(self, expr, msg):
        with pytest.raises(ex.ExpressionError, match=msg):
            ex.evaluate(_df(30), expr)

    def test_too_long_and_too_complex(self):
        with pytest.raises(ex.ExpressionError, match="깁니다"):
            ex.evaluate(_df(30), "close + " * 100 + "close")
        long_but_ok = "+".join(["close"] * 60)
        with pytest.raises(ex.ExpressionError, match="복잡"):
            ex.evaluate(_df(30), long_but_ok[:499])


class TestConditionIntegration:
    def test_expression_template_in_strategy(self):
        df = _df()
        cond = SentenceCondition(
            id="a",
            templateType="expression",
            expression="ta.rsi(close, 14) < 30 and close > ta.sma(close, 50)",
        )
        sig = StrategyParser().generate_signal(df, [cond])
        r = indicators.rsi(df["close"], 14)
        s = indicators.sma(df["close"], 50)
        assert sig.equals(((r < 30) & (df["close"] > s)).fillna(False))

    def test_missing_expression_raises(self):
        with pytest.raises(ValueError, match="식이 필요"):
            StrategyParser().generate_signal(
                _df(30), [SentenceCondition(id="a", templateType="expression")]
            )


class TestValidateAndWarmup:
    def test_validate_ok(self):
        r = ex.validate("ta.rsi(close, 14) < 30")
        assert r == {"ok": True, "kind": "boolean", "warmup": 14}
        r = ex.validate("ta.ema(close, 20) + 2 * ta.atr(14)")
        assert r["ok"] and r["kind"] == "numeric" and r["warmup"] == 20

    def test_validate_error(self):
        r = ex.validate("ta.sma(close)")
        assert r["ok"] is False and "인자 수" in r["error"]

    def test_warmup_nested_adds_sibling_max(self):
        # 중첩은 합산: sma(rsi(close,14), 9) → 23
        assert ex.estimate_warmup("ta.sma(ta.rsi(close, 14), 9)") == 23
        # 형제는 최대
        assert ex.estimate_warmup("ta.sma(close, 20) > ta.ema(close, 50)") == 50
        # 과거 참조 가산
        assert ex.estimate_warmup("ta.sma(close, 10)[5]") == 15
