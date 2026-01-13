# AI 전략 변환 API 라우터
# Rate limiting으로 과부하 방지


from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import AI_RATE_LIMIT_PER_HOUR, AI_RATE_LIMIT_PER_MINUTE
from app.services.ai_strategy import ai_strategy_service

router = APIRouter()

# Rate limiter 설정 (IP 기반)
limiter = Limiter(key_func=get_remote_address)


class ParseStrategyRequest(BaseModel):
    """AI 전략 변환 요청"""

    prompt: str


class ParseStrategyResponse(BaseModel):
    """AI 전략 변환 응답"""

    buyConditions: list
    sellConditions: list


@router.post("/ai/parse-strategy", response_model=ParseStrategyResponse)
@limiter.limit(f"{AI_RATE_LIMIT_PER_MINUTE}/minute;{AI_RATE_LIMIT_PER_HOUR}/hour")
async def parse_strategy(request: Request, body: ParseStrategyRequest):
    """
    자연어 전략을 매수/매도 조건으로 변환

    AI(GPT-4o-mini)를 활용하여 사용자의 자연어 전략 설명을
    백테스팅에 사용할 수 있는 SentenceCondition 형태로 변환합니다.

    Rate Limit:
    - 분당 5회, 시간당 30회 (IP 기준)
    """
    if not body.prompt or not body.prompt.strip():
        raise HTTPException(status_code=400, detail="전략 설명을 입력해주세요.")

    # 프롬프트 길이 제한 (비용 절감)
    if len(body.prompt) > 1000:
        raise HTTPException(status_code=400, detail="전략 설명은 1000자 이내로 입력해주세요.")

    try:
        result = await ai_strategy_service.parse_strategy(body.prompt)
        return ParseStrategyResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 전략 변환 실패: {str(e)}") from e


@router.get("/ai/health")
async def ai_health():
    """AI 서비스 헬스 체크"""
    from app.config import OPENAI_API_KEY

    return {
        "status": "ok" if OPENAI_API_KEY else "no_api_key",
        "api_key_configured": bool(OPENAI_API_KEY),
    }


# ============================================
# AI 리포트 생성 (구조화된 응답)
# ============================================


class TradeRecord(BaseModel):
    """개별 거래 기록"""

    entryTime: str
    exitTime: str | None = None
    entryPrice: float
    exitPrice: float | None = None
    pnl: float
    pnlPercent: float
    size: float | None = None
    isOpen: bool | None = False


class BacktestConfig(BaseModel):
    """백테스트 설정"""

    symbol: str
    timeframe: str
    startDate: str
    endDate: str
    initialCapital: float
    feeRate: float
    slippage: float
    positionSize: float
    leverage: float | None = 1


class GenerateReportRequest(BaseModel):
    """AI 리포트 생성 요청 (확장)"""

    # 백테스트 결과 요약
    totalReturn: float
    winRate: float
    maxDrawdown: float
    totalTrades: int
    profitTrades: int
    lossTrades: int
    sharpeRatio: float
    profitFactor: float

    # 전략 조건
    buyConditions: list
    sellConditions: list

    # 백테스트 설정 (선택적)
    config: BacktestConfig | None = None

    # 거래내역 (선택적)
    trades: list[TradeRecord] | None = None


class RadarMetrics(BaseModel):
    """레이더 차트용 지표"""

    profitability: float
    winRate: float
    riskManagement: float
    stability: float
    profitFactor: float


class StructuredReportResponse(BaseModel):
    """구조화된 AI 리포트 응답"""

    # 백엔드 계산 (객관적)
    overallScore: int
    grade: str
    radarMetrics: RadarMetrics

    # GPT 분석 (주관적)
    strengths: list[str]
    weaknesses: list[str]
    suggestions: list[str]
    summary: str


@router.post("/ai/generate-report", response_model=StructuredReportResponse)
@limiter.limit("3/minute;15/hour")
async def generate_report(request: Request, body: GenerateReportRequest):
    """
    백테스트 결과를 분석하여 구조화된 AI 리포트 생성

    하이브리드 방식:
    - 점수/지표: 백엔드에서 객관적 공식으로 계산
    - 강점/약점/제안: GPT-4o-mini가 분석

    Rate Limit:
    - 분당 3회, 시간당 15회 (IP 기준)
    """
    from app.services.ai_report import ai_report_service

    # 결과 요약 딕셔너리 생성
    result_summary = {
        "totalReturn": body.totalReturn,
        "winRate": body.winRate,
        "maxDrawdown": body.maxDrawdown,
        "totalTrades": body.totalTrades,
        "profitTrades": body.profitTrades,
        "lossTrades": body.lossTrades,
        "sharpeRatio": body.sharpeRatio,
        "profitFactor": body.profitFactor,
    }

    # 백테스트 설정 딕셔너리
    backtest_config = None
    if body.config:
        backtest_config = {
            "symbol": body.config.symbol,
            "timeframe": body.config.timeframe,
            "startDate": body.config.startDate,
            "endDate": body.config.endDate,
            "initialCapital": body.config.initialCapital,
            "feeRate": body.config.feeRate,
            "slippage": body.config.slippage,
            "positionSize": body.config.positionSize,
            "leverage": body.config.leverage,
        }

    # 거래내역 딕셔너리 리스트
    trades = None
    if body.trades:
        trades = [trade.model_dump() for trade in body.trades]

    try:
        report = await ai_report_service.generate_report(
            result_summary=result_summary,
            buy_conditions=body.buyConditions,
            sell_conditions=body.sellConditions,
            backtest_config=backtest_config,
            trades=trades,
        )
        return StructuredReportResponse(
            overallScore=report["overallScore"],
            grade=report["grade"],
            radarMetrics=RadarMetrics(**report["radarMetrics"]),
            strengths=report["strengths"],
            weaknesses=report["weaknesses"],
            suggestions=report["suggestions"],
            summary=report["summary"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 리포트 생성 실패: {str(e)}") from e
