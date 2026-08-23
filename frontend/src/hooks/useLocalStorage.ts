// 로컬 스토리지 동기화를 위한 커스텀 훅
// 페이지 새로고침 후에도 상태를 유지하기 위해 사용

import { useState, useCallback } from 'react'

/**
 * 로컬 스토리지와 동기화되는 상태 관리 훅
 * @param key - 로컬 스토리지 키
 * @param initialValue - 초기값 (로컬 스토리지에 데이터가 없을 때 사용)
 * @returns [저장된 값, 값 설정 함수]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // 초기값: 로컬 스토리지에서 읽거나 initialValue 사용
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        return JSON.parse(item) as T
      }
      // 초기값도 로컬 스토리지에 저장
      window.localStorage.setItem(key, JSON.stringify(initialValue))
      return initialValue
    } catch {
      // 로컬 스토리지 접근 실패 시 초기값 사용
      return initialValue
    }
  })

  // 값 저장 함수 (함수형 업데이트 지원)
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setStoredValue((prev) => {
          // 함수형 업데이트 지원: 항상 최신 state(prev)를 기반으로 계산
          const valueToStore = value instanceof Function ? value(prev) : value

          // 상태 변경과 함께 로컬 스토리지 저장도 수행 (일관성 보장)
          window.localStorage.setItem(key, JSON.stringify(valueToStore))

          return valueToStore
        })
      } catch {
        // 로컬 스토리지 접근 실패 시 조용히 실패
      }
    },
    [key]
  )

  return [storedValue, setValue]
}

export default useLocalStorage
