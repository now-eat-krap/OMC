# 백엔드 API 명세서

> **Base URL**: `/api`  
> **인증**: 현재 미구현 (추후 JWT 추가 예정)

---

## 📋 목차

1. [Backtest API](#backtest-api)
2. [Assets API](#assets-api)
3. [AI API](#ai-api)
4. [Health Check](#health-check)

---

## Backtest API

백테스트 실행·상태 조회·취소. RQ(Redis Queue) 비동기 작업 큐 기반. 계산은 별도 워커 프로세스가 하고 API는 큐에 넣고 상태만 돌려줍니다.

### POST `/api/backtest`

백테스트 작업 제출

#### Request Body

```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1d",
  "startDate": "2024-01-01",
  "endDate": "2024-06-30",
  "initialCapital": 10000,
  "feeRate": 0.1,
  "slippage": 0.05,
  "positionSize": 100,
  "buyConditions": [
    {
      "id": "buy_1",
      "templateType": "indicator_vs_value",
      "indicator": "RSI",
      "indicatorPeriod": 14,
      "comparison": "lt",
      "value": 30
    }
  ],
  "sellConditions": [
    {
      "id": "sell_1",
      "templateType": "indicator_vs_value",
      "indicator": "RSI",
      "indicatorPeriod": 14,
      "comparison": "gt",
      "value": 70
    }
  ]
}
```

조건(`SentenceCondition`)의 지표 파라미터는 `params`로 넘깁니다. 키는 `GET /api/indicators`의
`params[].name`입니다. `indicatorPeriod`/`targetPeriod`는 옛 필드로 계속 받으며, `params`가 없을 때
첫 번째 파라미터(기간)로 해석됩니다. 교차 템플릿의 상대 지표는 `targetParams`입니다.

```json
{ "templateType": "macd_signal", "params": { "fast": 8, "slow": 21, "signal": 5 }, "crossDirection": "above" }
{ "templateType": "band_touch", "bandType": "bollinger", "params": { "period": 20, "std": 2.5 }, "bandPosition": "lower", "touchType": "exit" }
```

#### Response

```json
{
  "task_id": "abc123-def456",
  "status": "pending"
}
```

---

### GET `/api/backtest/status/{task_id}`

백테스트 작업 상태 조회

#### Parameters

| 이름      | 타입   | 설명    |
| --------- | ------ | ------- |
| `task_id` | string | 작업 ID |

#### Response

```json
{
  "task_id": "abc123-def456",
  "status": "completed",
  "message": "백테스트 완료",
  "progress": 100,
  "result": {
    "totalReturn": 15.5,
    "totalReturnUsdt": 155000.0,
    "winRate": 60.0,
    "maxDrawdown": -8.2,
    "maxDrawdownUsdt": 82000.0,
    "sharpeRatio": 1.2,
    "profitFactor": 1.8,
    "totalTrades": 10,
    "profitTrades": 6,
    "lossTrades": 4,
    "equityCurve": [{ "date": "2024-01-01T00:00:00", "value": 1000000.0 }, ...],
    "trades": [...],
    "ohlcv": [...],
    "indicators": [...]
  }
}
```

실행 중에는 `message`와 `progress`(0~100)로 진행 상황을 알립니다. `equityCurve`는 봉마다의
포트폴리오 가치로, 첫 점이 초기 자본입니다.

#### Status Values

| 상태        | 설명                                                            |
| ----------- | --------------------------------------------------------------- |
| `pending`   | 큐에서 대기 중                                                  |
| `running`   | 워커가 실행 중 (`message`, `progress` 포함)                     |
| `completed` | 완료 (`result` 포함)                                            |
| `failed`    | 실패 (`error` 포함)                                             |
| `cancelled` | 취소됨. 대기 중에 빠졌거나 실행 중에 중지됨 (DELETE 참고)       |

`totalTrades`는 청산된 거래 수입니다. 기간 끝에 열린 포지션은 `trades`에 `isOpen: true`로
포함되고 수익률에는 반영되지만 `totalTrades`에는 세지 않습니다.

---

### DELETE `/api/backtest/{task_id}`

백테스트 작업 취소. 대기 중이면 큐에서 빼고, **실행 중이면 워커의 작업 프로세스를 종료**합니다.

#### Response

작업 상태에 따라 다릅니다.

| 작업 상태                | HTTP | 응답 `status` | 동작                                                   |
| ------------------------ | ---- | ------------- | ------------------------------------------------------ |
| 실행 중 (`running`)      | 200  | `cancelling`  | 워커에 중지 명령 전송. 잠시 뒤 상태 조회가 `cancelled` |
| 대기 중 (`pending`)      | 200  | `cancelled`   | 큐에서 제거                                            |
| 이미 취소됨              | 200  | `cancelled`   | 없음                                                   |
| 완료/실패 (`completed`, `failed`) | 409  | —      | 이미 끝난 작업은 취소할 수 없음                        |
| 없는 작업                | 404  | —             |                                                        |

```json
{
  "task_id": "abc123-def456",
  "status": "cancelling"
}
```

실행 중 취소는 비동기입니다. 워커가 명령을 받아 프로세스를 종료하고 상태를 바꾸기까지
약간 걸리므로, 클라이언트는 상태 조회에서 `cancelled`를 받을 때까지 폴링하거나 그냥
빠져나가면 됩니다. 프론트는 후자입니다.

---

## Indicators API

### GET `/api/indicators`

지표 레지스트리 전체. 프론트는 지표 선택지·파라미터 슬롯·차트 힌트를 하드코딩하지 않고
여기서 받습니다.

```json
{
  "indicators": [
    {
      "name": "MACD",
      "label": "MACD",
      "description": "이동평균 수렴·확산. MACD 선, 시그널 선, 히스토그램",
      "display": "pane",
      "valueRange": null,
      "templates": ["indicator_vs_value", "macd_signal"],
      "bandType": null,
      "params": [
        { "name": "fast", "label": "단기", "default": 12, "min": 1, "max": 200, "step": 1, "integer": true },
        { "name": "slow", "label": "장기", "default": 26, "min": 2, "max": 500, "step": 1, "integer": true },
        { "name": "signal", "label": "시그널", "default": 9, "min": 1, "max": 200, "step": 1, "integer": true }
      ],
      "outputs": [
        { "key": "macd", "label": "MACD", "role": "line" },
        { "key": "signal", "label": "시그널", "role": "signal" },
        { "key": "histogram", "label": "히스토그램", "role": "histogram" }
      ]
    }
  ]
}
```

| 필드 | 뜻 |
| --- | --- |
| `display` | `overlay`(가격 차트 위) / `pane`(별도 패널) |
| `valueRange` | 고정 범위 (RSI `[0,100]`). 없으면 null |
| `templates` | 이 지표를 고를 수 있는 `templateType` |
| `bandType` | `band_touch`의 `bandType` 값 (볼린저/켈트너/엔벨로프) |
| `params` | 파라미터 목록. UI는 이 개수만큼 숫자 슬롯을 그립니다 |
| `outputs` | 출력 선. `role`로 그리는 방식이 정해집니다 |

---

### POST `/api/indicators/validate-expression`

커스텀 식 검증. 파싱 + 화이트리스트 검사 + 더미 데이터로 실제 평가까지 합니다.

```json
{ "expression": "ta.rsi(close, 14) < 30 and close > ta.sma(close, 50)" }
```

```json
{ "ok": true, "kind": "boolean", "warmup": 50 }
{ "ok": false, "error": "ta.sma 인자 수가 틀렸습니다 (2~2개)" }
```

조건으로 쓰려면 `kind`가 `boolean`이어야 합니다(비교·논리로 끝나는 식). `numeric`은
지표 값 식입니다. `warmup`은 식이 안정되는 데 필요한 앞 구간 봉 수입니다.

식은 **Pine 문법의 부분집합**입니다. 코드로 실행되지 않고 허용된 요소만 평가됩니다.

- 시리즈: `open` `high` `low` `close` `volume` `hl2` `hlc3` `ohlc4`
- `ta.*`: `sma` `ema` `wma` `rsi` `atr` `stdev` `highest` `lowest` `change` `crossover` `crossunder` `vwap` (시그니처는 Pine과 동일, 기간은 정수 리터럴)
- `math.*`: `abs` `max` `min` `log` `sqrt`
- 산술 `+ - * / % **`, 비교, `and` `or` `not`, 괄호, `[n]` 과거 참조 (`close[1]`)
- 안 되는 것: `var` 상태 변수, 루프, `?:` 삼항, `request.security`, `plot`

조건에서는 `templateType: "expression"`으로 씁니다.

```json
{ "templateType": "expression", "expression": "ta.crossover(ta.wma(close,10), ta.sma(close,30))" }
```

다른 조건과 AND/OR로 섞을 수 있고, 매수·매도 어느 쪽에도 됩니다.

백테스트 결과의 `indicators`에는 식의 숫자 부분식들이 `type: "expression"`으로
실립니다. 비교 피연산자와 `crossover`/`crossunder` 인자를 각각 한 선으로 그리고,
상수와 비교했다면 그 값이 `levels`(수평 보조선)로 들어갑니다. `display`는 부분식이
가격 스케일이면(`close` 파생 이동평균, `vwap`, 가격±오프셋) `overlay`, 아니면
`pane`입니다. `close` 같은 원시 시리즈는 캔들이 이미 보여주므로 싣지 않습니다.

```json
{ "name": "ta.rsi(close, 14)", "type": "expression", "display": "pane", "levels": [30.0, 70.0] }
```

---

## Assets API

코인 목록 및 OHLCV 데이터 조회

### GET `/api/assets`

사용 가능한 코인 목록 조회

#### Response

```json
{
  "assets": [
    {
      "symbol": "BTC/USDT",
      "base": "BTC",
      "quote": "USDT",
      "start_date": "2017-08-17",
      "amountPrecision": 5,
      "pricePrecision": 2
    }
  ]
}
```

---

### GET `/api/ohlcv/{symbol}`

OHLCV 캔들 데이터 조회

#### Parameters

| 이름         | 타입   | 필수 | 기본값 | 설명                  |
| ------------ | ------ | ---- | ------ | --------------------- |
| `symbol`     | string | ✅   | -      | 거래쌍 (예: BTC-USDT) |
| `timeframe`  | string | -    | 1d     | 타임프레임            |
| `limit`      | int    | -    | 500    | 캔들 개수 (1-1000)    |
| `start_date` | string | -    | null   | 시작일 (YYYY-MM-DD)   |
| `end_date`   | string | -    | null   | 종료일 (YYYY-MM-DD)   |

#### Response

```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1d",
  "data": [
    {
      "timestamp": 1704067200000,
      "open": 42000.0,
      "high": 43500.0,
      "low": 41500.0,
      "close": 43000.0,
      "volume": 1234567.89
    }
  ]
}
```

---

## AI API

AI 기반 전략 변환 및 리포트 생성

> ⚠️ **Rate Limit** 적용

### POST `/api/ai/parse-strategy`

자연어 전략을 매수/매도 조건으로 변환

**Rate Limit**: 분당 5회, 시간당 30회 (IP 기준)

#### Request Body

```json
{
  "prompt": "RSI가 30 아래일 때 매수하고, 70 위일 때 매도"
}
```

#### Response

```json
{
  "buyConditions": [
    {
      "id": "buy_1",
      "templateType": "indicator_vs_value",
      "indicator": "RSI",
      "indicatorPeriod": 14,
      "comparison": "lt",
      "value": 30
    }
  ],
  "sellConditions": [...]
}
```

구조화 템플릿(1~7)으로 표현할 수 없는 전략은 `templateType: "expression"`으로 커스텀 식이
나옵니다 (예: "종가가 20일 VWAP보다 높으면" → `"expression": "close > ta.vwap(20)"`).
AI가 만든 식은 서버가 식 엔진으로 검증하고, 틀리면 오류를 알려주며 한 번 다시 시킵니다.
그래도 틀리면 400 (`AI가 만든 식이 올바르지 않습니다: ...`)으로 응답합니다.

---

### POST `/api/ai/generate-report`

백테스트 결과를 분석하여 AI 리포트 생성

**Rate Limit**: 분당 3회, 시간당 15회 (IP 기준)

#### Request Body

```json
{
  "totalReturn": 15.5,
  "winRate": 60.0,
  "maxDrawdown": -8.2,
  "totalTrades": 10,
  "profitTrades": 6,
  "lossTrades": 4,
  "sharpeRatio": 1.2,
  "profitFactor": 1.8,
  "buyConditions": [...],
  "sellConditions": [...]
}
```

#### Response

```json
{
  "overallScore": 75,
  "grade": "B+",
  "radarMetrics": {
    "profitability": 80,
    "winRate": 60,
    "riskManagement": 70,
    "stability": 75,
    "profitFactor": 72
  },
  "strengths": ["높은 수익률", "안정적인 드로다운"],
  "weaknesses": ["낮은 거래 빈도"],
  "suggestions": ["손절 조건 추가 고려"],
  "summary": "전체적으로 양호한 전략입니다..."
}
```

---

### GET `/api/ai/health`

AI 서비스 상태 확인

#### Response

```json
{
  "status": "ok",
  "api_key_configured": true
}
```

---

## Health Check

### GET `/health` or `/api/health`

서버 및 Redis 상태 확인

#### Response

```json
{
  "status": "ok",
  "message": "OMC 백테스팅 API 서버 정상 작동 중",
  "services": {
    "redis": "ok"
  },
  "version": "1.0.0"
}
```

---

## 공통 에러 응답

```json
{
  "detail": "에러 메시지"
}
```

| HTTP 코드 | 설명            |
| --------- | --------------- |
| 400       | 잘못된 요청     |
| 429       | Rate Limit 초과 |
| 500       | 서버 내부 오류  |
