// 오른쪽 전략 레일
// 지금 실행 중인 조건과 설정을 항상 보이게 둔다 (기존에는 설정 모달 안에만 있었음)

import type { BacktestResult, SentenceCondition, TimeFrame, TradingConfig } from './types'
import { TIMEFRAME_LABELS } from './types'
import { formatConditionList } from './formatCondition'

interface StrategyRailProps {
  asset: string
  timeFrame: TimeFrame
  startDate: string
  endDate: string
  initialCapital: number
  tradingConfig: TradingConfig
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
  result: BacktestResult | null
  onEdit: () => void
}

/** 구역 제목 */
function RailHeading({ children }: { children: string }) {
  return <span className="text-[13px] font-medium text-muted">{children}</span>
}

/** 라벨 + 값 한 줄 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[13.5px] font-light text-muted">{label}</span>
      <span className="tnum text-right text-[13.5px] text-ink">{value}</span>
    </div>
  )
}

export default function StrategyRail({
  asset,
  timeFrame,
  startDate,
  endDate,
  initialCapital,
  tradingConfig,
  buyConditions,
  sellConditions,
  result,
  onEdit,
}: StrategyRailProps) {
  const hasConditions = buyConditions.length > 0 || sellConditions.length > 0

  return (
    <aside className="flex w-[336px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel">
      {/* 전략 조건 */}
      <div className="flex flex-col gap-5 border-b border-line px-6 py-7">
        <div className="flex items-center justify-between">
          <RailHeading>전략</RailHeading>
          <button
            onClick={onEdit}
            className="border-0 bg-transparent p-0 text-[13px] text-accent hover:opacity-80"
          >
            편집
          </button>
        </div>

        <div className="text-[17px] font-bold tracking-[-0.01em] text-strong">
          {asset} · {TIMEFRAME_LABELS[timeFrame]}
        </div>

        {hasConditions ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <span className="w-8 shrink-0 pt-0.5 text-xs font-semibold text-up">매수</span>
              <span className="flex-1 break-keep text-[14px] font-light leading-[1.85] text-ink">
                {formatConditionList(buyConditions)}
              </span>
            </div>
            <div className="flex items-start gap-4">
              <span className="w-8 shrink-0 pt-0.5 text-xs font-semibold text-down">매도</span>
              <span className="flex-1 break-keep text-[14px] font-light leading-[1.85] text-ink">
                {formatConditionList(sellConditions)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-line px-5 py-7">
            <span className="text-[14px] font-medium text-ink">아직 조건이 없습니다</span>
            <span className="text-[13px] font-light leading-[1.8] text-muted">
              매수나 매도 조건을 하나 이상 세워야 실행할 수 있습니다.
            </span>
            <button
              onClick={onEdit}
              className="mt-1 rounded-chip bg-accent px-4 py-2 text-[13px] font-bold text-accent-ink"
            >
              조건 추가
            </button>
          </div>
        )}
      </div>

      {/* 실행 설정 */}
      <div className="flex flex-col gap-4 border-b border-line px-6 py-7">
        <RailHeading>실행 설정</RailHeading>
        <Row label="기간" value={`${startDate || '상장일'} ~ ${endDate}`} />
        <Row label="초기 자본" value={`${initialCapital.toLocaleString()} USDT`} />
        <Row label="진입 비중" value={`자본의 ${tradingConfig.positionSize}%`} />
        <Row
          label="수수료 / 슬리피지"
          value={`${tradingConfig.feeRate}% / ${tradingConfig.slippage}%`}
        />
        {tradingConfig.leverage > 1 && (
          <Row label="레버리지" value={`${tradingConfig.leverage}x`} />
        )}
      </div>

      {/* 마지막 실행 */}
      <div className="mt-auto flex flex-col gap-4 px-6 py-7">
        <RailHeading>마지막 실행</RailHeading>
        {result ? (
          <>
            <Row label="캔들" value={`${(result.ohlcv?.length ?? 0).toLocaleString()}개`} />
            <Row label="거래" value={`${result.totalTrades}회`} />
            <Row
              label="수익률"
              value={`${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(2)}%`}
            />
          </>
        ) : (
          <span className="text-[13.5px] font-light leading-[1.8] text-muted">
            아직 실행하지 않았습니다. 조건을 세우고 실행을 누르세요.
          </span>
        )}
      </div>
    </aside>
  )
}
