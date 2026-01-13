# API 의존성 주입
# FastAPI Depends()와 함께 사용할 서비스 팩토리

from app.services.backtest import BacktestEngine
from app.services.data import DataService


def get_data_service() -> DataService:
    """DataService 인스턴스 반환

    Usage:
        @router.get("/example")
        async def example(data_service: DataService = Depends(get_data_service)):
            ...
    """
    return DataService()


def get_backtest_engine() -> BacktestEngine:
    """BacktestEngine 인스턴스 반환

    Usage:
        @router.post("/example")
        async def example(engine: BacktestEngine = Depends(get_backtest_engine)):
            ...
    """
    return BacktestEngine()
