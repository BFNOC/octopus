# utils/xslice/ - 切片工具

> 导航：[根目录](../../../CLAUDE.md) > internal > utils > **xslice**

## 职责

泛型切片去重工具。

## 关键文件

| 文件 | 职责 |
|------|------|
| `xslice.go` | `Unique[T comparable](items)`：按序去重；`UniqueFunc[T, K](items, key)`：按自定义 key 函数去重 |

## 依赖关系

- 无外部依赖
