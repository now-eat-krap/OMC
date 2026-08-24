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


@jit(nopython=True, cache=True)
def _ema_numba(close_arr: np.ndarray, period: int, first_valid_idx: int) -> np.ndarray:
    """Numba로 최적화된 EMA 계산

    Args:
        close_arr: 종가 배열 (float64)
        period: EMA 기간
        first_valid_idx: 첫 번째 유효한(non-NaN) 인덱스

    Returns:
        EMA 배열
    """
    n = len(close_arr)
    ema_arr = np.empty(n)
    ema_arr[:] = np.nan

    alpha = 2.0 / (period + 1)

    # EMA 시작 위치
    ema_start_idx = first_valid_idx + period - 1

    if ema_start_idx >= n:
        return ema_arr

    # 처음 period개의 SMA 계산
    sma_sum = 0.0
    for i in range(first_valid_idx, first_valid_idx + period):
        sma_sum += close_arr[i]
    ema_arr[ema_start_idx] = sma_sum / period

    # EMA 공식 적용
    for i in range(ema_start_idx + 1, n):
        if not np.isnan(close_arr[i]):
            ema_arr[i] = alpha * close_arr[i] + (1.0 - alpha) * ema_arr[i - 1]
        else:
            ema_arr[i] = ema_arr[i - 1]

    return ema_arr


