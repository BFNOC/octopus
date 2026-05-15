# 上游同步记录

本项目跟踪两个上游仓库的变更：

| 上游 | 仓库 | 角色 |
|------|------|------|
| Hureru/octopus | `upstream/dev` | 直接上游 fork |
| bestruirui/octopus | `bestruirui/dev` | 最上游（原始仓库） |

同步策略详见 [CLAUDE.md](../CLAUDE.md#上游同步策略铁律)。

---

## 2026-05-15 同步

### Hureru/octopus (upstream/dev) — 8 commits

| Commit | 内容 | 冲突 |
|--------|------|------|
| a68edf5 | Sub2API coded errors | - |
| 7b546e5 | backup stats 导入加固 | - |
| d9f6bc1 | Sub2API sync review findings | - |
| 571229b | locale-aware API error fallbacks | - |
| 9c56be0 | group-level health checks | migration 010→011（版本号冲突） |
| b4559d1 | CI + .gitignore 更新 | - |
| 3956983 | indexed site string columns | - |
| bda5515 | group health UI 可配置 | - |

### bestruirui/octopus (bestruirui/dev) — 5/7 commits

| Commit | 内容 | 冲突 | 说明 |
|--------|------|------|------|
| 9851442 | Gemini JSON Schema 关键字剔除 | 有 | 取上游更完整的关键字列表 |
| 4211d6a | OpenAI Images API 转发 + SSE | 有 | 保留 coded errors + heartbeat，采纳 `c.Writer.Written()` 安全检查 |
| 4c4c79b | DeepSeek thinking + Nvidia kwargs | - | |
| c21e1e1 | ParamOverride 修复 | 有 | 合并 WS 字段 + ParamOverride，采纳上游的 `c.Writer.Written()` |
| d8a23d8 | saveLog 提前返回修复 | 有 | 去掉 `jsonErr` 时的 early return，确保日志始终持久化 |
| b7b053e | pnpm workspace 配置 | - | 跳过（本地已有） |
| 60aa207 | 添加国内代码托管链接 | - | 跳过（上游专属文档） |
