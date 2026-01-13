// AI 리포트 모달 컴포넌트
// 화이트 테마의 시각적 보고서 표시

import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import ScoreGauge from './report/ScoreGauge'
import StrategyRadarChart from './report/StrategyRadarChart'
import MetricCard from './report/MetricCard'
import InsightCard from './report/InsightCard'
import SuggestionsCard from './report/SuggestionsCard'
import type { StructuredAIReport } from '../../services/api'

interface AIReportModalProps {
  report: StructuredAIReport
  backtestResult: {
    totalReturn: number
    winRate: number
    maxDrawdown: number
    sharpeRatio: number
    profitFactor: number
  }
  onClose: () => void
}

export default function AIReportModal({ report, backtestResult, onClose }: AIReportModalProps) {
  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleBackdropClick}
    >
      {/* 모달 컨테이너 */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">AI 전략 분석 리포트</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 본문 (스크롤 가능) */}
        <div className="overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(90vh - 70px)' }}>
          {/* 상단: 점수 게이지 + 레이더 차트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 점수 게이지 */}
            <div className="flex items-center justify-center bg-gray-50 rounded-xl p-6">
              <ScoreGauge score={report.overallScore} grade={report.grade} />
            </div>

            {/* 레이더 차트 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-2 text-center">전략 분석</h3>
              <StrategyRadarChart metrics={report.radarMetrics} />
            </div>
          </div>

          {/* 지표 카드 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard type="return" value={backtestResult.totalReturn} />
            <MetricCard type="winRate" value={backtestResult.winRate} />
            <MetricCard type="drawdown" value={backtestResult.maxDrawdown} />
            <MetricCard type="sharpe" value={backtestResult.sharpeRatio} />
            <MetricCard type="profitFactor" value={backtestResult.profitFactor} />
          </div>

          {/* 한줄 요약 */}
          {report.summary && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-gray-700 text-sm leading-relaxed">{report.summary}</p>
            </div>
          )}

          {/* 강점/약점 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightCard type="strengths" items={report.strengths} />
            <InsightCard type="weaknesses" items={report.weaknesses} />
          </div>

          {/* 개선 제안 */}
          {report.suggestions.length > 0 && <SuggestionsCard suggestions={report.suggestions} />}
        </div>
      </div>
    </div>
  )

  // Portal을 사용하여 body에 직접 렌더링
  return createPortal(modalContent, document.body)
}
