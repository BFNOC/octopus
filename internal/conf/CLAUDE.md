# conf/ - 配置管理

> 导航：[根目录](../../CLAUDE.md) > internal > **conf**

## 职责

基于 Viper 的应用配置加载与全局常量管理。支持 JSON 配置文件、环境变量覆盖（前缀 `OCTOPUS_`），并暴露统一的 `AppConfig` 单例。

## 入口与公开接口

| 符号 | 说明 |
|------|------|
| `Load(cfgFile string)` | 加载配置：默认从 `data/config.json` 读取，缺失则生成默认配置 |
| `AppConfig` | 全局配置单例（结构体，包含 Server/Database/Log 等子配置） |
| `IsDebug() bool` | 判断当前是否为 Debug 模式 |
| `PrintBanner()` | 启动时打印 ASCII Banner |
| `APP_NAME`, `VERSION` 等常量 | `const.go` / `version.go` 中定义 |

## 关键文件

| 文件 | 职责 |
|------|------|
| `config.go` | 配置结构体、`Load`、默认值、Viper 绑定 |
| `const.go` | 应用常量：`APP_NAME`、目录名、默认值 |
| `debug.go` | Debug 标志判断 |
| `banner.go` | 启动 Banner 渲染 |
| `version.go` | 版本号（构建时注入） |

## 依赖关系

- `github.com/spf13/viper` - 配置解析
- 被 `cmd/start.go`、`internal/db`、`internal/server` 等几乎所有模块引用

## 上游同步注意事项

- 新增配置字段属于 **纯新增字段安全** 范畴，可直接修改 `config.go`
- 环境变量统一使用 `OCTOPUS_` 前缀，避免与上游冲突
