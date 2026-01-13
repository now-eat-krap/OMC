# 백테스트 결과 점수 계산 모듈
# 객관적인 벤치마크 기반 점수 산출

from typing import Any


def calculate_profitability_score(total_return: float) -> float:
    """수익성 점수 계산 (0-5점)

    벤치마크:
    - 50% 이상: 5점
    - 20-50%: 4-5점
    - 0-20%: 3-4점
    - 음수: 1-3점
    """
    if total_return >= 50:
        return 5.0
    elif total_return >= 20:
        return 4.0 + (total_return - 20) / 30
    elif total_return >= 0:
        return 3.0 + total_return / 20
    else:
        return max(1.0, 3.0 + total_return / 20)


def calculate_winrate_score(win_rate: float) -> float:
    """승률 점수 계산 (0-5점)

    벤치마크:
    - 70% 이상: 5점
    - 50-70%: 3-5점
    - 40% 미만: 1-2점
    """
    if win_rate >= 70:
        return 5.0
    elif win_rate >= 50:
        return 3.0 + (win_rate - 50) / 10
    elif win_rate >= 40:
        return 2.0 + (win_rate - 40) / 10
    else:
        return max(1.0, win_rate / 20)


def calculate_risk_score(max_drawdown: float) -> float:
    """리스크 관리 점수 계산 (0-5점)

    MDD가 낮을수록 높은 점수
    벤치마크:
    - 5% 이하: 5점
    - 5-15%: 4-5점
    - 15-30%: 2-4점
    - 30% 초과: 1-2점
    """
    mdd = abs(max_drawdown)
    if mdd <= 5:
        return 5.0
    elif mdd <= 15:
        return 4.0 + (15 - mdd) / 10
    elif mdd <= 30:
        return 2.0 + (30 - mdd) / 7.5
    else:
        return max(1.0, 2.0 - (mdd - 30) / 30)


def calculate_stability_score(sharpe_ratio: float) -> float:
    """안정성 점수 계산 (0-5점)

    샤프비율 기반
    벤치마크:
    - 2.0 이상: 5점
    - 1.0-2.0: 3-5점
    - 0.5-1.0: 2-3점
    - 0.5 미만: 1-2점
    """
    if sharpe_ratio >= 2.0:
        return 5.0
    elif sharpe_ratio >= 1.0:
        return 3.0 + (sharpe_ratio - 1.0) * 2
    elif sharpe_ratio >= 0.5:
        return 2.0 + (sharpe_ratio - 0.5) * 2
    else:
        return max(1.0, 1.0 + sharpe_ratio * 2)


def calculate_profit_factor_score(profit_factor: float) -> float:
    """수익팩터 점수 계산 (0-5점)

    벤치마크:
    - 2.5 이상: 5점
    - 1.5-2.5: 3-5점
    - 1.0-1.5: 2-3점
    - 1.0 미만: 1-2점
    """
    if profit_factor >= 2.5:
        return 5.0
    elif profit_factor >= 1.5:
        return 3.0 + (profit_factor - 1.5) * 2
    elif profit_factor >= 1.0:
        return 2.0 + (profit_factor - 1.0) * 2
    else:
        return max(1.0, profit_factor * 2)


def calculate_overall_score(radar_metrics: dict[str, float]) -> int:
    """종합 점수 계산 (0-100점)

    가중치:
    - 수익성: 25%
    - 승률: 20%
    - 리스크관리: 25%
    - 안정성: 20%
    - 수익팩터: 10%
    """
    weighted_score = (
        radar_metrics["profitability"] * 0.25
        + radar_metrics["winRate"] * 0.20
        + radar_metrics["riskManagement"] * 0.25
        + radar_metrics["stability"] * 0.20
        + radar_metrics["profitFactor"] * 0.10
    )
    return int(weighted_score * 20)  # 0-5점을 0-100점으로 변환


def calculate_grade(score: int) -> str:
    """점수 기반 등급 산출

    A+: 90-100
    A:  80-89
    B+: 70-79
    B:  60-69
    C:  50-59
    D:  50 미만
    """
    if score >= 90:
        return "A+"
    elif score >= 80:
        return "A"
    elif score >= 70:
        return "B+"
    elif score >= 60:
        return "B"
    elif score >= 50:
        return "C"
    else:
        return "D"


def calculate_strategy_score(result: dict[str, Any]) -> dict[str, Any]:
    """백테스트 결과를 분석하여 전략 점수 산출

    Args:
        result: 백테스트 결과 딕셔너리
            - totalReturn: 총 수익률 (%)
            - winRate: 승률 (%)
            - maxDrawdown: 최대 낙폭 (%, 음수)
            - sharpeRatio: 샤프비율
            - profitFactor: 수익팩터

    Returns:
        점수 정보 딕셔너리
            - overallScore: 종합 점수 (0-100)
            - grade: 등급 (A+ ~ D)
            - radarMetrics: 레이더 차트용 지표 (각 0-5)
    """
    # 각 지표별 점수 계산
    radar_metrics = {
        "profitability": round(calculate_profitability_score(result.get("totalReturn", 0)), 1),
        "winRate": round(calculate_winrate_score(result.get("winRate", 0)), 1),
        "riskManagement": round(calculate_risk_score(result.get("maxDrawdown", 0)), 1),
        "stability": round(calculate_stability_score(result.get("sharpeRatio", 0)), 1),
        "profitFactor": round(calculate_profit_factor_score(result.get("profitFactor", 0)), 1),
    }

    # 종합 점수 및 등급
    overall_score = calculate_overall_score(radar_metrics)
    grade = calculate_grade(overall_score)

    return {
        "overallScore": overall_score,
        "grade": grade,
        "radarMetrics": radar_metrics,
    }
