# 24GB 显存下的本地 LLM 选型：qwen3.6 → qwen3-coder

> 2026-07-26

## 背景

硬件：AMD Ryzen 9 7950X + Radeon RX 7900 XTX（24GB VRAM），主要做 Web 全栈开发，不涉及多模态。复杂推理和长上下文场景有 DeepSeek V4 Flash 免费版兜底。

## 问题

之前的模型 `qwen3.6`（35B MoE，Q4_K_M，~23GB，262K 上下文），回答到一半经常中断。根因很简单：~23GB 的模型几乎占满 24GB 显存，KV cache 只剩 ~1GB，上下文一长就 OOM。

## 选型标准

| 条件 | 要求 |
|---|---|
| VRAM 余量 | ≥5GB 留给 KV cache |
| 代码能力 | 强（Web 全栈） |
| 许可证 | Apache 2.0 |
| ROCm | 必须能在 Ollama + AMD GPU 上跑 |

## 决策：qwen3-coder:30b

| 项 | 值 |
|---|---|
| 模型 | Qwen3-30B-A3B MoE |
| 活跃参数 | 3.3B |
| 量化 | Q4_K_M |
| 大小 | ~19GB |
| 上下文 | 256K |
| VRAM 余量 | ~5GB（原来 ~1GB） |

备选考虑过 `deepseek-r1:32b`（~20GB，余量更多，数学推理强但代码弱于 qwen3-coder），最终基于代码能力需求选了 qwen3-coder。

## 结果

- Ollama 拉取 `qwen3-coder:30b`（18GB 下载）
- 删除旧模型，腾出 23GB 磁盘
- 测试运行正常，不再有大段回答中断的问题

最直观的感受：多轮对话和长上下文的体验明显改善，不再担心说到一半突然断掉。
