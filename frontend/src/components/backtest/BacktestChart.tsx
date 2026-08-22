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
import { getChartPalette } from '../../theme/chartColors'
import { useTheme } from '../../theme/useTheme'

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
    // 테마가 바뀌면 차트를 새 팔레트로 다시 그린다
    const { theme } = useTheme()
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
        // 기본 데이터 맵
        const dataMap = new Map<number, number>()
        ind.data.forEach((d) => {
          dataMap.set(Math.floor(d.timestamp / 1000), d.value)
        })
        maps.set(ind.name, dataMap)

        // MACD 시그널선 맵
        if (ind.type === 'macd' && ind.signalLine) {
          const signalMap = new Map<number, number>()
          ind.signalLine.forEach((d) => {
            signalMap.set(Math.floor(d.timestamp / 1000), d.value)
          })
          maps.set(`${ind.name}_Signal`, signalMap)
        }

        // MACD 히스토그램 맵
        if (ind.type === 'macd' && ind.histogram) {
          const histMap = new Map<number, number>()
          ind.histogram.forEach((d) => {
            histMap.set(Math.floor(d.timestamp / 1000), d.value)
          })
          maps.set(`${ind.name}_Histogram`, histMap)
        }

        // 스토캐스틱 %K 맵
        if (ind.type === 'stoch' && ind.kLine) {
          const kMap = new Map<number, number>()
          ind.kLine.forEach((d) => {
            kMap.set(Math.floor(d.timestamp / 1000), d.value)
          })
          maps.set(`${ind.name}_%K`, kMap)
        }

        // 스토캐스틱 %D 맵
        if (ind.type === 'stoch' && ind.dLine) {
          const dMap = new Map<number, number>()
          ind.dLine.forEach((d) => {
            dMap.set(Math.floor(d.timestamp / 1000), d.value)
          })
          maps.set(`${ind.name}_%D`, dMap)
        }

        // 볼린저밴드 상단 맵
        if (ind.type === 'bb' && ind.upperBand) {
          const upperMap = new Map<number, number>()
          ind.upperBand.forEach((d) => {
            upperMap.set(Math.floor(d.timestamp / 1000), d.value)
          })
          maps.set(`${ind.name}_Upper`, upperMap)
        }

        // 볼린저밴드 하단 맵
        if (ind.type === 'bb' && ind.lowerBand) {
          const lowerMap = new Map<number, number>()
          ind.lowerBand.forEach((d) => {
            lowerMap.set(Math.floor(d.timestamp / 1000), d.value)
          })
          maps.set(`${ind.name}_Lower`, lowerMap)
        }
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
            // MACD, RSI 등 음수/양수 모두 표시 (value > 0 조건 제거)
            if (value !== undefined && !Number.isNaN(value)) {
              // 볼린저밴드 중단선은 파란색으로 명시
              const displayColor =
                ind.type === 'bb' ? '#2196F3' : ind.type === 'macd' ? '#2962FF' : color
              const displayName = ind.type === 'bb' ? 'Basis' : ind.name
              indicatorValues.push({
                name: displayName,
                value,
                color: displayColor,
              })
            }
          }

          // MACD 시그널선과 히스토그램 추가
          if (ind.type === 'macd') {
            const signalMap = indicatorMaps.get(`${ind.name}_Signal`)
            if (signalMap) {
              const signalValue = signalMap.get(time)
              if (signalValue !== undefined && !Number.isNaN(signalValue)) {
                indicatorValues.push({
                  name: 'Signal',
                  value: signalValue,
                  color: '#FF6D00', // 시그널선 주황색
                })
              }
            }

            const histMap = indicatorMaps.get(`${ind.name}_Histogram`)
            if (histMap) {
              const histValue = histMap.get(time)
              if (histValue !== undefined && !Number.isNaN(histValue)) {
                indicatorValues.push({
                  name: 'Histogram',
                  value: histValue,
                  color: histValue >= 0 ? '#26A69A' : '#EF5350', // 양수 초록, 음수 빨강
                })
              }
            }
          }

          // 스토캐스틱 %K, %D 추가
          if (ind.type === 'stoch') {
            const kMap = indicatorMaps.get(`${ind.name}_%K`)
            if (kMap) {
              const kValue = kMap.get(time)
              if (kValue !== undefined && !Number.isNaN(kValue)) {
                indicatorValues.push({
                  name: '%K',
                  value: kValue,
                  color: '#2962FF', // %K 파란색
                })
              }
            }

            const dMap = indicatorMaps.get(`${ind.name}_%D`)
            if (dMap) {
              const dValue = dMap.get(time)
              if (dValue !== undefined && !Number.isNaN(dValue)) {
                indicatorValues.push({
                  name: '%D',
                  value: dValue,
                  color: '#FF6D00', // %D 주황색
                })
              }
            }
          }

          // 볼린저밴드 상단/하단 추가
          if (ind.type === 'bb') {
            // 상단 밴드 - 빨간색
            const upperMap = indicatorMaps.get(`${ind.name}_Upper`)
            if (upperMap) {
              const upperValue = upperMap.get(time)
              if (upperValue !== undefined && !Number.isNaN(upperValue)) {
                indicatorValues.push({
                  name: 'Upper',
                  value: upperValue,
                  color: '#EF5350',
                })
              }
            }

            // 하단 밴드 - 초록색
            const lowerMap = indicatorMaps.get(`${ind.name}_Lower`)
            if (lowerMap) {
              const lowerValue = lowerMap.get(time)
              if (lowerValue !== undefined && !Number.isNaN(lowerValue)) {
                indicatorValues.push({
                  name: 'Lower',
                  value: lowerValue,
                  color: '#26A69A',
                })
              }
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

      // 단일 차트 생성 (v5 Pane API 활용) — 색은 테마 팔레트에서
      const palette = getChartPalette(theme)
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: palette.text,
        },
        grid: {
          vertLines: { color: palette.grid },
          horzLines: { color: palette.grid },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: palette.crosshair, width: 1, style: 2 },
          horzLine: { color: palette.crosshair, width: 1, style: 2 },
        },
        rightPriceScale: { borderColor: palette.border },
        timeScale: {
          borderColor: palette.border,
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
          upColor: palette.up,
          downColor: palette.down,
          borderUpColor: palette.up,
          borderDownColor: palette.down,
          wickUpColor: palette.up,
          wickDownColor: palette.down,
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
              color: palette.up,
              shape: 'arrowUp',
              text: `매수 #${tradeNum}`,
            })
          }

          if (trade.exitTime) {
            result.push({
              time: isoToChartTime(trade.exitTime),
              position: 'aboveBar',
              color: palette.down,
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

        // 볼린저밴드 (TradingView 스타일)
        if (indicator.type === 'bb' && indicator.upperBand && indicator.lowerBand) {
          // 중간선 (SMA) - 파란색
          const middleSeries = chart.addSeries(
            LineSeries,
            {
              color: '#2196F3',
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

          // 상단 밴드 - 빨간색
          const upperSeries = chart.addSeries(
            LineSeries,
            {
              color: '#EF5350',
              lineWidth: 1,
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

          // 하단 밴드 - 초록색
          const lowerSeries = chart.addSeries(
            LineSeries,
            {
              color: '#26A69A',
              lineWidth: 1,
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
              color: palette.text,
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
              color: palette.text,
              lineWidth: 2,
              lineStyle: 0,
              priceLineVisible: false,
              lastValueVisible: false,
            },
            1
          )
          overSold.setData(rsiData.map((d) => ({ ...d, value: oversoldLevel })))
        }

        // MACD - Pane 1 (TradingView 스타일)
        if (indicator.type === 'macd' && indicator.signalLine && indicator.histogram) {
          // MACD선 (파란색)
          const macdLine = chart.addSeries(
            LineSeries,
            {
              color: '#2962FF',
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

          // 시그널선 (주황색)
          const signalLine = chart.addSeries(
            LineSeries,
            {
              color: '#FF6D00',
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            },
            1
          )
          signalLine.setData(
            indicator.signalLine.map((d) => ({ time: toChartTime(d.timestamp), value: d.value }))
          )

          // 히스토그램 (4색: 양수상승/하락, 음수상승/하락)
          const histogram = chart.addSeries(
            HistogramSeries,
            {
              priceLineVisible: false,
              lastValueVisible: false,
            },
            1
          )

          // TradingView 스타일 히스토그램 색상
          const histogramData = indicator.histogram
          const histData: HistogramData[] = histogramData.map((d, index) => {
            const currentValue = d.value
            const prevValue = index > 0 ? histogramData[index - 1].value : 0
            const isRising = currentValue >= prevValue

            let barColor: string
            if (currentValue >= 0) {
              // 양수: 상승=진한 초록, 하락=연한 초록
              barColor = isRising ? '#26A69A' : '#B2DFDB'
            } else {
              // 음수: 하락=진한 빨강, 상승=연한 빨강
              barColor = isRising ? '#FFCDD2' : '#EF5350'
            }

            return {
              time: toChartTime(d.timestamp),
              value: currentValue,
              color: barColor,
            }
          })
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
    }, [ohlcv, trades, priceIndicators, oscillatorIndicators, handleCrosshairMove, theme])

    // 데이터가 없을 때 플레이스홀더
    if (ohlcv.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-dim text-sm">
          백테스트를 실행하면 차트가 표시됩니다.
        </div>
      )
    }

    return (
      <div className="flex flex-col w-full relative" style={{ height }}>
        {/* OHLC 및 지표 레전드 (좌측 상단) */}
        <div className="absolute top-2 left-2 z-10 bg-panel backdrop-blur-sm px-3 py-2 text-xs pointer-events-none">
          {hoverData ? (
            <div className="flex flex-col gap-1">
              {/* 날짜 */}
              <span className="text-muted">{hoverData.time}</span>

              {/* OHLC 값 */}
              <div className="flex items-center gap-3">
                <span className="text-muted">시가</span>
                <span className="text-strong font-medium">{hoverData.open.toFixed(2)}</span>
                <span className="text-muted">고가</span>
                <span className="text-strong font-medium">{hoverData.high.toFixed(2)}</span>
                <span className="text-muted">저가</span>
                <span className="text-strong font-medium">{hoverData.low.toFixed(2)}</span>
                <span className="text-muted">종가</span>
                <span className="text-strong font-medium">{hoverData.close.toFixed(2)}</span>
                <span className={`font-medium ${hoverData.change >= 0 ? 'text-up' : 'text-down'}`}>
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
                      <span className="text-muted">{ind.name}</span>
                      <span className="text-strong font-medium">{ind.value.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-dim">차트 위에 마우스를 올리세요</span>
          )}
        </div>

        {/* 단일 차트 (v5 Pane API로 다중 패널) */}
        <div ref={chartContainerRef} className="w-full h-full" />
      </div>
    )
  }
)

export default BacktestChart
