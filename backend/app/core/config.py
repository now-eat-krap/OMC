# 백엔드 설정 파일
# Redis 연결 및 상위 코인 목록 설정

import os

# Redis 설정
# Docker 환경에서는 "redis", 로컬에서는 환경변수로 "localhost" 설정
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

# OpenAI API 설정
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# AI Rate Limit 설정 (과부하 방지)
AI_RATE_LIMIT_PER_MINUTE = int(os.getenv("AI_RATE_LIMIT_PER_MINUTE", "5"))
AI_RATE_LIMIT_PER_HOUR = int(os.getenv("AI_RATE_LIMIT_PER_HOUR", "30"))

# 캐시할 상위 10개 코인 설정
# 형식: symbol -> (start_date, amount_precision, price_precision)
# amount_precision: 수량 소수점 자릿수 (예: 5 = 0.00001 BTC)
# price_precision: 가격 소수점 자릿수 (예: 2 = $0.01)
TOP_COINS = {
    "BTC/USDT": ("2017-08-17", 5, 2),  # 0.00001 BTC / $0.01
    "ETH/USDT": ("2017-08-17", 4, 2),  # 0.0001 ETH / $0.01
    "BNB/USDT": ("2017-11-06", 3, 2),  # 0.001 BNB / $0.01
    "SOL/USDT": ("2020-08-11", 2, 3),  # 0.01 SOL / $0.001
    "XRP/USDT": ("2018-05-04", 0, 4),  # 1 XRP / $0.0001
    "DOGE/USDT": ("2019-07-05", 0, 5),  # 1 DOGE / $0.00001
    "ADA/USDT": ("2018-04-17", 0, 4),  # 1 ADA / $0.0001
    "AVAX/USDT": ("2020-09-22", 2, 3),  # 0.01 AVAX / $0.001
    "LINK/USDT": ("2019-01-16", 2, 3),  # 0.01 LINK / $0.001
    "DOT/USDT": ("2020-08-18", 2, 3),  # 0.01 DOT / $0.001
}

# 코인 심볼 리스트 (호환성 유지)
TOP_COIN_SYMBOLS = list(TOP_COINS.keys())


def get_coin_precision(symbol: str) -> tuple:
    """코인의 precision 정보 반환

    Returns:
        (amount_precision, price_precision) 튜플
    """
    if symbol in TOP_COINS:
        _, amount_prec, price_prec = TOP_COINS[symbol]
        return (amount_prec, price_prec)
    return (4, 2)  # 기본값


def get_coin_start_date(symbol: str) -> str:
    """코인의 시작일 반환"""
    if symbol in TOP_COINS:
        return TOP_COINS[symbol][0]
    return "2017-01-01"  # 기본값


# 지원하는 타임프레임 (Binance에서 직접 가져오는 타임프레임)
SUPPORTED_TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w", "1M"]
