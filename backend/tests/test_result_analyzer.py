# ============================================================================
# ResultAnalyzer 테스트
# ============================================================================
# 백테스트 결과 분석 클래스의 단위 테스트

import numpy as np
import pandas as pd

from app.services.backtest.analyzer import ResultAnalyzer


def create_ohlcv_df(periods=10):
    """테스트용 OHLCV DataFrame 생성"""
    dates = pd.date_range(start="2024-01-01", periods=periods, freq="D")
    np.random.seed(42)

    close = 40000 + np.cumsum(np.random.randn(periods) * 100)
    df = pd.DataFrame(
        {
            "timestamp": [int(d.timestamp() * 1000) for d in dates],
            "open": close - 50,
            "high": close + 100,
            "low": close - 100,
            "close": close,
            "volume": np.random.rand(periods) * 1000000,
        }
    )
    df["datetime"] = dates
    df.set_index("datetime", inplace=True)
    return df


def create_trades_df():
    """테스트용 거래 DataFrame 생성 (VectorBT trades.records_readable 형식)"""
    return pd.DataFrame(
        [
            {
                "Entry Timestamp": pd.Timestamp("2024-01-02"),
                "Exit Timestamp": pd.Timestamp("2024-01-05"),
                "Avg Entry Price": 40000.0,
                "Avg Exit Price": 41000.0,
                "Size": 0.1,
                "PnL": 100.0,
                "Return": 0.025,
                "Entry Fees": 4.0,
                "Exit Fees": 4.1,
            },
            {
                "Entry Timestamp": pd.Timestamp("2024-01-06"),
                "Exit Timestamp": pd.Timestamp("2024-01-08"),
                "Avg Entry Price": 41000.0,
                "Avg Exit Price": 40500.0,
                "Size": 0.1,
                "PnL": -50.0,
                "Return": -0.0122,
                "Entry Fees": 4.1,
                "Exit Fees": 4.05,
            },
        ]
    )


class TestResultAnalyzer:
    """ResultAnalyzer 단위 테스트"""

    # =========================================================================
    # build_ohlcv 테스트
    # =========================================================================

    def test_build_ohlcv_returns_list(self):
        """build_ohlcv가 OHLCVData 리스트를 반환하는지 확인"""
        analyzer = ResultAnalyzer()
        df = create_ohlcv_df(5)

        result = analyzer.build_ohlcv(df)

        assert isinstance(result, list)
        assert len(result) == 5

    def test_build_ohlcv_contains_correct_fields(self):
        """build_ohlcv 결과가 올바른 필드를 포함하는지 확인"""
        analyzer = ResultAnalyzer()
        df = create_ohlcv_df(3)

        result = analyzer.build_ohlcv(df)
        first = result[0]

        assert hasattr(first, "timestamp")
        assert hasattr(first, "open")
        assert hasattr(first, "high")
        assert hasattr(first, "low")
        assert hasattr(first, "close")
        assert hasattr(first, "volume")

    def test_build_ohlcv_values_are_numeric(self):
        """build_ohlcv 값들이 숫자인지 확인"""
        analyzer = ResultAnalyzer()
        df = create_ohlcv_df(3)

        result = analyzer.build_ohlcv(df)
        first = result[0]

        assert isinstance(first.timestamp, int)
        assert isinstance(first.open, float)
        assert isinstance(first.close, float)

    # =========================================================================
    # build_trades 테스트
    # =========================================================================

    def test_build_trades_returns_list(self):
        """build_trades가 TradeRecord 리스트를 반환하는지 확인"""
        analyzer = ResultAnalyzer()
        trades_df = create_trades_df()

        result = analyzer.build_trades(trades_df, slippage_rate=0.05)

        assert isinstance(result, list)
        assert len(result) == 2

    def test_build_trades_empty_df_returns_empty_list(self):
        """빈 DataFrame이면 빈 리스트 반환"""
        analyzer = ResultAnalyzer()
        empty_df = pd.DataFrame()

        result = analyzer.build_trades(empty_df, slippage_rate=0.05)

        assert result == []

    def test_build_trades_calculates_cumulative_pnl(self):
        """누적 손익이 올바르게 계산되는지 확인"""
        analyzer = ResultAnalyzer()
        trades_df = create_trades_df()

        result = analyzer.build_trades(trades_df, slippage_rate=0.05)

        # 첫 거래: +100, 두 번째 거래: -50
        assert result[0].cumulativePnl == 100.0
        assert result[1].cumulativePnl == 50.0  # 100 - 50

    def test_build_trades_includes_fee_info(self):
        """수수료 정보가 포함되는지 확인"""
        analyzer = ResultAnalyzer()
        trades_df = create_trades_df()

        result = analyzer.build_trades(trades_df, slippage_rate=0.05)
        first = result[0]

        assert first.entryFee == 4.0
        assert first.exitFee == 4.1
        assert first.fee == 8.1  # entry + exit

    # =========================================================================
    # build_equity_curve 테스트
    # =========================================================================

    def test_build_equity_curve_returns_list(self):
        """build_equity_curve가 dict 리스트를 반환하는지 확인"""
        analyzer = ResultAnalyzer()
        dates = pd.date_range(start="2024-01-01", periods=5, freq="D")
        equity = pd.Series([10000, 10100, 10050, 10200, 10150], index=dates)

        result = analyzer.build_equity_curve(equity)

        assert isinstance(result, list)
        assert len(result) == 5

    def test_build_equity_curve_has_date_and_value(self):
        """equity curve 결과가 date와 value를 포함하는지 확인"""
        analyzer = ResultAnalyzer()
        dates = pd.date_range(start="2024-01-01", periods=3, freq="D")
        equity = pd.Series([10000, 10100, 10050], index=dates)

        result = analyzer.build_equity_curve(equity)
        first = result[0]

        assert "date" in first
        assert "value" in first
        assert first["value"] == 10000.0

    def test_build_equity_curve_preserves_order(self):
        """equity curve가 순서를 유지하는지 확인"""
        analyzer = ResultAnalyzer()
        dates = pd.date_range(start="2024-01-01", periods=3, freq="D")
        equity = pd.Series([10000, 10500, 11000], index=dates)

        result = analyzer.build_equity_curve(equity)

        values = [r["value"] for r in result]
        assert values == [10000.0, 10500.0, 11000.0]
