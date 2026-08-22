// TradingView 실시간 차트 위젯 컴포넌트
// interval, symbol, 테마를 props/컨텍스트로 받아 동적으로 변경

import { useEffect, useRef, memo } from 'react'
import type { TimeFrame } from './types'
import { useTheme } from '../../theme/useTheme'
import { getChartPalette } from '../../theme/chartColors'

// TradingView에서 사용하는 interval 형식으로 변환
const TIMEFRAME_TO_TV_INTERVAL: Record<TimeFrame, string> = {
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
  '1w': 'W',
  '1M': 'M',
}

// 자산을 TradingView 심볼 형식으로 변환
// 예: 'BTC/USDT' -> 'BINANCE:BTCUSDT'
const assetToTVSymbol = (asset: string): string => {
  const cleaned = asset.replace('/', '')
  return `BINANCE:${cleaned}`
}

interface TradingViewWidgetProps {
  symbol: string // 예: 'BTC/USDT'
  interval: TimeFrame // 예: '1d'
}

function TradingViewWidget({ symbol, interval }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 위젯은 iframe이라 CSS 변수가 닿지 않는다. 테마를 옵션으로 직접 넘긴다
  const { theme } = useTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    // 기존 위젯 제거 (심볼/인터벌/테마 변경 시 재생성)
    container.innerHTML = ''

    // 위젯 컨테이너 생성
    const widgetContainer = document.createElement('div')
    widgetContainer.className = 'tradingview-widget-container__widget'
    widgetContainer.style.height = '100%'
    widgetContainer.style.width = '100%'
    container.appendChild(widgetContainer)

    // TradingView 스크립트 생성
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true

    // TradingView 설정
    const tvSymbol = assetToTVSymbol(symbol)
    const tvInterval = TIMEFRAME_TO_TV_INTERVAL[interval]
    const palette = getChartPalette(theme)

    script.innerHTML = JSON.stringify({
      allow_symbol_change: false,
      calendar: false,
      details: false,
      hide_side_toolbar: true,
      hide_top_toolbar: true,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval: tvInterval,
      locale: 'kr',
      save_image: false,
      style: '1',
      symbol: tvSymbol,
      theme: theme === 'light' ? 'light' : 'dark',
      timezone: 'Asia/Seoul',
      backgroundColor: palette.background,
      gridColor: palette.grid,
      watchlist: [],
      withdateranges: false,
      compareSymbols: [],
      studies: [],
      autosize: true,
    })

    container.appendChild(script)

    // 클린업: 컴포넌트 언마운트 시 위젯 제거
    return () => {
      container.innerHTML = ''
    }
  }, [symbol, interval, theme]) // symbol/interval/테마 변경 시 위젯 재생성

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    />
  )
}

export default memo(TradingViewWidget)
