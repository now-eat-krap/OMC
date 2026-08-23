"""services 패키지

여기서는 아무것도 import하지 않습니다. 필요한 모듈을 정확한 경로로 가져오세요.

    from app.services.data import DataService
    from app.services.backtest.engine import BacktestEngine

예전에는 이 파일이 indicators와 백테스트 엔진을 re-export했는데, 그러면
app.services 아래 아무 모듈이나 하나만 써도 vectorbt/numba가 통째로
import됩니다(약 6초, 약 200MB). API 프로세스는 둘 다 쓰지 않습니다.
"""
