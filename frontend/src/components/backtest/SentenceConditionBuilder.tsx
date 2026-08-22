// 문장형 조건 빌더 컴포넌트
// 매수/매도 조건을 자연어 문장 형태로 관리

import { Circle } from 'lucide-react'
import type { SentenceCondition } from './types'
import SentenceConditionItem from './SentenceCondition'
import TemplateSelector from './TemplateSelector'

interface SentenceConditionBuilderProps {
  type: 'buy' | 'sell'
  conditions: SentenceCondition[]
  onConditionsChange: (conditions: SentenceCondition[]) => void
}

export default function SentenceConditionBuilder({
  type,
  conditions,
  onConditionsChange,
}: SentenceConditionBuilderProps) {
  const isBuy = type === 'buy'

  // 조건 추가 (새 조건은 기본적으로 AND 연산자)
  const handleAddCondition = (condition: SentenceCondition) => {
    const newCondition = { ...condition, nextOperator: 'AND' as const }
    onConditionsChange([...conditions, newCondition])
  }

  // 조건 수정
  const handleUpdateCondition = (index: number, updated: SentenceCondition) => {
    const newConditions = [...conditions]
    newConditions[index] = updated
    onConditionsChange(newConditions)
  }

  // 조건 삭제
  const handleDeleteCondition = (index: number) => {
    onConditionsChange(conditions.filter((_, i) => i !== index))
  }

  // 개별 연산자 토글 (조건 사이의 AND/OR 변경)
  const handleToggleOperator = (index: number) => {
    const newConditions = [...conditions]
    const current = newConditions[index].nextOperator || 'AND'
    newConditions[index] = {
      ...newConditions[index],
      nextOperator: current === 'AND' ? 'OR' : 'AND',
    }
    onConditionsChange(newConditions)
  }

  return (
    <div className="space-y-4">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-strong">
          <Circle className={`w-3 h-3 ${isBuy ? 'fill-up text-up' : 'fill-down text-down'}`} />
          {isBuy ? '매수 조건' : '매도 조건'}
        </h3>
      </div>

      {/* 조건 목록 */}
      {conditions.length > 0 ? (
        <div className="space-y-1">
          {conditions.map((condition, index) => (
            <div key={condition.id}>
              <SentenceConditionItem
                condition={condition}
                onChange={(updated) => handleUpdateCondition(index, updated)}
                onDelete={() => handleDeleteCondition(index)}
              />
              {/* 개별 논리 연산자 토글 (마지막 조건 제외) */}
              {index < conditions.length - 1 && (
                <div className="flex items-center justify-center py-2">
                  <button
                    onClick={() => handleToggleOperator(index)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      condition.nextOperator === 'OR'
                        ? 'bg-wash text-accent border border-accent hover:bg-wash'
                        : 'bg-wash text-accent border border-accent hover:bg-wash'
                    }`}
                    title="클릭하여 AND/OR 전환"
                  >
                    {condition.nextOperator || 'AND'}
                  </button>
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

      {/* 템플릿 선택기 */}
      <div className="pt-3 border-t border-line">
        <TemplateSelector onAddCondition={handleAddCondition} />
      </div>
    </div>
  )
}
