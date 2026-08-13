# GitLab CI 流水线优化实录：构建快了 70%，总耗时却变长了

> 2026-08-13

最近对一个 Laravel 服务的 GitLab CI/CD 流水线做了一轮优化。最初的目标很直接：减少重复工作，加快 Docker 构建，并让 preview 环境更快可用。

最终 Composer 快了约 70%，PHP-FPM 镜像构建快了约 55%，但端到端流水线从 3 分 13 秒变成了 3 分 52 秒。

这并不是一次失败的优化。流水线多出来的时间，被用于真正等待 Kubernetes 发布完成、执行语法检查和部署后测试。相比一个很快变绿、应用却可能无法启动的流水线，我更愿意接受这个结果。

这篇文章记录本轮改造中真正有效的手段，以及几个比优化本身更有价值的坑。

## 原始流水线的问题

原来的大致流程是：

```text
MR 更新
  → 聚合 preview 分支
  → Composer 安装
  → 构建两个 Docker 镜像
  → kubectl apply
```

主要问题有：

1. 每个 MR 都可能做重复的依赖安装和测试。
2. Docker 每次接近全量构建，没有稳定复用远端缓存。
3. preview 聚合分支并发更新时容易互相覆盖。
4. 有 MR 冲突时，整个 preview 发布会被阻断。
5. `kubectl apply` 成功就被当作部署成功，没有等待 Pod rollout。
6. 部署使用可变 tag，无法确认实际运行的镜像内容。
7. 新 preview 到来时，旧流水线还在继续消耗 Runner。

## Preview 分支：允许部分成功，但必须明确告警

preview 环境的目标不是证明所有 MR 都能合入，而是尽快发布当前可集成的改动。

因此聚合逻辑调整为：

```text
以 release 为基线
  → 依次合并所有打开的 MR
  → 冲突分支 abort 并跳过
  → 继续合并其他分支
  → 与远端 preview 比较
  → 有差异才推送
```

如果存在冲突，聚合 job 最终返回非零状态，但配置 `allow_failure: true`。GitLab 会把它显示为 warning，后续 preview 构建和部署仍然继续。

这个状态比直接成功更准确：环境可以用，但并不完整。

并发更新则使用两层保护：

- `resource_group` 串行化 preview 分支写入；
- `git push --force-with-lease` 携带明确的远端 SHA，并在竞争失败时重试。

它解决了普通 `--force` 可能覆盖其他流水线结果的问题。

## 新 Preview 到来时，取消旧流水线

preview 是一个不断移动的集成环境。新的 preview commit 已经生成后，旧 commit 的构建和部署通常没有继续执行的价值。

因此将可安全中断的 job 标记为：

```yaml
interruptible: true
```

同时给 preview 部署增加独立的 `resource_group`，避免两个版本同时修改同一个 Kubernetes 环境。

实际验收中可以看到：新 preview 出现后，旧流水线会在 Composer、Docker 构建或部署阶段被取消。这不仅节省 Runner，也避免旧版本晚于新版本部署完成。

## Docker：远端缓存与不可变镜像

两个镜像并行构建，并使用仓库中的固定 cache tag 保存 BuildKit inline cache：

```bash
docker pull "$CACHE_IMAGE" || true

docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --cache-from "$CACHE_IMAGE" \
  -t "$COMMIT_IMAGE" \
  -t "$CACHE_IMAGE" .

docker push "$COMMIT_IMAGE"
docker push "$CACHE_IMAGE"
```

构建完成后，不再把 tag 直接交给部署，而是解析 registry digest：

```bash
IMAGE_REF=$(docker inspect --format='{{index .RepoDigests 0}}' "$COMMIT_IMAGE")
echo "IMAGE_REF=$IMAGE_REF" > image.env
```

通过 dotenv artifact 传给部署 job，Kubernetes 最终使用：

```text
registry.example.invalid/backend@sha256:...
```

这样 staging 和 production 可以复用完全相同的镜像，避免 tag 被覆盖后出现“同一个版本，实际内容不同”。

实测 PHP-FPM 镜像从 106 秒降到 48 秒，提升约 55%。不过另一个镜像受构建上下文和缓存层变化影响，单轮反而从 61 秒升到 124 秒。单次结果不能证明缓存策略稳定，必须观察多轮。

## Composer：缓存命中了，为什么还是慢

Composer 是这次最绕的一段。

### 第一次尝试：不再重复缓存 vendor

原配置同时把 `vendor` 放进 GitLab cache 和 artifact：

- cache 负责跨流水线复用；
- artifact 又负责传给 PHPUnit。

这会重复压缩、上传和下载同一批文件。我将 cache 改为 Composer dist 下载缓存，artifact 只保留构建真正需要的内容：

```yaml
variables:
  COMPOSER_CACHE_DIR: .composer/cache

cache:
  key:
    prefix: composer-dist-v1
    files:
      - composer.json
      - composer.lock
  policy: pull-push
  paths:
    - .composer/cache/files/

artifacts:
  paths:
    - vendor/
    - resources/views/vendor/horizon/
```

结果连续几轮仍然是 55～65 秒。

### 缓存有 659 个文件，却没有解决问题

日志显示缓存已成功恢复，说明 GitLab cache 本身没有问题。真正关键的日志是：

```text
No composer.lock file present. Updating dependencies to latest...
```

