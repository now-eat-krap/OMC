# backtest 서비스 패키지
# VectorBT 기반 백테스트 엔진
from .analyzer import ResultAnalyzer
from .engine import BacktestEngine
from .strategy import StrategyParser

# 하위 호환성을 위한 alias
BacktestService = BacktestEngine

__all__ = [
    "BacktestEngine",
    "BacktestService",  # 하위 호환성
    "StrategyParser",
    "ResultAnalyzer",
]
