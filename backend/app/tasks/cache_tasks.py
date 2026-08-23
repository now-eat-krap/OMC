"""캔들 캐시 갱신 작업 (RQ Task)

매일 00:05 UTC에 app/cron.py가 maintenance 큐에 넣고 워커가 실행합니다.
API 프로세스 안에서 APScheduler로 돌리던 것을 옮겨 왔습니다. API 안에 두면
uvicorn 워커 수만큼 스케줄러가 떠서 갱신이 중복 실행되기 때문입니다.
"""

import asyncio
import logging

from app.services.scheduler import update_cache_daily

logger = logging.getLogger(__name__)


def update_candle_cache() -> None:
    """어제까지의 새 캔들을 Binance에서 받아 Redis 캐시에 덧붙인다"""
    logger.info("캔들 캐시 일일 갱신 작업 시작")
    asyncio.run(update_cache_daily())
    logger.info("캔들 캐시 일일 갱신 작업 완료")
