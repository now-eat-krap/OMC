// 랜딩 히어로의 축소 데모
//
// 영상이나 GIF 대신 실제 컴포넌트로 만든다. 화질이 해상도와 무관하게 선명하고,
// 팔레트를 그대로 쓰므로 다크와 라이트를 자동으로 따라간다.
// 조건 -> 실행 -> 결과 한 흐름을 반복 재생하며, 움직임 줄이기를 켠 사용자에게는
// 결과 상태를 정지 화면으로 보여준다.

import { useEffect, useMemo, useState } from 'react'
import { Play } from 'lucide-react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

/** 데모 진행 단계 */
type Stage = 'empty' | 'buy' | 'sell' | 'running' | 'result'

/** 각 단계에 머무는 시간 (ms) */
const TIMELINE: { stage: Stage; hold: number }[] = [
  { stage: 'empty', hold: 700 },
  { stage: 'buy', hold: 900 },
  { stage: 'sell', hold: 1000 },
  { stage: 'running', hold: 1200 },
  { stage: 'result', hold: 4200 },
]

const METRICS = [
  { label: '총 수익률', value: '+42.8%', tone: 'text-up' },
  { label: '승률', value: '61.2%', tone: 'text-ink' },
  { label: '최대 낙폭', value: '-18.4%', tone: 'text-down' },
  { label: '거래', value: '128회', tone: 'text-ink' },
]

/** 데모용 캔들. 매번 같은 모양이 나오도록 씨앗값을 고정한다 */
function useSampleCandles(count: number) {
  return useMemo(() => {
    let seed = 20260822
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }

    const rows: { open: number; close: number; high: number; low: number }[] = []
    let price = 100
    for (let i = 0; i < count; i += 1) {
      const open = price
      const close = open + (random() - 0.44) * 6.6 + 0.5
      rows.push({
        open,
        close,
        high: Math.max(open, close) + random() * 3,
        low: Math.min(open, close) - random() * 3,
      })
      price = close
    }

    const max = Math.max(...rows.map((row) => row.high)) + 2
    const min = Math.min(...rows.map((row) => row.low)) - 2
    const y = (value: number) => ((max - value) / (max - min)) * 100

    return rows.map((row) => {
      const top = y(Math.max(row.open, row.close))
      const bottom = y(Math.min(row.open, row.close))
      return {
        wickTop: y(row.high),
        wickHeight: y(row.low) - y(row.high),
        bodyTop: top,
        bodyHeight: Math.max(0.9, bottom - top),
        rising: row.close >= row.open,
      }
    })
  }, [count])
}

