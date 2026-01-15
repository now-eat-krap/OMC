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
│                         프로덕션 환경                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Frontend │  │ Backend  │  │  Celery  │  │  Redis   │        │
│  │ (Nginx)  │  │ (FastAPI)│  │ (Worker) │  │ (Cache)  │        │
│  └──────────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│                     │             │             │               │
│         ┌───────────┴─────────────┴─────────────┴────────┐     │
│         │                    메트릭                        │     │
│         └───────────┬─────────────┬─────────────┬────────┘     │
│                     ▼             ▼             ▼               │
│              ┌────────────────────────────────────────┐        │
│              │              Prometheus                 │        │
│              │            (메트릭 수집)                  │        │
│              └──────────────────┬─────────────────────┘        │
│                                 │                               │
│                                 ▼                               │
│              ┌────────────────────────────────────────┐        │
│              │               Grafana                   │        │
│              │            (대시보드)                    │        │
│              └────────────────────────────────────────┘        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   cAdvisor   │  │Redis Exporter│  │ Uptime Kuma  │          │
│  │ (컨테이너)    │  │   (Redis)    │  │   (알림)      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    Sentry (클라우드)                     │    │
│  │                 (에러 추적 & 성능 모니터링)               │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 모니터링 스택

### 1. Prometheus

- **역할**: 메트릭 수집 및 저장
- **포트**: 9090
- **수집 대상**:
  - FastAPI 백엔드 (`/metrics`)
  - Redis (redis-exporter)
  - 컨테이너 (cAdvisor)

### 2. Grafana

- **역할**: 대시보드 시각화
- **포트**: 3000
- **기본 계정**: admin / admin123
- **포함 대시보드**:
  - FastAPI 백엔드 대시보드
  - Redis 캐시 대시보드

### 3. cAdvisor

- **역할**: 컨테이너 리소스 모니터링
- **포트**: 8080
- **메트릭**: CPU, 메모리, 네트워크, 디스크 I/O

### 4. Redis Exporter

- **역할**: Redis 메트릭 수집
- **포트**: 9121
- **메트릭**: 메모리, 연결 수, 키 개수, 적중률

### 5. Uptime Kuma

- **역할**: 서비스 상태 모니터링 + 알림
- **포트**: 3001
- **기능**: HTTP/TCP/Ping 체크, 다양한 알림 채널

### 6. Sentry (클라우드)

- **역할**: 에러 추적 및 성능 모니터링
- **통합**: FastAPI + Celery
- **URL**: [sentry.io](https://sentry.io)

---

## 설정 방법

### 1. 프로덕션 환경 실행

```bash
# 프로덕션 환경 시작 (모니터링 포함)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 서비스 상태 확인
docker-compose ps
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
docker-compose logs grafana
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
