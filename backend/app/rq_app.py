"""RQ (Redis Queue) 설정"""

from redis import Redis
from rq import Queue

from app.core.config import REDIS_DB, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT

# Redis 연결
if REDIS_PASSWORD:
    redis_conn = Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        decode_responses=False,
    )
else:
    redis_conn = Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=False)

# 작업 큐 생성
queue = Queue("backtest", connection=redis_conn, default_timeout=3600)

# API가 큐에 넣을 때 쓰는 작업 함수 경로.
# 함수 객체 대신 문자열을 넘기는 이유: 함수를 import하면 백테스트 엔진과
# vectorbt가 API 프로세스에 통째로 올라온다(약 6초, 약 200MB). RQ는 문자열
# 경로를 받아 워커 쪽에서 import하므로 API는 엔진 코드를 몰라도 된다.
BACKTEST_TASK = "app.tasks.backtest_tasks.run_backtest_task"

# 캐시 갱신 같은 유지보수 작업용. 워커는 backtest를 먼저 보고 그 다음 이 큐를 본다
maintenance_queue = Queue("maintenance", connection=redis_conn, default_timeout=1800)
