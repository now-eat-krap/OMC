'use client'

// 백테스트 상단 툴바 컴포넌트
// 로고, 자산 검색, 타임프레임, 모드 토글, 실행 버튼

import { useState, useRef } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { Search, ChevronDown, Radio, BarChart3, Loader2, Play, Settings } from 'lucide-react'
import type { TimeFrame } from './types'
import { TIMEFRAME_LABELS } from './types'
import AssetSearchModal from './AssetSearchModal'

// 타임프레임 목록
const TIMEFRAMES: TimeFrame[] = ['15m', '1h', '4h', '1d', '1w', '1M']

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
  const logoRef = useRef<HTMLImageElement>(null)
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false)

  // 로고 hover 시 회전 애니메이션
  const handleLogoHover = () => {
    const img = logoRef.current
    if (!img) {
      return
    }
    gsap.set(img, { rotate: 0 })
    gsap.to(img, {
      rotate: 360,
      duration: 0.3,
      ease: 'power2.easeOut',
      overwrite: 'auto',
    })
  }

  return (
    <>
      {/* 자산 검색 모달 */}
      <AssetSearchModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        currentAsset={asset}
        onSelectAsset={onAssetChange}
      />

      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-black/40 backdrop-blur-sm border-b border-white/10">
        {/* 왼쪽: 로고 + 자산 & 타임프레임 선택 */}
        <div className="flex items-center gap-3">
          {/* 홈으로 돌아가는 로고 */}
          <Link
            href="/"
            onMouseEnter={handleLogoHover}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-white/5 transition-colors"
            title="홈으로 돌아가기"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={logoRef} src="/icon.png" alt="OMC Logo" width={40} height={40} className="w-10 h-10 object-contain" />
          </Link>

          {/* 구분선 */}
          <div className="w-px h-8 bg-white/10" />

          {/* 자산 선택 버튼 (클릭 시 검색 모달 열림) */}
          <button
            onClick={() => setIsAssetModalOpen(true)}
            className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm font-medium cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <Search className="w-4 h-4 text-white/60" />
            <span>{asset}</span>
            <ChevronDown className="w-3 h-3 text-white/40" />
          </button>

          {/* 타임프레임 선택 */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeFrameChange(tf)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  timeFrame === tf
                    ? 'bg-purple-500 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {TIMEFRAME_LABELS[tf]}
              </button>
            ))}
          </div>
        </div>

        {/* 중앙: 모드 토글 */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => onModeChange('live')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all ${
              mode === 'live'
                ? 'bg-purple-500 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            실시간
          </button>
          <button
            onClick={() => onModeChange('backtest')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all ${
              mode === 'backtest'
                ? 'bg-purple-500 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            백테스트
          </button>
        </div>

        {/* 오른쪽: 실행 버튼 & 설정 */}
        <div className="flex items-center gap-3">
          {/* 백테스트 실행 버튼 */}
          <button
            onClick={() => {
              // 실시간 모드에서 클릭 시 백테스트 모드로 전환 후 실행
              if (mode === 'live') {
                onModeChange('backtest')
              }
              onRunBacktest()
            }}
            disabled={!canRun || isRunning}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              canRun && !isRunning
                ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-500/30'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                실행 중...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                백테스트 실행
              </>
            )}
          </button>

          {/* 설정 버튼 */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="전략 설정"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  )
}
