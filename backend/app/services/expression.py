"""커스텀 지표 식 - Pine 문법 부분집합의 파서·평가기

사용자가 TradingView Pine 식을 복붙하듯 적으면 우리 지표 함수로 평가한다.

    ta.rsi(close, 14) < 30 and close > ta.sma(close, 50)
    ta.ema(close, 20) + 2 * ta.atr(14)
    (close - ta.sma(close, 20)) / ta.stdev(close, 20)
    ta.crossover(ta.wma(close, 10), ta.sma(close, 30))
    close > close[1]                      # [n] 은 n 봉 전 값

코드를 실행하지 않는다. 파이썬 ast 로 파싱한 뒤 허용된 노드만 남기고
(함수는 ta.* / math.* 화이트리스트, 시리즈는 OHLCV 파생만) pandas 연산으로
직접 평가한다. import 도, 루프도, 이름 접근도 없다.

지원하는 것
- 시리즈: open, high, low, close, volume, hl2, hlc3, ohlc4
- ta.*: sma, ema, wma, rsi, atr, stdev, highest, lowest, change,
  crossover, crossunder, vwap  (시그니처는 Pine 과 같게)
- math.*: abs, max, min, log, sqrt
- 산술 + - * / % **, 비교 > < >= <= == !=, 논리 and or not, 괄호
- [n] 과거 참조 (양의 정수 리터럴)

지원하지 않는 것 (Pine 전체가 아니다)
- var 상태 변수, for/while, ?: 삼항, request.security, plot, strategy.*
"""

from __future__ import annotations

import ast
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.services import indicators

MAX_LENGTH = 500  # 식 최대 길이 (문자)
MAX_NODES = 200  # AST 노드 수 상한
MAX_HISTORY = 500  # [n] 최대
MAX_PERIOD = 1000  # ta 함수 기간 인자 최대


class ExpressionError(ValueError):
    """식이 문법·화이트리스트를 벗어났을 때"""


# ---------------------------------------------------------------------------
# 어휘: 시리즈와 함수
# ---------------------------------------------------------------------------


def _series_vocab(df: pd.DataFrame) -> dict[str, pd.Series]:
    o, h, low, c = df["open"], df["high"], df["low"], df["close"]
    return {
        "open": o,
        "high": h,
        "low": low,
        "close": c,
        "volume": df["volume"],
        "hl2": (h + low) / 2,
        "hlc3": (h + low + c) / 3,
        "ohlc4": (o + h + low + c) / 4,
    }


@dataclass(frozen=True)
class _Fn:
    """ta.* 함수 하나. arity 는 (최소, 최대) 인자 수, periods 는 기간 인자 위치"""

    call: Callable
    arity: tuple[int, int]
    period_args: tuple[int, ...]  # warmup 계산에 쓰는 인자 인덱스 (정수 리터럴이어야 함)


def _ta_vocab(df: pd.DataFrame) -> dict[str, _Fn]:
    h, low, c, v = df["high"], df["low"], df["close"], df["volume"]
    return {
        # Pine 시그니처: ta.sma(source, length)
        "sma": _Fn(lambda s, n: indicators.sma(s, int(n)), (2, 2), (1,)),
        "ema": _Fn(lambda s, n: indicators.ema(s, int(n)), (2, 2), (1,)),
        "wma": _Fn(lambda s, n: indicators.wma(s, int(n)), (2, 2), (1,)),
        "rsi": _Fn(lambda s, n: indicators.rsi(s, int(n)), (2, 2), (1,)),
        "stdev": _Fn(lambda s, n: indicators.stdev(s, int(n)), (2, 2), (1,)),
        "highest": _Fn(lambda s, n: indicators.highest(s, int(n)), (2, 2), (1,)),
        "lowest": _Fn(lambda s, n: indicators.lowest(s, int(n)), (2, 2), (1,)),
        "change": _Fn(lambda s, n=1: indicators.change(s, int(n)), (1, 2), (1,)),
        "crossover": _Fn(indicators.crossover, (2, 2), ()),
        "crossunder": _Fn(indicators.crossunder, (2, 2), ()),
        # Pine 의 ta.atr(length) 처럼 가격은 자동으로 쓴다
        "atr": _Fn(lambda n: indicators.atr(h, low, c, int(n)), (1, 1), (0,)),
        # 롤링 VWAP (암호화폐는 세션이 없어 N 봉 기준)
        "vwap": _Fn(lambda n: indicators.vwap(h, low, c, v, int(n)), (1, 1), (0,)),
    }


_MATH_VOCAB: dict[str, Callable] = {
    "abs": lambda x: x.abs() if isinstance(x, pd.Series) else abs(x),
    "max": lambda a, b: np.maximum(a, b),
    "min": lambda a, b: np.minimum(a, b),
    "log": lambda x: np.log(x),
    "sqrt": lambda x: np.sqrt(x),
}

