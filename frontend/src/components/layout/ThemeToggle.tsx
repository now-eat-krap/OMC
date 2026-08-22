import { useTheme } from '../../theme/useTheme'

interface ThemeToggleProps {
  /** 라벨(LIGHT/DARK) 없이 아이콘만 보여줄지 — 모바일 헤더용 */
  iconOnly?: boolean
  className?: string
}

const SunIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 13 13"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.2}
  >
    <circle cx="6.5" cy="6.5" r="2.6" />
    <path d="M6.5 0.6v1.6M6.5 10.8v1.6M0.6 6.5h1.6M10.8 6.5h1.6M2.3 2.3l1.1 1.1M9.6 9.6l1.1 1.1M10.7 2.3L9.6 3.4M3.4 9.6l-1.1 1.1" />
  </svg>
)

const MoonIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 13 13"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.2}
  >
    <path d="M11 8.2A5.2 5.2 0 014.8 2 5.2 5.2 0 1011 8.2z" />
  </svg>
)

/** 다크 ↔ 라이트 전환 버튼. 지금이 다크면 넘어갈 곳(LIGHT)을 표시한다 */
export default function ThemeToggle({ iconOnly = false, className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className={`flex items-center gap-2 bg-transparent border-0 p-0 font-mono text-[11px] tracking-[0.14em] text-muted hover:text-ink transition-colors ${className}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      {!iconOnly && (isDark ? 'LIGHT' : 'DARK')}
    </button>
  )
}
