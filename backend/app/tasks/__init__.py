"""RQ 백그라운드 작업 패키지

여기서는 아무것도 import하지 않습니다. 작업 모듈은 백테스트 엔진(vectorbt)을
올리므로, API 프로세스가 이 패키지를 건드려도 가벼워야 합니다. API는
app.rq_app.BACKTEST_TASK 문자열 경로로 큐에 넣고 워커가 import합니다.
"""
