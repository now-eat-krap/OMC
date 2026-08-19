// 백테스팅 결과 패널 컴포넌트
// 수익률, 승률, MDD 등 핵심 지표 표시

import type { BacktestResult } from './types'

interface ResultsPanelProps {
  result: BacktestResult | null
  isLoading?: boolean
}

export default function ResultsPanel({ result, isLoading }: ResultsPanelProps) {
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="bg-raise backdrop-blur-sm border border-line p-6">
        <div className="flex items-center justify-center h-40">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted text-sm">백테스팅 실행 중...</p>
          </div>
        </div>
      </div>
    )
  }

  // 결과 없음
  if (!result) {
    return (
      <div className="bg-raise backdrop-blur-sm border border-line p-6">
        <h2 className="text-lg font-semibold text-strong mb-4">📋 백테스팅 결과</h2>
        <div className="flex items-center justify-center h-32 text-dim">
          <p>전략을 설정하고 백테스팅을 실행하세요</p>
        </div>
      </div>
    )
  }

  // 결과 표시
  const isProfit = result.totalReturn > 0

  return (
    <div className="bg-raise backdrop-blur-sm border border-line p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-strong">📋 백테스팅 결과</h2>
        <span className="px-3 py-1 rounded-full bg-raise text-strong text-xs">완료</span>
      </div>

      {/* 총 수익률 (대형 표시) */}
      <div className="text-center py-6 bg-raise border border-hair">
        <p className="text-muted text-sm mb-2">총 수익률</p>
        <p className={`text-5xl font-bold text-strong`}>
          {isProfit ? '+' : ''}
          {result.totalReturn.toFixed(2)}%
        </p>
      </div>

      {/* 핵심 지표 그리드 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 승률 */}
        <div className="p-4 bg-raise border border-line">
          <p className="text-dim text-xs mb-1">승률</p>
          <p className="text-xl font-semibold text-strong">{result.winRate.toFixed(1)}%</p>
        </div>

        {/* 최대 낙폭 */}
        <div className="p-4 bg-raise border border-line">
          <p className="text-dim text-xs mb-1">최대 낙폭 (MDD)</p>
          <p className="text-xl font-semibold text-strong">{result.maxDrawdown.toFixed(1)}%</p>
        </div>

        {/* 총 거래 수 */}
        <div className="p-4 bg-raise border border-line">
          <p className="text-dim text-xs mb-1">총 거래</p>
          <p className="text-xl font-semibold text-strong">{result.totalTrades}회</p>
        </div>

        {/* 수익/손실 거래 */}
        <div className="p-4 bg-raise border border-line">
          <p className="text-dim text-xs mb-1">수익 / 손실</p>
          <p className="text-xl font-semibold text-strong">
            {result.profitTrades} / {result.lossTrades}
          </p>
        </div>

        {/* 샤프 비율 */}
        <div className="p-4 bg-raise border border-line">
          <p className="text-dim text-xs mb-1">샤프 비율</p>
          <p className="text-xl font-semibold text-strong">
            {result.sharpeRatio !== null ? result.sharpeRatio.toFixed(3) : '-'}
          </p>
        </div>

        {/* 수익 팩터 */}
        <div className="p-4 bg-raise border border-line">
          <p className="text-dim text-xs mb-1">수익 팩터</p>
          <p className="text-xl font-semibold text-strong">{result.profitFactor.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}
