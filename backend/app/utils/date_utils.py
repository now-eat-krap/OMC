# 날짜 관련 유틸리티 함수
# 날짜 변환, 타임프레임 조정 등

from datetime import datetime, timedelta


def parse_date(date_str: str, format: str = "%Y-%m-%d") -> datetime:
    """문자열을 datetime으로 변환

    Args:
        date_str: 날짜 문자열 (예: "2024-01-01")
        format: 날짜 포맷

    Returns:
        datetime 객체
    """
    return datetime.strptime(date_str, format)


def format_date(dt: datetime, format: str = "%Y-%m-%d") -> str:
    """datetime을 문자열로 변환

    Args:
        dt: datetime 객체
        format: 출력 포맷

    Returns:
        날짜 문자열
    """
    return dt.strftime(format)


def adjust_start_date_for_timeframe(start_date: str, timeframe: str) -> str:
    """타임프레임에 맞게 시작 날짜 조정

    주봉: 해당 주의 월요일로 조정
    월봉: 해당 월의 1일로 조정

    Args:
        start_date: 시작 날짜 (YYYY-MM-DD)
        timeframe: 타임프레임 (15m, 1h, 4h, 1d, 1w, 1M)

    Returns:
        조정된 날짜 문자열
    """
    start_dt = parse_date(start_date)

    if timeframe in ["1w", "w", "W"]:
        # 해당 주의 월요일로 조정
        days_since_monday = start_dt.weekday()
        adjusted_dt = start_dt - timedelta(days=days_since_monday)
        return format_date(adjusted_dt)

    elif timeframe in ["1M", "M"]:
        # 해당 월의 1일로 조정
        adjusted_dt = start_dt.replace(day=1)
        return format_date(adjusted_dt)

    # 다른 타임프레임은 조정 불필요
    return start_date


def get_days_between(start_date: str, end_date: str) -> int:
    """두 날짜 사이의 일 수 계산

    Args:
        start_date: 시작 날짜 (YYYY-MM-DD)
        end_date: 종료 날짜 (YYYY-MM-DD)

    Returns:
        일 수
    """
    start_dt = parse_date(start_date)
    end_dt = parse_date(end_date)
    return (end_dt - start_dt).days


def timestamp_to_datetime(timestamp_ms: int) -> datetime:
    """밀리초 타임스탬프를 datetime으로 변환

    Args:
        timestamp_ms: 밀리초 타임스탬프

    Returns:
        datetime 객체
    """
    return datetime.fromtimestamp(timestamp_ms / 1000)


def datetime_to_timestamp(dt: datetime) -> int:
    """datetime을 밀리초 타임스탬프로 변환

    Args:
        dt: datetime 객체

    Returns:
        밀리초 타임스탬프
    """
    return int(dt.timestamp() * 1000)
