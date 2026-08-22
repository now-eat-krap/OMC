import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { label: '백테스트', to: '/backtest' },
  { label: '지표', to: '/indicators' },
  { label: '가이드', to: '/guide' },
  { label: '소개', to: '/about' },
]

/**
 * 랜딩용 네비게이션.
 * 화면 위에 붙은 바가 아니라 떠 있는 알약 형태로 두어 페이지 여백을 살린다.
 */
export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <div className="sticky top-0 z-30 flex justify-center px-4 pt-6 pb-2">
      <nav className="flex items-center gap-5 md:gap-8 rounded-full border border-line bg-panel/70 backdrop-blur-xl py-2.5 pl-6 pr-2.5">
        <Logo />

        <div className="hidden md:flex gap-6 text-sm font-light">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={
                pathname === item.to
                  ? 'text-ink transition-colors'
                  : 'text-muted hover:text-ink transition-colors'
              }
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle iconOnly />
          <Link
            to="/backtest"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-ink transition-opacity hover:opacity-90"
          >
            시작하기
          </Link>
        </div>
      </nav>
    </div>
  )
}
