# Focus Pet

Focus Pet 是一个 Electron + React + TypeScript + Live2D 的 Windows 桌面专注陪伴工具。

当前 `package.json` version：`0.2.0`

当前开发阶段：`v1.0.0-dev`

Focus Pet 目前仍以“小而有用”的桌面专注桌宠为核心：默认使用 Live2D 霍霍桌宠，提供快速开始、轻量提醒、本地记录、休息闭环、透明鼠标穿透和 Windows 打包能力。

从 v0.4 开始，项目正在逐步回归“AI 陪伴式桌面数字伙伴”方向。当前阶段已具备本地基础能力、AI Provider 配置，以及一次性 AI 陪伴回复 MVP。

当前不做完整聊天系统，不做后台请求，不保存聊天历史。

## v1.0 方向：本地每日小结 / AI 日记基础

* v1.0 开始探索每日小结和 AI 日记方向。
* v1.0.1 完成本地“今日小结”。
* 今日小结会汇总今日专注、小任务、霍霍能量和状态标签。
* v1.0.2 支持基于今日小结手动生成 AI 日记。
* AI 日记需要 AI 配置；点击后会把今日小结摘要发送到配置的 AI 服务。
* v1.0.3 支持手动保存 AI 日记，保存内容仅保存在本地 `localStorage`。
* v1.0.4 支持在陪伴 tab 查看最近保存的 AI 日记。
* v1.0 AI 日记闭环已形成：本地小结 → 手动生成 AI 日记 → 手动保存 → 最近 3 篇回顾。
* 当前仅展示最近 3 篇，可展开和删除。
* 当前 AI 日记数据只保存在本地 `localStorage`，不自动保存、不做云同步、不做完整历史系统。
* 设置入口现在通过角色旁三点菜单打开。
* 主面板更聚焦专注、陪伴和问问。
* AI 配置、隐私说明、开机启动等低频内容集中在设置面板。
* v1.0.7 进行流畅度专项优化，降低倒计时、tab 切换、设置面板、窗口 resize 和鼠标穿透检测带来的额外开销。

## v0.9 方向：本地微任务

* v0.9 开始补齐效率助手与自我管理基础能力。
* “今日小任务”用于记录很小的本地待办，并可设为本轮专注目标。
* 从小任务设为目标并自然完成专注后，Focus Pet 会询问这项小任务是否完成。
* 只有点击“完成了”才会标记小任务完成；普通手写目标、准备取消和提前结束不会触发。
* “霍霍能量”会在完成专注和完成小任务时增加，当前只显示今日能量。
* 小任务只保存在本地 `localStorage`。
* 当前不做等级、成就、好感度或商城。
* 当前不做登录、云同步、日历同步或 AI 自动任务管理。

## v0.8 方向：低频主动陪伴

* v0.8 开始探索低频主动陪伴。
* 当前主动陪伴只基于本地状态和本地规则，不调用 AI。
* 主动陪伴只会更新气泡文案，不发送通知，不自动打开面板。
* 低频主动陪伴出现时，可以直接开始 5 分钟或选择稍后。
* 用户可以在设置中关闭“低频主动陪伴”。
* 专注中不会主动打扰。
* v0.8 封存前检查清单见 `docs/v0.8-release-checklist.md`。

## v0.7 方向：轻量临时对话上下文

* “问问霍霍”支持临时记住最近 3 轮对话，用于理解追问。
* 该上下文只保存在当前运行时，不写入 `localStorage`。
* 这不等于聊天历史，关闭应用或刷新后会消失。
* 用户可以手动清空临时对话。
* “问问霍霍”请求中可以取消。
* 取消不会保存对话，也不会写入临时上下文。
* 请求失败或超时不会影响本地记忆。
* 临时上下文不会写入 `focusPet.companionMemory`；只有点击“记住这次”或确认“记住”建议后才会保存本地记忆。
* v0.7 持续优化“问问霍霍”的使用体验和完整面板视觉。
* 当前 AI 设置作为低优先级配置项展示，不影响日常专注使用。
* v0.7 优化完整面板信息架构，将专注、陪伴小记、问问霍霍和设置拆分为轻量分区。
* 日常使用默认进入“专注”分区，减少滚动和配置干扰。
* v0.7 封存前检查清单见 `docs/v0.7-release-checklist.md`。

## v0.6 方向：AI 陪伴记忆增强

* AI 回复默认不保存。
* 用户可以点击“记住这次”，手动保存一条本地陪伴记忆。
* 当内容像偏好、习惯或长期信息时，霍霍可能会询问“要不要记一下”。
* 只有用户点击“记住”后才会保存到本地 `companionMemory`。
* 点击“不用”不会保存。
* 保存内容仅保存在 `localStorage` 的 `focusPet.companionMemory`。
* 清空陪伴记忆会删除这些手动保存内容。
* 当前仍不保存聊天历史，不做多轮聊天。
* Live2D 待机时会有轻量动作和呼吸感。
* 鼠标离开后，视线会自然回到默认方向。
* 专注中降低视线追踪，减少干扰。

