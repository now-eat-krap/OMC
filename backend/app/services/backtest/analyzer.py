# 결과 분석 및 통계 계산
# 백테스트 결과에서 통계, 거래 내역, 지표 데이터 추출


import pandas as pd

from app.schemas import (
    IndicatorData,
    IndicatorDataPoint,
    OHLCVData,
    SentenceCondition,
    TradeRecord,
)
from app.services import indicator_registry as registry
from app.utils import safe_float


class ResultAnalyzer:
    """백테스트 결과 분석 클래스

    VectorBT 포트폴리오에서 통계, 거래 내역, 차트 데이터 추출
    """

    def build_ohlcv(self, df: pd.DataFrame) -> list[OHLCVData]:
        """OHLCV 데이터 생성

        Args:
            df: OHLCV DataFrame (타임스탬프 인덱스)

        Returns:
            OHLCVData 리스트
        """
        # to_dict('records') 사용으로 iterrows() 대비 50~100배 빠름
        df_records = df.reset_index().to_dict("records")
        return [
            OHLCVData(
                timestamp=int(row["timestamp"]),
                open=safe_float(row["open"]),
                high=safe_float(row["high"]),
                low=safe_float(row["low"]),
                close=safe_float(row["close"]),
                volume=safe_float(row["volume"]),
            )
            for row in df_records
        ]

    def build_trades(
        self,
        trades_df: pd.DataFrame,
        slippage_rate: float,
        last_timestamp=None,
        df_ohlcv: pd.DataFrame = None,
    ) -> list[TradeRecord]:
        """거래 내역 생성

        Args:
            trades_df: VectorBT trades.records_readable DataFrame
            slippage_rate: 슬리피지 비율 (%)
            last_timestamp: 마지막 봉 타임스탬프 (미실현 손익 판단용)
            df_ohlcv: OHLCV DataFrame (MFE/MAE 계산용)

        Returns:
            TradeRecord 리스트
        """
        if len(trades_df) == 0:
            return []

        trade_records = []
        cumulative_pnl = 0

        trades_list = trades_df.to_dict("records")
        for trade in trades_list:
            pnl = float(trade.get("PnL", 0))
            cumulative_pnl += pnl

            # 수수료 계산 (진입 + 청산 수수료)
            entry_fees = safe_float(trade.get("Entry Fees", 0))
            exit_fees = safe_float(trade.get("Exit Fees", 0))
            total_fee = entry_fees + exit_fees

            # 슬리피지 계산 (진입 + 청산 분리)
            entry_price = float(trade.get("Avg Entry Price", 0))
            exit_price = float(trade.get("Avg Exit Price", 0))
            size = safe_float(trade.get("Size", 0))
            entry_slippage = entry_price * size * (slippage_rate / 100)
            exit_slippage = exit_price * size * (slippage_rate / 100)
            total_slippage = entry_slippage + exit_slippage

            # 청산 시점이 마지막 봉이면 미실현 손익으로 표시
            exit_timestamp = trade.get("Exit Timestamp", None)
            is_open = (exit_timestamp == last_timestamp) if last_timestamp is not None else False

            # MFE/MAE 직접 계산 (런업/드로다운)
            runup = 0.0
            drawdown = 0.0
            if df_ohlcv is not None and entry_price > 0:
                entry_ts = trade.get("Entry Timestamp")
                exit_ts = trade.get("Exit Timestamp")

                if entry_ts is not None and exit_ts is not None:
                    # 진입~청산 구간의 OHLCV 슬라이싱 (청산 봉은 제외 - 시가에 청산하므로)
                    mask = (df_ohlcv.index >= entry_ts) & (df_ohlcv.index < exit_ts)
                    trade_ohlcv = df_ohlcv[mask]

                    if len(trade_ohlcv) > 0:
                        # MFE: 진입가 대비 최대 고가 수익률 (런업)
                        max_high = trade_ohlcv["high"].max()
                        runup = ((max_high - entry_price) / entry_price) * 100

                        # MAE: 진입가 대비 최대 저가 손실률 (드로다운)
                        min_low = trade_ohlcv["low"].min()
                        drawdown = ((min_low - entry_price) / entry_price) * 100

            trade_records.append(
                TradeRecord(
                    entryTime=str(trade.get("Entry Timestamp", "")),
                    exitTime=str(trade.get("Exit Timestamp", "")),
                    entryPrice=entry_price,
                    exitPrice=exit_price,
                    pnl=pnl,
                    pnlPercent=float(trade.get("Return", 0) * 100),
                    type="long",
                    fee=safe_float(total_fee),
                    slippage=safe_float(total_slippage),
                    entryFee=safe_float(entry_fees),
                    exitFee=safe_float(exit_fees),
                    entrySlippage=safe_float(entry_slippage),
                    exitSlippage=safe_float(exit_slippage),
                    size=size,
                    runup=safe_float(runup),
                    drawdown=safe_float(drawdown),
                    cumulativePnl=safe_float(cumulative_pnl),
                    isOpen=is_open,
                )
            )

        return trade_records

    def build_equity_curve(self, equity: pd.Series) -> list[dict]:
        """수익 곡선 데이터 생성

        Args:
            equity: 포트폴리오 가치 Series

        Returns:
            [{date, value}, ...] 리스트
        """
        # DataFrame 이 들어오면 items() 가 열을 순회해 곡선이 한 점으로 뭉개진다.
        # 호출부가 Series 를 넘기는 게 원칙이지만 여기서도 한 번 막는다
        if isinstance(equity, pd.DataFrame):
            equity = equity.iloc[:, 0]

        result = []
        for ts, val in equity.items():
            # 인덱스 타입에 따라 처리 (문자열이면 그대로, datetime이면 isoformat)
            if isinstance(ts, str):
                date_str = ts
            elif hasattr(ts, "isoformat"):
                date_str = ts.isoformat()
            else:
                date_str = str(ts)
            result.append({"date": date_str, "value": safe_float(val)})
        return result

    def extract_indicators(
        self,
        df: pd.DataFrame,
        conditions: list[SentenceCondition],
        valid_timestamps: set[int] | None = None,
    ) -> list[IndicatorData]:
        """조건에서 사용된 지표를 레지스트리 정의대로 계산해 차트용 데이터로 만든다

        조건 한 개가 지표 한두 개를 쓴다 (cross 는 둘). 같은 지표·같은 파라미터는 한 번만.
        출력 선은 스펙의 outputs 를 따라 role 별로 담는다. 옛 프론트가 읽는 필드
        (type/upperBand/signalLine/kLine ...) 도 같이 채워 하위 호환을 지킨다.

        Args:
            df: 전체 OHLCV DataFrame (warmup 포함)
            conditions: 매수/매도 조건 리스트
            valid_timestamps: 응답에 포함할 타임스탬프 집합 (None이면 전체)
        """
        all_timestamps = df.reset_index()["timestamp"].tolist()
        if valid_timestamps:
            idx_ts = [(i, ts) for i, ts in enumerate(all_timestamps) if ts in valid_timestamps]
        else:
            idx_ts = list(enumerate(all_timestamps))
        # 1) 조건에서 (스펙, 파라미터) 수집. 같은 것은 한 번만
        uses: dict[tuple, tuple] = {}  # key -> (spec, params)
        levels: dict[tuple, set[float]] = {}  # RSI 70/30 같은 보조선

        def add(spec, params, level: float | None = None):
            key = (spec.name, tuple(sorted(params.items())))
            uses.setdefault(key, (spec, params))
            if level is not None:
                levels.setdefault(key, set()).add(float(level))

        for c in conditions:
            t = c.templateType
            try:
                if t == "indicator_vs_value" and c.indicator:
                    spec = registry.get_spec(c.indicator)
                    add(spec, spec.resolve_params(c.params, c.indicatorPeriod), c.value)
                elif t == "indicator_cross":
                    s1 = registry.get_spec(c.indicator or "SMA")
                    add(s1, s1.resolve_params(c.params, c.indicatorPeriod or 5))
                    s2 = registry.get_spec(c.targetIndicator or "SMA")
                    add(s2, s2.resolve_params(c.targetParams, c.targetPeriod or 20))
                elif t == "price_cross":
                    spec = registry.get_spec(c.targetIndicator or c.indicator or "SMA")
                    add(
                        spec,
                        spec.resolve_params(
                            c.targetParams or c.params, c.targetPeriod or c.indicatorPeriod or 20
                        ),
                    )
                elif t == "macd_signal":
                    spec = registry.get_spec("MACD")
                    add(spec, spec.resolve_params(c.params))
                elif t == "stochastic":
                    spec = registry.get_spec("STOCH")
                    add(spec, spec.resolve_params(c.params, c.indicatorPeriod))
                elif t == "band_touch":
                    spec = registry.get_band_spec(c.bandType)
                    add(spec, spec.resolve_params(c.params, c.indicatorPeriod))
            except ValueError:
                # 모르는 지표는 strategy 단계에서 이미 에러가 났을 것이다. 차트는 건너뛴다
                continue

        # 2) 계산 → IndicatorData
        def points(series: pd.Series) -> list[IndicatorDataPoint]:
            vals = series.to_numpy()
            return [
                IndicatorDataPoint(timestamp=int(ts), value=float(vals[i]))
                for i, ts in idx_ts
                if not pd.isna(vals[i])
            ]

        result: list[IndicatorData] = []
        for key, (spec, params) in uses.items():
            outputs = registry.compute(df, spec, params)
            by_role: dict[str, list[IndicatorDataPoint]] = {}
            for o in spec.outputs:
                by_role[o.role] = points(outputs[o.key])
            primary = points(outputs[spec.primary_key])

            # 이름: RSI(14), SMA(20), MACD(12,26,9), Bollinger(20), Stochastic(14)
            period_txt = str(int(params["period"])) if "period" in params else ""
            if spec.name == "MACD":
                name = f"MACD({int(params['fast'])},{int(params['slow'])},{int(params['signal'])})"
            elif spec.name == "STOCH":
                name = f"Stochastic({period_txt})"
            elif spec.band_type:
                label = {"bollinger": "Bollinger", "keltner": "Keltner", "envelope": "Envelope"}[
                    spec.band_type
                ]
                name = f"{label}({period_txt})"
            else:
                name = f"{spec.name}({period_txt})"

            period = int(params.get("period", params.get("fast", 0)))
            lv = sorted(levels.get(key, set()))
            rsi_over = rsi_under = None
            if spec.name == "RSI" and lv:
                # 조건 값 중 50 이상은 과매수선, 미만은 과매도선으로 (옛 프론트 필드)
                over = [v for v in lv if v >= 50]
                under = [v for v in lv if v < 50]
                rsi_over = int(over[0]) if over else None
                rsi_under = int(under[0]) if under else None

            result.append(
                IndicatorData(
                    name=name,
                    type=spec.legacy_type or spec.name.lower(),
                    period=period,
                    data=[] if spec.name == "STOCH" else primary,
                    upperBand=by_role.get("band_upper"),
                    lowerBand=by_role.get("band_lower"),
                    signalLine=by_role.get("signal"),
                    histogram=by_role.get("histogram"),
                    kLine=by_role.get("k"),
                    dLine=by_role.get("d"),
                    rsiOverbought=rsi_over,
                    rsiOversold=rsi_under,
                    indicator=spec.name,
                    params=params,
                    display=spec.display,
                    valueRange=list(spec.value_range) if spec.value_range else None,
                    levels=lv or None,
                )
            )
        return result
