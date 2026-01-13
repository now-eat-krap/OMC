// 2컬럼 레이아웃 설정 모달 컴포넌트
// 왼쪽 메뉴 + 오른쪽 콘텐츠

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Settings,
  Coins,
  Target,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Sparkles,
} from 'lucide-react'
import type { SentenceCondition } from './types'
import TemplateSelector from './TemplateSelector'
import SentenceConditionItem from './SentenceCondition'
import AIStrategyGenerator from './AIStrategyGenerator'

// 메뉴 항목 타입 ('buy', 'sell' 대신 'strategy'로 통합, AI 전략 추가)
type MenuSection = 'basic' | 'trading' | 'strategy' | 'ai'

interface MenuItemProps {
  id: MenuSection
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}

function MenuItem({ label, icon, active, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all border-l-2 ${
        active
          ? 'bg-white/10 text-white border-purple-500'
          : 'text-white/40 hover:text-white/70 hover:bg-white/5 border-transparent'
      }`}
    >
      <span className={active ? 'opacity-100' : 'opacity-50'}>{icon}</span>
      <span className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  )
}

// 조건 목록 컴포넌트 (매수/매도 공용) - 세부 편집 가능 + 추가 버튼
interface ConditionListProps {
  title: string
  type: 'buy' | 'sell'
  conditions: SentenceCondition[]
  onUpdate: (index: number, condition: SentenceCondition) => void
  onDelete: (index: number) => void
  onToggleOperator: (index: number) => void
  onAddClick: () => void // 추가 버튼 클릭 핸들러
}

function ConditionList({
  title,
  type,
  conditions,
  onUpdate,
  onDelete,
  onToggleOperator,
  onAddClick,
}: ConditionListProps) {
  const isBuy = type === 'buy'

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div
        className={`flex items-center gap-2 mb-3 pb-2 border-b ${isBuy ? 'border-green-500/30' : 'border-red-500/30'}`}
      >
        {isBuy ? (
          <ArrowUpCircle className="w-4 h-4 text-green-400" />
        ) : (
          <ArrowDownCircle className="w-4 h-4 text-red-400" />
        )}
        <h4 className={`text-sm font-semibold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
          {title}
        </h4>
        <span className="text-xs text-white/40 ml-auto">{conditions.length}개</span>
      </div>

      {/* 조건 목록 - SentenceConditionItem 사용으로 세부 편집 가능 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {conditions.length > 0 ? (
          conditions.map((condition, index) => (
            <div key={condition.id}>
              <SentenceConditionItem
                condition={condition}
                onChange={(updated) => onUpdate(index, updated)}
                onDelete={() => onDelete(index)}
              />
              {/* AND/OR 연산자 */}
              {index < conditions.length - 1 && (
                <div className="flex justify-center py-1">
                  <button
                    onClick={() => onToggleOperator(index)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      condition.nextOperator === 'OR'
                        ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                        : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                    }`}
                  >
                    {condition.nextOperator || 'AND'}
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-white/30 text-xs">조건이 없습니다</div>
        )}
      </div>

      {/* 하단 추가 버튼 */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <button
          onClick={onAddClick}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl 
                      border transition-all text-sm font-semibold
                      ${
                        isBuy
                          ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                          : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                      }`}
        >
          <Plus className="w-4 h-4" />
          조건 추가
        </button>
      </div>
    </div>
  )
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  // 각 섹션별 콘텐츠
  basicContent: ReactNode
  tradingContent: ReactNode
  // 전략 조건용 props
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
  onBuyConditionsChange: (conditions: SentenceCondition[]) => void
  onSellConditionsChange: (conditions: SentenceCondition[]) => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  basicContent,
  tradingContent,
  buyConditions,
  sellConditions,
  onBuyConditionsChange,
  onSellConditionsChange,
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<MenuSection>('basic')
  // 조건 추가 모달 상태 (훅은 조건부 return 이전에 선언해야 함)
  const [addModalOpen, setAddModalOpen] = useState<'buy' | 'sell' | null>(null)

  if (!isOpen) {
    return null
  }

  // 메뉴 항목 정의 (buy/sell을 strategy로 통합, AI 전략 추가)
  const menuItems: { id: MenuSection; label: string; icon: ReactNode }[] = [
    { id: 'basic', label: '기본 설정', icon: <Settings className="w-5 h-5" /> },
    { id: 'trading', label: '거래 설정', icon: <Coins className="w-5 h-5" /> },
    { id: 'strategy', label: '전략 조건', icon: <Target className="w-5 h-5 text-purple-400" /> },
    { id: 'ai', label: 'AI 전략', icon: <Sparkles className="w-5 h-5 text-pink-400" /> },
  ]

  // 매수 조건 핸들러
  const handleDeleteBuyCondition = (index: number) => {
    onBuyConditionsChange(buyConditions.filter((_, i) => i !== index))
  }

  const handleToggleBuyOperator = (index: number) => {
    const newConditions = [...buyConditions]
    const current = newConditions[index].nextOperator || 'AND'
    newConditions[index] = {
      ...newConditions[index],
      nextOperator: current === 'AND' ? 'OR' : 'AND',
    }
    onBuyConditionsChange(newConditions)
  }

  // 매수 조건 업데이트 핸들러
  const handleUpdateBuyCondition = (index: number, updated: SentenceCondition) => {
    const newConditions = [...buyConditions]
    newConditions[index] = updated
    onBuyConditionsChange(newConditions)
  }

  // 매도 조건 핸들러
  const handleDeleteSellCondition = (index: number) => {
    onSellConditionsChange(sellConditions.filter((_, i) => i !== index))
  }

  const handleToggleSellOperator = (index: number) => {
    const newConditions = [...sellConditions]
    const current = newConditions[index].nextOperator || 'AND'
    newConditions[index] = {
      ...newConditions[index],
      nextOperator: current === 'AND' ? 'OR' : 'AND',
    }
    onSellConditionsChange(newConditions)
  }

  // 매도 조건 업데이트 핸들러
  const handleUpdateSellCondition = (index: number, updated: SentenceCondition) => {
    const newConditions = [...sellConditions]
    newConditions[index] = updated
    onSellConditionsChange(newConditions)
  }

  // 조건 추가 핸들러
  const handleAddCondition = (condition: SentenceCondition) => {
    const newCondition = { ...condition, nextOperator: 'AND' as const }
    if (addModalOpen === 'buy') {
      onBuyConditionsChange([...buyConditions, newCondition])
    } else if (addModalOpen === 'sell') {
      onSellConditionsChange([...sellConditions, newCondition])
    }
    setAddModalOpen(null)
  }

  // 현재 섹션에 맞는 콘텐츠 반환
  const getContent = () => {
    switch (activeSection) {
      case 'basic':
        return basicContent
      case 'trading':
        return tradingContent
      case 'strategy':
        // 매수/매도 나란히 (조건 추가는 각 영역 하단 버튼으로)
        return (
          <>
            <div className="h-full flex gap-4">
              {/* 왼쪽: 매수 조건 목록 */}
              <div className="flex-1 min-w-0 bg-green-500/5 rounded-xl p-4 border border-green-500/20">
                <ConditionList
                  title="매수 조건"
                  type="buy"
                  conditions={buyConditions}
                  onUpdate={handleUpdateBuyCondition}
                  onDelete={handleDeleteBuyCondition}
                  onToggleOperator={handleToggleBuyOperator}
                  onAddClick={() => setAddModalOpen('buy')}
                />
              </div>

              {/* 오른쪽: 매도 조건 목록 */}
              <div className="flex-1 min-w-0 bg-red-500/5 rounded-xl p-4 border border-red-500/20">
                <ConditionList
                  title="매도 조건"
                  type="sell"
                  conditions={sellConditions}
                  onUpdate={handleUpdateSellCondition}
                  onDelete={handleDeleteSellCondition}
                  onToggleOperator={handleToggleSellOperator}
                  onAddClick={() => setAddModalOpen('sell')}
                />
              </div>
            </div>

            {/* 조건 추가 모달 */}
            {addModalOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setAddModalOpen(null)}
                />
                <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-gray-900 border border-white/20 rounded-2xl shadow-2xl p-6">
                  {/* 모달 헤더 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-purple-400" />
                      <h3 className="text-lg font-semibold text-white">
                        {addModalOpen === 'buy' ? '매수 조건 추가' : '매도 조건 추가'}
                      </h3>
                    </div>
                    <button
                      onClick={() => setAddModalOpen(null)}
                      className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 템플릿 선택기 */}
                  <TemplateSelector onAddCondition={handleAddCondition} showDualButtons={false} />
                </div>
              </div>
            )}
          </>
        )
      case 'ai':
        // AI 전략 생성
        return (
          <AIStrategyGenerator
            onApplyConditions={(newBuyConditions, newSellConditions) => {
              onBuyConditionsChange([...newBuyConditions])
              onSellConditionsChange([...newSellConditions])
              setActiveSection('strategy') // 적용 후 전략 조건 탭으로 이동
            }}
          />
        )
      default:
        return null
    }
  }

  // 현재 섹션 제목
  const getSectionTitle = () => {
    const item = menuItems.find((m) => m.id === activeSection)
    return item ? (
      <span className="flex items-center gap-2">
        {item.icon}
        {item.label}
      </span>
    ) : (
      ''
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 컨테이너 - 화면 가로 90% */}
      <div className="relative w-[90vw] h-[90vh] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex">
        {/* 왼쪽 사이드바 (메뉴) */}
        <div className="w-56 flex-shrink-0 bg-black/30 border-r border-white/10 p-4 flex flex-col">
          {/* 헤더 */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">전략 설정</h2>
            <p className="text-xs text-white/40 mt-1">백테스팅 조건 설정</p>
          </div>

          {/* 메뉴 리스트 */}
          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => (
              <MenuItem
                key={item.id}
                id={item.id}
                label={item.label}
                icon={item.icon}
                active={activeSection === item.id}
                onClick={() => setActiveSection(item.id)}
              />
            ))}
          </nav>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-colors"
          >
            닫기
          </button>
        </div>

        {/* 오른쪽 콘텐츠 영역 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 콘텐츠 헤더 */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-white">{getSectionTitle()}</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 콘텐츠 본문 */}
          <div className="flex-1 overflow-hidden p-6">{getContent()}</div>
        </div>
      </div>
    </div>
  )
}
