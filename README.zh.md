# dsh-plannotator

[English](./README.md)

独立的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）插件。**不是**对 [Plannotator](https://github.com/backnotprop/plannotator) 主仓库的补丁。

模型调用 `exit_plan_mode` 时，插件短路 `tools/execute`，打开本机已安装的 Plannotator 计划审阅 UI，并一直等到用户批准、拒绝或关掉。

- 只 inject `tools`。不要在宿主 `--patch` 行上硬 inject `planMode`（`dsh web` 里这个服务在 preset 的 `planning` 隔离组，硬等会让整个 profile 起不来）
- 不劫持 `ctx.userQuestions.ask()`
- 不注册第二个退出工具
- 不伪造 Claude hook JSON

批准返回 `{ isError: false, value: { approved: true } }`，并离开 plan mode。拒绝 / 关掉抛出与 `@deepseek-ai/dsh-plan-mode` 相同的 Error 文案。带备注的批准仍然只回成功值，备注事后 `inject`（官方把 `custom` 当成继续规划）。

## 依赖

- `dsh` 0.1.0-rc.6 或兼容的 developer preview
- PATH 上的 `plannotator` CLI（现有发行版已带 `plannotator opencode-plan`）

插件走这条现成桥：stdin 是 `{ "plan": "<markdown>" }`，stdout 是 `{ "approved": true|false, "feedback": "..." }`。

## 安装

```bash
dsh plugin --profile web add dsh-plannotator
dsh web
```

确认层已挂上后，用 `/plan` 进入计划模式。模型调用 `exit_plan_mode` 时在 Plannotator 里审。原生 dsh 审阅卡片不应再出现。

```bash
dsh --profile web --dump-config   # 应看到 "# == dsh-plannotator"
```

卸载：

```bash
dsh plugin --profile web remove dsh-plannotator
```

坏掉的 bundle patch 会让整个 profile 起不来。

Plannotator 审阅页上的来源徽标目前会显示成 OpenCode，因为官方 CLI 的 `opencode-plan` 把 origin 写死了。这是对方仓库的限制；本插件不改他们的代码。

## 本插件不会做的事

- 改 Plannotator 主仓库（origin `dsh`、`plan --gate --json`、安装器）
- 斜杠命令（`/plannotator-review`、`/annotate`、`/last`）
- 劫持 `ask()`、替换 `UserQuestionProvider`、或套用 Claude `hooks.json`

## 许可

MIT OR Apache-2.0
