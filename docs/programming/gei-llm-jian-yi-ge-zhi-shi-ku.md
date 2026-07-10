# 给 LLM 建一个知识库

> 2026-07-10

## 为什么需要这个

用 AI 编码工具（Cursor、OpenCode、Claude Code 等）写代码时，有一个绕不开的问题：**上下文不够用**。

每次开一个新会话，AI 不知道你之前踩过什么坑、项目里有什么约定、上次那个 bug 怎么修的。你得反复解释，或者手动把笔记粘进去。

Andrej Karpathy 在 [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 里提出了一个思路：**给 LLM 建一个可编辑的个人知识库，让 AI 自己管理、自己查询、自己积累**。

核心想法是：

1. LLM 维护一套 markdown 文件，每个文件是一个知识点
2. 文件有结构化的 frontmatter（类型、标签、日期、关联）
3. LLM 通过工具读写这些文件，不需要人类手动维护
4. 跨项目可用——任何项目都能访问同一个知识库

我照着这个思路搭了一套，踩了一些坑，记录下来。

---

## 整体架构

```
notes/
├── AGENTS.md           ← Wiki 规范（告诉 LLM 怎么维护）
├── wiki/
│   ├── index.md        ← 内容目录
│   ├── log.md          ← 操作日志
│   └── pages/          ← 知识库页面
├── raw/                ← 原始资料（不可修改）
├── assets/             ← 图片和附件
└── mcp-server/         ← MCP 服务器
```

文件结构不复杂，但有几个关键设计决策。

### AGENTS.md — 给 LLM 的规范文件

这是整个系统的核心。`AGENTS.md` 放在项目根目录，OpenCode 启动时会自动读取。它定义了：

- 页面格式（YAML frontmatter + markdown 正文）
- 页面类型（entity / concept / summary / comparison）
- 命名规范（kebab-case 英文文件名 + 中文标题）
- 操作规范（添加页面时必须更新 index.md 和 log.md）

```yaml
---
title: MySQL 慢查询排查记录
type: summary
tags: [mysql, slow-query, performance]
date: 2026-07-10
sources: []
related: [laravel-cache-tag-bigkey]
status: active
---
```

有了这个文件，LLM 知道该怎么写、该更新什么。不需要每次都说"帮我加个页面，格式是这样的..."。

### MCP Server — 让 LLM 操作知识库

MCP（Model Context Protocol）是 Anthropic 提出的标准，让 LLM 通过工具调用外部服务。我写了一个轻量的 MCP server，暴露 6 个工具：

| 工具 | 功能 |
|------|------|
| `wiki_search` | 全文搜索知识库 |
| `wiki_read` | 读取指定页面 |
| `wiki_list` | 列出所有页面 |
| `wiki_add` | 添加新页面 |
| `wiki_update` | 更新已有页面 |
| `wiki_lint` | 检查知识库健康度 |

OpenCode 通过 `~/.config/opencode/opencode.json` 配置 MCP server，启动时自动连接。

```json
{
  "mcp": {
    "wiki": {
      "command": "node",
      "args": ["/Volumes/Workspace/notes/mcp-server/index.js"],
      "enabled": true
    }
  }
}
```

有了这个，在任何项目里都可以直接跟 LLM 说：

```
帮我记一下：今天发现 MySQL 慢查询是因为
laravel-permission 的缓存太大，每次查权限
都把全量数据从 Redis 拉到内存里，连接池直接
打满。解决方案是用 Redis SINTERSTORE 做服务端
计算，不传大 Key。
```

LLM 会自动创建页面、添加 frontmatter、更新 index 和 log。人类不需要手动操作。

### qmd — 语义搜索

MCP server 的 `wiki_search` 只是简单的文本 grep。如果知识库有 50+ 篇笔记，grep 不够用。

[qmd](https://github.com/tobi/qmd) 是一个本地搜索引擎，支持三种搜索模式：

- **BM25 关键词搜索**：快，精确匹配
- **向量语义搜索**：理解语义，"性能优化"能匹配到 "CPU 打满"
- **LLM 重排序**：对候选结果做二次排序，提高准确率

```bash
npm install -g @tobilu/qmd
```

配置到 OpenCode：

```json
{
  "mcp": {
    "qmd": {
      "command": "sh",
      "args": ["/Users/huangxuzhen/.config/opencode/qmd-mcp.sh"],
      "enabled": true
    }
  }
}
```

搜索质量对比：

| 查询 | wiki_search | qmd |
|------|-------------|-----|
| "Redis 大 Key" | ✅ 找到（字面匹配） | ✅ 找到（93% score） |
| "连接池打满" | ❌ 找不到 | ✅ 找到（匹配到 laravel-permission 缓存那篇） |
| "Hologres 高峰" | ✅ 找到 | ✅ 找到（93% score） |
| "PHP 进程崩溃" | ❌ 找不到 | ✅ 找到（匹配到 SIGSEGV 那篇） |

语义搜索的价值在于：你不需要记住笔记里用了什么关键词，只要描述问题就能找到。

### Obsidian — 可视化浏览

知识库最终还是要给人看的。用 [Obsidian](https://obsidian.md/) 打开 `wiki/` 目录作为 vault，支持：

- 双向链接（`[[page-name]]`）
- 图谱视图（看页面之间的关系）
- 全文搜索

一个坑：Obsidian 默认显示文件名作为标题，但我们的文件名是 kebab-case 英文（如 `laravel-cache-tag-bigkey.md`），不方便看。

解法是安装 **Front Matter Title** 插件，它会读取 YAML frontmatter 的 `title` 字段作为显示标题。文件名保持英文（方便 grep 和链接），标题用中文（方便人类阅读）。

---

## 实际使用

### 场景 1：跨项目复用

我在项目 A 踩了一个坑，记录到知识库。切换到项目 B 时，跟 LLM 说"帮我看看之前有没有遇到过类似的问题"，它会搜索知识库，找到相关笔记，给出建议。

不需要手动复制笔记，不需要记得"上次那个 bug 在哪个文件里"。

### 场景 2：故障复盘

最近做了两个 Hologres 的故障分析（高峰诊断 + 499 超时），直接让 LLM 整理成 wiki 页面：

```
帮我把 /Volumes/Workspace/lf-ec-support/Connection-Reset-故障分析报告.md
整理成 wiki 页面，提取关键结论和方法论
```

LLM 会读取原始报告，提炼核心内容，添加 frontmatter，更新交叉引用。几分钟就搞定。

### 场景 3：知识积累

用了一段时间后，知识库会自动增长。LLM 在回答问题时会主动查询知识库，找到相关内容后引用：

> 根据知识库中的 `hologres-peak-hour-diagnosis` 记录，CPM Monitor 的 8 次串行查询是高峰期连接池紧张的主因...

这种"引用知识库"的行为是自动的，不需要人工干预。

---

## 踩过的坑

### qmd 的 Node.js 版本问题

qmd 需要 Node.js 22+，但系统默认是 v18（通过 nvm）。qmd 的 MCP 启动脚本如果用 nvm 的 shell 模式，会先加载 v18 再切换到 v22，但 MCP 启动时可能还没切换完。

解法：直接写死 Node 22 的二进制路径，不走 nvm 的 shell 切换。

```bash
#!/bin/sh
exec ~/.nvm/versions/node/v22.23.1/bin/node \
  ~/.nvm/versions/node/v22.23.1/lib/node_modules/@tobilu/qmd/dist/cli/qmd.js mcp
```

### MCP 连接失败

OpenCode 配置了 MCP server 但显示 "qmd failed"。排查后发现是启动脚本的问题——nvm 的 shell 模式在 MCP 的 exec 环境下不能正确切换 Node 版本。

换了直接路径后，两个 MCP server（wiki + qmd）都正常连接。

### Obsidian 文件名显示

一开始用中文文件名（如 `MySQL 慢查询排查记录.md`），但 grep 和链接都不方便。换成英文 kebab-case 后，Obsidian 显示的是文件名。

安装 Front Matter Title 插件解决。配置很简单：打开插件设置，选择 "Front Matter Title" 作为标题来源。

---

## 和其他方案的对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| Cursor Rules | 简单，一个文件搞定 | 不能积累，不能搜索 |
| Notion + API | 可视化好，协作方便 | 依赖外部服务，离线不可用 |
| 本地 markdown + grep | 简单，零依赖 | 搜索质量差，不能语义匹配 |
| **本方案** | 语义搜索，跨项目，可积累 | 需要配置 MCP + qmd |

核心区别：本方案是**为 LLM 设计的**。文件格式、操作工具、搜索能力都是 LLM 需要的，不是人类需要的。人类通过 Obsidian 浏览，LLM 通过 MCP 操作。

---

## 后续计划

1. **自动 ingest**：新笔记自动从 raw 资料提取，不需要手动整理
2. **多设备同步**：知识库放在 iCloud/GitHub，多设备共享
3. **团队知识库**：多人共享一个知识库，LLM 在回答时引用团队积累

---

## 写在最后

搭完这套系统后，最大的感受是：**LLM 有记忆了**。

以前每次开新会话，都像在跟一个失忆的助手合作。现在它知道我之前踩过什么坑、项目里有什么约定、上次那个 bug 怎么修的。

这种"记忆"不是 LLM 自带的，是通过知识库 + MCP 工具实现的。文件还是那些 markdown 文件，但有了结构化的 frontmatter、语义搜索、和 LLM 的读写工具，它们变成了一个活的知识系统。

Karpathy 的原话是："the wiki acts as an external, editable memory for the LLM"。翻译过来就是：**知识库是 LLM 的外挂记忆**。

用了一段时间，确实有这个感觉。

---

_LLM Wiki · Karpathy 模式 · OpenCode + MCP + qmd + Obsidian_
