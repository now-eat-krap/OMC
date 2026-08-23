# OHLCV 데이터 수집 서비스
# ccxt 라이브러리를 사용하여 Binance에서 데이터 수집
# Redis 캐시 연동으로 속도 향상

import logging
from datetime import datetime, timedelta
from typing import Any

import ccxt
import pandas as pd

from app.services.cache import candle_cache

logger = logging.getLogger(__name__)


class DataService:
    """암호화폐 데이터 수집 서비스"""

    def __init__(self):
        # Binance 거래소 인스턴스 (API 키 없이 공개 데이터만 사용)
        self.exchange = ccxt.binance({"enableRateLimit": True, "options": {"defaultType": "spot"}})

        # 메모리 캐시 (간단한 구현)
        self._cache: dict[str, Any] = {}

        # 마켓 정보 캐시 (precision 등)
        self._markets_cache: dict[str, Any] = {}

        # Redis 캐시 참조
        self._redis_cache = candle_cache

    def get_market_info(self, symbol: str) -> dict[str, Any]:
        """심볼의 마켓 정보 조회 (precision 등)"""
        # 마켓 캐시가 비어있으면 로드
        if not self._markets_cache:
            try:
                self._markets_cache = self.exchange.load_markets()
            except Exception as e:
                logger.warning(f"마켓 정보 로드 실패: {e}")
                return {}

        market = self._markets_cache.get(symbol, {})
        if not market:
            return {}

        # precision 정보 추출
        precision = market.get("precision", {})
        limits = market.get("limits", {})

        return {
            "amountPrecision": precision.get("amount", 8),  # 수량 소수점
            "pricePrecision": precision.get("price", 2),  # 가격 소수점
            "minAmount": limits.get("amount", {}).get("min", 0),  # 최소 주문량
            "minCost": limits.get("cost", {}).get("min", 0),  # 최소 주문 금액
        }

    async def get_available_assets(self) -> list[dict[str, str]]:
        """사용 가능한 코인 목록 조회"""
        try:
            # 마켓 정보 로드
            markets = self.exchange.load_markets()

            # USDT 페어만 필터링
            usdt_pairs = [
                {
                    "symbol": symbol,
                    "base": market["base"],
                    "quote": market["quote"],
                }
                for symbol, market in markets.items()
                if market["quote"] == "USDT" and market["active"]
            ]

            # 거래량 상위 50개 (정렬은 현재 불가, 단순 리스트)
            # 주요 코인들을 먼저 배치
            priority_coins = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT"]

            sorted_pairs = []
            for coin in priority_coins:
                found = next((p for p in usdt_pairs if p["symbol"] == coin), None)
                if found:
                    sorted_pairs.append(found)

            # 나머지 추가
            for pair in usdt_pairs[:100]:
                if pair not in sorted_pairs:
                    sorted_pairs.append(pair)

            return sorted_pairs[:50]  # 상위 50개만

        except Exception as e:
            raise Exception(f"자산 목록 조회 실패: {str(e)}") from e

    async def get_ohlcv(
        self,
        symbol: str,
        timeframe: str = "1d",
        limit: int = 500,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        """OHLCV 캔들 데이터 조회"""

        cache_key = f"{symbol}_{timeframe}_{start_date}_{end_date}_{limit}"

        # 캐시 확인
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            # 날짜를 타임스탬프로 변환
            since = None
            if start_date:
                since = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp() * 1000)

            # OHLCV 데이터 조회
            ohlcv = self.exchange.fetch_ohlcv(
                symbol=symbol,
                timeframe=timeframe,
                since=since,
                limit=limit,
            )

            # 결과 포맷팅
            result = []
            for candle in ohlcv:
                timestamp, open_, high, low, close, volume = candle

                # end_date 필터링
                if end_date:
                    end_ts = int(datetime.strptime(end_date, "%Y-%m-%d").timestamp() * 1000)
                    if timestamp > end_ts:
                        continue

                result.append(
                    {
                        "timestamp": timestamp,
                        "datetime": datetime.fromtimestamp(timestamp / 1000).isoformat(),
                        "open": open_,
                        "high": high,
                        "low": low,
                        "close": close,
                        "volume": volume,
                    }
                )

            # 캐시 저장
            self._cache[cache_key] = result

            return result

        except Exception as e:
            raise Exception(f"OHLCV 데이터 조회 실패: {str(e)}") from e

    def get_ohlcv_dataframe(
        self,
        symbol: str,
        timeframe: str = "1d",
        limit: int = 500,
        start_date: str | None = None,
        end_date: str | None = None,
        include_warmup: int = 0,  # warmup 캔들 수
    ) -> pd.DataFrame:
        """OHLCV 데이터를 DataFrame으로 반환 (동기 버전, VectorBT용)

        Args:
            include_warmup: 지표 계산을 위한 추가 캔들 수 (시작일 앞으로)

        Returns:
            OHLCV DataFrame

        Note:
            상위 10개 코인은 Redis 캐시에서 우선 조회
        """

        # warmup 기간 계산
        warmup_start_date = start_date
        if start_date and include_warmup > 0:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            if timeframe in ["1d", "d", "D"]:
                delta = timedelta(days=include_warmup)
            elif timeframe in ["1h", "h", "H"]:
                delta = timedelta(hours=include_warmup)
            elif timeframe in ["4h", "4H"]:
                delta = timedelta(hours=include_warmup * 4)
            elif timeframe in ["1w", "w", "W"]:
                delta = timedelta(weeks=include_warmup)
            elif timeframe in ["1M", "M"]:
                # 월봉은 약 30일로 계산
                delta = timedelta(days=include_warmup * 30)
            else:
                delta = timedelta(days=include_warmup)

            warmup_dt = start_dt - delta

            # 주봉/월봉은 해당 기간의 시작점으로 조정
            if timeframe in ["1w", "w", "W"]:
                # 해당 주의 월요일로 조정
                days_since_monday = warmup_dt.weekday()
                warmup_dt = warmup_dt - timedelta(days=days_since_monday)
            elif timeframe in ["1M", "M"]:
                # 해당 월의 1일로 조정
                warmup_dt = warmup_dt.replace(day=1)

            warmup_start_date = warmup_dt.strftime("%Y-%m-%d")

        # 1. Redis 캐시 우선 조회
        if self._redis_cache.is_available:
            cached_candles = self._redis_cache.get_candles(
                symbol=symbol,
                timeframe=timeframe,
                start_date=warmup_start_date,
                end_date=end_date,
            )

            if cached_candles and len(cached_candles) > 0:
                logger.debug(f"캐시 히트: {symbol} {timeframe} ({len(cached_candles)}개)")

                df = pd.DataFrame(cached_candles)
                df["datetime"] = pd.to_datetime(df["timestamp"], unit="ms")
                df.set_index("datetime", inplace=True)
                return df

        # 2. 캐시 미스 시 Binance API 호출
        logger.debug(f"캐시 미스, API 호출: {symbol} {timeframe}")

        try:
            since = None
            if warmup_start_date:
                since = int(datetime.strptime(warmup_start_date, "%Y-%m-%d").timestamp() * 1000)
            end_ms = None
            if end_date:
                # end_date 당일 포함
                end_ms = int(
                    (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)).timestamp() * 1000
                )

            # end_date 가 있으면 거기까지 전부 받는다. limit 은 끝이 정해지지 않았을 때의
            # 개수 상한일 뿐, 기간이 정해진 요청을 자르는 기준이 아니다
            max_candles = self._MAX_CANDLES if end_ms is not None else limit
            ohlcv = self._fetch_ohlcv_paged(symbol, timeframe, since, end_ms, max_candles)

            df = pd.DataFrame(
                ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"]
            )
            df["datetime"] = pd.to_datetime(df["timestamp"], unit="ms")
            df.set_index("datetime", inplace=True)

            # end_date 필터링
            if end_date:
                df = df[df.index <= end_date]

            return df

        except Exception as e:
            raise Exception(f"DataFrame 변환 실패: {str(e)}") from e

    # Binance 가 한 번에 돌려주는 캔들 상한
    _BINANCE_PAGE = 1000
    # 기간이 정해진 요청의 안전 상한 (15분봉 10년 ≈ 35만 개)
    _MAX_CANDLES = 400_000

    def _fetch_ohlcv_paged(
        self,
        symbol: str,
        timeframe: str,
        since: int | None,
        end_ms: int | None,
        max_candles: int,
    ) -> list[list]:
        """since 부터 end_ms(또는 max_candles)까지 1000개씩 이어 받는다

        Binance 는 호출당 1000개가 상한이라 limit 에 2000 을 넘겨도 1000개만 온다.
        예전에는 fetch_ohlcv(since, limit=1000+warmup) 한 번으로 끝내서, warmup 이
        1000봉일 때 warmup 구간만 받고 정작 요청 기간이 통째로 잘렸다 (→ 조건이 맞아도
        거래 0건에 "정상 완료"). 캐시가 있는 코인·타임프레임에서는 안 보이고, 콜드
        스타트나 목록 밖 코인에서만 드러나던 문제다.
        """
        out: list[list] = []
        cursor = since
        while len(out) < max_candles:
            page = self.exchange.fetch_ohlcv(
                symbol=symbol,
                timeframe=timeframe,
                since=cursor,
                limit=min(self._BINANCE_PAGE, max_candles - len(out)),
            )
            if not page:
                break
            out.extend(page)
            last_ts = page[-1][0]
            if end_ms is not None and last_ts >= end_ms:
                break
            if len(page) < self._BINANCE_PAGE:
                break  # 마지막 페이지
            next_cursor = last_ts + 1
            if cursor is not None and next_cursor <= cursor:
                break  # 진행이 없으면 무한 루프 방지
            cursor = next_cursor
        return out
