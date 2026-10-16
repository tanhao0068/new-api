# Edge-TTS 语音合成适配器（OpenAI 兼容）

**作者：CTO Agent** ｜ v1.0 ｜ 2026-10-16

把 **edge-tts**（微软 Edge 在线语音，免费、免密钥）暴露为 OpenAI 兼容的 `/v1/audio/speech`，
使 mibi-api 能以「OpenAI 渠道」接入并复用平台既有鉴权/渠道/计费/日志链路。

> **定位**：edge-tts 属**非官方**接口，无 SLA、随时可能变更 → **仅用于业务流程调通与内部调试**。
> 正式上线应切换自建 TTS 或商用 API。完整方案见
> `mibi-workspace/docs/tech/voice-synthesis-integration-plan.md`（方案）与
> `voice-synthesis-integration.md`（实施记录）。

## 部署位置（重要）

**部署在 192.168.0.43**，而非 mibi-api 主机：

| 主机 | Edge TTS 合成结果 |
|---|---|
| mibi-api 主机（192.168.0.42） | voices 列表 200，**WSS 合成 403**（上游拒绝该出口） |
| **192.168.0.43** | **成功** ✅ |

```
客户端 ─▶ mibi-api(3002) ─▶ 本适配器(192.168.0.43:19030) ─▶ Edge TTS(WSS)
```

## 部署（43 上）

```bash
# 目录：/data2/mibi-tts/   服务：systemd --user 单元 mibi-tts（Linger=yes 免登录常驻）
mkdir -p /data2/mibi-tts && cd /data2/mibi-tts
python3 -m venv venv && venv/bin/pip install -i https://pypi.tuna.tsinghua.edu.cn/simple edge-tts
# 需要 ffmpeg（音量增益 / 格式转换）
systemctl --user enable --now mibi-tts
```

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/v1/audio/speech` | 合成，返回音频字节流（`audio/mpeg` / `audio/wav`） |
| GET | `/v1/voices` | 音色清单 |
| GET | `/health` | 健康检查（引擎版本 / ffmpeg / 并发） |
| GET | `/v1/models` | 模型清单 |

### 请求字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `input` | ✅ | 待合成文本（≤ 2000 字） |
| `voice` | — | 默认 `zh-CN-XiaoxiaoNeural`（晓晓）；6 个中文音色见 `/v1/voices` |
| `speed` | — | 语速 0.5–2.0（原型口径）→ edge-tts `rate ±N%` |
| `volume_gain` | — | 音量增益 dB（−12–12）→ **ffmpeg `volume=<N>dB`**；**经平台调用时须放在 `metadata` 内** |
| `pitch` | — | 音调 Hz（可选） |
| `response_format` | — | `mp3`（默认）/ `wav` |
| `metadata` | — | 平台 DTO 会保留该字段；`{"volume_gain": N}` 用于经平台传递扩展参数 |

错误语义：`400`（参数非法，带 `param`）、`502`（上游失败）、`504`（超时）。

## 平台接入（已落地，仅渠道配置）

```sql
-- channels: type=1 OpenAI 兼容，base_url=http://192.168.0.43:19030，
--           models=mibi/edge-tts，setting={"pass_through_body_enabled": true}
-- abilities + ModelPrice["mibi/edge-tts"]
-- 登录态入口：POST /pg/audio/speech（controller/playground_audio.go）
```

## 实测基线（2026-10-16）

| 项 | 结果 |
|---|---|
| 直连合成 | 8.09s 音频 → 48,528 bytes，约 1.4s |
| 语速 | 0.5 → 16.10s；1.0 → 8.09s；2.0 → 4.08s（精确对应） |
| 音量增益 | 0dB → −19.3；+12 → −8.2；−12 → −31.8 dB（md5 各异） |
| 经平台 | `POST /pg/audio/speech ｜ 200 ｜ 6.47s`；页面 `<audio>` readyState=4 |
| 计费 | ⚠️ **当前为 0**（音频走 ratio 口径，`ModelRatio` 未配置）——见实施记录 §五 |

## 已知限制

1. 文本上限 2000 字（超长需分段）；
2. 非官方接口，无 SLA；
3. 并发上限默认 4；
4. 音量增益依赖 ffmpeg（未装则仅支持音量 0）。
