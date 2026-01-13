// 강점/약점 카드 컴포넌트
// 리스트 형태로 강점과 약점 표시

import { CheckCircle, AlertTriangle } from 'lucide-react'

interface InsightCardProps {
  type: 'strengths' | 'weaknesses'
  items: string[]
}

export default function InsightCard({ type, items }: InsightCardProps) {
  const isStrength = type === 'strengths'

  return (
    <div
      className={`rounded-xl p-4 ${
        isStrength
          ? 'bg-emerald-50 border border-emerald-100'
          : 'bg-amber-50 border border-amber-100'
      }`}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        {isStrength ? (
          <CheckCircle className="w-5 h-5 text-emerald-600" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        )}
        <h3 className={`font-semibold ${isStrength ? 'text-emerald-700' : 'text-amber-700'}`}>
          {isStrength ? '강점' : '약점'}
        </h3>
      </div>

      {/* 리스트 */}
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isStrength ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-sm text-gray-700">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
