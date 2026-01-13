# Celery 백테스트 작업 정의
# 백그라운드에서 백테스트 실행

import asyncio
import logging
from typing import Any

from app.celery_app import celery_app
from app.schemas import BacktestRequest
from app.services.backtest import BacktestEngine

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="run_backtest")
def run_backtest_task(self, request_data: dict[str, Any]) -> dict[str, Any]:
    """백테스트 작업 (Celery Task)

    Args:
        request_data: BacktestRequest를 딕셔너리로 변환한 데이터

    Returns:
        BacktestResult를 딕셔너리로 변환한 결과
    """
    task_id = self.request.id
    logger.info(f"[Task {task_id}] 백테스트 작업 시작")

    try:
        # 딕셔너리를 BacktestRequest 모델로 변환
        request = BacktestRequest(**request_data)

        # 상태 업데이트: 시작
        self.update_state(
            state="RUNNING", meta={"status": "running", "message": "백테스트 실행 중..."}
        )

        # 백테스트 실행 (BacktestEngine 사용)
        backtest_engine = BacktestEngine()

        # 동기 환경에서 async 함수 실행
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(backtest_engine.run(request))
        finally:
            loop.close()

        # 결과를 딕셔너리로 변환 (JSON 직렬화 가능하도록)
        result_dict = result.model_dump()

        logger.info(f"[Task {task_id}] 백테스트 작업 완료")

        return {"status": "completed", "result": result_dict}

    except Exception as e:
        logger.error(f"[Task {task_id}] 백테스트 작업 실패: {str(e)}")

        # 실패 상태로 업데이트
        self.update_state(state="FAILURE", meta={"status": "failed", "error": str(e)})

        # 에러 다시 발생시켜 Celery가 실패로 처리하도록
        raise
