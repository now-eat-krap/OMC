"""buy_and_hold_return 기준선 테스트"""

import numpy as np

from app.services.backtest.engine import buy_and_hold_return


def test_price_doubles_without_costs():
    opens = np.array([100.0, 150.0, 200.0])
    closes = np.array([120.0, 180.0, 200.0])
    pct, usdt = buy_and_hold_return(opens, closes, 1000.0, 0.0, 0.0, 10**8)
    assert abs(pct - 100.0) < 1e-9
    assert abs(usdt - 1000.0) < 1e-9


def test_fees_and_slippage_reduce_return():
    opens = np.array([100.0, 100.0])
    closes = np.array([100.0, 100.0])
    # 가격이 그대로면 수수료+슬리피지만큼 손해
    pct, _ = buy_and_hold_return(opens, closes, 1000.0, 0.001, 0.0005, 10**8)
    assert pct < 0
    assert abs(pct - (-0.15)) < 0.01  # 0.1% + 0.05% 근사


def test_quantity_floored_to_precision():
    # 1000 / 333 = 3.003... → 정밀도 1 (prec_mult=1) 이면 3개만 산다. 남은 현금은 그대로
    opens = np.array([333.0])
    closes = np.array([666.0])
    pct, usdt = buy_and_hold_return(opens, closes, 1000.0, 0.0, 0.0, 1)
    assert abs(usdt - (3 * 666.0 + (1000.0 - 3 * 333.0) - 1000.0)) < 1e-9
    assert abs(pct - usdt / 10) < 1e-9


def test_empty_or_zero_capital():
    assert buy_and_hold_return(np.array([]), np.array([]), 1000.0, 0, 0, 1) == (0.0, 0.0)
    assert buy_and_hold_return(np.array([1.0]), np.array([2.0]), 0.0, 0, 0, 1) == (0.0, 0.0)
