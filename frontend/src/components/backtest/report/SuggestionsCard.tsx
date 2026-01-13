// 개선 제안 카드 컴포넌트
// 번호 매긴 제안 리스트 표시

import { Lightbulb } from 'lucide-react'

interface SuggestionsCardProps {
  suggestions: string[]
}

export default function SuggestionsCard({ suggestions }: SuggestionsCardProps) {
  return (
    <div className="rounded-xl p-4 bg-blue-50 border border-blue-100">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-blue-700">개선 제안</h3>
      </div>

      {/* 번호 리스트 */}
      <ol className="space-y-2">
        {suggestions.map((item, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
              {index + 1}
            </span>
            <span className="text-sm text-gray-700 pt-0.5">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
