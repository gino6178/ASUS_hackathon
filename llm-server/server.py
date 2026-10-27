"""ShuttleCoach LLM server: an OpenVINO GenAI model behind an OpenAI-compatible API.

Runs on the inference server (the ASUS UGen Arc Pro B70, DEVICE=GPU) or on any PC for development
(DEVICE=CPU). The agent gateway talks to it like any OpenAI-style endpoint, so the model or device can change
without touching the app.

    MODEL_DIR=models/Qwen3-4B-int4-ov DEVICE=GPU uvicorn server:app --host 0.0.0.0 --port 8000

Endpoints: GET /health, GET /v1/models, POST /v1/chat/completions (stream or not).
"""
import json
import os
import queue
import re
import threading
import time
import uuid

import openvino_genai as ov_genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(os.path.dirname(__file__), "models", "Qwen3-4B-int4-ov"))
DEVICE = os.environ.get("DEVICE", "GPU")
MODEL_NAME = os.environ.get("MODEL_NAME", os.path.basename(MODEL_DIR.rstrip("/\\")))
THINK = re.compile(r"<think>.*?</think>\s*", re.S)

app = FastAPI(title="ShuttleCoach LLM server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

state = {"pipe": None, "device": None, "loaded_s": None, "error": None}
lock = threading.Lock()  # one model, one generation at a time; the gateway queues behind it


def load():
    t0 = time.time()
    devices = [DEVICE] + ([] if DEVICE == "CPU" else ["CPU"])
    for dev in devices:  # fall back to CPU when the requested accelerator is missing
        try:
            state["pipe"] = ov_genai.LLMPipeline(MODEL_DIR, dev)
            state["device"], state["loaded_s"], state["error"] = dev, round(time.time() - t0, 1), None
            return
        except Exception as e:  # noqa: BLE001 - report and try the next device
            state["error"] = f"{dev}: {e}"


class Msg(BaseModel):
    role: str
    content: str


class ChatReq(BaseModel):
    model: str | None = None
    messages: list[Msg]
    max_tokens: int | None = 300
    temperature: float | None = 0.4
    stream: bool | None = False
    think: bool | None = False  # Qwen3 reasoning mode: off by default, coaching replies need to be fast


def prompt_for(req: ChatReq) -> str:
    msgs = [m.model_dump() for m in req.messages]
    if not req.think and msgs and msgs[-1]["role"] == "user":
        msgs[-1]["content"] += " /no_think"
    tok = state["pipe"].get_tokenizer()
    return tok.apply_chat_template(msgs, add_generation_prompt=True)


def config_for(req: ChatReq):
    cfg = ov_genai.GenerationConfig()
    cfg.max_new_tokens = req.max_tokens or 300
    if req.temperature and req.temperature > 0:
        cfg.do_sample, cfg.temperature, cfg.top_p = True, req.temperature, 0.9
    if hasattr(cfg, "apply_chat_template"):
        cfg.apply_chat_template = False  # the prompt above is already templated
    return cfg


@app.on_event("startup")
def startup():
    threading.Thread(target=load, daemon=True).start()


@app.get("/health")
def health():
    return {"ready": state["pipe"] is not None, "model": MODEL_NAME, "device": state["device"],
            "load_seconds": state["loaded_s"], "error": state["error"]}


@app.get("/v1/models")
def models():
    return {"object": "list", "data": [{"id": MODEL_NAME, "object": "model", "owned_by": "shuttlecoach"}]}


@app.post("/v1/chat/completions")
def chat(req: ChatReq):
    if state["pipe"] is None:
        raise HTTPException(503, f"model not loaded yet ({state['error'] or 'loading'})")
    prompt, cfg, rid = prompt_for(req), config_for(req), "chatcmpl-" + uuid.uuid4().hex[:12]

    if not req.stream:
        with lock:
            t0 = time.time()
            res = state["pipe"].generate([prompt], cfg)
            dt = time.time() - t0
        text = THINK.sub("", res.texts[0]).strip()
        pm = res.perf_metrics
        n_out = int(pm.get_num_generated_tokens()) if hasattr(pm, "get_num_generated_tokens") else len(text.split())
        return {"id": rid, "object": "chat.completion", "created": int(time.time()), "model": MODEL_NAME,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
                "usage": {"completion_tokens": n_out},
                "timing": {"seconds": round(dt, 2), "tokens_per_s": round(n_out / dt, 1) if dt else None, "device": state["device"]}}

    q: queue.Queue = queue.Queue()

    def streamer(piece: str):
        q.put(piece)
        return False  # keep generating

    def work():
        with lock:
            try:
                state["pipe"].generate(prompt, cfg, streamer)
            finally:
                q.put(None)

    threading.Thread(target=work, daemon=True).start()

    def events():
        in_think = False
        while (piece := q.get()) is not None:
            # hide any reasoning block if the model emits one
            if "<think>" in piece: in_think = True
            if in_think:
                if "</think>" in piece: in_think = False
                continue
            chunk = {"id": rid, "object": "chat.completion.chunk", "model": MODEL_NAME,
                     "choices": [{"index": 0, "delta": {"content": piece}, "finish_reason": None}]}
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
