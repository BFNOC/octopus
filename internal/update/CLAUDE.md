# update/ - 自动更新

> 导航：[根目录](../../CLAUDE.md) > internal > **update**

## 职责

二进制自更新：检查 GitHub Release、下载最新版本、热替换当前可执行文件并重启。

## 关键文件

| 文件 | 职责 |
|------|------|
| `core.go` | 核心更新逻辑：版本对比、下载、校验、原地替换 |
| `update.go` | 对外接口：检查更新、触发更新（被 handler 调用） |

## 依赖关系

- `internal/conf` - 当前版本号
- `internal/client` - HTTP 下载
- 被 `server/handlers/update.go` 触发

## 上游同步注意事项

- 升级通道（Release URL、签名校验）变更需要谨慎，可能影响所有用户
- 新增校验逻辑放在 `core.go` 之外的新文件中
