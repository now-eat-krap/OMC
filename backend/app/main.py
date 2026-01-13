# FastAPI 백테스팅 백엔드 앱
# 메인 엔트리 포인트

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.routers import ai, assets, backtest
from app.services.scheduler import lifespan

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
    """헬스 체크 엔드포인트 (Docker 헬스체크용)"""
    return {"status": "ok", "message": "OMC 백테스팅 API 서버 정상 작동 중"}
