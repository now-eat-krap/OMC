// 백테스트 결과 차트 컴포넌트
// lightweight-charts v5 Pane API 사용 - 단일 차트 내 다중 패널
// 캔들 차트 + 매수/매도 마커 + 지표 오버레이 + RSI/MACD 하단 패널

import {
  useEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
} from 'lightweight-charts'
import type {
  IChartApi,
  CandlestickData,
  Time,
  LineData,
  SeriesMarker,
  HistogramData,
  MouseEventParams,
} from 'lightweight-charts'
import type { TradeRecord, OHLCVData, IndicatorData } from './types'

// 외부에서 사용할 수 있는 차트 핸들 인터페이스
export interface BacktestChartHandle {
  /** ISO 문자열 시간으로 차트를 스크롤 (해당 시점을 화면 중앙에 표시) */
  scrollToTime: (isoString: string) => void
}

interface BacktestChartProps {
  /** OHLCV 캔들 데이터 */
  ohlcv: OHLCVData[]
  /** 거래 내역 (매수/매도 마커용) */
  trades?: TradeRecord[]
  /** 지표 데이터 (오버레이용) */
  indicators?: IndicatorData[]
  /** 차트 높이 (기본 100%) */
  height?: string
}

// 호버 데이터 타입
interface HoverData {
  time: string
  open: number
  high: number
  low: number
  close: number
  change: number
  changePercent: number
  indicatorValues: { name: string; value: number; color: string }[]
}

// 타임스탬프를 lightweight-charts Time 형식으로 변환
function toChartTime(timestamp: number): Time {
  return (timestamp / 1000) as Time
}

// ISO 문자열을 lightweight-charts Time 형식으로 변환
function isoToChartTime(isoString: string): Time {
  const date = new Date(isoString)
  return (date.getTime() / 1000) as Time
}

// 지표 색상 팔레트
const INDICATOR_COLORS: Record<string, string> = {
  sma: '#f59e0b', // 노란색
  ema: '#8b5cf6', // 보라색
  rsi: '#06b6d4', // 청록색
  macd: '#10b981', // 초록색
  bb: '#ec4899', // 분홍색
  stoch: '#3b82f6', // 파란색
}

// 동일 타입 지표 구분용 추가 색상 (두 번째, 세 번째... 지표용)
const INDICATOR_COLOR_VARIANTS: Record<string, string[]> = {
  sma: ['#f59e0b', '#06b6d4', '#ec4899', '#10b981'], // 노란색, 청록색, 분홍색, 초록색
  ema: ['#8b5cf6', '#fbbf24', '#22d3ee', '#f472b6'], // 보라색, 밝은노란, 밝은청록, 밝은분홍
}

