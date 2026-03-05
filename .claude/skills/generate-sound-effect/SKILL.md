---
description: 使用本地 Node.js 波形合成器生成游戏音效 WAV 文件，无需外部 API。当用户要求生成、创建音效、SFX、音频效果或游戏音频时使用。
---

# 生成游戏音效

纯 Node.js 波形合成器——在本地生成 WAV 文件，零依赖，无需 API Key。

## 执行步骤

1. **确认音效类型：** 根据用户需求选择合适的预设（preset），或建议最接近的预设。

2. **执行生成脚本：**

```bash
# 生成指定预设的音效
node .cursor/skills/generate-sound-effect/scripts/generate.js <preset> [filename] [duration]

# 查看所有可用预设
node .cursor/skills/generate-sound-effect/scripts/generate.js --list
```

3. **输出位置：** 文件保存到 `public/assets/` 目录。

4. **告知用户：** 显示生成的文件路径。

## 可用预设

| 预设 | 时长 | 描述 |
|------|------|------|
| `laser` | 0.4s | 科幻激光射击——下行锯齿波扫频 |
| `explosion` | 1.5s | 重型爆炸，低频轰鸣 |
| `coin` | 0.25s | 拾取金币——快速双音琶音 |
| `jump` | 0.25s | 角色跳跃——上行正弦扫频 |
| `hit` | 0.2s | 撞击——噪声爆发加低频重击 |
| `powerup` | 0.8s | 增益道具——上行扫频加颤音 |
| `click` | 0.05s | UI 菜单点击 |
| `beep` | 0.3s | 简单提示音 |
| `whoosh` | 0.45s | 快速穿梭——滤波噪声扫频 |
| `alert` | 0.6s | 双音交替警报 |
| `card_flip` | 0.15s | 翻牌/发牌——短促清脆的咔哒声 |
| `chip_stack` | 0.35s | 筹码叠放——级联点击声 |
| `win` | 1.0s | 胜利号角——上行明亮琶音 |
| `lose` | 0.8s | 失败——下行低沉音调 |
| `timer` | 0.15s | 计时器滴答——短促时钟滴答声 |

## 示例

```bash
# 激光射击
node .cursor/skills/generate-sound-effect/scripts/generate.js laser "laser_shot.wav"

# 2秒爆炸
node .cursor/skills/generate-sound-effect/scripts/generate.js explosion "boom.wav" 2

# 发牌音效
node .cursor/skills/generate-sound-effect/scripts/generate.js card_flip "deal.wav"

# 筹码叠放
node .cursor/skills/generate-sound-effect/scripts/generate.js chip_stack "chips.wav"
```

## 技术原理

脚本使用分层振荡器（正弦波、方波、锯齿波、三角波、噪声）配合 ADSR 包络和频率扫频合成音频。最终编码为 44.1 kHz、16-bit 单声道 WAV 文件。
