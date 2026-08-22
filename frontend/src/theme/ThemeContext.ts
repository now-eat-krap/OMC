import { createContext } from 'react'

/** 사용 가능한 테마 */
export type ThemeName = 'dark' | 'light'

export interface ThemeContextValue {
  theme: ThemeName
  /** 다크 ↔ 라이트 전환 */
  toggleTheme: () => void
  setTheme: (theme: ThemeName) => void
}

// Provider 밖에서 쓰면 undefined — useTheme에서 걸러낸다
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
