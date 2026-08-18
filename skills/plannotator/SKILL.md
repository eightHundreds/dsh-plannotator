# plannotator — 用官方 Plannotator 审计划与批注

打开用户本机已安装的官方 [Plannotator](https://plannotator.ai) 应用，审阅当前计划、批注文件，或把审阅反馈写回会话。不要自己在聊天里另做一套审阅 UI。

## 何时使用

- 用户在计划模式里要审计划、批准计划、拒绝计划，或说「用 Plannotator 打开」。
- 用户要审当前改动 / PR、批注某个文件或网址、批注你上一条回复。
- 用户提到 `/plannotator-review`、`/plannotator-annotate`、`/plannotator-last`。

## 流程

1. **计划审阅**：进入 `/plan` 后照常写计划。计划必须以 `# …` 标题开头。当你调用 `exit_plan_mode` 时，本插件会拦截并打开官方 Plannotator，而不是 dsh 自带审阅卡。
2. **等人审完**：根据审阅结果继续：
   - 批准：离开计划模式，开始实现。
   - 带备注批准：离开计划模式，先落实备注再实现。
   - 拒绝 / 批注：留在计划模式，按反馈改计划后再交一次。
   - 关掉窗口：留在计划模式，停在这里等用户下一句话。
3. **用户主动打开**：
   - 审当前改动或 PR：提示用户发 `/plannotator-review`，可贴 PR URL。
   - 批注文件 / 文件夹 / URL：提示用户发 `/plannotator-annotate <目标>`。
   - 批注你上一条回复：提示用户发 `/plannotator-last`。

## 硬规则

- 不要伪造 Plannotator 的批准/拒绝结果。没打开官方应用就当审阅未发生。
- 不要建议用户去改 Plannotator 源码或套 Claude `hooks.json`。
- `exit_plan_mode` 的 `plan` 必须是以 `# ` 开头的 Markdown。没有标题时插件不会拦截，官方校验会失败。
- 本机没有 `plannotator` CLI 时，告诉用户先装官方 CLI，或设置 `PLANNOTATOR_BIN`。不要假装已经审过。
