# 백테스트 API 라우터
# 작업 큐 기반 비동기 백테스트

from typing import Any

from celery.result import AsyncResult
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.celery_app import celery_app
from app.models import BacktestRequest
from app.tasks import run_backtest_task

router = APIRouter()


# 작업 제출 응답 모델
class TaskSubmitResponse(BaseModel):
    task_id: str
    status: str


# 작업 상태 응답 모델
class TaskStatusResponse(BaseModel):
    task_id: str
    status: str  # pending, running, completed, failed
    message: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


@router.post("/backtest", response_model=TaskSubmitResponse)
async def submit_backtest(request: BacktestRequest):
    """
    백테스트 작업 제출

    작업 큐에 백테스트 요청을 추가하고 task_id를 반환합니다.
    클라이언트는 이 task_id로 상태를 폴링합니다.
    """
    try:
        # BacktestRequest를 딕셔너리로 변환하여 Celery에 전달
        request_data = request.model_dump()

        # 작업 큐에 추가
        task = run_backtest_task.delay(request_data)

        return TaskSubmitResponse(task_id=task.id, status="pending")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"작업 제출 실패: {str(e)}") from e


@router.get("/backtest/status/{task_id}", response_model=TaskStatusResponse)
async def get_backtest_status(task_id: str):
    """
    백테스트 작업 상태 조회

    task_id로 작업 상태를 조회합니다.
    - pending: 대기 중
    - running: 실행 중
    - completed: 완료
    - failed: 실패
    """
    try:
        task_result = AsyncResult(task_id, app=celery_app)

        if task_result.state == "PENDING":
            return TaskStatusResponse(task_id=task_id, status="pending", message="작업 대기 중...")
        elif task_result.state == "RUNNING":
            # 메타 정보에서 상세 상태 가져오기
            meta = task_result.info or {}
            return TaskStatusResponse(
                task_id=task_id,
                status="running",
                message=meta.get("message", "백테스트 실행 중..."),
            )
        elif task_result.state == "SUCCESS":
            # 작업 완료 - 결과 포함
            result_data = task_result.result or {}
            return TaskStatusResponse(
                task_id=task_id,
                status="completed",
                message="백테스트 완료",
                result=result_data.get("result"),
            )
        elif task_result.state == "FAILURE":
            # 작업 실패
            error_msg = str(task_result.result) if task_result.result else "알 수 없는 오류"
            return TaskStatusResponse(
                task_id=task_id, status="failed", message="백테스트 실패", error=error_msg
            )
        else:
            # 기타 상태 (STARTED, RETRY 등)
            return TaskStatusResponse(
                task_id=task_id, status="running", message=f"상태: {task_result.state}"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"상태 조회 실패: {str(e)}") from e


@router.delete("/backtest/{task_id}")
async def cancel_backtest(task_id: str):
    """
    백테스트 작업 취소
    """
    try:
        celery_app.control.revoke(task_id, terminate=True)
        return {"task_id": task_id, "status": "cancelled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"작업 취소 실패: {str(e)}") from e
