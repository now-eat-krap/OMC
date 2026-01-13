// 지표 카드 컴포넌트
// 개별 백테스트 지표를 카드 형태로 표시

import { TrendingUp, TrendingDown, Percent, BarChart3, Target } from 'lucide-react'

type MetricType = 'return' | 'winRate' | 'drawdown' | 'sharpe' | 'profitFactor'

interface MetricCardProps {
  type: MetricType
  value: number
  label?: string
}

// 지표 타입별 설정
const metricConfig: Record<
  MetricType,
  {
    label: string
    icon: React.ReactNode
    format: (v: number) => string
    getColor: (v: number) => string
  }
> = {
  return: {
    label: '총 수익률',
    icon: <TrendingUp className="w-5 h-5" />,
    format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
    getColor: (v) => (v >= 0 ? 'text-emerald-600' : 'text-red-600'),
  },
  winRate: {
    label: '승률',
    icon: <Target className="w-5 h-5" />,
    format: (v) => `${v.toFixed(1)}%`,
    getColor: (v) => (v >= 50 ? 'text-emerald-600' : 'text-amber-600'),
  },
  drawdown: {
    label: '최대 낙폭',
    icon: <TrendingDown className="w-5 h-5" />,
    format: (v) => `${v.toFixed(2)}%`,
    getColor: (v) =>
      Math.abs(v) <= 10
        ? 'text-emerald-600'
        : Math.abs(v) <= 20
          ? 'text-amber-600'
          : 'text-red-600',
  },
  sharpe: {
    label: '샤프 비율',
    icon: <BarChart3 className="w-5 h-5" />,
    format: (v) => v.toFixed(2),
    getColor: (v) => (v >= 1.5 ? 'text-emerald-600' : v >= 1.0 ? 'text-amber-600' : 'text-red-600'),
  },
  profitFactor: {
    label: '수익 팩터',
    icon: <Percent className="w-5 h-5" />,
    format: (v) => v.toFixed(2),
    getColor: (v) => (v >= 1.5 ? 'text-emerald-600' : v >= 1.0 ? 'text-amber-600' : 'text-red-600'),
  },
}

export default function MetricCard({ type, value, label }: MetricCardProps) {
  const config = metricConfig[type]
  const colorClass = config.getColor(value)

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      {/* 헤더 */}
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        {config.icon}
        <span className="text-sm font-medium">{label || config.label}</span>
      </div>

      {/* 값 */}
      <div className={`text-2xl font-bold ${colorClass}`}>{config.format(value)}</div>
    </div>
  )
}
