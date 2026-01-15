# FastAPI 백테스팅 백엔드 앱
# 메인 엔트리 포인트

import os

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.routers import ai, assets, backtest
from app.services.scheduler import lifespan

# =============================================================================
# Sentry 초기화 (프로덕션 환경에서 에러 추적)
# =============================================================================
# SENTRY_DSN 환경변수가 설정된 경우에만 활성화
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        # 성능 모니터링 샘플링 비율 (10%)
        traces_sample_rate=0.1,
        # 프로파일링 샘플링 비율 (10%)
        profiles_sample_rate=0.1,
        # 환경 설정 (DEBUG 변수로 구분)
        environment="development" if os.getenv("DEBUG") == "true" else "production",
        # 릴리즈 버전
        release="backtesting@1.0.0",
    )

# Rate limiter 인스턴스 생성
limiter = Limiter(key_func=get_remote_address)

# FastAPI 앱 인스턴스 (lifespan으로 스케줄러 관리)
app = FastAPI(
    title="OMC 백테스팅 API",
    description="VectorBT 기반 암호화폐 전략 백테스팅 서비스",
    version="1.0.0",
    lifespan=lifespan,  # 자동 초기화 + 스케줄러
)

# Rate limiter 상태 저장
app.state.limiter = limiter

# =============================================================================
# Prometheus 메트릭 계측기 설정
# =============================================================================
# /metrics 엔드포인트에서 Prometheus 형식 메트릭 노출
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


# Rate limit 초과 시 에러 핸들러 등록
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429, content={"detail": "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요."}
    )


# CORS 설정 (프론트엔드 연동)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite 개발 서버
        "http://localhost:3000",  # 기타 프론트엔드
        "http://localhost",  # Docker Nginx
        "*",  # 프로덕션에서는 실제 도메인으로 변경
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(assets.router, prefix="/api", tags=["Assets"])
app.include_router(backtest.router, prefix="/api", tags=["Backtest"])
app.include_router(ai.router, prefix="/api", tags=["AI"])


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """
    헬스 체크 엔드포인트 (Docker 헬스체크용)

    Redis 연결 상태를 포함한 상세 헬스 정보 반환
    """
    import redis.asyncio as aioredis

    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", "6379"))
    redis_password = os.getenv("REDIS_PASSWORD") or None  # 빈 문자열이면 None으로

    # Redis 연결 체크
    redis_status = "ok"
    try:
        redis_client = aioredis.Redis(
            host=redis_host,
            port=redis_port,
            password=redis_password,
        )
        await redis_client.ping()
        await redis_client.close()
    except Exception:
        redis_status = "error"

    # 전체 상태 결정
    overall_status = "ok" if redis_status == "ok" else "degraded"

    return {
        "status": overall_status,
        "message": "OMC 백테스팅 API 서버 정상 작동 중",
        "services": {
            "redis": redis_status,
        },
        "version": "1.0.0",
    }
