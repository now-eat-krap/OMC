# AI 전략 변환 서비스
# 자연어를 SentenceCondition으로 변환하는 OpenAI Function Calling 활용

import hashlib
import json
from typing import Any

from openai import AsyncOpenAI

from app.config import OPENAI_API_KEY


class AIStrategyService:
    """
    자연어 전략을 SentenceCondition 형태로 변환하는 AI 서비스

    OpenAI gpt-4o-mini 모델과 Function Calling을 활용하여
    사용자의 자연어 입력을 구조화된 백테스팅 조건으로 변환합니다.
    """

    def __init__(self):
        self.client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        self.model = "gpt-4o-mini"

        # 캐시 (메모리 기반 - 간단한 구현)
        self._cache: dict[str, dict[str, Any]] = {}

    def _get_cache_key(self, prompt: str) -> str:
        """프롬프트를 정규화하여 캐시 키 생성"""
        normalized = " ".join(prompt.lower().split())
        return hashlib.md5(normalized.encode()).hexdigest()

    def _get_system_prompt(self) -> str:
        """시스템 프롬프트 반환"""
        return """당신은 암호화폐 트레이딩 전략을 JSON 조건으로 변환하는 전문가입니다.

사용자의 자연어 전략 설명을 분석하여 매수 조건(buyConditions)과 매도 조건(sellConditions)으로 변환합니다.

## 지원되는 지표
- RSI (기본 기간: 14)
- SMA (단순이동평균, 기본 기간: 20)
- EMA (지수이동평균, 기본 기간: 20)
- MACD (12, 26, 9)
- BB (볼린저밴드, 기간: 20, 표준편차: 2)
- STOCH (스토캐스틱, 14, 3, 3)

## 지원되는 조건 유형 (templateType)
1. indicator_vs_value: 지표가 특정 값과 비교 (예: RSI가 30보다 작을 때)
   - 필수: indicator, indicatorPeriod, comparison, value
   - comparison: 'gt'(초과), 'lt'(미만), 'gte'(이상), 'lte'(이하)

2. indicator_cross: 두 지표가 교차 (예: EMA5가 EMA20을 돌파)
   - 필수: indicator, indicatorPeriod, targetIndicator, targetPeriod, crossDirection
   - crossDirection: 'above'(상향돌파), 'below'(하향돌파)

3. price_cross: 가격이 지표를 교차 (예: 종가가 SMA20을 돌파)
   - 필수: priceType, indicator, indicatorPeriod, crossDirection
   - priceType: 'close', 'high', 'low', 'open'

4. profit_loss: 진입가 대비 손익 (예: 10% 이상 수익)
   - 필수: profitDirection, value
   - profitDirection: 'profit'(수익), 'loss'(손실)

5. band_touch: 밴드 터치/돌파 (예: 볼린저밴드 하단 터치)
   - 필수: bandType, bandPosition, touchType
   - bandType: 'bollinger'
   - bandPosition: 'upper', 'middle', 'lower'
   - touchType: 'touch', 'cross', 'exit'

6. macd_signal: MACD 시그널 (예: MACD가 시그널선을 상향돌파)
   - 필수: crossDirection
   - 자동으로 MACD 라인과 시그널 라인의 교차를 감지

7. stochastic: 스토캐스틱 (%K/%D 교차)
   - 필수: crossDirection
   - 자동으로 %K와 %D의 교차를 감지

## 응답 규칙
1. 각 조건에는 고유한 id를 생성 (예: "cond_1", "cond_2")
2. 여러 조건이 있으면 nextOperator로 연결 ('AND' 또는 'OR', 기본: 'AND')
3. 마지막 조건의 nextOperator는 생략하거나 'AND'
4. 매수/매도 조건이 명시되지 않으면 해당 배열을 비워둘 것
5. 지표 기간이 명시되지 않으면 기본값 사용

## 예시
사용자: "RSI가 30 아래면 매수하고, 70 이상이면 매도해줘"
응답:
{
  "buyConditions": [
    {"id": "cond_1", "templateType": "indicator_vs_value", "indicator": "RSI", "indicatorPeriod": 14, "comparison": "lt", "value": 30}
  ],
  "sellConditions": [
    {"id": "cond_2", "templateType": "indicator_vs_value", "indicator": "RSI", "indicatorPeriod": 14, "comparison": "gte", "value": 70}
  ]
}

사용자: "EMA5가 EMA20을 상향돌파하면 매수, 하향돌파하면 매도"
응답:
{
  "buyConditions": [
    {"id": "cond_1", "templateType": "indicator_cross", "indicator": "EMA", "indicatorPeriod": 5, "targetIndicator": "EMA", "targetPeriod": 20, "crossDirection": "above"}
  ],
  "sellConditions": [
    {"id": "cond_2", "templateType": "indicator_cross", "indicator": "EMA", "indicatorPeriod": 5, "targetIndicator": "EMA", "targetPeriod": 20, "crossDirection": "below"}
  ]
}"""

    def _get_tool_schema(self) -> list[dict[str, Any]]:
        """Function Calling 도구 스키마 반환"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "create_backtest_conditions",
                    "description": "사용자의 자연어 전략을 매수/매도 조건으로 변환",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "buyConditions": {
                                "type": "array",
                                "description": "매수 조건 목록",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "string"},
                                        "templateType": {
                                            "type": "string",
                                            "enum": [
                                                "indicator_vs_value",
                                                "indicator_cross",
                                                "price_cross",
                                                "profit_loss",
                                                "band_touch",
                                                "macd_signal",
                                                "stochastic",
                                            ],
                                        },
                                        "indicator": {
                                            "type": "string",
                                            "enum": ["RSI", "SMA", "EMA", "MACD", "BB", "STOCH"],
                                        },
                                        "indicatorPeriod": {"type": "integer"},
                                        "targetIndicator": {
                                            "type": "string",
                                            "enum": ["RSI", "SMA", "EMA", "MACD", "BB", "STOCH"],
                                        },
                                        "targetPeriod": {"type": "integer"},
                                        "comparison": {
                                            "type": "string",
                                            "enum": ["gt", "lt", "gte", "lte"],
                                        },
                                        "crossDirection": {
                                            "type": "string",
                                            "enum": ["above", "below"],
                                        },
                                        "value": {"type": "number"},
                                        "priceType": {
                                            "type": "string",
                                            "enum": ["close", "high", "low", "open"],
                                        },
                                        "profitDirection": {
                                            "type": "string",
                                            "enum": ["profit", "loss"],
                                        },
                                        "bandType": {"type": "string", "enum": ["bollinger"]},
                                        "bandPosition": {
                                            "type": "string",
                                            "enum": ["upper", "middle", "lower"],
                                        },
                                        "touchType": {
                                            "type": "string",
                                            "enum": ["touch", "cross", "exit"],
                                        },
                                        "nextOperator": {"type": "string", "enum": ["AND", "OR"]},
                                    },
                                    "required": ["id", "templateType"],
                                },
                            },
                            "sellConditions": {
                                "type": "array",
                                "description": "매도 조건 목록",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "string"},
                                        "templateType": {
                                            "type": "string",
                                            "enum": [
                                                "indicator_vs_value",
                                                "indicator_cross",
                                                "price_cross",
                                                "profit_loss",
                                                "band_touch",
                                                "macd_signal",
                                                "stochastic",
                                            ],
                                        },
                                        "indicator": {
                                            "type": "string",
                                            "enum": ["RSI", "SMA", "EMA", "MACD", "BB", "STOCH"],
                                        },
                                        "indicatorPeriod": {"type": "integer"},
                                        "targetIndicator": {
                                            "type": "string",
                                            "enum": ["RSI", "SMA", "EMA", "MACD", "BB", "STOCH"],
                                        },
                                        "targetPeriod": {"type": "integer"},
                                        "comparison": {
                                            "type": "string",
                                            "enum": ["gt", "lt", "gte", "lte"],
                                        },
                                        "crossDirection": {
                                            "type": "string",
                                            "enum": ["above", "below"],
                                        },
                                        "value": {"type": "number"},
                                        "priceType": {
                                            "type": "string",
                                            "enum": ["close", "high", "low", "open"],
                                        },
                                        "profitDirection": {
                                            "type": "string",
                                            "enum": ["profit", "loss"],
                                        },
                                        "bandType": {"type": "string", "enum": ["bollinger"]},
                                        "bandPosition": {
                                            "type": "string",
                                            "enum": ["upper", "middle", "lower"],
                                        },
                                        "touchType": {
                                            "type": "string",
                                            "enum": ["touch", "cross", "exit"],
                                        },
                                        "nextOperator": {"type": "string", "enum": ["AND", "OR"]},
                                    },
                                    "required": ["id", "templateType"],
                                },
                            },
                        },
                        "required": ["buyConditions", "sellConditions"],
                    },
                },
            }
        ]

    async def parse_strategy(self, user_prompt: str) -> dict[str, Any]:
        """
        자연어 전략을 SentenceCondition 형태로 변환

        Args:
            user_prompt: 사용자의 자연어 전략 설명

        Returns:
            dict: {"buyConditions": [...], "sellConditions": [...]}

        Raises:
            ValueError: API 키가 설정되지 않았거나 변환 실패 시
        """
        if not OPENAI_API_KEY:
            raise ValueError(
                "OpenAI API 키가 설정되지 않았습니다. 환경변수 OPENAI_API_KEY를 설정해주세요."
            )

        # 캐시 확인
        cache_key = self._get_cache_key(user_prompt)
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            # OpenAI API 호출 (Function Calling)
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self._get_system_prompt()},
                    {"role": "user", "content": user_prompt},
                ],
                tools=self._get_tool_schema(),
                tool_choice={
                    "type": "function",
                    "function": {"name": "create_backtest_conditions"},
                },
            )

            # 응답에서 함수 호출 인자 추출
            tool_call = response.choices[0].message.tool_calls[0]
            result = json.loads(tool_call.function.arguments)

            # 결과 검증
            if not isinstance(result.get("buyConditions"), list):
                result["buyConditions"] = []
            if not isinstance(result.get("sellConditions"), list):
                result["sellConditions"] = []

            # 캐시 저장
            self._cache[cache_key] = result

            return result

        except json.JSONDecodeError as e:
            raise ValueError(f"AI 응답 파싱 실패: {str(e)}") from e
        except Exception as e:
            raise ValueError(f"AI 전략 변환 실패: {str(e)}") from e

    def clear_cache(self):
        """캐시 초기화"""
        self._cache.clear()


# 싱글톤 인스턴스
ai_strategy_service = AIStrategyService()
