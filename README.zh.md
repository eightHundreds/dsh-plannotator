# dsh-plannotator

[English](./README.md) · [中文](./README.zh.md)

[![npm](https://img.shields.io/npm/v/dsh-plannotator.svg)](https://www.npmjs.com/package/dsh-plannotator)
[![license](https://img.shields.io/npm/l/dsh-plannotator.svg)](./LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-202724)](https://github.com/topics/dsh-plugin)

独立的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。代理写好计划后，打开的是官方 [Plannotator](https://plannotator.ai) 应用——真正的那个产品，不是聊天里另做的一套审阅。

本仓库**不是**对 Plannotator 主仓库的 fork 或补丁。它用的是你已经装好的 Plannotator。

工程结构按 [dsh-plugin-starter](https://github.com/ciceroyang/dsh-plugin-starter)：宿主插件、纯函数 `lib/`、运行时 skill、`node:test`、CI、bundle 清单。零依赖，免构建。

    index.js                    宿主插件：计划拦截 + 斜杠命令 + skill
    lib/                        纯函数（可单测，不依赖 harness 服务）
    skills/plannotator/SKILL.md 技能说明书（模型视角）
    tests/                      node:test 单测
    cordis.patch.yml            bundle patch 层

## 你会得到什么

代理交出计划时，会打开 Plannotator，而不是 dsh 自带的审阅卡。

也可以自己打开：

| 命令 | 做什么 |
| --- | --- |
| `/plannotator-review` | 审当前改动；也可以贴一个 PR 链接 |
| `/plannotator-annotate` | 批注一个文件、文件夹或网址 |
| `/plannotator-last` | 批注代理上一条回复 |

1. 用 `/plan` 进入计划模式。
2. 代理写出计划。
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
- Node.js 18+（dsh 宿主本身仍需要 22+）
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

### 从 `.tgz` 压缩包安装

每个 `v*` tag 会在 [GitHub Release](https://github.com/eightHundreds/dsh-plannotator/releases) 挂一份 `npm pack` 产物。`dsh plugin add` 可以直接吃这个 `.tgz`，和装 npm 包一样。不要用 Release 自动附带的源码 zip。

用 Release URL 安装：

```bash
dsh plugin --profile web add https://github.com/eightHundreds/dsh-plannotator/releases/download/v0.2.0/dsh-plannotator-0.2.0.tgz
dsh web
```

或先下载 `dsh-plannotator-<version>.tgz`，再指向本地文件：

```bash
dsh plugin --profile web add ./dsh-plannotator-0.2.0.tgz
dsh web
```

官方 CLI 里同样有这些**终端子命令**（`plannotator review` / `annotate` / `last`）。上面的斜杠命令是在 dsh 里对它们的包装。

### 从本仓库安装

```bash
git clone https://github.com/eightHundreds/dsh-plannotator.git
cd dsh-plannotator
dsh plugin --profile web add .
dsh web
```

不用 `pnpm install`，也不用构建。本地 `dsh plugin add .` 会继续链到这个 checkout。

用 `--patch` 覆盖层开发加载（插件路径必须绝对）：

```yaml
# dev.cordis.yml
- insert:
    - id: dsh-plannotator
      name: /绝对路径/dsh-plannotator/index.js
```

```bash
dsh --profile web --patch ./dev.cordis.yml
```

## 卸载

```bash
dsh plugin --profile web remove dsh-plannotator
```

坏掉的 bundle patch 会让整个 `web` profile 起不来。如果装完后 `dsh web` 不再启动，先卸掉插件，再跑一遍 `--dump-config`。

## 工作原理

模型退出计划模式时，插件打开官方 Plannotator，等你审完。批准、拒绝或关掉会回写到 dsh。

斜杠命令和面向模型的 skill 用 `ctx.inject(['commands'])` / `ctx.inject(['skills'])` 等对应服务 ACTIVE 后再注册，而不是在 `apply()` 里 `ctx.get` 一次就算了。包内 `skills/` 不会被 dsh 扫描，skill 正文是注册时嵌进去的。

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
| `/` 菜单里没有 `/plannotator-*` | profile 还在用已发布的 `0.1.4`（那一版什么都没注册）。用本仓库重装：`dsh plugin --profile web add .` |
| skill 目录里没有 `plannotator` | 同上，或宿主没有 `skills` 服务。包内 `skills/` 不会被自动扫描。 |
| `Could not find \`plannotator\`` | 先装 CLI，或设置 `PLANNOTATOR_BIN`。 |
| 装完后 `dsh web` 起不来 | 卸掉插件。不要在宿主 patch 上硬 `inject: ['planMode']`。 |
| `exit_plan_mode is only available in plan mode` | 旧版本返回了裸的 `{ approved: true }`，过不了官方 schema。升级本插件。 |
| 徽标显示 OpenCode | 预期行为。官方 CLI 把 `opencode-plan` 标成 OpenCode。 |

## 本插件不会做的事

- 改 Plannotator 主仓库（原生 `dsh` origin、安装器）
- 替换 `UserQuestionProvider` 或套用 Claude `hooks.json`

## 开发

```bash
node --test
```

## 参考

- [dsh-plugin-starter](https://github.com/ciceroyang/dsh-plugin-starter)
- 实战教程：https://github.com/ciceroyang/dsh-report-studio/blob/main/docs/tutorial-zh.md

## 许可

[MIT OR Apache-2.0](./LICENSE)