def ema(close: pd.Series, period: int = 20) -> pd.Series:
    """지수 이동평균 (EMA) - TradingView ta.ema()와 동일 (Numba 최적화)

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

    # 첫 번째 유효한(non-NaN) 인덱스 찾기
    first_valid_idx = 0
    for i in range(n):
        if not np.isnan(close_arr[i]):
            first_valid_idx = i
            break
    else:
        # 모든 값이 NaN인 경우
        ema_arr = np.empty(n)
        ema_arr[:] = np.nan
        return pd.Series(ema_arr, index=close.index)

    # Numba로 EMA 계산 (첫 실행 시 컴파일, 이후 캐시)
    ema_arr = _ema_numba(close_arr, period, first_valid_idx)

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


def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """ATR (Average True Range) - TradingView ta.atr 과 동일 (RMA 스무딩)

    True Range = max(고가-저가, |고가-전봉종가|, |저가-전봉종가|)
    ATR = RMA(True Range, period)

    Args:
        high, low, close: 가격 시리즈
        period: 기간 (기본 14)

    Returns:
        ATR 시리즈
    """
    prev_close = close.shift(1)
    tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(
        axis=1
    )
    # 첫 봉은 전봉이 없어 고가-저가만 쓴다
    tr.iloc[0] = float(high.iloc[0] - low.iloc[0])
    # RMA: 첫 값은 SMA, 이후 alpha=1/period 지수 평활 (rsi 의 _rma_numba 와 같은 정의)
    tr_arr = tr.to_numpy(dtype=np.float64)
    out = np.full(len(tr_arr), np.nan)
    if len(tr_arr) >= period:
        out[period - 1] = tr_arr[:period].mean()
        alpha = 1.0 / period
        for i in range(period, len(tr_arr)):
            out[i] = alpha * tr_arr[i] + (1.0 - alpha) * out[i - 1]
    return pd.Series(out, index=close.index)


def keltner_channel(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 20,
    multiplier: float = 2.0,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """켈트너 채널 - 중심 EMA(period), 폭 multiplier × ATR(period)

    TradingView 기본값(EMA 20, ATR 길이 = 같은 period, 배수 2)을 따릅니다.

    Returns:
        (상단, 중간, 하단) 튜플
    """
    middle = ema(close, period)
    band = atr(high, low, close, period) * multiplier
    return middle + band, middle, middle - band


def envelope(
    close: pd.Series, period: int = 20, percent: float = 10.0
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """엔벨로프 - 중심 SMA(period), 폭 ±percent %

    TradingView 기본값(길이 20, 10%)을 따릅니다.

    Returns:
        (상단, 중간, 하단) 튜플
    """
    middle = sma(close, period)
    ratio = percent / 100.0
    return middle * (1.0 + ratio), middle, middle * (1.0 - ratio)


def wma(close: pd.Series, period: int = 20) -> pd.Series:
    """WMA (가중이동평균) - TradingView ta.wma 와 동일

    최근 봉일수록 큰 가중치(1..period)를 준다.
    """
    arr = close.to_numpy(dtype=np.float64)
    n = len(arr)
    out = np.full(n, np.nan)
    if n >= period:
        weights = np.arange(1, period + 1, dtype=np.float64)
        wsum = weights.sum()
        # 컨볼루션 한 번으로 전 구간 계산 (rolling.apply 는 파이썬 루프라 느리다)
        out[period - 1 :] = np.convolve(arr, weights[::-1], mode="valid") / wsum
    return pd.Series(out, index=close.index)


def vwap(
    high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series, period: int = 20
) -> pd.Series:
    """롤링 VWAP - 최근 period 봉의 거래량 가중 평균가

    전통적 VWAP 은 세션 기준(당일 시작 리셋)이지만 암호화폐는 24시간 거래라
    세션이 없다. TradingView 의 Rolling VWAP 처럼 최근 N 봉 기준으로 계산한다.
    가격은 typical price (고+저+종)/3.
    """
    tp = (high + low + close) / 3.0
    pv = (tp * volume).rolling(window=period).sum()
    v = volume.rolling(window=period).sum()
    return pv / v.replace(0, np.nan)


def stdev(close: pd.Series, period: int = 20) -> pd.Series:
    """롤링 표준편차 - TradingView ta.stdev 와 동일 (모집단, ddof=0)

    주의: bollinger_bands 는 표본 표준편차(ddof=1)를 쓴다. 기존 결과를 바꾸지
    않기 위해 그대로 두고, 이 함수는 TV 정의를 따른다.
    """
    return close.rolling(window=period).std(ddof=0)


def highest(series: pd.Series, period: int = 20) -> pd.Series:
    """최근 period 봉의 최고값 (TradingView ta.highest)"""
    return series.rolling(window=period).max()


def lowest(series: pd.Series, period: int = 20) -> pd.Series:
    """최근 period 봉의 최저값 (TradingView ta.lowest)"""
    return series.rolling(window=period).min()


def change(series: pd.Series, length: int = 1) -> pd.Series:
    """length 봉 전 대비 변화량 (TradingView ta.change)"""
    return series - series.shift(length)


def crossover(a: pd.Series, b: pd.Series) -> pd.Series:
    """a 가 b 를 상향 돌파한 봉 (TradingView ta.crossover)

    전 봉에서는 a <= b, 이번 봉에서 a > b.
    """
    prev_a, prev_b = a.shift(1), b.shift(1)
    return ((a > b) & (prev_a <= prev_b)).fillna(False)


def crossunder(a: pd.Series, b: pd.Series) -> pd.Series:
    """a 가 b 를 하향 돌파한 봉 (TradingView ta.crossunder)"""
    prev_a, prev_b = a.shift(1), b.shift(1)
    return ((a < b) & (prev_a >= prev_b)).fillna(False)


SUPPORTED_BAND_TYPES = ("bollinger", "keltner", "envelope")


def bands(df: pd.DataFrame, band_type: str, period: int) -> tuple[pd.Series, pd.Series, pd.Series]:
    """밴드형 지표 공통 진입점. band_type 에 따라 (상단, 중간, 하단) 을 돌려준다

    모르는 band_type 은 조용히 볼린저로 바꾸지 않고 에러를 낸다. UI 가 노출하는
    선택지와 계산이 어긋난 채로 굴러가는 것을 막기 위해서다.
    """
    if band_type == "bollinger":
        return bollinger_bands(df["close"], period)
    if band_type == "keltner":
        return keltner_channel(df["high"], df["low"], df["close"], period)
    if band_type == "envelope":
        return envelope(df["close"], period)
    raise ValueError(
        f"지원하지 않는 밴드 종류: {band_type} (가능: {', '.join(SUPPORTED_BAND_TYPES)})"
    )


def stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14,
    smooth_k: int = 1,
    smooth_d: int = 3,
) -> tuple[pd.Series, pd.Series]:
    """스토캐스틱 오실레이터

    Args:
        high: 고가 시리즈
        low: 저가 시리즈
        close: 종가 시리즈
        period: 기간 (기본 14)
        smooth_k: %K 스무딩 기간 (기본 1)
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
