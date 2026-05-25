# Requirements

用户要求调整快速设置中的站点凭据输入方式：

- 快速设置中 Sub2API 不应只使用单个 access token。
- Sub2API session 凭据应支持三段信息：access token、refresh token、时间戳。
- 其他平台也应参考 `/Users/chaos/developments/github_go/metapi` 的实现，不只修 Sub2API。

当前 octopus 观察：

- `web/src/components/modules/wizard/Step1AddSite.tsx` 原本只维护单个 `token` state。
- 创建账号时 `refresh_token` 固定为 `""`，`token_expires_at` 固定为 `0`。
- `web/src/api/endpoints/site.ts` 和后端模型已支持 `refresh_token` 与 `token_expires_at`。
- `web/src/components/modules/site/index.tsx` 已有完整凭据规则：Sub2API 默认 Access Token；OpenAI/Claude/Gemini 默认 API Key；其他管理平台默认 UsernamePassword，并允许三种凭据。

目标：

- 仅在快速设置选择 Sub2API + Access Token 凭据时展示额外输入。
- 创建默认账号时保存 access token、refresh token、token expires timestamp。
- 快速设置的默认凭据类型和可选凭据类型与站点管理页保持一致。
- NewAPI / OneAPI / OneHub / AnyRouter / DoneHub 支持用户名密码、Access Token、API Key。
- OpenAI / Claude / Gemini 支持 API Key 和 Access Token，默认 API Key。
- API Key 路径不应携带 username/password/access token/refresh token。
