# Celery 앱 설정
# Redis를 브로커 및 결과 백엔드로 사용

import os

import sentry_sdk
from celery import Celery
from sentry_sdk.integrations.celery import CeleryIntegration

# =============================================================================
# Sentry 초기화 (Celery 에러 추적)
# =============================================================================
# SENTRY_DSN 환경변수가 설정된 경우에만 활성화
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        # Celery 통합 활성화
        integrations=[CeleryIntegration()],
        # 성능 모니터링 샘플링 비율 (10%)
        traces_sample_rate=0.1,
        # 환경 설정
        environment="development" if os.getenv("DEBUG") == "true" else "production",
        # 릴리즈 버전
        release="backtesting@1.0.0",
    )

# Redis 연결 설정
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_DB", "0")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

# Celery 브로커 및 결과 백엔드 URL (비밀번호 있으면 포함)
if REDIS_PASSWORD:
    CELERY_BROKER_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
    CELERY_RESULT_BACKEND = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
else:
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
