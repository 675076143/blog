# CachyOS 游戏串流方案选型与踩坑记录

> 2026-07-26

在 Linux 上做游戏串流，方案其实比 Windows 更丰富——但也意味着更容易选错。本文对比了目前主要的开源方案，并记录了在 CachyOS / KDE Wayland 上的实战配置。

## 方案一瞥

| 项目 | ⭐ Stars | 虚拟屏 | 适合场景 |
|---|---|---|---|
| **Sunshine** | **39.5k** | ❌ 需外挂 | 通用串流，最成熟 |
| **Apollo** | **10.3k** | ❌ Windows only | Windows 头戴式主机 |
| **Wolf** | **2k** | ✅ 原生 Docker 级 | 多用户共享主机 |
| **Hermes** | **79** | ✅ 零拷贝内核模块 | CachyOS 专用，技术最先进 |
| **Sunveil** | **4** | ✅ krfb 钩子方案 | Sunshine 虚拟屏补丁 |

社区选 Sunshine 的理由很简单：39.5k star，文档完善，遇到问题能搜到答案。

虚拟显示器是 Linux 串流的痛点——没有物理显示器时，需要创建一个虚拟显示器让串流服务捕获。Sunshine 本身不提供这个功能，需要补丁。

## 最终选型：Sunshine + Sunveil

Sunveil 是一套 ~200 行的 Shell 脚本，通过 KDE 内置的 `krfb-virtualmonitor` + `kscreen-doctor` 创建虚拟显示器，与 Sunshine 松耦合。纯用户态，零风险，升级卸载都简单。

## 安装配置全流程

### 1. 安装 Sunshine

```bash
sudo pacman -S sunshine
sudo setcap cap_sys_admin+p $(readlink -f $(which sunshine))
systemctl --user enable --now app-dev.lizardbyte.app.Sunshine
```

### 2. 防火墙放行

Sunshine 需要以下端口（UFW INPUT 默认为 DROP 时需要放行）：

```bash
sudo ufw allow 47984/tcp   # HTTPS
sudo ufw allow 47989/tcp   # HTTP 基础连接
sudo ufw allow 47990/tcp   # Web UI
sudo ufw allow 48010/tcp   # RTSP 会话
sudo ufw allow 47998:48000/udp  # 视频/音频/控制
sudo ufw allow 48002/udp   # 麦克风
```

注意：UFW 显示 `inactive` 不代表 nftables 规则没生效。检查方式：`sudo nft list ruleset | grep -A5 ufw-user-input`

### 3. 虚拟显示器（Sunveil）

```bash
git clone https://github.com/ImStillBlue/sunshine-virtual-display.git
cd sunshine-virtual-display
sudo pacman -S krfb
./install.sh --yes
sudo usermod -aG input $USER  # 重新登录生效
```

### 4. Moonlight 配对

手机安装 Moonlight 或 Artemis，浏览器打开 `https://<主机IP>:47990` 输入配对 PIN 即可。

## 踩坑记录

### KDE 6.7.3 screencast 协议被移除

KDE Plasma 6.7.3 移除了 `zkde_screencast_unstable_v1` 协议。Sunveil 安装时写入的 `capture = kwin` 会导致 Sunshine 启动时报错。

**解决方案：不要设置 `capture = kwin`，让 Sunshine 用默认的 XDG Portal 模式自动捕获。**

### 重启后配对丢失

Sunshine 重启后有时配对信息会丢。发现 Moonlight 报 error 0 时先检查：

```bash
curl http://127.0.0.1:47989/serverinfo | grep PairStatus
# PairStatus=0 → 需要重新配对
```

打开 `https://localhost:47990` 获取 PIN，重新输入即可。

### setpriority 权限

```
Warning: setpriority failed for nice -15: 权限不够
```

Sunshine 想提高编码线程优先级，但普通进程不允许：

```bash
sudo setcap cap_sys_nice=eip /usr/bin/sunshine
```

### Clash TUN 模式干扰

Clash Verge 的 TUN 模式会劫持 LAN 入站流量，即使 GUI 关闭了，mihomo 核心进程可能还在后台跑。检查：

```bash
pgrep -a mihomo
kill <pid>  # 手工关闭
```

### 串流闪烁

偶尔闪一下，通常是其他窗口（通知、弹窗）短暂出现在虚拟显示器上。关闭不需要的通知，或设置 Sunshine 全屏捕获即可。

## 诊断命令

```bash
# hook 日志
tail -f ~/.config/sunshine/hooks/hook.log

# Sunshine 状态
systemctl --user status app-dev.lizardbyte.app.Sunshine

# 端口监听检查
ss -tlnp | grep -E '479[0-9]{2}|480[0-9]{2}'
```

## 小结

Sunshine + Sunveil 是目前 Linux 游戏串流最成熟的组合。虽然配置步骤比 Windows 上多一些，但每一步都有明确的解决方案。对于画面质量要求不高、追求低延迟的局域网串流场景，这套方案完全可用。
