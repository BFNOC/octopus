# utils/diff/ - 集合差异计算

> 导航：[根目录](../../../CLAUDE.md) > internal > utils > **diff**

## 职责

泛型集合差异计算：对比 old 和 new 切片，返回 deleted（old 有 new 无）和 added（new 有 old 无）。

## 关键文件

| 文件 | 职责 |
|------|------|
| `diff.go` | `Diff[T Elem](old, new) (deleted, added)`，支持 string/byte/int/float 等基础类型 |

## 依赖关系

- 无外部依赖
