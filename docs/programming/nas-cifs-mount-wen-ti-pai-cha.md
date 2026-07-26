# Linux NAS CIFS 挂载问题排查与解决

> 2026-07-26

## 问题

项目需要访问 NAS 上的共享文件，通过 SMB/CIFS 协议挂载。挂载失败表现为 `mount error(101): Network is unreachable` 或连接超时。

## 排查步骤

### 1. 检查网络连通性

```bash
# 检查 IP 是否可达
ping -c 1 <NAS_IP>

# 检查 mDNS 解析
getent hosts <nas-hostname>.local

# 检查 SMB 端口
timeout 3 bash -c 'echo > /dev/tcp/<NAS_IP>/445'
```

### 2. 检查 systemd service 状态

```bash
systemctl status mount-nas.service
journalctl -u mount-nas.service -n 20
```

### 3. 检查挂载点和凭据

- 挂载点应存在且为空目录
- 凭据文件权限应为 `600`

### 4. 确认 CIFS 工具已安装

```bash
which mount.cifs  # 应返回 /usr/bin/mount.cifs
```

## Systemd Service 配置参考

```ini
[Unit]
Description=Mount NAS share (SMB/CIFS)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/mount.cifs //<NAS_IP>/share /mnt/nas \
    -o credentials=/path/to/.credentials,vers=3.0,uid=1000,gid=1000
ExecStop=/usr/bin/umount /mnt/nas

[Install]
WantedBy=multi-user.target
```

## 常见问题

| 问题 | 原因 | 解决 |
|---|---|---|
| `Network is unreachable` | 网络不可达 | 检查网线/WiFi，确认 NAS 在线 |
| 连接超时 | SMB 端口被防火墙阻挡 | 检查 NAS 和本机防火墙 |
| `permission denied` | 未使用 sudo | `sudo systemctl start mount-nas` |
| `mount error(13)` | 凭据错误 | 检查凭据文件内容 |
| `mount error(22)` | 参数错误 | 尝试 `vers=2.0` 或 `vers=3.0` |

## 开机自动挂载

```bash
sudo systemctl enable --now mount-nas.service
```

如果开机后未挂载，检查 `systemctl status` 看启动顺序是否在 network 就绪之前。
