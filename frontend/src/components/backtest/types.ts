// 백테스팅 관련 타입 정의
// 조건 블록, 전략 설정, 거래 설정 등

// 캔들 시간 간격 타입
export type TimeFrame = '15m' | '1h' | '4h' | '1d' | '1w' | '1M'

// 거래 설정 타입
export interface TradingConfig {
  feeRate: number // 수수료 (%, 기본 0.1)
  slippage: number // 슬리피지 (%, 기본 0.05)
  positionSize: number // 포지션 비율 (%, 기본 100)
  leverage: number // 레버리지 (1~10, 기본 1)
}

// 지표 타입
// 지표 이름. 목록은 서버 레지스트리(GET /api/indicators)가 정한다.
// 여기 나열한 건 타입 힌트용이고, 새 지표가 추가되면 string 으로 들어온다
export type IndicatorType = 'RSI' | 'MACD' | 'SMA' | 'EMA' | 'BB' | 'KELTNER' | 'ENVELOPE' | 'STOCH' | (string & {})

// 서버 레지스트리의 지표 정의 (GET /api/indicators)
export interface IndicatorParamSpec {
  name: string
  label: string
  default: number
  min: number
  max: number
  step: number
  integer: boolean
}
export interface IndicatorOutputSpec {
  key: string
  label: string
  role: 'line' | 'band_upper' | 'band_middle' | 'band_lower' | 'signal' | 'histogram' | 'k' | 'd'
}
export interface IndicatorSpec {
  name: string
  label: string
  description: string
  display: 'overlay' | 'pane'
  valueRange: [number, number] | null
  templates: string[]
  bandType: string | null
  params: IndicatorParamSpec[]
  outputs: IndicatorOutputSpec[]
}

// 비교 연산자 타입
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | 'cross_above' | 'cross_below'

// 조건 블록 타입
export type ConditionBlockType =
  | 'indicator' // 지표 기반 (RSI, MACD 등)
  | 'price' // 가격 기반 (현재가, 이동평균 등)
  | 'entry_price' // 진입가 대비 (손절/익절용)
  | 'cross' // 크로스 (골든크로스, 데드크로스)
  | 'time' // 시간 기반 (보유 기간 등)

// 조건 블록 정의
export interface ConditionBlock {
  id: string
  type: ConditionBlockType
  indicator?: IndicatorType
  operator: ComparisonOperator
  value: number
  // 지표 파라미터 (예: RSI 기간, MA 기간 등)
  params?: Record<string, number>
  // 진입가 대비 조건용 (예: 진입가 대비 -5%)
  entryPricePercent?: number
}

// 전략 설정 타입
export interface StrategyConfig {
  // 자산 설정
  asset: string // 예: 'BTC/USDT'
  period: {
    start: Date
    end: Date
  }
  timeFrame: TimeFrame
  initialCapital: number

  // 거래 설정
  tradingConfig: TradingConfig

  // 매수/매도 조건
  buyConditions: ConditionBlock[]
  sellConditions: ConditionBlock[]

  // 조건 간 논리 연산자
  buyLogicOperator: 'AND' | 'OR'
  sellLogicOperator: 'AND' | 'OR'
}

// OHLCV 캔들 데이터 (차트 렌더링용)
export interface OHLCVData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// 지표 데이터 포인트
export interface IndicatorDataPoint {
  timestamp: number
  value: number
}

// 지표 데이터 (차트 오버레이용)
export interface IndicatorData {
  name: string
  // 옛 표시 힌트. 새 코드는 display/역할별 배열 유무로 그린다
  type: 'sma' | 'ema' | 'rsi' | 'macd' | 'bb' | 'stoch' | (string & {})
  period: number
  data: IndicatorDataPoint[]
  // 레지스트리 메타 (백엔드 #49 이후)
  indicator?: string
  params?: Record<string, number>
  display?: 'overlay' | 'pane'
  valueRange?: [number, number] | null
  levels?: number[] | null
  // 다중 라인 지표용
  upperBand?: IndicatorDataPoint[]
  lowerBand?: IndicatorDataPoint[]
  signalLine?: IndicatorDataPoint[]
  histogram?: IndicatorDataPoint[]
  kLine?: IndicatorDataPoint[]
  dLine?: IndicatorDataPoint[]
  // RSI 전용 (과매수/과매도 레벨)
  rsiOverbought?: number // 과매수선 (기본 70)
  rsiOversold?: number // 과매도선 (기본 30)
}

