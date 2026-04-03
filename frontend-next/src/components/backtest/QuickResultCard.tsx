'use client'

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
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-white/60 mb-4">📋 결과</h3>
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-white/60">분석 중...</span>
        </div>
      </div>
    )
  }

  // 결과 없음
  if (!result) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
        <h3 className="text-sm font-semibold text-white/60 mb-4">📋 결과</h3>
        <p className="text-xs text-white/40 py-4">백테스트를 실행하면 결과가 표시됩니다</p>
      </div>
    )
  }

  // 결과 표시
  const isProfit = result.totalReturn > 0

  return (
    <div
      onClick={onViewDetails}
      className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5 cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all group"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/60">📋 결과</h3>
        {onViewDetails && (
          <span className="text-xs text-white/40 group-hover:text-white transition-colors">
            상세 보기 →
          </span>
        )}
      </div>

      {/* 총 수익률 (메인) */}
      <div className="mb-3">
        <span className="text-2xl font-bold text-white">
          {isProfit ? '+' : ''}
          {result.totalReturn.toFixed(1)}%
        </span>
      </div>

      {/* 추가 지표 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-white/40">승률</span>
          <span className="ml-2 text-white">{result.winRate.toFixed(0)}%</span>
        </div>
        <div>
          <span className="text-white/40">MDD</span>
          <span className="ml-2 text-white">{result.maxDrawdown.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-white/40">거래</span>
          <span className="ml-2 text-white">{result.totalTrades}회</span>
        </div>
        <div>
          <span className="text-white/40">샤프</span>
          <span className="ml-2 text-white">
            {result.sharpeRatio !== null ? result.sharpeRatio.toFixed(3) : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}
