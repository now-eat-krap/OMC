// 빠른 결과 카드 컴포넌트
// 핵심 백테스팅 결과를 컴팩트하게 표시

import type { BacktestResult } from './types'

interface QuickResultCardProps {
  result: BacktestResult | null
  isLoading?: boolean
  onViewDetails?: () => void
}

export default function QuickResultCard({
  result,
  isLoading,
  onViewDetails,
}: QuickResultCardProps) {
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="bg-raise backdrop-blur-sm border border-line p-5">
        <h3 className="text-sm font-semibold text-muted mb-4">📋 결과</h3>
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-muted">분석 중...</span>
        </div>
      </div>
    )
  }

  // 결과 없음
  if (!result) {
    return (
      <div className="bg-raise backdrop-blur-sm border border-line p-5">
        <h3 className="text-sm font-semibold text-muted mb-4">📋 결과</h3>
        <p className="text-xs text-dim py-4">백테스트를 실행하면 결과가 표시됩니다</p>
      </div>
    )
  }

  // 결과 표시
  const isProfit = result.totalReturn > 0

  return (
    <div
      onClick={onViewDetails}
      className="bg-raise backdrop-blur-sm border border-line p-5 cursor-pointer hover:bg-raise hover:border-line transition-all group"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted">📋 결과</h3>
        {onViewDetails && (
          <span className="text-xs text-dim group-hover:text-strong transition-colors">
            상세 보기 →
          </span>
        )}
      </div>

      {/* 총 수익률 (메인) */}
      <div className="mb-3">
        <span className="text-2xl font-bold text-strong">
          {isProfit ? '+' : ''}
          {result.totalReturn.toFixed(1)}%
        </span>
      </div>

      {/* 추가 지표 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-dim">승률</span>
          <span className="ml-2 text-strong">{result.winRate.toFixed(0)}%</span>
        </div>
        <div>
          <span className="text-dim">MDD</span>
          <span className="ml-2 text-strong">{result.maxDrawdown.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-dim">거래</span>
          <span className="ml-2 text-strong">{result.totalTrades}회</span>
        </div>
        <div>
          <span className="text-dim">샤프</span>
          <span className="ml-2 text-strong">
            {result.sharpeRatio !== null ? result.sharpeRatio.toFixed(3) : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}
