# AI 전략 변환 서비스
# 자연어를 SentenceCondition으로 변환하는 OpenAI Function Calling 활용

import hashlib
import json
import logging
from typing import Any

from openai import AsyncOpenAI

from app.config import OPENAI_API_KEY
from app.core.exceptions import AIServiceError
from app.services import expression as expression_engine
from app.services import indicator_registry as registry
from app.services.ai_errors import translate_provider_error

logger = logging.getLogger(__name__)

INDICATOR_NAMES = list(registry.REGISTRY)
BAND_TYPES = registry.band_types()

PROMPT_TEMPLATE = """당신은 암호화폐 트레이딩 전략을 JSON 조건으로 변환하는 전문가입니다.

사용자의 자연어 전략 설명을 분석하여 매수 조건(buyConditions)과 매도 조건(sellConditions)으로 변환합니다.

## 지원되는 지표
{indicator_lines}

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
   - bandType: {band_types}
   - bandPosition: 'upper', 'middle', 'lower'
   - touchType: 'touch', 'cross', 'exit'

6. macd_signal: MACD 시그널 (예: MACD가 시그널선을 상향돌파)
   - 필수: crossDirection
   - 자동으로 MACD 라인과 시그널 라인의 교차를 감지

7. stochastic: 스토캐스틱 (%K/%D 교차)
   - 필수: crossDirection
   - 자동으로 %K와 %D의 교차를 감지

8. expression: 커스텀 식 (위 1~7로 표현할 수 없을 때만)
   - 필수: expression (Pine 문법 부분집합의 조건식)
   - 시리즈: open, high, low, close, volume, hl2, hlc3, ohlc4
   - 함수: ta.sma/ema/wma/rsi/stdev/highest/lowest/change/crossover/crossunder,
     ta.atr(길이), ta.vwap(길이) — 가격은 자동 / math.abs/max/min/log/sqrt
   - 산술 + - * / % **, 비교 > < >= <= == !=, and/or/not, 괄호, [n] 과거 참조 (close[1] = 1봉 전)
   - 규칙: 반드시 참/거짓으로 끝나는 식 (비교·논리 포함), 기간 인자는 정수 리터럴,
     비교는 한 번에 하나 (a < b and b < c 로 풀어 쓸 것), 지원 밖 함수(supertrend 등) 금지

## 응답 규칙
1. 각 조건에는 고유한 id를 생성 (예: "cond_1", "cond_2")
2. 여러 조건이 있으면 nextOperator로 연결 ('AND' 또는 'OR', 기본: 'AND')
3. 마지막 조건의 nextOperator는 생략하거나 'AND'
4. 매수/매도 조건이 명시되지 않으면 해당 배열을 비워둘 것
5. 지표 기간이 명시되지 않으면 기본값 사용
6. 1~7 템플릿으로 표현되는 전략은 반드시 그 템플릿으로. expression은 마지막 수단

## 예시
사용자: "RSI가 30 아래면 매수하고, 70 이상이면 매도해줘"
응답:
{{
  "buyConditions": [
    {{"id": "cond_1", "templateType": "indicator_vs_value", "indicator": "RSI", "indicatorPeriod": 14, "comparison": "lt", "value": 30}}
  ],
  "sellConditions": [
    {{"id": "cond_2", "templateType": "indicator_vs_value", "indicator": "RSI", "indicatorPeriod": 14, "comparison": "gte", "value": 70}}
  ]
}}

사용자: "EMA5가 EMA20을 상향돌파하면 매수, 하향돌파하면 매도"
응답:
{{
  "buyConditions": [
    {{"id": "cond_1", "templateType": "indicator_cross", "indicator": "EMA", "indicatorPeriod": 5, "targetIndicator": "EMA", "targetPeriod": 20, "crossDirection": "above"}}
  ],
  "sellConditions": [
    {{"id": "cond_2", "templateType": "indicator_cross", "indicator": "EMA", "indicatorPeriod": 5, "targetIndicator": "EMA", "targetPeriod": 20, "crossDirection": "below"}}
  ]
}}

사용자: "종가가 20일 VWAP보다 높으면서 전일보다 오른 날 매수" (1~7로 표현 불가 → expression)
응답:
{{
  "buyConditions": [
    {{"id": "cond_1", "templateType": "expression", "expression": "close > ta.vwap(20) and close > close[1]"}}
  ],
  "sellConditions": []
}}"""


