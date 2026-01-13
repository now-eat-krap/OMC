# AI 리포트 생성 서비스
# 백테스트 결과를 분석하여 AI 리포트를 생성
# 하이브리드 방식: 점수는 백엔드 계산, 분석은 GPT

import hashlib
import json
from typing import Any

from openai import AsyncOpenAI

from app.config import OPENAI_API_KEY
from app.services.score_calculator import calculate_strategy_score


class AIReportService:
    """백테스트 결과를 분석하여 AI 리포트를 생성하는 서비스

    하이브리드 방식:
    - 점수/지표: 백엔드에서 객관적 공식으로 계산
    - 강점/약점/제안: GPT가 분석
    """

    def __init__(self):
        self.client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
        self._cache: dict[str, dict[str, Any]] = {}

    def _get_cache_key(self, data: str) -> str:
        """데이터를 해시하여 캐시 키 생성"""
        return hashlib.md5(data.encode()).hexdigest()

    def _get_system_prompt(self) -> str:
        """시스템 프롬프트 반환"""
        return """당신은 퀀트 트레이딩 전략을 평가하는 시니어 포트폴리오 매니저입니다.
백테스트 결과와 계산된 점수를 기반으로 전략을 분석합니다.

응답은 반드시 아래 JSON 형식만 반환하세요. 다른 텍스트는 포함하지 마세요:
{
  "strengths": ["강점1", "강점2", ...],
  "weaknesses": ["약점1", "약점2", ...],
  "suggestions": ["제안1", "제안2", ...],
  "summary": "한줄 요약"
}

규칙:
- strengths: 전략의 강점 (최대 5개, 각 1-2문장)
- weaknesses: 개선이 필요한 약점 (최대 5개, 각 1-2문장)
- suggestions: 구체적인 개선 제안 (최대 5개, 각 1-2문장)
- summary: 전체 전략을 1-2문장으로 요약

분석은 객관적이고 전문적으로 하되, 이해하기 쉽게 작성하세요.
반드시 한국어로 작성하세요."""

    def _format_conditions(self, conditions: list) -> str:
        """조건 리스트를 읽기 쉬운 텍스트로 변환"""
        if not conditions:
            return "조건 없음"

        formatted = []
        for i, cond in enumerate(conditions, 1):
            template_type = cond.get("templateType", "unknown")

            if template_type == "indicator_vs_value":
                indicator = cond.get("indicator", "")
                period = cond.get("indicatorPeriod", "")
                comparison = cond.get("comparison", "")
                value = cond.get("value", "")
                formatted.append(
                    f"{i}. {indicator}({period})가 {value}보다 {self._comparison_text(comparison)}"
                )

            elif template_type == "indicator_cross":
                indicator = cond.get("indicator", "")
                period = cond.get("indicatorPeriod", "")
                target = cond.get("targetIndicator", "")
                target_period = cond.get("targetPeriod", "")
                direction = cond.get("crossDirection", "above")
                formatted.append(
                    f"{i}. {indicator}({period})가 {target}({target_period})를 {'상향' if direction == 'above' else '하향'} 돌파"
                )

            elif template_type == "price_cross":
                price_type = cond.get("priceType", "close")
                target = cond.get("targetIndicator", "")
                target_period = cond.get("targetPeriod", "")
                direction = cond.get("crossDirection", "above")
                formatted.append(
                    f"{i}. {price_type}가 {target}({target_period})를 {'상향' if direction == 'above' else '하향'} 돌파"
                )

            elif template_type == "profit_loss":
                value = cond.get("value", "")
                direction = cond.get("profitDirection", "profit")
                formatted.append(
                    f"{i}. 진입가 대비 {value}% {'수익' if direction == 'profit' else '손실'}"
                )

            else:
                formatted.append(f"{i}. {template_type} 조건")

        return "\n".join(formatted)

    def _comparison_text(self, comparison: str) -> str:
        """비교 연산자를 한국어로 변환"""
        mapping = {
            "gt": "클 때",
            "gte": "크거나 같을 때",
            "lt": "작을 때",
            "lte": "작거나 같을 때",
            "eq": "같을 때",
        }
        return mapping.get(comparison, comparison)

    def _format_trades_summary(self, trades: list[dict]) -> str:
        """거래내역을 요약 텍스트로 변환"""
        if not trades:
            return "거래 없음"

        summary_lines = []
        for i, trade in enumerate(trades[:20], 1):  # 상위 20개만 요약
            entry = trade.get("entryTime", "")[:10]
            exit_time = trade.get("exitTime", "")[:10] if trade.get("exitTime") else "진행중"
            pnl = trade.get("pnl", 0)
            pnl_pct = trade.get("pnlPercent", 0)
            summary_lines.append(f"{i}. {entry} → {exit_time}: {pnl:+.2f} USDT ({pnl_pct:+.2f}%)")

        if len(trades) > 20:
            summary_lines.append(f"... 외 {len(trades) - 20}건")

        return "\n".join(summary_lines)

    async def generate_report(
        self,
        result_summary: dict[str, Any],
        buy_conditions: list,
        sell_conditions: list,
        backtest_config: dict[str, Any] | None = None,
        trades: list[dict] | None = None,
    ) -> dict[str, Any]:
        """백테스트 결과를 분석하여 AI 리포트 생성

        Args:
            result_summary: 백테스트 결과 요약 (수익률, 승률, MDD 등)
            buy_conditions: 매수 조건 리스트
            sell_conditions: 매도 조건 리스트
            backtest_config: 백테스트 설정 (심볼, 기간, 자본금 등)
            trades: 전체 거래내역

        Returns:
            구조화된 리포트 딕셔너리:
                - overallScore: 종합 점수 (0-100)
                - grade: 등급 (A+ ~ D)
                - radarMetrics: 레이더 차트용 지표
                - strengths: 강점 리스트
                - weaknesses: 약점 리스트
                - suggestions: 제안 리스트
                - summary: 한줄 요약

        Raises:
            ValueError: API 키가 설정되지 않았거나 생성 실패 시
        """
        if not self.client:
            raise ValueError("OpenAI API 키가 설정되지 않았습니다.")

        # 1. 백엔드에서 점수 계산 (객관적)
        score_data = calculate_strategy_score(result_summary)

        # 캐시 키 생성
        cache_data = f"{str(result_summary)}_{str(buy_conditions)}_{str(sell_conditions)}"
        cache_key = self._get_cache_key(cache_data)

        if cache_key in self._cache:
            return self._cache[cache_key]

        # 2. GPT에게 분석 요청 (주관적)
        config = backtest_config or {}
        trades_summary = self._format_trades_summary(trades or [])

        user_prompt = f"""다음 백테스트 결과를 분석해주세요:

## 백테스트 설정
- 코인: {config.get("symbol", "N/A")}
- 기간: {config.get("startDate", "N/A")} ~ {config.get("endDate", "N/A")}
- 시간간격: {config.get("timeframe", "N/A")}
- 초기자본: {config.get("initialCapital", 0):,.0f} USDT
- 수수료: {config.get("feeRate", 0)}%
- 슬리피지: {config.get("slippage", 0)}%
- 포지션비율: {config.get("positionSize", 100)}%
- 레버리지: {config.get("leverage", 1)}x

## 전략 조건

### 매수 조건
{self._format_conditions(buy_conditions)}

### 매도 조건
{self._format_conditions(sell_conditions)}

## 백테스트 결과 (계산된 점수: {score_data["overallScore"]}점, 등급: {score_data["grade"]})

- 총 수익률: {result_summary.get("totalReturn", 0):.2f}% (점수: {score_data["radarMetrics"]["profitability"]}/5)
- 승률: {result_summary.get("winRate", 0):.2f}% (점수: {score_data["radarMetrics"]["winRate"]}/5)
- 최대 낙폭(MDD): {result_summary.get("maxDrawdown", 0):.2f}% (점수: {score_data["radarMetrics"]["riskManagement"]}/5)
- 샤프 비율: {result_summary.get("sharpeRatio", 0):.2f} (점수: {score_data["radarMetrics"]["stability"]}/5)
- 수익 팩터: {result_summary.get("profitFactor", 0):.2f} (점수: {score_data["radarMetrics"]["profitFactor"]}/5)
- 총 거래: {result_summary.get("totalTrades", 0)}회 (수익: {result_summary.get("profitTrades", 0)}회, 손실: {result_summary.get("lossTrades", 0)}회)

## 거래내역 요약
{trades_summary}

위 결과를 바탕으로 JSON 형식으로 분석해주세요."""

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self._get_system_prompt()},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=1500,
                response_format={"type": "json_object"},
            )

            # GPT 응답 파싱
            gpt_response = json.loads(response.choices[0].message.content)

            # 최종 리포트 조합 (백엔드 점수 + GPT 분석)
            report = {
                **score_data,  # overallScore, grade, radarMetrics
                "strengths": gpt_response.get("strengths", []),
                "weaknesses": gpt_response.get("weaknesses", []),
                "suggestions": gpt_response.get("suggestions", []),
                "summary": gpt_response.get("summary", ""),
            }

            # 캐시 저장
            self._cache[cache_key] = report

            return report

        except json.JSONDecodeError as e:
            raise ValueError(f"GPT 응답 파싱 실패: {str(e)}") from e
        except Exception as e:
            raise ValueError(f"AI 리포트 생성 실패: {str(e)}") from e

    def clear_cache(self):
        """캐시 초기화"""
        self._cache.clear()


# 싱글톤 인스턴스
ai_report_service = AIReportService()
