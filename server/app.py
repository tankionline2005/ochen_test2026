"""
API of the illustration constructor.

POST /api/compose  — a metaphor or a headline -> which library objects express it. The free model on OpenRouter is
                     asked for a strict JSON answer; while it works, its reasoning is streamed to the browser as
                     server-sent events, so the page can show a live status instead of a frozen spinner.
GET  /api/health   — liveness and the model in use.

The model only *chooses* objects from the fixed list (ids below); it never draws anything. The layout and the
colours are done in the browser from the original SVGs.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections import defaultdict, deque
from typing import AsyncIterator, Literal

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

log = logging.getLogger("ochen")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
MODEL = os.environ.get("OPENROUTER_MODEL", "nvidia/nemotron-3.5-super-vl:free")
SITE = os.environ.get("SITE_URL", "https://beyondbirthday.cc")
MODEL_TIMEOUT = float(os.environ.get("MODEL_TIMEOUT", "90"))

# the library: ids the model may answer with, and what each object can stand for
OBJECTS: dict[str, str] = {
    "book": "раскрытая книга — знания, обучение, инструкция, история, правила, опыт",
    "phone": "смартфон — связь, приложение, онлайн-сервис, уведомления, мобильный банк, цифровое",
    "puzzle": "два кусочка пазла — решение задачи, командная работа, партнёрство, интеграция, недостающая часть",
    "coin": "монета с замком — деньги, сбережения, безопасность платежей, защита, цена, доход",
    "headphones": "наушники — звук, музыка, подкаст, поддержка, концентрация, отдых",
    "lamp": "настольная лампа — идея, озарение, работа и учёба, фокус, рабочее место",
    "vase": "ваза с тюльпанами — праздник, подарок, забота, уют, весна, благодарность",
    "wallet": "кошелёк — личные финансы, бюджет, покупки, кэшбэк, расходы, накопления",
    "folder": "папка с документами — документы, порядок, отчёт, договор, архив, офис",
    "pen": "ручка — подпись, договор, заметки, письмо, творчество, планирование",
}
IDS = list(OBJECTS)

SYSTEM = (
    "Ты арт-директор. По метафоре или заголовку статьи выбираешь предметы из готовой библиотеки изометрических "
    "иллюстраций. Рисовать ничего нельзя — только выбрать из списка:\n"
    + "\n".join(f"- {k}: {v}" for k, v in OBJECTS.items())
    + "\n\nПравила: 1–3 главных предмета (main) — те, что прямо несут смысл; 0–2 фоновых (background) — "
    "поддерживают настроение, обычно крупные или высокие (лампа, ваза, книга, папка). Предмет не может быть и "
    "главным, и фоновым. title — короткое название композиции по-русски (до 5 слов). reason — одно-два "
    "предложения по-русски: почему эти предметы передают смысл. Рассуждай кратко и по-русски."
)

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["main", "background", "title", "reason"],
    "properties": {
        "main": {"type": "array", "items": {"type": "string", "enum": IDS}},
        "background": {"type": "array", "items": {"type": "string", "enum": IDS}},
        "title": {"type": "string"},
        "reason": {"type": "string"},
    },
}

app = FastAPI(title="Ochen illustrations API", docs_url=None, redoc_url=None, openapi_url=None)


class ComposeIn(BaseModel):
    prompt: str = Field(min_length=2, max_length=300)
    mode: Literal["meaning", "names"] = "meaning"


# --- fair use of the free quota: per visitor and for the whole service -------------------------------------------

PER_MINUTE = 6
PER_DAY = 60
TOTAL_PER_DAY = 900  # the account has 1000 free requests a day; keep some for the author's own checks
CONCURRENT = 3

_hits: dict[str, deque[float]] = defaultdict(deque)
_day: deque[float] = deque()
_slots = asyncio.Semaphore(CONCURRENT)


def _client_ip(request: Request) -> str:
    # nginx puts the visitor's address from Cloudflare's CF-Connecting-IP into X-Real-IP
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "?")


def _limit(ip: str) -> str | None:
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > 86400:
        q.popleft()
    while _day and now - _day[0] > 86400:
        _day.popleft()
    if sum(1 for t in q if now - t < 60) >= PER_MINUTE:
        return "Слишком часто: не больше шести запросов к ИИ в минуту. Подождите немного."
    if len(q) >= PER_DAY:
        return "Дневной лимит запросов к ИИ с этого адреса исчерпан — режим «По названиям» работает без ограничений."
    if len(_day) >= TOTAL_PER_DAY:
        return "Сервис израсходовал дневную квоту бесплатной модели. Попробуйте завтра или соберите по названиям."
    q.append(now)
    _day.append(now)
    return None


# --- the model -------------------------------------------------------------------------------------------------------

def sse(event: dict) -> bytes:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n".encode()


HUMAN_ERRORS = {
    401: "Ключ OpenRouter не принят — проверьте настройки сервера.",
    402: "У ключа OpenRouter закончился лимит.",
    429: "Бесплатная модель перегружена или исчерпан лимит запросов. Попробуйте через минуту.",
    502: "Провайдер модели не ответил.",
    503: "Модель временно недоступна.",
}


def clean_result(raw: str) -> dict:
    """The model's JSON -> objects that exist, no duplicates between roles, sane counts."""
    start, end = raw.find("{"), raw.rfind("}")
    data = json.loads(raw[start : end + 1] if start >= 0 else raw)
    main = [i for i in dict.fromkeys(data.get("main") or []) if i in OBJECTS][:3]
    bg = [i for i in dict.fromkeys(data.get("background") or []) if i in OBJECTS and i not in main][:2]
    if not main and bg:
        main, bg = bg[:1], bg[1:]
    if not main:
        raise ValueError("в ответе нет ни одного предмета из библиотеки")
    picks = [{"id": i, "state": "main"} for i in main] + [{"id": i, "state": "bg"} for i in bg]
    return {
        "type": "result",
        "picks": picks,
        "title": str(data.get("title") or "")[:80],
        "reason": str(data.get("reason") or "")[:400],
        "model": MODEL,
    }


