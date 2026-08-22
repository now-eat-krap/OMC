// 백테스트 하단 탭 패널 컴포넌트
// 요약, 수익곡선, 거래내역, 전략 탭

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { TrendingUp, ClipboardList, Pencil, Crosshair, Sparkles, Loader2 } from 'lucide-react'
import { createChart, ColorType, AreaSeries, HistogramSeries } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'
import type { BacktestResult, SentenceCondition } from './types'
import { formatCondition } from './formatCondition'
import { useTheme } from '../../theme/useTheme'
import { getChartPalette } from '../../theme/chartColors'

// 탭 타입
type TabId = 'summary' | 'equity' | 'trades' | 'strategy' | 'ai-report'

interface TabButtonProps {
  id: TabId
  label: string
  active: boolean
  onClick: () => void
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3.5 text-[13px] bg-transparent border-0 transition-colors ${
        active
          ? 'text-strong font-semibold shadow-[inset_0_-2px_0_var(--omc-accent)]'
          : 'text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
}

// 요약 탭 콘텐츠 — 지표를 한 줄로 늘어놓는다
function SummaryTab({ result, isRunning }: { result: BacktestResult | null; isRunning?: boolean }) {
  // 실행 중에는 결과가 들어올 자리와 같은 모양의 자리표시자를 둔다
  if (isRunning) {
    return (
      <div className="flex h-full overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className={`flex min-w-[160px] flex-1 flex-col justify-center gap-3 px-6 py-5 ${
              index > 0 ? 'border-l border-line' : ''
            }`}
          >
            <span className="h-3 w-16 animate-pulse rounded-full bg-raise" />
            <span className="h-8 w-24 animate-pulse rounded-chip bg-raise" />
            <span className="h-3 w-20 animate-pulse rounded-full bg-raise" />
          </div>
        ))}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <span className="text-[15px] font-medium text-ink">아직 실행하지 않았습니다</span>
        <span className="text-sm font-light text-muted">
          조건을 세우고 <span className="font-medium text-accent">실행</span>을 누르면 결과가 여기에
          표시됩니다.
        </span>
      </div>
    )
  }

  const signed = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`

  const usdt = (value?: number) =>
    value === undefined
      ? ''
      : `${value >= 0 ? '+' : ''}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT`

  const cells: { label: string; value: string; sub: string; tone: string }[] = [
    {
      label: '총 수익률',
      value: `${signed(result.totalReturn)}%`,
      sub: usdt(result.totalReturnUsdt),
      tone: result.totalReturn >= 0 ? 'text-up' : 'text-down',
    },
    {
      label: '승률',
      value: `${result.winRate.toFixed(1)}%`,
      sub: `${result.profitTrades}승 ${result.lossTrades}패`,
      tone: 'text-ink',
    },
    {
      label: '최대 낙폭',
      value: `-${Math.abs(result.maxDrawdown).toFixed(2)}%`,
      sub:
        result.maxDrawdownUsdt === undefined
          ? ''
          : `-${Math.abs(result.maxDrawdownUsdt).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT`,
      tone: 'text-down',
    },
    {
      label: '샤프 지수',
      value: result.sharpeRatio !== null ? result.sharpeRatio.toFixed(2) : '-',
      sub: '연 환산',
      tone: 'text-ink',
    },
    {
      label: '수익 팩터',
      value: result.profitFactor.toFixed(2),
      sub: '총이익 / 총손실',
      tone: 'text-ink',
    },
    {
      label: '거래 횟수',
      value: `${result.totalTrades}`,
      sub: `수익 ${result.profitTrades}건, 손실 ${result.lossTrades}건`,
      tone: 'text-ink',
    },
  ]

  return (
    <div className="flex h-full overflow-x-auto">
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={`flex min-w-[160px] flex-1 flex-col justify-center gap-2.5 px-6 py-5 ${
            index > 0 ? 'border-l border-line' : ''
          }`}
        >
          <span className="text-[13px] font-light text-muted">{cell.label}</span>
          <span
            className={`tnum text-[32px] font-bold leading-none tracking-[-0.04em] ${cell.tone}`}
          >
            {cell.value}
          </span>
          <span className="tnum text-[12px] font-light text-dim">{cell.sub}</span>
        </div>
      ))}
    </div>
  )
}

