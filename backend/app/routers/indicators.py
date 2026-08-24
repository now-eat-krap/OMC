"""지표 목록 API

프론트가 선택지·파라미터·기본값·차트 힌트를 여기서 받아간다. 하드코딩하지 않는다.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import expression as expression_engine
from app.services import indicator_registry as registry

router = APIRouter()


class ExpressionRequest(BaseModel):
    expression: str = Field(..., max_length=500, description="Pine 부분집합 식")


@router.get("/indicators")
async def list_indicators():
    """레지스트리에 등록된 지표 전체

    각 항목: name, label, description, display(overlay|pane), valueRange, templates
    (이 지표를 고를 수 있는 templateType 들), bandType, params[{name,label,default,min,
    max,step,integer}], outputs[{key,label,role}]
    """
    return {"indicators": registry.public_list()}


@router.post("/indicators/validate-expression")
async def validate_expression(body: ExpressionRequest):
    """커스텀 식 검증

    파싱 + 화이트리스트 검사 + 더미 데이터로 실제 평가까지 해봅니다.
    조건으로 쓰려면 kind 가 "boolean" 이어야 합니다.

    응답: {ok: true, kind: "boolean"|"numeric", warmup} 또는 {ok: false, error}
    """
    return expression_engine.validate(body.expression)