// 백테스팅 결과 타입
export interface BacktestResult {
  // 심볼 및 precision 정보
  symbol?: string // 거래쌍 심볼
  amountPrecision?: number // 수량 소수점 자릿수
  pricePrecision?: number // 가격 소수점 자릿수

  totalReturn: number // 총 수익률 (%)
  totalReturnUsdt?: number // 총 수익액 (USDT)
  buyHoldReturn?: number // 같은 기간 첫 봉 시가에 전액 매수해 들고 있었을 때 수익률 (%)
  buyHoldReturnUsdt?: number // 보유 수익액 (USDT)
  winRate: number // 승률 (%)
  maxDrawdown: number // 최대 낙폭 (%)
  maxDrawdownUsdt?: number // 최대 낙폭액 (USDT)
  totalTrades: number // 총 거래 수
  profitTrades: number // 수익 거래 수
  lossTrades: number // 손실 거래 수
  sharpeRatio: number | null // 샤프 비율 (월간 데이터 부족 시 null)
  profitFactor: number // 수익 팩터
  // 수익 곡선 데이터 (차트용)
  equityCurve?: { date: string; value: number }[]
  // 거래 내역
  trades?: TradeRecord[]
  // OHLCV 데이터 (차트 렌더링용)
  ohlcv?: OHLCVData[]
  // 사용된 지표 데이터 (차트 오버레이용)
  indicators?: IndicatorData[]
}

// 개별 거래 내역 (백엔드 응답과 일치)
export interface TradeRecord {
  entryTime: string
  exitTime: string
  entryPrice: number
  exitPrice: number
  pnl: number // 손익
  pnlPercent: number // 손익률 (%)
  type: 'long' | 'short'
  // 추가 필드
  fee?: number // 총 수수료 (USDT)
  slippage?: number // 총 슬리피지 (USDT)
  entryFee?: number // 진입 수수료 (USDT)
  exitFee?: number // 청산 수수료 (USDT)
  entrySlippage?: number // 진입 슬리피지 (USDT)
  exitSlippage?: number // 청산 슬리피지 (USDT)
  size?: number // 거래 수량
  runup?: number // 최대 수익률 (%)
  drawdown?: number // 최대 손실률 (%)
  cumulativePnl?: number // 누적 손익 (USDT)
  isOpen?: boolean // 미실현 손익 여부 (열린 포지션)
}

// 기본값
export const DEFAULT_TRADING_CONFIG: TradingConfig = {
  feeRate: 0.1,
  slippage: 0.05,
  positionSize: 100,
  leverage: 1,
}

// 지표 표시 이름 (옛 블록형 UI 용. 문장형 UI 는 서버 레지스트리의 label 을 쓴다)
export const INDICATOR_LABELS: Record<string, string> = {
  RSI: 'RSI (상대강도지수)',
  MACD: 'MACD',
  SMA: 'SMA (단순이동평균)',
  EMA: 'EMA (지수이동평균)',
  BB: '볼린저밴드',
  KELTNER: '켈트너채널',
  ENVELOPE: '엔벨로프',
  STOCH: '스토캐스틱',
}

// 시간 간격 표시 이름
export const TIMEFRAME_LABELS: Record<TimeFrame, string> = {
  '15m': '15분',
  '1h': '1시간',
  '4h': '4시간',
  '1d': '1일',
  '1w': '1주',
  '1M': '1달',
}

// ============================================
// 문장형 조건 빌더 타입
// ============================================

