# web/src/components/modules/wizard/

> 导航：[根目录](../../../../../CLAUDE.md) > [web](../../../../CLAUDE.md) > src > components > [modules](../CLAUDE.md) > **wizard**

## 职责

首次使用的 4 步快速设置向导（Quick Start Wizard），引导用户从零完成"添加站点 → 同步模型 → 过滤模型 → 分配分组"全流程；完成后跳转至 group 面板。

入口由两处触发：

- `QuickStartCard` — 在首页 (`modules/home`) 显示"4 步完成站点配置"卡片，点击通过 `useNavStore.setActiveItem('wizard')` 切换到本模块
- 路由系统直接打开 `wizard` 项

整个流程的状态由 `store.ts` 中的 Zustand store 管理；步骤切换通过 `setStep(n)` 推进，向导结束时调用 `reset()` 恢复初始状态。

## 入口与公开接口

| 标识 | 类型 | 作用 |
|------|------|------|
| `WizardPage` | React component（`index.tsx`） | 模块根组件，根据 `useWizardStore().step` 渲染对应 Step 子组件 |
| `QuickStartCard` | React component | 首页快速入口卡片，跳转到 wizard |
| `StepIndicator` | React component | 4 步进度条（已完成 / 当前 / 未达） |
| `Step1AddSite` / `Step2Sync` / `Step3Filter` / `Step4Group` | React components | 各步骤面板 |
| `useWizardStore` | Zustand hook | 全局向导状态 |
| `WizardStep` | type alias `1 \| 2 \| 3 \| 4` | 步骤索引类型 |

## 关键文件

| 文件 | 职责 |
|------|------|
| `index.tsx` | `WizardPage` 顶层容器，使用 `PageWrapper` 包裹滚动区，根据当前 `step` 切换子组件 |
| `store.ts` | Zustand store：步骤索引、表单数据、初始化与重置 |
| `StepIndicator.tsx` | 顶部进度条（4 个圆点 + 连接线），状态：已完成（实心 + 勾）/ 当前（描边 + 主题色）/ 未达（灰） |
| `QuickStartCard.tsx` | 首页入口卡片，单按钮 "开始设置" 跳转到 wizard |
| `Step1AddSite.tsx` | 站点 + 账号创建表单 |
| `Step2Sync.tsx` | 同步触发与结果表格展示 |
| `Step3Filter.tsx` | 模型搜索/选择 + 过滤模式选择 |
| `Step4Group.tsx` | 分组选择或新建，完成跳转 |

## 核心机制

### 1. 状态机定义 (`store.ts`)

```typescript
interface WizardState {
    step: 1 | 2 | 3 | 4;
    siteId: number | null;          // Step1 创建后填充
    accountId: number | null;       // Step1 创建后填充
    channelId: number | null;       // 预留（当前未消费）
    groupId: number | null;         // 预留（当前未消费）
    selectedModels: string[];       // Step3 选中的模型名
    filterMode: 'none' | 'deny-list' | 'allow-list';
    // setters + reset
}
```

**初始状态** (`initialState`)：

- `step=1`，所有 ID `null`，`selectedModels=[]`，`filterMode='none'`
- `reset()` 恢复全部字段（Step4 完成后调用）

**步骤切换规则**：

- 步骤推进通过 `setStep(n)`，由各 Step 组件按钮触发
- 没有"上一步"按钮 — 向导是单向线性流程；如需回退，用户可重新打开 wizard（注意：未做持久化，刷新页面状态丢失）
- **跳过条件**：Step2 在 `models.length === 0` 时下一步按钮禁用；Step4 在 `mode='existing' && !selectedGroupId` 时禁用
- **回退规则**：暂未实现。`siteId` 与 `accountId` 一旦写入即在整个流程中不可变；如果用户中途关闭向导，已创建的站点/账号会保留（需到 site 模块手动删除）

### 2. Step 1 — 添加站点 (`Step1AddSite.tsx`)

**数据契约（输入）**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✓ | 站点显示名 |
| `baseUrl` | string | ✓ | API 基址 |
| `platform` | SitePlatform \| '' | 可选 | 留空走自动检测 |
| `token` | string | ✓ | 凭证（API Key / Access Token / 密码） |
| `platformUserId` | string | 可选 | 部分平台同步必需 |

**支持平台** (`PLATFORM_OPTIONS`)：NewAPI / Sub2API / OpenAI / Claude / Gemini / OneAPI / OneHub / AnyRouter / DoneHub

