import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from './ThemeContext'

/** 현재 테마와 전환 함수를 가져온다 (ThemeProvider 안에서만 호출) */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme는 ThemeProvider 안에서만 사용할 수 있습니다.')
  }
  return context
}
