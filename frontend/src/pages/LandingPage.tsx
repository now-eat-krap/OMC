// 랜딩 페이지 — 딥 그린
// 구성: 히어로 → 제품 화면 → 조건 문장 → 결과 지표 → 한계 → CTA
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import HeroDemo from '../components/landing/HeroDemo'

// ---------------------------------------------------------------------------
// 조각들
// ---------------------------------------------------------------------------

/** 화살표가 자체 원 안에 들어가는 알약형 CTA */
function CtaPill({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="cta-pill bg-accent text-accent-ink">
      {children}
      <span className="cta-dot bg-accent-ink/15">
        <svg
          width="14"
          height="12"
          viewBox="0 0 14 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 6h11M7.5 1.5L12 6l-4.5 4.5" />
        </svg>
      </span>
    </Link>
  )
}

/** 바깥 트레이 + 안쪽 코어 (이중 베젤) */
function Tray({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`tray ${className}`}>
      <div className="core h-full bg-panel">{children}</div>
    </div>
  )
}

/** 조건 문장 한 줄 */
function ConditionRow({ side, children }: { side: 'buy' | 'sell'; children: ReactNode }) {
  return (
    <Tray>
      <div className="flex items-center gap-5 px-7 py-8 md:px-9">
        <span
          className={`w-11 shrink-0 font-mono text-[11.5px] font-semibold tracking-[0.14em] ${
            side === 'buy' ? 'text-up' : 'text-down'
          }`}
        >
          {side === 'buy' ? '매수' : '매도'}
        </span>
        <span className="text-lg font-extralight leading-[1.7] text-ink md:text-xl">
          {children}
        </span>
      </div>
    </Tray>
  )
}

