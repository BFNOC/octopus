# utils/xurl/ - URL/DataURL 工具

> 导航：[根目录](../../../CLAUDE.md) > internal > utils > **xurl**

## 职责

Data URL 解析与操作工具，遵循 RFC 2397 规范。

## 关键文件

| 文件 | 职责 |
|------|------|
| `dataurl.go` | `ParseDataURL(url) *DataURL`：解析 data URL 为结构体（MediaType/Data/IsBase64）；`IsDataURL`：判断；`ExtractBase64FromDataURL`：提取 base64 数据；`ExtractMediaTypeFromDataURL`：提取 MIME 类型 |

## 依赖关系

- 无外部依赖
