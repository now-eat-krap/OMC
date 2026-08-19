// 차트(lightweight-charts, TradingView 위젯)에 넘길 색
//
// 캔버스/iframe 차트는 CSS 변수를 못 쓰기 때문에 값을 직접 넘겨야 한다.
// DOM에서 읽지 않고 테마 이름으로 바로 고르는 이유:
// <html data-theme> 갱신과 자식 컴포넌트의 effect 실행 순서가 어긋나면
// 한 박자 늦은 색이 차트에 들어가기 때문이다.
//
// 값은 styles/index.css의 팔레트와 짝을 이룬다. 한쪽을 바꾸면 다른 쪽도 바꿀 것.

import type { ThemeName } from './ThemeContext'

export interface ChartPalette {
  /** 차트 바탕 (투명을 못 쓰는 외부 위젯용) */
  background: string
  /** 축·라벨 글자색 */
  text: string
  /** 격자선 */
  grid: string
  /** 축 테두리 */
  border: string
  /** 상승 */
  up: string
  /** 하락 */
  down: string
  /** 강조선(이동평균, 자산 곡선 등) */
  accent: string
  /** 십자선 */
  crosshair: string
}

const PALETTES: Record<ThemeName, ChartPalette> = {
  dark: {
    background: '#070809',
    text: '#8a9490',
    grid: '#161a1d',
    border: '#242b2f',
    up: '#35d08a',
    down: '#ff5a46',
    accent: '#ffb020',
    crosshair: '#57625e',
  },
  light: {
    background: '#f7f5f0',
    text: '#5f6a66',
    grid: '#eae6dc',
    border: '#dcd7ca',
    up: '#0e8c5b',
    down: '#d33b28',
    accent: '#b37400',
    crosshair: '#9aa29c',
  },
}

/** 지금 테마에 맞는 차트 색을 돌려준다 */
export function getChartPalette(theme: ThemeName): ChartPalette {
  return PALETTES[theme] ?? PALETTES.dark
}
