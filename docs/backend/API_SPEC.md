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
