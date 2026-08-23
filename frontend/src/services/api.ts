// 백엔드 API 서비스 레이어
// FastAPI 백엔드와 통신

import type { SentenceCondition, TradingConfig, TimeFrame, IndicatorSpec } from '../components/backtest/types'

// API 기본 URL
// 개발 환경: http://localhost:8000/api (직접 연결)
// 프로덕션: /api (Nginx 리버스 프록시 사용)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// ============================================
// 타입 정의
// ============================================

/** 자산 정보 */
export interface Asset {
  symbol: string
  base: string
  quote: string
  start_date?: string
  amountPrecision?: number // 수량 소수점 자릿수
  pricePrecision?: number // 가격 소수점 자릿수
  minAmount?: number // 최소 주문량
  minCost?: number // 최소 주문 금액 (USDT)
}

/** OHLCV 캔들 데이터 */
export interface OHLCVCandle {
  timestamp: number
  datetime: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** 거래 내역 */
export interface TradeRecord {
  entryTime: string
  exitTime: string
  entryPrice: number
  exitPrice: number
  pnl: number
  pnlPercent: number
  type: 'long' | 'short'
  fee?: number
  slippage?: number
  size?: number
  runup?: number
  drawdown?: number
  cumulativePnl?: number
  isOpen?: boolean // 미실현 손익 여부
}

/** 수익 곡선 데이터 포인트 */
export interface EquityCurvePoint {
  date: string
  value: number
}

/** 백테스트 요청 */
export interface BacktestRequest {
  symbol: string
  timeframe: TimeFrame
  startDate: string
  endDate: string
  initialCapital: number
  feeRate: number
  slippage: number
  positionSize: number
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
}

/** OHLCV 캔들 데이터 (백테스트 응답용) */
export interface OHLCVData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** 지표 데이터 포인트 */
export interface IndicatorDataPoint {
  timestamp: number
  value: number
}

/** 지표 데이터 */
export interface IndicatorData {
  name: string
  type: 'sma' | 'ema' | 'rsi' | 'macd' | 'bb' | 'stoch'
  period: number
  data: IndicatorDataPoint[]
  // 다중 라인 지표용
  upperBand?: IndicatorDataPoint[]
  lowerBand?: IndicatorDataPoint[]
  signalLine?: IndicatorDataPoint[]
  histogram?: IndicatorDataPoint[]
  kLine?: IndicatorDataPoint[]
  dLine?: IndicatorDataPoint[]
}

/** 백테스트 응답 */
export interface BacktestResponse {
  // 심볼 및 precision 정보
  symbol?: string
  amountPrecision?: number
  pricePrecision?: number

