# 개발 환경 설정 가이드

이 프로젝트는 **ESLint + Prettier** (Frontend)와 **Ruff** (Backend)를 사용하여 코드 품질을 관리합니다.

## 🚀 새 컴퓨터에서 시작하기

```bash
# 1. 저장소 클론
git clone <repository-url>
cd OMC

# 2. 루트 의존성 설치 (Husky pre-commit 훅이 같이 설정됨)
npm install

# 3. Frontend 의존성 설치
cd frontend && npm install && cd ..

# 4. Backend 의존성 설치 (Ruff 포함)
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt
```

로컬에 Node나 Python을 두고 싶지 않다면 위 2~4 대신 컨테이너로 검증할 수 있습니다.
PR 전에 통과해야 하는 명령이 이 둘입니다.

```bash
docker run --rm -v "$PWD/frontend:/app" -w /app node:20-alpine \
  sh -c "npm ci && npx tsc -b && npm run lint && npx vite build"

docker run --rm -v "$PWD/backend:/app" -w /app python:3.11-alpine \
  sh -c "pip install -q ruff && python -m compileall -q app && ruff check app && ruff format --check app"
```

앱 전체를 띄우는 법과 작업 흐름(워크트리 → `develop` PR)은 루트 `CLAUDE.md`에 있습니다.

## 🔧 Pre-commit Hook

커밋 시 자동으로 린트 검사가 실행됩니다.

| 대상                     | 도구              | 검사 내용          |
| ------------------------ | ----------------- | ------------------ |
| Frontend (`.ts`, `.tsx`) | ESLint + Prettier | 코드 품질 + 포맷팅 |
| Backend (`.py`)          | Ruff              | 코드 품질 + 포맷팅 |

## 📝 수동 실행 명령어

### Frontend

```bash
cd frontend

# 린트 검사
npm run lint

# 린트 자동 수정
npm run lint:fix

# 포맷팅
npm run format

# 포맷 체크 (수정 없이)
npm run format:check
```

### Backend

```bash
cd backend

# 린트 검사
ruff check .

# 린트 자동 수정
ruff check . --fix

# 포맷팅
ruff format .

# 포맷 체크 (수정 없이)
ruff format . --check
```

## 📁 설정 파일 위치

| 파일                           | 설명                     |
| ------------------------------ | ------------------------ |
| `package.json` (루트)          | Husky, lint-staged 설정  |
| `.husky/pre-commit`            | Pre-commit hook 스크립트 |
| `frontend/.prettierrc`         | Prettier 포맷팅 규칙     |
| `frontend/eslint.config.js`    | ESLint 규칙              |
| `backend/pyproject.toml`       | Ruff 설정                |
| `backend/requirements-dev.txt` | 개발 의존성 (Ruff 등)    |

## ⚠️ 문제 해결

### Husky가 작동하지 않을 때

```bash
# 루트에서 다시 설치
npm install
npx husky init
```

### Pre-commit hook 우회 (긴급 시에만)

```bash
git commit --no-verify -m "message"
```

> **주의:** 이 옵션은 CI에서 린트 검사가 실패할 수 있으므로 권장하지 않습니다.
