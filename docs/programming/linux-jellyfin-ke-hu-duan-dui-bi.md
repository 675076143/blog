# Linux Jellyfin 桌面客户端选型

> 2026-07-26

Jellyfin 的 Linux 桌面客户端选择不少，但质量参差不齐。以下是 6 个主流客户端的横向对比。

## 核心选项

| | Tsukimi | Jellium Desktop | Switchfin | MPV Shim | Reel | Delfin |
|---|---|---|---|---|---|---|
| **技术栈** | GTK4 + MPV (Rust) | CEF + MPV (Rust) | borealis + MPV (C++) | Python | GTK4/Relm4 (Rust) | GTK4 (Rust) |
| **UI 类型** | 原生 GTK4 | Web UI 嵌入 | 完全原生 | 原生桌面 | 原生 GNOME | 原生 GTK4 |
| **硬件加速** | ✅ | vo=gpu-next | 可切换 | vo=gpu-next | 有配置 | 有配置 |
| **HDR 直通** | 未明确 | ✅ (Wayland) | 未明确 | ❌ | 未明确 | 未明确 |
| **活跃度** | ✅ 活跃 | ⚠️ 无稳定版 | ✅ 活跃 | ✅ 活跃 | ❌ 停更 | ❌ 较久 |
| **安装** | AUR | AUR / AppImage | Flatpak | AUR | .deb / .rpm | Flatpak / AUR |

## 播放功能

| 功能 | Tsukimi | Jellium | Switchfin | MPV Shim |
|---|---|---|---|---|
| 直通播放 | ✅ | ✅ | ✅ | ✅ |
| 服务端转码 | ✅ | ✅ | ✅ | ✅ |
| 字幕 | mpv 全格式 | 完整 | SRT/VTT/ASS | SRT/ASS |
| 续播 | ✅ | ✅ | ✅ | ✅ |
| 搜索 | ✅ | ✅ | ✅ 全文 | ❌ |
| Live TV | ✅ | ✅ | ✅ | ✅ |
| 离线下载 | ❌ | ❌ | ✅ | ✅ |
| 多服务器 | ✅ | ✅ | ✅ | ✅ |

## 选型建议

- **Linux 桌面首选** → **Tsukimi**（GTK4 原生，功能全面，活跃开发，~3k ★）
- **功能最全 + 跨平台** → MPV Shim（官方出品，桌面 UI，离线下载）
- **开箱即用** → Switchfin（Flatpak 安装，CachyOS 友好）
- **功能最全 + 体验接近网页版** → Jellium Desktop（但无稳定版）
- **GNOME 桌面** → Reel（但已停更）

## 安装

```bash
# Tsukimi（推荐）
paru -S tsukimi-bin

# Switchfin
flatpak install --user flathub fun.dragonfly.switchfin -y
```

目前在 CachyOS 上主力用 Tsukimi，原生 GTK4 体验和 KDE 集成都不错，功能覆盖也最全。
