# 기술적 지표 계산 함수 모음
# TradingView와 동일한 계산 방식 사용
# Numba JIT 컴파일로 성능 최적화


import numpy as np
import pandas as pd
from numba import jit


@jit(nopython=True, cache=True)
def _rma_numba(gain: np.ndarray, loss: np.ndarray, period: int) -> tuple[np.ndarray, np.ndarray]:
    """Numba로 최적화된 RMA(Wilder's Smoothing) 계산

    TradingView ta.rma() 방식:
    - 첫 번째 유효한 값은 SMA
    - 그 이후 RMA (Wilder's Smoothing)

    Args:
        gain: 상승 배열
        loss: 하락 배열
        period: RSI 기간

    Returns:
        (avg_gain, avg_loss) 튜플
    """
    n = len(gain)
    avg_gain = np.empty(n)
    avg_loss = np.empty(n)
    avg_gain[:] = np.nan
    avg_loss[:] = np.nan

    alpha = 1.0 / period

    # 첫 번째 유효한 값: SMA (period개의 값 평균)
    # diff() 때문에 0번은 NaN이므로 1~period 합산
    first_valid_idx = period

    sum_gain = 0.0
    sum_loss = 0.0
    for i in range(1, first_valid_idx + 1):
        sum_gain += gain[i]
        sum_loss += loss[i]

    avg_gain[first_valid_idx] = sum_gain / period
    avg_loss[first_valid_idx] = sum_loss / period

    # 그 이후: RMA (Wilder's Smoothing)
    for i in range(first_valid_idx + 1, n):
        avg_gain[i] = alpha * gain[i] + (1.0 - alpha) * avg_gain[i - 1]
        avg_loss[i] = alpha * loss[i] + (1.0 - alpha) * avg_loss[i - 1]

    return avg_gain, avg_loss


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """TradingView와 100% 동일한 RSI 계산 (Numba 최적화)

    TradingView Pin Script의 ta.rma() 구현 방식:
    - 첫 번째 유효한 값은 SMA로 계산
    - 그 이후부터 RMA(Wilder's Smoothing) 적용

    공식:
        change = close.diff()
        up = rma(max(change, 0), period)
        down = rma(-min(change, 0), period)
        rsi = 100 - (100 / (1 + up / down))

    ta.rma() 정의:
        rma(source, length) =>
            alpha = 1/length
            sum := na(sum[1]) ? ta.sma(source, length) : alpha*source + (1-alpha)*sum[1]

    Args:
        close: 종가 시리즈
        period: RSI 기간 (기본 14)

    Returns:
        RSI 시리즈 (0-100)
    """
    # NumPy 배열로 변환
    close_arr = close.values.astype(np.float64)

    # 가격 변화
    delta = np.empty(len(close_arr))
    delta[0] = np.nan
    delta[1:] = close_arr[1:] - close_arr[:-1]

    # 상승/하락 분리
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)

    # Numba로 RMA 계산 (첫 실행 시 컴파일, 이후 캐시)
    avg_gain, avg_loss = _rma_numba(gain, loss, period)

    # RS 및 RSI 계산
    with np.errstate(divide="ignore", invalid="ignore"):
        rs = avg_gain / avg_loss
        rsi_values = 100.0 - (100.0 / (1.0 + rs))

    # 0으로 나누기 처리 (TradingView 방식)
    rsi_values = np.where(avg_loss == 0, 100.0, rsi_values)

    return pd.Series(rsi_values, index=close.index)


def sma(close: pd.Series, period: int = 20) -> pd.Series:
    """단순 이동평균 (SMA)

    Args:
        close: 종가 시리즈
        period: 기간 (기본 20)

    Returns:
        SMA 시리즈
    """
    return close.rolling(window=period).mean()


def ema(close: pd.Series, period: int = 20) -> pd.Series:
    """지수 이동평균 (EMA) - TradingView ta.ema()와 동일

    TradingView 방식:
    - 첫 번째 EMA 값은 처음 period개의 SMA
    - 그 이후부터 EMA 공식 적용: alpha * close + (1-alpha) * prev_ema
    - alpha = 2 / (period + 1)

    NaN 처리:
    - 입력값에 NaN이 있는 경우, 첫 번째 유효한 period개 값의 SMA를 시작점으로 사용

    Args:
        close: 종가 시리즈
        period: 기간 (기본 20)

    Returns:
        EMA 시리즈
    """
    close_arr = close.values.astype(np.float64)
    n = len(close_arr)
    ema_arr = np.empty(n)
    ema_arr[:] = np.nan

    alpha = 2.0 / (period + 1)

    # 첫 번째 유효한(non-NaN) 인덱스 찾기
    first_valid_idx = 0
    for i in range(n):
        if not np.isnan(close_arr[i]):
            first_valid_idx = i
            break
    else:
        # 모든 값이 NaN인 경우
        return pd.Series(ema_arr, index=close.index)

    # 첫 번째 유효한 EMA 시작 위치: first_valid_idx + period - 1
    ema_start_idx = first_valid_idx + period - 1

    if ema_start_idx < n:
        # 처음 period개의 유효한 값의 SMA
        first_sma = np.nanmean(close_arr[first_valid_idx : first_valid_idx + period])
        ema_arr[ema_start_idx] = first_sma

        # 그 이후: EMA 공식 적용
        for i in range(ema_start_idx + 1, n):
            if not np.isnan(close_arr[i]):
                ema_arr[i] = alpha * close_arr[i] + (1 - alpha) * ema_arr[i - 1]
            else:
                # 입력값이 NaN이면 이전 EMA 유지
                ema_arr[i] = ema_arr[i - 1]

    return pd.Series(ema_arr, index=close.index)


def macd(
    close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """MACD (Moving Average Convergence Divergence) - TradingView와 동일

    Args:
        close: 종가 시리즈
        fast: 빠른 EMA 기간 (기본 12)
        slow: 느린 EMA 기간 (기본 26)
        signal: 시그널 EMA 기간 (기본 9)

    Returns:
        (MACD 라인, 시그널 라인, 히스토그램) 튜플
    """
    # TradingView와 동일한 EMA 사용
    exp_fast = ema(close, fast)
    exp_slow = ema(close, slow)
    macd_line = exp_fast - exp_slow
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def bollinger_bands(
    close: pd.Series, period: int = 20, std_dev: float = 2.0
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """볼린저밴드

    Args:
        close: 종가 시리즈
        period: 기간 (기본 20)
        std_dev: 표준편차 배수 (기본 2.0)

    Returns:
        (상단밴드, 중간밴드, 하단밴드) 튜플
    """
    middle = close.rolling(window=period).mean()
    std = close.rolling(window=period).std()
    upper = middle + (std * std_dev)
    lower = middle - (std * std_dev)
    return upper, middle, lower


def stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
    smooth_k: int = 3,
    smooth_d: int = 3,
) -> tuple[pd.Series, pd.Series]:
    """스토캐스틱 오실레이터

    Args:
        high: 고가 시리즈
        low: 저가 시리즈
        close: 종가 시리즈
        period: 기간 (기본 14)
        smooth_k: %K 스무딩 기간 (기본 3)
        smooth_d: %D 스무딩 기간 (기본 3)

    Returns:
        (%K, %D) 튜플
    """
    low_min = low.rolling(window=period).min()
    high_max = high.rolling(window=period).max()

    k = 100 * (close - low_min) / (high_max - low_min)
    k = k.rolling(window=smooth_k).mean()
    d = k.rolling(window=smooth_d).mean()

    return k, d
