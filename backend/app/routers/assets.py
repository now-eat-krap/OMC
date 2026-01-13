# 자산 관련 API 라우터
# 코인 목록, OHLCV 데이터 조회


from fastapi import APIRouter, HTTPException, Query

from app.config import TOP_COINS
from app.services.data import DataService

router = APIRouter()
data_service = DataService()


@router.get("/assets")
async def get_assets():
    """사용 가능한 코인 목록 조회 (캐시된 코인만 반환)"""
    try:
        # config.py의 TOP_COINS에서 직접 가져옴 (precision 포함)
        assets = []
        for symbol, coin_info in TOP_COINS.items():
            start_date, amount_prec, price_prec = coin_info

            assets.append(
                {
                    "symbol": symbol,
                    "base": symbol.split("/")[0],
                    "quote": symbol.split("/")[1],
                    "start_date": start_date,
                    # precision 정보 (config에서 직접 제공)
                    "amountPrecision": amount_prec,
                    "pricePrecision": price_prec,
                }
            )

        return {"assets": assets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/ohlcv/{symbol}")
async def get_ohlcv(
    symbol: str,
    timeframe: str = Query(default="1d", description="캔들 시간 간격 (1m, 5m, 15m, 1h, 4h, 1d)"),
    limit: int = Query(default=500, ge=1, le=1000, description="캔들 개수"),
    start_date: str | None = Query(default=None, description="시작일 (YYYY-MM-DD)"),
    end_date: str | None = Query(default=None, description="종료일 (YYYY-MM-DD)"),
):
    """OHLCV 캔들 데이터 조회"""
    try:
        # symbol 포맷 변환 (BTC-USDT -> BTC/USDT)
        formatted_symbol = symbol.replace("-", "/")

        ohlcv = await data_service.get_ohlcv(
            symbol=formatted_symbol,
            timeframe=timeframe,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
        )
        return {"symbol": formatted_symbol, "timeframe": timeframe, "data": ohlcv}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
