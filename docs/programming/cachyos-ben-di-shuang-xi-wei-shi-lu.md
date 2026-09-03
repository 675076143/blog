# 一台 Linux，两套键鼠，两个人同时用：CachyOS 本地双席位实录

> 2026-09-04

Windows 上有 ASTER 这类 multiseat 软件：一台主机接两套显示器、键盘和鼠标，两个人同时登录、同时使用。到了 2026 年，Linux 没理由做不到吧？

事实证明，Linux 确实做得到，而且标准组件已经覆盖了最重要的部分。真正折磨人的不是“启动两个桌面”，而是登录管理器、GPU 输出归属，以及同一台显示器在两个席位之间切换时那些藏得很深的边界条件。

这篇文章记录一台 CachyOS 主机从设想到稳定落地的完整过程，包括走通的方案、失败的四线双屏实验，以及最后为什么主动收敛成三线。

## 最终效果

主机硬件：

- Ryzen 9 7950X，带 Raphael 核显；
- RX 7900 XTX 24 GB；
- TCL 27C2A Pro 与 IOC 27M2V-D 两台 4K 高刷显示器；
- 两套独立键盘、鼠标。

最终分配：

| 席位 | 用户 | 桌面 | 显示 GPU | 显示器 |
|---|---|---|---|---|
| seat0 | robin | Hyprland 或 Plasma | RX 7900 XTX | TCL |
| seat1 | Ruby | Plasma Wayland | Ryzen 核显 | IOC |

两个人可以同时登录，键鼠互不串位。Ruby 的桌面由核显合成和输出，游戏则可以通过 PRIME Offload 交给 RX 7900 XTX 渲染。也就是说，“显示器接核显”不等于“只能用核显性能”。

## Linux multiseat 的核心不是虚拟机

这套方案没有运行虚拟机，也没有容器桌面。systemd-logind 原生支持多个 seat，每个 seat 拥有自己的：

- GPU KMS 设备；
- 显示器；
- 键盘和鼠标；
- 登录会话；
- 用户目录、D-Bus 与 systemd user manager。

设备通过 udev 规则持久分配给 `seat0` 和 `seat1`。两张 GPU 的 render node仍可被普通进程访问，所以第二席位可以跨 GPU 渲染：

```bash
MESA_VK_DEVICE_SELECT=1002:744c! vkcube
```

实测链路是：7900 XTX 渲染 → DMA-BUF 跨 GPU 传帧 → 核显 KWin 合成 → 主板 DP 输出。这比远程桌面或串流更直接，也不需要第二台客户端。

## 第一个坑：Plasma Login Manager 不是两个 greeter

最初使用 Plasma Login Manager。它能发现两个 logind seat，也会为两个席位创建 helper，看上去离成功只差一步。

问题是两个 helper 共用 `plasmalogin` 账号下的单实例 systemd user services。两个 greeter 会争抢同一组 KWin 与 Plasma 登录服务，结果只有一个席位能稳定显示登录页；重启后甚至出现 seat1 正常、seat0 黑屏的随机竞态。

这不是设备分配错误。GPU 和键鼠仍属于正确的 seat，失败发生在登录管理器的多 greeter 生命周期。

最终改用 Atrium。它面向 logind multiseat，会为每个 seat 启动独立 greeter，并能发现系统里的 Hyprland 与 Plasma Wayland 会话。实际重启后，两边登录、注销与并行会话都跑通了。

## 第二个坑：注销为什么要等四十秒

Plasma 注销后，Atrium 有时要近一分钟才重新出现。日志最后定位到：

```text
plasma-plasmashell.service
TimeoutSec=40
```

plasmashell 没有及时退出，systemd 一直等到 40 秒超时。给用户服务增加明确的退出命令和 5 秒停止超时后，注销恢复正常：

```ini
[Service]
ExecStop=/usr/bin/kquitapp6 plasmashell
TimeoutStopSec=5s
```

这个问题和 multiseat 没直接关系，但在频繁登录、注销测试时会被放大得非常明显。

## 想让一个人临时用双屏

双人使用时，两块屏各归一个席位；只有一个人时，主用户自然希望临时借走另一块屏。

最终采用三根线：

