// 조건 블록 팔레트 컴포넌트
// 사용 가능한 조건 블록 목록 표시 및 추가

import type { ReactNode } from 'react'
import { BarChart3, Coins, Repeat, Plus } from 'lucide-react'
import type { ConditionBlockType, ConditionBlock } from './types'

interface BlockPaletteProps {
  onAddBlock: (block: ConditionBlock) => void
}

// 블록 템플릿 정의
const BLOCK_TEMPLATES: {
  type: ConditionBlockType
  label: string
  icon: ReactNode
  description: string
  defaultBlock: Partial<ConditionBlock>
}[] = [
  {
    type: 'indicator',
    label: '지표 조건',
    icon: <BarChart3 className="w-6 h-6 text-accent" />,
    description: 'RSI, MACD, 이동평균 등',
    defaultBlock: {
      indicator: 'RSI',
      operator: '<',
      value: 30,
      params: { period: 14 },
    },
  },
  {
    type: 'entry_price',
    label: '진입가 대비',
    icon: <Coins className="w-6 h-6 text-accent" />,
    description: '손절/익절 설정',
    defaultBlock: {
      operator: '>=',
      value: 10,
    },
  },
  {
    type: 'cross',
    label: '크로스',
    icon: <Repeat className="w-6 h-6 text-accent" />,
    description: '골든/데드 크로스',
    defaultBlock: {
      operator: 'cross_above',
      value: 0,
      params: { shortPeriod: 5, longPeriod: 20 },
    },
  },
]

// 고유 ID 생성
const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export default function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  const handleAddBlock = (template: (typeof BLOCK_TEMPLATES)[number]) => {
    const newBlock: ConditionBlock = {
      id: generateId(),
      type: template.type,
      operator: template.defaultBlock.operator || '>',
      value: template.defaultBlock.value || 0,
      ...template.defaultBlock,
    }
    onAddBlock(newBlock)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-dim">클릭하여 조건 추가</p>

      <div className="grid grid-cols-1 gap-2">
        {BLOCK_TEMPLATES.map((template) => (
          <button
            key={template.type}
            onClick={() => handleAddBlock(template)}
            className="flex items-center gap-3 p-3 bg-raise border border-line hover:bg-raise hover:border-line transition-all text-left group"
          >
            {template.icon}
            <div className="flex-1">
              <p className="text-sm font-medium text-strong group-hover:text-strong transition-colors">
                {template.label}
              </p>
              <p className="text-xs text-dim">{template.description}</p>
            </div>
            <Plus className="w-5 h-5 text-dim group-hover:text-strong transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
