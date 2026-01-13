# Celery 앱 설정
# Redis를 브로커 및 결과 백엔드로 사용

import os

from celery import Celery

# Redis 연결 설정
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_DB", "0")

# Celery 브로커 및 결과 백엔드 URL
CELERY_BROKER_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
CELERY_RESULT_BACKEND = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Celery 앱 생성
celery_app = Celery(
    "backtest_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["app.tasks"],  # 작업 모듈 포함
)

# Celery 설정
celery_app.conf.update(
    # 작업 직렬화 설정
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # 타임존
    timezone="UTC",
    enable_utc=True,
    # 결과 만료 시간 (1시간)
    result_expires=3600,
    # 작업 추적 활성화
    task_track_started=True,
    # 작업 결과 무시하지 않음
    task_ignore_result=False,
    # Worker 설정
    worker_prefetch_multiplier=1,  # 한 번에 하나씩 가져오기
    worker_concurrency=2,  # 동시 작업 수
)
