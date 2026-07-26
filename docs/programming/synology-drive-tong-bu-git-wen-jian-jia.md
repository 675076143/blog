# Synology Drive 同步 .git 文件夹的配置方法

> 2026-07-26

Synology Drive 默认会排除所有以 `.` 开头的文件和文件夹，`.git` 目录自然也在其中。如果你用 Synology Drive 同步 Git 仓库，需要手动调整。

## 解决方法

编辑 Synology Drive Client 的配置文件 `blacklist.filter`：

**路径（不同系统略有差异）：**
- Linux：`~/.SynologyDrive/data/session/<session_id>/conf/blacklist.filter`
- macOS：`~/Library/Application Support/SynologyDrive/data/session/<session_id>/conf/blacklist.filter`
- Windows：`~\AppData\Local\SynologyDrive\data\session\<session_id>\conf\blacklist.filter`

找到 `[Common]` 部分，删除 `black_prefix = "."` 这一行：

```ini
[Common]
- black_prefix = "."
  max_length = 0
  max_path = 0
```

保存后重启 Synology Drive Client 生效。

## 精确排除其他 dot 文件夹

删除 `black_prefix = "."` 后，所有 dot 文件夹都会被同步，包括 `.cache`、`.npm`、`.ssh` 等。需要在 `[Directory]` 下精确排除不需要同步的文件夹：

```ini
[Directory]
black_name = "node_modules", "__pycache__", ".next", ".nuxt", ".output", "dist", "build", "vendor", ".venv", "venv", ".cache", ".config", ".local", ".npm", ".nvm", ".pnpm-store", ".yarn", ".turbo", ".vscode", ".idea", ".ssh", ".gnupg", ".docker", ".DS_Store"
```

常见需要排除的 dot 文件夹：

| 分类 | 文件夹 | 说明 |
|---|---|---|
| 系统/应用 | `.cache`, `.config`, `.local` | 缓存和配置，无同步价值 |
| Node.js | `.npm`, `.nvm`, `.pnpm-store`, `.yarn` | 包管理器缓存 |
| 构建输出 | `.next`, `.nuxt`, `.output`, `dist`, `build` | 可重新生成 |
| IDE | `.vscode`, `.idea` | 编辑器配置 |
| 安全 | `.ssh`, `.gnupg` | **绝不应同步** |

## 注意事项

修改 `blacklist.filter` 后如果通过 GUI 修改同步规则，该文件可能会被覆盖重置。GUI 中创建同步任务时点击 **Advanced** 可以勾选 "Sync files and folders with the prefix '.'"，但 "Sync on Demand" 模式下此选项可能不可用。
