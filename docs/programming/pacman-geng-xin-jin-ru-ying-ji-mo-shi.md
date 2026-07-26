# Pacman 更新后系统进入应急模式，我是怎么排查的

> 2026-07-26

## 一个普通的更新

像往常一样，我执行了 `sudo pacman -Syu`，更新了 3 个内核（linux-cachyos、lts、rc）和一些相关包，然后重启。

然后我就看到了 emergency mode 的提示。

## 第一反应：/boot 挂了

```bash
systemctl --failed
```

输出只有 boot.mount 失败。`/boot` 挂载不上，系统当然起不来。

检查 fstab 和实际分区：

```bash
blkid | grep vfat
cat /etc/fstab | grep boot
```

UUID 对得上啊？fstab 一直指向的是 Arch 的 EFI 分区，没改过。

## 这就奇怪了

我的环境是两块物理硬盘，各有独立 EFI 分区：
- 盘 A 的 EFI 分区 — Arch 的 `/boot`
- 盘 B 的 EFI 分区 — Windows 的引导

fstab 写死了盘 A 的 UUID，不可能混淆。那为什么更新完就挂不上 `/boot` 了？

## 排查流程

```bash
# 查看错误日志
journalctl -p 3 -xb

# 搜索 mount 相关
journalctl -xb | grep -i "mount\|fstab\|failed"
```

日志里没有明显错误，就是 boot.mount 超时了。

## 快照回滚的意外发现

因为用 Btrfs + Snapper，回滚非常快：

```bash
snapper list
snapper rollback <编号>
reboot
```

回滚后系统立即恢复正常。**但回滚恢复的不是 fstab，而是旧的 initramfs**。

这说明问题出在 initramfs 上。

## 根因：多 EFI 分区让 autodetect 乱了

`mkinitcpio` 的 `autodetect` 钩子在重建 initramfs 时会扫描所有磁盘。当两块硬盘各有一个 EFI 分区时，它会检测到两个 EFI 分区，生成的 initramfs 引用了错误的引导信息。

即使 fstab 写的是正确的 UUID，initramfs 重建时的探测过程已经被"多 EFI"这个事实污染了。

故障链：
1. `pacman -Syu` 更新了 3 个内核
2. `mkinitcpio` 自动重建 initramfs，`autodetect` 扫描到两个 EFI 分区
3. 生成的 initramfs/Limine 配置混淆，引用了错误的引导信息
4. 重启后 `/boot` 挂载失败 → emergency mode

## 验证

第二次更新（同样 3 个内核，同样官方源）：Windows 盘仍在时偶发正常，**擦除 Windows 盘后再也没出现过**。

## 教训

**双盘双系统，物理隔离是最可靠的方案。** 装 Windows 时拔掉 Linux 盘，反之亦然，让两个系统完全不知道对方的存在，就不会有任何引导混淆的问题。

如果已经装好了不方便拔盘，更新前手动创建快照是保险操作。不过最彻底的解决方式，仍然是物理隔离——两块硬盘各自独立，谁也不碰谁的引导。

现在就舒服了，只剩一个 EFI 分区，怎么更新都不会再翻车。
