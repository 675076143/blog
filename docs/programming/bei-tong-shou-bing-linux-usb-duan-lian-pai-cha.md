# 北通手柄 Linux USB 断连排查与修复

## 症状

北通 BTP-KP40A 手柄通过 2.4G 无线接收器连接 Linux 时，USB 设备每 ~1 秒断开重连一次。蓝牙模式正常，有线 USB 正常（识别为 Switch 手柄），Windows 上 2.4G 也正常。

## 排查过程

### 第一步：排除硬件

把接收器换到不同 USB 端口（2.0/3.0，直连主板/Hub），问题依旧。手柄在 Windows 上同端口正常工作，确认是 Linux 侧的问题。

### 第二步：排除驱动

- 卸载 `xpad` 模块 — 仍然断连
- 禁用 USB autosuspend — 无效
- 尝试所有 `usbcore.quirks` 组合 — 无效
- 安装 `xboxdrv`（libusb 绕过内核驱动） — 仍然断连

usbmon 抓包显示内核发送 `SET_CONFIGURATION(0) → SET_CONFIGURATION(1)` 序列，设备 ~770ms 后 USB 断开。这个模式看起来像 kernel 在重置设备，但实际原因是——**固件自己在断开**。

### 第三步：Arch Wiki 线索

查到 [Arch Wiki Gamepad 页](https://wiki.archlinux.org/title/Gamepad) 的 ShanWan 专节，提到类似问题。但所有已知 quirk 方案对我的 `20bc:5127` 无效。

## 真正原因

补丁作者 Zixing Liu 在 [linux-input 邮件列表](https://lore.kernel.org/linux-input/20260102030154.197749-2-liushuyu@aosc.io/) 中解释：

> "This series of controllers will try to see if specific Xbox One packets were sent during the probing phase and will power-cycle themselves when they fail to see these packets."

北通/ShanWan 的固件在初始化阶段检测主机操作系统。它等待主机发送 Xbox One GIP（Game Input Protocol）协议包（ACK + ANNOUNCE）。如果 ~1 秒内没收到，固件就断开 USB 重连，尝试下一次。超过 3 次后切换到下一个输入模式（比如 Switch 模式，即 `20dd:5127` DONGLE 模式）。

Windows 上能工作是因为 Xbox 驱动会发这些包。Linux 的 `xpad` 驱动和 `xboxdrv` 都不会发，所以固件认为主机不是 Windows，主动断开。

## 修复

Zixing Liu 提交了补丁，在 `xpad` 驱动中添加 `FLAG_FORCE_INIT` 标志。对 Beitong KP 系列设备，在探测阶段发送 4 个 GIP 初始化包：

```
ACK → ANNOUNCE → ACK → ACK
```

固件收到这些包后，确认主机是 Xbox/Windows 驱动，稳定工作在 XINPUT 模式，不再断连。

## 补丁安装

我已将它做成了 DKMS 包，AUR 可直接安装：

```bash
yay -S xpad-beitong-dkms
```

内核更新后 DKMS 会自动重建模块。

**注意：这是临时方案。** 补丁已由作者提交到 linux-input 邮件列表（v3，2026-07-17），review 通过后将合入主线。预计 Linux 7.3 或后续 rc 版本会包含此修复，届时 DKMS 包即可弃用，直接升级内核即可。

## 后记

这个问题的排查花了很长时间，因为一开始方向错了。usbmon 显示 USB 层 `SET_CONFIGURATION` 重配置，很容易以为是 USB xHCI 驱动的兼容性问题。但实际上 disconnect 是固件主动触发的，不是 USB 核心层的 bug。

回头看，线索其实在 usbmon 数据里：断开前没有 USB 错误（没有 -71 EPROTO），设备是自己"优雅"断开的。但当时没意识到这是固件的主动行为。

另一个教训是：Arch Wiki 虽然提到了 ShanWan 固件问题，但给的 quirk 方案针对的是其他型号。不同的 ShanWan 接收器行为差异很大，需要具体分析。

最后感谢 Zixing Liu 写的补丁，以及 linux-input 邮件列表上的讨论。

## 链接

- [xpad-beitong-dkms (GitHub)](https://github.com/675076143/xpad-beitong-dkms)
- [xpad-beitong-dkms (AUR)](https://aur.archlinux.org/packages/xpad-beitong-dkms/)
- [Patch cover letter (lore.kernel.org)](https://lore.kernel.org/linux-input/20260102030154.197749-2-liushuyu@aosc.io/)
- [Wiki 完整排查记录](https://github.com/675076143/notes/wiki/beitong-btp-kp40a-linux-usb-disconnect)