class AIStrategyService:
    """
    자연어 전략을 SentenceCondition 형태로 변환하는 AI 서비스

    OpenAI gpt-4o-mini 모델과 Function Calling을 활용하여
    사용자의 자연어 입력을 구조화된 백테스팅 조건으로 변환합니다.
    """

    def __init__(self):
        # 키가 없으면 클라이언트 생성 자체가 실패한다. import(싱글톤 생성)는 살려두고
        # 실제 호출(parse_strategy)에서 키 없음 에러를 낸다
        self.client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
        self.model = "gpt-4o-mini"

        # 캐시 (메모리 기반 - 간단한 구현)
        self._cache: dict[str, dict[str, Any]] = {}

    def _get_cache_key(self, prompt: str) -> str:
        """프롬프트를 정규화하여 캐시 키 생성"""
        normalized = " ".join(prompt.lower().split())
        return hashlib.md5(normalized.encode()).hexdigest()

    def _get_system_prompt(self) -> str:
        """시스템 프롬프트 반환 (지표 목록은 레지스트리에서 생성)"""
        indicator_lines = "\n".join(
            f"- {spec.name} ({spec.label}, 파라미터: "
            + ", ".join(f"{p.name}={p.default:g}" for p in spec.params)
            + ")"
            for spec in registry.REGISTRY.values()
            if not spec.band_type or spec.name == "BB"
        )
        band_types = ", ".join(f"'{b}'" for b in registry.band_types())
        return PROMPT_TEMPLATE.format(indicator_lines=indicator_lines, band_types=band_types)

    def _get_tool_schema(self) -> list[dict[str, Any]]:
        """Function Calling 도구 스키마 반환 (조건 정의는 매수·매도 공용)"""
        condition_item = {
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
                        "expression",
                    ],
                },
                "indicator": {
                    "type": "string",
                    "enum": INDICATOR_NAMES,
                },
                "indicatorPeriod": {"type": "integer"},
                "params": {
                    "type": "object",
                    "description": "지표 파라미터 (예: MACD {fast,slow,signal}, BB {period,std})",
                    "additionalProperties": {"type": "number"},
                },
                "targetIndicator": {
                    "type": "string",
                    "enum": INDICATOR_NAMES,
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
                "bandType": {"type": "string", "enum": BAND_TYPES},
                "bandPosition": {
                    "type": "string",
                    "enum": ["upper", "middle", "lower"],
                },
                "touchType": {
                    "type": "string",
                    "enum": ["touch", "cross", "exit"],
                },
                "expression": {
                    "type": "string",
                    "description": "templateType=expression 일 때: 참/거짓으로 끝나는 커스텀 식 (예: ta.rsi(close, 14) < 30)",
                },
                "nextOperator": {"type": "string", "enum": ["AND", "OR"]},
            },
            "required": ["id", "templateType"],
        }
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
                                "items": condition_item,
                            },
                            "sellConditions": {
                                "type": "array",
                                "description": "매도 조건 목록",
                                "items": condition_item,
                            },
                        },
                        "required": ["buyConditions", "sellConditions"],
                    },
                },
            }
        ]

    async def _request_conditions(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        """모델을 한 번 호출해 조건 dict 를 받는다"""
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=self._get_tool_schema(),
            tool_choice={
                "type": "function",
                "function": {"name": "create_backtest_conditions"},
            },
        )
        tool_call = response.choices[0].message.tool_calls[0]
        result = json.loads(tool_call.function.arguments)
        if not isinstance(result.get("buyConditions"), list):
            result["buyConditions"] = []
        if not isinstance(result.get("sellConditions"), list):
            result["sellConditions"] = []
        return result

    @staticmethod
    def _expression_errors(result: dict[str, Any]) -> list[str]:
        """expression 조건의 식을 전부 검증한다. 문제가 없으면 빈 목록"""
        errors = []
        for side in ("buyConditions", "sellConditions"):
            for cond in result.get(side, []):
                if not isinstance(cond, dict) or cond.get("templateType") != "expression":
                    continue
                expr = cond.get("expression") or ""
                verdict = expression_engine.validate(expr)
                if not verdict["ok"]:
                    errors.append(f"{expr!r}: {verdict['error']}")
                elif verdict["kind"] != "boolean":
                    errors.append(f"{expr!r}: 조건 식은 참/거짓으로 끝나야 합니다 (지금은 숫자)")
        return errors

    async def parse_strategy(self, user_prompt: str) -> dict[str, Any]:
        """
        자연어 전략을 SentenceCondition 형태로 변환

        expression 조건이 있으면 식 엔진으로 검증하고, 틀렸으면 오류를 알려주며
        한 번 다시 시킨다. 그래도 틀리면 실패로 처리한다.

        Args:
            user_prompt: 사용자의 자연어 전략 설명

        Returns:
            dict: {"buyConditions": [...], "sellConditions": [...]}

        Raises:
            ValueError: AI 가 만든 식이 재시도 후에도 검증을 통과하지 못했을 때
            AIServiceError: 키 미설정, 프로바이더 호출 실패 등 서버·외부 문제일 때
        """
        if not OPENAI_API_KEY:
            # 사용자가 고칠 수 있는 문제가 아니므로 서버 설정 오류로 알린다
            logger.error("OPENAI_API_KEY 가 비어 있어 AI 전략 변환을 할 수 없습니다")
            raise AIServiceError("AI 기능이 설정되지 않았습니다. 서버 관리자에게 문의해주세요.", 503)

        # 캐시 확인 (검증까지 통과한 결과만 캐시에 있다)
        cache_key = self._get_cache_key(user_prompt)
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            messages = [
                {"role": "system", "content": self._get_system_prompt()},
                {"role": "user", "content": user_prompt},
            ]
            result = await self._request_conditions(messages)

            errors = self._expression_errors(result)
            if errors:
                # 식이 틀렸으면 오류를 보여주고 한 번 고치게 한다
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            "방금 변환한 결과입니다:\n"
                            + json.dumps(result, ensure_ascii=False)
                            + "\n\n다음 식이 검증에 실패했습니다:\n"
                            + "\n".join(f"- {e}" for e in errors)
                            + "\n\n오류를 고쳐 전체 조건을 다시 만들어 주세요."
                        ),
                    }
                )
                result = await self._request_conditions(messages)
                errors = self._expression_errors(result)

            if errors:
                raise ValueError(f"AI가 만든 식이 올바르지 않습니다: {errors[0]}")

            # 캐시 저장
            self._cache[cache_key] = result

            return result

        except json.JSONDecodeError as e:
            logger.exception("AI 응답 JSON 파싱 실패")
            raise AIServiceError("AI 응답을 해석하지 못했습니다. 다시 시도해주세요.", 502) from e
        except (ValueError, AIServiceError):
            # 우리가 만든 문구라 그대로 내보내도 된다
            raise
        except Exception as e:
            # 프로바이더 응답 본문은 로그에만 남기고 사용자에게는 우리 문구를 준다
            logger.exception("AI 전략 변환 실패")
            raise translate_provider_error(e, "AI 전략 변환") from e

    def clear_cache(self):
        """캐시 초기화"""
        self._cache.clear()


# 싱글톤 인스턴스
ai_strategy_service = AIStrategyService()
