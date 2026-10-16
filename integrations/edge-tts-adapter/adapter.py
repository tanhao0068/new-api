#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mibi 语音合成适配器（edge-tts → OpenAI 兼容 /v1/audio/speech）

作者：CTO Agent ｜ v1.0 ｜ 2026-10-16

用途：**调试期**把 edge-tts（微软 Edge 在线语音，免费、免密钥）暴露为 OpenAI 兼容的
语音合成接口，使 mibi-api 能以「OpenAI 渠道」接入并复用平台既有的鉴权、计费、日志链路。

⚠️ 定位说明：edge-tts 属**非官方**接口，随时可能变更，且不提供 SLA ——
本适配器仅用于**业务流程调通与内部调试**；正式上线应切换到自建 TTS（43 服务器）
或商用 API（详见 docs/tech/voice-synthesis-integration-plan.md）。

接口
----
GET  /health               健康检查（edge-tts 版本、可用音色数、并发占用）
GET  /v1/models            支持的模型清单
GET  /v1/voices            中文音色清单（前端「音色」下拉的数据源口径）
POST /v1/audio/speech      OpenAI 兼容语音合成，返回音频字节流

请求体（OpenAI 标准 + 扩展）
---------------------------
{
  "model": "mibi/edge-tts",          // 忽略（本适配器只有一种模型），仅为兼容
  "input": "要合成的文本",            // 必填
  "voice": "zh-CN-XiaoxiaoNeural",   // 音色，默认 zh-CN-XiaoxiaoNeural（晓晓）
  "speed": 1.0,                      // 语速 0.5–2.0（原型口径）→ 映射为 edge-tts rate ±N%
  "volume_gain": 0,                  // 音量增益 dB（-12–12，原型口径）→ ffmpeg volume=<N>dB
  "pitch": 0,                        // 可选：音调 Hz（edge-tts --pitch）
  "response_format": "mp3",          // mp3（默认）| wav
  "metadata": { "volume_gain": 6 }   // 经平台调用时，扩展参数放在 metadata 内（音频链路不
}                                    // 透传自定义顶层字段，而 metadata 会被 DTO 保留）

实现要点
--------
* **语速**：edge-tts 原生支持 `rate=±N%`，由 speed 倍数换算（speed 1.0 → +0%）。
* **音量增益**：edge-tts 的 `--volume` 是百分比而非 dB，语义不精确；
  为保证与原型「-12–12 dB」一致，音量统一由 **ffmpeg `volume=<N>dB`** 精确处理。
* **格式**：edge-tts 原生产出 mp3；需要 wav 时用 ffmpeg 转码（可与音量处理合并为一次转码）。
* 仅依赖标准库 + edge_tts + ffmpeg 可执行文件。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

try:
    import edge_tts
except Exception as exc:  # pragma: no cover
    print(f"[FATAL] 需要 edge_tts 模块（pip install edge-tts）：{exc}", file=sys.stderr)
    raise

ADAPTER_VERSION = "1.0.0"
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"
DEFAULT_FORMAT = "mp3"
MAX_TEXT_LEN = 2000
SPEED_MIN, SPEED_MAX = 0.5, 2.0
VOLUME_MIN, VOLUME_MAX = -12.0, 12.0
SYNTH_TIMEOUT = 60

# 原型 REQ-013 的 4 个音色 → 实测可得的 Edge 中文音色（龙小诚/龙小淳 Edge 无对应，
# 故补入其余可得音色并在中文标签中保留原型命名，详见技术方案 §十）
VOICE_CATALOG: list[dict[str, str]] = [
    {"name": "zh-CN-XiaoxiaoNeural", "label_zh": "晓晓（女声·默认）", "gender": "Female"},
    {"name": "zh-CN-YunxiNeural", "label_zh": "云希（男声）", "gender": "Male"},
    {"name": "zh-CN-YunyangNeural", "label_zh": "云扬（男声·新闻）", "gender": "Male"},
    {"name": "zh-CN-XiaoyiNeural", "label_zh": "晓伊（女声）", "gender": "Female"},
    {"name": "zh-CN-YunjianNeural", "label_zh": "云健（男声·解说）", "gender": "Male"},
    {"name": "zh-CN-liaoning-XiaobeiNeural", "label_zh": "小北（东北官话）", "gender": "Female"},
]
VOICE_NAMES = {v["name"] for v in VOICE_CATALOG}