/** 결과 지표 한 칸 */
function Metric({
  label,
  value,
  sub,
  tone = 'text-ink',
}: {
  label: string
  value: string
  sub: string
  tone?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-[13.5px] font-light text-muted">{label}</span>
      <span
        className={`tnum text-[44px] font-bold leading-none tracking-[-0.05em] md:text-[56px] ${tone}`}
      >
        {value}
      </span>
      <span className="h-px bg-line" />
      <span className="text-xs font-light text-dim">{sub}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="relative min-h-full overflow-hidden bg-canvas text-ink">
      {/* 배경 글로우와 그레인 */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-340px] h-[900px] w-[1040px] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, var(--omc-glow), transparent 60%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-300px] top-[1720px] h-[760px] w-[760px] rounded-full"
        style={{ background: 'radial-gradient(circle, var(--omc-glow), transparent 62%)' }}
      />
      <div aria-hidden className="grain" />

      <div className="relative">
        <Navbar />

        {/* ===== 히어로 ===== */}
        <section className="flex flex-col items-center gap-8 px-6 pt-24 text-center md:px-20 md:pt-36">
          <span className="rounded-full border border-line px-4 py-1.5 font-mono text-[10.5px] font-medium tracking-[0.24em] text-muted">
            BACKTESTING
          </span>
          <h1 className="max-w-[940px] text-[42px] font-bold leading-[1.16] tracking-[-0.05em] text-strong md:text-[68px] lg:text-[86px]">
            이 규칙으로 샀다면
            <br />
            지금 얼마였을까
          </h1>
          <p className="max-w-[560px] text-base font-extralight leading-[1.95] text-muted md:text-lg">
            매수와 매도 규칙을 문장으로 적으면 상장일부터의 데이터로 그대로 사고팔아 결과를
            계산합니다.
          </p>
          <div className="pt-2">
            <CtaPill to="/backtest">백테스트 시작</CtaPill>
          </div>
        </section>

        {/* ===== 제품 화면 (실제 컴포넌트로 만든 축소 데모) ===== */}
        <section className="px-6 pb-24 pt-16 md:px-20 md:pb-36 md:pt-24">
          <Tray className="rise">
            <div className="h-[430px] md:h-[560px]">
              <HeroDemo />
            </div>
          </Tray>
        </section>

        {/* ===== 조건 문장 ===== */}
        <section className="grid grid-cols-1 gap-6 px-6 pb-24 md:grid-cols-12 md:px-20 md:pb-36">
          <Tray className="rise md:col-span-5">
            <div className="flex h-full flex-col gap-6 px-9 py-12">
              <h2 className="text-[28px] font-bold leading-[1.4] tracking-[-0.035em] text-strong md:text-[34px]">
                코드 대신
                <br />
                문장으로 씁니다
              </h2>
              <p className="text-[15.5px] font-extralight leading-[2] text-muted">
                매수와 매도를 따로 세우고 AND와 OR로 엮습니다. 익절과 손절도 같은 문장으로
                들어갑니다.
              </p>
            </div>
          </Tray>

          <div className="flex flex-col gap-6 md:col-span-7">
            <ConditionRow side="buy">
              RSI(14)가 <span className="font-normal text-accent">30</span> 아래로 내려가고, 종가가{' '}
              <span className="font-normal text-accent">MA(60)</span> 위에 있으면
            </ConditionRow>
            <ConditionRow side="sell">
              수익률이 <span className="font-normal text-accent">5%</span>를 넘거나, RSI(14)가{' '}
              <span className="font-normal text-accent">70</span>을 넘으면
            </ConditionRow>
            <Tray className="flex-1">
              <div className="flex h-full items-center justify-between gap-6 px-9 py-8">
                <p className="max-w-[300px] text-sm font-extralight leading-[1.9] text-muted">
                  지표 비교, 교차, 익절·손절, 밴드, 캔들 패턴, 거래량. 조건 템플릿 열 가지를
                  말로 적어도 됩니다. AI가 위 문장으로 바꿔 줍니다.
                </p>
                <span className="tnum text-[52px] font-bold leading-none tracking-[-0.05em] text-accent">
                  10
                </span>
              </div>
            </Tray>
          </div>
        </section>

        {/* ===== 결과 지표 ===== */}
        <section className="px-6 pb-24 md:px-20 md:pb-36">
          <div className="flex items-baseline justify-between gap-6 pb-12 md:pb-16">
            <h2 className="text-[32px] font-bold tracking-[-0.04em] text-strong md:text-[44px]">
              실행하면 남는 것
            </h2>
            <span className="shrink-0 text-[13px] font-light text-dim">예시 데이터입니다</span>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-6">
            <Metric label="총 수익률" value="+42.8%" sub="428,140 USDT" tone="text-up" />
            <Metric label="승률" value="61.2%" sub="78승 50패" />
            <Metric label="최대 낙폭" value="-18.4%" sub="2025년 3월" tone="text-down" />
            <Metric label="단순 보유와 차이" value="+11.3" sub="퍼센트포인트" />
          </div>
        </section>

        {/* ===== 한계 ===== */}
        <section className="flex flex-col items-center gap-10 px-6 pb-24 text-center md:px-20 md:pb-36">
          <h2 className="max-w-[780px] text-[28px] font-bold leading-[1.45] tracking-[-0.04em] text-strong md:text-[40px]">
            과거에 맞았다는 사실이 앞으로도 맞는다는 뜻은 아닙니다
          </h2>
          <p className="max-w-[640px] text-base font-extralight leading-[2.1] text-muted md:text-[16.5px]">
            기준값을 조금씩 바꿔 과거 수익률만 끌어올린 전략은 대개 다음 달에 무너집니다. 신호가
            잦으면 수수료만으로 수익이 사라지고, 상승장만 담긴 기간에서는 거의 모든 전략이 좋아
            보입니다. 그래서 결과 옆에 그냥 사서 들고 있었을 때의 값을 항상 같이 놓습니다.
          </p>
        </section>

        {/* ===== CTA ===== */}
        <section className="px-6 pb-20 md:px-20 md:pb-28">
          <Tray>
            <div className="flex flex-col items-center gap-8 px-8 py-20 md:px-16 md:py-28">
              <h2 className="text-center text-[34px] font-bold leading-[1.2] tracking-[-0.045em] text-strong md:text-[52px]">
                머릿속 규칙 하나면
                <br />
                충분합니다
              </h2>
              <p className="text-center text-base font-extralight text-muted">
                종목과 조건을 고르고 실행하면 결과는 1초 안에 나옵니다.
              </p>
              <CtaPill to="/backtest">백테스트 시작</CtaPill>
            </div>
          </Tray>
        </section>

        {/* ===== 푸터 ===== */}
        <footer className="flex flex-col items-center justify-between gap-4 px-6 pb-14 text-[13px] font-light text-dim md:flex-row md:px-20">
          <span>OMC</span>
          <div className="flex gap-7">
            <Link to="/guide" className="text-dim transition-colors hover:text-ink">
              가이드
            </Link>
            <Link to="/about" className="text-dim transition-colors hover:text-ink">
              소개
            </Link>
            <span>문의</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
