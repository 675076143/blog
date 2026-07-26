# Linux Docker 替代方案：2026 年容器选型指南

> 2026-07-26

Docker 虽然仍是容器的事实标准，但这两年替代方案已经非常成熟了。如果你在 Linux 上跑容器，不一定非要绑死在 Docker Engine 上。

本文对比 Podman、nerdctl、Colima、Rancher Desktop 四个方案，给出选型建议。

## 方案概览

| 项目 | ⭐ Stars (2026) | 维护方 | 架构 | 许可证 |
|---|---|---|---|---|
| **Podman** | ~32k | Red Hat | Daemonless，fork/exec | Apache 2.0 |
| **nerdctl** | ~10.2k | CNCF | containerd CLI 前端 | Apache 2.0 |
| **Colima** | ~30k | 社区 | VM + dockerd/containerd | MIT |
| **Rancher Desktop** | ~7.2k | SUSE | GUI + containerd/moby + k3s | Apache 2.0 |

## 性能实测

| 指标 | Docker Engine | Podman | nerdctl (+containerd) |
|---|---|---|---|
| 容器冷启动 | ~160ms | **~120ms** | ~140ms |
| 空闲内存 (引擎) | ~140-180MB | **~42-60MB** | ~75MB |
| 空闲 CPU | 0.5-1.2% | **0.1-0.3%** | 接近 Docker |
| 网络吞吐 (rootful) | ~98% 原生 | ~98% 原生 | ~98% 原生 |
| 网络吞吐 (rootless) | ~65-70% | ~85-90% (pasta) | **~92-95%** |
| 镜像构建 | 基准 (BuildKit) | -5% (Buildah) | -8% (BuildKit) |
| 大规模扩展性 | daemon 瓶颈 | **线性扩展** | 线性扩展 |

Podman 最大的优势是 daemonless 架构：没有常驻守护进程，系统启动不需要先等 Docker daemon 起来。空闲时只占 ~42MB 内存，对比 Docker 的 ~140MB 节省明显。

## Docker Compose 兼容性

| 方案 | 方式 | 兼容度 |
|---|---|---|
| **Podman** | `podman-compose` 或 Docker Compose 连 `podman.socket` | 基础 OK，socket 方式最可靠 |
| **nerdctl** | 内置 `nerdctl compose` | 好，极少边缘 flag 缺失 |
| **Colima** | 原生 Docker Compose v2 | **完全兼容** |
| **Rancher Desktop** | 看后端选哪种 | 兼容 |

## 各方案适用场景

- **Podman** — 日常开发首选。daemonless + rootless 原生 + 低内存，CI/CD 安全场景优势明显。Arch/CachyOS 上 `sudo pacman -S podman podman-docker` 就能无缝替代 Docker CLI
- **nerdctl** — containerd/K8s 节点调测，需要 BuildKit 高级构建或 Stargz 延迟拉取的场景
- **Colima** — macOS 上实用，Linux 上意义不大（VM 套壳 dockerd）
- **Rancher Desktop** — 需要 GUI 且同时跑 K8s 本地集群的场景

## 我的方案

在 CachyOS 上，目前 Podman 体验最好：

```bash
sudo pacman -S podman podman-docker docker-compose
systemctl --user enable --now podman.socket
```

- `podman-docker` 创建 `/usr/bin/docker` 软链指向 podman，CLI 完全不变
- `podman.socket` 暴露 Docker API socket，兼容所有需要 `/var/run/docker.sock` 的工具
- `docker compose` 直接走 Podman socket，体验和 Docker 一模一样

切换之后最直观的感受：系统启动快了（不需要等 Docker daemon），空闲时内存占用少了 100MB 以上，日常使用完全无感。
