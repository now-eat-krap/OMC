// 조건 빌더 컴포넌트
// 매수/매도 조건 블록 관리

import { Circle } from 'lucide-react'
import type { ConditionBlock } from './types'
import ConditionBlockItem from './ConditionBlockItem'
import BlockPalette from './BlockPalette'

interface ConditionBuilderProps {
  type: 'buy' | 'sell'
  conditions: ConditionBlock[]
  logicOperator: 'AND' | 'OR'
  onConditionsChange: (conditions: ConditionBlock[]) => void
  onLogicChange: (operator: 'AND' | 'OR') => void
}

export default function ConditionBuilder({
  type,
  conditions,
  logicOperator,
  onConditionsChange,
  onLogicChange,
}: ConditionBuilderProps) {
  const isBuy = type === 'buy'

  const handleAddBlock = (block: ConditionBlock) => {
    onConditionsChange([...conditions, block])
  }

  const handleUpdateBlock = (index: number, updatedBlock: ConditionBlock) => {
    const newConditions = [...conditions]
    newConditions[index] = updatedBlock
    onConditionsChange(newConditions)
  }

  const handleDeleteBlock = (index: number) => {
    onConditionsChange(conditions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-strong">
          <Circle className={`w-3 h-3 ${isBuy ? 'fill-up text-up' : 'fill-down text-down'}`} />
          {isBuy ? '매수 조건' : '매도 조건'}
        </h3>

        {/* 논리 연산자 토글 */}
        {conditions.length > 1 && (
          <div className="flex items-center gap-1 bg-raise p-1">
            <button
              onClick={() => onLogicChange('AND')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                logicOperator === 'AND' ? 'bg-accent text-accent-ink' : 'text-strong hover:bg-raise'
              }`}
            >
              AND
            </button>
            <button
              onClick={() => onLogicChange('OR')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                logicOperator === 'OR' ? 'bg-accent text-accent-ink' : 'text-strong hover:bg-raise'
              }`}
            >
              OR
            </button>
          </div>
        )}
      </div>

      {/* 조건 블록 목록 */}
      {conditions.length > 0 ? (
        <div className="space-y-3">
          {conditions.map((block, index) => (
            <div key={block.id}>
              <ConditionBlockItem
                block={block}
                onChange={(updated) => handleUpdateBlock(index, updated)}
                onDelete={() => handleDeleteBlock(index)}
              />
              {/* 논리 연산자 구분선 */}
              {index < conditions.length - 1 && (
                <div className="flex items-center justify-center py-2">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-raise text-strong">
                    {logicOperator}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 border border-dashed border-line text-center">
          <p className="text-dim text-sm">아래에서 조건을 추가해주세요</p>
        </div>
      )}

      {/* 블록 팔레트 */}
      <div className="pt-3 border-t border-line">
        <BlockPalette onAddBlock={handleAddBlock} />
      </div>
    </div>
  )
}
