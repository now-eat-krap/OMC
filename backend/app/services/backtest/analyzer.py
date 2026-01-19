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
from app.services import indicators
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
        """조건에서 사용된 지표 데이터 추출

        Args:
            df: 전체 OHLCV DataFrame (warmup 포함)
            conditions: 매수/매도 조건 리스트
            valid_timestamps: 응답에 포함할 타임스탬프 집합 (None이면 전체)

        Returns:
            IndicatorData 리스트
        """
        indicator_list = []
        seen = set()  # 중복 방지

        # 타임스탬프 배열 생성
        all_timestamps = df.reset_index()["timestamp"].tolist()

        # 유효한 타임스탬프만 필터링
        if valid_timestamps:
            timestamps = [ts for ts in all_timestamps if ts in valid_timestamps]
            valid_indices = [i for i, ts in enumerate(all_timestamps) if ts in valid_timestamps]
        else:
            timestamps = all_timestamps
            valid_indices = list(range(len(all_timestamps)))

        for condition in conditions:
            # 1. indicator_vs_value, indicator_cross 템플릿
            if condition.indicator and condition.indicatorPeriod:
                key = f"{condition.indicator}_{condition.indicatorPeriod}"
                if key not in seen:
                    seen.add(key)

                    # RSI의 경우 과매수/과매도 값 추출
                    rsi_overbought = None
                    rsi_oversold = None
                    if condition.indicator == "RSI":
                        # 동일한 RSI 지표를 사용하는 모든 조건에서 값 수집
                        for c in conditions:
                            if (
                                c.indicator == "RSI"
                                and c.indicatorPeriod == condition.indicatorPeriod
                                and c.value is not None
                            ):
                                # 비교 연산자로 과매수/과매도 구분
                                if c.comparison in ["gt", "gte"]:
                                    # RSI가 X보다 크면 → 과매수 레벨
                                    rsi_overbought = int(c.value)
                                elif c.comparison in ["lt", "lte"]:
                                    # RSI가 X보다 작으면 → 과매도 레벨
                                    rsi_oversold = int(c.value)

                    ind_data = self._get_indicator_data(
                        df,
                        condition.indicator,
                        condition.indicatorPeriod,
                        timestamps,
                        valid_indices,
                        rsi_overbought=rsi_overbought,
                        rsi_oversold=rsi_oversold,
                    )
                    if ind_data:
                        indicator_list.append(ind_data)

            # 2. targetIndicator (크로스용)
            if condition.targetIndicator and condition.targetPeriod:
                key = f"{condition.targetIndicator}_{condition.targetPeriod}"
                if key not in seen:
                    seen.add(key)
                    ind_data = self._get_indicator_data(
                        df,
                        condition.targetIndicator,
                        condition.targetPeriod,
                        timestamps,
                        valid_indices,
                    )
                    if ind_data:
                        indicator_list.append(ind_data)

            # 3. MACD 시그널 템플릿
            if condition.templateType == "macd_signal":
                key = "MACD_12_26_9"
                if key not in seen:
                    seen.add(key)
                    macd, signal, histogram = indicators.macd(df["close"])
                    macd_vals = [macd.values[i] for i in valid_indices]
                    signal_vals = [signal.values[i] for i in valid_indices]
                    hist_vals = [histogram.values[i] for i in valid_indices]
                    indicator_list.append(
                        IndicatorData(
                            name="MACD",
                            type="macd",
                            period=12,
                            data=[
                                IndicatorDataPoint(timestamp=int(ts), value=float(v))
                                for ts, v in zip(timestamps, macd_vals)
                                if not pd.isna(v)
                            ],
                            signalLine=[
                                IndicatorDataPoint(timestamp=int(ts), value=float(v))
                                for ts, v in zip(timestamps, signal_vals)
                                if not pd.isna(v)
                            ],
                            histogram=[
                                IndicatorDataPoint(timestamp=int(ts), value=float(v))
                                for ts, v in zip(timestamps, hist_vals)
                                if not pd.isna(v)
                            ],
                        )
                    )

            # 4. 스토캐스틱 템플릿
            if condition.templateType == "stochastic":
                period = condition.indicatorPeriod or 14
                key = f"STOCH_{period}"
                if key not in seen:
                    seen.add(key)
                    k, d = indicators.stochastic(df["high"], df["low"], df["close"], period)
                    k_vals = [k.values[i] for i in valid_indices]
                    d_vals = [d.values[i] for i in valid_indices]
                    indicator_list.append(
                        IndicatorData(
                            name=f"Stochastic({period})",
                            type="stoch",
                            period=period,
                            data=[],
                            kLine=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, k_vals)
                            ],
                            dLine=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, d_vals)
                            ],
                        )
                    )

            # 5. 볼린저밴드 템플릿
            if condition.templateType == "band_touch" and condition.bandType == "bollinger":
                period = condition.indicatorPeriod or 20
                key = f"BB_{period}"
                if key not in seen:
                    seen.add(key)
                    upper, middle, lower = indicators.bollinger_bands(df["close"], period)
                    upper_vals = [upper.values[i] for i in valid_indices]
                    middle_vals = [middle.values[i] for i in valid_indices]
                    lower_vals = [lower.values[i] for i in valid_indices]
                    indicator_list.append(
                        IndicatorData(
                            name=f"Bollinger({period})",
                            type="bb",
                            period=period,
                            data=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, middle_vals)
                            ],
                            upperBand=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, upper_vals)
                            ],
                            lowerBand=[
                                IndicatorDataPoint(
                                    timestamp=int(ts), value=float(v) if not pd.isna(v) else 0
                                )
                                for ts, v in zip(timestamps, lower_vals)
                            ],
                        )
                    )

        return indicator_list

    def _get_indicator_data(
        self,
        df: pd.DataFrame,
        indicator: str,
        period: int,
        timestamps: list[int],
        valid_indices: list[int],
        rsi_overbought: int | None = None,
        rsi_oversold: int | None = None,
    ) -> IndicatorData | None:
        """단일 지표 데이터 생성

        Args:
            df: OHLCV DataFrame
            indicator: 지표 이름
            period: 기간
            timestamps: 타임스탬프 리스트
            valid_indices: 유효한 인덱스 리스트
            rsi_overbought: RSI 과매수선 (예: 70, 80)
            rsi_oversold: RSI 과매도선 (예: 30, 20)

        Returns:
            IndicatorData 또는 None
        """
        close = df["close"]
        _high = df["high"]  # 향후 지표 확장용으로 유지
        _low = df["low"]  # 향후 지표 확장용으로 유지

        # 지표 계산
        if indicator == "RSI":
            values = indicators.rsi(close, period)
            ind_type = "rsi"
        elif indicator in ["SMA", "MA"]:
            values = indicators.sma(close, period)
            ind_type = "sma"
        elif indicator == "EMA":
            values = indicators.ema(close, period)
            ind_type = "ema"
        else:
            return None

        # valid_indices로 필터링
        filtered_values = [values.values[i] for i in valid_indices]

        return IndicatorData(
            name=f"{indicator}({period})",
            type=ind_type,
            period=period,
            data=[
                IndicatorDataPoint(timestamp=int(ts), value=float(v))
                for ts, v in zip(timestamps, filtered_values)
                if not pd.isna(v)
            ],
            # RSI 전용 필드 (과매수/과매도 레벨)
            rsiOverbought=rsi_overbought if ind_type == "rsi" else None,
            rsiOversold=rsi_oversold if ind_type == "rsi" else None,
        )
