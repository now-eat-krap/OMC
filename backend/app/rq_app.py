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
