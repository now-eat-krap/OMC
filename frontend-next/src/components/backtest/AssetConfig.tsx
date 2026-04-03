'use client'

// 자산 및 기간 설정 컴포넌트
// 코인/페어 선택 (검색 모달), 백테스트 기간, 캔들 시간 간격, 초기 자본금

import { useState } from 'react'
import { Search } from 'lucide-react'
import { DatePickerInput } from '@mantine/dates'
import 'dayjs/locale/ko'
import type { TimeFrame } from './types'
import { TIMEFRAME_LABELS } from './types'
import AssetSearchModal from './AssetSearchModal'

interface AssetConfigProps {
  asset: string
  assetStartDate: string // 선택된 코인의 시작일
  onAssetChange: (asset: string, startDate: string) => void
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  timeFrame: TimeFrame
  onTimeFrameChange: (tf: TimeFrame) => void
  initialCapital: number
  onInitialCapitalChange: (capital: number) => void
}

export default function AssetConfig({
  asset,
  assetStartDate,
  onAssetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  timeFrame,
  onTimeFrameChange,
  initialCapital,
  onInitialCapitalChange,
}: AssetConfigProps) {
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false)

  // 문자열을 Date 객체로 변환
  const startDateObj = startDate ? new Date(startDate) : null
  const endDateObj = endDate ? new Date(endDate) : null

  // 코인 상장일 (minDate로 사용)
  const coinStartDateObj = assetStartDate ? new Date(assetStartDate) : null

  // 어제 날짜 계산
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(23, 59, 59, 999)

  // 날짜 변경 핸들러 (Mantine은 Date | null을 전달)
  const handleStartDateChange = (value: Date | null) => {
    if (value) {
      // value가 Date 객체인지 확인하고 문자열이면 변환
      const date = value instanceof Date ? value : new Date(value)
      const formatted = date.toISOString().split('T')[0]
      onStartDateChange(formatted)
    }
  }

  const handleEndDateChange = (value: Date | null) => {
    if (value) {
      const date = value instanceof Date ? value : new Date(value)
      const formatted = date.toISOString().split('T')[0]
      onEndDateChange(formatted)

      // 시작 날짜가 없거나 종료 날짜보다 이후면 하루 이전으로 자동 설정
      const currentStartDate = startDate ? new Date(startDate) : null
      if (!currentStartDate || currentStartDate >= date) {
        const previousDay = new Date(date)
        previousDay.setDate(previousDay.getDate() - 1)
        onStartDateChange(previousDay.toISOString().split('T')[0])
      }
    }
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

      <div className="space-y-5">
        {/* 섹션 헤더 */}
        <h3 className="text-lg font-semibold text-white">자산 / 기간 설정</h3>

        {/* 코인/페어 선택 (검색 버튼) */}
        <div className="space-y-2">
          <label className="text-sm text-white/60">코인/페어</label>
          <button
            onClick={() => setIsAssetModalOpen(true)}
            className="w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white hover:bg-white/10 transition-colors text-left"
          >
            <Search className="w-5 h-5 text-white/60" />
            <span className="flex-1 font-medium">{asset}</span>
            <span className="text-white/40 text-sm">클릭하여 검색</span>
          </button>
        </div>

        {/* 백테스트 기간 - Mantine DatePickerInput 사용 */}
        <div className="space-y-2">
          <label className="text-sm text-white/60">백테스트 기간</label>
          <div className="grid grid-cols-2 gap-3">
            <DatePickerInput
              value={startDateObj}
              onChange={(value) => handleStartDateChange(value as Date | null)}
              minDate={coinStartDateObj || undefined}
              maxDate={endDateObj || yesterday}
              placeholder="시작일"
              locale="ko"
              firstDayOfWeek={0}
              valueFormat="YYYY-MM-DD"
              clearable={false}
              size="md"
              radius="lg"
              getDayProps={(date) => ({
                style:
                  new Date(date).toDateString() === new Date().toDateString()
                    ? {
                        backgroundColor: 'rgba(168, 85, 247, 0.3)',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                      }
                    : undefined,
              })}
              styles={{
                input: {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  '&:focus': {
                    borderColor: '#A855F7',
                  },
                },
              }}
            />
            <DatePickerInput
              value={endDateObj}
              onChange={(value) => handleEndDateChange(value as Date | null)}
              minDate={startDateObj || undefined}
              maxDate={yesterday}
              placeholder="종료일"
              locale="ko"
              firstDayOfWeek={0}
              valueFormat="YYYY-MM-DD"
              clearable={false}
              size="md"
              radius="lg"
              getDayProps={(date) => ({
                style:
                  new Date(date).toDateString() === new Date().toDateString()
                    ? {
                        backgroundColor: 'rgba(168, 85, 247, 0.3)',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                      }
                    : undefined,
              })}
              styles={{
                input: {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  '&:focus': {
                    borderColor: '#A855F7',
                  },
                },
              }}
            />
          </div>
        </div>

        {/* 캔들 시간 간격 */}
        <div className="space-y-2">
          <label className="text-sm text-white/60">캔들 시간 간격</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TIMEFRAME_LABELS) as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeFrameChange(tf)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeFrame === tf
                    ? 'bg-purple-500/20 text-white border border-purple-500'
                    : 'bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 border border-transparent'
                }`}
              >
                {TIMEFRAME_LABELS[tf]}
              </button>
            ))}
          </div>
        </div>

        {/* 초기 자본금 */}
        <div className="space-y-2">
          <label className="text-sm text-white/60">초기 자본금 (USDT)</label>
          <input
            type="number"
            value={initialCapital}
            onChange={(e) => onInitialCapitalChange(Number(e.target.value))}
            min={100}
            step={100}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-white/30 focus:outline-none transition-colors"
            placeholder="1000000"
          />
        </div>
      </div>
    </>
  )
}
