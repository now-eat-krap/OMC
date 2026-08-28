// 커스텀 식 실시간 검증 훅
//
// 입력이 멈추고 잠시 뒤에 서버(POST /api/indicators/validate-expression)로
// 검증한다. 파싱·화이트리스트·실제 평가까지 서버가 해보므로 프론트는 결과만
// 보여준다. 서버에 못 붙으면 idle 로 두고, 최종 검증은 백테스트 제출 때 된다.

import { useEffect, useState } from 'react'
import { validateExpression, type ExpressionValidation } from '../services/api'

export type ExpressionStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'valid'; kind: 'boolean' | 'numeric'; warmup: number }
  | { state: 'invalid'; error: string }

const DEBOUNCE_MS = 400

export function useExpressionValidation(expression: string | undefined): ExpressionStatus {
  // 응답을 "어느 식에 대한 것인지"와 함께 저장한다. 상태는 렌더 때 파생 계산
  // 하므로 입력이 바뀌면 옛 응답은 자연히 무시된다 (null 응답 = 서버 접속 실패)
  const [result, setResult] = useState<{ text: string; value: ExpressionValidation | null } | null>(
    null
  )
  const text = expression?.trim() ?? ''

  useEffect(() => {
    if (!text) return
    const timer = setTimeout(() => {
      validateExpression(text)
        .then((value) => setResult({ text, value }))
        .catch(() => setResult({ text, value: null }))
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  if (!text) return { state: 'idle' }
  if (result?.text !== text) return { state: 'checking' }
  const r = result.value
  if (r === null) return { state: 'idle' }
  if (r.ok) return { state: 'valid', kind: r.kind ?? 'numeric', warmup: r.warmup ?? 0 }
  return { state: 'invalid', error: r.error || '식이 올바르지 않습니다' }
}
