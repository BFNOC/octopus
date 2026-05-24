# Requirements

用户希望完善快速设置向导：

- Step1 允许选择是否开启自动签到。
- Step1 在站点 URL 失焦后自动检测平台，并允许用户显式选择 Access Token 或 API Key 凭证模式。
- Step2 遇到站点尚未生成可用于模型同步/代理的 API Key 时，提供一键创建站点 Key 并重试同步，或提示用户手动在站点创建后重新同步。

约束：

- 按现有 wizard 模块自包含模式实现。
- 不新增后端接口，优先复用 `useCreateSiteChannelKey` / `/api/v1/site-channel/:siteId/account/:accountId/keys`。
- 这里的 API Key 指目标站点生成的 Key，不自动创建 Octopus 本地下游访问 Key。