  totalReturn: number
  totalReturnUsdt?: number // 총 수익액 (USDT)
  buyHoldReturn?: number // 같은 기간 보유 수익률 (%)
  buyHoldReturnUsdt?: number // 보유 수익액 (USDT)
  winRate: number
  maxDrawdown: number
  maxDrawdownUsdt?: number // 최대 낙폭액 (USDT)
  totalTrades: number
  profitTrades: number
  lossTrades: number
  sharpeRatio: number
  profitFactor: number
  equityCurve: EquityCurvePoint[]
  trades: TradeRecord[]
  ohlcv: OHLCVData[]
  indicators: IndicatorData[]
}

// ============================================
// API 함수
// ============================================

/**
 * 사용 가능한 코인 목록 조회
 */
export async function fetchAssets(): Promise<Asset[]> {
  const response = await fetch(`${API_BASE_URL}/assets`)

  if (!response.ok) {
    throw new Error(`자산 목록 조회 실패: ${response.statusText}`)
  }

  const data = await response.json()
  return data.assets
}

/**
 * OHLCV 캔들 데이터 조회
 */
export async function fetchOHLCV(
  symbol: string,
  timeframe: TimeFrame = '1d',
  limit = 500,
  startDate?: string,
  endDate?: string
): Promise<OHLCVCandle[]> {
  // 심볼 포맷 변환 (BTC/USDT -> BTC-USDT)
  const formattedSymbol = symbol.replace('/', '-')

  const params = new URLSearchParams({
    timeframe,
    limit: limit.toString(),
  })

  if (startDate) {
    params.append('start_date', startDate)
  }
  if (endDate) {
    params.append('end_date', endDate)
  }

  const response = await fetch(`${API_BASE_URL}/ohlcv/${formattedSymbol}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`OHLCV 데이터 조회 실패: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data
}

/** 작업 제출 응답 */
export interface TaskSubmitResponse {
  task_id: string
  status: string
}

/** 작업 상태 응답 */
export interface TaskStatusResponse {
  task_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  message?: string
  result?: BacktestResponse
  error?: string
}

/**
 * 백테스트 작업 제출
 * 작업 큐에 백테스트를 추가하고 task_id 반환
 */
export async function submitBacktest(params: {
  symbol: string
  timeframe: TimeFrame
  startDate: string
  endDate: string
  initialCapital: number
  tradingConfig: TradingConfig
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
}): Promise<TaskSubmitResponse> {
  const requestBody: BacktestRequest = {
    symbol: params.symbol,
    timeframe: params.timeframe,
    startDate: params.startDate,
    endDate: params.endDate,
    initialCapital: params.initialCapital,
    feeRate: params.tradingConfig.feeRate,
    slippage: params.tradingConfig.slippage,
    positionSize: params.tradingConfig.positionSize,
    buyConditions: params.buyConditions,
    sellConditions: params.sellConditions,
  }

  const response = await fetch(`${API_BASE_URL}/backtest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `백테스트 작업 제출 실패: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 백테스트 작업 상태 조회
 */
export async function getBacktestStatus(taskId: string): Promise<TaskStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/backtest/status/${taskId}`)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `상태 조회 실패: ${response.statusText}`)
  }

  return response.json()
}

/** 사용자가 백테스트를 중지했을 때 던지는 에러. 호출부에서 일반 실패와 구분한다 */
export class BacktestCancelledError extends Error {
  constructor() {
    super('백테스트가 취소되었습니다.')
    this.name = 'BacktestCancelledError'
  }
}

/**
 * 백테스트 작업 취소
 *
 * 대기 중이면 큐에서 빼고, 실행 중이면 워커의 작업 프로세스를 종료시킨다.
 */
/** 취소 요청 실패는 무시한다. 사용자 입장에서는 이미 중지한 것이고 워커는 곧 끝난다 */
function ignoreCancelFailure(): void {
  return undefined
}

export async function cancelBacktest(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/backtest/${taskId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `작업 취소 실패: ${response.statusText}`)
  }
}

/**
 * 백테스트 실행 (작업 제출 + Polling)
 *
 * 작업을 제출하고 완료될 때까지 polling하여 결과 반환
 * @param onStatusUpdate 상태 업데이트 콜백 (선택)
 */
export async function runBacktest(
  params: {
    symbol: string
    timeframe: TimeFrame
    startDate: string
    endDate: string
    initialCapital: number
    tradingConfig: TradingConfig
    buyConditions: SentenceCondition[]
    sellConditions: SentenceCondition[]
  },
  onStatusUpdate?: (status: string, message?: string) => void,
  options?: { signal?: AbortSignal }
): Promise<BacktestResponse> {
  const signal = options?.signal

  // 1. 작업 제출
  const submitResponse = await submitBacktest(params)
  const taskId = submitResponse.task_id

  // 제출 직후 이미 중지됐으면 큐에서 바로 뺀다
  if (signal?.aborted) {
    await cancelBacktest(taskId).catch(ignoreCancelFailure)
    throw new BacktestCancelledError()
  }

  if (onStatusUpdate) {
    onStatusUpdate('pending', '작업이 큐에 추가되었습니다...')
  }

  // 2. Polling으로 완료 대기
  const pollInterval = 500 // 0.5초마다 확인
  const maxWaitTime = 300000 // 최대 5분 대기
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    // 중지 요청이 들어왔으면 서버에 취소를 보내고 빠져나간다.
    // 서버 응답은 기다리지 않는다 - 실패해도 사용자 입장에서는 이미 중지한 것이다
    if (signal?.aborted) {
      cancelBacktest(taskId).catch(ignoreCancelFailure)
      throw new BacktestCancelledError()
    }

    const statusResponse = await getBacktestStatus(taskId)

    if (onStatusUpdate) {
      onStatusUpdate(statusResponse.status, statusResponse.message)
    }

    if (statusResponse.status === 'completed' && statusResponse.result) {
      return statusResponse.result
    }

    if (statusResponse.status === 'failed') {
      throw new Error(statusResponse.error || '백테스트 실행 실패')
    }

    if (statusResponse.status === 'cancelled') {
      throw new BacktestCancelledError()
    }

    // 대기 (중지 요청이 오면 바로 깨어난다)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, pollInterval)
      function onAbort() {
        clearTimeout(timer)
        resolve()
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  // 타임아웃
  throw new Error('백테스트 타임아웃: 5분 이내에 완료되지 않았습니다.')
}

/**
 * 지표 레지스트리 (GET /api/indicators)
 *
 * 지표 선택지·파라미터 슬롯·차트 힌트는 여기서 받는다. 하드코딩하지 않는다.
 */
export async function fetchIndicators(): Promise<IndicatorSpec[]> {
  const response = await fetch(`${API_BASE_URL}/indicators`)
  if (!response.ok) {
    throw new Error(`지표 목록 조회 실패: ${response.statusText}`)
  }
  const data = (await response.json()) as { indicators: IndicatorSpec[] }
  return data.indicators
}

/**
 * 서버 헬스 체크
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    return response.ok
  } catch {
    return false
  }
}

/**
 * AI 전략 변환
 * 자연어 전략 설명을 매수/매도 조건으로 변환
 */
export async function parseAIStrategy(prompt: string): Promise<{
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
}> {
  const response = await fetch(`${API_BASE_URL}/ai/parse-strategy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 429) {
      throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.')
    }
    throw new Error(errorData.detail || `AI 전략 변환 실패: ${response.statusText}`)
  }

  return response.json()
}

/**
 * AI 리포트 생성
 * 백테스트 결과를 분석하여 구조화된 AI 리포트 생성
 */

/** 레이더 차트용 지표 */
export interface RadarMetrics {
  profitability: number
  winRate: number
  riskManagement: number
  stability: number
  profitFactor: number
}

/** 구조화된 AI 리포트 응답 */
export interface StructuredAIReport {
  overallScore: number
  grade: string
  radarMetrics: RadarMetrics
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  summary: string
}

/** 백테스트 설정 */
export interface BacktestConfig {
  symbol: string
  timeframe: string
  startDate: string
  endDate: string
  initialCapital: number
  feeRate: number
  slippage: number
  positionSize: number
  leverage?: number
}

/** AI 리포트 요청 파라미터 */
export interface GenerateAIReportParams {
  totalReturn: number
  winRate: number
  maxDrawdown: number
  totalTrades: number
  profitTrades: number
  lossTrades: number
  sharpeRatio: number
  profitFactor: number
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
  config?: BacktestConfig
  trades?: TradeRecord[]
}

export async function generateAIReport(
  params: GenerateAIReportParams
): Promise<StructuredAIReport> {
  const response = await fetch(`${API_BASE_URL}/ai/generate-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 429) {
      throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.')
    }
    throw new Error(errorData.detail || `AI 리포트 생성 실패: ${response.statusText}`)
  }

  return response.json()
}
