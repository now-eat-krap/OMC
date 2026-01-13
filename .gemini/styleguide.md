# 📋 코드 리뷰 스타일 가이드

> Gemini Code Assist가 PR 리뷰 시 참고하는 코딩 규칙입니다.
> 이 가이드라인을 따르지 않는 코드는 리뷰에서 지적될 수 있습니다.

---

## 🐍 Python (Backend)

### 필수 규칙 (CRITICAL/HIGH)

| 규칙                   | 설명                                    | 예시                             |
| ---------------------- | --------------------------------------- | -------------------------------- |
| **Exception Chaining** | except 블록에서 `raise ... from e` 필수 | `raise ValueError("msg") from e` |
| **보안**               | API 키, 비밀번호 하드코딩 금지          | 환경변수 사용                    |
| **SQL Injection**      | raw SQL 사용 시 파라미터 바인딩 필수    | ORM 또는 `?` placeholder         |
| **타입 힌트**          | 함수 시그니처에 타입 명시               | `def foo(x: int) -> str:`        |

### 권장 규칙 (MEDIUM)

- **Ruff** 린터 규칙 준수 (line-length: 100)
- **docstring**: 공개 함수/클래스에 필수, 한국어 작성
- **F-string**: `.format()` 대신 f-string 사용
- **Context Manager**: 파일/DB 연결은 `with` 문 사용
- **Early Return**: 깊은 중첩보다 조기 반환 선호

### FastAPI 특화 규칙

```python
# ✅ Good - Depends 패턴
@router.get("/items")
async def get_items(db: Session = Depends(get_db)):
    ...

# ✅ Good - Pydantic 모델 사용
class ItemCreate(BaseModel):
    name: str
    price: float = Field(gt=0)

# ❌ Bad - dict 직접 반환
return {"status": "ok"}  # → response_model 정의 권장
```

---

## ⚛️ TypeScript/React (Frontend)

### 필수 규칙 (CRITICAL/HIGH)

| 규칙                | 설명                                     |
| ------------------- | ---------------------------------------- |
| **`any` 타입 금지** | 구체적인 타입 또는 `unknown` 사용        |
| **XSS 방지**        | `dangerouslySetInnerHTML` 사용 자제      |
| **의존성 배열**     | useEffect/useCallback 의존성 정확히 명시 |
| **Key 속성**        | 리스트 렌더링 시 유니크한 key 필수       |

### 권장 규칙 (MEDIUM)

- **ESLint + Prettier** 규칙 준수
- **컴포넌트**: 함수형 + Hooks 사용 (클래스 컴포넌트 지양)
- **상태 관리**: props drilling 대신 Context 또는 상태 관리 라이브러리
- **조건부 렌더링**: 복잡한 삼항 연산자보다 early return
- **Event Handler**: 인라인 함수 대신 useCallback

### React 패턴

```tsx
// ✅ Good - 타입 명시
interface Props {
  items: Item[];
  onSelect: (id: string) => void;
}

// ✅ Good - 조기 반환
if (loading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
return <Content data={data} />;

// ❌ Bad - 인라인 객체 (매 렌더마다 새 참조)
<Component style={{ color: "red" }} />;
```

---

## 🔒 보안 규칙 (CRITICAL)

### 절대 금지

- ❌ API 키, 비밀번호, 토큰 하드코딩
- ❌ `.env` 파일 커밋
- ❌ 사용자 입력 직접 SQL 쿼리에 삽입
- ❌ `eval()`, `exec()` 사용
- ❌ CORS `*` 프로덕션 설정

### 필수 사항

- ✅ 환경변수 또는 Secret Manager 사용
- ✅ 입력 값 검증 (Pydantic, Zod 등)
- ✅ HTTPS 강제 (프로덕션)
- ✅ Rate Limiting 적용

---

## 🧪 테스트

### 요구 사항

- 새로운 기능은 테스트 코드 포함 권장
- 버그 수정 시 재발 방지 테스트 추가
- 테스트 파일명: `test_*.py` 또는 `*.test.ts`

### 테스트 작성 원칙

```python
# ✅ Good - Arrange-Act-Assert 패턴
def test_calculate_total():
    # Arrange
    items = [Item(price=100), Item(price=200)]

    # Act
    result = calculate_total(items)

    # Assert
    assert result == 300
```

---

## 📝 Git 컨벤션

### 커밋 메시지

```
<type>(<scope>): <subject>

# 예시
feat(auth): 소셜 로그인 추가
fix(api): 잘못된 응답 코드 수정
docs(readme): 설치 가이드 업데이트
refactor(utils): 중복 코드 제거
```

| Type       | 설명                    |
| ---------- | ----------------------- |
| `feat`     | 새로운 기능             |
| `fix`      | 버그 수정               |
| `docs`     | 문서 변경               |
| `style`    | 포맷팅 (기능 변경 없음) |
| `refactor` | 리팩토링                |
| `test`     | 테스트 추가/수정        |
| `chore`    | 빌드/설정 변경          |

### PR 규칙

- 하나의 PR = 하나의 목적
- 500줄 이하 권장 (너무 크면 분리)
- 셀프 리뷰 후 제출
- 스크린샷/영상 첨부 (UI 변경 시)

---

## 📁 프로젝트 구조

```
backend/
├── app/
│   ├── api/          # API 라우터
│   ├── core/         # 설정, 예외
│   ├── schemas/      # Pydantic 모델
│   ├── services/     # 비즈니스 로직
│   └── utils/        # 유틸리티

frontend/
├── src/
│   ├── components/   # 재사용 컴포넌트
│   ├── pages/        # 페이지 컴포넌트
│   ├── hooks/        # 커스텀 훅
│   ├── services/     # API 호출
│   └── styles/       # CSS
```

---

## ⚡ 성능

### 주의 사항

- N+1 쿼리 문제 방지 (eager loading 사용)
- 불필요한 re-render 방지 (React.memo, useMemo)
- 큰 데이터는 페이지네이션 또는 무한 스크롤
- 이미지 최적화 (WebP, lazy loading)
