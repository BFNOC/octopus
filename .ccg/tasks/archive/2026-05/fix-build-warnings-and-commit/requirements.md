# Requirements

用户要求：

- 修复上一次 `pnpm build` 输出的 warning。
- 编写中文 commit。

当前已知 warning：

- `baseline-browser-mapping` 数据过期。
- Node `[DEP0205] module.register()` deprecation warning。
- 构建期 `localStorage is not available because --localstorage-file was not provided` experimental warning。

约束：

- 不提交无关 untracked 文件：`.DS_Store`、`.antigravitycli/`、`openspec/`。
- 业务代码 commit 使用中文提交信息。
- CCG 任务完成后归档。
