"""캔들 캐시 작업 (RQ Task)

- update_candle_cache: 매일 00:05 UTC 갱신. app/cron.py 가 스케줄에 따라 넣는다
- initialize_candle_cache: 캐시가 비어 있을 때 한 번 채우는 부트스트랩.
  app/cron.py 가 기동 때 한 번 넣는다

둘 다 원래 API 프로세스 안에 있었다. API 안에 두면 uvicorn 워커 수만큼 중복
실행되고, 수 분 걸리는 Binance 호출이 요청 처리 프로세스에 얹히기 때문에
옮겨 왔다.
"""

import asyncio
import logging

from app.services.scheduler import initialize_cache_if_empty, update_cache_daily

logger = logging.getLogger(__name__)

# 부트스트랩 작업의 고정 job id. cron 이 기동마다 넣으므로 같은 게 큐에
# 이미 있으면 건너뛰기 위해 id 를 고정한다
INIT_CACHE_JOB_ID = "initialize-candle-cache"


def initialize_candle_cache() -> None:
    """캐시가 비어 있으면 전 코인·타임프레임을 처음부터 채운다 (있으면 즉시 종료)

    API lifespan 에서 하던 것을 옮겨 왔다. API 안에 두면 uvicorn 워커 수만큼
    동시에 돌고, 한 번에 수 분 걸리는 Binance 호출이 요청 처리 프로세스에 얹힌다.
    app/cron.py 가 기동 때 maintenance 큐에 넣고 워커가 실행한다.
    """
    logger.info("캔들 캐시 부트스트랩 작업 시작")
    asyncio.run(initialize_cache_if_empty())
    logger.info("캔들 캐시 부트스트랩 작업 완료")


def update_candle_cache() -> None:
    """어제까지의 새 캔들을 Binance에서 받아 Redis 캐시에 덧붙인다"""
    logger.info("캔들 캐시 일일 갱신 작업 시작")
    asyncio.run(update_cache_daily())
    logger.info("캔들 캐시 일일 갱신 작업 완료")
