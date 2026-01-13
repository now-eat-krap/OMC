# Celery 백테스트 작업 정의
# 하위 호환성을 위해 tasks 패키지에서 re-export

from app.tasks.backtest_tasks import run_backtest_task

__all__ = [
    "run_backtest_task",
]
