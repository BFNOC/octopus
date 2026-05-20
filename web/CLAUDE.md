# web/ - 管理面板前端

> 导航：[根目录](../CLAUDE.md) > **web**

## 职责

基于 Next.js (SSG 模式) 的 Octopus 管理面板。构建产物为静态文件，由后端 Go 二进制内嵌（`static/` 包）。

## 技术栈

- **框架**: Next.js 15（`output: "export"` 静态导出）
- **包管理**: pnpm
- **UI**: shadcn/ui + Radix UI + TailwindCSS v4 + Framer Motion
- **状态**: Zustand（本地） + TanStack React Query（服务端缓存，30s 刷新）
- **i18n**: next-intl（`public/locale/{en,zh_hans,zh_hant}.json`）
- **路由**: 自定义 SPA 路由（**不使用** Next.js 文件路由），见 [src/route/CLAUDE.md](./src/route/CLAUDE.md)

## 开发命令

```bash
pnpm install                                           # 安装依赖
pnpm dev                                               # 开发服务器 (localhost:3000)
NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8080" pnpm dev   # 指定后端地址
pnpm build                                             # 生产构建 → web/out/
pnpm lint                                              # ESLint
```

## 目录结构

| 路径 | 职责 |
|------|------|
| `src/app/` | Next.js App Router 入口（`layout.tsx` + `page.tsx`） |
| `src/api/` | HTTP 客户端 + React Query hooks，详见 [src/api/CLAUDE.md](./src/api/CLAUDE.md) |
| `src/components/` | 通用与业务组件，详见 [src/components/modules/CLAUDE.md](./src/components/modules/CLAUDE.md) |
| `src/route/` | SPA 路由配置、懒加载、错误边界，详见 [src/route/CLAUDE.md](./src/route/CLAUDE.md) |
| `src/stores/` | Zustand 全局 stores |
| `src/hooks/` | 自定义 hooks |
| `src/lib/` | 工具函数、动画、Logger |
| `src/provider/` | React Context Providers（locale, theme, query） |
| `public/locale/` | i18n 翻译文件 |

## 构建与嵌入流程

```
cd web && pnpm build              # 输出 web/out/
mv web/out static/                # 移到 Go 嵌入目录
go run main.go start              # 后端启动并通过 static.go 嵌入服务
```

## 上游同步注意事项

- 新增 UI 组件优先放在 `components/modules/<feature>/`，不修改上游已有组件的核心逻辑
- 复用 shadcn/ui 与 animate-ui 原语，避免重复造轮子
- 翻译文件按 key 追加，不删除/重命名已有 key
