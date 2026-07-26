# Hologres API 499 超时根因分析

> 2026-07-26

## 现象

Hologres 在每小时特定时间点出现 API 499 超时。慢查询日志显示某大表出现 10 条重查询，每条约消耗 **3GB** 内存，集中在 2 分钟内以成对（COUNT + DATA）方式出现，并发峰值内存约 **44GB**。

## 排除过程

| 假设 | 结论 |
|---|---|
| Cron A 触发关联查询 | ❌ 错误 |
| API B 是查询来源 | ❌ 代码审查确认无任何调用者 |
| Deprecated API C | ❌ 已废弃，无活跃调用者 |

## 真正的根因

一个每 5 分钟执行的定时任务触发了一个 3-way JOIN 重查询：

```
定时任务 (每5分钟)
  └─ 步骤1：写入日志 → MySQL
  └─ 步骤2：同步数据
       └─ syncService.sync() (pageSize=2000, maxFrequency=15)
            └─ ApiClient.getData(params)
                 └─ DataService.getData()
                      └─ Hologres 3-way JOIN:
                           table_a
                           JOIN table_b  ← 每对 ~3GB
                           JOIN table_c
                           └─ queryHelper.paginate()
                                → Promise.all([COUNT查询, DATA查询])
```

## SQL 性能瓶颈

核心查询涉及 3 张大表 JOIN，含大量 text 字段，GROUP BY + 多个聚合函数。

### 5 大性能瓶颈

1. **3-way JOIN**：大表之间的关联，内存开销大
2. **IN 子句**：每次传入大量参数
3. **GROUP BY + 聚合**：内存开销大
4. **COUNT + DATA 并行**：`Promise.all()` 同时执行两条重查询，峰值翻倍
5. **无并发控制**：没有任何查询速率限制

## 优化方案

### P0 — 立即止血

| 方案 | 工作量 | 风险 | 效果 |
|---|---|---|---|
| 切换到只读从库 | 10 分钟 | 零 | 消除超时 |
| 错峰调度 | 5 分钟 | 零 | 避开资源竞争 |

### P1 — 短期优化

| 方案 | 工作量 | 效果 |
|---|---|---|
| 消除不必要的 COUNT | 1-2 小时 | 每次查询减半负载 |
| 缓存静态过滤条件 | 2-3 小时 | 减少 JOIN 开销 |

### P2 — 长期方案

物化视图：将 3-way JOIN 预计算为一张扁平表，从根本解决 JOIN 性能。

## 关键经验

1. **COUNT 查询可能是性能杀手**：`Promise.all([COUNT, DATA])` 并行执行两条重查询，内存峰值翻倍
2. **3-way JOIN 在大表上代价极高**：含大量 text 字段的 JOIN 每次消耗数 GB 内存
3. **Cron 模式无超时**：`statement_timeout: 0` 意味着慢查询永远不会被数据库主动杀死
4. **核心数据管线的 blast radius**：任何改动都需谨慎，涉及数十个下游消费方
