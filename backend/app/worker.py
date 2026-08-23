"""RQ 워커 진입점

`rq worker` CLI를 직접 쓰지 않고 이 모듈로 워커를 띄웁니다.
이유는 Numba JIT 컴파일을 fork 이전에 끝내기 위해서입니다.

RQ 워커는 작업마다 자식 프로세스를 fork해 실행합니다. 부모가 살아 있어도
자식은 매번 새로 뜨므로, 워밍업을 하지 않으면 요청마다 vectorbt의
from_order_func 경로를 다시 컴파일합니다(측정값 요청당 약 16초).

여기서 워커를 시작하기 전에 워밍업을 돌리면 컴파일 결과가 부모 프로세스
메모리에 올라가고, 이후 fork된 자식들이 그대로 물려받습니다.
"""

import asyncio
import logging
import os

from rq import Worker
from sentry_sdk.integrations.rq import RqIntegration

from app.core.sentry import init_sentry
from app.rq_app import queue, redis_conn
from app.services.scheduler import warmup_numba_jit

logger = logging.getLogger(__name__)


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # 워커 프로세스는 API와 별개로 뜨므로 Sentry도 여기서 따로 초기화한다.
    # RqIntegration이 작업 실패를 자동으로 잡고 작업 단위 트랜잭션을 만든다.
    init_sentry("rq-worker", integrations=[RqIntegration()])

    logger.info("Numba JIT 워밍업 시작 (fork 이전)...")
    asyncio.run(warmup_numba_jit())
    logger.info("워밍업 완료. RQ 워커를 시작합니다.")

    worker = Worker([queue], connection=redis_conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
