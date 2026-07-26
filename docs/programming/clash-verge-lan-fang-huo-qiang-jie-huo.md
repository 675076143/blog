# Clash Verge 局域网连接被防火墙拦截

> 2026-07-26

## 问题

Clash Verge 开启 LAN 连接后，同一局域网的其他设备无法连接代理（连接超时）。本机端口监听在 `*:7897`，本机 curl 正常，但其他设备始终连接不上。

## 根因

**UFW 防火墙规则拦截**了入站 TCP 连接。UFW 默认 INPUT 策略为 DROP，Clash 的混合端口（7897）不在白名单中。

### 诊断步骤

```bash
# 1. 检查端口监听是否在 0.0.0.0
ss -tlnp | grep 7897

# 2. 检查防火墙规则
sudo iptables -L -n -v
# 如果看到 ufw-* chain，说明 UFW 在管控

# 3. 从其他设备测试连通性
timeout 3 bash -c 'echo > /dev/tcp/<主机IP>/7897' && echo OK || echo FAIL
```

关键区别判断：
- **ICMP 通但 TCP 不通** → 防火墙拦截入站 TCP
- **本机能连其他设备，但其他设备连不进来** → INPUT chain 默认 DROP

## 解决方案

```bash
# UFW 方式（推荐）
sudo ufw allow 7897/tcp

# 无 UFW 时用 iptables
sudo iptables -A ufw-user-input -p tcp --dport 7897 -j ACCEPT
```

### 验证

在其他设备上：

```bash
timeout 3 bash -c 'echo > /dev/tcp/<主机IP>/7897' && echo OK || echo FAIL
# OK

curl -x http://<主机IP>:7897 -s -o /dev/null -w "%{http_code}" http://www.gstatic.com/generate_204
# 204
```

## 其他排查要点

- 确认 `allow-lan: true` 已在 Clash 配置中
- 确认 `bind-address` 没有被设为 `127.0.0.1`
- 双网卡同子网时检查 `rp_filter` 设置
- 路由器的 AP 隔离（客户端隔离）也会导致类似现象
