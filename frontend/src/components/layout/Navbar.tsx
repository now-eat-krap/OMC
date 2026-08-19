import { Link, useLocation } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { label: '홈', to: '/' },
  { label: '백테스팅', to: '/backtest' },
  { label: '가이드', to: '/guide' },
  { label: '소개', to: '/about' },
]

/** 랜딩용 상단 네비게이션 */
export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="flex items-center justify-between h-[68px] px-6 md:px-14 border-b border-line">
      <div className="flex items-center gap-6 md:gap-11">
        <Link to="/" className="font-mono text-[17px] font-semibold tracking-[0.02em] text-strong">
          OMC<span className="text-accent">_</span>
        </Link>
        <div className="hidden md:flex gap-8 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={
                pathname === item.to
                  ? 'text-ink hover:text-strong transition-colors'
                  : 'text-muted hover:text-ink transition-colors'
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-5">
        <ThemeToggle />
        <Link
          to="/backtest"
          className="bg-accent text-accent-ink text-sm font-semibold px-5 py-3 hover:opacity-90 transition-opacity"
        >
          백테스팅 시작
        </Link>
      </div>
    </nav>
  )
}