## v0.5 方向：一次性 AI 陪伴回复

* 当前支持保存 OpenAI-compatible 配置：Base URL、API Key、Model。
* 当前支持一次性“问问霍霍”AI 陪伴回复。
* 支持 DeepSeek / OpenAI-compatible Provider。
* 用户必须主动点击“发送”才会请求 AI 服务。
* 请求使用本地 `aiSettings` 中配置的 OpenAI-compatible Provider。
* 点击发送后，会发送用户输入和少量本地上下文摘要到用户配置的 AI 服务。
* 不发送完整本地记忆。
* 不发送完整 notes。
* 不做后台请求。
* 不做自动对话。
* 不保存聊天历史。
* API Key 仅保存在本地 `localStorage`。

### DeepSeek 推荐配置

* Provider：OpenAI-compatible。
* Base URL：`https://api.deepseek.com`。
* Model：`deepseek-v4-flash`。
* API Key：用户自己的 DeepSeek API Key。

## 版本阶段

* `v0.2`：自用稳定底座，完成桌宠专注闭环和 Windows 打包。
* `v0.3`：霍霍体验打磨，优化文案、Live2D 状态动作、资源检查、图标和验证命令。
* `v0.4`：AI 陪伴能力回归的本地基础阶段，只做本地入口、记忆、状态和回顾。
* `v0.5`：DeepSeek / OpenAI-compatible 一次性 AI 陪伴回复。
* `v0.6`：AI 记忆增强 + Live2D 生命感。
* `v0.7`：轻量临时对话上下文，不保存聊天历史。
* `v0.8`：低频主动陪伴，只基于本地规则，不接 AI 主动聊天。
* `v0.9`：本地微任务雏形，服务于专注目标和轻量自我管理。
* `v1.0`：本地每日小结与 AI 日记基础，支持本地规则小结和手动 AI 日记生成。

## 核心功能

### 桌宠体验

* Live2D 霍霍桌宠。
* 透明区域鼠标穿透。
* 动态窗口高度。
* 隐藏式角色旁控制入口。
* 拖动窗口。
* 记住窗口位置。
* 应用图标。
* 托盘菜单。
* 开机启动。
* 系统通知。

### 专注流程

* 快速开始。
* 3 秒准备提示。
* 本轮目标。
* 5 / 10 / 25 分钟专注。
* 记住上次选择的专注时长。
* 专注中迷你模式。
* 防分心提醒。
* 提前结束二次确认。
* 自然完成记录。
* 完成后轻量今日反馈。
* 5 分钟休息。
* 休息结束再来一轮。

### 记录与反馈

* 今日完成轮数。
* 今日累计分钟数。
* 最近记录。
* 每日目标。
* 本地完成反馈。
* 本地今日小结。

### 本地微任务

* 今日小任务。
* 本地添加、完成、删除轻量任务。
* 将小任务设为本轮专注目标。
* 关联小任务自然完成专注后，可手动确认是否完成该小任务。
* 今日完成小任务数量统计。
* 今日霍霍能量，用于本地成长值预留。

### AI 陪伴本地基础

* AI 陪伴入口占位。
* 本地 AI 陪伴开关。
* 一次性 AI 陪伴回复。
* `companionMemory` 本地记忆结构。
* 专注完成写入本地陪伴记忆。
* 陪伴记忆查看。
* 陪伴记忆清理。
* 轻量状态标签。
* 本地小回顾。
* AI 请求只在用户点击发送后发生。
* AI 回复可由用户主动点击“记住这次”保存为一条本地陪伴记忆。
* 霍霍可能基于本地关键词规则建议“要不要记一下”。
* 不自动保存 AI 对话，不保存完整聊天历史。

## 本地数据

Focus Pet 当前只使用本地数据，不需要登录，不上传数据，也不云同步。

### localStorage

* `focusPet.selectedDurationMinutes`：上次选择的专注时长。
* `focus-pet-daily-records`：今日专注记录。
* `focus-pet-daily-goal`：每日目标。
* `focusPet.aiCompanionEnabled`：本地 AI 陪伴开关。
* `focusPet.proactiveCompanionSettings`：低频主动陪伴开关和最近提醒时间戳。
* `focusPet.microTasks`：本地今日小任务列表。
* `focusPet.growthEnergy`：本地霍霍能量事件，用于今日能量显示。
* `focusPet.companionMemory`：本地陪伴记忆、状态标签和本地小回顾的数据来源。
* `focusPet.dailyDiaries`：手动保存的 AI 日记，仅保存日记文本和生成时的小结快照。
* `focusPet.aiSettings`：AI Provider 配置占位，包括 `chatEnabled`、`provider`、`baseUrl`、`apiKey`、`model`。
* `focus-pet-dev-quick-test`：开发环境快速倒计时测试开关。

