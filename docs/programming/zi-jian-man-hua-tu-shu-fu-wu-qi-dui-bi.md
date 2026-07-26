# 自建漫画图书服务器选型：Komga / Suwayomi / Calibre-Web 怎么选

> 2026-07-26

自建媒体服务器的人越来越多，但漫画/电子书领域一直没有"一个方案通吃"的选项。本文对比三个主流方案，帮你选对方向。

## 快速对比

| 特性 | Komga | Suwayomi | Calibre-Web |
|---|---|---|---|
| **定位** | 漫画本地库管理 | Tachiyomi 扩展服务端（在线源） | Calibre 电子书 Web 前端 |
| **语言** | Kotlin/Spring Boot | Kotlin/JVM | Python/Flask |
| **漫画阅读** | ★★★★★ 原生支持 | ★★★★★ 扩展源丰富 | ★☆☆☆☆ 非设计目标 |
| **电子书** | ★★☆☆☆ 仅基本 PDF | ☆☆☆☆☆ 不支持 | ★★★★★ 完整支持 |
| **本地库管理** | ★★★★★ 文件夹即系列 | ☆☆☆☆☆ 不管理本地文件 | ★★★★★ metadata.db |
| **在线源抓取** | ☆☆☆☆☆ 不支持 | ★★★★★ Tachiyomi 扩展生态 | ☆☆☆☆☆ 不支持 |
| **多用户** | ✅ | ✅ | ✅ |
| **资源占用** | ~80 MB RAM | ~200 MB RAM | ~50 MB RAM |
| **GitHub ⭐** | 6.5k | 7.3k | 17.7k |

## 各方案详解

### Komga — 漫画本地库首选

面向漫画/漫画的专用媒体服务器。文件夹即系列，文件名决定章节顺序，支持 ComicInfo.xml 嵌入元数据和 ComicVine 刮削。

内置 Web 阅读器支持双页模式、Webtoon 滚动模式，Tachiyomi/Mihon 有官方扩展。如果你在 NAS 里存了几百 GB 的 CBZ/CBR，文件组织规范，Komga 是最合适的选择。

### Suwayomi — 在线漫画源聚合

Tachiyomi 的服务器端移植，本质是一个运行在服务器上的 Tachiyomi 实例。它不管理本地文件，而是从 MangaDex、MangaPlus 等在线源拉取内容。

它解决的核心问题是：**怎么让桌面电脑、iOS 设备用上 Tachiyomi 的扩展生态**。如果你主要在 Android 外的设备阅读，或者想实现自动追更、后台批量下载，Suwayomi 是唯一的选择。

### Calibre-Web — 电子书管理标杆

专注 EPUB/PDF/MOBI 电子书管理。需要已有 Calibre 数据库，支持 Send-to-Kindle、Kobo 同步、格式转换。技术书、小说、PDF 为主，漫画阅读体验一般。

## Suwayomi vs Komga：不是竞争，是互补

很多人会纠结这两个，但它们解决的是完全不同的问题：

| 维度 | Komga | Suwayomi |
|---|---|---|
| **本质** | 本地文件媒体服务器 | 在线源代理运行器 |
| **数据来源** | 你自己的 CBZ/CBR 文件 | MangaDex 等第三方在线源 |
| **文件管理** | 需要自己整理文件 | 不涉及任何本地文件 |
| **离线阅读** | 直接读本地文件 | 需预先缓存 |
| **追更** | 不关心连载状态 | 自动检测新章节 |

典型组合：**Suwayomi 在线追最新话 + Komga 读取精排收藏版单行本**，两者完全不冲突。

## 其他替代方案

| 方案 | 类型 | 特点 |
|---|---|---|
| **Kavita** | 漫画+电子书 | Komga 最大对手，支持 EPUB，UI 更现代 |
| **Stump** | 漫画+电子书 | Rust 开发，现代 UI，活跃开发中 |
| **Mango** | 漫画 | 轻量级，Go 二进制，已归档 |
| **Ubooquity** | 漫画+电子书 | Java 老牌方案，维护较缓 |

## 选型建议

- **只看漫画（本地文件）** → Komga 或 Kavita
- **看在线漫画源** → Suwayomi（配合 Mihon/Tachiyomi）
- **看电子书为主** → Calibre-Web
- **既有漫画又有电子书** → Kavita（一体方案），或 Komga + Calibre-Web（分两个服务）
- **想在桌面/iOS 上看 Tachiyomi 源** → Suwayomi Server + Web UI

三者并不互斥，我的组合是 Komga（漫画本地库）+ Suwayomi（在线追更）+ Calibre-Web（技术书），各司其职。
