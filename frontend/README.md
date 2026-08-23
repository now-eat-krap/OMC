# OMC 프론트엔드 (React + Vite)

문장형 조건으로 전략을 조립하고, TradingView 차트 위에서 백테스트 결과를 보는 SPA입니다.
React 19, TypeScript, Vite 7, Tailwind CSS v4, lightweight-charts 5.

## 실행

이 저장소는 로컬에 Node를 두지 않는 것을 전제로 합니다. 컨테이너로 돌립니다.

```bash
# 개발 서버 (HMR)
docker run --rm -it -v "$PWD:/app" -w /app -p 5173:5173 node:20-alpine \
  sh -c "npm ci && npx vite --host"

# 타입 검사 + 린트 + 빌드 (PR 전에 이 셋을 통과해야 합니다)
docker run --rm -v "$PWD:/app" -w /app node:20-alpine \
  sh -c "npm ci && npx tsc -b && npm run lint && npx vite build"
```

Node가 있다면 `npm ci` 후 `npm run dev` / `npm run build`로 같은 일을 합니다.

API 주소는 `VITE_API_URL`로 정합니다. 개발(`.env.development`)은 `http://localhost:8000/api`를
직접 부르므로 백엔드가 떠 있어야 하고, 프로덕션(`.env.production`)은 `/api`로 두고
nginx가 backend 컨테이너로 프록시합니다.

## 알아둘 것

- **팔레트는 두 곳에 있습니다.** `src/styles/index.css`(CSS 변수)와
  `src/theme/chartColors.ts`(캔버스·iframe 차트용). 캔버스 차트는 CSS 변수를 읽지
  못해 값을 직접 넘겨야 하므로 한쪽을 바꾸면 다른 쪽도 바꿉니다.
- **CSS 기본 요소 규칙은 반드시 `@layer` 안에 둡니다.** 레이어 밖에 두면 Tailwind
  유틸리티보다 우선해서, 예컨대 `a { color }`가 `text-*`를 덮어씁니다.
- 테마는 `data-theme`를 동기적으로 씁니다(`src/theme/ThemeProvider.tsx`). effect 안에서
  쓰면 자식 effect가 먼저 돌아 차트가 이전 테마 색을 읽습니다.

## 구조

```
src/
├── pages/            LandingPage, BacktestPage
├── components/
│   ├── landing/      랜딩 섹션, HeroDemo(실제 컴포넌트로 만든 미니 데모)
│   ├── backtest/     툴바, 차트, 조건 빌더, 결과 탭(TabPanel), AI 리포트
│   └── layout/       Logo, ThemeToggle
├── services/api.ts   백엔드 호출 (제출 → 폴링 → 취소)
├── theme/            ThemeProvider, chartColors
└── styles/index.css  디자인 토큰 + @layer
```