_semaphore: threading.Semaphore | None = None
_ffmpeg = shutil.which("ffmpeg")


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def parse_speed(raw: Any) -> float:
    try:
        speed = float(raw)
    except (TypeError, ValueError):
        return 1.0
    if not math.isfinite(speed) or speed <= 0:
        return 1.0
    return round(clamp(speed, SPEED_MIN, SPEED_MAX), 2)


def parse_volume_gain(raw: Any) -> float:
    try:
        gain = float(raw)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(gain):
        return 0.0
    return round(clamp(gain, VOLUME_MIN, VOLUME_MAX), 1)


def speed_to_rate(speed: float) -> str:
    """语速倍数 → edge-tts 的 rate 百分比（+0% / -50% / +100%）。"""
    return f"{int(round((speed - 1.0) * 100)):+d}%"


async def _synthesize_mp3(text: str, voice: str, rate: str, pitch: str, out_path: str) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await asyncio.wait_for(communicate.save(out_path), timeout=SYNTH_TIMEOUT)


def synthesize(text: str, voice: str, speed: float, volume_gain: float,
               pitch_hz: int, response_format: str) -> tuple[bytes, str]:
    """返回 (音频字节, content-type)。异常上抛由调用方转成 HTTP 错误。"""
    assert _semaphore is not None
    fmt = (response_format or DEFAULT_FORMAT).lower()
    if fmt not in ("mp3", "wav"):
        fmt = DEFAULT_FORMAT
    need_audio_filter = abs(volume_gain) > 0.01 or fmt == "wav"
    if need_audio_filter and not _ffmpeg:
        raise RuntimeError("需要 ffmpeg 处理音量增益/格式转换，但未找到 ffmpeg 可执行文件")

    with tempfile.TemporaryDirectory(prefix="edge-tts-") as tmp:
        mp3_path = os.path.join(tmp, "speech.mp3")
        acquired = _semaphore.acquire(timeout=SYNTH_TIMEOUT)
        if not acquired:
            raise TimeoutError("适配器并发已满，请稍后重试")
        try:
            asyncio.run(_synthesize_mp3(text, voice, speed_to_rate(speed),
                                        f"{pitch_hz:+d}Hz", mp3_path))
        finally:
            _semaphore.release()

        if not os.path.exists(mp3_path) or os.path.getsize(mp3_path) == 0:
            raise RuntimeError("edge-tts 未返回音频数据（上游可能限流或音色不可用）")

        if not need_audio_filter:
            with open(mp3_path, "rb") as fh:
                return fh.read(), "audio/mpeg"

        # 注意：输出文件名必须与输入区分 —— 仅调整音量时 fmt 同样是 mp3，
        # 若同名 ffmpeg 会以 "Output ... same as Input" 拒绝执行。
        out_path = os.path.join(tmp, f"speech-out.{fmt}")
        cmd = [_ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", mp3_path]
        if abs(volume_gain) > 0.01:
            cmd += ["-af", f"volume={volume_gain}dB"]
        cmd += [out_path]
        proc = subprocess.run(cmd, capture_output=True, timeout=SYNTH_TIMEOUT)
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg 处理失败：{proc.stderr.decode('utf-8', 'replace')[:200]}")
        with open(out_path, "rb") as fh:
            data = fh.read()
        return data, ("audio/wav" if fmt == "wav" else "audio/mpeg")


class Handler(BaseHTTPRequestHandler):
    server_version = f"mibi-edge-tts-adapter/{ADAPTER_VERSION}"

    # ---------- 工具 ----------
    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, code: str, message: str, param: str | None = None) -> None:
        err: dict[str, Any] = {"message": message, "type": code, "code": code}
        if param:
            err["param"] = param
        self._json(status, {"error": err})

    def _read_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except Exception as exc:
            raise ValueError(f"请求体不是合法 JSON：{exc}") from exc
        if not isinstance(parsed, dict):
            raise ValueError("请求体必须是 JSON 对象")
        return parsed

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - 基类签名
        log(f'{self.address_string()} "{format % args}"')

    # ---------- 路由 ----------
    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?")[0]
        if path == "/health":
            self._json(200, {
                "ok": True,
                "adapter": f"mibi-edge-tts/{ADAPTER_VERSION}",
                "engine": "edge-tts",
                "engine_version": getattr(edge_tts, "__version__", "unknown"),
                "ffmpeg": bool(_ffmpeg),
                "voices": len(VOICE_CATALOG),
                "concurrency_limit": _semaphore._value if _semaphore else 0,  # type: ignore[attr-defined]
            })
            return
        if path == "/v1/models":
            self._json(200, {"object": "list", "data": [
                {"id": "mibi/edge-tts", "object": "model", "owned_by": "mibiia"},
            ]})
            return
        if path == "/v1/voices":
            self._json(200, {"object": "list", "data": VOICE_CATALOG})
            return
        self._error(404, "not_found", f"no route for GET {path}")

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?")[0]
        if path != "/v1/audio/speech":
            self._error(404, "not_found", f"no route for POST {path}")
            return
        try:
            body = self._read_body()
        except ValueError as exc:
            self._error(400, "invalid_request_error", str(exc))
            return

        text = (body.get("input") or "").strip()
        if not text:
            self._error(400, "invalid_request_error", "'input' is required", "input")
            return
        if len(text) > MAX_TEXT_LEN:
            self._error(400, "invalid_request_error",
                        f"'input' is too long: {len(text)} > {MAX_TEXT_LEN}", "input")
            return
        # 扩展参数来源：
        #  * 直连（走请求体透传时）→ 顶层 volume_gain
        #  * 经平台（音频链路不透传自定义顶层字段）→ metadata.volume_gain
        # 说明见 docs/tech/voice-synthesis-integration-plan.md
        extra = body.get("metadata")
        if isinstance(extra, str):
            try:
                extra = json.loads(extra)
            except Exception:
                extra = None
        if not isinstance(extra, dict):
            extra = {}

        def pick(name: str, default: Any = None) -> Any:
            if body.get(name) is not None:
                return body.get(name)
            return extra.get(name, default)

        speed = parse_speed(pick("speed"))
        volume_gain = parse_volume_gain(pick("volume_gain"))
        raw_voice = pick("voice") or DEFAULT_VOICE
        voice = raw_voice.strip() if isinstance(raw_voice, str) else DEFAULT_VOICE
        if voice not in VOICE_NAMES:
            self._error(400, "invalid_request_error",
                        f"unknown voice {voice!r}; available: {', '.join(sorted(VOICE_NAMES))}", "voice")
            return
        try:
            pitch_hz = int(pick("pitch") or 0)
        except (TypeError, ValueError):
            pitch_hz = 0

        started = time.time()
        try:
            audio, content_type = synthesize(text, voice, speed, volume_gain,
                                             pitch_hz,
                                             str(pick("response_format") or DEFAULT_FORMAT))
        except TimeoutError as exc:
            self._error(504, "upstream_timeout", str(exc))
            return
        except Exception as exc:  # 上游失败
            log(f"合成失败：{type(exc).__name__}: {exc}")
            self._error(502, "upstream_error", f"speech synthesis failed: {exc}")
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("X-Mibi-Voice", voice)
        self.send_header("X-Mibi-Speed", f"{speed}")
        self.send_header("X-Mibi-Volume-Gain", f"{volume_gain}")
        self.send_header("X-Mibi-Elapsed", f"{time.time() - started:.2f}")
        self.end_headers()
        self.wfile.write(audio)
        log(f"合成成功 voice={voice} speed={speed} gain={volume_gain}dB "
            f"bytes={len(audio)} {time.time() - started:.2f}s")