async def ask_model(prompt: str) -> AsyncIterator[bytes]:
    started = time.monotonic()
    if _slots.locked():
        yield sse({"type": "stage", "stage": "queued", "text": "Жду своей очереди к бесплатной модели"})
    async with _slots:
        body = {
            "model": MODEL,
            "stream": True,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"Метафора или заголовок: «{prompt}»\n\nДумай на русском языке, коротко."},
            ],
            "response_format": {"type": "json_schema", "json_schema": {"name": "composition", "strict": True, "schema": SCHEMA}},
            # the thoughts are shown live, but they must leave room for the answer itself
            "reasoning": {"max_tokens": 900},
            "temperature": 0.4,
            "max_tokens": 3000,
        }
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "HTTP-Referer": SITE,
            "X-Title": "Ochen illustrations (test task)",
        }
        content = ""
        thinking_sent = False
        answer_sent = False
        pending = ""
        last_flush = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(MODEL_TIMEOUT, connect=10)) as client:
                async with client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", json=body, headers=headers) as r:
                    if r.status_code != 200:
                        detail = (await r.aread()).decode(errors="replace")[:300]
                        log.warning("openrouter %s: %s", r.status_code, detail)
                        yield sse({"type": "error", "detail": HUMAN_ERRORS.get(r.status_code, f"OpenRouter ответил {r.status_code}")})
                        return
                    yield sse({"type": "stage", "stage": "sent", "text": "Модель NVIDIA Nemotron приняла запрос"})
                    async for line in r.aiter_lines():
                        if not line.startswith("data:"):
                            continue  # ": OPENROUTER PROCESSING" keep-alives
                        payload = line[5:].strip()
                        if payload == "[DONE]":
                            break
                        try:
                            chunk = json.loads(payload)
                        except json.JSONDecodeError:
                            continue
                        if "error" in chunk:
                            msg = chunk["error"].get("message", "ошибка модели") if isinstance(chunk["error"], dict) else str(chunk["error"])
                            yield sse({"type": "error", "detail": f"Модель прервала ответ: {msg}"[:300]})
                            return
                        delta = (chunk.get("choices") or [{}])[0].get("delta") or {}
                        thought = delta.get("reasoning") or ""
                        if thought:
                            if not thinking_sent:
                                thinking_sent = True
                                yield sse({"type": "stage", "stage": "thinking"})
                            pending += thought
                            # a few updates a second are enough for the eye and spare the connection
                            if time.monotonic() - last_flush > 0.15:
                                yield sse({"type": "thinking", "text": pending})
                                pending, last_flush = "", time.monotonic()
                        if delta.get("content"):
                            if pending:
                                yield sse({"type": "thinking", "text": pending})
                                pending = ""
                            if not answer_sent:
                                answer_sent = True
                                yield sse({"type": "stage", "stage": "answer"})
                            content += delta["content"]
        except httpx.TimeoutException:
            yield sse({"type": "error", "detail": f"Модель не ответила за {int(MODEL_TIMEOUT)} секунд"})
            return
        except httpx.HTTPError as e:
            log.warning("openrouter transport: %r", e)
            yield sse({"type": "error", "detail": "Не удалось связаться с OpenRouter"})
            return

    try:
        result = clean_result(content)
    except (ValueError, json.JSONDecodeError) as e:
        log.warning("bad model answer: %r / %s", e, content[:300])
        yield sse({"type": "error", "detail": "Модель ответила не по формату"})
        return
    result["seconds"] = round(time.monotonic() - started, 1)
    log.info("compose ok in %ss: %s", result["seconds"], [p["id"] + ("*" if p["state"] == "bg" else "") for p in result["picks"]])
    yield sse(result)


@app.post("/api/compose")
async def compose(data: ComposeIn, request: Request):
    if not API_KEY:
        return JSONResponse({"detail": "На сервере не задан ключ OpenRouter"}, status_code=503)
    refusal = _limit(_client_ip(request))
    if refusal:
        return JSONResponse({"detail": refusal}, status_code=429)
    log.info("compose: %d chars from %s", len(data.prompt), _client_ip(request))
    return StreamingResponse(
        ask_model(data.prompt.strip()),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/health")
async def health():
    return {"ok": True, "model": MODEL, "key": bool(API_KEY)}
