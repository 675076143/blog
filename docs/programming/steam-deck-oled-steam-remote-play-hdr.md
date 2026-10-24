# 保留 Steam 库直接串流：打通 Linux 到 Steam Deck OLED 的 HDR

> 2026-10-25

我想要的体验很简单：打开 Steam Deck OLED，在 Steam 库里点“串流”，用它的 1280×800、90Hz OLED 屏幕玩电脑上的游戏。电脑本地仍用 4K 160Hz，串流结束自动恢复。

最后用 Steam Remote Play 跑通了。没有换 Moonlight，也没有把游戏改到第三方 Proton。真正花时间的，是游戏、合成器、捕获、编码和 Deck 显示之间的颜色协商，以及《赛博朋克 2077》里一份异常的亮度校准。

## 先把结果放出来

最终一轮《2077》的实际记录如下。这是一次会话的结果，不是所有游戏的性能保证。

| 项目 | 结果 |
|---|---|
| 入口 | Deck 原生 Steam 库直接串流 |
| 游戏兼容层 | Steam 官方 Proton Experimental |
| 串流尺寸 | 1280×800 |
| 主机串流显示模式 | 约 89.82Hz，自定义模式 |
| Steam 帧率上限 / 实测平均 | 90 / 89.78 FPS |
| 捕获 | PipeWire RGB10 DMA-BUF |
| 色彩 | BT.2020、PQ / SMPTE ST 2084 |
| 编码 | P010 输入、HEVC Main10 |
| Deck 客户端 | 创建 HDR10 Vulkan 渲染器 |
| 手柄 | 游戏内操作正常 |
| 退出恢复 | 3840×2160 160Hz、170% 缩放、HDR 关闭 |

捕获、编码、网络、解码的慢帧占比都是 0%；**客户端显示慢帧占比约 1.79%**，因此不能说完全零丢帧。平均 ping 约 2.25ms，网络阶段约 1.49ms，解码约 0.51ms。这些阶段统计不能直接相加冒充完整的操作到屏幕延迟；日志里的显示耗时还出现了异常大的数值，我没有拿它作为端到端延迟结论。