const BacktestChart = forwardRef<BacktestChartHandle, BacktestChartProps>(
  ({ ohlcv, trades = [], indicators = [], height = '100%' }, ref) => {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)

    // 호버 데이터 상태
    const [hoverData, setHoverData] = useState<HoverData | null>(null)

    // 외부에서 사용할 수 있는 메서드 노출
    useImperativeHandle(
      ref,
      () => ({
        scrollToTime: (isoString: string) => {
          if (!chartRef.current) {
            return
          }

          // ISO 문자열을 타임스탬프로 변환
          const timestamp = new Date(isoString).getTime() / 1000

          const timeScale = chartRef.current.timeScale()
          const visibleRange = timeScale.getVisibleRange()

          if (visibleRange) {
            // 현재 보이는 범위의 너비를 유지하면서 해당 시간을 가운데로 이동
            const rangeWidth = (visibleRange.to as number) - (visibleRange.from as number)
            const halfWidth = rangeWidth / 2

            timeScale.setVisibleRange({
              from: (timestamp - halfWidth) as Time,
              to: (timestamp + halfWidth) as Time,
            })
          } else {
            // 범위가 없으면 해당 시간으로 스크롤
            timeScale.scrollToPosition(-10, true)
          }
        },
      }),
      []
    )

    // OHLCV 데이터를 타임스탬프로 인덱싱
    const ohlcvMap = useMemo(() => {
      const map = new Map<number, OHLCVData>()
      ohlcv.forEach((candle) => {
        map.set(Math.floor(candle.timestamp / 1000), candle)
      })
      return map
    }, [ohlcv])

    // 보조지표 (RSI, MACD, 스토캐스틱) 분리
    const { priceIndicators, oscillatorIndicators } = useMemo(() => {
      const price: IndicatorData[] = []
      const oscillator: IndicatorData[] = []

      indicators.forEach((ind) => {
        if (ind.type === 'rsi' || ind.type === 'macd' || ind.type === 'stoch') {
          oscillator.push(ind)
        } else {
          price.push(ind)
        }
      })

      return { priceIndicators: price, oscillatorIndicators: oscillator }
    }, [indicators])

    // 지표 데이터 맵 생성 (빠른 조회용)
    const indicatorMaps = useMemo(() => {
      const maps = new Map<string, Map<number, number>>()

      indicators.forEach((ind) => {
        const dataMap = new Map<number, number>()
        ind.data.forEach((d) => {
          dataMap.set(Math.floor(d.timestamp / 1000), d.value)
        })
        maps.set(ind.name, dataMap)
      })

      return maps
    }, [indicators])

    // 크로스헤어 이동 핸들러
    const handleCrosshairMove = useCallback(
      (param: MouseEventParams<Time>) => {
        if (!param.time) {
          setHoverData(null)
          return
        }

        const time = param.time as number
        const candle = ohlcvMap.get(time)

        if (!candle) {
          setHoverData(null)
          return
        }

        // 날짜 포맷
        const date = new Date(time * 1000)
        const timeStr = date.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })

        // 변동률 계산
        const change = candle.close - candle.open
        const changePercent = (change / candle.open) * 100

        // 지표값 수집 (같은 타입 지표 색상 구분)
        const indicatorValues: { name: string; value: number; color: string }[] = []
        const hoverTypeIndexMap: Record<string, number> = {}

        indicators.forEach((ind) => {
          // 지표 타입별 인덱스 증가 (색상 구분)
          if (hoverTypeIndexMap[ind.type] === undefined) {
            hoverTypeIndexMap[ind.type] = 0
          } else {
            hoverTypeIndexMap[ind.type]++
          }
          const colorIndex = hoverTypeIndexMap[ind.type]

          // 색상 변형 배열이 있으면 해당 색상 사용, 없으면 기본 색상
          const colorVariants = INDICATOR_COLOR_VARIANTS[ind.type]
          const color = colorVariants
            ? colorVariants[colorIndex % colorVariants.length]
            : INDICATOR_COLORS[ind.type] || '#ffffff'

          const dataMap = indicatorMaps.get(ind.name)
          if (dataMap) {
            const value = dataMap.get(time)
            if (value !== undefined && value > 0) {
              indicatorValues.push({
                name: ind.name,
                value,
                color,
              })
            }
          }
        })

        setHoverData({
          time: timeStr,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          change,
          changePercent,
          indicatorValues,
        })
      },
      [ohlcvMap, indicators, indicatorMaps]
    )

    useEffect(() => {
      if (!chartContainerRef.current || ohlcv.length === 0) {
        return
      }

      // 기존 차트 제거
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }

      // 단일 차트 생성 (v5 Pane API 활용)
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(255, 255, 255, 0.6)',
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(168, 85, 247, 0.5)', width: 1, style: 2 },
          horzLine: { color: 'rgba(168, 85, 247, 0.5)', width: 1, style: 2 },
        },
        rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          timeVisible: true,
          secondsVisible: false,
        },
        localization: {
          // 날짜 형식을 "년-월-일 시간" 형태로 커스터마이징
          timeFormatter: (time: number) => {
            const date = new Date(time * 1000)
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            return `${year}-${month}-${day} ${hours}:${minutes}`
          },
        },
        handleScale: { axisPressedMouseMove: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
      })

      chartRef.current = chart

      // 크로스헤어 이동 이벤트 구독
      chart.subscribeCrosshairMove(handleCrosshairMove)

      // ===== Pane 0: 메인 캔들스틱 차트 =====
      const candlestickSeries = chart.addSeries(
        CandlestickSeries,
        {
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderUpColor: '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        },
        0
      ) // Pane 0

      // OHLCV 데이터 변환 및 추가
      const candleData: CandlestickData[] = ohlcv.map((candle) => ({
        time: toChartTime(candle.timestamp),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))

      candlestickSeries.setData(candleData)

      // 매수/매도 마커 추가
      if (trades.length > 0) {
        const markers: SeriesMarker<Time>[] = trades.flatMap((trade, index) => {
          const result: SeriesMarker<Time>[] = []
          const tradeNum = index + 1 // 거래 번호 (1부터 시작)

          if (trade.entryTime) {
            result.push({
              time: isoToChartTime(trade.entryTime),
              position: 'belowBar',
              color: '#22c55e',
              shape: 'arrowUp',
              text: `매수 #${tradeNum}`,
            })
          }

          if (trade.exitTime) {
            result.push({
              time: isoToChartTime(trade.exitTime),
              position: 'aboveBar',
              color: '#ef4444',
              shape: 'arrowDown',
              text: `매도 #${tradeNum}`,
            })
          }

          return result
        })

        markers.sort((a, b) => (a.time as number) - (b.time as number))
        createSeriesMarkers(candlestickSeries, markers)
      }

      // 가격 오버레이 지표 (Pane 0 - SMA, EMA, BB)
      // 같은 타입 지표 인덱스 추적 (색상 구분용)
      const typeIndexMap: Record<string, number> = {}

      priceIndicators.forEach((indicator) => {
        // 지표 타입별 인덱스 증가 (색상 구분)
        if (typeIndexMap[indicator.type] === undefined) {
          typeIndexMap[indicator.type] = 0
        } else {
          typeIndexMap[indicator.type]++
        }
        const colorIndex = typeIndexMap[indicator.type]

        // 색상 변형 배열이 있으면 해당 색상 사용, 없으면 기본 색상
        const colorVariants = INDICATOR_COLOR_VARIANTS[indicator.type]
        const color = colorVariants
          ? colorVariants[colorIndex % colorVariants.length]
          : INDICATOR_COLORS[indicator.type] || '#ffffff'

        if (indicator.type === 'sma' || indicator.type === 'ema') {
          const lineSeries = chart.addSeries(
            LineSeries,
            {
              color,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
              title: indicator.name,
            },
            0
          ) // Pane 0

          const lineData: LineData[] = indicator.data
            .filter((d) => d.value > 0)
            .map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))

          lineSeries.setData(lineData)
        }

        if (indicator.type === 'bb' && indicator.upperBand && indicator.lowerBand) {
          const middleSeries = chart.addSeries(
            LineSeries,
            {
              color: INDICATOR_COLORS.bb,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
              title: 'BB',
            },
            0
          )
          middleSeries.setData(
            indicator.data
              .filter((d) => d.value > 0)
              .map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))
          )

          const upperSeries = chart.addSeries(
            LineSeries,
            {
              color: `${INDICATOR_COLORS.bb}80`,
              lineWidth: 1,
              lineStyle: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            },
            0
          )
          upperSeries.setData(
            indicator.upperBand
              .filter((d) => d.value > 0)
              .map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))
          )

          const lowerSeries = chart.addSeries(
            LineSeries,
            {
              color: `${INDICATOR_COLORS.bb}80`,
              lineWidth: 1,
              lineStyle: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            },
            0
          )
          lowerSeries.setData(
            indicator.lowerBand
              .filter((d) => d.value > 0)
              .map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))
          )
        }
      })

      // ===== Pane 1: 보조지표 (RSI, MACD, 스토캐스틱) =====
      oscillatorIndicators.forEach((indicator) => {
        const color = INDICATOR_COLORS[indicator.type] || '#ffffff'

        // RSI - Pane 1
        if (indicator.type === 'rsi') {
          const rsiSeries = chart.addSeries(
            LineSeries,
            {
              color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: indicator.name,
            },
            1
          ) // Pane 1

          const rsiData: LineData[] = indicator.data
            .filter((d) => d.value > 0)
            .map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))

          rsiSeries.setData(rsiData)

          // 과매수/과매도 라인 (동적 값 사용, 기본값 70/30)
          const overboughtLevel = indicator.rsiOverbought ?? 70
          const oversoldLevel = indicator.rsiOversold ?? 30

          const overBought = chart.addSeries(
            LineSeries,
            {
              color: 'rgba(255, 255, 255, 0.5)',
              lineWidth: 2,
              lineStyle: 0,
              priceLineVisible: false,
              lastValueVisible: false,
            },
            1
          )
          overBought.setData(rsiData.map((d) => ({ ...d, value: overboughtLevel })))

          const overSold = chart.addSeries(
            LineSeries,
            {
              color: 'rgba(255, 255, 255, 0.5)',
              lineWidth: 2,
              lineStyle: 0,
              priceLineVisible: false,
              lastValueVisible: false,
            },
            1
          )
          overSold.setData(rsiData.map((d) => ({ ...d, value: oversoldLevel })))
        }

        // MACD - Pane 1
        if (indicator.type === 'macd' && indicator.signalLine && indicator.histogram) {
          const macdLine = chart.addSeries(
            LineSeries,
            {
              color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: 'MACD',
            },
            1
          )
          macdLine.setData(
            indicator.data.map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))
          )

          const signalLine = chart.addSeries(
            LineSeries,
            {
              color: '#f59e0b',
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
            },
            1
          )
          signalLine.setData(
            indicator.signalLine.map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))
          )

          const histogram = chart.addSeries(
            HistogramSeries,
            {
              priceLineVisible: false,
              lastValueVisible: false,
            },
            1
          )
          const histData: HistogramData[] = indicator.histogram.map((d) => ({
            time: toChartTime(d.timestamp),
            value: d.value,
            color: d.value >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)',
          }))
          histogram.setData(histData)
        }

        // 스토캐스틱 - Pane 1
        if (indicator.type === 'stoch' && indicator.kLine && indicator.dLine) {
          const kSeries = chart.addSeries(
            LineSeries,
            {
              color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: '%K',
            },
            1
          )
          kSeries.setData(
            indicator.kLine
              .filter((d) => d.value > 0)
              .map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))
          )

          const dSeries = chart.addSeries(
            LineSeries,
            {
              color: '#f59e0b',
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
            },
            1
          )
          dSeries.setData(
            indicator.dLine
              .filter((d) => d.value > 0)
              .map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))
          )
        }
      })

      // 차트 크기 조정
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          })
        }
      }

      handleResize()
      window.addEventListener('resize', handleResize)
      chart.timeScale().fitContent()

      // ResizeObserver로 컨테이너 크기 변경 감지 (패널 리사이즈 대응)
      const resizeObserver = new ResizeObserver(() => {
        handleResize()
      })

      if (chartContainerRef.current) {
        resizeObserver.observe(chartContainerRef.current)
      }

      return () => {
        window.removeEventListener('resize', handleResize)
        resizeObserver.disconnect()
        if (chartRef.current) {
          chartRef.current.remove()
          chartRef.current = null
        }
      }
    }, [ohlcv, trades, priceIndicators, oscillatorIndicators, handleCrosshairMove])

    // 데이터가 없을 때 플레이스홀더
    if (ohlcv.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-white/40 text-sm">
          백테스트를 실행하면 차트가 표시됩니다.
        </div>
      )
    }

    return (
      <div className="flex flex-col w-full relative" style={{ height }}>
        {/* OHLC 및 지표 레전드 (좌측 상단) */}
        <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs pointer-events-none">
          {hoverData ? (
            <div className="flex flex-col gap-1">
              {/* 날짜 */}
              <span className="text-white/60">{hoverData.time}</span>

              {/* OHLC 값 */}
              <div className="flex items-center gap-3">
                <span className="text-white/50">시가</span>
                <span className="text-white font-medium">{hoverData.open.toFixed(2)}</span>
                <span className="text-white/50">고가</span>
                <span className="text-white font-medium">{hoverData.high.toFixed(2)}</span>
                <span className="text-white/50">저가</span>
                <span className="text-white font-medium">{hoverData.low.toFixed(2)}</span>
                <span className="text-white/50">종가</span>
                <span className="text-white font-medium">{hoverData.close.toFixed(2)}</span>
                <span
                  className={`font-medium ${hoverData.change >= 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {hoverData.change >= 0 ? '+' : ''}
                  {hoverData.changePercent.toFixed(2)}%
                </span>
              </div>

              {/* 지표 값 */}
              {hoverData.indicatorValues.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  {hoverData.indicatorValues.map((ind) => (
                    <span key={ind.name} className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ind.color }}
                      />
                      <span className="text-white/50">{ind.name}</span>
                      <span className="text-white font-medium">{ind.value.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-white/40">차트 위에 마우스를 올리세요</span>
          )}
        </div>

        {/* 단일 차트 (v5 Pane API로 다중 패널) */}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    )
  }
)

export default BacktestChart
