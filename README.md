# dsh-plannotator

[中文说明](./README.zh.md)

When the agent finishes a plan, [Plannotator](https://plannotator.ai) opens so you can read it, leave notes, approve it, or send it back.

Works with [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). You stay in the review UI until you decide; the agent only continues after you approve.

## Install

You need `dsh` and the [Plannotator](https://plannotator.ai/docs/getting-started/installation/) app.

```bash
dsh plugin --profile web add dsh-plannotator
dsh web
```

Enter plan mode with `/plan`. When the agent presents a plan, Plannotator opens. Approve to start the work, or send notes back and keep planning.

```bash
dsh plugin --profile web remove dsh-plannotator
```

## License

MIT OR Apache-2.0
