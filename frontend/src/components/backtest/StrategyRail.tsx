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

/** 라벨 + 값 한 줄 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 border-b border-hair last:border-b-0">
      <span className="text-[13px] text-muted shrink-0">{label}</span>
      <span className="font-mono tnum text-[12.5px] text-ink text-right">{value}</span>
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
    <aside className="w-[320px] shrink-0 border-l border-line bg-panel flex flex-col overflow-y-auto">
      {/* 전략 조건 */}
      <div className="px-5 py-5 border-b border-line flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="label">STRATEGY</span>
          <button
            onClick={onEdit}
            className="bg-transparent border-0 p-0 text-[12.5px] text-accent hover:opacity-80"
          >
            편집
          </button>
        </div>

        <div className="text-[17px] font-semibold tracking-[-0.01em] text-strong">
          {asset} · {TIMEFRAME_LABELS[timeFrame]}
        </div>

        {hasConditions ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3 items-start">
              <span className="w-[34px] shrink-0 pt-0.5 font-mono text-[10px] tracking-[0.16em] text-up">
                BUY
              </span>
              <span className="flex-1 text-[13.5px] leading-[1.8] text-ink break-keep">
                {formatConditionList(buyConditions)}
              </span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-[34px] shrink-0 pt-0.5 font-mono text-[10px] tracking-[0.16em] text-down">
                SELL
              </span>
              <span className="flex-1 text-[13.5px] leading-[1.8] text-ink break-keep">
                {formatConditionList(sellConditions)}
              </span>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-line px-4 py-6 flex flex-col gap-2 items-start">
            <span className="font-mono text-[11px] tracking-[0.2em] text-dim">NO CONDITION</span>
            <span className="text-[13px] leading-[1.7] text-muted">
              조건을 하나도 세우지 않으면 실행할 수 없습니다.
            </span>
            <button
              onClick={onEdit}
              className="mt-1 bg-accent text-accent-ink text-[12.5px] font-semibold px-4 py-2"
            >
              조건 추가
            </button>
          </div>
        )}
      </div>

      {/* 실행 설정 */}
      <div className="px-5 py-5 border-b border-line flex flex-col">
        <span className="label pb-2">SETTINGS</span>
        <Row label="기간" value={`${startDate || '상장일'} → ${endDate}`} />
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

      {/* 마지막 실행 정보 */}
      <div className="px-5 py-5 flex flex-col mt-auto">
        <span className="label pb-2">LAST RUN</span>
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
          <span className="text-[13px] leading-[1.7] text-muted">
            아직 실행하지 않았습니다. 조건을 세우고 RUN을 누르세요.
          </span>
        )}
      </div>
    </aside>
  )
}
