# Linux 浏览器选择：Firefox / Chrome / Chromium 怎么选

> 2026-07-26

Linux 桌面上的浏览器选型，说到底就是 Firefox 还是 Chromium 系的选择题。本文基于 CachyOS（Arch 系）的实际体验，对比主流选项。

## 三巨头速览

| | Firefox | Chrome | Chromium |
|---|---|---|---|
| **内核** | Gecko + SpiderMonkey | Blink + V8 | Blink + V8 |
| **开源** | ✅ MPL-2.0 | ❌ 闭源组件 | ✅ BSD-3 |
| **Google 服务** | ❌ | ✅ 内置 | ❌ 需手动配 |
| **DRM (Widevine)** | ✅ 自动 | ✅ 内置 | ⚠️ 需手动装 |
| **Manifest V3** | 不影响 uBO | uBO 受限 | uBO 受限 |
| **容器 (Containers)** | ✅ 原生 | ❌ | ❌ |
| **Wayland** | ✅ 原生 | ✅ 原生 | ✅ 原生 |
| **CachyOS 优化包** | `cachyos-firefox` | 无 | `cachyos-chromium` |

CachyOS 的优化包带了 `-O3` + `LTO` + `x86-64-v4`，比官方版快 5-15%。

## 性能对比

| 指标 | Firefox | Chrome / Chromium |
|---|---|---|
| **JS (Speedometer 3)** | 基准 | 快 5-10% |
| **内存 (单标签)** | ~200-400MB | ~300-500MB |
| **内存 (多标签)** | +50-100MB/标签 | +80-150MB/标签 |
| **启动速度** | ~1.5s | ~1.0s |
| **GPU 加速** | 2025 大幅改进 | 成熟稳定 |
| **滚动流畅度** | 2025 版已接近 | 标杆 |

## 各自优势

### Firefox 强在哪
- **容器 (Containers)** — 唯一原生多身份隔离，开箱即用，工作中同时登录多个账号非常方便
- **uBlock Origin** — Manifest V3 不受影响。Chrome 版的 uBO 已经被大幅削弱，这是 Firefox 目前的王牌
- **端到端加密同步** — 不需要 Google 账号
- **CSS 开发者工具** — 某些场景比 Chrome DevTools 更清晰

### Chrome/Chromium 强在哪
- **PWA** — 支持最好最完善
- **DevTools** — 行业标准，JS/网络/性能调试最强
- **扩展生态** — 数量最多
- **Google 服务** — 登录态无缝同步

## 社区趋势（2024-2025）

Google 推 Manifest V3 后，"从 Chrome 切回 Firefox"的声音在技术社区明显增多。普通用户仍然默认 Chrome（全球份额 ~65%），但 Linux 上 Firefox 占比更高（~40-50%）。

Linux 用户中常见的策略是 **"Chrome for work, Firefox for personal"**——工作用 Chrome（Google 服务、调试），个人用 Firefox（隐私、uBO）。

## 其他值得关注的选项

| 浏览器 | 内核 | 特点 |
|---|---|---|
| **Brave** | Chromium | 内置广告拦截 + Tor，社区有争议 |
| **LibreWolf** | Firefox | 隐私强化版，去遥测 + 防指纹 |
| **Ungoogled Chromium** | Chromium | 去干净 Google 服务 |
| **Vivaldi** | Chromium | 高度可定制（标签堆叠、侧边栏） |
| **Floorp** | Firefox | 日本团队维护，集成侧边栏 + workspace |
| **Zen Browser** | Firefox | 新项目，类似 Arc 的交互 |
| **Tor Browser** | Firefox | 匿名浏览专用 |

## 我的结论

| 场景 | 推荐 |
|---|---|
| 隐私优先 | **Firefox** |
| 日常开发 + 调试 | Firefox + Chromium 双持 |
| Google 全家桶用户 | **Chrome** |
| 极致隐私 | LibreWolf |
| 全都要 | Firefox 主力 + Chromium 备用 |

目前在 CachyOS 上，我的方案是 Firefox（`cachyos-firefox` 优化版）作为主力日常使用，Chromium 作为调试备用。这个组合兼顾了隐私和兼容性，推荐一试。