_ALLOWED_BINOPS = {
    ast.Add: lambda a, b: a + b,
    ast.Sub: lambda a, b: a - b,
    ast.Mult: lambda a, b: a * b,
    ast.Div: lambda a, b: a / b,
    ast.Mod: lambda a, b: a % b,
    ast.Pow: lambda a, b: a**b,
}

_ALLOWED_CMPOPS = {
    ast.Gt: lambda a, b: a > b,
    ast.Lt: lambda a, b: a < b,
    ast.GtE: lambda a, b: a >= b,
    ast.LtE: lambda a, b: a <= b,
    ast.Eq: lambda a, b: a == b,
    ast.NotEq: lambda a, b: a != b,
}


def _parse(expression: str) -> ast.expr:
    if not expression or not expression.strip():
        raise ExpressionError("식이 비어 있습니다")
    if len(expression) > MAX_LENGTH:
        raise ExpressionError(f"식이 너무 깁니다 (최대 {MAX_LENGTH}자)")
    try:
        tree = ast.parse(expression.strip(), mode="eval")
    except SyntaxError as e:
        raise ExpressionError(f"문법 오류: {e.msg} (위치 {e.offset})") from None
    if sum(1 for _ in ast.walk(tree)) > MAX_NODES:
        raise ExpressionError("식이 너무 복잡합니다")
    return tree.body


def _fn_name(node: ast.expr) -> tuple[str, str] | None:
    """ta.sma / math.abs 형태면 (네임스페이스, 이름), 아니면 None"""
    if (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id in ("ta", "math")
    ):
        return node.value.id, node.attr
    return None


class _Evaluator:
    """허용된 노드만 재귀 평가한다. 허용 목록 밖은 전부 에러"""

    def __init__(self, df: pd.DataFrame):
        self.series = _series_vocab(df)
        self.ta = _ta_vocab(df)

    def eval(self, node: ast.expr):
        if isinstance(node, ast.Constant):
            if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
                raise ExpressionError(f"숫자만 쓸 수 있습니다: {node.value!r}")
            return node.value

        if isinstance(node, ast.Name):
            if node.id in self.series:
                return self.series[node.id]
            raise ExpressionError(f"모르는 이름: {node.id} (가능: {', '.join(self.series)})")

        if isinstance(node, ast.BinOp):
            op = _ALLOWED_BINOPS.get(type(node.op))
            if op is None:
                raise ExpressionError(f"지원하지 않는 연산: {type(node.op).__name__}")
            return op(self.eval(node.left), self.eval(node.right))

        if isinstance(node, ast.UnaryOp):
            if isinstance(node.op, ast.USub):
                return -self.eval(node.operand)
            if isinstance(node.op, ast.UAdd):
                return self.eval(node.operand)
            if isinstance(node.op, ast.Not):
                return ~self._as_bool(self.eval(node.operand), "not")
            raise ExpressionError(f"지원하지 않는 연산: {type(node.op).__name__}")

        if isinstance(node, ast.Compare):
            if len(node.ops) != 1:
                # a < b < c 는 (a < b) and (b < c) 로 풀어 쓰게 한다
                raise ExpressionError("비교는 한 번에 하나씩 쓰세요 (a < b and b < c)")
            op = _ALLOWED_CMPOPS.get(type(node.ops[0]))
            if op is None:
                raise ExpressionError(f"지원하지 않는 비교: {type(node.ops[0]).__name__}")
            return op(self.eval(node.left), self.eval(node.comparators[0]))

        if isinstance(node, ast.BoolOp):
            parts = [self._as_bool(self.eval(v), "and/or") for v in node.values]
            out = parts[0]
            for p in parts[1:]:
                out = (out & p) if isinstance(node.op, ast.And) else (out | p)
            return out

        if isinstance(node, ast.Subscript):
            # close[1] = 1봉 전 값
            n = node.slice
            if not (isinstance(n, ast.Constant) and isinstance(n.value, int) and n.value >= 0):
                raise ExpressionError("[] 안에는 0 이상의 정수만 쓸 수 있습니다 (예: close[1])")
            if n.value > MAX_HISTORY:
                raise ExpressionError(f"[] 은 최대 {MAX_HISTORY}까지입니다")
            base = self.eval(node.value)
            if not isinstance(base, pd.Series):
                raise ExpressionError("[] 은 시리즈에만 쓸 수 있습니다")
            return base.shift(n.value)

        if isinstance(node, ast.Call):
            name = _fn_name(node.func)
            if name is None:
                raise ExpressionError(
                    "함수는 ta.* 또는 math.* 만 쓸 수 있습니다 (예: ta.sma(close, 20))"
                )
            if node.keywords:
                raise ExpressionError("키워드 인자는 쓸 수 없습니다")
            ns, fn = name
            args = [self.eval(a) for a in node.args]
            if ns == "math":
                f = _MATH_VOCAB.get(fn)
                if f is None:
                    raise ExpressionError(
                        f"모르는 함수: math.{fn} (가능: {', '.join(_MATH_VOCAB)})"
                    )
                return f(*args)
            spec = self.ta.get(fn)
            if spec is None:
                raise ExpressionError(f"모르는 함수: ta.{fn} (가능: {', '.join(self.ta)})")
            lo, hi = spec.arity
            if not (lo <= len(args) <= hi):
                raise ExpressionError(f"ta.{fn} 인자 수가 틀렸습니다 ({lo}~{hi}개)")
            for i in spec.period_args:
                if i < len(args):
                    v = args[i]
                    if not isinstance(v, (int, float)) or not float(v).is_integer():
                        raise ExpressionError(f"ta.{fn} 의 기간 인자는 정수 리터럴이어야 합니다")
                    if not (1 <= int(v) <= MAX_PERIOD):
                        raise ExpressionError(f"ta.{fn} 기간은 1~{MAX_PERIOD} 사이여야 합니다")
            return spec.call(*args)

        raise ExpressionError(f"지원하지 않는 문법: {type(node).__name__}")

    @staticmethod
    def _as_bool(value, where: str) -> pd.Series:
        if isinstance(value, pd.Series) and value.dtype == bool:
            return value
        raise ExpressionError(f"{where} 양쪽은 참/거짓 식이어야 합니다 (비교를 먼저 하세요)")


