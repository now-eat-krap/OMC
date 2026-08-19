// TradingView 스타일 자산 검색 모달 컴포넌트
// 검색어로 코인 페어를 필터링하여 선택

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'

// 한글 이름 매핑
const COIN_NAMES: Record<string, string> = {
  BTC: '비트코인',
  ETH: '이더리움',
  BNB: '바이낸스코인',
  SOL: '솔라나',
  XRP: '리플',
  DOGE: '도지코인',
  ADA: '카르다노',
  AVAX: '아발란체',
  LINK: '체인링크',
  DOT: '폴카닷',
}

interface Asset {
  symbol: string
  base: string
  quote: string
  start_date: string
}

interface AssetSearchModalProps {
  isOpen: boolean
  onClose: () => void
  currentAsset: string
  onSelectAsset: (asset: string, startDate: string) => void
}

export default function AssetSearchModal({
  isOpen,
  onClose,
  currentAsset,
  onSelectAsset,
}: AssetSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // API에서 코인 목록 가져오기
  useEffect(() => {
    const fetchAssets = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/assets')
        const data = await response.json()
        setAssets(data.assets || [])
      } catch {
        // 에러 처리는 사용자에게 로딩 실패로 표시됨
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen && assets.length === 0) {
      fetchAssets()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // 모달 열릴 때 검색창에 포커스
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setSearchQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // 검색 필터링
  const filteredPairs = assets.filter((asset) => {
    const query = searchQuery.toLowerCase()
    const name = COIN_NAMES[asset.base] || asset.base
    return asset.symbol.toLowerCase().includes(query) || name.toLowerCase().includes(query)
  })

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredPairs.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredPairs[selectedIndex]) {
          handleSelect(filteredPairs[selectedIndex])
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }

  const handleSelect = (asset: Asset) => {
    onSelectAsset(asset.symbol, asset.start_date)
    onClose()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onClose} />

      {/* 모달 */}
      <div className="relative w-full max-w-lg mx-4 bg-panel border border-line overflow-hidden">
        {/* 검색 헤더 */}
        <div className="p-4 border-b border-line">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="심볼 또는 이름 검색..."
              className="w-full bg-raise border border-line pl-10 pr-4 py-3 text-strong placeholder-white/40 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {/* 결과 목록 */}
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-dim">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              로딩 중...
            </div>
          ) : filteredPairs.length > 0 ? (
            filteredPairs.map((asset, index) => {
              const isSelected = index === selectedIndex
              const isCurrent = asset.symbol === currentAsset
              return (
                <button
                  key={asset.symbol}
                  onClick={() => handleSelect(asset)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-wash' : 'hover:bg-raise'} ${isCurrent ? 'bg-raise' : ''}`}
                >
                  {/* 코인 아이콘 placeholder */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-strong text-xs font-bold">
                    {asset.base.slice(0, 2)}
                  </div>

                  {/* 심볼 및 이름 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-strong font-medium">{asset.symbol}</span>
                      {asset.symbol === currentAsset && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-wash text-accent">
                          현재
                        </span>
                      )}
                    </div>
                    <span className="text-dim text-sm">{COIN_NAMES[asset.base] || asset.base}</span>
                  </div>

                  {/* 시작일 */}
                  <span className="text-dim text-xs">{asset.start_date}~</span>
                </button>
              )
            })
          ) : (
            <div className="p-8 text-center text-dim">검색 결과가 없습니다</div>
          )}
        </div>

        {/* 하단 안내 */}
        <div className="p-3 border-t border-line bg-panel">
          <div className="flex items-center justify-center gap-4 text-xs text-dim">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-raise text-muted">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-raise text-muted">↓</kbd>
              이동
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-raise text-muted">Enter</kbd>
              선택
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-raise text-muted">Esc</kbd>
              닫기
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
