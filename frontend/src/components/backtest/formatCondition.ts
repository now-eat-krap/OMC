// 문장형 조건을 한 줄 텍스트로 옮기는 공통 함수
// 전략 탭과 오른쪽 전략 레일이 같은 문구를 쓰도록 한 곳에 모아둔다

import type { SentenceCondition } from './types'
import {
  COMPARISON_LABELS,
  CROSS_DIRECTION_LABELS,
  PRICE_TYPE_LABELS,
  PROFIT_DIRECTION_LABELS,
} from './types'

export function formatCondition(condition: SentenceCondition): string {
  switch (condition.templateType) {
    case 'indicator_vs_value':
      return `${condition.indicator}(${condition.indicatorPeriod}) ${
        COMPARISON_LABELS[condition.comparison || 'lt']?.replace(' 때', '') || ''
      } ${condition.value}`
    case 'indicator_cross':
      return `${condition.indicator}(${condition.indicatorPeriod}) ${
        CROSS_DIRECTION_LABELS[condition.crossDirection || 'above']
      } 돌파 ${condition.targetIndicator}(${condition.targetPeriod})`
    case 'price_cross':
      return `${PRICE_TYPE_LABELS[condition.priceType || 'close']} ${
        CROSS_DIRECTION_LABELS[condition.crossDirection || 'above']
      } 돌파 ${condition.targetIndicator}(${condition.targetPeriod})`
    case 'profit_loss':
      return `진입가 대비 ${condition.value}% ${
        PROFIT_DIRECTION_LABELS[condition.profitDirection || 'profit']
      }`
    case 'band_touch':
      return `${PRICE_TYPE_LABELS[condition.priceType || 'low']} BB ${
        condition.bandPosition === 'upper' ? '상단' : '하단'
      } 터치`
    case 'macd_signal':
      return `MACD ${CROSS_DIRECTION_LABELS[condition.crossDirection || 'above']} 시그널`
    case 'stochastic':
      return `스토캐스틱 %K ${CROSS_DIRECTION_LABELS[condition.crossDirection || 'above']} %D`
    case 'candle_pattern':
      return `${condition.candlePattern || 'hammer'} 패턴`
    case 'volume':
      return `거래량 ${condition.volumePeriod}일 평균의 ${condition.volumeMultiplier}배`
    case 'price_change':
      return `전일 대비 ${condition.priceChangePercent}% ${
        condition.priceChangeDirection === 'up' ? '상승' : '하락'
      }`
    default:
      return '조건'
  }
}

/** 조건 목록 전체를 AND/OR로 이어 한 문장으로 만든다 */
export function formatConditionList(conditions: SentenceCondition[]): string {
  if (conditions.length === 0) {
    return '조건 없음'
  }
  return conditions
    .map((condition, index) => {
      const text = formatCondition(condition)
      const isLast = index === conditions.length - 1
      return isLast ? text : `${text} ${condition.nextOperator || 'AND'}`
    })
    .join(' ')
}
