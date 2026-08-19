// 랜딩 페이지 — 터미널 방향
// 구성: 히어로 → 실행 결과 패널 → 01 작동 방식 → 02 조건 문장 → 03 지원 범위 → 04 한계 → CTA
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'

// ---------------------------------------------------------------------------
// 조각들
// ---------------------------------------------------------------------------

/** 섹션 머리 — 라벨 + 가로줄 */
function SectionLabel({ children, trailing }: { children: string; trailing?: string }) {
  return (
    <div className="flex items-center gap-5 pb-11">
      <span className="font-mono text-[11px] tracking-[0.28em] text-accent whitespace-nowrap">
        {children}
      </span>
      <span className="flex-1 h-px bg-line" />
      {trailing && <span className="text-[13px] text-dim whitespace-nowrap">{trailing}</span>}
    </div>
  )
}

/** 01 / 02 / 03 단계 행 */
function StepRow({
  no,
  title,
  children,
  last = false,
}: {
  no: string
  title: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={`flex flex-col md:flex-row gap-4 md:gap-14 py-8 md:py-10 border-t border-line ${
        last ? 'border-b' : ''
      }`}
    >
      <span className="md:w-[132px] shrink-0 font-mono text-[40px] md:text-[56px] leading-[0.9] tracking-[-0.03em] text-dim">
        {no}
      </span>
      <h3 className="md:w-[320px] shrink-0 text-[22px] md:text-[27px] font-semibold leading-[1.45] tracking-[-0.02em] text-strong">
        {title}
      </h3>
      <p className="flex-1 text-[15px] md:text-base leading-[1.95] text-muted">{children}</p>
    </div>
  )
}

/** 03 지원 범위 열 */
function SupportColumn({
  label,
  items,
  first = false,
}: {
  label: string
  items: string[]
  first?: boolean
}) {
  return (
    <div
      className={`flex-1 flex flex-col gap-4 ${first ? 'md:pr-10' : 'md:px-10 md:border-l border-line'}`}
    >
      <span className="label">{label}</span>
      <div className="text-[15px] md:text-base leading-[2.1] text-ink">
        {items.map((item) => (
          <div key={item}>{item}</div>
        ))}
      </div>
    </div>
  )
}

// 02 구역에서 고를 수 있는 지표들
const INDICATORS = [
  {
    key: 'rsi',
    label: 'RSI',
    tag: '과매수 과매도',
    sentence: 'RSI(14)가 30 아래로 내려가면 매수한다',
    what: '최근 14개 캔들의 상승분과 하락분을 견줘 0에서 100 사이 값으로 만듭니다. 낮을수록 많이 밀렸다는 뜻입니다.',
    when: '눌린 자리에서 되돌림을 노리는 역추세 매매에 씁니다. 추세가 강할 때는 낮은 값이 오래 이어질 수 있습니다.',
  },
  {
    key: 'macd',
    label: 'MACD',
    tag: '추세 전환',
    sentence: 'MACD가 시그널선을 위로 뚫으면 매수한다',
    what: '길고 짧은 두 이동평균의 간격을 그린 선입니다. 시그널선과의 교차로 흐름이 바뀌는 지점을 잡습니다.',
    when: '추세를 따라가는 매매에 씁니다. 횡보 구간에서는 교차가 잦아 신호가 많아집니다.',
  },
  {
    key: 'bb',
    label: '볼린저밴드',
    tag: '변동성',
    sentence: '종가가 볼린저 하단 아래로 내려가면 매수한다',
    what: '이동평균을 가운데 두고 변동성만큼 위아래로 벌린 띠입니다. 띠 바깥은 평소보다 크게 움직였다는 뜻입니다.',
    when: '변동성이 커진 뒤 평균으로 돌아오길 기대할 때 씁니다. 추세장에서는 띠를 타고 계속 밀릴 수 있습니다.',
  },
  {
    key: 'ma',
    label: '이동평균',
    tag: '추세 방향',
    sentence: 'MA(20)이 MA(60)을 위로 뚫으면 매수한다',
    what: '정해진 기간의 평균 가격입니다. 짧은 평균이 긴 평균을 넘어서면 흐름이 위로 돌았다고 봅니다.',
    when: '방향이 분명한 구간에서 오래 들고 가는 전략에 씁니다. 신호가 늦은 대신 잔신호가 적습니다.',
  },
] as const

