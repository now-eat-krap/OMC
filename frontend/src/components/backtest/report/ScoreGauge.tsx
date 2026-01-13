// 점수 게이지 컴포넌트
// 원형 게이지로 종합 점수 표시

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface ScoreGaugeProps {
  score: number // 0-100
  grade: string // A+, A, B+, B, C, D
  size?: number
}

/**
 * 점수에 따른 색상 반환
 */
function getScoreColor(score: number): string {
  if (score >= 80) {
    return '#10B981'
  } // 녹색 (Emerald)
  if (score >= 60) {
    return '#A855F7'
  } // 보라색 (Purple)
  if (score >= 40) {
    return '#F59E0B'
  } // 주황색 (Amber)
  return '#EF4444' // 빨간색 (Red)
}

/**
 * 등급에 따른 배경색 반환
 */
function getGradeBgColor(grade: string): string {
  if (grade.startsWith('A')) {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (grade.startsWith('B')) {
    return 'bg-purple-100 text-purple-700'
  }
  if (grade === 'C') {
    return 'bg-amber-100 text-amber-700'
  }
  return 'bg-red-100 text-red-700'
}

export default function ScoreGauge({ score, grade, size = 160 }: ScoreGaugeProps) {
  const color = getScoreColor(score)
  const gradeBgClass = getGradeBgColor(grade)

  // 게이지 데이터
  const data = [
    { name: 'score', value: score },
    { name: 'remaining', value: 100 - score },
  ]

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={90}
              endAngle={-270}
              innerRadius="70%"
              outerRadius="100%"
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="#E5E7EB" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* 점수 텍스트 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-gray-800">{score}</span>
          <span className="text-sm text-gray-500">점</span>
        </div>
      </div>

      {/* 등급 배지 */}
      <div className={`mt-2 px-3 py-1 rounded-full text-sm font-semibold ${gradeBgClass}`}>
        등급: {grade}
      </div>
    </div>
  )
}
