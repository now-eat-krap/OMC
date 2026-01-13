// 조건 요약 바 컴포넌트
// 화면 하단에 고정되어 현재 조건 요약 및 실행 버튼 표시

import type { ConditionBlock } from './types'
import { INDICATOR_LABELS } from './types'

interface ConditionSummaryBarProps {
  buyConditions: ConditionBlock[]
  sellConditions: ConditionBlock[]
  onOpenPanel: () => void
  onRunBacktest: () => void
  isRunning?: boolean
}

// 조건 블록을 문자열로 변환
const summarizeCondition = (block: ConditionBlock): string => {
  switch (block.type) {
    case 'indicator': {
      const indicator = block.indicator ? INDICATOR_LABELS[block.indicator] : '지표'
      return `${indicator}(${block.params?.period || 14}) ${block.operator} ${block.value}`
    }

    case 'entry_price': {
      const sign = block.value >= 0 ? '+' : ''
      return `진입가 ${block.operator === '>=' ? '익절' : '손절'} ${sign}${block.value}%`
    }

    case 'cross': {
      const crossType = block.operator === 'cross_above' ? '골든' : '데드'
      return `${crossType}크로스 MA(${block.params?.shortPeriod}/${block.params?.longPeriod})`
    }

    default:
      return '조건'
  }
}

export default function ConditionSummaryBar({
  buyConditions,
  sellConditions,
  onOpenPanel,
  onRunBacktest,
  isRunning = false,
}: ConditionSummaryBarProps) {
  const hasBuyConditions = buyConditions.length > 0
  const hasSellConditions = sellConditions.length > 0
  const hasAnyConditions = hasBuyConditions || hasSellConditions

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-gray-900/95 backdrop-blur-md border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* 조건 요약 */}
          <div className="flex-1 flex items-center gap-4 overflow-hidden">
            {/* 매수 조건 */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0">🟢</span>
              {hasBuyConditions ? (
                <div className="flex items-center gap-1 overflow-hidden">
                  {buyConditions.slice(0, 2).map((block, i) => (
                    <span
                      key={block.id}
                      className="px-2 py-1 rounded bg-white/10 text-white text-xs whitespace-nowrap truncate"
                    >
                      {i > 0 && <span className="text-white/40 mr-1">·</span>}
                      {summarizeCondition(block)}
                    </span>
                  ))}
                  {buyConditions.length > 2 && (
                    <span className="text-white/40 text-xs">+{buyConditions.length - 2}</span>
                  )}
                </div>
              ) : (
                <span className="text-white/40 text-xs">매수 조건 없음</span>
              )}
            </div>

            {/* 구분선 */}
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />

            {/* 매도 조건 */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0">🔴</span>
              {hasSellConditions ? (
                <div className="flex items-center gap-1 overflow-hidden">
                  {sellConditions.slice(0, 2).map((block, i) => (
                    <span
                      key={block.id}
                      className="px-2 py-1 rounded bg-white/10 text-white text-xs whitespace-nowrap truncate"
                    >
                      {i > 0 && <span className="text-white/40 mr-1">·</span>}
                      {summarizeCondition(block)}
                    </span>
                  ))}
                  {sellConditions.length > 2 && (
                    <span className="text-white/40 text-xs">+{sellConditions.length - 2}</span>
                  )}
                </div>
              ) : (
                <span className="text-white/40 text-xs">매도 조건 없음</span>
              )}
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* 조건 편집 버튼 */}
            <button
              onClick={onOpenPanel}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
            >
              ⚙️ 조건 편집
            </button>

            {/* 백테스트 실행 버튼 */}
            <button
              onClick={onRunBacktest}
              disabled={!hasAnyConditions || isRunning}
              className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
                hasAnyConditions && !isRunning
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-white/20 text-white/40 cursor-not-allowed'
              }`}
            >
              {isRunning ? '⏳ 실행 중...' : '▶️ 백테스트 실행'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
