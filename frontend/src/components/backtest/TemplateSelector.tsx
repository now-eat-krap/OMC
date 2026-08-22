// 조건 템플릿 선택기 컴포넌트
// 사용자가 추가할 조건 유형을 선택

import type { ReactNode } from 'react'
import {
  BarChart3,
  TrendingUp,
  Coins,
  Plus,
  Activity,
  LineChart,
  CandlestickChart,
  BarChart2,
  Percent,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react'
import type { SentenceCondition, SentenceTemplateType } from './types'
import { generateConditionId } from './types'

interface TemplateSelectorProps {
  onAddCondition: (condition: SentenceCondition) => void
  onAddToSell?: (condition: SentenceCondition) => void
  showDualButtons?: boolean
}

// 템플릿 정의
interface TemplateDefinition {
  type: SentenceTemplateType
  label: string
  description: string
  icon: ReactNode
  defaultCondition: Omit<SentenceCondition, 'id'>
}

const TEMPLATES: TemplateDefinition[] = [
  {
    type: 'indicator_vs_value',
    label: '지표 조건',
    description: 'RSI, MACD 등 지표가 특정 값과 비교',
    icon: <BarChart3 className="w-5 h-5 text-accent" />,
    defaultCondition: {
      templateType: 'indicator_vs_value',
      indicator: 'RSI',
      indicatorPeriod: 14,
      comparison: 'lt',
      value: 30,
    },
  },
  {
    type: 'indicator_cross',
    label: '지표 크로스',
    description: '이동평균 골든크로스/데드크로스',
    icon: <TrendingUp className="w-5 h-5 text-accent" />,
    defaultCondition: {
      templateType: 'indicator_cross',
      indicator: 'SMA',
      indicatorPeriod: 5,
      targetIndicator: 'SMA',
      targetPeriod: 20,
      crossDirection: 'above',
    },
  },
  {
    type: 'price_cross',
    label: '가격 돌파',
    description: '종가가 이동평균을 돌파',
    icon: <TrendingUp className="w-5 h-5 text-up" />,
    defaultCondition: {
      templateType: 'price_cross',
      priceType: 'close',
      targetIndicator: 'SMA',
      targetPeriod: 20,
      crossDirection: 'above',
    },
  },
  {
    type: 'profit_loss',
    label: '수익/손실',
    description: '진입가 대비 익절/손절 설정',
    icon: <Coins className="w-5 h-5 text-accent" />,
    defaultCondition: {
      templateType: 'profit_loss',
      value: 10,
      profitDirection: 'profit',
    },
  },
  {
    type: 'band_touch',
    label: '밴드 터치',
    description: '볼린저밴드 상/하단 터치',
    icon: <Activity className="w-5 h-5 text-pink-400" />,
    defaultCondition: {
      templateType: 'band_touch',
      priceType: 'low',
      bandType: 'bollinger',
      bandPosition: 'lower',
      touchType: 'touch',
      indicatorPeriod: 20,
    },
  },
  {
    type: 'macd_signal',
    label: 'MACD 시그널',
    description: 'MACD가 시그널선을 돌파',
    icon: <LineChart className="w-5 h-5 text-accent" />,
    defaultCondition: {
      templateType: 'macd_signal',
      crossDirection: 'above',
    },
  },
  {
    type: 'stochastic',
    label: '스토캐스틱',
    description: '%K가 %D를 돌파',
    icon: <Activity className="w-5 h-5 text-accent" />,
    defaultCondition: {
      templateType: 'stochastic',
      crossDirection: 'above',
      indicatorPeriod: 14,
    },
  },
  {
    type: 'candle_pattern',
    label: '캔들 패턴',
    description: '망치형, 도지 등 패턴 감지',
    icon: <CandlestickChart className="w-5 h-5 text-down" />,
    defaultCondition: {
      templateType: 'candle_pattern',
      candlePattern: 'hammer',
    },
  },
  {
    type: 'volume',
    label: '거래량',
    description: '거래량이 평균의 N배 이상',
    icon: <BarChart2 className="w-5 h-5 text-teal-400" />,
    defaultCondition: {
      templateType: 'volume',
      volumeMultiplier: 2,
      volumePeriod: 20,
      comparison: 'gte',
    },
  },
  {
    type: 'price_change',
    label: '가격 변동',
    description: '전일 대비 N% 이상 변동',
    icon: <Percent className="w-5 h-5 text-lime-400" />,
    defaultCondition: {
      templateType: 'price_change',
      priceChangePercent: 5,
      priceChangeDirection: 'up',
    },
  },
]

export default function TemplateSelector({
  onAddCondition,
  onAddToSell,
  showDualButtons = false,
}: TemplateSelectorProps) {
  // 직접 추가 핸들러
  const handleAddToBuy = (template: TemplateDefinition) => {
    const newCondition: SentenceCondition = {
      id: generateConditionId(),
      ...template.defaultCondition,
    }
    onAddCondition(newCondition)
  }

  const handleAddToSell = (template: TemplateDefinition) => {
    if (!onAddToSell) {
      return
    }
    const newCondition: SentenceCondition = {
      id: generateConditionId(),
      ...template.defaultCondition,
    }
    onAddToSell(newCondition)
  }

  // 단일 모드 추가
  const handleSingleAdd = (template: TemplateDefinition) => {
    const newCondition: SentenceCondition = {
      id: generateConditionId(),
      ...template.defaultCondition,
    }
    onAddCondition(newCondition)
  }

  return (
    <div className="space-y-4">
      {/* 템플릿 그리드 */}
      <div>
        <p className="text-xs text-dim flex items-center gap-1 mb-3">
          <Plus className="w-3 h-3" />
          조건 추가
        </p>

        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((template) => (
            <div
              key={template.type}
              className="flex items-center gap-3 p-3 bg-raise border border-line rounded-card 
                         hover:bg-line hover:border-line transition-all"
            >
              {/* 아이콘 */}
              {template.icon}

              {/* 라벨 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-strong truncate">{template.label}</p>
                <p className="text-[10px] text-dim truncate">{template.description}</p>
              </div>

              {/* 버튼 (오른쪽) */}
              {showDualButtons ? (
                // 듀얼 모드: 조그만 매수/매도 버튼
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleAddToBuy(template)}
                    className="p-1.5 bg-up/15 border border-up rounded-card 
                               text-up hover:bg-up/15 hover:border-up 
 transition-all"
                    title="매수 조건에 추가"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleAddToSell(template)}
                    className="p-1.5 bg-down/15 border border-down rounded-card 
                               text-down hover:bg-down/15 hover:border-down 
 transition-all"
                    title="매도 조건에 추가"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                // 단일 모드: 추가 버튼
                <button
                  onClick={() => handleSingleAdd(template)}
                  className="p-1.5 bg-wash border border-accent rounded-card 
                             text-accent hover:bg-wash hover:border-accent 
                             transition-all flex-shrink-0"
                  title="추가"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