export default function HeroDemo() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [step, setStep] = useState(0)
  const candles = useSampleCandles(46)

  // 움직임 줄이기를 켰으면 재생하지 않고 마지막 단계(결과)를 그대로 보여준다
  const activeStep = prefersReducedMotion ? TIMELINE.length - 1 : step

  // 단계를 순서대로 돌린다
  useEffect(() => {
    if (prefersReducedMotion) {
      return
    }

    const timer = window.setTimeout(() => {
      setStep((prev) => (prev + 1) % TIMELINE.length)
    }, TIMELINE[step].hold)

    return () => window.clearTimeout(timer)
  }, [step, prefersReducedMotion])

  const { stage } = TIMELINE[activeStep]
  const showBuy = stage !== 'empty'
  const showSell = stage === 'sell' || stage === 'running' || stage === 'result'
  const isRunning = stage === 'running'
  const hasResult = stage === 'result'

  /** 나타나는 요소의 공통 전환 */
  const reveal = (visible: boolean, delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(10px)',
    transition: prefersReducedMotion
      ? undefined
      : `opacity 600ms cubic-bezier(0.32,0.72,0,1) ${delay}ms, transform 600ms cubic-bezier(0.32,0.72,0,1) ${delay}ms`,
  })

  return (
    <div className="flex h-full flex-col bg-panel" aria-hidden>
      {/* 툴바 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3.5">
        <span className="text-[13.5px] font-bold text-strong">BTC / USDT</span>
        <div className="flex items-center rounded-chip bg-raise p-1">
          <span className="px-2.5 py-1 text-[11.5px] text-muted">1시간</span>
          <span className="rounded-[7px] bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-strong">
            1일
          </span>
        </div>
        <span className="ml-auto text-[11.5px] font-light text-dim">예시 데이터</span>
        <span
          className={`flex items-center gap-1.5 rounded-chip px-4 py-1.5 text-[12.5px] font-bold transition-transform duration-500 ${
            isRunning ? 'scale-[0.97] bg-accent/70 text-accent-ink' : 'bg-accent text-accent-ink'
          }`}
        >
          <Play className="h-2.5 w-2.5" fill="currentColor" />
          {isRunning ? '실행 중' : '실행'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 차트 */}
        <div className="flex min-w-0 flex-1 flex-col px-5 py-4">
          <div className="relative flex min-h-0 flex-1 items-stretch gap-[3px]">
            {candles.map((candle, index) => (
              <div key={index} className="relative min-w-0 flex-1">
                <span
                  className="absolute left-1/2 w-px -translate-x-1/2 bg-[var(--omc-wick)]"
                  style={{ top: `${candle.wickTop}%`, height: `${candle.wickHeight}%` }}
                />
                <span
                  className={`absolute inset-x-0 rounded-[1px] ${
                    candle.rising ? 'bg-up' : 'bg-down'
                  }`}
                  style={{ top: `${candle.bodyTop}%`, height: `${candle.bodyHeight}%` }}
                />
              </div>
            ))}

            {/* 매매 시점 */}
            <span
              className="absolute h-2.5 w-2.5 rounded-full bg-up"
              style={{ left: '21%', top: '63%', ...reveal(hasResult, 100) }}
            />
            <span
              className="absolute h-2.5 w-2.5 rounded-full bg-down"
              style={{ left: '50%', top: '21%', ...reveal(hasResult, 260) }}
            />
            <span
              className="absolute h-2.5 w-2.5 rounded-full bg-up"
              style={{ left: '74%', top: '46%', ...reveal(hasResult, 420) }}
            />
          </div>
          <div className="flex justify-between pt-3 text-[11px] font-light text-dim">
            <span>2024</span>
            <span>2025</span>
            <span>2026</span>
          </div>
        </div>

        {/* 조건 */}
        <div className="hidden w-[264px] shrink-0 flex-col gap-3 border-l border-line px-5 py-4 md:flex">
          <span className="text-[12.5px] font-medium text-muted">전략 조건</span>

          <div className="rounded-card border border-line px-4 py-3" style={reveal(showBuy)}>
            <span className="text-[11.5px] font-semibold text-up">매수</span>
            <p className="pt-1.5 text-[13px] font-light leading-[1.75] text-ink">
              RSI(14)가 30 아래로 내려가면
            </p>
          </div>

          <div className="rounded-card border border-line px-4 py-3" style={reveal(showSell)}>
            <span className="text-[11.5px] font-semibold text-down">매도</span>
            <p className="pt-1.5 text-[13px] font-light leading-[1.75] text-ink">
              수익률이 5%를 넘으면
            </p>
          </div>

          <div
            className="mt-auto text-[12px] font-light leading-[1.7] text-dim"
            style={reveal(!showSell)}
          >
            지표와 기준값을 고르면 문장이 완성됩니다.
          </div>
        </div>
      </div>

      {/* 결과 */}
      <div className="grid shrink-0 grid-cols-4 border-t border-line">
        {METRICS.map((metric, index) => (
          <div
            key={metric.label}
            className={`flex flex-col gap-1.5 px-5 py-4 ${index > 0 ? 'border-l border-line' : ''}`}
          >
            <span className="text-[11.5px] font-light text-muted">{metric.label}</span>
            <span
              className={`tnum text-[20px] font-bold leading-none tracking-[-0.03em] md:text-[26px] ${metric.tone}`}
              style={reveal(hasResult, index * 90)}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
