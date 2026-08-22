import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { MantineProvider, createTheme } from '@mantine/core'
import { ThemeContext, type ThemeName } from './ThemeContext'

const STORAGE_KEY = 'omc-theme'

// Mantine은 폰트만 맞추고 색은 CSS 변수 팔레트를 따른다
const mantineTheme = createTheme({
  primaryColor: 'yellow',
  fontFamily: 'Pretendard Variable, Pretendard, -apple-system, system-ui, sans-serif',
  fontFamilyMonospace: 'IBM Plex Mono, ui-monospace, Consolas, monospace',
})

/** 저장된 테마를 읽는다. 없으면 OS 설정을 따르고, 그것도 없으면 다크 */
const readInitialTheme = (): ThemeName => {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') {
    return saved
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/**
 * <html data-theme>과 localStorage를 즉시 갱신한다.
 *
 * effect가 아니라 상태를 바꾸는 그 자리에서 호출하는 게 중요하다.
 * React는 자식 effect를 부모보다 먼저 실행하기 때문에, 이 갱신을 부모 effect에 두면
 * 자식(차트 위젯 등)이 CSS 변수를 읽을 때 아직 이전 테마 값이 남아 있다.
 */
const applyTheme = (theme: ThemeName) => {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem(STORAGE_KEY, theme)
}

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * 테마 상태를 들고 있으면서
 * - <html data-theme="...">를 갱신하고 (CSS 변수 팔레트 전환)
 * - localStorage에 저장하고
 * - Mantine의 컬러 스킴도 같이 맞춘다
 */
export default function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(readInitialTheme)

  // 첫 렌더에서 초기 테마를 반영 (이후 변경은 setTheme이 즉시 처리한다)
  useEffect(() => {
    applyTheme(theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTheme = useCallback((next: ThemeName) => {
    applyTheme(next)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme])

  return (
    <ThemeContext.Provider value={value}>
      <MantineProvider theme={mantineTheme} forceColorScheme={theme}>
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  )
}
