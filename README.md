# OMC

암호화폐 매매 규칙을 문장으로 적으면, 상장일부터의 데이터로 그대로 사고팔아
결과를 보여주는 백테스터입니다.

코드를 쓰지 않습니다. "RSI(14)가 30보다 작을 때 사고, 진입가 대비 5% 오르면
판다"를 화면에서 조립하면 끝입니다. 실행하면 수익률, 최대 낙폭, 거래 하나하나가
TradingView 차트 위에 표시되고, 같은 기간에 그냥 사서 들고 있었으면 어땠을지가
항상 옆에 같이 놓입니다.

## 무엇을 할 수 있나

**전략을 문장으로 조립합니다.** 조건 템플릿 10종을 AND/OR로 엮습니다.

| 템플릿 | 예 |
|---|---|
| 지표 vs 값 | RSI(14) < 30 |
| 지표 교차 | SMA(20)이 SMA(50)을 상향 돌파 |
| 가격 교차 | 종가가 EMA(20) 위로 |
| 익절 / 손절 | 진입가 대비 +5% / -3% |
| 밴드 터치 | 볼린저 하단 터치 |
| MACD 시그널 | 골든크로스 |
| 스토캐스틱 | %K가 %D를 돌파 |
| 캔들 패턴 | 망치형 출현 |
| 거래량 | 평균 대비 2배 |
| 가격 변동률 | 전일 대비 +3% |

**자연어로도 됩니다.** "RSI 과매도에서 사서 10% 먹으면 팔아줘"라고 쓰면 위
템플릿으로 변환해 줍니다. 결과 리포트도 AI가 써 줍니다. 둘 다 OpenAI를 쓰고,
키가 없으면 이 기능만 꺼집니다.

**현실적인 체결을 가정합니다.** 신호는 봉이 닫힌 뒤 판단하고 다음 봉 시가에
체결합니다. 수수료와 슬리피지를 떼고, 복리로 재투자하며, 코인별 최소 주문
단위(BTC는 0.00001, XRP는 1개)로 수량을 버림 처리합니다. 익절·손절도 같은
규칙이라 갭이 뜨면 +5% 조건에 +7%로 청산되기도 합니다. 그게 실제에 가깝습니다.

**결과는 1초 안팎에 나옵니다.** 수익률, 최대 낙폭(%와 금액), 샤프 비율, 승률,
손익비, 봉 단위 수익 곡선, 거래별 런업·드로다운. 그리고 **"그냥 샀다면"** — 같은
기간 첫 봉에 전액 사서 들고 있었을 때의 수익률이 총 수익률 바로 옆에 붙습니다.
상승장에서 +55%가 나와도 보유가 +279%였다면 그 전략은 시장을 이긴 게 아닙니다.
실행 중에는 언제든 중지할 수 있습니다.

**대상.** Binance USDT 마켓 8종(BTC, ETH, BNB, SOL, XRP, DOGE, ADA, AVAX),
타임프레임 6종(15분 ~ 월봉), 각 코인 상장일부터. 데이터는 매일 갱신됩니다.

## 한 가지는 분명히 해 둡니다

과거에 맞았다는 사실이 앞으로도 맞는다는 뜻은 아닙니다. 기준값을 조금씩 바꿔
과거 수익률만 끌어올린 전략은 대개 다음 달에 무너지고, 상승장만 담긴 기간에서는
거의 모든 전략이 좋아 보입니다. OMC는 "이 규칙이 과거에 어땠나"를 있는 그대로
보여주는 도구이지 투자 조언이 아닙니다.

## 시작하기

Docker만 있으면 됩니다.

```bash
git clone https://github.com/now-eat-krap/OMC.git && cd OMC
cp .env.example .env.dev
# .env.dev 에서 REDIS_PASSWORD 를 채웁니다 (비어 있으면 redis 가 기동하지 못합니다)
# AI 기능을 쓰려면 OPENAI_API_KEY 도 넣습니다

docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up -d --build
```

`http://localhost` 로 들어가면 됩니다. 워커가 처음 뜰 때 Numba 컴파일에 1분쯤
걸리는데, 그동안 백테스트를 누르면 큐에서 기다렸다가 실행됩니다.

## 어떻게 생겼나

```
브라우저 ── nginx ── FastAPI (API)
                        │  큐에 넣기만 한다
                        ▼
                      Redis ── rq-worker  (vectorbt + Numba, 계산은 전부 여기)
                        ▲
                   rq-cron  (항상 1개. 캔들 캐시 일일 갱신)
```

API 프로세스는 백테스트를 직접 돌리지 않습니다. 요청을 큐에 넣고 상태만 돌려주므로
7초면 뜨고 200MB 안쪽입니다. 계산은 워커가 하고, 워커는 기동할 때 Numba를 미리
컴파일해 두었다가 작업마다 fork하므로 요청당 컴파일 비용이 없습니다.

| | |
|---|---|
| 프론트 | React 19 · TypeScript · Vite 7 · Tailwind CSS v4 · lightweight-charts · TradingView 위젯 |
| 백엔드 | FastAPI · vectorbt · Numba · pandas |
| 큐·캐시 | Redis · RQ (워커 + 크론) |
| 데이터 | Binance (ccxt) |
| 운영 | Docker Compose · GitHub Actions → GHCR → SSH 배포 · Prometheus · Grafana · Sentry |

## 저장소

```
frontend/   React SPA                       → frontend/README.md
backend/    FastAPI + RQ 워커 + 크론         → backend/README.md
docs/       API 명세, 백엔드 구조, 모니터링, 개발 환경
CLAUDE.md   작업 규칙 (워크트리 → develop PR → main 배포)
```

`main`은 배포 브랜치입니다. 푸시되면 CI가 이미지를 빌드해 GHCR에 올리고 서버가
받아 재시작합니다. 모든 작업은 워크트리에서 하고 `develop`으로 PR을 엽니다.
자세한 건 [`CLAUDE.md`](CLAUDE.md)에 있습니다.

더 읽을 것:
[API 명세](docs/backend/API_SPEC.md) ·
[백엔드 구조](docs/backend/BACKEND_SPEC.md) ·
[모니터링](docs/MONITORING.md) ·
[개발 환경](docs/DEVELOPMENT_SETUP.md)
