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
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Circle
            className={`w-3 h-3 ${isBuy ? 'fill-green-400 text-green-400' : 'fill-red-400 text-red-400'}`}
          />
          {isBuy ? '매수 조건' : '매도 조건'}
        </h3>

        {/* 논리 연산자 토글 */}
        {conditions.length > 1 && (
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => onLogicChange('AND')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                logicOperator === 'AND' ? 'bg-white text-black' : 'text-white hover:bg-white/10'
              }`}
            >
              AND
            </button>
            <button
              onClick={() => onLogicChange('OR')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                logicOperator === 'OR' ? 'bg-white text-black' : 'text-white hover:bg-white/10'
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
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white">
                    {logicOperator}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-dashed border-white/20 text-center">
          <p className="text-white/40 text-sm">아래에서 조건을 추가해주세요</p>
        </div>
      )}

      {/* 블록 팔레트 */}
      <div className="pt-3 border-t border-white/10">
        <BlockPalette onAddBlock={handleAddBlock} />
      </div>
    </div>
  )
}
