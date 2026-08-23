"""RQ 크론 스케줄러 진입점

주기 작업을 정해진 시각에 큐에 넣는 프로세스입니다. 실제 실행은 워커가 합니다.

RQ의 CronScheduler는 리더 선출이 없어서 두 개를 띄우면 작업이 두 번
들어갑니다. 그래서 워커 안에 넣지 않고 compose에서 rq-cron 서비스 하나로
따로 띄웁니다. 워커는 몇 개를 띄워도 이 프로세스는 항상 하나여야 합니다.

등록된 작업
- 캔들 캐시 일일 갱신: 매일 00:05 UTC (한국 09:05). Binance 일봉이 00:00 UTC에
  닫히므로 그 직후에 받습니다.
- 캔들 캐시 부트스트랩: 기동 때 한 번 큐에 넣습니다. 캐시가 비어 있을 때만
  실제로 채우고, 차 있으면 바로 끝납니다.
"""

import logging
import os

from rq.cron import CronScheduler
from rq.job import Job, JobStatus

from app.core.sentry import init_sentry
from app.rq_app import maintenance_queue, redis_conn
from app.tasks.cache_tasks import INIT_CACHE_JOB_ID, initialize_candle_cache, update_candle_cache

logger = logging.getLogger(__name__)


def enqueue_cache_bootstrap() -> None:
    """캐시 부트스트랩 작업을 한 번 넣는다. 이미 대기/실행 중이면 건너뛴다"""
    try:
        existing = Job.fetch(INIT_CACHE_JOB_ID, connection=redis_conn)
        if existing.get_status() in (JobStatus.QUEUED, JobStatus.STARTED):
            logger.info("캐시 부트스트랩 작업이 이미 큐에 있어 건너뜁니다")
            return
    except Exception:
        pass  # 없거나 만료됨 → 새로 넣는다
    maintenance_queue.enqueue(initialize_candle_cache, job_id=INIT_CACHE_JOB_ID, job_timeout=3600)
    logger.info("캐시 부트스트랩 작업을 maintenance 큐에 넣었습니다")


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    init_sentry("rq-cron")

    # 캐시가 비어 있으면 채우는 일회성 작업. 이 프로세스는 항상 하나라 중복이 없다
    enqueue_cache_bootstrap()

    scheduler = CronScheduler(connection=redis_conn)
    scheduler.register(
        update_candle_cache,
        queue_name=maintenance_queue.name,
        cron="5 0 * * *",
        job_timeout=1800,
        name="daily_cache_update",
    )
    logger.info("크론 등록 완료: 캔들 캐시 갱신 매일 00:05 UTC")
    scheduler.start()


if __name__ == "__main__":
    main()