const CAVEATS = [
  {
    term: '과최적화',
    body: '숫자를 계속 바꿔 과거 수익률만 끌어올린 전략은 대개 다음 달에 무너집니다. 조건은 단순할수록 오래 갑니다.',
  },
  {
    term: '거래 비용',
    body: '신호가 잦은 전략은 수수료만으로 수익이 사라집니다. 그래서 수수료와 슬리피지를 처음부터 계산에 넣습니다.',
  },
  {
    term: '구간 편향',
    body: '상승장만 담긴 기간에서는 대부분의 전략이 잘 나옵니다. 하락장을 포함한 전 구간으로 다시 돌려보세요.',
  },
]

// ---------------------------------------------------------------------------

export default function LandingPage() {
  const [indicatorKey, setIndicatorKey] = useState<string>('rsi')
  const active = INDICATORS.find((item) => item.key === indicatorKey) ?? INDICATORS[0]

  return (
    <div className="min-h-full bg-canvas text-ink">
      <Navbar />

      {/* ===== 히어로 ===== */}
      <section className="px-6 md:px-14 pt-16 md:pt-26 flex flex-col gap-9">
        <div className="flex items-center gap-5">
          <span className="font-mono text-[11px] tracking-[0.28em] text-accent whitespace-nowrap">
            STRATEGY BACKTESTING ENGINE
          </span>
          <span className="flex-1 h-px bg-line" />
          <span className="hidden md:inline font-mono text-[11px] tracking-[0.14em] text-dim whitespace-nowrap">
            BINANCE SPOT · 2017 → NOW
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-15">
          <h1 className="text-[40px] md:text-[64px] lg:text-[82px] font-bold leading-[1.08] tracking-[-0.035em] text-strong">
            조건을 문장으로 쓰면
            <br />
            과거가 대답한다
          </h1>
          <p className="lg:w-[300px] shrink-0 text-base leading-[1.9] text-muted lg:pb-2.5">
            RSI, MACD, 볼린저밴드를 문장처럼 조합해 매수·매도 규칙을 세우고, 그대로 과거 데이터에
            돌립니다. 코드는 한 줄도 필요하지 않습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 md:gap-5 pt-2">
          <Link
            to="/backtest"
            className="flex items-center gap-3 bg-accent text-accent-ink text-base font-semibold px-8 py-4.5 hover:opacity-90 transition-opacity"
          >
            백테스팅 시작
            <svg
              width="17"
              height="13"
              viewBox="0 0 17 13"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 6.5h13.5M10 1.5l5 5-5 5" />
            </svg>
          </Link>
          <Link
            to="/guide"
            className="text-[15px] text-ink border-b border-dim pb-1 hover:border-accent transition-colors"
          >
            가이드 먼저 보기
          </Link>
          <div className="hidden md:flex ml-auto gap-6 font-mono text-[11px] tracking-[0.1em] text-dim">
            <span>계정 없음</span>
            <span>결제 없음</span>
            <span>설치 없음</span>
          </div>
        </div>
      </section>

      {/* ===== 실행 결과 패널 ===== */}
      <section className="px-6 md:px-14 pt-14 md:pt-19 pb-16 md:pb-26">
        <div className="border border-line bg-panel">
          <div className="flex items-center justify-between px-5 md:px-7 py-4 border-b border-line">
            <div className="flex items-center gap-4 md:gap-5">
              <span className="font-mono text-[13px] font-medium text-strong">BTC/USDT</span>
              <span className="font-mono text-[11px] tracking-[0.14em] text-muted">
                1D · 2017-08-17 → 2026-08-17
              </span>
            </div>
            <span className="font-mono text-[11px] tracking-[0.14em] text-up whitespace-nowrap">
              ● COMPLETE 0.42s
            </span>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* 조건 */}
            <div className="lg:w-[420px] shrink-0 p-7 lg:border-r border-b lg:border-b-0 border-line flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-up">BUY WHEN</span>
                <p className="text-[17px] md:text-lg leading-[1.7] text-ink">
                  RSI(14)가 <span className="font-mono text-accent">30</span> 아래로 내려가고,
                  <br />
                  종가가 <span className="font-mono text-accent">MA(60)</span> 위에 있으면
                </p>
              </div>
              <div className="h-px bg-hair" />
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-down">SELL WHEN</span>
                <p className="text-[17px] md:text-lg leading-[1.7] text-ink">
                  수익률이 <span className="font-mono text-accent">5%</span>를 넘거나,
                  <br />
                  RSI(14)가 <span className="font-mono text-accent">70</span>을 넘으면
                </p>
              </div>
            </div>

            {/* 자산 곡선 */}
            <div className="flex-1 min-w-0 p-6 md:p-7 flex flex-col gap-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="label">EQUITY CURVE</span>
                <div className="flex gap-5 font-mono text-[11px] text-muted">
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-accent" />이 전략
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-px bg-dim" />
                    단순 보유
                  </span>
                </div>
              </div>
              <svg
                viewBox="0 0 620 210"
                preserveAspectRatio="none"
                className="w-full h-[180px] md:h-[210px]"
              >
                <line x1="0" y1="52" x2="620" y2="52" stroke="var(--omc-hair)" strokeWidth={1} />
                <line x1="0" y1="104" x2="620" y2="104" stroke="var(--omc-hair)" strokeWidth={1} />
                <line x1="0" y1="156" x2="620" y2="156" stroke="var(--omc-hair)" strokeWidth={1} />
                <polyline
                  points="0,182 52,170 104,188 156,142 208,156 260,112 312,130 364,84 416,100 468,54 520,70 572,26 620,16"
                  fill="none"
                  stroke="var(--omc-accent)"
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                />
                <polyline
                  points="0,192 78,184 155,186 232,168 310,158 388,146 466,136 543,128 620,120"
                  fill="none"
                  stroke="var(--omc-dim)"
                  strokeWidth={1.4}
                  strokeDasharray="5 5"
                />
              </svg>
            </div>
          </div>

          {/* 지표 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-line">
            {[
              { label: 'TOTAL RETURN', value: '+42.8%', tone: 'text-up' },
              { label: 'WIN RATE', value: '61.2%', tone: 'text-ink' },
              { label: 'MAX DRAWDOWN', value: '-18.4%', tone: 'text-down' },
              { label: 'TRADES', value: '128', tone: 'text-ink' },
            ].map((metric, index) => (
              <div
                key={metric.label}
                className={`px-6 md:px-7 py-6 flex flex-col gap-2 border-line ${
                  index > 0 ? 'border-l' : ''
                } ${index >= 2 ? 'border-t lg:border-t-0' : ''}`}
              >
                <span className="label">{metric.label}</span>
                <span
                  className={`font-mono tnum text-[30px] md:text-[44px] font-medium leading-none tracking-[-0.02em] ${metric.tone}`}
                >
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 01 작동 방식 ===== */}
      <section className="px-6 md:px-14 pb-16 md:pb-27">
        <SectionLabel>01 — 어떻게 작동하나</SectionLabel>
        <StepRow no="01" title="문장으로 규칙을 적는다">
          지표와 숫자를 고르면 <span className="text-ink">‘RSI가 30 아래로 내려가면 산다’</span>{' '}
          같은 문장이 완성됩니다. 조건은 AND와 OR로 엮고, 매수와 매도를 따로 세웁니다.
        </StepRow>
        <StepRow no="02" title="과거를 하루씩 되짚는다">
          상장일부터의 캔들을 순서대로 지나가며 조건이 맞는 시점에 실제로 사고팝니다.{' '}
          <span className="text-ink">수수료와 슬리피지</span>도 빠짐없이 반영합니다.
        </StepRow>
        <StepRow no="03" title="숫자로 남는다" last>
          수익률과 승률, 최대 낙폭, 매매 하나하나의 기록까지 남습니다.{' '}
          <span className="text-ink">그냥 사서 들고 있었을 때</span>와 나란히 비교합니다.
        </StepRow>
      </section>

      {/* ===== 02 조건 문장 ===== */}
      <section className="px-6 md:px-14 pb-16 md:pb-27">
        <SectionLabel trailing="지표를 눌러보세요">02 — 조건 문장</SectionLabel>
        <div className="flex flex-col md:flex-row border border-line">
          <div className="md:w-[260px] shrink-0 md:border-r border-line flex md:block overflow-x-auto">
            {INDICATORS.map((item) => {
              const on = item.key === indicatorKey
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setIndicatorKey(item.key)}
                  className={`flex flex-col gap-1.5 items-start text-left px-6 py-5.5 w-full border-b border-line whitespace-nowrap transition-colors ${
                    on
                      ? 'bg-wash shadow-[inset_3px_0_0_var(--omc-accent)] text-strong'
                      : 'bg-transparent text-ink hover:text-strong'
                  }`}
                >
                  <span className="font-mono text-[15px] font-medium">{item.label}</span>
                  <span className="text-xs text-muted">{item.tag}</span>
                </button>
              )
            })}
          </div>
          <div className="flex-1 min-w-0 bg-panel p-7 md:p-11 flex flex-col gap-7 md:gap-8">
            <p className="text-[24px] md:text-[34px] font-semibold leading-[1.55] tracking-[-0.02em] text-strong">
              {active.sentence}
            </p>
            <div className="flex flex-col md:flex-row gap-7 md:gap-14">
              <div className="flex-1 flex flex-col gap-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-accent">
                  무엇을 보는가
                </span>
                <p className="text-[15px] leading-[1.95] text-muted">{active.what}</p>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-accent">
                  언제 쓰는가
                </span>
                <p className="text-[15px] leading-[1.95] text-muted">{active.when}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 03 지원 범위 ===== */}
      <section className="px-6 md:px-14 pb-16 md:pb-27">
        <SectionLabel>03 — 지원 범위</SectionLabel>
        <div className="flex flex-col md:flex-row gap-8 md:gap-0">
          <SupportColumn
            first
            label="지표"
            items={['RSI', 'MACD', '이동평균', '볼린저밴드', '스토캐스틱', '거래량 · ATR']}
          />
          <SupportColumn label="타임프레임" items={['15분', '1시간', '4시간', '1일']} />
          <SupportColumn label="데이터" items={['바이낸스 현물', '상장일 → 어제', '15분봉 캐시']} />
          <SupportColumn
            label="비용 반영"
            items={['수수료', '슬리피지', '진입 비중', '손절 · 익절']}
          />
        </div>
      </section>

      {/* ===== 04 한계 ===== */}
      <section className="px-6 md:px-14 pb-16 md:pb-27">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 items-start">
          <div className="lg:w-[440px] shrink-0 flex flex-col gap-6">
            <span className="font-mono text-[11px] tracking-[0.28em] text-accent">
              04 — 정직하게
            </span>
            <h2 className="text-[30px] md:text-[40px] font-bold leading-[1.3] tracking-[-0.03em] text-strong">
              백테스트는 미래를 약속하지 않습니다
            </h2>
            <p className="text-[15px] leading-[1.95] text-muted">
              과거에 잘 맞았다는 사실은 앞으로도 맞는다는 뜻이 아닙니다. 그래서 결과를 보기 전에
              함정부터 알려드립니다.
            </p>
          </div>
          <div className="flex-1 flex flex-col">
            {CAVEATS.map((item, index) => (
              <div
                key={item.term}
                className={`flex flex-col md:flex-row gap-2 md:gap-7 py-6 border-t border-line ${
                  index === CAVEATS.length - 1 ? 'border-b' : ''
                }`}
              >
                <span className="md:w-24 shrink-0 font-mono text-xs tracking-[0.1em] text-accent md:pt-1">
                  {item.term}
                </span>
                <p className="flex-1 text-[15px] leading-[1.95] text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-wash border-y border-line px-6 md:px-14 py-14 md:py-18 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <div className="flex flex-col gap-3.5">
          <h2 className="text-[32px] md:text-[46px] font-bold leading-[1.2] tracking-[-0.035em] text-strong">
            머릿속 규칙 하나면 됩니다
          </h2>
          <p className="text-base text-muted">
            종목과 조건을 고르고 실행하면, 결과는 1초 안에 나옵니다.
          </p>
        </div>
        <Link
          to="/backtest"
          className="shrink-0 self-start flex items-center gap-3 bg-accent text-accent-ink text-[17px] font-semibold px-10 py-5 hover:opacity-90 transition-opacity"
        >
          백테스팅 시작
          <svg
            width="17"
            height="13"
            viewBox="0 0 17 13"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 6.5h13.5M10 1.5l5 5-5 5" />
          </svg>
        </Link>
      </section>

      {/* ===== 푸터 ===== */}
      <footer className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 md:px-14 py-8 font-mono text-[11px] tracking-[0.1em] text-dim">
        <span>OMC_ · ONE MORE COIN</span>
        <div className="flex gap-7">
          <Link to="/guide" className="text-dim hover:text-ink transition-colors">
            GUIDE
          </Link>
          <Link to="/about" className="text-dim hover:text-ink transition-colors">
            ABOUT
          </Link>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  )
}
