# AI 관련 Pydantic 스키마
# routers/ai.py에서 분리

from pydantic import BaseModel

# =============================================================================
# AI 전략 변환 스키마
# =============================================================================


class ParseStrategyRequest(BaseModel):
    """AI 전략 변환 요청"""

    prompt: str


class ParseStrategyResponse(BaseModel):
    """AI 전략 변환 응답"""

    buyConditions: list
    sellConditions: list


# =============================================================================
# AI 리포트 생성 스키마
# =============================================================================


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
