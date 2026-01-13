// 레이더 차트 컴포넌트
// 5개 축으로 전략 지표 시각화

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'

interface RadarMetrics {
  profitability: number // 수익성
  winRate: number // 승률
  riskManagement: number // 리스크관리
  stability: number // 안정성
  profitFactor: number // 수익팩터
}

interface StrategyRadarChartProps {
  metrics: RadarMetrics
}

// 레이더 차트 데이터로 변환
function transformMetrics(metrics: RadarMetrics) {
  return [
    { axis: '수익성', value: metrics.profitability, fullMark: 5 },
    { axis: '승률', value: metrics.winRate, fullMark: 5 },
    { axis: '리스크관리', value: metrics.riskManagement, fullMark: 5 },
    { axis: '안정성', value: metrics.stability, fullMark: 5 },
    { axis: '수익팩터', value: metrics.profitFactor, fullMark: 5 },
  ]
}

export default function StrategyRadarChart({ metrics }: StrategyRadarChartProps) {
  const data = transformMetrics(metrics)

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: '#4B5563', fontSize: 12 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 5]}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            tickCount={6}
          />
          <Radar
            name="전략 점수"
            dataKey="value"
            stroke="#A855F7"
            fill="#A855F7"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