def _estimate_warmup(node: ast.expr) -> int:
    """식이 안정되는 데 필요한 앞 구간 봉 수 (중첩은 합산, 형제는 최대)"""
    if isinstance(node, ast.Call) and _fn_name(node.func):
        ns, fn = _fn_name(node.func)  # type: ignore[misc]
        own = 0
        if ns == "ta":
            for a in node.args:
                if isinstance(a, ast.Constant) and isinstance(a.value, (int, float)):
                    own = max(own, int(a.value))
        return own + max((_estimate_warmup(a) for a in node.args), default=0)
    if isinstance(node, ast.Subscript):
        n = node.slice
        shift = n.value if isinstance(n, ast.Constant) and isinstance(n.value, int) else 0
        return shift + _estimate_warmup(node.value)
    return max((_estimate_warmup(c) for c in ast.iter_child_nodes(node)), default=0)


# ---------------------------------------------------------------------------
# 공개 API
# ---------------------------------------------------------------------------


def evaluate(df: pd.DataFrame, expression: str) -> pd.Series:
    """식을 평가해 Series 를 돌려준다 (숫자 또는 불리언). 틀리면 ExpressionError"""
    result = _Evaluator(df).eval(_parse(expression))
    if isinstance(result, (int, float)):
        # 상수식이면 시리즈로 넓힌다
        return pd.Series(float(result), index=df.index)
    return result


def evaluate_signal(df: pd.DataFrame, expression: str) -> pd.Series:
    """조건용: 반드시 불리언이어야 한다. NaN 구간은 False"""
    result = evaluate(df, expression)
    if result.dtype != bool:
        raise ExpressionError(
            "조건 식은 참/거짓으로 끝나야 합니다 (예: ta.rsi(close,14) < 30). 지금 식은 숫자입니다"
        )
    return result.fillna(False)


def validate(expression: str) -> dict:
    """UI 검증용. 작은 더미 데이터로 실제 평가까지 해본다

    Returns:
        {ok, kind: "boolean"|"numeric", warmup} 또는 {ok: False, error}
    """
    try:
        node = _parse(expression)
        warmup = _estimate_warmup(node)
        n = min(max(warmup * 2 + 10, 30), 5000)
        rng = np.random.default_rng(0)
        close = 100 + np.cumsum(rng.normal(0, 1, n))
        df = pd.DataFrame(
            {
                "open": close,
                "high": close + rng.uniform(0.1, 1, n),
                "low": close - rng.uniform(0.1, 1, n),
                "close": close,
                "volume": rng.uniform(1, 10, n),
            },
            index=pd.date_range("2020-01-01", periods=n, freq="D"),
        )
        result = _Evaluator(df).eval(node)
        kind = "boolean" if isinstance(result, pd.Series) and result.dtype == bool else "numeric"
        return {"ok": True, "kind": kind, "warmup": warmup}
    except ExpressionError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:  # 평가 중 예상 밖 오류도 사용자에게는 검증 실패로
        return {"ok": False, "error": f"평가 실패: {e}"}


