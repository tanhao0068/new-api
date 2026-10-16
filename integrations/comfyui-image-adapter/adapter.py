#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ComfyUI 图像适配器 —— 把自建 ComfyUI（Qwen-Image 等）暴露为 OpenAI 兼容图像 API。

作者：CTO Agent
用途：mibi-api 以「OpenAI 渠道」接入本适配器，即可通过标准
      `POST /v1/images/generations` 调用自建文生图模型（复用平台既有鉴权、计费、日志链路）。

设计要点
--------
- **零第三方依赖**：仅用标准库（http.server / urllib），便于在任意环境部署与审计。
- **同步语义**：OpenAI Images API 是同步的 —— 适配器内部提交 ComfyUI 任务并轮询到终态，
  再返回结果（与 new-api 的 `openai_image` 协议语义一致）。
- **产物本地化**：生成图从 ComfyUI `/view` 拉取并缓存到本地目录后对外提供，
  避免把上游内网地址暴露给客户端，也便于后续接入对象存储。
- **可扩展**：`MODELS` 表按模型名声明后端与工作流，新增模型只需加一条（含视频可另配 openai_video 协议）。

接口
----
- `GET  /health`                   健康检查（含 ComfyUI 设备与队列状态）
- `GET  /v1/models`                支持的模型清单
- `POST /v1/images/generations`    OpenAI 兼容文生图
- `GET  /v1/images/{name}`         取生成图（本地缓存）

配置（命令行参数 / 环境变量）
---------------------------
--listen / ADAPTER_LISTEN              监听地址（默认 0.0.0.0）
--port / ADAPTER_PORT                  监听端口（默认 19010）
--public-base-url / ADAPTER_PUBLIC_BASE_URL  返回给客户端的图片 URL 前缀（默认 http://<listen>:<port>）
--cache-dir / ADAPTER_CACHE_DIR        生成图本地缓存目录
--timeout / ADAPTER_TIMEOUT            单次生成超时秒数（默认 600）
--max-concurrency / ADAPTER_MAX_CONCURRENCY  同时提交给 ComfyUI 的任务上限（默认 2）
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# --------------------------------------------------------------------------- #
# 工作流与模型表
# --------------------------------------------------------------------------- #

# Qwen-Image 文生图负向提示词（与远端 chat-app/comfy_client.py 保持一致口径）
NEG_IMAGE_DEFAULT = (
    "低分辨率,低画质,肢体畸形,手指畸形,画面过饱和,蜡像感,人脸无细节,"
    "过度光滑,画面具有AI感,构图混乱,文字模糊,扭曲"
)


def _qwen_image_workflow(prompt: str, negative: str, seed: int, steps: int,
                         width: int, height: int) -> dict:
    """Qwen-Image 文生图工作流（节点与远端验证脚本一致）。"""
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "qwen_image_fp8_e4m3fn.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors", "type": "qwen_image", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": negative}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0],
              "latent_image": ["6", 0], "seed": seed, "steps": steps, "cfg": 1.0,
              "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": "mibi_t2i"}},
    }


# 模型表：对外模型名 → 后端与工作流
# 新增模型：加一条 + （如需）实现对应 workflow 函数
MODELS: dict[str, dict] = {
    "qwen-image": {
        "backend": os.environ.get("ADAPTER_QWEN_BACKEND", "http://192.168.0.43:8188"),
        "workflow": _qwen_image_workflow,
        "sizes": {"1024x1024": (1024, 1024), "1328x1328": (1328, 1328), "1664x928": (1664, 928), "928x1664": (928, 1664)},
        "default_size": (1328, 1328),
        "default_steps": 8,
        "max_steps": 30,
        "aliases": ["qwen_image", "qwen-image-fp8", "qwen-image-fp8-e4m3fn",
                    # 平台侧模型 id（`qwen-image` 已被内置 alibaba 插件认领，故用带命名空间的 id）
                    "mibi/qwen-image", "mibi/qwen_image"],
        "desc": "Qwen-Image 文生图（自建 ComfyUI / RTX 4090D）",
    },
}

# 别名 → 规范模型名
ALIASES: dict[str, str] = {}
for _k, _v in MODELS.items():
    ALIASES[_k.lower()] = _k
    for _a in _v.get("aliases", []):
        ALIASES[_a.lower()] = _k


