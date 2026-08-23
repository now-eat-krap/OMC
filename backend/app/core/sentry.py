"""Sentry 초기화

API 프로세스와 RQ 워커 프로세스가 각각 따로 떠 있으므로 초기화도 각각
해야 합니다. 설정이 두 곳에서 갈라지지 않도록 여기 한 곳에 둡니다.

SENTRY_DSN이 없으면 아무것도 하지 않습니다(로컬 개발 기본값).
"""

import logging
import os

import sentry_sdk

logger = logging.getLogger(__name__)

RELEASE = "backtesting@1.0.0"


def init_sentry(component: str, integrations: list | None = None) -> bool:
    """Sentry를 초기화한다.

    Args:
        component: 프로세스 구분값. Sentry 태그 `component`로 붙어서
            API 에러와 워커 에러를 나눠 볼 수 있습니다.
        integrations: 프로세스별 추가 통합 (예: 워커의 RqIntegration).

    Returns:
        초기화했으면 True, DSN이 없어 건너뛰었으면 False.
    """
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        logger.info("SENTRY_DSN이 없어 Sentry를 건너뜁니다 (%s)", component)
        return False

    sentry_sdk.init(
        dsn=dsn,
        integrations=integrations or [],
        # 성능 모니터링 샘플링 비율 (10%)
        traces_sample_rate=0.1,
        # 프로파일링 샘플링 비율 (10%)
        profiles_sample_rate=0.1,
        # 환경 설정 (DEBUG 변수로 구분)
        environment="development" if os.getenv("DEBUG") == "true" else "production",
        release=RELEASE,
    )
    sentry_sdk.set_tag("component", component)
    logger.info("Sentry 초기화 완료 (%s)", component)
    return True
