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
    icon: <BarChart3 className="w-6 h-6 text-purple-400" />,
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
    icon: <Coins className="w-6 h-6 text-yellow-400" />,
    description: '손절/익절 설정',
    defaultBlock: {
      operator: '>=',
      value: 10,
    },
  },
  {
    type: 'cross',
    label: '크로스',
    icon: <Repeat className="w-6 h-6 text-cyan-400" />,
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
      <p className="text-xs text-white/40">클릭하여 조건 추가</p>

      <div className="grid grid-cols-1 gap-2">
        {BLOCK_TEMPLATES.map((template) => (
          <button
            key={template.type}
            onClick={() => handleAddBlock(template)}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
          >
            {template.icon}
            <div className="flex-1">
              <p className="text-sm font-medium text-white group-hover:text-white transition-colors">
                {template.label}
              </p>
              <p className="text-xs text-white/40">{template.description}</p>
            </div>
            <Plus className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
