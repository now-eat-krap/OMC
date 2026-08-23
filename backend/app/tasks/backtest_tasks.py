"""RQ 백테스트 작업 정의"""

import asyncio
import logging
import time
from typing import Any

import sentry_sdk
from rq import get_current_job

from app.schemas import BacktestRequest
from app.services.backtest.engine import BacktestEngine

logger = logging.getLogger(__name__)


def update_job_progress(message: str, progress: int = 0):
    """작업 진행 상태 업데이트 (job.meta 사용)"""
    job = get_current_job()
    if job:
        job.meta["message"] = message
        job.meta["progress"] = progress
        job.meta["updated_at"] = time.time()
        job.save_meta()


def run_backtest_task(request_data: dict[str, Any]) -> dict[str, Any]:
    """백테스트 작업 (RQ Task)

    Args:
        request_data: BacktestRequest를 딕셔너리로 변환한 데이터

    Returns:
        BacktestResult를 딕셔너리로 변환한 결과
    """
    job = get_current_job()
    job_id = job.id if job else "unknown"
    logger.info(f"[Task {job_id}] 백테스트 작업 시작")

    try:
        # 진행 상태 업데이트
        update_job_progress("작업 시작...", 0)

        # 딕셔너리를 BacktestRequest 모델로 변환
        request = BacktestRequest(**request_data)

        # 진행률 콜백 정의
        def progress_callback(msg: str, p: int):
            update_job_progress(msg, p)

        # 백테스트 실행 (BacktestEngine 사용)
        backtest_engine = BacktestEngine()
        result = asyncio.run(backtest_engine.run(request, on_progress=progress_callback))

        update_job_progress("완료", 100)
        logger.info(f"[Task {job_id}] 백테스트 작업 완료")

        return {"status": "completed", "result": result.model_dump()}

    except Exception as e:
        logger.error(f"[Task {job_id}] 백테스트 작업 실패: {str(e)}")

        # Sentry 에러 전송
        sentry_sdk.capture_exception(e)

        update_job_progress(f"실패: {str(e)}", -1)
        raise
