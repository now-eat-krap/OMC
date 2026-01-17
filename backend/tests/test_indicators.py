# ============================================================================
# indicators.py Unit Tests
# ============================================================================
# 기술적 지표 계산 함수들의 정확성을 검증하는 테스트
# TradingView와 동일한 결과를 내는지 확인합니다

import numpy as np
import pandas as pd

from app.services.indicators import (
    bollinger_bands,
    ema,
    macd,
    rsi,
    sma,
    stochastic,
)


class TestSMA:
    """SMA (단순 이동평균) 테스트"""

    def test_sma_basic(self):
        """기본 SMA 계산 테스트"""
        close = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
        result = sma(close, period=3)

        # 마지막 값: (3+4+5)/3 = 4.0
        assert result.iloc[-1] == 4.0
        # 3번째 값: (1+2+3)/3 = 2.0
        assert result.iloc[2] == 2.0

    def test_sma_has_nan(self):
        """period 이전 값들은 NaN이어야 함"""
        close = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
        result = sma(close, period=3)

        # 처음 2개는 NaN
        assert pd.isna(result.iloc[0])
        assert pd.isna(result.iloc[1])
        # 3번째부터 유효한 값
        assert not pd.isna(result.iloc[2])


class TestEMA:
    """EMA (지수 이동평균) 테스트"""

    def test_ema_first_value_is_sma(self):
        """첫 번째 EMA 값은 SMA와 같아야 함"""
        close = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
        period = 3

        ema_result = ema(close, period=period)
        sma_result = sma(close, period=period)

        # 첫 번째 유효한 EMA 값 = 처음 period개의 SMA
        assert ema_result.iloc[period - 1] == sma_result.iloc[period - 1]

    def test_ema_output_length(self):
        """출력 길이는 입력과 같아야 함"""
        close = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0])
        result = ema(close, period=3)
        assert len(result) == len(close)


class TestRSI:
    """RSI (상대강도지수) 테스트"""

    def test_rsi_range(self):
        """RSI 값은 항상 0-100 사이여야 함"""
        # 상승 추세 데이터
        close = pd.Series([100 + i for i in range(50)])
        result = rsi(close, period=14)

        valid_values = result.dropna()
        assert all(0 <= v <= 100 for v in valid_values)

    def test_rsi_on_rising_prices(self):
        """계속 상승하는 가격에서 RSI는 100에 가까워야 함"""
        close = pd.Series([100 + i * 10 for i in range(30)])
        result = rsi(close, period=14)

        # 마지막 RSI 값은 100이어야 함 (계속 상승이므로)
        assert result.iloc[-1] == 100.0

    def test_rsi_on_falling_prices(self):
        """계속 하락하는 가격에서 RSI는 0에 가까워야 함"""
        close = pd.Series([1000 - i * 10 for i in range(30)])
        result = rsi(close, period=14)

        # 마지막 RSI 값은 0이어야 함 (계속 하락이므로)
        assert result.iloc[-1] == 0.0

    def test_rsi_output_length(self):
        """출력 길이는 입력과 같아야 함"""
        close = pd.Series([100 + i for i in range(50)])
        result = rsi(close, period=14)
        assert len(result) == len(close)


class TestMACD:
    """MACD 테스트"""

    def test_macd_returns_three_series(self):
        """MACD는 3개의 시리즈(MACD, Signal, Histogram)를 반환해야 함"""
        close = pd.Series([100 + i for i in range(50)])
        macd_line, signal_line, histogram = macd(close)

        assert isinstance(macd_line, pd.Series)
        assert isinstance(signal_line, pd.Series)
        assert isinstance(histogram, pd.Series)

    def test_macd_histogram_equals_diff(self):
        """히스토그램 = MACD - Signal"""
        close = pd.Series([100 + i for i in range(50)])
        macd_line, signal_line, histogram = macd(close)

        # NaN이 아닌 값들에 대해 검증
        valid_idx = ~(pd.isna(macd_line) | pd.isna(signal_line))
        expected = macd_line[valid_idx] - signal_line[valid_idx]
        actual = histogram[valid_idx]

        np.testing.assert_array_almost_equal(actual.values, expected.values)


class TestBollingerBands:
    """볼린저밴드 테스트"""

    def test_bollinger_returns_three_series(self):
        """볼린저밴드는 3개의 시리즈(상단, 중간, 하단)를 반환해야 함"""
        close = pd.Series([100 + i for i in range(30)])
        upper, middle, lower = bollinger_bands(close, period=20)

        assert isinstance(upper, pd.Series)
        assert isinstance(middle, pd.Series)
        assert isinstance(lower, pd.Series)

    def test_bollinger_middle_equals_sma(self):
        """중간밴드는 SMA와 같아야 함"""
        close = pd.Series([100 + i for i in range(30)])
        period = 20

        upper, middle, lower = bollinger_bands(close, period=period)
        sma_result = sma(close, period=period)

        pd.testing.assert_series_equal(middle, sma_result)

    def test_bollinger_upper_greater_than_lower(self):
        """상단밴드는 항상 하단밴드보다 커야 함"""
        close = pd.Series([100 + i for i in range(30)])
        upper, middle, lower = bollinger_bands(close, period=20)

        valid_idx = ~pd.isna(upper)
        assert all(upper[valid_idx] > lower[valid_idx])


class TestStochastic:
    """스토캐스틱 오실레이터 테스트"""

    def test_stochastic_returns_two_series(self):
        """%K와 %D 두 개의 시리즈를 반환해야 함"""
        high = pd.Series([110 + i for i in range(30)])
        low = pd.Series([90 + i for i in range(30)])
        close = pd.Series([100 + i for i in range(30)])

        k, d = stochastic(high, low, close)

        assert isinstance(k, pd.Series)
        assert isinstance(d, pd.Series)

    def test_stochastic_range(self):
        """%K와 %D는 0-100 사이여야 함"""
        high = pd.Series([110 + i for i in range(30)])
        low = pd.Series([90 + i for i in range(30)])
        close = pd.Series([100 + i for i in range(30)])

        k, d = stochastic(high, low, close)

        valid_k = k.dropna()
        valid_d = d.dropna()

        assert all(0 <= v <= 100 for v in valid_k)
        assert all(0 <= v <= 100 for v in valid_d)
