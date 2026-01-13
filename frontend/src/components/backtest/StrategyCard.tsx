// 전략 카드 컴포넌트
// 현재 설정된 전략 요약을 컴팩트하게 표시

import type { ConditionBlock, TimeFrame } from './types'
import { INDICATOR_LABELS, TIMEFRAME_LABELS } from './types'

interface StrategyCardProps {
  asset: string
  timeFrame: TimeFrame
  buyConditions: ConditionBlock[]
  sellConditions: ConditionBlock[]
  initialCapital: number
  onEdit: () => void
}

// 조건 요약 텍스트 생성
const summarizeConditions = (conditions: ConditionBlock[]): string => {
  if (conditions.length === 0) {
    return '없음'
  }

  const summaries = conditions.slice(0, 2).map((c) => {
    if (c.type === 'indicator' && c.indicator) {
      return `${INDICATOR_LABELS[c.indicator].split(' ')[0]} ${c.operator} ${c.value}`
    }
    if (c.type === 'cross') {
      return c.operator === 'cross_above' ? '골든크로스' : '데드크로스'
    }
    if (c.type === 'entry_price') {
      return `${c.operator === '>=' ? '익절' : '손절'} ${c.value}%`
    }
    return '조건'
  })

  const extra = conditions.length > 2 ? ` +${conditions.length - 2}` : ''
  return summaries.join(', ') + extra
}

export default function StrategyCard({
  asset,
  timeFrame,
  buyConditions,
  sellConditions,
  initialCapital,
  onEdit,
}: StrategyCardProps) {
  const hasConditions = buyConditions.length > 0 || sellConditions.length > 0

  return (
    <div
      onClick={onEdit}
      className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all group"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/60">📊 전략</h3>
        <span className="text-xs text-white/40 group-hover:text-white transition-colors">
          클릭하여 수정 →
        </span>
      </div>

      {/* 자산 & 시간 간격 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-1 rounded bg-white/10 text-white text-sm font-medium">
          {asset}
        </span>
        <span className="px-2 py-1 rounded bg-white/10 text-white text-xs">
          {TIMEFRAME_LABELS[timeFrame]}
        </span>
        <span className="px-2 py-1 rounded bg-white/5 text-white/60 text-xs">
          ${initialCapital.toLocaleString()}
        </span>
      </div>

      {/* 조건 요약 */}
      {hasConditions ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs">🟢</span>
            <span className="text-xs text-white/80 truncate">
              {summarizeConditions(buyConditions)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">🔴</span>
            <span className="text-xs text-white/80 truncate">
              {summarizeConditions(sellConditions)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/40">조건을 설정해주세요</p>
      )}
    </div>
  )
}
