# Linux HDR 折腾记——从 KDE 到 Hyprland，从发灰到真 HDR

> 2026-07-28

## 起因

主机是 CachyOS（Arch），Kernel 7.2.0-rc4，KDE Plasma 6.7.3 Wayland，AMD RX 7900 XT，显示器是 INNOCN 27M2V-D（27" 4K MiniLED，HDR1000，1152分区背光）。

折腾之前我天真地以为：Linux 5 年过去了，桌面 HDR 应该成熟了吧？

结果开 HDR 一眼"发灰"——不只是 Linux 的问题，Windows 开桌面 HDR 一样灰。根源是 SDR 桌面内容（sRGB）强行映射到 HDR 输出（PQ/ST2084）时对比度下降，两边都没做好。

## 三条互不干扰的 HDR 路径

折腾一圈下来最大的认知是：游戏、视频、桌面走的是三套完全不同的管线。

- **游戏 HDR**：gamescope 直接拿 DRM master，创建 HDR swapchain，原生 HDR10
- **视频 HDR**：mpv 解码 + 合成器色调映射后输出
- **桌面 HDR**：SDR 内容强行塞进 HDR 容器 → 发灰

游戏 HDR 正常是因为 API 层面直接走 HDR swapchain。桌面发灰不是"配置错了"，是 SDR→HDR 色调映射的先天毛病——每个面板、图标都是 sRGB 画的，硬拉进 rec.2020 色域和 PQ 曲线，对比度必然降。

## 第一阶段：KDE 踩坑

KDE 开 HDR 后桌面发灰，调了各种配置——RgbRange 从 Automatic 改成 Full、SDR 亮度从 500 降到 200 nits、色彩精度从效率优先改成精度优先——效果有限。`sdrGamutWideness` 这个滑块拉到 100% 都没反应，说明 KWin 的 OpenGL 合成器处理 SDR→HDR 映射有兼容问题。

KDE 下唯一能出原生 HDR 的场景是 mpv + 全屏，靠 KWin 的 HDR toggle 走通。日常桌面只能关掉 HDR 用纯 sRGB。看个视频还得开脚本切换，体验割裂。

## 第二阶段：Hyprland

换 Hyprland 后桌面不灰了，但 HDR 输出一开始也没跑通。最终在 Hyprland Wiki 的 Variables 页面找到了关键配置：

| 配置 | 作用 |
|------|------|
| `render.cm_auto_hdr = 1` | 全屏自动切 HDR，桌面保持 SDR |
| `render.cm_enabled = true` | 色彩管理管线（默认已开） |
| `quirks.prefer_hdr = 2` | 仅 gamescope 报告 HDR |
| `bitdepth,10`（monitor 行） | 10-bit 输出 |

KWin 和 Hyprland 的 HDR 策略完全不同：

- **KWin**：全局 HDR 模式——开 HDR 后整个输出切到 rec.2020+PQ，SDR 桌面内容强行映射，发灰
- **Hyprland**：按需 HDR——桌面始终走带色彩管理的 SDR，全屏应用申请 HDR 时自动切输出模式，退出全屏恢复

简单说：KWin 是"把所有 SDR 硬塞进 HDR 容器"，Hyprland 是"桌面走 SDR，谁要 HDR 谁自己申请"。前者必然有色域拉伸损失，后者根本不需要映射。

## 踩坑记录

### SUPER 键绑定失效（Hyprland 0.56 Bug）

这个 Bug 最折磨人。Hyprland 0.56 有个随机停止捕获组合键的问题（[#9082](https://github.com/hyprwm/Hyprland/issues/9082)），表现为 SUPER+某个键突然不生效。解决方法是每个 SUPER 绑定都必须配一份完全相同的 ALT 绑定作"药引"——ALT 本身无效，但没它 SUPER 就不干活。

而且这药引得一模一样——`SUPER+Tab` 如果绑的是 `exec, script.sh`，`ALT+Tab` 也必须绑 `exec, script.sh`，绑成 `cyclenext` 都不行。

### reload vs 重登

`hyprctl reload` 会触发键盘 Bug，导致部分绑定丢失。改配置后老老实实退出重新登录。

### mpv 版本语法变化

mpv 0.40+ 的 HDR 自动检测改用 `target-colorspace-hint-mode=source`，不是以前的 `target-colorspace-hint=yes`。

### 中文输入法

需要设 `GTK_IM_MODULE`、`QT_IM_MODULE`、`XMODIFIERS` 等环境变量，`exec-once = fcitx5 -d`。

## 最终配置

| 场景 | 方案 | 效果 |
|------|------|------|
| 日常桌面 | Hyprland（纯 SDR） | ✅ 不发灰 |
| HDR 视频 | mpv + cm_auto_hdr 全屏自动切 | ✅ 原生 1000 nits |
| HDR 游戏 | gamescope --hdr-enabled | ✅ 原生 HDR10 |
| Alt+Tab | snappy-switcher（AUR） | ✅ 缩略图 + 键盘切换 |
| 截图+OCR | hyprshot + tesseract + wl-copy | ✅ 框选即识别 |
| 配色 | Catppuccin Mocha（全组件统一） | ✅ |

跟 Windows 比，桌面 HDR 双方半斤八两——都不行。游戏 HDR 靠 gamescope 拉平。视频 HDR 靠 mpv 拉平。最大的差距是浏览器 HDR 串流（Netflix/Disney+），Linux 浏览器目前没有一个能播 HDR 的。

但换个角度看——这套方案比 Windows 多了一个"桌面不灰"的优势。折腾的过程本身也是一种乐趣。
