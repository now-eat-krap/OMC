// 문장형 조건 컴포넌트
// 드롭다운 슬롯을 문장 구조에 배치하여 자연어처럼 조건 설정

import { X, ChevronDown, Check } from 'lucide-react'
import * as Select from '@radix-ui/react-select'
import type { SentenceCondition as SentenceConditionType, IndicatorType } from './types'
import {
  COMPARISON_LABELS,
  PRICE_TYPE_LABELS,
  CROSS_DIRECTION_LABELS,
  PROFIT_DIRECTION_LABELS,
  BAND_TYPE_LABELS,
  BAND_POSITION_LABELS,
  TOUCH_TYPE_LABELS,
  CANDLE_PATTERN_LABELS,
  PRICE_CHANGE_DIRECTION_LABELS,
} from './types'

interface SentenceConditionProps {
  condition: SentenceConditionType
  onChange: (condition: SentenceConditionType) => void
  onDelete: () => void
}

// Radix UI Select 기반 드롭다운 컴포넌트 - 모노톤 컴팩트
function SlotDropdown({
  value,
  options,
  onChange,
}: {
  value: string | number
  options: { value: string | number; label: string }[]
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <Select.Root value={String(value)} onValueChange={onChange}>
      <Select.Trigger
        className="inline-flex items-center justify-between gap-1 px-2 py-1 min-w-[70px] bg-raise border border-line 
                   text-ink font-medium text-xs cursor-pointer
                   hover:bg-raise hover:border-line
                   focus:outline-none focus:ring-1 focus:ring-white/30
                   transition-all duration-150
                   data-[placeholder]:text-dim"
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="w-3 h-3 text-muted" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="overflow-hidden bg-panel backdrop-blur-xl border border-line z-[100]"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="p-0.5">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={String(opt.value)}
                className="relative flex items-center px-2 py-1.5 pr-6 rounded text-xs text-muted cursor-pointer select-none outline-none
                           data-[highlighted]:bg-raise data-[highlighted]:text-strong
                           data-[state=checked]:text-strong data-[state=checked]:font-medium
 transition-colors"
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-1.5">
                  <Check className="w-3 h-3 text-muted" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

// 숫자 입력 슬롯 컴포넌트 - 모노톤 컴팩트
function NumberSlot({
  value,
  onChange,
  min,
  max,
  step = 1,
  className = '',
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      className={`w-14 px-2 py-1 text-center bg-raise border border-line 
                  text-ink font-medium text-xs
                  hover:bg-raise hover:border-line
                  focus:outline-none focus:ring-1 focus:ring-white/30
                  transition-all duration-150
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                  ${className}`}
    />
  )
}

// 각종 옵션 정의

// 값 비교에 적합한 지표만 (RSI만 - 다른 지표는 별도 템플릿 사용)
const indicatorOptionsForValue = [{ value: 'RSI', label: 'RSI' }]

// 크로스 비교에 적합한 지표 (이동평균)
const indicatorOptionsForCross = [
  { value: 'SMA', label: 'SMA' },
  { value: 'EMA', label: 'EMA' },
]

const comparisonOptions = Object.entries(COMPARISON_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const priceTypeOptions = Object.entries(PRICE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const crossDirectionOptions = Object.entries(CROSS_DIRECTION_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const profitDirectionOptions = Object.entries(PROFIT_DIRECTION_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const bandTypeOptions = Object.entries(BAND_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const bandPositionOptions = Object.entries(BAND_POSITION_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const touchTypeOptions = Object.entries(TOUCH_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const candlePatternOptions = Object.entries(CANDLE_PATTERN_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const priceChangeDirectionOptions = Object.entries(PRICE_CHANGE_DIRECTION_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  })
)

export default function SentenceCondition({
  condition,
  onChange,
  onDelete,
}: SentenceConditionProps) {
  const updateSlot = <K extends keyof SentenceConditionType>(
    key: K,
    value: SentenceConditionType[K]
  ) => {
    onChange({ ...condition, [key]: value })
  }

  const renderSentence = () => {
    switch (condition.templateType) {
      // 1. 지표 vs 값: "RSI(14)가 30보다 작을 때"
      case 'indicator_vs_value':
        return (
          <>
            <SlotDropdown
              value={condition.indicator || 'RSI'}
              options={indicatorOptionsForValue}
              onChange={(v) => updateSlot('indicator', v as IndicatorType)}
            />
            <span className="text-dim text-sm font-light">(</span>
            <NumberSlot
              value={condition.indicatorPeriod || 14}
              onChange={(v) => updateSlot('indicatorPeriod', v)}
              min={1}
              max={200}
            />
            <span className="text-dim text-sm font-light">)</span>
            <span className="text-muted text-sm font-medium px-1">가</span>
            <NumberSlot
              value={condition.value || 30}
              onChange={(v) => updateSlot('value', v)}
              min={0}
              max={1000}
            />
            <span className="text-muted text-sm font-medium px-1">보다</span>
            <SlotDropdown
              value={condition.comparison || 'lt'}
              options={comparisonOptions}
              onChange={(v) => updateSlot('comparison', v as 'gt' | 'lt' | 'gte' | 'lte')}
            />
          </>
        )

      // 2. 지표 크로스: "MA(5)가 MA(20)을 상향 돌파할 때"
      case 'indicator_cross':
        return (
          <>
            <SlotDropdown
              value={condition.indicator || 'SMA'}
              options={indicatorOptionsForCross}
              onChange={(v) => updateSlot('indicator', v as IndicatorType)}
            />
            <span className="text-muted">(</span>
            <NumberSlot
              value={condition.indicatorPeriod || 5}
              onChange={(v) => updateSlot('indicatorPeriod', v)}
              min={1}
              max={200}
            />
            <span className="text-muted">)</span>
            <span className="text-ink">가</span>
            <SlotDropdown
              value={condition.targetIndicator || 'SMA'}
              options={indicatorOptionsForCross}
              onChange={(v) => updateSlot('targetIndicator', v as IndicatorType)}
            />
            <span className="text-muted">(</span>
            <NumberSlot
              value={condition.targetPeriod || 20}
              onChange={(v) => updateSlot('targetPeriod', v)}
              min={1}
              max={200}
            />
            <span className="text-muted">)</span>
            <span className="text-ink">을</span>
            <SlotDropdown
              value={condition.crossDirection || 'above'}
              options={crossDirectionOptions}
              onChange={(v) => updateSlot('crossDirection', v as 'above' | 'below')}
            />
            <span className="text-ink">돌파할 때</span>
          </>
        )

      // 3. 가격 돌파: "종가가 MA(20)을 상향 돌파할 때"
      case 'price_cross':
        return (
          <>
            <SlotDropdown
              value={condition.priceType || 'close'}
              options={priceTypeOptions}
              onChange={(v) => updateSlot('priceType', v as 'close' | 'high' | 'low' | 'open')}
            />
            <span className="text-ink">가</span>
            <SlotDropdown
              value={condition.targetIndicator || 'SMA'}
              options={indicatorOptionsForCross}
              onChange={(v) => updateSlot('targetIndicator', v as IndicatorType)}
            />
            <span className="text-muted">(</span>
            <NumberSlot
              value={condition.targetPeriod || 20}
              onChange={(v) => updateSlot('targetPeriod', v)}
              min={1}
              max={200}
            />
            <span className="text-muted">)</span>
            <span className="text-ink">을</span>
            <SlotDropdown
              value={condition.crossDirection || 'above'}
              options={crossDirectionOptions}
              onChange={(v) => updateSlot('crossDirection', v as 'above' | 'below')}
            />
            <span className="text-ink">돌파할 때</span>
          </>
        )

      // 4. 수익/손실: "현재가가 진입가 대비 10% 이상일 때"
      case 'profit_loss':
        return (
          <>
            <span className="text-ink">현재가가 진입가 대비</span>
            <NumberSlot
              value={condition.value || 10}
              onChange={(v) => updateSlot('value', v)}
              min={-100}
              max={1000}
              step={0.5}
            />
            <span className="text-ink">%</span>
            <SlotDropdown
              value={condition.profitDirection || 'profit'}
              options={profitDirectionOptions}
              onChange={(v) => updateSlot('profitDirection', v as 'profit' | 'loss')}
            />
          </>
        )

      // 5. 밴드 터치: "저가가 볼린저밴드 하단에 터치할 때"
      case 'band_touch':
        return (
          <>
            <SlotDropdown
              value={condition.priceType || 'low'}
              options={priceTypeOptions}
              onChange={(v) => updateSlot('priceType', v as 'close' | 'high' | 'low' | 'open')}
            />
            <span className="text-ink">가</span>
            <SlotDropdown
              value={condition.bandType || 'bollinger'}
              options={bandTypeOptions}
              onChange={(v) => updateSlot('bandType', v as 'bollinger' | 'keltner' | 'envelope')}
            />
            <span className="text-muted">(</span>
            <NumberSlot
              value={condition.indicatorPeriod || 20}
              onChange={(v) => updateSlot('indicatorPeriod', v)}
              min={1}
              max={200}
            />
            <span className="text-muted">)</span>
            <SlotDropdown
              value={condition.bandPosition || 'lower'}
              options={bandPositionOptions}
              onChange={(v) => updateSlot('bandPosition', v as 'upper' | 'middle' | 'lower')}
            />
            <span className="text-ink">에</span>
            <SlotDropdown
              value={condition.touchType || 'touch'}
              options={touchTypeOptions}
              onChange={(v) => updateSlot('touchType', v as 'touch' | 'cross' | 'exit')}
            />
            <span className="text-ink">할 때</span>
          </>
        )

      // 6. MACD 시그널: "MACD가 시그널선을 상향 돌파할 때"
      case 'macd_signal':
        return (
          <>
            <span className="text-ink">MACD가 시그널선을</span>
            <SlotDropdown
              value={condition.crossDirection || 'above'}
              options={crossDirectionOptions}
              onChange={(v) => updateSlot('crossDirection', v as 'above' | 'below')}
            />
            <span className="text-ink">돌파할 때</span>
          </>
        )

      // 7. 스토캐스틱: "%K가 %D를 상향 돌파할 때"
      case 'stochastic':
        return (
          <>
            <span className="text-ink">스토캐스틱</span>
            <span className="text-muted">(</span>
            <NumberSlot
              value={condition.indicatorPeriod || 14}
              onChange={(v) => updateSlot('indicatorPeriod', v)}
              min={1}
              max={200}
            />
            <span className="text-muted">)</span>
            <span className="text-ink">%K가 %D를</span>
            <SlotDropdown
              value={condition.crossDirection || 'above'}
              options={crossDirectionOptions}
              onChange={(v) => updateSlot('crossDirection', v as 'above' | 'below')}
            />
            <span className="text-ink">돌파할 때</span>
          </>
        )

      // 8. 캔들 패턴: "망치형 캔들이 출현할 때"
      case 'candle_pattern':
        return (
          <>
            <SlotDropdown
              value={condition.candlePattern || 'hammer'}
              options={candlePatternOptions}
              onChange={(v) =>
                updateSlot(
                  'candlePattern',
                  v as
                    | 'hammer'
                    | 'shooting_star'
                    | 'doji'
                    | 'engulfing_bull'
                    | 'engulfing_bear'
                    | 'morning_star'
                    | 'evening_star'
                )
              }
            />
            <span className="text-ink">캔들이 출현할 때</span>
          </>
        )

      // 9. 거래량: "거래량이 20일 평균의 2배 이상일 때"
      case 'volume':
        return (
          <>
            <span className="text-ink">거래량이</span>
            <NumberSlot
              value={condition.volumePeriod || 20}
              onChange={(v) => updateSlot('volumePeriod', v)}
              min={1}
              max={200}
            />
            <span className="text-ink">일 평균의</span>
            <NumberSlot
              value={condition.volumeMultiplier || 2}
              onChange={(v) => updateSlot('volumeMultiplier', v)}
              min={0.1}
              max={10}
              step={0.1}
            />
            <span className="text-ink">배</span>
            <SlotDropdown
              value={condition.comparison || 'gte'}
              options={comparisonOptions}
              onChange={(v) => updateSlot('comparison', v as 'gt' | 'lt' | 'gte' | 'lte')}
            />
          </>
        )

      // 10. 가격 변동: "전일 대비 5% 이상 상승할 때"
      case 'price_change':
        return (
          <>
            <span className="text-ink">전일 대비</span>
            <NumberSlot
              value={condition.priceChangePercent || 5}
              onChange={(v) => updateSlot('priceChangePercent', v)}
              min={0}
              max={100}
              step={0.5}
            />
            <span className="text-ink">% 이상</span>
            <SlotDropdown
              value={condition.priceChangeDirection || 'up'}
              options={priceChangeDirectionOptions}
              onChange={(v) => updateSlot('priceChangeDirection', v as 'up' | 'down')}
            />
            <span className="text-ink">할 때</span>
          </>
        )

      default:
        return <span className="text-dim">알 수 없는 조건</span>
    }
  }

  return (
    <div
      className="group flex items-center gap-1.5 px-3 py-2 bg-raise border border-line  
                    hover:bg-line hover:border-line
                    transition-all duration-150"
    >
      <div className="flex items-center gap-1 flex-wrap flex-1 text-muted text-xs">
        {renderSentence()}
      </div>
      <button
        onClick={onDelete}
        className="p-1 text-dim hover:text-down hover:bg-down/15
                   transition-all duration-150 flex-shrink-0 opacity-0 group-hover:opacity-100"
        title="조건 삭제"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