**凭证类型映射** (`defaultCredentialType`)：

- `Sub2API` → `AccessToken`
- `OpenAI` / `Claude` / `Gemini` → `APIKey`
- 其他 → `UsernamePassword`

**流程**：

1. 表单校验（name / baseUrl / token 非空）
2. 若 `platform` 留空 → `useDetectSitePlatform().mutateAsync(baseUrl)` 自动检测
3. `useCreateSite().mutateAsync(...)` 创建站点 → 拿到 `site.id` 存入 store
4. 用平台对应的凭证类型构造账号 payload，`useCreateSiteAccount().mutateAsync(...)` 创建默认账号 → 拿到 `account.id` 存入 store
5. `setStep(2)` 进入下一步

**API 依赖**：`@/api/endpoints/site` — `useCreateSite`、`useCreateSiteAccount`、`useDetectSitePlatform`、枚举 `SitePlatform`、`SiteCredentialType`

**默认账号字段**：`name='默认账号'`、`enabled=true`、`auto_sync=true`、`auto_checkin=true`、`checkin_interval_hours=24`、`checkin_random_window_minutes=120`

### 3. Step 2 — 同步模型 (`Step2Sync.tsx`)

**依赖**：`store.accountId`（Step1 写入）

**流程** (`useEffect` 监听 `accountId`)：

1. 设置 `syncing=true`
2. `useSyncSiteAccount().mutateAsync(accountId)` 触发同步
3. `useSiteChannelList().refetch()` 刷新通道列表
4. 在返回数据中按 `site_id === siteId` 找到卡片 → 找到 `account_id === accountId` 的账号 → flatMap 所有 group 的 models → `setModels(allModels)`
5. `setSyncing(false)`

**UI 三态**：

- `syncing=true` — Loader 旋转 + "正在同步模型..."
- `syncError != null` — 红色提示框
- `syncing=false && !syncError` — 表格展示（模型名 / 路由类型 / 状态 Badge），底栏显示"共 N 个模型"+ 下一步按钮（`models.length === 0` 时禁用）

**数据契约（输出）**：模型清单留在组件本地 `useState`，**不写入 store**。Step3 通过 `useSiteChannelList()` 重新查询同样的列表（依赖 React Query 30s 缓存）。

### 4. Step 3 — 过滤模型 (`Step3Filter.tsx`)

**输入**：`siteId`、`accountId`（来自 store）

**数据来源**：`useSiteChannelList()` 重新查询，在 `useMemo` 中按 site_id + account_id 定位到目标账号的全部模型名 → `allModels: string[]`

**交互**：

| 操作 | 状态变更 |
|------|---------|
| 搜索框输入 | 本地 `search` state，`filteredModels` 按 lowercase substring 过滤 |
| 单个模型 checkbox | `toggleModel(name)` → 切换 `selectedModels` |
| "全选" / "全不选" | `selectAll` / `selectNone` |
| 过滤模式按钮组 | `setFilterMode('none' \| 'deny-list' \| 'allow-list')` |

**数据契约（输出）**：`selectedModels: string[]` + `filterMode` 写入 store；具体的"白名单/黑名单"应用到通道层目前**未在向导内执行**（在 store 中保存但 Step4 完成时未调用对应 API；后续在 site-channel 模块继续配置）。

### 5. Step 4 — 分配分组 (`Step4Group.tsx`)

**模式选择**：`mode: 'existing' | 'new'`

**existing 模式**：

- `useGroupList()` 拉取分组列表 → Select 下拉
- 用户选择已有分组 → "完成" 按钮启用（`!selectedGroupId` 时禁用）

**new 模式**：

- 输入新分组名 → `useCreateGroup().mutateAsync({name, mode: GroupMode.RoundRobin, match_regex: ''})`
- 默认创建 RoundRobin 模式分组，无匹配正则（后续可在 group 模块编辑）

**摘要面板**：展示 `selectedModels.length` 与 `filterMode`（仅显示，不再做 API 调用）

**完成动作** (`handleFinish`)：

1. 若 `mode='new'`，先调 `useCreateGroup().mutateAsync(...)`
2. `toast.success('快速设置完成！')`
3. `useWizardStore().reset()` 清空状态机
4. `useNavStore().setActiveItem('group')` 跳转到分组面板

