"""AI 프로바이더 오류를 사용자에게 보여줄 메시지로 바꾼다

프로바이더 응답 본문을 그대로 클라이언트에 내려보내면 안 됩니다. 예컨대
OpenAI 의 401 응답에는 사용된 키가 마스킹된 형태로 들어 있고, 계정 페이지
주소와 내부 오류 코드도 함께 옵니다. 그대로 화면에 띄우면 우리 서버 설정이
브라우저로 새어 나갑니다.

그래서 여기서 예외 종류만 보고 우리 문구를 만들고, 원문은 호출하는 쪽이
logger.exception 으로 서버 로그에만 남깁니다.
"""

import openai

from app.core.exceptions import AIServiceError


def translate_provider_error(exc: Exception, action: str) -> AIServiceError:
    """프로바이더 예외를 AIServiceError 로 바꾼다

    Args:
        exc: openai 라이브러리가 올린 예외
        action: 사용자에게 보여줄 동작 이름 (예: "AI 전략 변환")

    Returns:
        상태 코드와 안전한 메시지를 담은 AIServiceError
    """
    # AuthenticationError/RateLimitError 등은 모두 APIStatusError 의 하위
    # 클래스라 좁은 것부터 본다
    if isinstance(exc, openai.AuthenticationError | openai.PermissionDeniedError):
        return AIServiceError(
            "AI 서비스 인증에 실패했습니다. 서버 관리자에게 문의해주세요.", 503
        )
    if isinstance(exc, openai.RateLimitError):
        return AIServiceError(
            "AI 서비스 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.", 429
        )
    if isinstance(exc, openai.APITimeoutError):
        return AIServiceError("AI 서비스 응답이 지연되고 있습니다. 다시 시도해주세요.", 504)
    if isinstance(exc, openai.APIConnectionError):
        return AIServiceError("AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.", 503)
    if isinstance(exc, openai.APIStatusError):
        return AIServiceError("AI 서비스가 오류를 반환했습니다. 잠시 후 다시 시도해주세요.", 502)
    return AIServiceError(f"{action}에 실패했습니다. 잠시 후 다시 시도해주세요.", 500)
