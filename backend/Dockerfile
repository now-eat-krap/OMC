# =============================================================================
# Backend Dockerfile
# FastAPI + VectorBT 백테스트 API 서버
# =============================================================================

# Python 3.11 슬림 이미지 (NumPy/VectorBT 호환)
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치
# - gcc: 일부 Python 패키지 컴파일용
# - curl: 헬스체크용
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 포트 노출
EXPOSE 8000

# 서버 실행
# --host 0.0.0.0: 컨테이너 외부 접근 허용
# --workers 4: 워커 프로세스 수 (CPU 코어 수에 맞게 조정)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
