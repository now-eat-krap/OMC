# 캔들 캐시 스케줄러
# 서버 시작 시 자동 초기화 + 매일 00:05 UTC 업데이트
# 각 타임프레임별로 Binance에서 직접 데이터 가져오기

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any

import ccxt
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import SUPPORTED_TIMEFRAMES, TOP_COIN_SYMBOLS, TOP_COINS
from app.services.cache import candle_cache

# 로깅 설정 (콘솔 출력)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# 글로벌 스케줄러 인스턴스
scheduler = AsyncIOScheduler()


def fetch_candles_sync(
    symbol: str,
    timeframe: str,
    start_date: str,
) -> list[dict[str, Any]]:
    """캔들 데이터 수집 (동기) - 각 타임프레임별로 직접 가져오기

    Args:
        symbol: 심볼 (예: BTC/USDT)
        timeframe: 타임프레임 (15m, 1h, 4h, 1d, 1w, 1M)
        start_date: 시작일 (YYYY-MM-DD)

    Returns:
        캔들 리스트
    """
    exchange = ccxt.binance({"enableRateLimit": True, "options": {"defaultType": "spot"}})

    all_candles = []

    # 타임프레임별 시작 날짜 조정
    # 주봉/월봉은 해당 기간의 시작일로 조정해야 첫 캔들을 가져올 수 있음
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")

    if timeframe == "1w":
        # 해당 주의 월요일로 조정 (Binance 주봉은 월요일 시작)
        days_since_monday = start_dt.weekday()  # 월=0, 화=1, ...
        start_dt = start_dt - timedelta(days=days_since_monday)
        logger.debug(
            f"[{symbol}] 주봉 시작일 조정: {start_date} -> {start_dt.strftime('%Y-%m-%d')}"
        )
    elif timeframe == "1M":
        # 해당 월의 1일로 조정
        start_dt = start_dt.replace(day=1)
        logger.debug(
            f"[{symbol}] 월봉 시작일 조정: {start_date} -> {start_dt.strftime('%Y-%m-%d')}"
        )

    since = int(start_dt.timestamp() * 1000)

    logger.debug(f"[{symbol}] {timeframe} 수집 시작 ({start_date}~)")

    while True:
        try:
            ohlcv = exchange.fetch_ohlcv(
                symbol=symbol,
                timeframe=timeframe,
                since=since,
                limit=1000,
            )

            if not ohlcv:
                break

            for candle in ohlcv:
                all_candles.append(
                    {
                        "timestamp": candle[0],
                        "open": candle[1],
                        "high": candle[2],
                        "low": candle[3],
                        "close": candle[4],
                        "volume": candle[5],
                    }
                )

            since = ohlcv[-1][0] + 1

            if since >= int(datetime.now().timestamp() * 1000):
                break

        except Exception as e:
            logger.error(f"[{symbol}] {timeframe} 오류: {e}")
            break

    logger.debug(f"[{symbol}] {timeframe} {len(all_candles)}개 캔들 수집 완료")
    return all_candles


async def initialize_cache_if_empty():
    """Redis가 비어있으면 캐시 초기화 (비동기 래퍼)"""
    if not candle_cache.is_available:
        logger.warning("Redis 연결 불가. 캐시 초기화 건너뜀.")
        return

    # 첫 번째 코인의 첫 번째 타임프레임으로 캐시 존재 여부 확인
    test_candles = candle_cache.get_candles(TOP_COIN_SYMBOLS[0], "1d")

    if test_candles and len(test_candles) > 0:
        logger.info(f"캐시에 데이터 존재 ({len(test_candles)}개). 초기화 건너뜀.")
        return

    logger.debug("=" * 50)
    logger.info("캐시 비어있음. 초기화 시작...")
    logger.info(f"대상 코인: {len(TOP_COIN_SYMBOLS)}개")
    logger.info(f"타임프레임: {SUPPORTED_TIMEFRAMES}")
    logger.debug("=" * 50)

    # 백그라운드에서 동기 함수 실행
    loop = asyncio.get_event_loop()

    for coin in TOP_COIN_SYMBOLS:
        coin_info = TOP_COINS.get(coin, ("2000-01-01", 4, 2))
        start_date = coin_info[0]  # 튜플의 첫 번째 요소 (시작일)

        for tf in SUPPORTED_TIMEFRAMES:
            try:
                candles = await loop.run_in_executor(
                    None, lambda c=coin, t=tf, s=start_date: fetch_candles_sync(c, t, s)
                )
                if candles:
                    candle_cache.set_candles(coin, tf, candles)
            except Exception as e:
                logger.error(f"[{coin}] {tf} 초기화 실패: {e}")

    # 마지막 업데이트 날짜 저장
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    candle_cache.set_last_update(yesterday)

    logger.debug("=" * 50)
    logger.info("캐시 초기화 완료!")
    logger.debug("=" * 50)