def resolve_model(name: str | None) -> str:
    if not name:
        return next(iter(MODELS))
    key = name.strip().lower()
    if key in ALIASES:
        return ALIASES[key]
    # 容忍 "qwen-image-xxx" 这类带后缀写法
    for alias, canonical in ALIASES.items():
        if key.startswith(alias):
            return canonical
    raise ValueError(f"unsupported model: {name} (supported: {', '.join(MODELS)})")


def parse_size(size: str | None, spec: dict) -> tuple[int, int]:
    if not size or size == "auto":
        return spec["default_size"]
    m = re.fullmatch(r"\s*(\d{2,5})\s*[xX*×]\s*(\d{2,5})\s*", size)
    if not m:
        raise ValueError(f"invalid size: {size} (expected WxH, e.g. 1024x1024)")
    w, h = int(m.group(1)), int(m.group(2))
    if not (256 <= w <= 2048 and 256 <= h <= 2048):
        raise ValueError(f"size out of range: {w}x{h} (256..2048)")
    if w % 8 or h % 8:
        raise ValueError(f"size must be multiples of 8: {w}x{h}")
    return w, h


# --------------------------------------------------------------------------- #
# ComfyUI 客户端
# --------------------------------------------------------------------------- #

class ComfyClient:
    def __init__(self, timeout: int, poll_interval: float = 3.0):
        self.timeout = timeout
        self.poll_interval = poll_interval

    def _get(self, url: str, timeout: int = 30):
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.load(r)

    def _post(self, url: str, payload: dict, timeout: int = 120):
        req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)

    def system_stats(self, base: str) -> dict:
        return self._get(base.rstrip("/") + "/system_stats", timeout=10)

    def submit(self, base: str, workflow: dict) -> str:
        resp = self._post(base.rstrip("/") + "/prompt", {"prompt": workflow})
        if resp.get("node_errors"):
            raise RuntimeError("comfyui node_errors: " + json.dumps(resp["node_errors"], ensure_ascii=False)[:400])
        pid = resp.get("prompt_id")
        if not pid:
            raise RuntimeError("comfyui did not return prompt_id: " + json.dumps(resp)[:200])
        return pid

    def wait(self, base: str, prompt_id: str) -> dict:
        """轮询到终态，返回 {status: 'success'|'error'|'timeout', outputs, elapsed, detail}"""
        base = base.rstrip("/")
        t0 = time.time()
        while time.time() - t0 < self.timeout:
            time.sleep(self.poll_interval)
            try:
                hist = self._get(f"{base}/history/{prompt_id}")
            except Exception as e:  # 轮询期间的瞬时错误不应直接失败
                if time.time() - t0 >= self.timeout:
                    break
                last_err = str(e)
                continue
            if prompt_id in hist:
                h = hist[prompt_id]
                st = h.get("status", {})
                s = st.get("status_str")
                if s == "success":
                    return {"status": "success", "outputs": h.get("outputs", {}), "elapsed": time.time() - t0}
                if s == "error":
                    return {"status": "error", "detail": json.dumps(st.get("messages", []), ensure_ascii=False)[:500],
                            "elapsed": time.time() - t0}
        return {"status": "timeout", "elapsed": time.time() - t0}

    def fetch_image(self, base: str, item: dict) -> bytes:
        qs = urllib.parse.urlencode({
            "filename": item.get("filename", ""),
            "subfolder": item.get("subfolder", ""),
            "type": item.get("type", "output"),
        })
        url = base.rstrip("/") + "/view?" + qs
        with urllib.request.urlopen(url, timeout=120) as r:
            return r.read()


def collect_media(outputs: dict) -> list[dict]:
    """从 ComfyUI outputs 中提取图片条目（保持节点顺序）。"""
    items: list[dict] = []
    for _node, out in sorted(outputs.items(), key=lambda kv: str(kv[0])):
        for img in out.get("images", []) or []:
            items.append(img)
    return items


# --------------------------------------------------------------------------- #
# 适配器服务
# --------------------------------------------------------------------------- #

class Config:
    listen = "0.0.0.0"
    port = 19010
    public_base_url = ""
    cache_dir = "/home/test/.hermes/profiles/cto/cache/comfyui-image-adapter"
    timeout = 600
    max_concurrency = 2


