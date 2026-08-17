# dsh-plannotator

[English](./README.md)

代理写完计划后，会打开 [Plannotator](https://plannotator.ai)：你可以通读、批注、批准，或打回重写。

这是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的插件。审阅界面会一直等到你做完决定；只有批准之后，代理才会动手。

## 安装

需要已安装 `dsh` 和 [Plannotator](https://plannotator.ai/docs/getting-started/installation/)。

```bash
dsh plugin --profile web add dsh-plannotator
dsh web
```

用 `/plan` 进入计划模式。代理交出计划时会打开 Plannotator。批准就开始干活，也可以写下意见打回继续改。

```bash
dsh plugin --profile web remove dsh-plannotator
```

## 许可

MIT OR Apache-2.0