**注意**：当前实现**未把选中的模型实际绑定到目标分组**——`selectedModels`、`filterMode` 在 store 中收集但 Step4 没有调用绑定 API；这是后续需要补完的环节（建议下一次迭代在 `handleFinish` 中调 site-channel 绑定接口）。

### 6. 步骤指示器 (`StepIndicator.tsx`)

`STEPS` 常量定义 4 步标签：`['添加站点', '同步模型', '过滤模型', '分配分组']`。

视觉状态：

- `isCompleted = stepNum < currentStep` — 实心主题色 + Check 图标
- `isCurrent = stepNum === currentStep` — 描边 + 主题色文字 + 加粗 label
- 其他 — 灰色描边 + 灰色文字
- 步骤间连接线 (`< STEPS.length - 1`) — 已完成段实心主题色，否则灰色

## 依赖关系

### 上游依赖（API 层）

- `@/api/endpoints/site` — `useCreateSite`, `useCreateSiteAccount`, `useDetectSitePlatform`, `useSyncSiteAccount`, `useSiteList`, 枚举 `SitePlatform` / `SiteCredentialType`
- `@/api/endpoints/site-channel` — `useSiteChannelList`, 类型 `SiteChannelModel`
- `@/api/endpoints/group` — `useGroupList`, `useCreateGroup`, 枚举 `GroupMode`

### UI 与导航

- `@/components/ui/{button,input,label,card,select,badge}` — shadcn 原语
- `@/components/common/PageWrapper` — 页面外壳
- `@/components/modules/navbar` — `useNavStore` 切换主导航项
- `lucide-react` — `Zap` / `Loader2` / `Search` / `Check` 图标
- `sonner` — `toast` 提示
- `zustand` — store 框架

### 状态与外部消费者

- **本模块 store** (`useWizardStore`) — 仅供四个 Step 内部使用，不被其他模块读取
- **跨模块跳转** — 通过 `useNavStore.setActiveItem` 把控制权交回主路由

## 测试覆盖

当前向导模块**未发现单元测试或 e2e 测试文件**。建议后续补充：

| 待补测试 | 验证点 |
|---------|--------|
| Step1 表单校验 | 空字段报错、自动检测平台失败提示 |
| Step1 创建链路 | site 与 account 顺序创建、ID 正确写入 store |
| Step2 同步失败 | error 状态展示 |
| Step3 过滤逻辑 | 搜索 + 多选 + 全选/全不选 |
| Step4 模式切换 | existing / new 禁用条件 |
| reset 流程 | 完成后 store 完全清空 |
| 完整 e2e | Playwright 走 4 步流程（依赖 `rules/typescript/testing.md` 中的 e2e-runner） |

## 上游同步注意事项

本模块是 fork 后新增的前端独立组件，**符合上游同步铁律第 5 条「前端独立组件」**——所有文件均位于 `modules/wizard/` 目录下，未修改任何上游已有组件的核心逻辑。修改前必读根 [CLAUDE.md](../../../../../CLAUDE.md#上游同步策略铁律)。

1. **保持目录自包含**：所有向导特有组件、store、类型都放在本目录下；不要把 `Step*` 组件提到 `components/common/` 以免污染共享层。
2. **API 调用通过 endpoints 层**：禁止在 Step 组件内直接 `fetch`；统一通过 `@/api/endpoints/*` 暴露的 React Query hooks 调用，便于上游 API 形变时单点适配。
3. **store 字段新增安全**：`WizardState` 接口可追加字段（已为 `channelId` / `groupId` 预留位置）；新字段必须在 `initialState` 中给默认值，并在 `reset` 隐式覆盖。
4. **不修改 shadcn / animate-ui 原语**：本目录引用 `@/components/ui/*` 仅作为消费方；如需新视觉风格，新建变体而非改动原语。
5. **导航跳转走 useNavStore**：不要在向导内部使用 router push 或硬跳转；维持与全局 SPA 路由 (`route/config.tsx`) 的一致性。
6. **i18n 未接入**：当前文案为中文硬编码（"添加站点"、"创建中..." 等）；若上游/后续接入 next-intl，需把所有 user-facing 字符串迁到 `public/locale/*.json`，按 key 追加而不删除。
7. **当前缺口**（不属于违规但需后续补完）：
   - Step3 过滤模式选择未在 Step4 实际应用到通道；
   - 中途退出无清理逻辑（已创建的 site/account 会残留）；
   - 缺单元测试与 e2e。
