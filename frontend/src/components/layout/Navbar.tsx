import { useLocation } from 'react-router-dom'
import PillNav from '../effects/PillNav'
import logo from '../../assets/icon.png'

// OMC 네비게이션 아이템 설정 (PillNav 형식)
const navItems = [
  { label: '홈', href: '/', ariaLabel: '홈으로 이동' },
  { label: '백테스팅', href: '/backtest', ariaLabel: '백테스팅 시작' },
  { label: '가이드', href: '/guide', ariaLabel: '사용법 가이드' },
  { label: '소개', href: '/about', ariaLabel: 'OMC 소개' },
]

// Navbar 컴포넌트: PillNav 기반 네비게이션
const Navbar = () => {
  const location = useLocation()

  return (
    <PillNav
      logo={logo}
      logoAlt="OMC Logo"
      items={navItems}
      activeHref={location.pathname}
      className="custom-nav"
      ease="power2.easeOut"
      baseColor="rgba(15, 15, 20, 0.4)"
      pillColor="rgba(255, 255, 255, 0.08)"
      hoveredPillTextColor="#ffffff"
      pillTextColor="#e2e8f0"
      initialLoadAnimation={false}
    />
  )
}

export default Navbar
