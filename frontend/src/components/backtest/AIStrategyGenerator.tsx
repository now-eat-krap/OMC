// AI 전략 생성 컴포넌트
// 자연어로 백테스팅 전략을 생성하는 UI

import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, Check, ArrowRight } from 'lucide-react'
import type { SentenceCondition } from './types'
import { parseAIStrategy } from '../../services/api'

// 조건을 읽기 쉬운 텍스트로 변환하는 유틸리티 함수
function conditionToText(condition: SentenceCondition): string {
  const { templateType } = condition

  switch (templateType) {
    case 'indicator_vs_value': {
      const indicator = condition.indicator || 'RSI'
      const period = condition.indicatorPeriod || 14
      const comparison =
        condition.comparison === 'gt'
          ? '>'
          : condition.comparison === 'lt'
            ? '<'
            : condition.comparison === 'gte'
              ? '≥'
              : '≤'
      const value = condition.value ?? 0
      return `${indicator}(${period}) ${comparison} ${value}`
    }
    case 'indicator_cross': {
      const indicator = condition.indicator || 'EMA'
      const period = condition.indicatorPeriod || 5
      const targetIndicator = condition.targetIndicator || 'EMA'
      const targetPeriod = condition.targetPeriod || 20
      const direction = condition.crossDirection === 'above' ? '상향돌파' : '하향돌파'
      return `${indicator}(${period}) → ${targetIndicator}(${targetPeriod}) ${direction}`
    }
    case 'price_cross': {
      const priceType =
        condition.priceType === 'close'
          ? '종가'
          : condition.priceType === 'high'
            ? '고가'
            : condition.priceType === 'low'
              ? '저가'
              : '시가'
      const indicator = condition.indicator || 'SMA'
      const period = condition.indicatorPeriod || 20
      const direction = condition.crossDirection === 'above' ? '상향돌파' : '하향돌파'
      return `${priceType} → ${indicator}(${period}) ${direction}`
    }
    case 'profit_loss': {
      const direction = condition.profitDirection === 'profit' ? '수익' : '손실'
      const value = condition.value ?? 10
      return `${direction} ${Math.abs(value)}%`
    }
    case 'band_touch': {
      const band = condition.bandType === 'bollinger' ? '볼린저밴드' : '밴드'
      const position =
        condition.bandPosition === 'upper'
          ? '상단'
          : condition.bandPosition === 'lower'
            ? '하단'
            : '중간'
      const touch =
        condition.touchType === 'touch' ? '터치' : condition.touchType === 'cross' ? '돌파' : '이탈'
      return `${band} ${position} ${touch}`
    }
    case 'macd_signal': {
      const direction = condition.crossDirection === 'above' ? '상향' : '하향'
      return `MACD 시그널선 ${direction}돌파`
    }
    case 'stochastic': {
      const direction = condition.crossDirection === 'above' ? '상향' : '하향'
      return `스토캐스틱 %K/%D ${direction}돌파`
    }
    default:
      return templateType
  }
}

interface AIStrategyGeneratorProps {
  onApplyConditions: (
    buyConditions: SentenceCondition[],
    sellConditions: SentenceCondition[]
  ) => void
}

export default function AIStrategyGenerator({ onApplyConditions }: AIStrategyGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    buyConditions: SentenceCondition[]
    sellConditions: SentenceCondition[]
  } | null>(null)

  // 예시 프롬프트
  const examples = [
    'RSI가 30 아래면 매수하고, 70 이상이면 매도해줘',
    'EMA5가 EMA20을 상향돌파하면 매수, 하향돌파하면 매도',
    '볼린저밴드 하단 터치하면 매수, 상단 터치하면 매도',
    'MACD가 시그널선을 상향돌파하면 매수, 10% 수익이면 매도',
  ]

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('전략 설명을 입력해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await parseAIStrategy(prompt)
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 전략 변환 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = () => {
    if (result) {
      onApplyConditions(result.buyConditions, result.sellConditions)
      // 적용 후 초기화
      setResult(null)
      setPrompt('')
    }
  }

  const handleExampleClick = (example: string) => {
    setPrompt(example)
    setError(null)
    setResult(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">AI 전략 생성</h3>
      </div>

      {/* 설명 */}
      <p className="text-sm text-white/60 mb-4">
        자연어로 전략을 설명하면 AI가 백테스팅 조건으로 변환합니다.
      </p>

      {/* 예시 버튼 */}
      <div className="mb-4">
        <p className="text-xs text-white/40 mb-2">예시:</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((example, index) => (
            <button
              key={index}
              onClick={() => handleExampleClick(example)}
              className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg
                        text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              {example.length > 25 ? `${example.substring(0, 25)}...` : example}
            </button>
          ))}
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="mb-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="예: RSI가 30 아래면 매수하고, 70 이상이면 매도해줘"
          className="w-full h-32 px-4 py-3 bg-white/5 border border-white/20 rounded-xl
                    text-white placeholder-white/30 text-sm resize-none
                    focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30
                    transition-all"
          maxLength={1000}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-white/30">{prompt.length}/1000</span>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                       transition-all ${
                         isLoading || !prompt.trim()
                           ? 'bg-purple-500/30 text-purple-300/50 cursor-not-allowed'
                           : 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg shadow-purple-500/30'
                       }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                전략 생성
              </>
            )}
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* 결과 미리보기 */}
      {result && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 bg-white/5 border border-white/20 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-green-400">전략 생성 완료</span>
            </div>

            {/* 매수 조건 */}
            {result.buyConditions.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-green-400 mb-2">📈 매수 조건</p>
                <div className="space-y-1">
                  {result.buyConditions.map((cond, idx) => (
                    <div key={cond.id || idx} className="flex items-center gap-2">
                      <span className="text-sm text-white/80 bg-green-500/10 px-2 py-1 rounded">
                        {conditionToText(cond)}
                      </span>
                      {idx < result.buyConditions.length - 1 && (
                        <span className="text-xs text-purple-400 font-bold">
                          {cond.nextOperator || 'AND'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 매도 조건 */}
            {result.sellConditions.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-red-400 mb-2">📉 매도 조건</p>
                <div className="space-y-1">
                  {result.sellConditions.map((cond, idx) => (
                    <div key={cond.id || idx} className="flex items-center gap-2">
                      <span className="text-sm text-white/80 bg-red-500/10 px-2 py-1 rounded">
                        {conditionToText(cond)}
                      </span>
                      {idx < result.sellConditions.length - 1 && (
                        <span className="text-xs text-purple-400 font-bold">
                          {cond.nextOperator || 'AND'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 조건 없음 경고 */}
            {result.buyConditions.length === 0 && result.sellConditions.length === 0 && (
              <p className="text-sm text-yellow-400">
                ⚠️ 조건을 생성하지 못했습니다. 다른 표현으로 시도해보세요.
              </p>
            )}

            {/* 적용 버튼 */}
            {(result.buyConditions.length > 0 || result.sellConditions.length > 0) && (
              <button
                onClick={handleApply}
                className="w-full flex items-center justify-center gap-2 py-2.5 
                          bg-gradient-to-r from-purple-500 to-pink-500 
                          text-white font-semibold rounded-lg
                          hover:from-purple-600 hover:to-pink-600
                          transition-all shadow-lg shadow-purple-500/20"
              >
                조건 적용하기
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 안내 문구 */}
      {!result && !isLoading && (
        <div className="mt-auto pt-4 border-t border-white/10">
          <p className="text-xs text-white/30 text-center">
            💡 지원 지표: RSI, SMA, EMA, MACD, 볼린저밴드, 스토캐스틱
          </p>
        </div>
      )}
    </div>
  )
}
