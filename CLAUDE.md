# CLAUDE.md

Claude Code가 이 저장소에서 작업할 때 지켜야 할 규칙입니다.

## 작업 흐름 (필수)

**모든 작업은 워크트리에서 하고, `develop`으로 머지합니다.**

1. 작업을 시작하기 전에 워크트리를 만듭니다.

   ```bash
   git worktree add .claude/worktrees/<작업이름> -b <브랜치이름> origin/develop
   ```

2. 그 워크트리 안에서만 파일을 고칩니다. 메인 체크아웃(`/home/taewon/OMC`)은 건드리지 않습니다.

3. 작업이 끝나면 `develop`을 대상으로 PR을 엽니다. `main`으로 직접 PR을 열지 않습니다.

   ```bash
   gh pr create --base develop --head <브랜치이름>
   ```

4. 머지된 뒤에는 워크트리와 로컬 브랜치를 정리합니다.

   ```bash
   git worktree remove .claude/worktrees/<작업이름>
   git branch -d <브랜치이름>
   ```

`main`은 배포 브랜치입니다. `develop`에서 검증된 것만 `main`으로 올라갑니다.

## 검증

이 저장소는 로컬에 Node가 없습니다. 프론트엔드 검증은 컨테이너로 합니다.

```bash
docker run --rm -v "$PWD/frontend:/app" -w /app node:20-alpine \
  sh -c "npm ci && npx tsc -b && npm run lint && npx vite build"
```

백엔드는 문법 검사와 ruff로 확인합니다.

```bash
docker run --rm -v "$PWD/backend:/app" -w /app python:3.11-alpine \
  sh -c "pip install -q ruff && python -m compileall -q app && ruff check app"
```

전체를 띄울 때는 실제 값이 담긴 env 파일이 필요합니다. `.env.example`은
`REDIS_PASSWORD`가 비어 있어 redis가 기동에 실패합니다.

```bash
docker compose -f docker-compose.yml --env-file .env.dev up -d --build
```

## 알아둘 것

- **팔레트는 두 곳에 있습니다.** `frontend/src/styles/index.css`(CSS 변수)와
  `frontend/src/theme/chartColors.ts`(캔버스·iframe 차트용). 캔버스 차트는 CSS
  변수를 읽지 못해 값을 직접 넘겨야 하므로 한쪽을 바꾸면 다른 쪽도 바꿉니다.
- **CSS 기본 요소 규칙은 반드시 `@layer` 안에 둡니다.** 레이어 밖에 두면
  Tailwind 유틸리티보다 우선해서, 예컨대 `a { color }`가 `text-*`를 덮어씁니다.
- **RQ 워커는 `python -m app.worker`로 띄웁니다.** `rq worker` CLI를 직접 쓰면
  Numba JIT 워밍업이 fork 이전에 일어나지 않아 요청마다 약 22초가 더 걸립니다.
