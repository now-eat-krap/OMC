// 서버 지표 레지스트리를 한 번 받아 앱 전체에서 공유한다.
//
// 선택지·파라미터 슬롯·차트 힌트는 전부 여기서 나온다. 백엔드에 지표가 추가되면
// 프론트 코드를 고치지 않아도 선택지에 나타난다.
//
// 요청이 실패하면(옛 백엔드, 네트워크) 아래 FALLBACK 으로 동작한다. 이 목록은 서버
// 레지스트리의 사본이지 원본이 아니다. 새 지표는 서버에만 넣으면 된다.

import { useEffect, useState } from 'react'
import { fetchIndicators } from '../services/api'
import type { IndicatorSpec } from '../components/backtest/types'

const period = (def: number, max = 500): IndicatorSpec['params'][number] => ({
  name: 'period',
  label: '기간',
  default: def,
  min: 1,
  max,
  step: 1,
  integer: true,
})

export const FALLBACK_INDICATORS: IndicatorSpec[] = [
  {
    name: 'RSI',
    label: 'RSI',
    description: '',
    display: 'pane',
    valueRange: [0, 100],
    templates: ['indicator_vs_value'],
    bandType: null,
    params: [period(14, 200)],
    outputs: [{ key: 'value', label: 'RSI', role: 'line' }],
  },
  {
    name: 'SMA',
    label: 'SMA',
    description: '',
    display: 'overlay',
    valueRange: null,
    templates: ['indicator_vs_value', 'indicator_cross', 'price_cross'],
    bandType: null,
    params: [period(20)],
    outputs: [{ key: 'value', label: 'SMA', role: 'line' }],
  },
  {
    name: 'EMA',
    label: 'EMA',
    description: '',
    display: 'overlay',
    valueRange: null,
    templates: ['indicator_vs_value', 'indicator_cross', 'price_cross'],
    bandType: null,
    params: [period(20)],
    outputs: [{ key: 'value', label: 'EMA', role: 'line' }],
  },
  {
    name: 'MACD',
    label: 'MACD',
    description: '',
    display: 'pane',
    valueRange: null,
    templates: ['indicator_vs_value', 'macd_signal'],
    bandType: null,
    params: [
      { name: 'fast', label: '단기', default: 12, min: 1, max: 200, step: 1, integer: true },
      { name: 'slow', label: '장기', default: 26, min: 2, max: 500, step: 1, integer: true },
      { name: 'signal', label: '시그널', default: 9, min: 1, max: 200, step: 1, integer: true },
    ],
    outputs: [
      { key: 'macd', label: 'MACD', role: 'line' },
      { key: 'signal', label: '시그널', role: 'signal' },
      { key: 'histogram', label: '히스토그램', role: 'histogram' },
    ],
  },
  {
    name: 'BB',
    label: '볼린저밴드',
    description: '',
    display: 'overlay',
    valueRange: null,
    templates: ['indicator_vs_value', 'band_touch'],
    bandType: 'bollinger',
    params: [
      period(20),
      { name: 'std', label: '표준편차 배수', default: 2, min: 0.1, max: 10, step: 0.1, integer: false },
    ],
    outputs: [
      { key: 'middle', label: '중간', role: 'band_middle' },
      { key: 'upper', label: '상단', role: 'band_upper' },
      { key: 'lower', label: '하단', role: 'band_lower' },
    ],
  },
  {
    name: 'KELTNER',
    label: '켈트너채널',
    description: '',
    display: 'overlay',
    valueRange: null,
    templates: ['band_touch'],
    bandType: 'keltner',
    params: [
      period(20),
      { name: 'multiplier', label: 'ATR 배수', default: 2, min: 0.1, max: 10, step: 0.1, integer: false },
    ],
    outputs: [
      { key: 'middle', label: '중간', role: 'band_middle' },
      { key: 'upper', label: '상단', role: 'band_upper' },
      { key: 'lower', label: '하단', role: 'band_lower' },
    ],
  },
  {
    name: 'ENVELOPE',
    label: '엔벨로프',
    description: '',
    display: 'overlay',
    valueRange: null,
    templates: ['band_touch'],
    bandType: 'envelope',
    params: [
      period(20),
      { name: 'percent', label: '폭 (%)', default: 10, min: 0.1, max: 50, step: 0.1, integer: false },
    ],
    outputs: [
      { key: 'middle', label: '중간', role: 'band_middle' },
      { key: 'upper', label: '상단', role: 'band_upper' },
      { key: 'lower', label: '하단', role: 'band_lower' },
    ],
  },
  {
    name: 'STOCH',
    label: '스토캐스틱',
    description: '',
    display: 'pane',
    valueRange: [0, 100],
    templates: ['indicator_vs_value', 'stochastic'],
    bandType: null,
    params: [
      period(14, 200),
      { name: 'smooth_k', label: '%K 스무딩', default: 3, min: 1, max: 50, step: 1, integer: true },
      { name: 'smooth_d', label: '%D 스무딩', default: 3, min: 1, max: 50, step: 1, integer: true },
    ],
    outputs: [
      { key: 'k', label: '%K', role: 'k' },
      { key: 'd', label: '%D', role: 'd' },
    ],
  },
]

// 모듈 단위로 한 번만 받는다
let cached: IndicatorSpec[] | null = null
let inflight: Promise<IndicatorSpec[]> | null = null

function load(): Promise<IndicatorSpec[]> {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = fetchIndicators()
      .then((specs) => {
        cached = specs
        return specs
      })
      .catch(() => {
        cached = FALLBACK_INDICATORS
        return FALLBACK_INDICATORS
      })
  }
  return inflight
}

export function useIndicators(): IndicatorSpec[] {
  const [specs, setSpecs] = useState<IndicatorSpec[]>(cached ?? FALLBACK_INDICATORS)
  useEffect(() => {
    let alive = true
    load().then((s) => {
      if (alive) setSpecs(s)
    })
    return () => {
      alive = false
    }
  }, [])
  return specs
}

export function findSpec(specs: IndicatorSpec[], name: string | undefined): IndicatorSpec | undefined {
  if (!name) return undefined
  const upper = name.toUpperCase()
  const alias = upper === 'MA' ? 'SMA' : upper
  return specs.find((s) => s.name === alias)
}

export function findBandSpec(specs: IndicatorSpec[], bandType: string | undefined): IndicatorSpec | undefined {
  return specs.find((s) => s.bandType === (bandType || 'bollinger'))
}

/** 조건의 params 를 스펙 기준으로 채운다. params 가 없으면 옛 필드(기간)로 첫 파라미터를 */
export function resolveParams(
  spec: IndicatorSpec | undefined,
  params: Record<string, number> | undefined,
  legacyPeriod: number | undefined
): Record<string, number> {
  if (!spec) return params ?? {}
  const out: Record<string, number> = {}
  spec.params.forEach((p, i) => {
    const fromParams = params?.[p.name]
    out[p.name] =
      fromParams !== undefined ? fromParams : i === 0 && legacyPeriod !== undefined ? legacyPeriod : p.default
  })
  return out
}

/** 표시용 "RSI(14)", "MACD(12,26,9)", "볼린저밴드(20, 2)" */
export function formatIndicatorLabel(
  spec: IndicatorSpec | undefined,
  name: string | undefined,
  params: Record<string, number> | undefined,
  legacyPeriod: number | undefined
): string {
  if (!spec) return `${name ?? ''}(${legacyPeriod ?? ''})`
  const p = resolveParams(spec, params, legacyPeriod)
  return `${spec.name}(${spec.params.map((x) => p[x.name]).join(',')})`
}