CFG = Config()
COMFY = ComfyClient(timeout=CFG.timeout)
SEM = threading.Semaphore(CFG.max_concurrency)
START_TS = time.time()


class Handler(BaseHTTPRequestHandler):
    server_version = "ComfyUIImageAdapter/1.0"

    # ---- 基础工具 ---- #
    def log_message(self, format, *args):  # 精简日志
        sys.stderr.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), format % args))

    def _send(self, code: int, payload: dict | bytes, ctype: str = "application/json"):
        body = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def _error(self, code: int, message: str, etype: str = "invalid_request_error", param: str | None = None):
        err = {"error": {"message": message, "type": etype}}
        if param:
            err["error"]["param"] = param
        self._send(code, err)

    def _json_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            raise ValueError("request body is not valid JSON")

    # ---- 路由 ---- #
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/health":
            return self.handle_health()
        if path == "/v1/models":
            return self.handle_models()
        if path.startswith("/v1/images/"):
            return self.handle_image_file(path[len("/v1/images/"):])
        if path in ("/", "/docs"):
            return self._send(200, {
                "service": "comfyui-image-adapter",
                "endpoints": ["GET /health", "GET /v1/models", "POST /v1/images/generations", "GET /v1/images/{name}"],
                "models": list(MODELS),
            })
        return self._error(404, f"unknown path: {path}", "not_found")

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/v1/images/generations":
            return self.handle_generate()
        return self._error(404, f"unknown path: {path}", "not_found")

    # ---- 处理器 ---- #
    def handle_health(self):
        models_status = {}
        for name, spec in MODELS.items():
            try:
                st = COMFY.system_stats(spec["backend"])
                dev = (st.get("devices") or [{}])[0]
                models_status[name] = {
                    "backend": spec["backend"], "reachable": True,
                    "device": dev.get("name"),
                    "vram_free_gb": round((dev.get("vram_free") or 0) / 2**30, 1),
                    "comfyui_version": (st.get("system") or {}).get("comfyui_version"),
                }
            except Exception as e:
                models_status[name] = {"backend": spec["backend"], "reachable": False, "error": str(e)[:200]}
        ok = all(v["reachable"] for v in models_status.values())
        self._send(200 if ok else 503, {"ok": ok, "uptime_s": round(time.time() - START_TS, 1),
                                       "models": models_status})

    def handle_models(self):
        now = int(time.time())
        self._send(200, {"object": "list", "data": [
            {"id": name, "object": "model", "created": now, "owned_by": "self-hosted",
             "description": spec.get("desc", "")} for name, spec in MODELS.items()]})

    def handle_image_file(self, name: str):
        safe = os.path.basename(urllib.parse.unquote(name))
        path = Path(CFG.cache_dir) / safe
        if not path.is_file():
            return self._error(404, f"image not found: {safe}", "not_found")
        ctype = "image/png" if safe.lower().endswith(".png") else "application/octet-stream"
        self._send(200, path.read_bytes(), ctype)

    def handle_generate(self):
        try:
            body = self._json_body()
        except ValueError as e:
            return self._error(400, str(e))

        try:
            model = resolve_model(body.get("model"))
        except ValueError as e:
            return self._error(400, str(e), param="model")
        spec = MODELS[model]

        prompt = (body.get("prompt") or "").strip()
        if not prompt:
            return self._error(400, "'prompt' is required", param="prompt")

        try:
            n = int(body.get("n") or 1)
        except Exception:
            return self._error(400, "'n' must be an integer", param="n")
        if not 1 <= n <= 4:
            return self._error(400, "'n' must be between 1 and 4", param="n")

        try:
            width, height = parse_size(body.get("size"), spec)
        except ValueError as e:
            return self._error(400, str(e), param="size")

        try:
            steps = int(body.get("steps") or spec["default_steps"])
        except Exception:
            return self._error(400, "'steps' must be an integer", param="steps")
        if not 1 <= steps <= spec["max_steps"]:
            return self._error(400, f"'steps' must be between 1 and {spec['max_steps']}", param="steps")

        seed = body.get("seed")
        if seed is None:
            seed = int(time.time() * 1000) % 2_147_483_647
        try:
            seed = int(seed)
        except Exception:
            return self._error(400, "'seed' must be an integer", param="seed")

        negative = body.get("negative_prompt") or body.get("negative") or NEG_IMAGE_DEFAULT
        response_format = (body.get("response_format") or "url").lower()
        if response_format not in ("url", "b64_json"):
            return self._error(400, "'response_format' must be 'url' or 'b64_json'", param="response_format")

        results, errors, t0 = [], [], time.time()
        for idx in range(n):
            try:
                item = self._generate_one(spec, prompt, str(negative), seed + idx, steps, width, height, response_format)
                results.append(item)
            except Exception as e:
                errors.append({"message": str(e)[:400], "index": idx})

        if not results:
            msg = errors[0]["message"] if errors else "image generation failed"
            code = 504 if "timeout" in msg.lower() else 502
            return self._error(code, msg, "upstream_error")

        payload = {"created": int(time.time()), "data": results, "model": model,
                   "size": f"{width}x{height}", "elapsed_s": round(time.time() - t0, 2)}
        if errors:
            payload["partial_errors"] = errors
        self._send(200, payload)

    def _generate_one(self, spec: dict, prompt: str, negative: str, seed: int,
                      steps: int, width: int, height: int, response_format: str) -> dict:
        backend = spec["backend"]
        workflow = spec["workflow"](prompt, negative, seed, steps, width, height)
        with SEM:
            prompt_id = COMFY.submit(backend, workflow)
            outcome = COMFY.wait(backend, prompt_id)
        if outcome["status"] != "success":
            raise RuntimeError(f"comfyui {outcome['status']}: {outcome.get('detail', '')}".strip())

        media = collect_media(outcome["outputs"])
        if not media:
            raise RuntimeError("comfyui success but no image output")

        item = media[0]
        data = COMFY.fetch_image(backend, item)
        ext = os.path.splitext(item.get("filename", "img.png"))[1] or ".png"
        fname = f"img_{uuid.uuid4().hex[:16]}{ext}"
        os.makedirs(CFG.cache_dir, exist_ok=True)
        (Path(CFG.cache_dir) / fname).write_bytes(data)

        entry: dict = {"index": len(media) - 1}
        if response_format == "b64_json":
            entry["b64_json"] = base64.b64encode(data).decode()
        else:
            entry["url"] = f"{CFG.public_base_url.rstrip('/')}/v1/images/{fname}"
        entry["seed"] = seed
        entry["elapsed_s"] = round(outcome.get("elapsed", 0.0), 2)
        entry["bytes"] = len(data)
        return entry


