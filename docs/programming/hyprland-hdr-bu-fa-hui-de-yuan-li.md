# Hyprland 的 HDR 桌面为什么不发灰

> 2026-07-27

KDE Plasma 开 HDR 桌面发灰，Hyprland 却不会——这不是玄学，是两种完全不同的 HDR 策略导致的。

## 先看现象

同样一张桌面（4K MiniLED 显示器，RX 7900 XT，同一台机器）：

| 合成器 | HDR 开启后桌面效果 |
|--------|-------------------|
| KWin (KDE Plasma 6.7.3) | 发灰，对比度下降，颜色黯淡 |
| Hyprland 0.55+ | 颜色正常，跟没开 HDR 一样 |

关键点：Hyprland 不是"解决了 SDR→HDR 映射"，而是**根本不需要做这个映射**。

## 两种策略

### KWin：全局 HDR

KDE 的 HDR 开关是一个全局切换。打开后，KWin 把整个显示输出切到 HDR 模式（rec.2020 色域 + PQ 曲线/ST2084）。然后桌面上所有内容——面板、图标、窗口背景、文字——都是 sRGB 画的，KWin 必须把它们**强行映射**到 HDR 容器里。

这个 SDR→HDR 色调映射就是发灰的根源。sRGB 的亮度范围和色域远小于 rec.2020 + PQ，拉伸必然导致对比度下降。KWin 的 `sdrGamutWideness` 参数理论上可以缓解，实际测试无效。

### Hyprland：按需 HDR

Hyprland 的 `render.cm_auto_hdr` 采取了完全不同的策略：**桌面保持 SDR，只有全屏应用需要 HDR 时才切**。

具体流程：

1. 色彩管理管线（`cm_enabled`）始终开启，但输出色彩空间保持在 sRGB
2. Hyprland 通过 Wayland 协议检测全屏应用是否请求 HDR 内容
3. 检测到 HDR 请求 → 动态将显示器输出配置切换到 `cm, hdr` 模式（原生 HDR10）
4. 应用退出全屏 → `send_content_type` 触发自动切回 SDR

整个过程对用户透明，桌面从来不需要做 SDR→HDR 映射，自然不会发灰。

## 配置验证

当前运行的配置（CachyOS + Hyprland + RX 7900 XT + INNOCN 27M2V-D）：

```bash
# 实际生效的 HDR 相关设置
hyprctl getoption render:cm_auto_hdr   # int: 1
hyprctl getoption render:cm_enabled    # int: 1
hyprctl getoption render:use_fp16      # int: 2
hyprctl getoption quirks:prefer_hdr    # int: 2
```

显示器状态：

```
Monitor HDMI-A-1: 3840x2160@120
  currentFormat: XRGB2101010      # 10-bit 输出
  colorManagementPreset: srgb     # 桌面 SDR
```

HDR 配置已启用但桌面显示 `srgb`，符合预期——`cm_auto_hdr` 的策略就是桌面不切 HDR。

## 配个图

```
KWin:       [ HDR ON ] ← 所有 SDR 内容强行映射 → 发灰
Hyprland:   [ SDR桌面 ] ← 全屏触发 → [ HDR模式 ] → 自动切回 [ SDR桌面 ]
```

## 引用

- [Hyprland Wiki — Variables](https://wiki.hypr.land/Configuring/Basics/Variables/)
  - `cm_auto_hdr`: Auto-switch to HDR in fullscreen when needed
  - `send_content_type`: Report content type to allow monitor profile autoswitch
  - `prefer_hdr`: Report HDR mode as preferred (for clients that need it before start)
