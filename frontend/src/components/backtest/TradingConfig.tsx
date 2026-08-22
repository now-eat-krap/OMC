// 거래 설정 컴포넌트
// 수수료, 슬리피지, 포지션 비율, 레버리지

import type { TradingConfig } from './types'

interface TradingConfigPanelProps {
  config: TradingConfig
  onChange: (config: TradingConfig) => void
}

export default function TradingConfigPanel({ config, onChange }: TradingConfigPanelProps) {
  const handleChange = (key: keyof TradingConfig, value: number) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <div className="space-y-5">
      {/* 섹션 헤더 */}
      <h3 className="text-lg font-semibold text-strong">거래 설정</h3>

      {/* 거래 수수료 */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-muted">거래 수수료</label>
          <span className="text-sm text-strong font-mono">{config.feeRate}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={config.feeRate}
          onChange={(e) => handleChange('feeRate', Number(e.target.value))}
          className="w-full h-2 bg-raise appearance-none cursor-pointer accent-white"
        />
        <div className="flex justify-between text-xs text-dim">
          <span>0%</span>
          <span>0.5%</span>
          <span>1%</span>
        </div>
      </div>

      {/* 슬리피지 */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-muted">슬리피지</label>
          <span className="text-sm text-strong font-mono">{config.slippage}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.01}
          value={config.slippage}
          onChange={(e) => handleChange('slippage', Number(e.target.value))}
          className="w-full h-2 bg-raise appearance-none cursor-pointer accent-white"
        />
        <div className="flex justify-between text-xs text-dim">
          <span>0%</span>
          <span>0.25%</span>
          <span>0.5%</span>
        </div>
      </div>

      {/* 포지션 비율 */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-muted">포지션 비율</label>
          <span className="text-sm text-strong font-mono">{config.positionSize}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={config.positionSize}
          onChange={(e) => handleChange('positionSize', Number(e.target.value))}
          className="w-full h-2 bg-raise appearance-none cursor-pointer accent-white"
        />
        <div className="flex justify-between text-xs text-dim">
          <span>10%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* 레버리지 */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-muted">레버리지</label>
          <span className="text-sm text-strong font-mono font-bold">{config.leverage}x</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 5, 10].map((lev) => (
            <button
              key={lev}
              onClick={() => handleChange('leverage', lev)}
              className={`px-3 py-2 text-sm font-medium transition-all ${
                config.leverage === lev
                  ? 'bg-wash text-strong border border-accent rounded-card'
                  : 'bg-raise text-dim hover:text-muted hover:bg-raise border border-transparent'
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
        {config.leverage > 1 && (
          <p className="text-xs text-dim flex items-center gap-1">
            ⚠️ 레버리지 사용 시 위험이 증가합니다
          </p>
        )}
      </div>
    </div>
  )
}
