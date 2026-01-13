# 백엔드 설정 파일
# 하위 호환성을 위해 core.config에서 re-export

from app.core.config import (
    AI_RATE_LIMIT_PER_HOUR,
    AI_RATE_LIMIT_PER_MINUTE,
    OPENAI_API_KEY,
    REDIS_DB,
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    SUPPORTED_TIMEFRAMES,
    TOP_COIN_SYMBOLS,
    TOP_COINS,
    get_coin_precision,
    get_coin_start_date,
)

__all__ = [
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_DB",
    "REDIS_PASSWORD",
    "OPENAI_API_KEY",
    "AI_RATE_LIMIT_PER_MINUTE",
    "AI_RATE_LIMIT_PER_HOUR",
    "TOP_COINS",
    "TOP_COIN_SYMBOLS",
    "SUPPORTED_TIMEFRAMES",
    "get_coin_precision",
    "get_coin_start_date",
]
