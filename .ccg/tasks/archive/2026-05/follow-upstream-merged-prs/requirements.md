## 用户需求

- 当前 `dev` 分支跟随合并上游 `Hureru/octopus` 和最上游 `bestruirui/octopus` 的已合并 PR。
- 如果 GitHub 访问慢，使用本机代理：
  - `https_proxy=http://127.0.0.1:7897`
  - `http_proxy=http://127.0.0.1:7897`
  - `all_proxy=socks5://127.0.0.1:7897`
- 合并后检查是否存在冲突或可疑冲突点；如出现需要人工判断的冲突，先询问用户。
- 如果上游包含版本 bump，本地版本应更新为上游版本加 `-fork.1`。

## 初始状态

- 当前分支：`dev`
- 本地已有未提交改动：
  - `internal/conf/version.go`
  - `web/src/components/modules/wizard/Step1AddSite.tsx`
- 存在未跟踪文件：
  - `.DS_Store`
  - `.antigravitycli/`
  - `openspec/`

## 约束

- 不回滚用户已有改动。
- 仅在需要保护工作区时暂存/恢复 tracked 改动。
- 合并冲突无法安全判断时停止并询问用户。
