# Requirements

- 修复网页中“前端版本 (unknown) 与后端版本 (...) 不一致”的误报。
- 优先修复前端版本来源或注入链路，而不是仅隐藏提示。
- 保持现有后端版本真相源不变，避免误改 `web/package.json` 这类非 release truth source。
- 完成后验证前端构建与版本比对行为。
