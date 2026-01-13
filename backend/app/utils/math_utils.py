# 수학 관련 유틸리티 함수
# safe_float, 소수점 처리 등

import math


def safe_float(value, default: float = 0.0) -> float:
    """inf, -inf, nan 값을 안전한 값으로 변환

    Args:
        value: 변환할 값
        default: 변환 실패 시 반환할 기본값

    Returns:
        안전한 float 값
    """
    if value is None:
        return default
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default


def round_to_precision(value: float, precision: int) -> float:
    """지정된 소수점 자릿수로 반올림

    Args:
        value: 반올림할 값
        precision: 소수점 자릿수

    Returns:
        반올림된 값
    """
    if precision < 0:
        precision = 0
    return round(value, precision)


def clamp(value: float, min_val: float, max_val: float) -> float:
    """값을 최소/최대 범위로 제한

    Args:
        value: 제한할 값
        min_val: 최소값
        max_val: 최대값

    Returns:
        범위 내로 제한된 값
    """
    return max(min_val, min(value, max_val))


def percent_to_ratio(percent: float) -> float:
    """퍼센트를 비율로 변환 (100% -> 1.0)

    Args:
        percent: 퍼센트 값

    Returns:
        비율 값
    """
    return percent / 100.0


def ratio_to_percent(ratio: float) -> float:
    """비율을 퍼센트로 변환 (1.0 -> 100%)

    Args:
        ratio: 비율 값

    Returns:
        퍼센트 값
    """
    return ratio * 100.0
