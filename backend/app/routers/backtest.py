"""백테스트 API 라우터 (RQ 기반)"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from rq.command import send_stop_job_command
from rq.exceptions import NoSuchJobError
from rq.job import Job, JobStatus

from app.models import BacktestRequest
from app.rq_app import queue, redis_conn
from app.tasks import run_backtest_task

router = APIRouter()


class TaskSubmitResponse(BaseModel):
    task_id: str
    status: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    message: str | None = None
    progress: int | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


@router.post("/backtest", response_model=TaskSubmitResponse)
async def submit_backtest(request: BacktestRequest):
    """백테스트 작업 제출"""
    try:
        request_data = request.model_dump()
        job = queue.enqueue(run_backtest_task, request_data)
        return TaskSubmitResponse(task_id=job.id, status="pending")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"작업 제출 실패: {str(e)}") from e


@router.get("/backtest/status/{task_id}", response_model=TaskStatusResponse)
async def get_backtest_status(task_id: str):
    """백테스트 작업 상태 조회"""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
    except Exception:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다") from None

    status = job.get_status()
    meta = job.meta or {}

    if status == "queued":
        return TaskStatusResponse(
            task_id=task_id, status="pending", message="작업 대기 중...", progress=0
        )
    elif status == "started":
        return TaskStatusResponse(
            task_id=task_id,
            status="running",
            message=meta.get("message", "백테스트 실행 중..."),
            progress=meta.get("progress", 0),
        )
    elif status == "finished":
        result_data = job.result or {}
        return TaskStatusResponse(
            task_id=task_id,
            status="completed",
            message="백테스트 완료",
            progress=100,
            result=result_data.get("result"),
        )
    elif status == "failed":
        return TaskStatusResponse(
            task_id=task_id,
            status="failed",
            message="백테스트 실패",
            progress=-1,
            error=str(job.exc_info) if job.exc_info else "알 수 없는 오류",
        )
    elif status in (JobStatus.STOPPED, JobStatus.CANCELED):
        # stopped: 실행 중 중단됨 / canceled: 큐에서 빠짐. 클라이언트에는 구분 없이 알린다
        return TaskStatusResponse(task_id=task_id, status="cancelled", message="백테스트 취소됨")
    else:
        return TaskStatusResponse(task_id=task_id, status="unknown", message=f"상태: {status}")


@router.delete("/backtest/{task_id}")
async def cancel_backtest(task_id: str):
    """백테스트 작업 취소

    job.cancel()은 큐에 대기 중인 작업만 빼낼 수 있고 이미 실행 중인 작업은
    건드리지 못한다. 실행 중이면 워커에 stop 명령을 보내 작업 프로세스를
    종료시켜야 한다. 두 경우를 상태로 구분한다.
    """
    try:
        job = Job.fetch(task_id, connection=redis_conn)
    except NoSuchJobError:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다") from None

    status = job.get_status()

    if status == JobStatus.STARTED:
        # 워커가 fork한 작업 프로세스를 종료시킨다. 상태는 워커가 stopped로 바꾼다
        send_stop_job_command(redis_conn, job.id)
        return {"task_id": task_id, "status": "cancelling"}

    if status in (JobStatus.QUEUED, JobStatus.DEFERRED, JobStatus.SCHEDULED):
        job.cancel()
        return {"task_id": task_id, "status": "cancelled"}

    if status in (JobStatus.STOPPED, JobStatus.CANCELED):
        return {"task_id": task_id, "status": "cancelled"}

    # finished / failed: 이미 끝난 작업은 취소할 것이 없다
    raise HTTPException(status_code=409, detail=f"이미 종료된 작업입니다 (상태: {status})")