### Electron userData

* `window-state.json`：用于记住窗口位置。

用户可以在完整面板的“陪伴小记”中查看和清空本地陪伴记忆。清空陪伴记忆不会清空今日专注记录、窗口位置或专注时长选择。

当前 AI Provider 配置只保存在本地。API Key 保存在 `localStorage` 的 `focusPet.aiSettings` 中，请只在自用环境中填写。

点击“问问霍霍”的发送按钮后，请求会发送到用户配置的 `baseUrl`，当前没有后端中转。用户不点击发送就不会请求 AI。

一次性 AI 回复只发送用户输入、今日专注轮数、今日累计分钟数、最近最多 3 个状态标签和最近 1 条本地记忆文本，不发送完整 `companionMemory`、完整 notes 或完整今日记录。

AI 回复默认不会保存。只有用户点击“记住这次”或确认“记住”建议后，才会写入本地陪伴记忆。

## 本地开发

```bash
npm install
npm run dev
```

## 常用命令

```bash
npm run check:live2d
npm run build
npm run package:win
npm run verify
```

`npm run verify` 会依次执行 Live2D 资源检查、前端构建和 Windows 打包验证。

如果 `Focus Pet.exe` 正在运行，`package:win` 可能因为文件被占用失败。遇到这种情况，先关闭正在运行的 `Focus Pet.exe`，再重新执行验证命令。

## 打包产物

打包后运行：

```text
dist-release\win-unpacked\Focus Pet.exe
```

构建单文件 portable exe：

```bash
npm run dist
```

如果 portable 构建因为外部下载资源失败，`win-unpacked` 版本仍可用于本地自用和测试。

## Live2D 资源检查

当前默认模型位于：

```text
public/assets/huohuo/
```

可运行：

```bash
npm run check:live2d
```

用于检查 `model3.json`、`moc`、贴图、动作配置和 motion 文件引用是否完整。

## 应用图标

Windows exe、任务栏和托盘使用项目图标，图标资源位于：

```text
build/icon.ico
```

修改图标后需要重新执行 `npm run package:win`。如果图标没有立即变化，可能是 Windows 图标缓存或旧 exe 被占用。

## 角色

当前只有一个角色：霍霍（Live2D）。

模型：

```text
public/assets/huohuo/huohuo.model3.json
```

动作组与状态映射见 `docs/huohuo-live2d.md`，播放逻辑在 `src/components/Live2DPet.tsx`。

## 当前不做

* 登录。
* 后端。
* 数据库。
* 云同步。
* 完整 AI 聊天窗口。
* 自动记忆。
* 多轮聊天。
* 消息流。
* 聊天历史。
* 自动 AI 对话。
* 后台 AI 请求。
* 流式输出。
* 语音。
* 截图识别。
* 摄像头 / 麦克风情绪识别。
* 情绪识别模型。
* Live2D 模型骨骼编辑。
* 伪走路。
* 复杂任务系统。
* 完整 Todo App。
* 任务截止日期。
* 任务优先级。
* 日历同步。
* 复杂统计图表。
* 多端同步。
* 自动更新。
* 设置页。

## 相关文档

* [CHANGELOG.md](CHANGELOG.md)
* [使用说明.md](使用说明.md)
* [docs/huohuo-live2d.md](docs/huohuo-live2d.md)
* [docs/v0.4-ai-companion.md](docs/v0.4-ai-companion.md)
* [docs/v0.5-ai-provider.md](docs/v0.5-ai-provider.md)
* [docs/v0.5-ai-test-checklist.md](docs/v0.5-ai-test-checklist.md)
* [docs/v0.6-ai-memory.md](docs/v0.6-ai-memory.md)
* [docs/v0.6-release-checklist.md](docs/v0.6-release-checklist.md)
* [docs/v0.8-proactive-companion.md](docs/v0.8-proactive-companion.md)
* [docs/v0.8-release-checklist.md](docs/v0.8-release-checklist.md)
* [docs/v0.9-micro-tasks.md](docs/v0.9-micro-tasks.md)
* [docs/v0.9-growth-energy-checklist.md](docs/v0.9-growth-energy-checklist.md)
* [docs/v1.0-daily-summary.md](docs/v1.0-daily-summary.md)
* [docs/v1.0-ai-diary-checklist.md](docs/v1.0-ai-diary-checklist.md)
* [docs/v1.0-settings-panel.md](docs/v1.0-settings-panel.md)
* [docs/v1.0-performance.md](docs/v1.0-performance.md)