def main() -> None:
    global _semaphore
    parser = argparse.ArgumentParser(description="edge-tts → OpenAI 兼容语音合成适配器")
    parser.add_argument("--listen", default=os.environ.get("ADAPTER_LISTEN", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("ADAPTER_PORT", "19020")))
    parser.add_argument("--max-concurrency", type=int,
                        default=int(os.environ.get("ADAPTER_MAX_CONCURRENCY", "4")))
    parser.add_argument("--require-key", default=os.environ.get("ADAPTER_REQUIRE_KEY", ""))
    args = parser.parse_args()

    _semaphore = threading.Semaphore(max(1, args.max_concurrency))

    if args.require_key:
        original_read_body = Handler._read_body

        def guarded(self: Handler) -> dict[str, Any]:  # type: ignore[misc]
            auth = (self.headers.get("Authorization") or "").strip()
            if auth != f"Bearer {args.require_key}":
                raise PermissionError("invalid api key")
            return original_read_body(self)

        Handler._read_body = guarded  # type: ignore[assignment]

    server = ThreadingHTTPServer((args.listen, args.port), Handler)
    server.daemon_threads = True
    log(f"edge-tts 适配器已启动 http://{args.listen}:{args.port} "
        f"（并发上限 {args.max_concurrency}，ffmpeg={'有' if _ffmpeg else '无'}）")
    log(f"音色 {len(VOICE_CATALOG)} 个：{', '.join(v['name'] for v in VOICE_CATALOG)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("收到中断，退出")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
