# server/auth/ - 认证

> 导航：[根目录](../../../CLAUDE.md) > internal > [server](../CLAUDE.md) > **auth**

## 职责

JWT 生成与验证（管理面板登录），以及 `sk-octopus-*` 格式 API Key 的格式约定。

## 关键文件

| 文件 | 职责 |
|------|------|
| `auth.go` | JWT 签发、解析、过期校验；JWT secret 持久化到 Setting（首次启动生成） |

## 公开接口（典型）

| 符号 | 说明 |
|------|------|
| `GenerateToken(userID int) (string, error)` | 签发 JWT |
| `ParseToken(token string) (*Claims, error)` | 解析并校验 |
| `getJWTSecret() []byte` | 内部：懒加载 secret，缺失则生成并写入 `Setting`（key = `SettingKeyJWTSecret`） |

API Key 校验逻辑在 `middleware/auth.go`，使用 `op/apikey` 查询。

## 依赖关系

- `github.com/golang-jwt/jwt/v5` - JWT 库
- `internal/conf` - 过期时长配置
- `internal/op` - Setting 读写（JWT secret 持久化）

## 上游同步注意事项

- JWT secret 一旦生成必须持久化，禁止改为每次重启重生成（会作废所有 token）
- 新增 Claims 字段是兼容的；修改/删除字段会破坏现有 token