环境是 CachyOS、KDE Wayland、KWin 6.8.1、PipeWire 1.6.10、Mesa 26.2.5，Steam 使用 2026 年 10 月 22 日这一轮 Beta 客户端。Valve 的[更新说明](https://www.steamdeck.com/zh-tw/news)已经列出 Linux PipeWire HDR 捕获，以及恢复 OLED Deck 的 HDR 串流支持。功能存在，不代表每个桌面组合已经自动配好。

## 游戏能开 HDR，传出去的仍可能是 SDR

最容易误判的一步，是看到《2077》的 HDR10 PQ 选项终于可选，就以为成功了。

当时游戏侧已经能创建 HDR swapchain，但 Steam 日志写的是：

```text
Desktop PipeWire RGB DMABUF
Input surface format is nv12
VAProfileHEVCMain
Capture colorspace set to BT.709 full range
```

这几项组合起来，说明实际串流还在走 8 位 SDR。游戏已经输出 HDR，后面的捕获却没跟上，Deck 上的观感也不对。

最终成功时，关键证据变成了：

```text
Desktop PipeWire RGB10 DMABUF + VAAPI HEVC
Input surface format is p010le
VAProfileHEVCMain10 (18)
Capture colorspace set to BT.2020 full range
CLIENT: Created vulkan renderer on x11 using the HDR10 colorspace
```

再读 PipeWire 的生产端和消费端，两边一致为：

```text
format: xRGB_210LE
colorPrimaries: bt2020
transferFunction: smpte2084
size: 1280x800
```

这比游戏里的一个开关更能说明问题。验证 HDR 要沿着整条路径查：

```text
游戏 HDR → Gamescope → KWin 色彩管理 → PipeWire 10 位 PQ
        → Steam P010 / HEVC Main10 → Deck HDR10 渲染
```

## 保留官方 Proton 和正常手柄

前面曾试过另一套 Proton 的原生 Wayland 路径，游戏获得了 HDR 能力，手柄却没跟上。后来回到 Steam 原本的 Proton 命令，只在 Deck 串流时套一层普通嵌套 Gamescope。

这套环境中可用的关键部分是：

```text
gamescope --backend wayland --hdr-enabled -f \
  -w 1280 -h 800 -W 1280 -H 800 -r 90 -- <Steam 原本的游戏命令>
```

这里没有使用 `-e`。它是 Steam 会话集成模式，而这台机器的 Steam 本体仍在 KDE 桌面里。前面带它的尝试出现过黑屏，不能把那个结果推广成“官方 Proton 加 Gamescope 不能用 HDR”。

游戏包装器在本地启动时直接执行原命令；只有指定 Deck 的串流会话已就绪时，才走这层 Gamescope。此前实验用的 Wayland、SDL 和 Steam Input 覆盖变量也移除了。手柄是否成功，最终以游戏内实际操作确认，不能只看日志出现了 XInput 调用。

## 真正卡住的是捕获格式与动态协商

KWin 的捕获侧基于 KDE 官方 [MR 8293](https://invent.kde.org/plasma/kwin/-/merge_requests/8293) 做了适配，单独编译捕获插件，而不是替换整个桌面。

第一轮独立测试已经能传出 10 位 PQ 帧，但 Steam 仍选了 SDR。读取活跃的 PipeWire 节点才发现，Steam 请求的是 `xRGB_210LE`、`xBGR_210LE`，插件提供的 10 位格式没有对上。修正 DRM 与 SPA 格式映射，并处理透明通道后，静态测试通过了，真实串流却仍然发灰。

接下来遗漏的是**动态切换**。我构建了一个生命周期探针：先用 SDR 建立捕获，再把请求更新成 HDR。旧实现会停留在 BGRx / gamma22。它选定 SDR 后，没有继续提供完整的 10 位候选；同时，新格式到来时，缓冲区格式同步和重新分配也需要修正。

最后的修正包含：

- 选定 SDR 后，继续提供经分配测试通过的 10 位格式。
- 接受新格式时，先同步 DRM 格式，再重新分配对应缓冲区。
- 修正 SPA 格式编号与 DRM FourCC 混合比较的问题。
- 对不需要透明度的屏幕捕获，直接提供对应的 opaque 10 位格式。
- 扩大格式参数缓冲区，容纳完整候选列表。

生命周期探针随后实际完成了：

```text
BGRx / BT.709 / gamma22
  → xRGB_210LE / BT.2020 / SMPTE2084
  → 收到有效的 10 位 DMA-BUF 画面
```

部署后，真实 Steam 串流也终于进入 RGB10、P010 和 Main10。这里最有用的教训是：**只测“直接以 HDR 开始”不够，还要测“先 SDR，再启用 HDR”。**

适配源码在这里：<a href="/downloads/kwin-hdr/kwin-6.8.1-hdr.patch" download>KWin 6.8.1 补丁</a>、[独立构建入口](/downloads/kwin-hdr/CMakeLists.txt)、[构建说明与版本限制](/downloads/kwin-hdr/README.txt)。这是一份绑定当时版本的本机修复，不是适用于所有 Plasma 版本的安装包。KWin 升级后必须重新构建、验证，不能继续强行加载旧二进制。

## 黑屏还有另一条独立原因：登录顺序

注销登录后也出现过一次“电脑有画面，Deck 只有黑屏”。日志明确写了 `Desktop Black Frame`，屏幕共享门户的 `ScreenCast` 接口没有正常提供。

同时，插件启用服务启动得太早，KWin 的 D-Bus 名称还没注册，它就把版本读成空值并跳过了加载。解决方法是等实际接口就绪，核对运行中的 KWin 版本，再加载捕获插件、刷新门户。

Steam 在捕获初始化失败后，没有在下一次串流自动恢复可用捕获。完整退出 Steam，再带 `-pipewire` 启动，重新取得授权后画面才回来。只修改参数而不退出旧进程，没有完成这个重建过程。

排查时可以先看：

```bash
journalctl --user -u plasma-xdg-desktop-portal-kde.service
busctl --user introspect org.freedesktop.portal.Desktop \
  /org/freedesktop/portal/desktop org.freedesktop.portal.ScreenCast
```

授权窗口选择实际要捕获的显示器。这次用的是物理 DP-1，串流时临时切换模式，并没有创建 SudoVDA 虚拟显示器。

## 真 HDR 打通后，游戏校准也要检查

进入 Main10/PQ 后，画面已经改善，但仍有一点灰。此时继续检查《2077》的两份配置，发现最低亮度设成了 **0.5**，恰好是它允许的最大值；默认值是 **0.002**。峰值则只有 **270 尼特**，甚至低于当前菜单规定的最低值 300。

这次先备份配置，再同步修正：

| 参数 | 原值 | 修正值 |
|---|---:|---:|
| 最低亮度 | 0.5 | 0.002，游戏自身默认 |
| 峰值亮度 | 270 | 1000 |

1000 尼特来自 [Valve 的 Deck OLED 官方规格](https://www.steamdeck.com/en/tech/oled)，不是对这块面板的实测结果。纸白、色调映射中点和饱和度暂时没有改，也没有通过强加饱和度来掩盖问题。

重新进入游戏后，画面才到了自己满意的状态。这个校准是《2077》保存的 HDR 参数，不应复制成所有游戏的通用答案。

## 串流结束，恢复原来的电脑

显示切换单独由用户服务处理：检测指定 Deck 的活动串流，先保存显示模式、刷新率、缩放、位置和 HDR 状态，再切到 1280×800、约 90Hz、100% 缩放并开启 HDR。

这里还有一个小细节：**恢复快照存在，不等于新模式已就绪。** 游戏包装器等待的是显示切换成功后发布的独立 ready 标记，避免游戏在切换完成前就去查询 HDR 能力。

串流结束或连接断开后，服务删除就绪标记，恢复原来的显示配置。本次最后一轮退出后，日志和实际状态都确认恢复到 4K 160Hz、170% 缩放、HDR 关闭。

这套组合目前是在《2077》上验收通过的。显示切换服务可以围绕其他库内串流会话工作，但 Gamescope 包装器、游戏自己的 HDR 支持、性能和校准仍需逐个确认。能从库里点串流，不等于库里的每一款游戏都自动获得 HDR 或稳定跑满 90 帧。

折腾到最后，最值得保留的不是某个神奇开关，而是验收顺序：先确认输入和画面，再确认游戏 HDR、捕获格式、10 位编码、客户端 HDR 渲染，最后校准画面并验证退出恢复。这样每一步的“成功”，都有对应的证据。
