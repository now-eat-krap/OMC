# 모니터링 가이드

OMC 백테스팅 서비스의 모니터링 및 관측 가능성(Observability) 설정 가이드입니다.

## 목차

- [아키텍처 개요](#아키텍처-개요)
- [모니터링 스택](#모니터링-스택)
- [설정 방법](#설정-방법)
- [대시보드 사용법](#대시보드-사용법)
- [알림 설정](#알림-설정)
- [문제 해결](#문제-해결)

---

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                         프로덕션 환경                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Frontend │  │ Backend  │  │    RQ    │  │  Redis   │         │
│  │ (Nginx)  │  │ (FastAPI)│  │ (Worker) │  │ (Cache)  │         │
│  └──────────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│                     │             │             │               │
│         ┌───────────┴─────────────┴─────────────┴────────┐      │
│         │                    메트릭                       │      │
│         └───────────┬─────────────┬─────────────┬────────┘      │
│                     ▼             ▼             ▼               │
│              ┌────────────────────────────────────────┐         │
│              │              Prometheus                │         │
│              │            (메트릭 수집)                │         │
│              └──────────────────┬─────────────────────┘         │
│                                 │                               │
│                                 ▼                               │
│              ┌────────────────────────────────────────┐         │
│              │               Grafana                  │         │
│              │            (대시보드)                   │         │
│              └────────────────────────────────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   cAdvisor   │  │Redis Exporter│  │ Uptime Kuma  │           │
│  │ (컨테이너)    │  │   (Redis)    │  │   (알림)      │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                    Sentry (클라우드)                    │     │
│  │                 (에러 추적 & 성능 모니터링)               │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 모니터링 스택

### 1. Prometheus

시계열 데이터베이스 기반의 오픈소스 모니터링 시스템입니다.

- **역할**: 메트릭 수집, 저장, 쿼리
- **포트**: 9090
- **작동 방식**:
  - **Pull 방식**: 설정된 간격(15초)마다 각 타겟의 `/metrics` 엔드포인트를 스크래핑
  - **시계열 DB**: 수집된 메트릭을 로컬에 시계열 형태로 저장 (30일 보관)
  - **PromQL**: 강력한 쿼리 언어로 메트릭 조회 및 집계
- **수집 대상**:
  - FastAPI 백엔드 (`/metrics`) - 요청 수, 응답 시간, 에러율
  - Redis Exporter - Redis 메모리, 연결, 캐시 적중률
  - cAdvisor - 컨테이너 CPU, 메모리, 네트워크
  - Prometheus 자체 - 스크래핑 상태, 저장소 크기
- **웹 UI**: http://localhost:9090 에서 쿼리 실행 및 타겟 상태 확인

### 2. Grafana

Prometheus 등 다양한 데이터소스의 메트릭을 시각화하는 대시보드 플랫폼입니다.

- **역할**: 대시보드 시각화, 알림 관리
- **포트**: 3000
- **기본 계정**: `.env`에서 설정 (기본값: admin / admin123)
- **주요 기능**:
  - **대시보드**: 그래프, 게이지, 테이블 등 다양한 시각화 패널
  - **알림**: 조건 기반 알림 규칙 설정 및 다양한 채널로 발송
  - **프로비저닝**: YAML 파일로 데이터소스/대시보드 자동 설정
  - **사용자 관리**: 팀별 권한 및 대시보드 접근 제어
- **포함 대시보드**:
  - **FastAPI 대시보드**: 요청 수, 응답 시간(P50/P95), 에러율, 서버 상태
  - **Redis 대시보드**: 메모리 사용량, 연결 수, 캐시 적중률, 명령어 처리량

### 3. cAdvisor (Container Advisor)

Google이 개발한 컨테이너 리소스 사용량 분석 도구입니다.

- **역할**: Docker 컨테이너별 리소스 모니터링
- **포트**: 8080 (내부 전용, 외부 노출 안함)
- **작동 방식**:
  - Docker 소켓에 연결하여 실행 중인 컨테이너 감지
  - 각 컨테이너의 cgroups에서 실시간 리소스 사용량 수집
  - Prometheus 형식으로 메트릭 노출 (`/metrics`)
- **수집 메트릭**:
  - **CPU**: 사용률, 스로틀링, 코어별 사용량
  - **메모리**: 사용량, 캐시, RSS, 스왑
  - **네트워크**: 수신/송신 바이트, 패킷, 에러
  - **디스크 I/O**: 읽기/쓰기 바이트, 작업 수

### 4. Redis Exporter

Redis 서버의 메트릭을 Prometheus 형식으로 변환하는 익스포터입니다.

- **역할**: Redis 메트릭 수집 및 Prometheus 형식 변환
- **포트**: 9121 (내부 전용, 외부 노출 안함)
- **작동 방식**:
  - Redis `INFO` 명령어로 서버 상태 조회
  - Prometheus 형식의 메트릭으로 변환하여 `/metrics`에 노출
- **주요 메트릭**:
  - **메모리**: `used_memory`, `maxmemory`, 메모리 단편화율
  - **연결**: 연결된 클라이언트 수, 차단된 클라이언트
  - **성능**: 초당 명령어 처리량 (`instantaneous_ops_per_sec`)
  - **캐시**: 키 적중/미스 수, 적중률 (`keyspace_hits / (hits + misses)`)
  - **복제**: 마스터/슬레이브 상태, 복제 지연

### 5. Uptime Kuma

셀프호스팅 가능한 서비스 상태 모니터링 도구입니다.

- **역할**: 서비스 가용성 모니터링 및 장애 알림
- **포트**: 3001
- **주요 기능**:
  - **헬스체크**: HTTP, TCP, Ping, DNS, Docker 컨테이너 상태 체크
  - **상태 페이지**: 공개/비공개 상태 페이지 생성
  - **알림**: Discord, Telegram, Slack, Email 등 90+ 채널 지원
  - **인증서 모니터링**: SSL 인증서 만료일 추적
- **모니터링 대상 예시**:
  - Backend Health: `http://backend:8000/health`
  - Frontend: `http://frontend:80`
  - Redis: `redis:6379` (TCP)
- **특징**: 환경변수로 초기 설정 불가, 첫 접속 시 웹 UI에서 계정 생성 필요

### 6. Sentry (클라우드)

애플리케이션 에러 추적 및 성능 모니터링 SaaS 플랫폼입니다.

- **역할**: 런타임 에러 추적, 성능 모니터링, 릴리즈 추적
- **통합**: FastAPI 백엔드 + RQ 워커 + RQ 크론 (`app/core/sentry.py`에서 공통 초기화, `component` 태그로 구분)
- **URL**: [sentry.io](https://sentry.io)
- **주요 기능**:
  - **에러 추적**: 예외 발생 시 스택 트레이스, 요청 정보, 사용자 컨텍스트 자동 수집
  - **성능 모니터링**: 트랜잭션 추적, 느린 쿼리/API 감지
  - **알림**: 새로운 에러, 에러 급증 시 알림
  - **릴리즈 추적**: 배포별 에러 발생률 비교
- **설정**: `.env`에 `SENTRY_DSN` 추가 (미설정 시 비활성화)

---

## 설정 방법

### 1. 프로덕션 환경 실행

```bash
# 프로덕션 환경 시작 (모니터링 포함)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 서비스 상태 확인
docker compose ps
```

### 2. 환경변수 설정

`.env` 파일에 다음 값들을 설정하세요:

```bash
# Sentry DSN (sentry.io에서 발급)
SENTRY_DSN=https://xxxxx@xxx.ingest.sentry.io/xxxxx

# Grafana 관리자 비밀번호 (반드시 변경!)
GF_SECURITY_ADMIN_PASSWORD=your_secure_password
```

### 3. Sentry 설정

1. [sentry.io](https://sentry.io) 가입
2. 새 프로젝트 생성 (Python - FastAPI)
3. DSN 복사
4. `.env`에 `SENTRY_DSN` 추가
5. 컨테이너 재시작

### 4. Uptime Kuma 초기 설정

1. http://localhost:3001 접속
2. 관리자 계정 생성
3. 모니터 추가:
   - Backend Health: `http://backend:8000/health`
   - Frontend: `http://frontend:80`
   - Redis: `redis:6379` (TCP)

---

## 대시보드 사용법

### Grafana 접속

1. http://localhost:3000 접속
2. 로그인: `admin` / `admin123` (또는 변경한 비밀번호)
3. Dashboards → Browse에서 대시보드 선택

### FastAPI 대시보드 주요 패널

| 패널                 | 설명          |
| -------------------- | ------------- |
| 요청 수 (초당)       | API 트래픽    |
| 응답 시간 (P50, P95) | 성능 지표     |
| 에러율               | 5xx 에러 비율 |
| 24시간 총 요청 수    | 일일 트래픽   |
| 서버 상태            | UP/DOWN       |

### Redis 대시보드 주요 패널

| 패널              | 설명                  |
| ----------------- | --------------------- |
| 메모리 사용량     | 현재 사용 중인 메모리 |
| 연결된 클라이언트 | 활성 연결 수          |
| 키 개수           | 저장된 키 수          |
| 캐시 적중률       | 캐시 효율성           |
| 명령어 처리량     | 초당 명령어 수        |

---

## 알림 설정

### Grafana 알림

1. Alerting → Alert rules
2. 새 알림 규칙 생성
3. 조건 설정 (예: 에러율 > 5%)
4. Contact points에서 알림 채널 설정

### Uptime Kuma 알림

1. Settings → Notifications
2. 알림 채널 추가:
   - **Discord**: Webhook URL
   - **Telegram**: Bot Token + Chat ID
   - **Slack**: Webhook URL
   - **Email**: SMTP 설정

### 추천 알림 규칙

| 조건                 | 심각도   | 설명             |
| -------------------- | -------- | ---------------- |
| Backend DOWN         | Critical | 서비스 불가      |
| Redis DOWN           | Critical | 캐시 불가        |
| 에러율 > 5%          | Warning  | 문제 가능성      |
| P95 응답시간 > 3s    | Warning  | 성능 저하        |
| Redis 메모리 > 450MB | Warning  | 메모리 부족 예상 |

---

## 문제 해결

### Prometheus가 메트릭을 수집하지 않음

```bash
# Prometheus 타겟 상태 확인
curl http://localhost:9090/api/v1/targets

# Backend /metrics 엔드포인트 확인
curl http://localhost:8000/metrics
```

### Grafana 대시보드가 보이지 않음

```bash
# 대시보드 파일 확인
ls monitoring/grafana/dashboards/

# Grafana 로그 확인
docker compose logs grafana
```

### Sentry에 에러가 전송되지 않음

1. `SENTRY_DSN` 환경변수 확인
2. 컨테이너 재시작
3. 테스트 에러 발생:
   ```bash
   curl http://localhost:8000/api/nonexistent
   ```

### cAdvisor 권한 오류 (Linux)

```bash
# Docker 소켓 권한 확인
sudo chmod 666 /var/run/docker.sock
```

---

## 리소스 사용량 (N100 기준)

| 서비스          | RAM        | 설명              |
| --------------- | ---------- | ----------------- |
| Prometheus      | ~100MB     | 메트릭 저장       |
| Grafana         | ~150MB     | 대시보드          |
| cAdvisor        | ~50MB      | 컨테이너 모니터링 |
| Redis Exporter  | ~10MB      | Redis 메트릭      |
| Uptime Kuma     | ~50MB      | 상태 체크         |
| **총 모니터링** | **~360MB** |                   |

> 💡 N100 (8GB RAM) 기준 앱(~500MB) + 모니터링(~360MB) = 약 1GB로 충분히 여유 있는 구성입니다.

---

## 참고 자료

- [Prometheus 공식 문서](https://prometheus.io/docs/)
- [Grafana 공식 문서](https://grafana.com/docs/)
- [Sentry Python SDK](https://docs.sentry.io/platforms/python/)
- [Uptime Kuma GitHub](https://github.com/louislam/uptime-kuma)
