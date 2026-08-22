import { Link } from 'react-router-dom'

interface LogoProps {
  /** 마크만 보여줄지 (좁은 화면용) */
  markOnly?: boolean
  className?: string
}

/**
 * OMC 마크와 워드마크.
 * 마크는 코인(원)과 그 위를 지나는 상승 궤적입니다.
 * 색은 팔레트를 따르므로 다크와 라이트 모두에서 그대로 쓸 수 있습니다.
 */
export default function Logo({ markOnly = false, className = '' }: LogoProps) {
  return (
    <Link
      to="/"
      title="OMC 홈으로"
      className={`flex items-center gap-2.5 whitespace-nowrap ${className}`}
    >
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <circle cx="16" cy="16" r="9.5" className="fill-accent" />
        <path
          d="M8.5 20.5 L13.5 15 L17.5 18 L23.5 10.5"
          fill="none"
          stroke="var(--omc-bg)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!markOnly && (
        <span className="text-[17px] font-bold tracking-[-0.02em] text-strong">OMC</span>
      )}
    </Link>
  )
}
