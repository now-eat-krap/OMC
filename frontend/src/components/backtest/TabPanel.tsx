// 백테스트 하단 탭 패널 컴포넌트
// 요약, 수익곡선, 거래내역, 전략 탭

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import {
  BarChart3,
  TrendingUp,
  ClipboardList,
  Settings,
  Circle,
  Pencil,
  Crosshair,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { createChart, ColorType, AreaSeries, HistogramSeries } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'
import type { BacktestResult, SentenceCondition } from './types'
import {
  COMPARISON_LABELS,
  PRICE_TYPE_LABELS,
  CROSS_DIRECTION_LABELS,
  PROFIT_DIRECTION_LABELS,
} from './types'
import MagicBento, { ParticleCard } from '../effects/MagicBento'

// 탭 타입
type TabId = 'summary' | 'equity' | 'trades' | 'strategy' | 'ai-report'

interface TabButtonProps {
  id: TabId
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}

function TabButton({ label, icon, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 ${
        active
          ? 'text-white border-purple-500'
          : 'text-white/50 border-transparent hover:text-white/80 hover:border-white/20'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// 요약 탭 콘텐츠 - MagicBento 적용
function SummaryTab({ result }: { result: BacktestResult | null }) {
  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        백테스트를 실행하면 결과가 여기에 표시됩니다.
      </div>
    )
  }

  return (
    <MagicBento
      enableStars={true}
      enableSpotlight={true}
      enableBorderGlow={true}
      enableTilt={true}
      enableMagnetism={true}
      clickEffect={true}
      spotlightRadius={300}
      particleCount={12}
      glowColor="132, 0, 255"
      className="flex items-stretch gap-6 h-full px-3 py-1"
    >
      {/* 총 수익률 카드 */}
      <ParticleCard className="flex-1 flex flex-col items-center justify-center min-w-0 rounded-xl border border-white/10 transition-all card card--border-glow">
        <span className="text-xs text-white/50 uppercase tracking-wider font-medium mb-1">
          총 수익률
        </span>
        <span
          className={`text-3xl font-bold ${result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}
        >
          {result.totalReturn >= 0 ? '+' : ''}
          {result.totalReturn.toFixed(2)}%
        </span>
        <span
          className={`text-sm ${result.totalReturn >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}
        >
          {result.totalReturnUsdt !== undefined && (
            <>
              {result.totalReturnUsdt >= 0 ? '+' : ''}
              {result.totalReturnUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
            </>
          )}
        </span>
      </ParticleCard>

      {/* 최대 낙폭 카드 */}
      <ParticleCard className="flex-1 flex flex-col items-center justify-center min-w-0 rounded-xl border border-white/10 transition-all card card--border-glow">
        <span className="text-xs text-white/50 uppercase tracking-wider font-medium mb-1">
          최대 낙폭
        </span>
        <span className="text-3xl font-bold text-red-400">{result.maxDrawdown.toFixed(2)}%</span>
        <span className="text-sm text-red-400/70">
          {result.maxDrawdownUsdt !== undefined && (
            <>
              -{result.maxDrawdownUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
            </>
          )}
        </span>
      </ParticleCard>

      {/* 거래 통계 카드 */}
      <ParticleCard className="flex-1 flex flex-col items-center justify-center min-w-0 rounded-xl border border-white/10 transition-all card card--border-glow">
        <span className="text-xs text-white/50 uppercase tracking-wider font-medium mb-1">
          거래 통계
        </span>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-white">{result.winRate.toFixed(1)}%</span>
            <span className="text-[11px] text-white/40">승률</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-white">
              {result.profitTrades}/{result.totalTrades}
            </span>
            <span className="text-[11px] text-white/40">수익/총 거래</span>
          </div>
        </div>
      </ParticleCard>

      {/* 샤프 비율 카드 */}
      <ParticleCard className="flex-1 flex flex-col items-center justify-center min-w-0 rounded-xl border border-white/10 transition-all card card--border-glow">
        <span className="text-xs text-white/50 uppercase tracking-wider font-medium mb-1">
          샤프 비율
        </span>
        <span
          className={`text-3xl font-bold ${result.sharpeRatio !== null && result.sharpeRatio >= 1 ? 'text-green-400' : 'text-yellow-400'}`}
        >
          {result.sharpeRatio !== null ? result.sharpeRatio.toFixed(3) : '-'}
        </span>
      </ParticleCard>

      {/* 수익 팩터 카드 */}
      <ParticleCard className="flex-1 flex flex-col items-center justify-center min-w-0 rounded-xl border border-white/10 transition-all card card--border-glow">
        <span className="text-xs text-white/50 uppercase tracking-wider font-medium mb-1">
          수익 팩터
        </span>
        <span
          className={`text-3xl font-bold ${result.profitFactor >= 1.5 ? 'text-green-400' : 'text-yellow-400'}`}
        >
          {result.profitFactor.toFixed(2)}
        </span>
      </ParticleCard>
    </MagicBento>
  )
}

// 수익곡선 탭 콘텐츠 (거래 기반 lightweight-charts - 거래 청산 시점만 표시)
function EquityTab({ result }: { result: BacktestResult | null }) {
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

    // 차트 생성
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.6)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
      },
      crosshair: {
        vertLine: { color: 'rgba(168, 85, 247, 0.5)', width: 1, style: 2 },
        horzLine: { color: 'rgba(168, 85, 247, 0.5)', width: 1, style: 2 },
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    })

    chartRef.current = chart

    // Area 시리즈 추가 (수익 곡선) - Pane 0
    const areaSeries = chart.addSeries(
      AreaSeries,
      {
        lineColor: '#8b5cf6',
        topColor: 'rgba(139, 92, 246, 0.4)',
        bottomColor: 'rgba(139, 92, 246, 0.0)',
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
        color: '#22c55e',
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
        color: '#22c55e',
      }))

    runupSeries.setData(runupData)

    // 드로다운 히스토그램 (빨간색) - Pane 1
    const drawdownSeries = chart.addSeries(
      HistogramSeries,
      {
        color: '#ef4444',
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
        color: '#ef4444',
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
  }, [equityData, stats])

  if (!result?.trades || result.trades.length === 0 || !stats) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm gap-2">
        <TrendingUp className="w-4 h-4" />
        거래 내역이 없습니다.
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-[150px]">
      {/* 통계 정보 (좌측 상단) */}
      <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs pointer-events-none">
        {hoverInfo ? (
          <div className="flex flex-col gap-1">
            <span className="text-white/60">
              {hoverInfo.tradeNum === 0 ? '시작' : `거래 #${hoverInfo.tradeNum}`} · {hoverInfo.date}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-white">자산: ${hoverInfo.value.toLocaleString()}</span>
              <span className={hoverInfo.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                {hoverInfo.pnl >= 0 ? '+' : ''}
                {hoverInfo.pnlPercent.toFixed(2)}%
              </span>
              {hoverInfo.tradeNum > 0 && (
                <>
                  <span className="text-green-400">런업: +{hoverInfo.runup?.toFixed(2)}%</span>
                  <span className="text-red-400">DD: {hoverInfo.drawdown?.toFixed(2)}%</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-white/60">
              시작: <span className="text-white">${stats.initialValue.toLocaleString()}</span>
            </span>
            <span className="text-white/60">
              종료:{' '}
              <span className={stats.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}>
                ${stats.finalValue.toLocaleString()}
              </span>
            </span>
            <span className="text-white/60">
              수익:{' '}
              <span className={stats.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}>
                {stats.totalReturn >= 0 ? '+' : ''}
                {stats.totalReturn.toFixed(2)}%
              </span>
            </span>
            <span className="text-white/60">
              MDD: <span className="text-red-400">-{stats.maxDrawdown.toFixed(2)}%</span>
            </span>
            <span className="text-purple-400">{stats.totalTrades}개 거래</span>
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
      <div className="flex items-center justify-center h-full text-white/40 text-sm gap-2">
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
    <div className="h-full overflow-auto px-4 py-2">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-black">
          <tr className="text-white/50 border-b border-white/10">
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
            <tbody
              key={idx}
              className={`hover:bg-white/5 ${trade.isOpen ? 'bg-yellow-500/5' : ''}`}
            >
              {/* 매수청산 행 (위) */}
              <tr className="border-b border-white/5">
                <td className="py-1.5 px-2 text-white/60" rowSpan={2}>
                  <span className="font-medium">#{tradeNum}</span>
                  {trade.isOpen && (
                    <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-yellow-500/20 text-yellow-400">
                      미실현
                    </span>
                  )}
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${trade.isOpen ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}
                    >
                      {trade.isOpen ? '보유중' : '매수청산'}
                    </span>
                    {/* 청산 시점으로 차트 이동 버튼 (미실현 거래는 진입 시점으로) */}
                    <button
                      onClick={() =>
                        onScrollToTime?.(trade.isOpen ? trade.entryTime : trade.exitTime)
                      }
                      className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-purple-400 transition-colors"
                      title="차트에서 보기"
                    >
                      <Crosshair className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-white/80">
                  {trade.isOpen ? '-' : formatDate(trade.exitTime)}
                </td>
                <td className="py-1.5 px-2 text-right text-white font-medium">
                  {trade.isOpen ? (
                    <span className="text-yellow-400">현재가</span>
                  ) : (
                    `$${formatNumber(trade.exitPrice)}`
                  )}
                </td>
                <td className="py-1.5 px-2 text-right text-white/60">
                  ${formatNumber(trade.exitFee)}
                </td>
                <td className="py-1.5 px-2 text-right text-white/60">
                  ${formatNumber(trade.exitSlippage)}
                </td>
                <td className="py-1.5 px-2 text-right text-white" rowSpan={2}>
                  {/* 수량 + 달러 가치 */}
                  <div>{formatNumber(trade.size, result.amountPrecision || 6)}</div>
                  <div className="text-[10px]">
                    ${formatNumber((trade.size || 0) * trade.entryPrice)}
                  </div>
                </td>
                <td
                  className={`py-1.5 px-2 text-right font-medium ${trade.isOpen ? 'text-yellow-400' : trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}
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
                <td className="py-1.5 px-2 text-right text-white" rowSpan={2}>
                  {/* 런업: 달러 + 퍼센트 */}
                  <div>
                    $
                    {formatNumber(
                      ((trade.size || 0) * trade.entryPrice * (trade.runup || 0)) / 100
                    )}
                  </div>
                  <div className="text-[10px]">+{formatNumber(trade.runup)}%</div>
                </td>
                <td className="py-1.5 px-2 text-right text-white" rowSpan={2}>
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
                  className={`py-1.5 px-2 text-right font-medium ${(trade.cumulativePnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}
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
              <tr className="border-b-2 border-white/20">
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">
                      매수진입
                    </span>
                    {/* 진입 시점으로 차트 이동 버튼 */}
                    <button
                      onClick={() => onScrollToTime?.(trade.entryTime)}
                      className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-purple-400 transition-colors"
                      title="차트에서 보기"
                    >
                      <Crosshair className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-white/80">{formatDate(trade.entryTime)}</td>
                <td className="py-1.5 px-2 text-right text-white font-medium">
                  ${formatNumber(trade.entryPrice)}
                </td>
                <td className="py-1.5 px-2 text-right text-white/60">
                  ${formatNumber(trade.entryFee)}
                </td>
                <td className="py-1.5 px-2 text-right text-white/60">
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
      <div className="flex items-center justify-center h-full text-white/40 text-sm gap-2">
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
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-white font-medium">AI 분석 리포트</span>
          </div>
          <div className="flex gap-2">
            {report && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors"
              >
                리포트 보기
              </button>
            )}
            <button
              onClick={handleGenerateReport}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm flex-shrink-0">
            {error}
          </div>
        )}

        {/* 리포트 미리보기 또는 안내 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {report ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 점수 카드 */}
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white">{report.overallScore}</div>
                <div className="text-sm text-white/50">종합 점수</div>
                <div
                  className={`mt-2 inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    report.grade.startsWith('A')
                      ? 'bg-green-500/20 text-green-400'
                      : report.grade.startsWith('B')
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {report.grade}
                </div>
              </div>

              {/* 강점 수 */}
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{report.strengths.length}</div>
                <div className="text-sm text-white/50">강점</div>
              </div>

              {/* 약점 수 */}
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-amber-400">{report.weaknesses.length}</div>
                <div className="text-sm text-white/50">약점</div>
              </div>

              {/* 제안 수 */}
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{report.suggestions.length}</div>
                <div className="text-sm text-white/50">개선 제안</div>
              </div>

              {/* 요약 */}
              <div className="col-span-2 md:col-span-4 bg-white/5 rounded-xl p-4">
                <p className="text-white/80 text-sm">{report.summary}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/40 gap-4">
              <Sparkles className="w-12 h-12 text-purple-500/30" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
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
  // 문장형 조건을 읽기 쉬운 텍스트로 변환
  const formatCondition = (condition: SentenceCondition) => {
    switch (condition.templateType) {
      case 'indicator_vs_value':
        return `${condition.indicator}(${condition.indicatorPeriod}) ${COMPARISON_LABELS[condition.comparison || 'lt']?.replace(' 때', '') || ''} ${condition.value}`
      case 'indicator_cross':
        return `${condition.indicator}(${condition.indicatorPeriod}) ${CROSS_DIRECTION_LABELS[condition.crossDirection || 'above']} 돌파 ${condition.targetIndicator}(${condition.targetPeriod})`
      case 'price_cross':
        return `${PRICE_TYPE_LABELS[condition.priceType || 'close']} ${CROSS_DIRECTION_LABELS[condition.crossDirection || 'above']} 돌파 ${condition.targetIndicator}(${condition.targetPeriod})`
      case 'profit_loss':
        return `진입가 대비 ${condition.value}% ${PROFIT_DIRECTION_LABELS[condition.profitDirection || 'profit']}`
      case 'band_touch':
        return `${PRICE_TYPE_LABELS[condition.priceType || 'low']} BB ${condition.bandPosition === 'upper' ? '상단' : '하단'} 터치`
      case 'macd_signal':
        return `MACD ${CROSS_DIRECTION_LABELS[condition.crossDirection || 'above']} 시그널`
      case 'stochastic':
        return `스토캐스틱 %K ${CROSS_DIRECTION_LABELS[condition.crossDirection || 'above']} %D`
      case 'candle_pattern':
        return `${condition.candlePattern || 'hammer'} 패턴`
      case 'volume':
        return `거래량 ${condition.volumePeriod}일 평균의 ${condition.volumeMultiplier}배`
      case 'price_change':
        return `전일 대비 ${condition.priceChangePercent}% ${condition.priceChangeDirection === 'up' ? '상승' : '하락'}`
      default:
        return '조건'
    }
  }

  return (
    <div className="flex items-center gap-6 h-full px-4">
      {/* 매수 조건 */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-green-400 text-sm font-medium">
          <Circle className="w-2.5 h-2.5 fill-green-400" />
          매수:
        </span>
        {buyConditions.length > 0 ? (
          <span className="text-white/80 text-sm">
            {buyConditions.map((c, i) => (
              <span key={c.id}>
                {formatCondition(c)}
                {i < buyConditions.length - 1 && (
                  <span
                    className={`mx-1 ${c.nextOperator === 'OR' ? 'text-orange-400' : 'text-purple-400'}`}
                  >
                    {c.nextOperator || 'AND'}
                  </span>
                )}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-white/40 text-sm">조건 없음</span>
        )}
      </div>

      {/* 구분선 */}
      <div className="w-px h-6 bg-white/10" />

      {/* 매도 조건 */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-red-400 text-sm font-medium">
          <Circle className="w-2.5 h-2.5 fill-red-400" />
          매도:
        </span>
        {sellConditions.length > 0 ? (
          <span className="text-white/80 text-sm">
            {sellConditions.map((c, i) => (
              <span key={c.id}>
                {formatCondition(c)}
                {i < sellConditions.length - 1 && (
                  <span
                    className={`mx-1 ${c.nextOperator === 'OR' ? 'text-orange-400' : 'text-purple-400'}`}
                  >
                    {c.nextOperator || 'AND'}
                  </span>
                )}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-white/40 text-sm">조건 없음</span>
        )}
      </div>

      {/* 편집 버튼 */}
      <button
        onClick={onEdit}
        className="ml-auto flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-purple-400 hover:text-purple-300 border border-purple-400/30 rounded-lg hover:bg-purple-400/10 transition-colors"
      >
        <Pencil className="w-3 h-3" />
        편집
      </button>
    </div>
  )
}

interface TabPanelProps {
  result: BacktestResult | null
  buyConditions: SentenceCondition[]
  sellConditions: SentenceCondition[]
  onEditStrategy: () => void
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
}: TabPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'summary', label: '요약', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'equity', label: '수익곡선', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'trades', label: '거래내역', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'strategy', label: '전략', icon: <Settings className="w-4 h-4" /> },
    { id: 'ai-report', label: 'AI 리포트', icon: <Sparkles className="w-4 h-4" /> },
  ]

  const renderContent = (): ReactNode => {
    switch (activeTab) {
      case 'summary':
        return <SummaryTab result={result} />
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
    <div className="bg-black/40 backdrop-blur-sm border-t border-white/10 flex flex-col h-full">
      {/* 탭 헤더 */}
      <div className="flex items-center border-b border-white/5 px-2 flex-shrink-0">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
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
