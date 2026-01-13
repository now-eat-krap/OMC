# Redis 기반 캔들 캐시 서비스
# 각 타임프레임별 데이터 직접 저장 (집계 없음)

import json
import logging
from datetime import datetime, timedelta
from typing import Any

try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

from app.config import (
    REDIS_DB,
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    SUPPORTED_TIMEFRAMES,
    TOP_COIN_SYMBOLS,
    TOP_COINS,
)

logger = logging.getLogger(__name__)


class CandleCache:
    """Redis 기반 캔들 캐시 서비스

    각 타임프레임별로 Binance에서 직접 가져온 데이터 저장
    집계 로직 없음 - TradingView와 100% 일치하는 데이터 제공
    """

    def __init__(self):
        self._redis: Any | None = None
        self._connected = False
        self._connect()

    def _connect(self) -> bool:
        """Redis 연결"""
        if not REDIS_AVAILABLE:
            logger.warning("redis-py가 설치되지 않음. 캐시 비활성화.")
            return False

        try:
            self._redis = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                password=REDIS_PASSWORD,
                decode_responses=True,
            )
            # 연결 테스트
            self._redis.ping()
            self._connected = True
            logger.info(f"Redis 연결 성공: {REDIS_HOST}:{REDIS_PORT}")
            return True
        except Exception as e:
            logger.warning(f"Redis 연결 실패: {e}. 캐시 비활성화.")
            self._connected = False
            return False

    @property
    def is_available(self) -> bool:
        """캐시 사용 가능 여부"""
        return self._connected and self._redis is not None

    def _get_cache_key(self, symbol: str, timeframe: str) -> str:
        """캐시 키 생성

        예: candle:BTC_USDT:1d
        """
        safe_symbol = symbol.replace("/", "_")
        return f"candle:{safe_symbol}:{timeframe}"

    def _adjust_start_date_for_timeframe(
        self,
        start_date: str,
        timeframe: str,
    ) -> str:
        """타임프레임에 맞게 시작 날짜 조정

        주봉: 해당 주의 월요일로 조정
        월봉: 해당 월의 1일로 조정
        """
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")

        if timeframe == "1w":
            # 해당 주의 월요일로 조정 (Binance 주봉은 월요일 시작)
            days_since_monday = start_dt.weekday()  # 월=0, 화=1, ...
            start_dt = start_dt - timedelta(days=days_since_monday)
        elif timeframe == "1M":
            # 해당 월의 1일로 조정
            start_dt = start_dt.replace(day=1)

        return start_dt.strftime("%Y-%m-%d")

    def get_candles(
        self,
        symbol: str,
        timeframe: str = "1d",
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]] | None:
        """캐시에서 캔들 데이터 조회

        Args:
            symbol: 심볼 (예: BTC/USDT)
            timeframe: 타임프레임 (15m, 1h, 4h, 1d, 1w, 1M)
            start_date: 시작일 (YYYY-MM-DD)
            end_date: 종료일 (YYYY-MM-DD)

        Returns:
            캔들 리스트 또는 None (캐시 미스)
        """
        if not self.is_available:
            return None

        if symbol not in TOP_COINS:
            return None

        if timeframe not in SUPPORTED_TIMEFRAMES:
            return None

        try:
            cache_key = self._get_cache_key(symbol, timeframe)
            raw_data = self._redis.get(cache_key)

            if not raw_data:
                return None

            candles = json.loads(raw_data)

            # 날짜 필터링 (타임프레임에 맞게 시작일 조정)
            adjusted_start = start_date
            if start_date and timeframe in ["1w", "1M"]:
                adjusted_start = self._adjust_start_date_for_timeframe(start_date, timeframe)

            if adjusted_start or end_date:
                candles = self._filter_by_date(candles, adjusted_start, end_date)

            return candles

        except Exception as e:
            logger.error(f"캐시 조회 실패: {e}")
            return None

    def set_candles(self, symbol: str, timeframe: str, candles: list[dict[str, Any]]) -> bool:
        """캐시에 캔들 데이터 저장

        Args:
            symbol: 심볼 (예: BTC/USDT)
            timeframe: 타임프레임 (15m, 1h, 4h, 1d, 1w, 1M)
            candles: 캔들 리스트

        Returns:
            저장 성공 여부
        """
        if not self.is_available:
            return False

        try:
            cache_key = self._get_cache_key(symbol, timeframe)
            self._redis.set(cache_key, json.dumps(candles))
            logger.info(f"캐시 저장: {symbol} {timeframe} ({len(candles)}개)")
            return True
        except Exception as e:
            logger.error(f"캐시 저장 실패: {e}")
            return False

    def append_candles(
        self, symbol: str, timeframe: str, new_candles: list[dict[str, Any]]
    ) -> bool:
        """기존 캐시에 새 캔들 추가 (하루 1회 업데이트용)

        Args:
            symbol: 심볼
            timeframe: 타임프레임
            new_candles: 추가할 캔들 리스트

        Returns:
            추가 성공 여부
        """
        if not self.is_available:
            return False

        try:
            existing = self.get_candles(symbol, timeframe)
            if existing:
                # 마지막 타임스탬프 이후 데이터만 추가
                last_ts = existing[-1]["timestamp"]
                filtered_new = [c for c in new_candles if c["timestamp"] > last_ts]
                if filtered_new:
                    existing.extend(filtered_new)
                    return self.set_candles(symbol, timeframe, existing)
            else:
                return self.set_candles(symbol, timeframe, new_candles)
            return True
        except Exception as e:
            logger.error(f"캐시 추가 실패: {e}")
            return False

    def _filter_by_date(
        self,
        candles: list[dict[str, Any]],
        start_date: str | None,
        end_date: str | None,
    ) -> list[dict[str, Any]]:
        """날짜 범위로 캔들 필터링"""
        result = candles

        if start_date:
            start_ts = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp() * 1000)
            result = [c for c in result if c["timestamp"] >= start_ts]

        if end_date:
            # end_date의 다음 날 00:00 까지 포함
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            end_ts = int(end_dt.timestamp() * 1000)
            result = [c for c in result if c["timestamp"] < end_ts]

        return result

    def set_last_update(self, date_str: str) -> bool:
        """마지막 업데이트 날짜 저장"""
        if not self.is_available:
            return False

        try:
            self._redis.set("candle:last_update", date_str)
            return True
        except Exception as e:
            logger.error(f"마지막 업데이트 날짜 저장 실패: {e}")
            return False

    def get_last_update(self) -> str | None:
        """마지막 업데이트 날짜 조회"""
        if not self.is_available:
            return None

        try:
            return self._redis.get("candle:last_update")
        except Exception as e:
            logger.error(f"마지막 업데이트 날짜 조회 실패: {e}")
            return None

    def get_cache_stats(self) -> dict[str, Any]:
        """캐시 상태 조회"""
        if not self.is_available:
            return {"available": False}

        stats = {
            "available": True,
            "coins": {},
            "last_update": self.get_last_update(),
        }

        for coin in TOP_COIN_SYMBOLS:
            stats["coins"][coin] = {}
            for tf in SUPPORTED_TIMEFRAMES:
                candles = self.get_candles(coin, tf)
                if candles:
                    stats["coins"][coin][tf] = {
                        "count": len(candles),
                        "first": datetime.fromtimestamp(candles[0]["timestamp"] / 1000).isoformat()
                        if candles
                        else None,
                        "last": datetime.fromtimestamp(candles[-1]["timestamp"] / 1000).isoformat()
                        if candles
                        else None,
                    }

        return stats


# 싱글톤 인스턴스
candle_cache = CandleCache()