def estimate_warmup(expression: str) -> int:
    """엔진의 warmup 계산용. 파싱만 하고 평가는 하지 않는다"""
    return _estimate_warmup(_parse(expression))


# ---------------------------------------------------------------------------
# 차트 미리보기: 식에서 그릴 만한 숫자 부분식 뽑기
# ---------------------------------------------------------------------------

_PRICE_NAMES = {"open", "high", "low", "close", "hl2", "hlc3", "ohlc4"}
_PRICE_FUNCS = {"sma", "ema", "wma", "highest", "lowest"}  # 첫 인자가 가격이면 가격 스케일


def _is_price_scaled(node: ast.expr) -> bool:
    """이 부분식이 가격과 같은 스케일인가 (오버레이로 그릴 수 있는가)"""
    if isinstance(node, ast.Name):
        return node.id in _PRICE_NAMES
    if isinstance(node, ast.Subscript):
        return _is_price_scaled(node.value)
    if isinstance(node, ast.UnaryOp):
        return _is_price_scaled(node.operand)
    if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub)):
        # 가격 ± 오프셋 (예: ta.ema(close,20) + 2*ta.atr(20)) 은 가격 스케일
        return _is_price_scaled(node.left) or _is_price_scaled(node.right)
    if isinstance(node, ast.Call):
        name = _fn_name(node.func)
        if name is None:
            return False
        ns, fn = name
        if ns == "ta" and fn == "vwap":
            return True
        if ns == "ta" and fn in _PRICE_FUNCS and node.args:
            return _is_price_scaled(node.args[0])
        if ns == "math" and fn in ("max", "min"):
            return any(_is_price_scaled(a) for a in node.args)
    return False


def _is_bare_series(node: ast.expr) -> bool:
    """close, close[1] 같은 원시 시리즈 (캔들이 이미 보여주므로 안 그린다)"""
    if isinstance(node, ast.Name):
        return True
    if isinstance(node, ast.Subscript):
        return _is_bare_series(node.value)
    return False


def _collect_plot_nodes(node: ast.expr, out: list[tuple[ast.expr, float | None]]) -> None:
    """불리언 구조를 따라 내려가며 비교의 피연산자(숫자 식)를 모은다

    상수와 비교했다면 그 상수를 수평 보조선 값으로 같이 담는다.
    """
    if isinstance(node, ast.BoolOp):
        for v in node.values:
            _collect_plot_nodes(v, out)
        return
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        _collect_plot_nodes(node.operand, out)
        return
    if isinstance(node, ast.Compare) and len(node.ops) == 1:
        left, right = node.left, node.comparators[0]
        left_const = isinstance(left, ast.Constant)
        right_const = isinstance(right, ast.Constant)
        if left_const and right_const:
            return
        if right_const:
            out.append((left, float(right.value)))  # type: ignore[union-attr]
        elif left_const:
            out.append((right, float(left.value)))  # type: ignore[union-attr]
        else:
            out.append((left, None))
            out.append((right, None))
        return
    if isinstance(node, ast.Call):
        name = _fn_name(node.func)
        if name is not None and name[0] == "ta" and name[1] in ("crossover", "crossunder"):
            for a in node.args:
                if not isinstance(a, ast.Constant):
                    out.append((a, None))
            return
    # 그 밖(식 전체가 숫자인 경우 등)은 노드 자체를 그린다
    out.append((node, None))


def extract_plot_series(df: pd.DataFrame, expression: str) -> list[dict]:
    """차트에 그릴 숫자 부분식들을 평가해 돌려준다

    ta.rsi(close,14) < 30 이면 RSI 선 하나와 보조선 30. close 같은 원시
    시리즈는 캔들이 이미 보여주므로 건너뛴다. 틀린 식이면 ExpressionError.

    Returns:
        [{label, series, display: "overlay"|"pane", levels: [float]}]
    """
    source = expression.strip()
    tree = _parse(expression)
    pairs: list[tuple[ast.expr, float | None]] = []
    _collect_plot_nodes(tree, pairs)

    evaluator = _Evaluator(df)
    by_label: dict[str, dict] = {}
    for sub, level in pairs:
        if _is_bare_series(sub):
            continue
        result = evaluator.eval(sub)
        if not isinstance(result, pd.Series) or result.dtype == bool:
            continue
        label = ast.get_source_segment(source, sub) or "식"
        entry = by_label.get(label)
        if entry is None:
            entry = {
                "label": label,
                "series": result.astype(float),
                "display": "overlay" if _is_price_scaled(sub) else "pane",
                "levels": set(),
            }
            by_label[label] = entry
        if level is not None:
            entry["levels"].add(level)
    return [{**e, "levels": sorted(e["levels"])} for e in by_label.values()]