仓库一直把 `composer.lock` 放在 `.gitignore` 中。所谓的 `composer install`，每轮都要先在线解析数百个依赖，行为接近一次 update。镜像站部分 dist URL 返回 404 后再逐个 fallback，又增加了额外网络开销。

把现有 lock 文件纳入版本控制后，Composer 从 60～73 秒降到了 22 秒，提升约 63%～70%。

这里最重要的结论不是“缓存 Composer”，而是：

> 没有 lock 文件的依赖缓存，只是在缓存一次不确定的解析过程。

## Artifact 依赖不能靠历史缓存维持

Composer 加速后，镜像成功构建并部署，但容器启动时报错：

```text
Failed opening required '/app/vendor/autoload.php'
cp: can't stat 'storage/app/theme'
```

原因是 Docker job 配置了：

```yaml
dependencies: []
```

它不会下载 Composer artifact。过去镜像里之所以存在 `vendor`，只是 Docker job 恰好恢复了旧的 GitLab cache。移除旧 cache 后，这条隐式依赖才暴露出来。

正确做法是建立显式依赖：

```yaml
build-image:
  dependencies:
    - composer
  script:
    - test -f vendor/autoload.php
    - test -f resources/views/vendor/horizon/layout.blade.php
    - docker build ...
```

同时移除 Docker job 对 `vendor/resources` 的独立 cache，避免 artifact 是新版本，cache 却恢复了旧版本。

这次故障让我重新明确了 cache 与 artifact 的边界：

| 机制 | 适合存放 | 是否应作为正确性依赖 |
|---|---|---|
| Cache | 可重新下载、丢失也不影响结果的内容 | 否 |
| Artifact | 上游 job 生成、下游必须使用的产物 | 是 |

如果删除 cache 会让构建失败，那么它大概率不应该只是 cache。

## 部署成功不等于 apply 成功

原部署 job 在 `kubectl apply` 后立即结束，十几秒就能变绿。但 Deployment 可能仍处于以下状态：

- 新 Pod 拉取镜像失败；
- readiness probe 不通过；
- 旧 Worker 等待任务退出；
- Deployment 只更新了部分副本。

因此增加逐个 Deployment 的 rollout 等待：

```bash
for deployment in $(kubectl get deployments -o name -n "$NAMESPACE"); do
  kubectl rollout status "$deployment" -n "$NAMESPACE" --timeout=10m
done
```

这里还踩了一个版本兼容问题：集群中的旧版 kubectl 不支持 `rollout status deployment --all`，只能先枚举资源再逐个等待。

最新一次验收中，8 个 Deployment 全部完成 rollout，部署耗时从原来的 13 秒增加到 48 秒。它变慢了，但这 35 秒原本只是被隐藏了。

## PHPUnit 放在部署后，只执行一次

MR pipeline 只负责更新 preview 和做轻量语法检查。完整 PHPUnit 仅在 preview 部署成功后执行一次：

```text
Composer
  → PHP lint
  → Docker build
  → Preview deploy + rollout
  → PHPUnit
```

这样可以避免多个 MR 对同一组合重复测试，也能保证测试针对已经部署的聚合结果。

现有测试集中仍有依赖外部数据库或 Redis 的历史用例，因此暂时保留执行结果，但标记为 non-blocking warning。流水线不会假装它们通过，也不会因为基础设施尚未隔离而阻断 preview。

## 最终数据

选择同一项目、相近变更量的两次 preview 流水线对比：

| 环节 | 优化前 | 优化后 | 变化 |
|---|---:|---:|---:|
| Composer | 73 秒 | 22 秒 | 快约 70% |
| PHP-FPM 镜像 | 106 秒 | 48 秒 | 快约 55% |
| 另一个应用镜像 | 61 秒 | 124 秒 | 单轮变慢 |
| 部署 | 13 秒 | 48 秒 | 增加完整 rollout 等待 |
| PHP lint | 无 | 13 秒 | 新增 |
| 部署后 PHPUnit | 无 | 约 23 秒 | 新增 |
| 端到端 | 3 分 13 秒 | 3 分 52 秒 | 慢约 20% |

只看总耗时，这轮优化像是负优化。但旧流水线的 3 分 13 秒并不包含真实发布完成时间，也无法发现镜像缺少依赖。

新的 3 分 52 秒至少回答了这些问题：

- 当前是不是最新 preview？
- 冲突 MR 是否被明确标记？
- 镜像是否包含构建产物？
- 部署是否使用确定的 digest？
- 所有副本是否完成 rollout？
- 部署后的组合代码是否执行过测试？

## 经验总结

1. **先消灭重复工作，再优化单个 job。** MR 只聚合，preview 才做完整构建和测试。
2. **Cache 只能提升性能，不能承担正确性。** 下游必需内容应该使用 artifact。
3. **看到“cache hit”不代表缓存有效。** 还要检查缓存中有什么，以及程序是否真的使用了它。
4. **Composer 优化首先要有 lock 文件。** 否则每轮都在重新解析依赖。
5. **新 preview 应取消旧流水线。** 但部署共享环境仍需要资源锁。
6. **镜像 tag 用于人类识别，digest 用于部署。**
7. **`kubectl apply` 不是发布完成。** rollout 成功才是。
8. **性能指标不能脱离语义。** 一个 13 秒结束但 Pod 起不来的部署 job，没有比 48 秒的可靠部署更快。

流水线优化的终点并不是让所有数字都更小，而是用尽可能少的等待，换来一个可信的绿色状态。