// 수익곡선 탭 콘텐츠 (거래 기반 lightweight-charts - 거래 청산 시점만 표시)
function EquityTab({ result }: { result: BacktestResult | null }) {
  const { theme } = useTheme()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{
    tradeNum: number
    date: string
    value: number
    pnl: number
    pnlPercent: number
    runup?: number
    drawdown?: number
  } | null>(null)

  // 거래 기반 수익곡선 데이터 생성
  const { equityData, stats } = useMemo(() => {
    if (!result?.trades || result.trades.length === 0) {
      return { equityData: [], stats: null }
    }

    // 초기 자본 (첫 거래의 cumulativePnl에서 pnl을 빼면 이전 자산)
    // equityCurve에서 초기값을 가져오거나, 없으면 계산
    const initialCapital =
      result.equityCurve?.[0]?.value ??
      (result.trades[0].cumulativePnl !== undefined
        ? (result.trades[0].cumulativePnl || 0) -
          (result.trades[0].pnl || 0) +
          (result.trades[0].pnl >= 0 ? 0 : 0)
        : 1000000)

    const firstTrade = result.trades[0]

    // 시작점 (첫 거래 진입 시점) 추가
    const data: {
      time: number
      value: number
      tradeNum: number
      date: string
      runup: number
      drawdown: number
    }[] = []

    // ISO 문자열을 UTC 타임스탬프(초)로 변환하는 헬퍼
    // 백엔드에서 "2025-10-17T00:00:00" 형식으로 보내면 UTC로 해석
    const toUtcTimestamp = (dateStr: string): number => {
      // 이미 Z나 +로 끝나면 그대로 파싱
      if (dateStr.endsWith('Z') || dateStr.includes('+')) {
        return new Date(dateStr).getTime() / 1000
      }
      // 그렇지 않으면 UTC로 간주하여 'Z' 추가
      return new Date(`${dateStr}Z`).getTime() / 1000
    }

    // 초기 자본 포인트 (첫 거래 진입 시점)
    if (firstTrade.entryTime) {
      const entryTimestamp = toUtcTimestamp(firstTrade.entryTime)
      data.push({
        time: entryTimestamp,
        value: initialCapital,
        tradeNum: 0,
        date: firstTrade.entryTime,
        runup: 0,
        drawdown: 0,
      })
    }

    // 각 거래의 청산 시점을 포인트로 추가
    result.trades.forEach((trade, index) => {
      // 미실현 거래는 청산 시점이 없으므로 진입 시점 사용
      const timeStr = trade.isOpen ? trade.entryTime : trade.exitTime
      if (!timeStr) {
        return
      }

      const timestamp = toUtcTimestamp(timeStr)
      const equityValue = initialCapital + (trade.cumulativePnl || 0)

      data.push({
        time: timestamp,
        value: equityValue,
        tradeNum: index + 1,
        date: timeStr,
        runup: trade.runup || 0,
        drawdown: trade.drawdown || 0,
      })
    })

    // 시간순 정렬
    data.sort((a, b) => a.time - b.time)

    if (data.length === 0) {
      return { equityData: [], stats: null }
    }

    const values = data.map((d) => d.value)
    const finalValue = values[values.length - 1]

    // 최대 낙폭 계산
    let maxDrawdown = 0
    let peak = values[0]
    for (const value of values) {
      if (value > peak) {
        peak = value
      }
      const drawdown = ((peak - value) / peak) * 100
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    }

    return {
      equityData: data,
      stats: {
        initialValue: initialCapital,
        finalValue,
        totalReturn: ((finalValue - initialCapital) / initialCapital) * 100,
        maxDrawdown,
        totalTrades: result.trades.length,
      },
    }
  }, [result])

  useEffect(() => {
    if (!chartContainerRef.current || equityData.length === 0 || !stats) {
      return
    }

    // 기존 차트 제거
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    // 차트 생성 (색은 테마 팔레트에서)
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
      rightPriceScale: { borderColor: palette.border },
      timeScale: {
        borderColor: palette.border,
        timeVisible: true,
      },
      crosshair: {
        vertLine: { color: palette.crosshair, width: 1, style: 2 },
        horzLine: { color: palette.crosshair, width: 1, style: 2 },
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    })

    chartRef.current = chart

    // Area 시리즈 추가 (수익 곡선) - Pane 0
    const areaSeries = chart.addSeries(
      AreaSeries,
      {
        lineColor: palette.accent,
        topColor: `${palette.accent}59`,
        bottomColor: `${palette.accent}00`,
        lineWidth: 2,
        priceLineVisible: false,
      },
      0
    )

    // 데이터 변환
    const chartData = equityData.map((point) => ({
      time: point.time as Time,
      value: point.value,
    }))

    areaSeries.setData(chartData)

    // 런업 히스토그램 (초록색) - Pane 1
    const runupSeries = chart.addSeries(
      HistogramSeries,
      {
        color: palette.up,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1
    )

    const runupData = equityData
      .filter((p) => p.tradeNum > 0) // 시작점 제외
      .map((point) => ({
        time: point.time as Time,
        value: point.runup,
        color: palette.up,
      }))

    runupSeries.setData(runupData)

    // 드로다운 히스토그램 (빨간색) - Pane 1
    const drawdownSeries = chart.addSeries(
      HistogramSeries,
      {
        color: palette.down,
        priceLineVisible: false,
        lastValueVisible: false,
      },
      1
    )

    const drawdownData = equityData
      .filter((p) => p.tradeNum > 0) // 시작점 제외
      .map((point) => ({
        time: point.time as Time,
        value: -Math.abs(point.drawdown), // 음수로 표시
        color: palette.down,
      }))

    drawdownSeries.setData(drawdownData)

    // 호버 이벤트
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoverInfo(null)
        return
      }

      const dataPoint = equityData.find(
        (p) => Math.floor(p.time) === Math.floor(param.time as number)
      )

      if (dataPoint) {
        const pnl = dataPoint.value - stats.initialValue
        const pnlPercent = (pnl / stats.initialValue) * 100

        // 날짜를 YYYY-MM-DD HH:mm 형식으로 포맷 (UTC 기준)
        const dateObj =
          dataPoint.date.endsWith('Z') || dataPoint.date.includes('+')
            ? new Date(dataPoint.date)
            : new Date(`${dataPoint.date}Z`)
        const year = dateObj.getUTCFullYear()
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
        const day = String(dateObj.getUTCDate()).padStart(2, '0')
        const hours = String(dateObj.getUTCHours()).padStart(2, '0')
        const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0')
        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`

        setHoverInfo({
          tradeNum: dataPoint.tradeNum,
          date: formattedDate,
          value: dataPoint.value,
          pnl,
          pnlPercent,
          runup: dataPoint.runup,
          drawdown: dataPoint.drawdown,
        })
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
    chart.timeScale().fitContent()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [equityData, stats, theme])

  if (!result?.trades || result.trades.length === 0 || !stats) {
    return (
      <div className="flex items-center justify-center h-full text-dim text-sm gap-2">
        <TrendingUp className="w-4 h-4" />
        거래 내역이 없습니다.
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-[150px]">
      {/* 통계 정보 (좌측 상단) */}
      <div className="absolute top-2 left-2 z-10 bg-panel backdrop-blur-sm px-3 py-2 text-xs pointer-events-none">
        {hoverInfo ? (
          <div className="flex flex-col gap-1">
            <span className="text-muted">
              {hoverInfo.tradeNum === 0 ? '시작' : `거래 #${hoverInfo.tradeNum}`} · {hoverInfo.date}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-strong">자산: ${hoverInfo.value.toLocaleString()}</span>
              <span className={hoverInfo.pnl >= 0 ? 'text-up' : 'text-down'}>
                {hoverInfo.pnl >= 0 ? '+' : ''}
                {hoverInfo.pnlPercent.toFixed(2)}%
              </span>
              {hoverInfo.tradeNum > 0 && (
                <>
                  <span className="text-up">런업: +{hoverInfo.runup?.toFixed(2)}%</span>
                  <span className="text-down">DD: {hoverInfo.drawdown?.toFixed(2)}%</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-muted">
              시작: <span className="text-strong">${stats.initialValue.toLocaleString()}</span>
            </span>
            <span className="text-muted">
              종료:{' '}
              <span className={stats.totalReturn >= 0 ? 'text-up' : 'text-down'}>
                ${stats.finalValue.toLocaleString()}
              </span>
            </span>
            <span className="text-muted">
              수익:{' '}
              <span className={stats.totalReturn >= 0 ? 'text-up' : 'text-down'}>
                {stats.totalReturn >= 0 ? '+' : ''}
                {stats.totalReturn.toFixed(2)}%
              </span>
            </span>
            <span className="text-muted">
              MDD: <span className="text-down">-{stats.maxDrawdown.toFixed(2)}%</span>
            </span>
            <span className="text-accent">{stats.totalTrades}개 거래</span>
          </div>
        )}
      </div>

      {/* 차트 */}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  )
}

// 거래내역 탭 콘텐츠
function TradesTab({
  result,
  onScrollToTime,
}: {
  result: BacktestResult | null
  onScrollToTime?: (isoString: string) => void
}) {
  if (!result || !result.trades || result.trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-dim text-sm gap-2">
        <ClipboardList className="w-4 h-4" />
        거래 내역이 없습니다.
      </div>
    )
  }

  // 날짜 포맷 함수
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  // 숫자 포맷 함수
  const formatNumber = (value: number | undefined, decimals = 2) => {
    if (value === undefined || value === null) {
      return '-'
    }
    return value.toFixed(decimals)
  }

  return (
    <div className="h-full overflow-auto px-6 py-3">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-panel">
          <tr className="text-muted border-b border-line">
            <th className="text-left py-2 px-2 font-medium">거래</th>
            <th className="text-left py-2 px-2 font-medium">타입</th>
            <th className="text-left py-2 px-2 font-medium">날짜/시간</th>
            <th className="text-right py-2 px-2 font-medium">가격</th>
            <th className="text-right py-2 px-2 font-medium">수수료</th>
            <th className="text-right py-2 px-2 font-medium">슬리피지</th>
            <th className="text-right py-2 px-2 font-medium">수량</th>
            <th className="text-right py-2 px-2 font-medium">P&L</th>
            <th className="text-right py-2 px-2 font-medium">런업</th>
            <th className="text-right py-2 px-2 font-medium">드로다운</th>
            <th className="text-right py-2 px-2 font-medium">누적 손익</th>
          </tr>
        </thead>
        {/* 최신순으로 정렬하여 전체 거래 표시 */}
        {[...(result.trades || [])].reverse().map((trade, idx) => {
          const tradeNum = (result.trades?.length || 0) - idx
          return (
            <tbody key={idx} className={`hover:bg-raise ${trade.isOpen ? 'bg-accent/5' : ''}`}>
              {/* 매수청산 행 (위) */}
              <tr className="border-b border-hair">
                <td className="py-1.5 px-2 text-muted" rowSpan={2}>
                  <span className="font-medium">#{tradeNum}</span>
                  {trade.isOpen && (
                    <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-wash text-accent">
                      미실현
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${trade.isOpen ? 'bg-wash text-accent' : 'bg-down/15 text-down'}`}
                    >
                      {trade.isOpen ? '보유중' : '매수청산'}
                    </span>
                    {/* 청산 시점으로 차트 이동 버튼 (미실현 거래는 진입 시점으로) */}
                    <button
                      onClick={() =>
                        onScrollToTime?.(trade.isOpen ? trade.entryTime : trade.exitTime)
                      }
                      className="p-0.5 rounded hover:bg-raise text-dim hover:text-accent transition-colors"
                      title="차트에서 보기"
                    >
                      <Crosshair className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-ink">
                  {trade.isOpen ? '-' : formatDate(trade.exitTime)}
                </td>
                <td className="py-1.5 px-2 text-right text-strong font-medium">
                  {trade.isOpen ? (
                    <span className="text-accent">현재가</span>
                  ) : (
                    `$${formatNumber(trade.exitPrice)}`
                  )}
                </td>
                <td className="py-1.5 px-2 text-right text-muted">
                  ${formatNumber(trade.exitFee)}
                </td>
                <td className="py-1.5 px-2 text-right text-muted">
                  ${formatNumber(trade.exitSlippage)}
                </td>
                <td className="py-1.5 px-2 text-right text-strong" rowSpan={2}>
                  {/* 수량 + 달러 가치 */}
                  <div>{formatNumber(trade.size, result.amountPrecision || 6)}</div>
                  <div className="text-[10px]">
                    ${formatNumber((trade.size || 0) * trade.entryPrice)}
                  </div>
                </td>
                <td
                  className={`py-1.5 px-2 text-right font-medium ${trade.isOpen ? 'text-accent' : trade.pnl >= 0 ? 'text-up' : 'text-down'}`}
                  rowSpan={2}
                >
                  <div>
                    {trade.pnl >= 0 ? '+' : ''}${formatNumber(trade.pnl)}
                  </div>
                  <div className="text-[10px]">
                    {trade.pnlPercent >= 0 ? '+' : ''}
                    {formatNumber(trade.pnlPercent)}%
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right text-strong" rowSpan={2}>
                  {/* 런업: 달러 + 퍼센트 */}
                  <div>
                    $
                    {formatNumber(
                      ((trade.size || 0) * trade.entryPrice * (trade.runup || 0)) / 100
                    )}
                  </div>
                  <div className="text-[10px]">+{formatNumber(trade.runup)}%</div>
                </td>
                <td className="py-1.5 px-2 text-right text-strong" rowSpan={2}>
                  {/* 드로다운: 달러 + 퍼센트 */}
                  <div>
                    -$
                    {formatNumber(
                      Math.abs(((trade.size || 0) * trade.entryPrice * (trade.drawdown || 0)) / 100)
                    )}
                  </div>
                  <div className="text-[10px]">{formatNumber(trade.drawdown)}%</div>
                </td>
                <td
                  className={`py-1.5 px-2 text-right font-medium ${(trade.cumulativePnl || 0) >= 0 ? 'text-up' : 'text-down'}`}
                  rowSpan={2}
                >
                  {/* 누적손익: 달러 + 퍼센트 (초기자본 대비) */}
                  <div>
                    {(trade.cumulativePnl || 0) >= 0 ? '+' : ''}${formatNumber(trade.cumulativePnl)}
                  </div>
                  <div className="text-[10px]">
                    {(() => {
                      // 초기자본 계산: 첫 거래의 cumulativePnl - pnl = 이전 자산 (= 초기자본)
                      const firstTrade = result.trades?.[0]
                      const initialCapital = firstTrade
                        ? (firstTrade.cumulativePnl || 0) -
                            (firstTrade.pnl || 0) +
                            (firstTrade.pnl >= 0 ? 0 : 0) || 1000000
                        : 1000000
                      // 첫 거래의 경우 초기자본 = 진입금액 * 수량으로 추정
                      const capital =
                        firstTrade && initialCapital === 0
                          ? (firstTrade.size || 0) * firstTrade.entryPrice
                          : initialCapital ||
                            (firstTrade?.size || 0) * (firstTrade?.entryPrice || 0)
                      const pnlPercent =
                        capital > 0 ? ((trade.cumulativePnl || 0) / capital) * 100 : 0
                      return `${pnlPercent >= 0 ? '+' : ''}${formatNumber(pnlPercent)}%`
                    })()}
                  </div>
                </td>
              </tr>
              {/* 매수진입 행 (아래) */}
              <tr className="border-b-2 border-line">
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-up/15 text-up">
                      매수진입
                    </span>
                    {/* 진입 시점으로 차트 이동 버튼 */}
                    <button
                      onClick={() => onScrollToTime?.(trade.entryTime)}
                      className="p-0.5 rounded hover:bg-raise text-dim hover:text-accent transition-colors"
                      title="차트에서 보기"
                    >
                      <Crosshair className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-ink">{formatDate(trade.entryTime)}</td>
                <td className="py-1.5 px-2 text-right text-strong font-medium">
                  ${formatNumber(trade.entryPrice)}
                </td>
                <td className="py-1.5 px-2 text-right text-muted">
                  ${formatNumber(trade.entryFee)}
                </td>
                <td className="py-1.5 px-2 text-right text-muted">
                  ${formatNumber(trade.entrySlippage)}
                </td>
              </tr>
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

// AI 리포트 탭 콘텐츠 - 구조화된 시각적 보고서
function AIReportTab({
  result,
  buyConditions,
  sellConditions,
  backtestConfig,
}: {
  result: BacktestResult | null
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
  backtestConfig?: {
    symbol: string
    timeframe: string
    startDate: string
    endDate: string
    initialCapital: number
    feeRate: number
    slippage: number
    positionSize: number
    leverage?: number
  }
}) {
  const [report, setReport] = useState<{
    overallScore: number
    grade: string
    radarMetrics: {
      profitability: number
      winRate: number
      riskManagement: number
      stability: number
      profitFactor: number
    }
    strengths: string[]
    weaknesses: string[]
    suggestions: string[]
    summary: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const handleGenerateReport = async () => {
    if (!result) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { generateAIReport } = await import('../../services/api')

      const response = await generateAIReport({
        totalReturn: result.totalReturn,
        winRate: result.winRate,
        maxDrawdown: result.maxDrawdown,
        totalTrades: result.totalTrades,
        profitTrades: result.profitTrades,
        lossTrades: result.lossTrades,
        sharpeRatio: result.sharpeRatio ?? 0,
        profitFactor: result.profitFactor,
        buyConditions,
        sellConditions,
        config: backtestConfig,
        trades: result.trades,
      })

      setReport(response)
      setShowModal(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 리포트 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-dim text-sm gap-2">
        <Sparkles className="w-4 h-4" />
        백테스트를 실행한 후 AI 리포트를 생성할 수 있습니다.
      </div>
    )
  }

  return (
    <>
      <div className="h-full flex flex-col p-4 overflow-hidden">
        {/* 헤더 및 생성 버튼 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="text-strong font-medium">AI 분석 리포트</span>
          </div>
          <div className="flex gap-2">
            {report && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-raise hover:bg-line text-ink transition-colors"
              >
                리포트 보기
              </button>
            )}
            <button
              onClick={handleGenerateReport}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-wash hover:bg-wash text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {report ? 'AI 리포트 재생성' : 'AI 리포트 생성'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-down/15 border border-down text-down text-sm flex-shrink-0">
            {error}
          </div>
        )}

        {/* 리포트 미리보기 또는 안내 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {report ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 점수 카드 */}
              <div className="bg-raise p-4 text-center">
                <div className="text-3xl font-bold text-strong">{report.overallScore}</div>
                <div className="text-sm text-muted">종합 점수</div>
                <div
                  className={`mt-2 inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    report.grade.startsWith('A')
                      ? 'bg-up/15 text-up'
                      : report.grade.startsWith('B')
                        ? 'bg-wash text-accent'
                        : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {report.grade}
                </div>
              </div>

              {/* 강점 수 */}
              <div className="bg-raise p-4 text-center">
                <div className="text-3xl font-bold text-up">{report.strengths.length}</div>
                <div className="text-sm text-muted">강점</div>
              </div>

              {/* 약점 수 */}
              <div className="bg-raise p-4 text-center">
                <div className="text-3xl font-bold text-amber-400">{report.weaknesses.length}</div>
                <div className="text-sm text-muted">약점</div>
              </div>

              {/* 제안 수 */}
              <div className="bg-raise p-4 text-center">
                <div className="text-3xl font-bold text-accent">{report.suggestions.length}</div>
                <div className="text-sm text-muted">개선 제안</div>
              </div>

              {/* 요약 */}
              <div className="col-span-2 md:col-span-4 bg-raise p-4">
                <p className="text-ink text-sm">{report.summary}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-dim gap-4">
              <Sparkles className="w-12 h-12 text-accent/30" />
              <div className="text-center">
                <p className="text-lg">AI 리포트를 생성해보세요</p>
                <p className="text-sm mt-1">
                  백테스트 결과를 GPT가 분석하여 시각적인 보고서를 작성합니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 리포트 모달 */}
      {showModal && report && (
        <AIReportModalLazy
          report={report}
          backtestResult={{
            totalReturn: result.totalReturn,
            winRate: result.winRate,
            maxDrawdown: result.maxDrawdown,
            sharpeRatio: result.sharpeRatio ?? 0,
            profitFactor: result.profitFactor,
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

// 동적 import로 모달 로드
import { lazy, Suspense } from 'react'
const AIReportModalComponent = lazy(() => import('./AIReportModal'))

function AIReportModalLazy(props: {
  report: {
    overallScore: number
    grade: string
    radarMetrics: {
      profitability: number
      winRate: number
      riskManagement: number
      stability: number
      profitFactor: number
    }
    strengths: string[]
    weaknesses: string[]
    suggestions: string[]
    summary: string
  }
  backtestResult: {
    totalReturn: number
    winRate: number
    maxDrawdown: number
    sharpeRatio: number
    profitFactor: number
  }
  onClose: () => void
}) {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-panel">
          <Loader2 className="w-8 h-8 animate-spin text-strong" />
        </div>
      }
    >
      <AIReportModalComponent {...props} />
    </Suspense>
  )
}

// 전략 탭 콘텐츠
function StrategyTab({
  buyConditions,
  sellConditions,
  onEdit,
}: {
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
  onEdit: () => void
}) {
  const renderSide = (conditions: SentenceCondition[], side: 'buy' | 'sell') => (
    <div className="flex items-start gap-5">
      <span
        className={`w-8 shrink-0 pt-1.5 text-[13px] font-semibold ${
          side === 'buy' ? 'text-up' : 'text-down'
        }`}
      >
        {side === 'buy' ? '매수' : '매도'}
      </span>
      {conditions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {conditions.map((condition, index) => (
            <span key={condition.id} className="text-[15.5px] font-light leading-[1.8] text-ink">
              {index > 0 && (
                <span className="pr-2 text-[13px] text-muted">
                  {conditions[index - 1].nextOperator === 'OR' ? '또는' : '그리고'}
                </span>
              )}
              {formatCondition(condition)}
            </span>
          ))}
        </div>
      ) : (
        <span className="pt-1 text-[15px] font-light text-dim">조건 없음</span>
      )}
    </div>
  )

  return (
    <div className="flex h-full flex-col gap-7 overflow-y-auto px-7 py-6">
      {renderSide(buyConditions, 'buy')}
      {renderSide(sellConditions, 'sell')}

      <button
        onClick={onEdit}
        className="mt-auto self-start flex items-center gap-2 bg-accent text-accent-ink text-[13px] font-semibold px-5 py-2.5 hover:opacity-90 transition-opacity"
      >
        <Pencil className="w-3.5 h-3.5" />
        조건 편집
      </button>
    </div>
  )
}

interface TabPanelProps {
  result: BacktestResult | null
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
  onEditStrategy: () => void
  /** 실행 중이면 요약 탭에 자리표시자를 띄운다 */
  isRunning?: boolean
  /** 차트를 특정 시간으로 스크롤하는 콜백 */
  onScrollToTime?: (isoString: string) => void
  /** 백테스트 설정 (AI 리포트에 전달) */
  backtestConfig?: {
    symbol: string
    timeframe: string
    startDate: string
    endDate: string
    initialCapital: number
    feeRate: number
    slippage: number
    positionSize: number
    leverage?: number
  }
}

export default function TabPanel({
  result,
  buyConditions,
  sellConditions,
  onEditStrategy,
  onScrollToTime,
  backtestConfig,
  isRunning = false,
}: TabPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'summary', label: '요약' },
    { id: 'equity', label: '수익곡선' },
    { id: 'trades', label: `거래내역${result ? ` ${result.totalTrades}` : ''}` },
    { id: 'strategy', label: '전략' },
    { id: 'ai-report', label: 'AI 리포트' },
  ]

  const renderContent = (): ReactNode => {
    switch (activeTab) {
      case 'summary':
        return <SummaryTab result={result} isRunning={isRunning} />
      case 'equity':
        return <EquityTab result={result} />
      case 'trades':
        return <TradesTab result={result} onScrollToTime={onScrollToTime} />
      case 'strategy':
        return (
          <StrategyTab
            buyConditions={buyConditions}
            sellConditions={sellConditions}
            onEdit={onEditStrategy}
          />
        )
      case 'ai-report':
        return (
          <AIReportTab
            result={result}
            buyConditions={buyConditions}
            sellConditions={sellConditions}
            backtestConfig={backtestConfig}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="bg-panel border-t border-line flex flex-col h-full">
      {/* 탭 헤더 */}
      <div className="flex items-center gap-1 border-b border-line px-4 flex-shrink-0">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            id={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 min-h-0 overflow-hidden">{renderContent()}</div>
    </div>
  )
}
