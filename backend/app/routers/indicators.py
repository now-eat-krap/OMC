"""지표 목록 API

프론트가 선택지·파라미터·기본값·차트 힌트를 여기서 받아간다. 하드코딩하지 않는다.
"""

from fastapi import APIRouter

from app.services import indicator_registry as registry

router = APIRouter()


@router.get("/indicators")
async def list_indicators():
    """레지스트리에 등록된 지표 전체

    각 항목: name, label, description, display(overlay|pane), valueRange, templates
    (이 지표를 고를 수 있는 templateType 들), bandType, params[{name,label,default,min,
    max,step,integer}], outputs[{key,label,role}]
    """
    return {"indicators": registry.public_list()}
