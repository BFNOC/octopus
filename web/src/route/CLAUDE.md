# web/src/route/ - SPA 路由

> 导航：[根目录](../../../CLAUDE.md) > [web](../../CLAUDE.md) > src > **route**

## 职责

自定义单页路由：不使用 Next.js 文件路由（项目用 SSG 模式 + 单 `page.tsx` 入口）。所有路由通过 `config.tsx` 配置 + `ContentLoader` 动态加载。

## 关键文件

| 文件 | 职责 |
|------|------|
| `config.tsx` | 路由表：path → 懒加载组件，包含图标、标签、显隐控制 |
| `content-loader.tsx` | 当前路由的内容渲染器（带 Suspense + 错误边界） |
| `error-boundary.tsx` | 路由级错误边界 |
| `lazy-with-preload.ts` | `lazyWithPreload(import())`：懒加载 + 可预热 |
| `use-preload.ts` | Hook：根据 hover/idle 触发预加载 |
| `index.ts` | 统一导出 |

## 使用模式

```tsx
// config.tsx
export const routes = [
  { path: '/channels', label: 'Channels', icon: ..., component: lazyWithPreload(() => import('@/components/modules/channel')) },
  ...
];
```

`navbar` 渲染时 `usePreload` 对 hover 的路由触发 import，缩短切换延迟。

## 依赖关系

- `react` (Suspense, lazy)
- `web/src/components/modules/*` - 各模块入口组件

## 上游同步注意事项

- 新增页面：在 `config.tsx` 追加路由项，组件放 `components/modules/<feature>/index.tsx`
- 不修改 `lazy-with-preload.ts` 已有签名（路由系统的核心机制）
