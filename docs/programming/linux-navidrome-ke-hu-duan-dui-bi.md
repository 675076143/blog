# Linux Navidrome 客户端选型

> 2026-07-26

Navidrome 使用 Subsonic/OpenSubsonic API，兼容所有 Subsonic 客户端。以下是 Linux 桌面端的推荐。

## 客户端对比

| 客户端 | Stars | 技术栈 | 特点 |
|---|---|---|---|
| **Feishin** | 9.1k | Electron + React | Sonixd 继任者，社区最大，MPV 后端 |
| **Psysonic** | 289 | Tauri + Rust + React | 轻量，增长最快，支持 Orbit 共享听歌 |
| **Rufin** | 44 | GTK4 + Rust | GNOME 原生体验，支持同步歌词 |
| **Firmium** | 32 | Iced + Rust | 跨平台 + Android，离线模式 |
| **Nokkvi** | 26 | Iced + Rust | Linux 独占，PipeWire 原生音频 |
| **NaviThingy** | 26 | Tauri + Svelte | 较新，开发中 |

## 选型建议

- **省心首选** → Feishin（功能完善，社区最大，AUR/Flatpak 都可用）
- **轻量原生** → Psysonic（Tauri + Rust，更新活跃）或 Firmium（Rust，跨平台）
- **GNOME 用户** → Rufin（GTK4/libadwaita）
- **平铺 WM/极客** → Nokkvi（键盘驱动，PipeWire，GPU 可视化）

## 安装

```bash
# Feishin（推荐）
yay -S feishin-bin

# 或 Flatpak
flatpak install flathub org.jeffvli.feishin
```

启动后输入 Navidrome 服务器地址、用户名、密码即可。建议安装 MPV 作为播放后端以获得最佳体验。
