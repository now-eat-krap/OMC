# Contributing Guide

OMC 백테스팅 프로젝트에 기여해주셔서 감사합니다! 🎉

## 목차

- [브랜치 전략](#브랜치-전략)
- [커밋 컨벤션](#커밋-컨벤션)
- [PR 규칙](#pr-규칙)
- [코드 스타일](#코드-스타일)
- [개발 환경 설정](#개발-환경-설정)

---

## 브랜치 전략

Git Flow 기반의 간단한 전략을 사용합니다.

### 브랜치 종류

| 브랜치      | 용도                 | 보호              |
| ----------- | -------------------- | ----------------- |
| `main`      | 프로덕션 배포 브랜치 | ✅ 직접 푸시 금지 |
| `develop`   | 개발 통합 브랜치     | ✅ PR 필수        |
| `feature/*` | 기능 개발            | -                 |

### 워크플로우

```
main ─────────────────────────────────────────► (프로덕션)
  │                                      ▲
  │                                      │ (릴리즈 시 머지)
  ▼                                      │
develop ──┬──────────────────────────────┴────► (개발 통합)
          │         ▲         ▲
          │         │         │ (PR 머지)
          ▼         │         │
feature/a ──────────┘         │
feature/b ────────────────────┘
```

### 작업 흐름

```bash
# 1. develop에서 feature 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# 2. 작업 및 커밋
git add .
git commit -m "feat: 새로운 기능 추가"

# 3. develop으로 PR 생성 및 머지

# 4. 릴리즈 시 develop → main 머지
```

---

## 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 규칙을 따릅니다.

### 형식

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type 종류

| Type       | 설명                      | 예시                              |
| ---------- | ------------------------- | --------------------------------- |
| `feat`     | 새 기능                   | `feat: 백테스트 결과 차트 추가`   |
| `fix`      | 버그 수정                 | `fix: Redis 연결 타임아웃 해결`   |
| `docs`     | 문서 변경                 | `docs: 모니터링 가이드 추가`      |
| `style`    | 코드 포맷팅 (기능 변경 X) | `style: ESLint 적용`              |
| `refactor` | 리팩토링 (기능 변경 X)    | `refactor: 백테스트 엔진 분리`    |
| `perf`     | 성능 개선                 | `perf: 캐시 조회 최적화`          |
| `test`     | 테스트 추가/수정          | `test: 백테스트 유닛 테스트 추가` |
| `chore`    | 빌드/설정 변경            | `chore: Docker Compose 분리`      |
| `ci`       | CI 설정 변경              | `ci: GitHub Actions 추가`         |

### Scope (선택)

- `backend`, `frontend`, `docker`, `docs`, `monitoring` 등

### 예시

```bash
feat(backend): Prometheus 메트릭 통합
fix(frontend): 차트 렌더링 오류 수정
docs: CONTRIBUTING.md 추가
chore(docker): 프로덕션 환경 분리
```

---

## PR 규칙

### PR 생성 전 체크리스트

- [ ] 로컬에서 테스트 완료
- [ ] 린트 통과 (`npm run lint`, `ruff check`)
- [ ] 커밋 메시지 컨벤션 준수
- [ ] 관련 문서 업데이트 (필요 시)

### PR 템플릿

`.github/PULL_REQUEST_TEMPLATE.md` 템플릿을 따라 작성해주세요.

### 머지 전략

- **Squash and Merge**: 기능 브랜치 → main
- 커밋 히스토리를 깔끔하게 유지

---

## 코드 스타일

### Backend (Python)

- **포맷터**: Ruff (Black 호환)
- **린터**: Ruff
- **설정**: `pyproject.toml`

```bash
# 린트 체크
ruff check backend/

# 자동 수정
ruff check --fix backend/
```

### Frontend (TypeScript/React)

- **포맷터**: Prettier
- **린터**: ESLint (Airbnb 스타일)
- **설정**: `.eslintrc.cjs`, `.prettierrc`

```bash
# 린트 체크
npm run lint

# 자동 수정
npm run lint:fix
```

---

## 개발 환경 설정

### 필수 도구

- Docker & Docker Compose
- Node.js 20+
- Python 3.11+

### 시작하기

```bash
# 저장소 클론
git clone https://github.com/your-username/backtesting.git
cd backtesting

# 환경변수 설정
cp .env.example .env
# .env 파일 편집

# 개발 환경 실행
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

자세한 설정은 [docs/DEVELOPMENT_SETUP.md](docs/DEVELOPMENT_SETUP.md)를 참고하세요.

---

## 질문이 있으신가요?

이슈를 생성하거나 PR에 코멘트를 남겨주세요! 🙌
