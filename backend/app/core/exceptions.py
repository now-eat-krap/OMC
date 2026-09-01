# 커스텀 예외 정의
# 백테스팅 서비스에서 사용하는 예외 클래스들


class BacktestError(Exception):
    """백테스트 실행 중 발생하는 일반 오류"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class DataFetchError(BacktestError):
    """데이터 수집 중 발생하는 오류

    예: CCXT API 오류, Redis 연결 실패 등
    """

    pass


class ValidationError(BacktestError):
    """요청 데이터 유효성 검증 오류

    예: 잘못된 날짜 형식, 지원하지 않는 심볼 등
    """

    pass


class IndicatorError(BacktestError):
    """지표 계산 중 발생하는 오류

    예: 데이터 부족, 잘못된 파라미터 등
    """

    pass


class StrategyError(BacktestError):
    """전략 파싱/실행 중 발생하는 오류

    예: 잘못된 조건 템플릿, 시그널 생성 실패 등
    """

    pass


class AIServiceError(Exception):
    """AI 프로바이더 호출이 실패했을 때 쓰는 예외

    message 는 그대로 사용자에게 내려가므로 프로바이더 응답 본문을 담지
    않습니다. 프로바이더 원문은 서버 로그에만 남깁니다
    (services/ai_errors.py 주석 참고).
    """

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
