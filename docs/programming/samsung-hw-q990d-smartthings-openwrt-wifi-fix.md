# 买了一年的三星 HW-Q990D，终于连上 SmartThings 了

> 2026-08-02

三星 HW-Q990D 买回来整整一年，SmartThings 一直连不上。

这一年里，我怀疑过 App、三星账号、手机权限、路由器、防火墙和 DHCP。最后真正让它连上的改动却很小：给回音壁单独准备一个 2.4 GHz WPA2 网络，并把无线模式从 **802.11ax 改成 802.11n**。

这篇文章记录完整的判断过程。比最终答案更重要的是，路由器日志其实早已告诉我：问题根本还没走到 SmartThings 云端。

## 我的网络环境

- 回音壁：Samsung HW-Q990D
- 路由器芯片：MediaTek MT7986
- 路由系统：OpenWrt
- 2.4 GHz 主网络：WPA2/WPA3 mixed，802.11n/ax
- 2.4 GHz 兼容网络：WPA2-PSK（CCMP）

路由器上原本有两个 2.4 GHz SSID：日常设备使用 `Robin-2.4G`，旧设备使用 `RobinLegacy`。后者已经是 WPA2，但回音壁依然无法完成配网。

## 每隔五秒连接一次

SmartThings 配网时，OpenWrt 内核日志不断出现同一组记录：

```text
MacTableInsertEntry(): New Sta:28:af:42:7a:44:73
wifi_sys_disconn_act(): wdev_idx=2
MacTableDeleteEntry(): Del Sta:28:af:42:7a:44:73
```

`28:af:42:7a:44:73` 是回音壁的 MAC 地址。它会进入路由器客户端表，约 4～5 秒后被删除，然后马上重试。

这至少说明两件事：

1. 回音壁的 Wi-Fi 模块并没有坏，路由器确实收到了它。
2. 连接是在无线关联阶段中断的，而不是 SmartThings 单纯搜索不到设备。

## 正常连接少了哪几步

同一台路由器上，正常客户端加入 Wi-Fi 时会留下完整过程：

```text
Recv Assoc from STA
ASSOC response (Status=0)
send Msg1 of 4-way
Receive msg 2
send Msg3 of 4-way
Receive msg 4
AP SETKEYS DONE
```

这就是关联成功并完成 WPA 四次握手。

回音壁的日志却只有 `MacTableInsertEntry`，之后直接 `MacTableDeleteEntry`。它没有走到 `Recv Assoc`，更没有开始四次握手。

因此可以先排除一大批方向：

- DHCP 地址池
- 固定 IP
- DNS
- UPnP
- 外网访问
- SmartThings 云端

这些都发生在 Wi-Fi 成功关联之后。回音壁当时甚至还没有真正加入局域网。

## 一堆很吓人的 MT7986 日志

排查期间还看到了这些错误：

```text
FT_R1khEntryTab full.
The entry in R1KH table doesn't exist
AP SETKEYS DONE(rax0) - AKMMap=FT-SAE
```

`FT-SAE` 是 WPA3-SAE 与 802.11r 快速漫游的组合，R1KH 则是 802.11r 使用的密钥持有者表。这里显然存在表已满或表项管理异常。

不过，对照 MAC 地址后发现，这些 FT 日志来自其他客户端，不能直接断言它就是回音壁失败的原因。它真正提供的线索是：这个 MT7986 无线环境启用了不少高级特性，而 IoT 设备通常更需要保守、简单的兼容配置。

另外几类日志也和本次故障无关：

- `GroupRekeyExec` 后紧跟 `AP SETKEYS DONE`：其他客户端成功完成组密钥更新。
- `miniupnpd` 端口映射过期或返回 404：这是应用层行为。
- 其他 MAC 的 `DE-AUTH reason=3`：表示其他客户端主动离开 AP。

日志级别是 `kern.err`，不代表它一定是当前问题的根因。先对上设备 MAC 和事件时间线，比盯着 `error` 单词可靠得多。

## 最终解决方案

我让 HW-Q990D 连接独立的兼容网络：

```text
频段：2.4 GHz
无线模式：802.11n
加密：WPA2-PSK
密码算法：AES/CCMP
```

最关键的一步是：**模式选 n，不选 ax。**

修改完成后重新通过 SmartThings 添加，困扰了一年的回音壁终于成功上线。

回音壁只需要传输控制指令、状态以及固件更新，802.11n 的性能绰绰有余。802.11ax 对它没有实际价值，反而可能暴露设备固件与 AP 驱动在关联帧或高级能力协商上的兼容问题。

## 推荐的 OpenWrt 兼容配置

如果其他 SmartThings 或 IoT 设备也遇到类似问题，可以先新建一个独立 SSID，不必降低全家主网络的配置：

```text
频段：2.4 GHz
模式：802.11n（或 b/g/n）
信道：固定 1、6 或 11
带宽：20 MHz
加密：WPA2-PSK
算法：AES/CCMP
```

同时关闭：

- WPA3/SAE 与 WPA2/WPA3 mixed mode
- 802.11r 快速漫游
- 802.11k/802.11v 漫游辅助
- 强制 PMF/802.11w
- 双频合一与频段引导
- 弱信号踢除和最低 RSSI 门槛

我的故障现场还使用了 2.4 GHz 信道 13。部分不同销售地区的设备对信道 12/13 支持不一致，因此兼容网络最好固定在 1、6 或 11。本次没有单独做控制变量实验，不能说信道 13 是唯一原因，但它确实是不必要的风险。

修改后建议完整重启一次无线或路由器，尤其是在日志已经出现 `FT_R1khEntryTab full` 时，避免驱动内残留状态影响测试。

## 回音壁重新配网

1. 手机先连接准备好的 2.4 GHz 兼容 SSID。
2. 暂时关闭移动数据、VPN和自动切换网络。
3. 检查 SmartThings 的附近设备、蓝牙、位置及本地网络权限。
4. 保持回音壁开机，同时按住机身音量 `+` 和 `-`。
5. 看到显示屏出现 `INIT` 后松开，再重新添加设备。

三星官方也建议 SmartThings 无法连接时确保网络可见、信号足够，并尝试重启路由器及调整 2.4 GHz 信道：

- [SmartThings：设备无法识别或连接](https://www.samsung.com/us/support/troubleshoot/TSG10007331/)
- [SmartThings 无法发现局域网 Wi-Fi 设备](https://www.samsung.com/us/support/troubleshoot/TSG10007239/)

## 后记

这个问题拖了一年，是因为“SmartThings 连接失败”很容易让人把注意力放在 App 和云服务上。但真正有价值的证据一直在 AP 日志里：设备每五秒出现一次，却始终没有完成关联和 WPA 四次握手。

排障时先判断失败发生在哪一层：

```text
无线扫描 → 关联 → WPA 握手 → DHCP → 局域网 → 互联网 → 云服务
```

只要确认链路停在哪一步，后面的所有层都可以暂时不看。

最终答案简单得有点荒唐：**独立 2.4 GHz、WPA2-AES、802.11n。**

一年，终于好了。
