// 백테스트 상단 툴바
// 워드마크, 자산 검색, 타임프레임, 모드 토글, 테마, 설정, 실행 버튼

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Loader2, Play, Search, SlidersHorizontal } from 'lucide-react'
import type { TimeFrame } from './types'
import { TIMEFRAME_LABELS } from './types'
import AssetSearchModal from './AssetSearchModal'
import ThemeToggle from '../layout/ThemeToggle'

// 타임프레임 목록
const TIMEFRAMES: TimeFrame[] = ['15m', '1h', '4h', '1d', '1w', '1M']

/** 세그먼트 컨트롤 한 칸의 클래스 */
const segment = (active: boolean) =>
  `px-3.5 py-1.5 font-mono text-xs tracking-[0.04em] transition-colors ${
    active ? 'bg-canvas text-strong font-medium' : 'text-muted hover:text-ink'
  }`

interface BacktestToolbarProps {
  // 자산 설정
  asset: string
  onAssetChange: (asset: string) => void
  // 타임프레임 설정
  timeFrame: TimeFrame
  onTimeFrameChange: (tf: TimeFrame) => void
  // 모드 (실시간/백테스트)
  mode: 'live' | 'backtest'
  onModeChange: (mode: 'live' | 'backtest') => void
  // 백테스트 실행
  onRunBacktest: () => void
  isRunning: boolean
  canRun: boolean
  // 설정 모달
  onOpenSettings: () => void
}

export default function BacktestToolbar({
  asset,
  onAssetChange,
  timeFrame,
  onTimeFrameChange,
  mode,
  onModeChange,
  onRunBacktest,
  isRunning,
  canRun,
  onOpenSettings,
}: BacktestToolbarProps) {
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false)

  return (
    <>
      {/* 자산 검색 모달 */}
      <AssetSearchModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        currentAsset={asset}
        onSelectAsset={onAssetChange}
      />

      <div className="flex items-center gap-3 md:gap-6 h-[58px] px-3 md:px-5 border-b border-line bg-canvas overflow-x-auto">
        {/* 워드마크 (홈으로) */}
        <Link
          to="/"
          title="홈으로 돌아가기"
          className="font-mono text-base font-semibold tracking-[0.02em] text-strong shrink-0"
        >
          OMC<span className="text-accent">_</span>
        </Link>

        {/* 자산 선택 */}
        <button
          onClick={() => setIsAssetModalOpen(true)}
          className="flex items-center gap-2.5 shrink-0 bg-transparent border-0 p-0 text-strong"
        >
          <Search className="w-3.5 h-3.5 text-muted" />
          <span className="font-mono text-[17px] font-semibold tracking-[-0.01em]">{asset}</span>
          <ChevronDown className="w-3 h-3 text-muted" />
        </button>

        {/* 타임프레임 */}
        <div className="flex items-center bg-raise p-0.5 shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeFrameChange(tf)}
              className={segment(timeFrame === tf)}
            >
              {TIMEFRAME_LABELS[tf]}
            </button>
          ))}
        </div>

        {/* 모드 */}
        <div className="flex items-center bg-raise p-0.5 shrink-0">
          <button onClick={() => onModeChange('live')} className={segment(mode === 'live')}>
            LIVE
          </button>
          <button onClick={() => onModeChange('backtest')} className={segment(mode === 'backtest')}>
            BACKTEST
          </button>
        </div>

        {/* 오른쪽 */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0 ml-auto">
          <ThemeToggle />

          <button
            onClick={onOpenSettings}
            title="전략 설정"
            className="flex items-center gap-2 border border-line bg-transparent px-4 py-2 text-[13px] text-ink hover:border-accent hover:text-strong transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">전략 편집</span>
          </button>

          <button
            onClick={() => {
              // 실시간 모드에서 클릭 시 백테스트 모드로 전환 후 실행
              if (mode === 'live') {
                onModeChange('backtest')
              }
              onRunBacktest()
            }}
            disabled={!canRun || isRunning}
            title={canRun ? '백테스트 실행' : '먼저 매수 또는 매도 조건을 추가하세요'}
            className={`flex items-center gap-2 px-6 py-2.5 font-mono text-xs font-semibold tracking-[0.14em] transition-opacity ${
              canRun && !isRunning
                ? 'bg-accent text-accent-ink hover:opacity-90'
                : 'border border-line text-dim cursor-not-allowed'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                RUNNING
              </>
            ) : (
              <>
                <Play className="w-3 h-3" fill="currentColor" />
                RUN
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
