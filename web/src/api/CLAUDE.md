# web/src/api/ - HTTP 客户端与 API 层

> 导航：[根目录](../../../CLAUDE.md) > [web](../../CLAUDE.md) > src > **api**

## 职责

封装与后端的全部 HTTP 通信：
- 基于 fetch 的客户端（统一错误处理、401 自动登出）
- 按资源拆分的 React Query hooks（缓存、自动刷新、Optimistic 更新）
- 后端错误码 -> 用户友好文案的 i18n 映射

## 关键文件

| 文件 | 职责 |
|------|------|
| `client.ts` | `apiClient` 单例：fetch 包装、Token 注入、错误标准化、401 触发 logout |
| `types.ts` | `ApiResponse<T>`、`ApiError`、`HttpStatus` 等类型 |
| `error-i18n.ts` | 后端错误码 -> 翻译 key 的映射函数 |

## endpoints/ 子目录

每个文件对应一个后端资源，导出 React Query hooks：

| 文件 | 主要 hooks |
|------|------|
| `user.ts` | `useLogin`、`useChangePassword` |
| `apikey.ts` | `useAPIKeys`、`useCreateAPIKey`、`useDeleteAPIKey` |
| `channel.ts` | `useChannels`、CRUD mutations |
| `group.ts` | `useGroups`、CRUD mutations |
| `group-health.ts` | `useGroupHealth` 聚合健康 |
| `model.ts` | `useModels` LLM 模型列表 |
| `site.ts` | `useSites`、签到、同步；导出 `SiteType` 类型（`"free" \| "paid"`） |
| `site-channel.ts` | `useSiteChannels`（同步生成的通道） |
| `setting.ts` | `useSetting`、`useUpdateSetting` |
| `stats.ts` | `useStats` 仪表盘数据 |
| `log.ts` | `useLogs` 请求日志 |
| `tester.ts` | `useChannelTester` 通道测试 |
| `update.ts` | `useCheckUpdate`、`useDoUpdate` |

## site.ts 中的 SiteType

- `SiteType = "free" | "paid"` — 与后端 `model.SiteType` 枚举一一对应
- `Site` 类型包含 `site_type: SiteType` 字段
- `normalizeSiteServerList` 将后端返回的站点列表标准化，缺失 `site_type` 时回退为 `"free"`

## 公约

- 全部 hooks 返回 TanStack Query 标准结果 `{ data, isLoading, error, ... }`
- 默认 `staleTime` 30s，与后端轮询保持一致
- mutation 成功后由各 hook 内部 `queryClient.invalidateQueries(...)`

## 依赖关系

- `@tanstack/react-query` - 服务端缓存
- `web/src/stores/setting.ts` - 通过 `setAuthStoreGetter` 注入 Token / logout

## 上游同步注意事项

- 新增 endpoint：新建 `endpoints/<resource>.ts`，不修改 `client.ts` 的核心逻辑
- 错误码新增：在 `error-i18n.ts` 末尾追加映射

## 变更记录 (Changelog)

| 日期 | 变更 |
|------|------|
| 2025-05-21 | `site.ts` 新增 `SiteType` 类型导出；`Site` 类型添加 `site_type` 字段；`normalizeSiteServerList` 兼容缺失值 |