async def update_cache_daily():
    """매일 새 캔들 추가 (스케줄러에서 호출)"""
    if not candle_cache.is_available:
        logger.warning("Redis 연결 불가. 업데이트 건너뜀.")
        return

    last_update = candle_cache.get_last_update()
    logger.info("=== 일일 캐시 업데이트 시작 ===")
    logger.info(f"마지막 업데이트: {last_update}")

    loop = asyncio.get_event_loop()

    # 마지막 업데이트 이후의 데이터만 가져옴
    start_date = last_update or (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")

    for coin in TOP_COIN_SYMBOLS:
        for tf in SUPPORTED_TIMEFRAMES:
            try:
                candles = await loop.run_in_executor(
                    None, lambda c=coin, t=tf, s=start_date: fetch_candles_sync(c, t, s)
                )
                if candles:
                    candle_cache.append_candles(coin, tf, candles)
            except Exception as e:
                logger.error(f"[{coin}] {tf} 업데이트 실패: {e}")

    # 어제 날짜로 마지막 업데이트 저장
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    candle_cache.set_last_update(yesterday)

    logger.info(f"=== 일일 캐시 업데이트 완료 ({yesterday}) ===")


def setup_scheduler():
    """스케줄러 설정 (매일 00:05 UTC)"""
    # 매일 00:05 UTC에 실행
    scheduler.add_job(
        update_cache_daily,
        trigger=CronTrigger(hour=0, minute=5),  # UTC 00:05 = 한국 09:05
        id="daily_cache_update",
        name="Daily Cache Update",
        replace_existing=True,
    )

    logger.info("스케줄러 설정 완료: 매일 00:05 UTC (한국 09:05)")


async def warmup_numba_jit():
    """Numba JIT 컴파일 워밍업 - 서버 시작 시 실행

    VectorBT는 내부적으로 Numba JIT 컴파일을 사용합니다.
    첫 실행 시 컴파일 오버헤드가 발생하므로, 서버 시작 시
    더미 데이터로 미리 컴파일하여 사용자 요청 시 빠르게 처리합니다.
    """
    import numpy as np
    import pandas as pd
    import vectorbt as vbt

    logger.info("Numba JIT 워밍업 시작...")

    try:
        # 작은 더미 데이터로 Portfolio.from_signals() 호출
        # 이 과정에서 Numba JIT 컴파일이 수행됨
        dummy_close = pd.Series(np.random.random(100) * 100 + 1000)
        dummy_entries = pd.Series([False] * 100)
        dummy_exits = pd.Series([False] * 100)
        dummy_entries.iloc[10] = True  # 더미 진입
        dummy_exits.iloc[20] = True  # 더미 청산

        # 이 호출에서 JIT 컴파일 발생
        portfolio = vbt.Portfolio.from_signals(
            close=dummy_close,
            entries=dummy_entries,
            exits=dummy_exits,
            init_cash=10000,
            freq="1D",
        )

        # 주요 통계 함수들도 워밍업 (각각 별도 JIT 함수 사용)
        _ = portfolio.total_return()
        _ = portfolio.max_drawdown()
        _ = portfolio.sharpe_ratio()
        _ = portfolio.value()

        # trades 관련 함수 워밍업
        trades = portfolio.trades
        _ = trades.count()

        logger.info("Numba JIT 워밍업 완료!")

    except Exception as e:
        logger.warning(f"Numba JIT 워밍업 실패 (무시됨): {e}")


@asynccontextmanager
async def lifespan(app):
    """FastAPI 라이프사이클 관리"""
    # 시작 시
    logger.info("=== 서버 시작 ===")

    # 1. Numba JIT 워밍업 (첫 요청 지연 방지)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: asyncio.run(warmup_numba_jit()))

    # 2. Redis 비어있으면 초기화 (백그라운드)
    asyncio.create_task(initialize_cache_if_empty())

    # 3. 스케줄러 설정 및 시작
    setup_scheduler()
    scheduler.start()
    logger.info("스케줄러 시작됨")

    yield

    # 종료 시
    scheduler.shutdown()
    logger.info("=== 서버 종료 ===")
