"""청산 조건(익절/손절 포함) 평가 테스트

profit_loss 는 진입가를 알아야 해서 StrategyParser 가 아니라 order_func_nb 쪽의
_should_exit_nb 가 봉마다 평가한다. 그 결합 규칙과 compile_exit_conditions 의
변환을 검증한다.
"""

import numpy as np
import pandas as pd

from app.schemas import SentenceCondition
from app.services.backtest.engine import _should_exit_nb
from app.services.backtest.strategy import (
    EXIT_KIND_LOSS,
    EXIT_KIND_PROFIT,
    EXIT_KIND_SIGNAL,
    EXIT_OP_AND,
    EXIT_OP_OR,
    StrategyParser,
)


def _set(kinds, values, ops, signals=None, n_bars=3):
    kinds = np.array(kinds, dtype=np.int64)
    values = np.array(values, dtype=np.float64)
    ops = np.array(ops, dtype=np.int64)
    if signals is None:
        signals = np.zeros((n_bars, len(kinds)), dtype=np.bool_)
    return signals, kinds, values, ops


def _exit(entry, prev_close, kinds, values, ops, signals=None, idx=1):
    sig, k, v, o = _set(kinds, values, ops, signals)
    return bool(_should_exit_nb(idx, entry, prev_close, sig, k, v, o))


class TestShouldExit:
    def test_profit_threshold(self):
        # 진입 100, 전 봉 종가 105 → +5% 익절 충족, +5.1% 는 미충족
        assert _exit(100.0, 105.0, [EXIT_KIND_PROFIT], [5.0], [])
        assert not _exit(100.0, 104.9, [EXIT_KIND_PROFIT], [5.0], [])

    def test_loss_threshold(self):
        # 진입 100, 전 봉 종가 95 → -5% 손절 충족. 수익 중이면 미충족
        assert _exit(100.0, 95.0, [EXIT_KIND_LOSS], [5.0], [])
        assert not _exit(100.0, 110.0, [EXIT_KIND_LOSS], [5.0], [])

    def test_no_entry_price_never_exits(self):
        # 진입가/전 봉 종가를 모르면(0) 익절·손절은 판단하지 않는다
        assert not _exit(0.0, 105.0, [EXIT_KIND_PROFIT], [5.0], [])
        assert not _exit(100.0, 0.0, [EXIT_KIND_PROFIT], [5.0], [])

    def test_signal_column_used_as_is(self):
        signals = np.array([[False], [True], [False]])
        assert _exit(100.0, 100.0, [EXIT_KIND_SIGNAL], [0.0], [], signals, idx=1)
        assert not _exit(100.0, 100.0, [EXIT_KIND_SIGNAL], [0.0], [], signals, idx=2)

    def test_and_or_left_to_right(self):
        # 시그널 False AND 익절 True → False / OR 이면 True
        kinds = [EXIT_KIND_SIGNAL, EXIT_KIND_PROFIT]
        assert not _exit(100.0, 110.0, kinds, [0.0, 5.0], [EXIT_OP_AND])
        assert _exit(100.0, 110.0, kinds, [0.0, 5.0], [EXIT_OP_OR])
        # 세 개: (False OR True) AND False → False. 우선순위 없이 왼쪽부터
        kinds3 = [EXIT_KIND_SIGNAL, EXIT_KIND_PROFIT, EXIT_KIND_LOSS]
        assert not _exit(100.0, 110.0, kinds3, [0.0, 5.0, 5.0], [EXIT_OP_OR, EXIT_OP_AND])
        # (False OR True) OR False → True
        assert _exit(100.0, 110.0, kinds3, [0.0, 5.0, 5.0], [EXIT_OP_OR, EXIT_OP_OR])


class TestCompileExitConditions:
    def _df(self, n=5):
        idx = pd.date_range("2024-01-01", periods=n, freq="D")
        return pd.DataFrame(
            {"open": 100.0, "high": 101.0, "low": 99.0, "close": 100.0, "volume": 1.0}, index=idx
        )

    def test_profit_loss_becomes_kind_and_value(self):
        conds = [
            SentenceCondition(
                id="a", templateType="profit_loss", profitDirection="profit", value=7
            ),
            SentenceCondition(id="b", templateType="profit_loss", profitDirection="loss", value=-3),
        ]
        conds[0].nextOperator = "OR"
        s = StrategyParser().compile_exit_conditions(self._df(), conds)
        assert list(s.kinds) == [EXIT_KIND_PROFIT, EXIT_KIND_LOSS]
        # 손절 임계값은 부호를 버리고 양수로 둔다 (방향은 profitDirection 이 정한다)
        assert list(s.values) == [7.0, 3.0]
        assert list(s.ops) == [EXIT_OP_OR]
        assert s.has_positional
        assert s.signals.shape == (5, 2)

    def test_empty_conditions_never_exit(self):
        s = StrategyParser().compile_exit_conditions(self._df(), [])
        assert not s.has_positional
        assert s.kinds.shape == (1,) and s.kinds[0] == EXIT_KIND_SIGNAL
        assert not s.signals.any()

    def test_shift_moves_signals_forward_one_bar(self):
        cond = SentenceCondition(
            id="a",
            templateType="indicator_vs_value",
            indicator="RSI",
            indicatorPeriod=2,
            comparison="gt",
            value=-1,  # RSI 는 항상 >= 0 이므로 유효 구간에서 항상 True
        )
        s = StrategyParser().compile_exit_conditions(self._df(10), [cond]).shifted(1)
        # 첫 봉은 전 봉이 없으니 False, 마지막 True 는 한 칸 뒤로 밀려 있다
        assert not s.signals[0, 0]
        assert s.signals[-1, 0]
