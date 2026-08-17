# dsh-plannotator

[中文说明](./README.zh.md)

Standalone [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin. It is **not** a patch to the [Plannotator](https://github.com/backnotprop/plannotator) monorepo.

When the model calls `exit_plan_mode`, the plugin short-circuits `tools/execute`, opens the installed Plannotator plan-review UI, and waits until the reviewer approves, denies, or dismisses.

- Injects `tools` only — do not hard-inject `planMode` on a host `--patch` row (`dsh web` keeps that service in the per-preset `planning` isolate)
- Does not monkey-patch `ctx.userQuestions.ask()`
- Does not register a second exit tool
- Does not send Claude hook JSON

Approve returns `{ isError: false, value: { approved: true } }` and leaves plan mode. Deny and dismiss throw the same Error strings as `@deepseek-ai/dsh-plan-mode`. Approve-with-notes still returns that success value; notes are injected afterward (the official `custom` answer means “keep planning”).

## Requirements

- `dsh` 0.1.0-rc.6 or a compatible developer preview
- A `plannotator` CLI on `PATH` (current releases already ship `plannotator opencode-plan`)

The plugin talks to that existing CLI bridge: stdin is `{ "plan": "<markdown>" }`, stdout is `{ "approved": true|false, "feedback": "..." }`.

## Install

```bash
dsh plugin --profile web add dsh-plannotator
dsh web
```

Confirm the layer, then enter plan mode with `/plan`. When the model calls `exit_plan_mode`, review in Plannotator. The native dsh plan-review card should not appear.

```bash
dsh --profile web --dump-config   # look for "# == dsh-plannotator"
```

Remove with:

```bash
dsh plugin --profile web remove dsh-plannotator
```

A broken bundle patch can keep the whole profile from booting.

The plan-review badge inside Plannotator will currently read as OpenCode, because the stock CLI hard-codes that origin on `opencode-plan`. That is a Plannotator-side limit; this plugin does not fork their repo.

## What this plugin does not do

- Change the Plannotator monorepo (origin `dsh`, `plan --gate --json`, installer)
- Slash commands (`/plannotator-review`, `/annotate`, `/last`)
- Hijacking `ask()`, replacing `UserQuestionProvider`, or wrapping Claude `hooks.json`

## License

MIT OR Apache-2.0