```text
RX 7900 XTX DP    → TCL    # seat0 主屏
RX 7900 XTX HDMI1 → IOC    # seat0 临时借屏
Raphael iGPU DP   → IOC    # seat1 固定主屏
```

正常双席模式下，TCL 显示 seat0，IOC 显示 seat1。seat0 借屏时，脚本先启用独显 HDMI 输出，再通过 DDC/CI 把 IOC 从核显 DP 切到独显 HDMI1；归还时先切回 DP，再关闭独显 HDMI 输出。

IOC 的输入切换使用 VCP `0x60`：

```bash
# DP1
ddcutil setvcp 60 0x0f --bus 4 --noverify

# HDMI1
ddcutil setvcp 60 0x11 --bus 13 --noverify
```

DDC bus 会随当前输入变化，因此从 DP 切走时通过核显 DP 的 bus 13，下次从 HDMI 切回时通过独显 HDMI 的 bus 4。显示器切走后旧链路来不及回复，`ddcutil` 可能报告通信失败，但切换实际上已经完成，所以这里使用 `--noverify` 并容忍命令退出状态。

运行状态保存在 `/run/multiseat-display-mode`，每次开机由 systemd-tmpfiles重新创建为 `shared`。即使上次在双屏模式下断电，重启也始终优先恢复两个人都有画面的安全状态。

## 失败实验：四根线为什么没有留下

为了让任意席位都能借用另一块屏，我曾增加第四根线：

```text
Raphael iGPU HDMI1 → TCL
```

理想状态是两张 GPU 都各接两台显示器，由软件控制 DP/HDMI 是否输出，让显示器自动选择仍有信号的输入。三种状态都能表达得很漂亮：双席、seat0 双屏、seat1 双屏。

现实是 Ruby 选择 Plasma Wayland 后，KWin 每次都在启动阶段失败：

```text
Applying output configuration failed!
There are no outputs - creating placeholder screen
```

Plasma 和 plasmashell 其实已经启动，只是 KWin 退到零输出占位屏。显示器继续保留 Atrium 的最后一帧，看起来就像登录界面卡死。

为了确认不是误诊，先后测试了：

- 删除并重建 `kwinoutputconfig.json`；
- IOC 从 4K 160 Hz 降到 4K 60 Hz；
- Cage 的 `last` 与 `extend` 模式；
- 登录前关闭 HDMI；
- 登录前同时启用 DP 与 HDMI；
- 调整 watcher 权限、席位识别和切换顺序。

结果始终一样。拔掉核显 HDMI 后，已经在后台运行的 Plasma 会立刻接管 IOC。

最有价值的对照实验是：完全相同的四根线，Ruby 改选 Hyprland 后可以正常启动并驱动核显双输出。这证明核显硬件、AMDGPU 驱动、接口带宽和 logind 分席本身都支持双屏；失败点是当前 KWin 6.7.4、Raphael 核显双连接器与 Atrium DRM 交接形成的特定组合。

但 Ruby 是这台机器的新手用户。一个需要学习 Hyprland 快捷键才能绕过显示兼容问题的方案，不算完成。最终删除第四根线，接受 seat1 不借用 TCL，换取 Plasma 每次都能可靠登录。

## 最后的取舍

最终方案没有实现最对称的功能，却实现了真正重要的目标：

- 两个人可以同时使用同一台 Linux 主机；
- 两套输入设备与桌面会话完全隔离；
- 第二席位不需要客户端；
- 第二席位可以共享高性能独显渲染；
- 主用户单独使用时仍能一键借用第二块显示器；
- 新手席位保留熟悉的 Plasma；
- 每次重启都有确定、可恢复的默认状态。

Linux multiseat 在 2026 年不是做不到，而是缺少 ASTER 那样把硬件差异、登录管理器和桌面合成器边界统一包起来的产品。标准组件已经足够强，但最后 10% 的集成仍然需要理解 DRM、logind、Wayland compositor 和显示器输入切换。

这次最重要的经验不是“Hyprland比 KWin 强”，也不是“核显不能双屏”，而是不要把某个组合的 atomic modeset 失败误判成整个平台的能力边界。把每一层拆开验证，最后才能知道应该修、应该绕，还是应该诚实地少要一个功能。
