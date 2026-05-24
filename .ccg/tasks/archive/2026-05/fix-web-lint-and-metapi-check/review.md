# Review

## Scope

- 修复 `web` 下 `pnpm lint` 报错。
- 核对 quick settings / wizard 改动是否确实参考了 `metapi` 的站点检测与凭证模式设计。

## Implementation Summary

- `web/src/api/endpoints/channel.ts`: 移除 batch update mutation 成功回调中的未使用参数。
- `web/src/api/endpoints/tester.ts`: 用 `NonStreamResponse` / `TextBlock` 替代 non-stream 响应解析里的 `any`。
- `web/src/components/modules/channel/ChannelFilterPanel.tsx`: 将账号/渠道选择从 effect 同步状态改成 render-time derived state，账号切换时清理 stale channel selection。
- `web/src/components/modules/channel/ProbeModal.tsx`: 清理未使用 import / state，补齐 effect 依赖，并用函数式 state updater 移除 `modelRows.length` 依赖。
- `web/src/components/modules/tester/index.tsx`: 用 `activeModel` 派生当前模型，移除 set-state-in-effect 模式。
- `web/src/components/modules/wizard/Step1AddSite.tsx`: 保留并加固 URL blur 检测、凭证类型选择、自动签到控制；用 refs 防止异步检测覆盖用户手动平台选择。
- `web/src/components/modules/wizard/Step2Sync.tsx`: 保留并加固缺少网站 API Key 时的创建/重试流程；拆分创建失败与刷新失败提示，修复 loading cleanup 和双提示框问题。

## Metapi Reference Evidence

- `metapi/src/web/pages/Sites.tsx:1122-1139`: URL 输入框 `onBlur` 后触发平台检测，并提供手动“自动检测”按钮。
- `metapi/src/web/pages/Accounts.tsx:37-49`: 将账号管理、API Key 管理、账号令牌管理拆成独立 segment，文案明确 API Key 只负责代理调用。
- `metapi/src/web/pages/Accounts.tsx:1473-1537`: API Key 创建流要求选择站点、粘贴 Key，可跳过模型验证，并显示 API Key 验证结果。
- `metapi/src/server/routes/api/accounts.ts:141-160`: 按 credential mode 推导 capability；API Key 模式不能签到/查余额，只是 proxy-only。
- `metapi/src/server/routes/api/accounts.ts:985-1004`: `credentialMode === 'apikey'` 时通过 adapter 拉模型验证 API Key，并返回 `tokenType: 'apikey'`。

Octopus 不是照抄 metapi UI，而是把上述设计适配到本仓库已有 API 与类型：`SiteCredentialType`、`useDetectSitePlatform`、`useCreateSiteChannelKey` 和 quick wizard store。

## Validation

- `cd web && pnpm lint`: passed
- `cd web && pnpm exec tsc --noEmit`: passed
- `cd web && pnpm build`: passed

`pnpm build` 仍输出现有 warning：`baseline-browser-mapping` 数据过期、Node `module.register()` deprecation、构建期 `localStorage` experimental warning；构建成功。

## External Review

- 双模型分析：Antigravity + Claude，结论均支持最小化修复 lint，并保留/核对 metapi 参考方向。
- 双模型复审多轮执行：
  - 第一轮发现 `Step2Sync` 创建 Key 成功但刷新失败时提示不准确，已修复。
  - 后续复审发现 `Step2Sync` hook 依赖、`ProbeModal` `modelRows.length` 依赖、创建 Key 失败双提示框等维护/UX 问题，均已修复。
  - 最终定向复审：Antigravity APPROVE；Claude 确认两个 warning 修复正确，无阻塞问题。

