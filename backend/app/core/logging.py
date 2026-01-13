# 로깅 설정
# 애플리케이션 전반에서 사용하는 로거 설정

import logging
import sys


def setup_logging(level: str = "INFO", format_style: str = "standard") -> None:
    """로깅 설정 초기화

    Args:
        level: 로그 레벨 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        format_style: 로그 포맷 스타일 (standard, detailed)
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    if format_style == "detailed":
        log_format = (
            "%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s"
        )
    else:
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )


def get_logger(name: str | None = None) -> logging.Logger:
    """로거 인스턴스 반환

    Args:
        name: 로거 이름 (None이면 루트 로거)

    Returns:
        logging.Logger 인스턴스
    """
    return logging.getLogger(name)


# 기본 로깅 설정 (모듈 로드 시 실행)
setup_logging()