def main():
    ap = argparse.ArgumentParser(description="ComfyUI → OpenAI 兼容图像适配器")
    ap.add_argument("--listen", default=os.environ.get("ADAPTER_LISTEN", CFG.listen))
    ap.add_argument("--port", type=int, default=int(os.environ.get("ADAPTER_PORT", CFG.port)))
    ap.add_argument("--public-base-url", default=os.environ.get("ADAPTER_PUBLIC_BASE_URL", ""))
    ap.add_argument("--cache-dir", default=os.environ.get("ADAPTER_CACHE_DIR", CFG.cache_dir))
    ap.add_argument("--timeout", type=int, default=int(os.environ.get("ADAPTER_TIMEOUT", CFG.timeout)))
    ap.add_argument("--max-concurrency", type=int, default=int(os.environ.get("ADAPTER_MAX_CONCURRENCY", CFG.max_concurrency)))
    args = ap.parse_args()

    CFG.listen, CFG.port, CFG.cache_dir = args.listen, args.port, args.cache_dir
    CFG.timeout, CFG.max_concurrency = args.timeout, args.max_concurrency
    CFG.public_base_url = args.public_base_url or f"http://{args.listen}:{args.port}"
    COMFY.timeout = args.timeout
    SEM._value = args.max_concurrency  # 允许命令行覆盖并发上限
    os.makedirs(CFG.cache_dir, exist_ok=True)

    srv = ThreadingHTTPServer((CFG.listen, CFG.port), Handler)
    print(f"comfyui-image-adapter listening on {CFG.listen}:{CFG.port} "
          f"(public={CFG.public_base_url}, models={list(MODELS)}, timeout={CFG.timeout}s, "
          f"concurrency={CFG.max_concurrency})", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
