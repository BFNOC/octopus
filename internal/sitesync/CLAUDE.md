# sitesync/ - 站点同步核心

## 职责
与外部 LLM 站点 API 同步：账户信息、模型列表、定价、余额、签到、项目管理。

## 关键文件

| 文件 | 职责 |
|------|------|
| `core.go` | 核心同步逻辑：`SyncAccount`, `CheckinAccount`, `ProjectAccount`, `ProjectSite` |
| `sync.go` | 同步编排：`SyncAll`, 批量同步 |
| `sync_fetch.go` | 同步数据拉取：从站点 API 获取账户/模型/价格数据 |
| `storage.go` | 同步结果持久化到数据库 |
| `schedule.go` | 同步调度：定时同步策略 |
| `detect.go` | 站点类型探测：自动识别站点 API 格式 |
| `http.go` | 站点 HTTP 客户端封装 |
| `pricing.go` | 价格同步逻辑 |
| `balance.go` | 余额查询与同步 |
| `project.go` | 项目管理：模型分组投影 |
| `create_key.go` | API Key 创建/管理 |
| `anyrouter.go` | AnyRouter 站点适配 |
| `sub2api_auth.go` | Sub2API 认证适配 |
| `route_probe.go` | 路由探测：测试站点 API 可达性 |
| `stub.go` | Stub 实现 |
| `errors.go` | 错误类型定义 |
| `sync_result.go` | 同步结果数据结构 |

## 数据流

```
定时任务 (task/) → SyncAll → SyncAccount (per site)
    → http.go 拉取站点数据
    → sync_fetch.go 解析响应
    → storage.go 持久化到 DB
    → pricing.go 同步价格
```

## 依赖
- `op/` - 站点/通道 CRUD
- `model/` - 数据模型
- `client/` - HTTP 客户端
