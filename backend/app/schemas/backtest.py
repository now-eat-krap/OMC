# 백테스트 관련 모델 정의
# 요청, 응답, 거래 내역, OHLCV, 지표 데이터

from typing import Literal

from pydantic import BaseModel, Field

from .condition import SentenceCondition


class BacktestRequest(BaseModel):
    """백테스트 요청 모델"""

    # 자산 설정
    symbol: str = Field(..., description="거래쌍 (예: BTC/USDT)")
    timeframe: str = Field(default="1d", description="캔들 시간 간격")
    startDate: str = Field(..., description="시작일 (YYYY-MM-DD)")
    endDate: str = Field(..., description="종료일 (YYYY-MM-DD)")

    # 자본 설정
    initialCapital: float = Field(default=1000000, description="초기 자본금 (USDT)")

    # 거래 설정
    feeRate: float = Field(default=0.1, description="수수료율 (%)")
    slippage: float = Field(default=0.05, description="슬리피지 (%)")
    positionSize: float = Field(default=100, description="포지션 비율 (%)")

    # 매수/매도 조건
    buyConditions: list[SentenceCondition] = Field(default=[], description="매수 조건")
    sellConditions: list[SentenceCondition] = Field(default=[], description="매도 조건")


class TradeRecord(BaseModel):
    """개별 거래 내역"""

    entryTime: str
    exitTime: str
    entryPrice: float
    exitPrice: float
    pnl: float
    pnlPercent: float
    type: Literal["long", "short"] = "long"

    # 추가 필드
    fee: float = Field(default=0, description="총 수수료 (USDT)")
    slippage: float = Field(default=0, description="총 슬리피지 (USDT)")
    entryFee: float = Field(default=0, description="진입 수수료 (USDT)")
    exitFee: float = Field(default=0, description="청산 수수료 (USDT)")
    entrySlippage: float = Field(default=0, description="진입 슬리피지 (USDT)")
    exitSlippage: float = Field(default=0, description="청산 슬리피지 (USDT)")
    size: float = Field(default=0, description="거래 수량")
    runup: float = Field(default=0, description="최대 수익률 (%)")
    drawdown: float = Field(default=0, description="최대 손실률 (%)")
    cumulativePnl: float = Field(default=0, description="누적 손익 (USDT)")
    isOpen: bool = Field(default=False, description="미실현 손익 여부 (열린 포지션)")


class OHLCVData(BaseModel):
    """OHLCV 캔들 데이터"""

    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class IndicatorDataPoint(BaseModel):
    """지표 데이터 포인트"""

    timestamp: int
    value: float


class IndicatorData(BaseModel):
    """지표 데이터 (차트 렌더링용)"""

    name: str = Field(..., description="지표 이름 (예: SMA_20, RSI_14)")
    type: str = Field(..., description="지표 유형 (sma, ema, rsi, macd, bb, stoch)")
    period: int = Field(default=14, description="지표 기간")
    data: list[IndicatorDataPoint] = Field(default=[], description="지표 데이터")

    # 볼린저밴드, MACD 등 다중 라인 지표용
    upperBand: list[IndicatorDataPoint] | None = None
    lowerBand: list[IndicatorDataPoint] | None = None
    signalLine: list[IndicatorDataPoint] | None = None
    histogram: list[IndicatorDataPoint] | None = None

    # 스토캐스틱용
    kLine: list[IndicatorDataPoint] | None = None
    dLine: list[IndicatorDataPoint] | None = None

    # RSI 전용 (과매수/과매도 레벨)
    rsiOverbought: int | None = Field(default=None, description="RSI 과매수선 (예: 70, 80)")
    rsiOversold: int | None = Field(default=None, description="RSI 과매도선 (예: 30, 20)")


class BacktestResult(BaseModel):
    """백테스트 결과 모델"""

    # 심볼 정보
    symbol: str = Field(default="", description="거래쌍 심볼")
    amountPrecision: int = Field(default=4, description="수량 소수점 자릿수")
    pricePrecision: int = Field(default=2, description="가격 소수점 자릿수")

    # 요약 지표
    totalReturn: float = Field(..., description="총 수익률 (%)")
    totalReturnUsdt: float = Field(default=0, description="총 수익액 (USDT)")
    winRate: float = Field(..., description="승률 (%)")
    maxDrawdown: float = Field(..., description="최대 낙폭 (%)")
    maxDrawdownUsdt: float = Field(default=0, description="최대 낙폭액 (USDT)")
    totalTrades: int = Field(..., description="총 거래 수")
    profitTrades: int = Field(..., description="수익 거래 수")
    lossTrades: int = Field(..., description="손실 거래 수")
    sharpeRatio: float | None = Field(
        default=None, description="샤프 비율 (월간 데이터 부족 시 None)"
    )
    profitFactor: float = Field(default=0, description="수익 팩터")

    # 수익 곡선 데이터 (차트용)
    equityCurve: list[dict] = Field(default=[], description="수익 곡선 [{date, value}]")

    # 거래 내역
    trades: list[TradeRecord] = Field(default=[], description="거래 내역")

    # OHLCV 데이터 (차트 렌더링용)
    ohlcv: list[OHLCVData] = Field(default=[], description="OHLCV 캔들 데이터")

    # 사용된 지표 데이터 (차트 오버레이용)
    indicators: list[IndicatorData] = Field(default=[], description="지표 데이터")
