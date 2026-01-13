// 차트 미리보기 컴포넌트
// 실시간 모드: TradingView 위젯, 백테스트 모드: Lightweight Charts

import { forwardRef } from 'react'
import { BarChart3 } from 'lucide-react'
import TradingViewWidget from './TradingViewWidget'
import BacktestChart, { type BacktestChartHandle } from './BacktestChart'
import type { TimeFrame, OHLCVData, TradeRecord, IndicatorData } from './types'

interface ChartPreviewProps {
  asset?: string
  timeFrame?: TimeFrame
  mode?: 'live' | 'backtest'
  hasSignals?: boolean
  /** 백테스트 결과 OHLCV 데이터 */
  ohlcv?: OHLCVData[]
  /** 거래 내역 (마커용) */
  trades?: TradeRecord[]
  /** 지표 데이터 (오버레이용) */
  indicators?: IndicatorData[]
}

// ChartPreview도 ref를 전달받아 BacktestChart에 전달
const ChartPreview = forwardRef<BacktestChartHandle, ChartPreviewProps>(
  (
    {
      asset = 'BTC/USDT',
      timeFrame = '1d',
      mode = 'live',
      hasSignals = false,
      ohlcv = [],
      trades = [],
      indicators = [],
    },
    ref
  ) => {
    // 실시간 모드: TradingView 위젯 표시
    if (mode === 'live') {
      return (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 h-full overflow-hidden">
          <TradingViewWidget symbol={asset} interval={timeFrame} />
        </div>
      )
    }

    // 백테스트 모드: Lightweight Charts 또는 플레이스홀더
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 h-full flex flex-col">
        {/* 차트 헤더 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">{asset}</h2>
            <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-xs font-medium">
              백테스트 결과
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasSignals && (
              <>
                <span className="flex items-center gap-1 text-xs text-white/60">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  매수
                </span>
                <span className="flex items-center gap-1 text-xs text-white/60">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  매도
                </span>
              </>
            )}
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="flex-1 rounded-xl bg-black/30 border border-white/5 overflow-hidden">
          {ohlcv.length > 0 ? (
            <BacktestChart
              ref={ref}
              ohlcv={ohlcv}
              trades={trades}
              indicators={indicators}
              height="100%"
            />
          ) : (
            <div className="flex items-center justify-center h-full relative">
              {/* 그리드 배경 */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
                `,
                  backgroundSize: '40px 30px',
                }}
              />

              {/* 중앙 메시지 */}
              <div className="relative z-10 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-white/40 text-sm">백테스트를 실행하면 결과 차트가 표시됩니다</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
)

export default ChartPreview
