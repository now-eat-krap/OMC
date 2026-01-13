// 개별 조건 블록 컴포넌트
// 지표, 연산자, 값 설정 UI

import { BarChart3, Coins, Repeat, Box, X } from 'lucide-react'
import type { ConditionBlock, IndicatorType, ComparisonOperator } from './types'
import { INDICATOR_LABELS } from './types'

interface ConditionBlockItemProps {
  block: ConditionBlock
  onChange: (block: ConditionBlock) => void
  onDelete: () => void
}

// 비교 연산자 레이블
const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  '>': '보다 큼 (>)',
  '<': '보다 작음 (<)',
  '>=': '이상 (≥)',
  '<=': '이하 (≤)',
  '==': '같음 (=)',
  cross_above: '상향 돌파 ↗',
  cross_below: '하향 돌파 ↘',
}

export default function ConditionBlockItem({ block, onChange, onDelete }: ConditionBlockItemProps) {
  const handleIndicatorChange = (indicator: IndicatorType) => {
    onChange({ ...block, indicator })
  }

  const handleOperatorChange = (operator: ComparisonOperator) => {
    onChange({ ...block, operator })
  }

  const handleValueChange = (value: number) => {
    onChange({ ...block, value })
  }

  const handleParamChange = (key: string, value: number) => {
    onChange({
      ...block,
      params: { ...block.params, [key]: value },
    })
  }

  // 블록 타입별 렌더링
  const renderBlockContent = () => {
    switch (block.type) {
      case 'indicator':
        return (
          <div className="space-y-3">
            {/* 지표 선택 */}
            <div className="flex gap-2">
              <select
                value={block.indicator || 'RSI'}
                onChange={(e) => handleIndicatorChange(e.target.value as IndicatorType)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
              >
                {Object.entries(INDICATOR_LABELS).map(([key, label]) => (
                  <option key={key} value={key} className="bg-gray-900">
                    {label}
                  </option>
                ))}
              </select>

              {/* 지표 파라미터 (기간) */}
              <input
                type="number"
                value={block.params?.period || 14}
                onChange={(e) => handleParamChange('period', Number(e.target.value))}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none text-center"
                placeholder="기간"
              />
            </div>

            {/* 비교 연산자 + 값 */}
            <div className="flex gap-2">
              <select
                value={block.operator}
                onChange={(e) => handleOperatorChange(e.target.value as ComparisonOperator)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
              >
                {Object.entries(OPERATOR_LABELS).map(([key, label]) => (
                  <option key={key} value={key} className="bg-gray-900">
                    {label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={block.value}
                onChange={(e) => handleValueChange(Number(e.target.value))}
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none text-center"
                placeholder="값"
              />
            </div>
          </div>
        )

      case 'entry_price':
        return (
          <div className="space-y-3">
            <p className="text-sm text-white/60">진입가 대비</p>
            <div className="flex gap-2 items-center">
              <select
                value={block.operator}
                onChange={(e) => handleOperatorChange(e.target.value as ComparisonOperator)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
              >
                <option value=">=" className="bg-gray-900">
                  이상 (익절)
                </option>
                <option value="<=" className="bg-gray-900">
                  이하 (손절)
                </option>
              </select>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={block.value}
                  onChange={(e) => handleValueChange(Number(e.target.value))}
                  className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none text-center"
                  step={1}
                />
                <span className="text-white/60">%</span>
              </div>
            </div>
          </div>
        )

      case 'cross':
        return (
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={block.operator}
                onChange={(e) => handleOperatorChange(e.target.value as ComparisonOperator)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
              >
                <option value="cross_above" className="bg-gray-900">
                  골든크로스 (상향돌파)
                </option>
                <option value="cross_below" className="bg-gray-900">
                  데드크로스 (하향돌파)
                </option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-white/40">단기 MA</label>
                <input
                  type="number"
                  value={block.params?.shortPeriod || 5}
                  onChange={(e) => handleParamChange('shortPeriod', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none text-center"
                />
              </div>
              <div>
                <label className="text-xs text-white/40">장기 MA</label>
                <input
                  type="number"
                  value={block.params?.longPeriod || 20}
                  onChange={(e) => handleParamChange('longPeriod', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none text-center"
                />
              </div>
            </div>
          </div>
        )

      default:
        return <p className="text-white/40 text-sm">지원하지 않는 블록 타입</p>
    }
  }

  // 블록 타입 레이블
  const getBlockTypeLabel = () => {
    switch (block.type) {
      case 'indicator':
        return { icon: <BarChart3 className="w-3.5 h-3.5" />, label: '지표' }
      case 'entry_price':
        return { icon: <Coins className="w-3.5 h-3.5" />, label: '진입가 대비' }
      case 'cross':
        return { icon: <Repeat className="w-3.5 h-3.5" />, label: '크로스' }
      default:
        return { icon: <Box className="w-3.5 h-3.5" />, label: '조건' }
    }
  }

  const blockTypeInfo = getBlockTypeLabel()

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      {/* 블록 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-white/60">
          {blockTypeInfo.icon}
          {blockTypeInfo.label}
        </span>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 블록 콘텐츠 */}
      {renderBlockContent()}
    </div>
  )
}
