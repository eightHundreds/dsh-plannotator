# dsh-plannotator

[English](./README.md) · [中文](./README.zh.md)

[![npm](https://img.shields.io/npm/v/dsh-plannotator.svg)](https://www.npmjs.com/package/dsh-plannotator)
[![license](https://img.shields.io/npm/l/dsh-plannotator.svg)](./LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-202724)](https://github.com/topics/dsh-plugin)

Standalone [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin. When the agent is ready with a plan, it opens the official [Plannotator](https://plannotator.ai) app — the real product, not a lookalike review screen in the chat.

This package is **not** a fork or patch of the Plannotator monorepo. It uses the Plannotator app you already have installed.

Layout follows [dsh-plugin-starter](https://github.com/ciceroyang/dsh-plugin-starter): host plugin, pure `lib/` helpers, runtime skill, `node:test`, CI, and a bundle manifest — zero dependencies, no build step.

    index.js                    host plugin (plan intercept + commands + skill)
    lib/                        deterministic helpers (unit-test friendly)
    skills/plannotator/SKILL.md model-facing skill manual
    tests/                      node:test suite
    cordis.patch.yml            bundle patch layer

## What you get

When the agent presents a plan, Plannotator opens instead of the built-in review card.

You can also open Plannotator yourself:

| Command | What it does |
| --- | --- |
| `/plannotator-review` | Review the current changes, or a pull request if you paste a URL |
| `/plannotator-annotate` | Annotate a file, folder, or URL |
| `/plannotator-last` | Annotate the latest assistant reply |

1. Enter plan mode with `/plan`.
2. The agent writes a plan.
3. Plannotator opens in the browser. The native dsh card should not appear.
4. Approve, deny, or dismiss. dsh stays in sync with that decision.

| Reviewer action | What dsh does |
| --- | --- |
| Approve | Leave plan mode and continue. |
| Approve with notes | Leave plan mode, then inject the notes as a follow-up user message. |
| Deny / annotate | Stay in plan mode. The agent revises with your feedback. |
| Dismiss (close the UI) | Stay in plan mode and wait for your next message. |

## Requirements

- [dsh](https://github.com/deepseek-ai/deepseek-harness) `0.1.0-rc.6` or a compatible developer preview
- Node.js 18+ (dsh itself still wants 22+)
- A `plannotator` CLI that already ships `plannotator opencode-plan` (current releases do)

Install the CLI if it is missing:

```bash
# macOS / Linux / WSL
curl -fsSL https://plannotator.ai/install.sh | bash

# Windows PowerShell
irm https://plannotator.ai/install.ps1 | iex
```

Then confirm it is on `PATH` (or at `~/.local/bin/plannotator`):

```bash
plannotator --help
```

## Install

```bash
dsh plugin --profile web add dsh-plannotator
dsh web
```

Check that the layer is composed:

```bash
dsh --profile web --dump-config   # look for "# == dsh-plannotator"
```

Use `/plan`, let the agent propose a plan, and review it in Plannotator.

The same flows are also available as official **terminal** subcommands (`plannotator review`, `plannotator annotate`, `plannotator last`). The slash commands above wrap those CLIs inside dsh.

### From this checkout

```bash
git clone https://github.com/eightHundreds/dsh-plannotator.git
cd dsh-plannotator
dsh plugin --profile web add .
dsh web
```

No install or build step. A local `dsh plugin add .` stays linked to this checkout.

Dev-load with a `--patch` overlay (plugin path must be absolute):

```yaml
# dev.cordis.yml
- insert:
    - id: dsh-plannotator
      name: /absolute/path/to/dsh-plannotator/index.js
```

```bash
dsh --profile web --patch ./dev.cordis.yml
```

## Uninstall

```bash
dsh plugin --profile web remove dsh-plannotator
```

A broken bundle patch can keep the whole `web` profile from booting. If `dsh web` no longer starts after install, remove the plugin and run `--dump-config` again.

## How it works

When the agent leaves plan mode, this plugin opens the official Plannotator app and waits. Approve, deny, or dismiss is then applied back in dsh. Anything else is left to the official tools.

## Configuration

Defaults work with a normal Plannotator install. Override only if the binary is not where the plugin looks.

| Variable | Purpose |
| --- | --- |
| `PLANNOTATOR_BIN` | Absolute path to the `plannotator` executable. |
| `PLANNOTATOR_DSH_USE_SOURCE=1` | Run the Plannotator hook server from a local checkout via `bun`. |
| `PLANNOTATOR_DSH_SOURCE_ROOT` | Directory to walk upward from when searching for that checkout. |
| `PLANNOTATOR_DSH_SOURCE_ENTRY` | Exact path to `apps/hook/server/index.ts`. |
| `PLANNOTATOR_BUN` / `BUN` | `bun` executable used in source mode. |

Without `PLANNOTATOR_BIN`, the plugin uses `~/.local/bin/plannotator` when that file exists, otherwise `plannotator` on `PATH`. On Windows it also checks `%LOCALAPPDATA%\plannotator\plannotator.exe`.

The child process always gets `PLANNOTATOR_ORIGIN=dsh` and `PLANNOTATOR_CWD=<session cwd>`. The stock `opencode-plan` command still hard-codes an OpenCode origin in the UI badge; that is a Plannotator-side limit.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Native dsh review card still appears | Plugin layer missing in `--dump-config`, plan mode not active, or the plan does not start with `# …`. |
| `Could not find \`plannotator\`` | Install the CLI, or set `PLANNOTATOR_BIN`. |
| `dsh web` never boots after install | Remove the plugin. Do not add a hard `inject: ['planMode']` to the host patch. |
| `exit_plan_mode is only available in plan mode` | Older builds returned a bare `{ approved: true }` and failed the official schema. Upgrade this plugin. |
| Badge says OpenCode | Expected. The stock CLI labels `opencode-plan` that way. |

## What this plugin does not do

- Change the Plannotator monorepo (native `dsh` origin, installer)
- Replace `UserQuestionProvider` or wrap Claude `hooks.json`

## Development

```bash
node --test
```

## References

- [dsh-plugin-starter](https://github.com/ciceroyang/dsh-plugin-starter)
- Field guide: https://github.com/ciceroyang/dsh-report-studio/blob/main/docs/tutorial-zh.md

## License

[MIT OR Apache-2.0](./LICENSE)
