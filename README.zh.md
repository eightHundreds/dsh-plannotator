# dsh-plannotator

[English](./README.md) · [中文](./README.zh.md)

[![npm](https://img.shields.io/npm/v/dsh-plannotator.svg)](https://www.npmjs.com/package/dsh-plannotator)
[![license](https://img.shields.io/npm/l/dsh-plannotator.svg)](./LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-202724)](https://github.com/topics/dsh-plugin)

独立的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。代理写好计划后，打开的是官方 [Plannotator](https://plannotator.ai) 应用——真正的那个产品，不是聊天里另做的一套审阅。

本仓库**不是**对 Plannotator 主仓库的 fork 或补丁。它用的是你已经装好的 Plannotator。

## 你会得到什么

1. 用 `/plan` 进入计划模式。
2. 模型写出 markdown 计划并调用 `exit_plan_mode`。
3. 浏览器打开 Plannotator。原生 dsh 审阅卡片不应再出现。
4. 批准、拒绝或关掉窗口。dsh 会按这个决定继续或留在计划模式。

| 你在 Plannotator 里的操作 | dsh 侧行为 |
| --- | --- |
| 批准 | 离开计划模式，继续执行。 |
| 带备注批准 | 离开计划模式，再把备注 inject 成一条后续用户消息。 |
| 拒绝 / 批注 | 留在计划模式。模型带着你的反馈改计划。 |
| 关掉界面 | 留在计划模式，等你下一条消息。 |

## 依赖

- [dsh](https://github.com/deepseek-ai/deepseek-harness) `0.1.0-rc.6` 或兼容的 developer preview
- Node.js 22+
- 已带 `plannotator opencode-plan` 的 `plannotator` CLI（当前发行版都有）

没有 CLI 时先装：

```bash
# macOS / Linux / WSL
curl -fsSL https://plannotator.ai/install.sh | bash

# Windows PowerShell
irm https://plannotator.ai/install.ps1 | iex
```

确认命令可用（或文件在 `~/.local/bin/plannotator`）：

```bash
plannotator --help
```

## 安装

```bash
dsh plugin --profile web add dsh-plannotator
dsh web
```

确认层已经挂上：

```bash
dsh --profile web --dump-config   # 应看到 "# == dsh-plannotator"
```

然后 `/plan`，等模型提出计划，在 Plannotator 里审。

装好官方 CLI 后，这些是**终端子命令**。本插件不会把它们注册成 dsh 斜杠命令（没有 `/plannotator-review`）：

| CLI | 打开什么 |
| --- | --- |
| `plannotator review [PR_URL]` | 审本地改动或 GitHub/GitLab PR |
| `plannotator annotate <file\|url\|folder>` | 批注文档 |
| `plannotator last` | 批注模型上一条消息 |

### 从本仓库安装

```bash
git clone https://github.com/eightHundreds/dsh-plannotator.git
cd dsh-plannotator
pnpm install
pnpm build
dsh plugin --profile web add .
dsh web
```

改 TypeScript 源码后需要重新 `pnpm build`。本地 `dsh plugin add .` 会继续链到这个 checkout。

## 卸载

```bash
dsh plugin --profile web remove dsh-plannotator
```

坏掉的 bundle patch 会让整个 `web` profile 起不来。如果装完后 `dsh web` 不再启动，先卸掉插件，再跑一遍 `--dump-config`。

## 工作原理

插件只 inject `tools`，挂在 `tools/execute` 上。

- 工具不是 `exit_plan_mode`、当前不在计划模式、或计划不是以 markdown 标题（`# …`）开头时，直接 `next()`，交给官方实现。
- 否则执行 `plannotator opencode-plan`，向 stdin 写入 `{ "plan": "<markdown>" }`，再读 stdout 里最后一个 JSON（`{ "approved": true|false, "feedback": "..." }` 或带 `decision` 字段）。
- 批准返回 `{ isError: false, value: { approved: true } }`，满足官方 output schema。拒绝 / 关掉抛出与 `@deepseek-ai/dsh-plan-mode` 相同的 Error 文案。

**不要**在宿主 `--patch` 行上硬 inject `planMode`。`dsh web` 里这个服务在 preset 的 `planning` 隔离组；硬等会让整个 profile 起不来。插件在服务已存在时用 `ctx.get('planMode')` 读取。

插件也不劫持 `ctx.userQuestions.ask()`、不注册第二个退出工具、不伪造 Claude hook JSON。

## 配置

普通 Plannotator 安装不用改环境变量。只有二进制不在默认位置时才需要覆盖。

| 变量 | 作用 |
| --- | --- |
| `PLANNOTATOR_BIN` | `plannotator` 可执行文件的绝对路径。 |
| `PLANNOTATOR_DSH_USE_SOURCE=1` | 用本地 checkout + `bun` 跑 Plannotator hook server。 |
| `PLANNOTATOR_DSH_SOURCE_ROOT` | 从这个目录向上查找 checkout。 |
| `PLANNOTATOR_DSH_SOURCE_ENTRY` | 直接指定 `apps/hook/server/index.ts`。 |
| `PLANNOTATOR_BUN` / `BUN` | source 模式下用的 `bun`。 |

未设置 `PLANNOTATOR_BIN` 时：若存在 `~/.local/bin/plannotator` 就用它，否则用 PATH 上的 `plannotator`。Windows 还会查 `%LOCALAPPDATA%\plannotator\plannotator.exe`。

子进程总会带上 `PLANNOTATOR_ORIGIN=dsh` 和 `PLANNOTATOR_CWD=<session cwd>`。官方 `opencode-plan` 仍会把 UI 徽标写成 OpenCode，这是对方仓库的限制。

## 排障

| 现象 | 检查 |
| --- | --- |
| 仍然弹出原生 dsh 审阅卡片 | `--dump-config` 里没有本插件、当前不在计划模式、或计划不是以 `# …` 开头。 |
| `Could not find \`plannotator\`` | 先装 CLI，或设置 `PLANNOTATOR_BIN`。 |
| 装完后 `dsh web` 起不来 | 卸掉插件。不要在宿主 patch 上硬 `inject: ['planMode']`。 |
| `exit_plan_mode is only available in plan mode` | 旧版本返回了裸的 `{ approved: true }`，过不了官方 schema。升级本插件。 |
| 徽标显示 OpenCode | 预期行为。官方 CLI 把 `opencode-plan` 标成 OpenCode。 |

## 本插件不会做的事

- 改 Plannotator 主仓库（原生 `dsh` origin、安装器）
- 注册 dsh 斜杠命令。`review` / `annotate` / `last` 是上面官方 `plannotator` CLI 的子命令
- 替换 `UserQuestionProvider` 或套用 Claude `hooks.json`

## 开发

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

## 许可

[MIT OR Apache-2.0](./LICENSE)
