# ============================================================================
# BacktestEngine 통합 테스트
# ============================================================================
# BacktestEngine.run() 메서드의 통합 테스트
# 실제 데이터 대신 모의 데이터를 사용하여 테스트

from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest

from app.schemas import BacktestRequest, SentenceCondition
from app.services.backtest.engine import BacktestEngine


def create_mock_df(periods=100):
    """테스트용 모의 OHLCV DataFrame 생성"""
    dates = pd.date_range(start="2023-12-01", periods=periods, freq="D")
    np.random.seed(42)

    close = 40000 + np.cumsum(np.random.randn(periods) * 500)
    high = close + np.random.rand(periods) * 200
    low = close - np.random.rand(periods) * 200
    open_price = close + np.random.randn(periods) * 100
    volume = np.random.rand(periods) * 1000000000

    df = pd.DataFrame(
        {
            "timestamp": [int(d.timestamp() * 1000) for d in dates],
            "open": open_price,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
        }
    )
    df["datetime"] = dates
    df.set_index("datetime", inplace=True)
    return df


def create_flat_df(periods=100):
    """변동이 거의 없는 평탄한 OHLCV DataFrame (RSI ≈ 50)"""
    dates = pd.date_range(start="2023-12-01", periods=periods, freq="D")

    # 가격이 거의 변동 없음 → RSI ≈ 50
    close = np.full(periods, 40000.0) + np.random.randn(periods) * 0.01
    high = close + 10
    low = close - 10
    open_price = close

    df = pd.DataFrame(
        {
            "timestamp": [int(d.timestamp() * 1000) for d in dates],
            "open": open_price,
            "high": high,
            "low": low,
            "close": close,
            "volume": np.full(periods, 1000000.0),
        }
    )
    df["datetime"] = dates
    df.set_index("datetime", inplace=True)
    return df


def get_sample_request():
    """기본 백테스트 요청 (RSI 조건)"""
    return BacktestRequest(
        symbol="BTC/USDT",
        timeframe="1d",
        startDate="2024-01-01",
        endDate="2024-06-30",
        initialCapital=10000,
        feeRate=0.1,
        slippage=0.05,
        positionSize=100,
        buyConditions=[
            SentenceCondition(
                id="buy_rsi_1",
                templateType="indicator_vs_value",
                indicator="RSI",
                indicatorPeriod=14,
                comparison="lt",
                value=30,
            )
        ],
        sellConditions=[
            SentenceCondition(
                id="sell_rsi_1",
                templateType="indicator_vs_value",
                indicator="RSI",
                indicatorPeriod=14,
                comparison="gt",
                value=70,
            )
        ],
    )


class TestBacktestEngine:
    """BacktestEngine 통합 테스트"""

    # =========================================================================
    # 결과 구조 검증 테스트
    # =========================================================================

    @pytest.mark.asyncio
    async def test_run_returns_backtest_result(self):
        """run() 메서드가 BacktestResult를 반환하는지 확인"""
        engine = BacktestEngine()
        request = get_sample_request()
        mock_df = create_mock_df()

        with patch.object(engine.data_service, "get_ohlcv_dataframe", return_value=mock_df):
            result = await engine.run(request)

        # 결과 타입 확인
        assert result is not None
        assert hasattr(result, "totalReturn")
        assert hasattr(result, "winRate")
        assert hasattr(result, "maxDrawdown")
        assert hasattr(result, "trades")
        assert hasattr(result, "ohlcv")
        assert hasattr(result, "indicators")

    @pytest.mark.asyncio
    async def test_run_with_no_signals_returns_empty_trades(self):
        """시그널이 없으면 빈 거래 내역 반환"""
        engine = BacktestEngine()
        request = get_sample_request()
        mock_df = create_flat_df()

        with patch.object(engine.data_service, "get_ohlcv_dataframe", return_value=mock_df):
            result = await engine.run(request)

        assert result.totalTrades == 0
        assert result.trades == []
        assert result.totalReturn == 0

    @pytest.mark.asyncio
    async def test_run_includes_ohlcv_data(self):
        """결과에 OHLCV 데이터가 포함되는지 확인"""
        engine = BacktestEngine()
        request = get_sample_request()
        mock_df = create_mock_df()

        with patch.object(engine.data_service, "get_ohlcv_dataframe", return_value=mock_df):
            result = await engine.run(request)

        assert len(result.ohlcv) > 0
        # OHLCV 데이터 구조 확인
        first_candle = result.ohlcv[0]
        assert hasattr(first_candle, "timestamp")
        assert hasattr(first_candle, "open")
        assert hasattr(first_candle, "high")
        assert hasattr(first_candle, "low")
        assert hasattr(first_candle, "close")
        assert hasattr(first_candle, "volume")

    @pytest.mark.asyncio
    async def test_run_includes_indicator_data(self):
        """결과에 지표 데이터가 포함되는지 확인"""
        engine = BacktestEngine()
        request = get_sample_request()
        mock_df = create_mock_df()

        with patch.object(engine.data_service, "get_ohlcv_dataframe", return_value=mock_df):
            result = await engine.run(request)

        # RSI 조건을 사용했으므로 RSI 지표가 포함되어야 함
        assert len(result.indicators) > 0
        rsi_indicator = next((ind for ind in result.indicators if "RSI" in ind.name), None)
        assert rsi_indicator is not None

    # =========================================================================
    # 예외 처리 테스트
    # =========================================================================

    @pytest.mark.asyncio
    async def test_run_raises_on_empty_data(self):
        """데이터가 없으면 ValueError 발생"""
        engine = BacktestEngine()
        request = get_sample_request()
        empty_df = pd.DataFrame()

        with patch.object(engine.data_service, "get_ohlcv_dataframe", return_value=empty_df):
            with pytest.raises(ValueError, match="데이터가 없습니다"):
                await engine.run(request)