// 문장 템플릿 타입
export type SentenceTemplateType =
  | 'indicator_vs_value' // RSI가 30보다 작을 때
  | 'indicator_cross' // MA(5)가 MA(20)을 돌파할 때
  | 'price_cross' // 종가가 MA(20)을 돌파할 때
  | 'profit_loss' // 진입가 대비 10% 이상일 때
  | 'band_touch' // 저가가 볼린저밴드 하단에 터치할 때
  | 'macd_signal' // MACD가 시그널선을 돌파할 때
  | 'stochastic' // %K가 %D를 돌파할 때
  | 'candle_pattern' // 망치형 캔들 출현
  | 'volume' // 거래량이 평균의 2배 이상
  | 'price_change' // 전일 대비 5% 이상 상승

// 문장 조건 인터페이스
export interface SentenceCondition {
  id: string
  templateType: SentenceTemplateType
  // 기본 슬롯
  indicator?: IndicatorType
  indicatorPeriod?: number // 옛 필드. params 가 없을 때 첫 파라미터(기간)로 해석된다
  targetIndicator?: IndicatorType
  targetPeriod?: number // 옛 필드
  // 지표 파라미터. 키는 서버 레지스트리가 정한다 (RSI {period}, MACD {fast,slow,signal} ...)
  params?: Record<string, number>
  targetParams?: Record<string, number> // indicator_cross 의 상대 지표용
  comparison?: 'gt' | 'lt' | 'gte' | 'lte'
  crossDirection?: 'above' | 'below'
  value?: number
  priceType?: 'close' | 'high' | 'low' | 'open'
  profitDirection?: 'profit' | 'loss'
  // 밴드 터치용
  bandType?: 'bollinger' | 'keltner' | 'envelope'
  bandPosition?: 'upper' | 'middle' | 'lower'
  touchType?: 'touch' | 'cross' | 'exit'
  // MACD/스토캐스틱용
  macdType?: 'macd_line' | 'signal_line' | 'histogram'
  stochType?: 'k' | 'd'
  // 캔들 패턴용
  candlePattern?:
    | 'hammer'
    | 'shooting_star'
    | 'doji'
    | 'engulfing_bull'
    | 'engulfing_bear'
    | 'morning_star'
    | 'evening_star'
  // 거래량용
  volumeMultiplier?: number
  volumePeriod?: number
  // 가격 변동용
  priceChangePercent?: number
  priceChangeDirection?: 'up' | 'down'
  // 다음 조건과의 논리 연산자
  nextOperator?: 'AND' | 'OR'
}

// 비교 연산자 라벨
export const COMPARISON_LABELS: Record<string, string> = {
  gt: '클 때',
  lt: '작을 때',
  gte: '이상일 때',
  lte: '이하일 때',
}

// 가격 타입 라벨
export const PRICE_TYPE_LABELS: Record<string, string> = {
  close: '종가',
  high: '고가',
  low: '저가',
  open: '시가',
}

// 크로스 방향 라벨
export const CROSS_DIRECTION_LABELS: Record<string, string> = {
  above: '상향',
  below: '하향',
}

// 수익/손실 방향 라벨
export const PROFIT_DIRECTION_LABELS: Record<string, string> = {
  profit: '이상',
  loss: '이하',
}

// 밴드 타입 라벨
export const BAND_TYPE_LABELS: Record<string, string> = {
  bollinger: '볼린저밴드',
  keltner: '켈트너채널',
  envelope: '엔벨로프',
}

// 밴드 위치 라벨
export const BAND_POSITION_LABELS: Record<string, string> = {
  upper: '상단',
  middle: '중간',
  lower: '하단',
}

// 터치 타입 라벨
export const TOUCH_TYPE_LABELS: Record<string, string> = {
  touch: '터치',
  cross: '돌파',
  exit: '이탈',
}

// 캔들 패턴 라벨
export const CANDLE_PATTERN_LABELS: Record<string, string> = {
  hammer: '망치형',
  shooting_star: '유성형',
  doji: '도지',
  engulfing_bull: '상승 장악형',
  engulfing_bear: '하락 장악형',
  morning_star: '샛별형',
  evening_star: '석별형',
}

// 가격 변동 방향 라벨
export const PRICE_CHANGE_DIRECTION_LABELS: Record<string, string> = {
  up: '상승',
  down: '하락',
}

// 고유 ID 생성 유틸
export const generateConditionId = () =>
  `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
