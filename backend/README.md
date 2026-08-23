# OMC 백엔드 (FastAPI + RQ)

백테스트 API와 계산 워커입니다. **API 혼자서는 백테스트가 돌지 않습니다.** 요청을
받아 Redis 큐에 넣기만 하고, 실제 계산은 별도 워커 프로세스가 합니다.

```
API (uvicorn)  ──enqueue──▶  Redis  ──▶  rq-worker (vectorbt + Numba)
                               ▲
rq-cron (항상 1개) ── 캔들 캐시 일일 갱신/초기 적재 ──┘
```

전체 구조는 [`docs/backend/BACKEND_SPEC.md`](../docs/backend/BACKEND_SPEC.md),
엔드포인트는 [`docs/backend/API_SPEC.md`](../docs/backend/API_SPEC.md)에 있습니다.

## 실행

권장은 저장소 루트에서 compose로 전부 띄우는 것입니다. Redis·워커·크론이 같이 뜹니다.

```bash
# 저장소 루트에서. .env.dev 에 실제 값(REDIS_PASSWORD 등)이 있어야 합니다
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up -d --build
```

프로세스를 따로 띄워야 한다면 세 개가 필요합니다. Redis가 먼저 떠 있어야 합니다.

```bash
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000   # API
python -m app.worker                          # 워커 (Numba 워밍업 후 기동, 약 1분)
python -m app.cron                            # 크론 (반드시 1개)
```

워커는 `rq worker` CLI가 아니라 **`python -m app.worker`**로 띄웁니다. CLI로 띄우면
Numba JIT 워밍업이 fork 이전에 일어나지 않아 요청마다 약 20초를 다시 컴파일합니다.
크론은 리더 선출이 없어 2개를 띄우면 작업이 두 번 들어갑니다.

## 검증

```bash
# 로컬에 파이썬이 없어도 됩니다
docker run --rm -v "$PWD:/app" -w /app python:3.11-alpine \
  sh -c "pip install -q ruff && python -m compileall -q app && ruff check app && ruff format --check app"

# 테스트 (의존성이 무거워 실제 이미지에서 돌리는 게 빠릅니다)
pip install -r requirements-dev.txt && pytest -q
```

## API 문서

서버 실행 후 `http://localhost:8000/docs` (Swagger UI)
