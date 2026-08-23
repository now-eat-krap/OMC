"""캐시 미스 시 Binance API 폴백이 1000개 상한을 넘어 이어 받는지"""

from datetime import datetime, timedelta

from app.services.data import DataService

DAY = 86_400_000


class FakeExchange:
    """Binance 처럼 호출당 최대 1000개만 돌려주는 가짜 거래소"""

    def __init__(self, start_ms: int, n: int):
        self.candles = [[start_ms + i * DAY, 1.0, 2.0, 0.5, 1.5, 10.0] for i in range(n)]
        self.calls = 0

    def fetch_ohlcv(self, symbol, timeframe, since=None, limit=500):
        self.calls += 1
        rows = [c for c in self.candles if since is None or c[0] >= since]
        return rows[: min(limit, 1000)]


def _service(start_ms: int, n: int):
    svc = DataService.__new__(DataService)  # __init__(ccxt) 건너뜀
    svc.exchange = FakeExchange(start_ms, n)
    svc._cache = {}

    class NoRedis:
        is_available = False

    svc._redis_cache = NoRedis()
    return svc


def test_fetches_past_first_1000_until_end_date():
    # 2020-01-01 부터 3000일치가 있는 거래소. warmup 1000 + 요청 기간 2023-01-01~2024-06-30
    start = int(datetime(2020, 1, 1).timestamp() * 1000)
    svc = _service(start, 3000)
    df = svc.get_ohlcv_dataframe(
        symbol="X/USDT",
        timeframe="1d",
        limit=2000,  # 예전 코드는 이 값을 한 번에 넘겨 1000개만 받았다
        start_date="2023-01-01",
        end_date="2024-06-30",
        include_warmup=1000,
    )
    # 요청 기간 끝까지 받아야 한다
    assert str(df.index[-1].date()) == "2024-06-30"
    assert str(df.index[0].date()) == "2020-04-06"  # 2023-01-01 - 1000일
    assert len(df) == 1547  # 1000 warmup + 547
    # 1000개씩 두 페이지
    assert svc.exchange.calls == 2


def test_without_end_date_limit_is_the_cap():
    start = int(datetime(2020, 1, 1).timestamp() * 1000)
    svc = _service(start, 3000)
    df = svc.get_ohlcv_dataframe(
        symbol="X/USDT", timeframe="1d", limit=1500, start_date="2020-01-01"
    )
    assert len(df) == 1500
    assert svc.exchange.calls == 2


def test_stops_when_exchange_runs_out():
    start = int(datetime(2024, 1, 1).timestamp() * 1000)
    svc = _service(start, 120)  # 120일치뿐
    end = (datetime(2024, 1, 1) + timedelta(days=400)).strftime("%Y-%m-%d")
    df = svc.get_ohlcv_dataframe(
        symbol="X/USDT", timeframe="1d", limit=5000, start_date="2024-01-01", end_date=end
    )
    assert len(df) == 120
    assert svc.exchange.calls == 1
