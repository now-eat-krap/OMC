// 전략 백테스팅 페이지
// 터미널 레이아웃: 툴바 / 차트 / 결과 탭 + 오른쪽 전략 레일

import { useState, useRef, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  SettingsModal,
  AssetConfig,
  TradingConfigPanel,
  ChartPreview,
  BacktestToolbar,
  StrategyRail,
  TabPanel,
  DEFAULT_TRADING_CONFIG,
  type BacktestChartHandle,
} from '../components/backtest'
import type {
  SentenceCondition,
  TradingConfig,
  TimeFrame,
  BacktestResult,
} from '../components/backtest'
import { runBacktest } from '../services/api'

export default function BacktestPage() {
  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false)

  // 모드 상태 (실시간/백테스트)
  const [mode, setMode] = useState<'live' | 'backtest'>('live')

  // 코인의 상장일 (API에서 가져옴, 로컬 스토리지에 저장 안함)
  const [assetStartDate, setAssetStartDate] = useState('')

  // 기본값: 어제 날짜
  const getYesterday = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }

  // ========================================
  // 로컬 스토리지에 저장되는 설정들
  // ========================================
  const [savedSettings, setSavedSettings] = useLocalStorage('backtest-strategy-settings', {
    // 기본설정
    asset: 'BTC/USDT',
    startDate: '',
    endDate: getYesterday(),
    timeFrame: '1d' as TimeFrame,
    initialCapital: 1000000,
    // 거래설정
    tradingConfig: DEFAULT_TRADING_CONFIG,
    // 전략조건
    buyConditions: [] as SentenceCondition[],
    sellConditions: [] as SentenceCondition[],
  })

  // 저장된 설정에서 값 추출
  const {
    asset,
    startDate,
    endDate,
    timeFrame,
    initialCapital,
    tradingConfig,
    buyConditions,
    sellConditions,
  } = savedSettings

  // 개별 setter 함수들 (기존 코드와의 호환성을 위해)
  const setAsset = (newAsset: string) => setSavedSettings((prev) => ({ ...prev, asset: newAsset }))
  const setStartDate = (newStartDate: string) =>
    setSavedSettings((prev) => ({ ...prev, startDate: newStartDate }))
  const setEndDate = (newEndDate: string) =>
    setSavedSettings((prev) => ({ ...prev, endDate: newEndDate }))
  const setTimeFrame = (newTimeFrame: TimeFrame) =>
    setSavedSettings((prev) => ({ ...prev, timeFrame: newTimeFrame }))
  const setInitialCapital = (newCapital: number) =>
    setSavedSettings((prev) => ({ ...prev, initialCapital: newCapital }))
  const setTradingConfig = (newConfig: TradingConfig) =>
    setSavedSettings((prev) => ({ ...prev, tradingConfig: newConfig }))
  const setBuyConditions = (newConditions: SentenceCondition[]) =>
    setSavedSettings((prev) => ({ ...prev, buyConditions: newConditions }))
  const setSellConditions = (newConditions: SentenceCondition[]) =>
    setSavedSettings((prev) => ({ ...prev, sellConditions: newConditions }))

  // 페이지 로드 시 기본 코인(BTC/USDT)의 시작일 가져오기
  useEffect(() => {
    const fetchDefaultAssetStartDate = async () => {
      try {
        const response = await fetch('/api/assets')
        const data = await response.json()
        const defaultAsset = data.assets?.find((a: { symbol: string }) => a.symbol === asset)
        if (defaultAsset?.start_date) {
          setAssetStartDate(defaultAsset.start_date)
          // startDate가 비어있거나 유효하지 않으면 심볼의 시작일로 설정
          if (startDate === '') {
            setStartDate(defaultAsset.start_date)
          }
        }
      } catch {
        // 에러 시 별도 처리 없음
      }
    }
    fetchDefaultAssetStartDate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset])

  // 코인 선택 핸들러 (시작일도 함께 저장)
  const handleAssetChange = (newAsset: string, newStartDate: string) => {
    setAsset(newAsset)
    setAssetStartDate(newStartDate)
    // 백테스트 시작일도 새 심볼의 시작일로 업데이트
    setStartDate(newStartDate)
  }

  // 백테스팅 상태
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 리사이즈 상태 (하단 패널 비율: 0~100, 기본 40%)
  const [bottomPanelPercent, setBottomPanelPercent] = useState(40)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 차트 ref (거래내역에서 차트로 이동 기능용)
  const chartRef = useRef<BacktestChartHandle>(null)

  // 백테스트 실행 (실제 API 호출)
  const handleRunBacktest = async () => {
    setIsRunning(true)
    setError(null)

    try {
      // 백엔드 API 호출
      const response = await runBacktest({
        symbol: asset,
        timeframe: timeFrame,
        startDate,
        endDate,
        initialCapital,
        tradingConfig,
        buyConditions,
        sellConditions,
      })

      // 결과를 BacktestResult 형식으로 변환
      const backtestResult: BacktestResult = {
        // 심볼 및 precision 정보
        symbol: response.symbol,
        amountPrecision: response.amountPrecision,
        pricePrecision: response.pricePrecision,
        // 요약 지표
        totalReturn: response.totalReturn,
        totalReturnUsdt: response.totalReturnUsdt,
        winRate: response.winRate,
        maxDrawdown: response.maxDrawdown,
        maxDrawdownUsdt: response.maxDrawdownUsdt,
        totalTrades: response.totalTrades,
        profitTrades: response.profitTrades,
        lossTrades: response.lossTrades,
        sharpeRatio: response.sharpeRatio,
        profitFactor: response.profitFactor,
        equityCurve: response.equityCurve,
        trades: response.trades,
        ohlcv: response.ohlcv,
        indicators: response.indicators,
      }

      setResult(backtestResult)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '백테스트 실행 중 오류가 발생했습니다.'
      setError(errorMessage)
    } finally {
      setIsRunning(false)
    }
  }

  // 리사이즈 핸들러 - 드래그 시작
  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  // 마우스 이벤트 리스너 등록
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) {
        return
      }

      const containerRect = containerRef.current.getBoundingClientRect()
      const containerHeight = containerRect.height
      const mouseY = e.clientY - containerRect.top

      // 마우스 위치를 퍼센트로 변환 (하단 패널 비율)
      const newPercent = ((containerHeight - mouseY) / containerHeight) * 100

      // 최소 15% ~ 최대 60% 제한
      const clampedPercent = Math.max(15, Math.min(60, newPercent))
      setBottomPanelPercent(clampedPercent)
    }

    const onMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging])

  const hasConditions = buyConditions.length > 0 || sellConditions.length > 0

  return (
    <div className="h-screen bg-canvas text-ink flex flex-col overflow-hidden">
      {/* 에러 알림 배너 */}
      {error && (
        <div className="flex items-center justify-between gap-4 px-5 py-2.5 bg-down/10 border-b border-down/40 text-down text-[13px]">
          <span className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] tracking-[0.2em]">ERROR</span>
            {error}
          </span>
          <button
            onClick={() => setError(null)}
            className="bg-transparent border-0 p-1 text-down hover:text-strong"
            aria-label="오류 닫기"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 설정 모달 */}
      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        basicContent={
          <AssetConfig
            asset={asset}
            assetStartDate={assetStartDate}
            onAssetChange={handleAssetChange}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            timeFrame={timeFrame}
            onTimeFrameChange={setTimeFrame}
            initialCapital={initialCapital}
            onInitialCapitalChange={setInitialCapital}
          />
        }
        tradingContent={<TradingConfigPanel config={tradingConfig} onChange={setTradingConfig} />}
        buyConditions={buyConditions}
        sellConditions={sellConditions}
        onBuyConditionsChange={setBuyConditions}
        onSellConditionsChange={setSellConditions}
      />

      {/* 상단 툴바 */}
      <BacktestToolbar
        asset={asset}
        onAssetChange={setAsset}
        timeFrame={timeFrame}
        onTimeFrameChange={setTimeFrame}
        mode={mode}
        onModeChange={setMode}
        onRunBacktest={handleRunBacktest}
        isRunning={isRunning}
        canRun={hasConditions}
        onOpenSettings={() => setIsModalOpen(true)}
      />

      {/* 본문: 차트 + 결과 탭 | 전략 레일 */}
      <div className="flex-1 flex min-h-0">
        <main ref={containerRef} className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* 차트 영역 */}
          {/* 드래그 중일 때는 pointer-events-none을 적용하여 iframe이 마우스 이벤트를 가로채지 못하게 함 */}
          <div
            style={{ flex: `${100 - bottomPanelPercent}` }}
            className={`min-h-0 p-3 ${isDragging ? 'pointer-events-none' : ''}`}
          >
            <div className="h-full">
              <ChartPreview
                ref={chartRef}
                asset={asset}
                timeFrame={timeFrame}
                mode={mode}
                hasSignals={result !== null}
                ohlcv={result?.ohlcv || []}
                trades={result?.trades || []}
                indicators={result?.indicators || []}
              />
            </div>
          </div>

          {/* 리사이즈 핸들 */}
          <div
            onMouseDown={handleMouseDown}
            className="h-1.5 bg-hair border-y border-line cursor-row-resize flex items-center justify-center group shrink-0 hover:bg-wash transition-colors"
          >
            <div className="w-10 h-px bg-dim group-hover:bg-accent transition-colors" />
          </div>

          {/* 하단 결과 탭 패널 */}
          <div style={{ flex: `${bottomPanelPercent}` }} className="min-h-0">
            <TabPanel
              result={result}
              buyConditions={buyConditions}
              sellConditions={sellConditions}
              onEditStrategy={() => setIsModalOpen(true)}
              onScrollToTime={(isoString) => {
                // 백테스트 모드로 전환 후 차트 스크롤
                if (mode !== 'backtest') {
                  setMode('backtest')
                }
                // 다음 프레임에 스크롤 실행 (모드 변경 후 렌더링 대기)
                setTimeout(() => {
                  chartRef.current?.scrollToTime(isoString)
                }, 100)
              }}
            />
          </div>
        </main>

        {/* 오른쪽 전략 레일 (넓은 화면에서만) */}
        <div className="hidden xl:flex">
          <StrategyRail
            asset={asset}
            timeFrame={timeFrame}
            startDate={startDate}
            endDate={endDate}
            initialCapital={initialCapital}
            tradingConfig={tradingConfig}
            buyConditions={buyConditions}
            sellConditions={sellConditions}
            result={result}
            onEdit={() => setIsModalOpen(true)}
          />
        </div>
      </div>
    </div>
  )
}
