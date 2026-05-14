# relay/ - API 代理核心

## 职责
API 请求转发、负载均衡、通道选择、流式响应 (SSE/WebSocket)、取消、重试、降级。

## 关键文件

| 文件 | 职责 |
|------|------|
| `relay.go` | 主入口：请求转发、通道选择、响应处理 |
| `transport_ws.go` | WebSocket 传输层 |
| `ws_client.go` | WebSocket 客户端管理 |
| `ws_session.go` | WebSocket 会话管理 |
| `ws_pool.go` | WebSocket 连接池 |
| `ws_writer.go` | WebSocket 写入器 |
| `ws_state_store.go` | WebSocket 状态存储 |
| `ws_error.go` | WebSocket 错误处理 |
| `heartbeat.go` | SSE 心跳保活 |
| `cancel.go` | 请求取消处理 |
| `retry.go` | 重试策略 |
| `degrade.go` | 降级策略 |
| `compact.go` | 响应压缩 |
| `images.go` | 图片请求处理 |
| `explain.go` | 错误解释/诊断 |
| `metrics.go` | 代理指标收集 |
| `route_learning.go` | 路由学习：从响应中学习最优通道 |
| `type.go` | 类型定义 |

## 子模块

| 子模块 | 职责 |
|--------|------|
| `balancer/` | 负载均衡：`balancer.go` (入口), `iterator.go` (迭代器), `state.go` (状态), `circuit.go` (熔断器), `session.go` (会话亲和) |
| `affinity/` | 通道亲和性：`state.go` 管理会话到通道的映射 |
| `compat/` | 兼容性适配：`preflight.go` (预检), `service_tier.go` (服务层级), `web_search.go` (Web 搜索) |
| `bodycache/` | 请求体缓存：`body_cache.go` 支持重试时重放请求体 |

## 数据流

```
请求 → inbound transformer → relay.go → balancer 选通道 → 发送到外部 LLM API
                                    ↓
                              outbound transformer → 响应
```

## 依赖
- `health/` - 查询通道健康状态做通道选择
- `op/` - 获取通道配置、分组信息
- `transformer/inbound/` - 解析入站请求
- `transformer/outbound/` - 格式化出站响应
- `probe/` - 探活结果影响通道选择
