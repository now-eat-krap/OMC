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

백테스트 실행 및 상태 조회. Celery 비동기 작업 큐 기반.

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
  "result": {
    "totalReturn": 15.5,
    "winRate": 60.0,
    "maxDrawdown": -8.2,
    "totalTrades": 10,
    "trades": [...],
    "ohlcv": [...],
    "indicators": [...]
  }
}
```

#### Status Values

| 상태        | 설명    |
| ----------- | ------- |
| `pending`   | 대기 중 |
| `running`   | 실행 중 |
| `completed` | 완료    |
| `failed`    | 실패    |

---

### DELETE `/api/backtest/{task_id}`

백테스트 작업 취소

#### Response

```json
{
  "task_id": "abc123-def456",
  "status": "cancelled"
}
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
