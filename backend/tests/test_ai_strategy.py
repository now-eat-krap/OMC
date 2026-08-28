"""AI 전략 변환 테스트 - expression 검증·자가수정 재시도 (OpenAI 는 페이크)"""

import json
from types import SimpleNamespace

import pytest

from app.services import ai_strategy as ai_mod
from app.services.ai_strategy import AIStrategyService


def _response(arguments: dict) -> SimpleNamespace:
    """chat.completions.create 응답 모양 흉내"""
    call = SimpleNamespace(function=SimpleNamespace(arguments=json.dumps(arguments)))
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=[call]))])


class FakeCompletions:
    def __init__(self, results: list[dict]):
        self.results = list(results)
        self.calls: list[list[dict]] = []  # 각 호출의 messages

    async def create(self, *, messages, **kwargs):
        self.calls.append(messages)
        return _response(self.results.pop(0))


def _service(monkeypatch, results: list[dict]) -> tuple[AIStrategyService, FakeCompletions]:
    monkeypatch.setattr(ai_mod, "OPENAI_API_KEY", "test-key")
    service = AIStrategyService.__new__(AIStrategyService)
    service.model = "fake"
    service._cache = {}
    fake = FakeCompletions(results)
    service.client = SimpleNamespace(chat=SimpleNamespace(completions=fake))
    return service, fake


def _cond(expr: str) -> dict:
    return {"id": "cond_1", "templateType": "expression", "expression": expr}


class TestSchemaAndPrompt:
    def test_schema_includes_expression(self):
        service = AIStrategyService.__new__(AIStrategyService)
        schema = service._get_tool_schema()[0]["function"]["parameters"]
        for side in ("buyConditions", "sellConditions"):
            item = schema["properties"][side]["items"]
            assert "expression" in item["properties"]["templateType"]["enum"]
            assert item["properties"]["expression"]["type"] == "string"

    def test_prompt_mentions_expression(self):
        service = AIStrategyService.__new__(AIStrategyService)
        prompt = service._get_system_prompt()
        assert "expression" in prompt and "ta.vwap" in prompt


class TestParseStrategy:
    @pytest.mark.asyncio
    async def test_valid_expression_passes_single_call(self, monkeypatch):
        good = {"buyConditions": [_cond("ta.rsi(close, 14) < 30")], "sellConditions": []}
        service, fake = _service(monkeypatch, [good])
        result = await service.parse_strategy("RSI 30 밑이면 매수")
        assert result == good
        assert len(fake.calls) == 1

    @pytest.mark.asyncio
    async def test_invalid_expression_retries_with_error_feedback(self, monkeypatch):
        bad = {"buyConditions": [_cond("ta.supertrend(close, 10) < 0")], "sellConditions": []}
        good = {"buyConditions": [_cond("ta.rsi(close, 14) < 30")], "sellConditions": []}
        service, fake = _service(monkeypatch, [bad, good])
        result = await service.parse_strategy("수퍼트렌드 전략")
        assert result == good
        assert len(fake.calls) == 2
        # 재시도 메시지에 실패한 식과 검증 오류가 들어간다
        retry_text = fake.calls[1][-1]["content"]
        assert "ta.supertrend" in retry_text and "검증에 실패" in retry_text

    @pytest.mark.asyncio
    async def test_numeric_expression_counts_as_invalid(self, monkeypatch):
        numeric = {"buyConditions": [_cond("ta.sma(close, 20)")], "sellConditions": []}
        good = {"buyConditions": [_cond("close > ta.sma(close, 20)")], "sellConditions": []}
        service, fake = _service(monkeypatch, [numeric, good])
        result = await service.parse_strategy("20일선 위면 매수")
        assert result == good
        assert len(fake.calls) == 2

    @pytest.mark.asyncio
    async def test_still_invalid_after_retry_raises(self, monkeypatch):
        bad = {"buyConditions": [_cond("import os")], "sellConditions": []}
        service, fake = _service(monkeypatch, [bad, bad])
        with pytest.raises(ValueError, match="AI가 만든 식이 올바르지 않습니다"):
            await service.parse_strategy("이상한 전략")
        assert len(fake.calls) == 2
        # 실패한 결과는 캐시에 남지 않는다
        assert service._cache == {}

    @pytest.mark.asyncio
    async def test_structured_conditions_skip_validation(self, monkeypatch):
        good = {
            "buyConditions": [
                {
                    "id": "cond_1",
                    "templateType": "indicator_vs_value",
                    "indicator": "RSI",
                    "indicatorPeriod": 14,
                    "comparison": "lt",
                    "value": 30,
                }
            ],
            "sellConditions": [],
        }
        service, fake = _service(monkeypatch, [good])
        result = await service.parse_strategy("RSI 30 밑이면 매수")
        assert result == good
        assert len(fake.calls) == 1
