# PHP-FPM SIGSEGV Connection Reset 故障排查实录

> 2026-07-26

## 现象

某个数据接口在 3.5 分钟内出现了 16 次 nginx "Connection reset by peer" 错误：

```
recv() failed (104: Connection reset by peer) while reading response header from upstream
```

涉及两种请求参数，且所有错误来自 **同一个 Pod**。

## 排查方法论：Pod 级故障隔离

### Step 1：排除上游

Ingress 日志显示所有上游响应正常（< 114ms），排除上游 API 慢的假设。

### Step 2：排除节点

故障 Pod 所在节点上有 5 个同 Deployment 的副本 + 其他命名空间的 Pod，**全部零错误**。排除节点级别问题（内核、网络、内存）。

### Step 3：排除代码

同一时间段，其他 4 个副本使用完全相同的代码和配置，正常运行。排除代码 Bug 或配置错误。

### Step 4：锁定根因

在故障 Pod 的 PHP-FPM 错误日志中，发现 16 条 SIGSEGV 记录，与 16 次 Connection reset **一一对应**。

## 根因分析

### 直接原因链

```
PHP worker 进程 — SIGSEGV (signal 11) 段错误
  → PHP-FPM 进程被内核强制杀死
  → 内核清理资源，关闭 TCP socket 时发送 RST
  → nginx recv() 返回 Connection reset by peer
```

### 死亡螺旋模式

```
07:20:48  Worker A 崩溃（存活 1717s）
07:20:57  Worker B 崩溃（存活 818s）
07:21:03  Worker C 崩溃（存活 123s）
07:21:04  Worker D 崩溃（存活 1099s）
07:21:07  Worker E 崩溃（存活 861s）
         ╔══════════════════════════╗
         ║  死亡螺旋开始            ║
         ╚══════════════════════════╝
07:21:10  Worker F 崩溃（存活 7.6s）
07:21:11  Worker G 崩溃（存活 7.1s）
07:21:11  Worker H 崩溃（存活 14.4s）
07:21:13  Worker I 崩溃（存活 759s）← 幸存者
...
07:24:16  Worker X 崩溃（存活 14.0s）
```

**模式解读**：
- 前 5 个 worker 存活时间 123~1717s → 各自执行不同代码路径，只有命中损坏数据的才崩
- 07:21:10 之后新 worker 在 7~60s 内崩溃 → **共享内存已被污染**
- 个别 worker 存活较长 → 可能处理了不涉及损坏路径的请求

### 为什么 JIT 是最大嫌疑

1. JIT 确实开着（`opcache.jit=1255`，`jit_buffer_size=256M`）
2. JIT 编译是非确定性的 → 每个 Pod 是否触发 JIT 取决于请求分布，完美解释"同镜像只崩一个"
3. PHP 8.1 的 JIT 有已知的 segfault 问题，特别是在 Alpine（musl libc）上
4. 故障 Pod 的请求量比其他 Pod 多 50-75%，更容易达到 JIT "热点"阈值

### 证据分级

| 层级 | 内容 | 确定性 |
|---|---|---|
| ✅ 确凿 | PHP-FPM worker 因 SIGSEGV 崩溃，与 Connection reset 一一对应 | 100% |
| ✅ 确凿 | 只发生在单个 Pod，其他副本零错误 | 100% |
| ✅ 确凿 | JIT 已开启 | 100% |
| 🟡 强推论 | 死亡螺旋 → 共享内存被污染 | ~90% |
| ⬜ 最大嫌疑 | JIT 编译缺陷触发 SIGSEGV | 无法确认 |

**关键缺口**：没有 core dump，无法确定 crash 时停在哪个函数。

## 处理建议

### 立即止损

```bash
# 删除故障 Pod，K8s 自动重建，清除损坏的共享内存
kubectl delete pod <pod-name>
```

### 诊断方案

| 方案 | 操作 | 目的 |
|---|---|---|
| 关闭 JIT 观察 | `opcache.jit=0` | 最直接的诊断手段 |
| 开启 core dump | `ulimit -c unlimited` | 看 crash 时停在哪个函数 |
| 降低 opcache 压力 | 减少 `max_accelerated_files` | 排除 opcache 内存压力 |

### 预防措施

| 优先级 | 措施 |
|---|---|
| 短期 | 监控 SIGSEGV 自动自愈（N 分钟内 > M 次则自动重启 Pod） |
| 短期 | 限流防护（`request_terminate_timeout=300s`） |
| 中期 | 升级 PHP 到 8.3+（修复大量 JIT/opcache segfault） |
| 中期 | 增加存活探针 |

## 经验总结

1. **Pod 级故障隔离**是 K8s 环境下定位问题的利器——同镜像只崩一个 Pod，本身就是最重要的线索
2. **慢查询不够，要看段错误**——SIGSEGV 不会出现在慢查询日志里，需要单独监控
3. **JIT 是把双刃剑**——性能提升的同时引入了非确定性的段错误风险，线上环境需要配套监控和自愈机制
