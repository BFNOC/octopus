# probe/ - 模型探活

## 职责
并发探测 LLM 模型可用性，记录 TTFT (Time To First Token) 和错误信息。

## 关键文件

| 文件 | 职责 |
|------|------|
| `probe.go` | 探测核心：`ProbeInput`/`ProbeResult` 定义，发送探测请求并收集结果 |
| `scheduler.go` | 探测调度器：管理探测频率、并发控制 |
| `classifier.go` | 结果分类器：判断探测成功/失败/超时 |

## 数据流

```
定时/手动触发 → scheduler → probe (并发请求各模型) → classifier 分类结果 → 存储到 op/ 缓存
```

## 依赖
- `client/` - HTTP 请求
- `op/` - 获取通道配置、存储探测结果
- 被 `relay/` 查询以排除不可用模型
