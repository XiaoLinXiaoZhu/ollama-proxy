# Ollama Proxy (TypeScript/Bun 版本)

将 Ollama API 请求代理到其他 AI 服务提供商的轻量级代理服务器，现使用 TypeScript 和 Bun 运行时实现。

## 特性

- 兼容 Ollama API 接口
- 支持所有 OpenAI 兼容的 API 提供商
- 支持预定义的提供商（Novita、SiliconFlow、Groq 等）
- 配置热重载
- 端口冲突自动处理
- 详细的调试日志
- 完整的 TypeScript 类型支持
- 模块化架构，易于维护和扩展

## 安装与运行

### 前提条件
- [Bun](https://bun.sh) 运行时 (v1.0+)

### 安装依赖
```bash
bun install
```

### 启动服务器
```bash
bun run start
```

### 调试模式
```bash
DEBUG=true bun run start
```

### 运行测试
```bash
bun run test
```

## 配置

创建配置文件 `config.yaml`（如果不存在会自动创建）：

```yaml
# 服务器配置
server:
  port: 11434                    # 起始端口号
  hostname: "127.0.0.1"          # 监听地址
  maxPortAttempts: 20            # 端口冲突时最大尝试次数

models:
  # 方式1：使用 baseUrl（推荐，支持所有 OpenAI 兼容的 API）
  - name: "gpt-4o-mini"
    baseUrl: "https://api.openai.com/v1"
    model: "gpt-4o-mini"
    apiKey: "your_openai_api_key_here"
    systemMessage: "You are a helpful assistant."

  # 方式2：使用预定义的提供商名称
  - name: "qwen-max"
    provider: "siliconflow"
    model: "Qwen/Qwen1.5-72B-Chat"
    apiKey: "your_siliconflow_api_key_here"
    systemMessage: "You are a helpful AI assistant."
```

### 配置说明

#### 服务器配置

| 字段 | 默认值 | 说明 |
|------|--------|------|
| port | 11434 | 起始端口号 |
| hostname | "127.0.0.1" | 监听地址 |
| maxPortAttempts | 20 | 端口冲突时最大尝试次数 |

#### 模型配置

| 字段 | 说明 | 必需 |
|------|------|------|
| name | 在 Ollama 中使用的模型名称 | 是 |
| baseUrl | OpenAI 兼容的 API 基础 URL | 否¹ |
| provider | 预定义的提供商名称 | 否¹ |
| model | 服务提供商的实际模型名称 | 是 |
| apiKey | API 密钥 | 是 |
| systemMessage | (可选) 系统消息模板 | 否 |
| modelfile | (可选) 自定义 Modelfile 内容 | 否 |
| parameters | (可选) 模型参数配置 | 否 |
| template | (可选) 提示模板 | 否 |

¹ 必须提供 `baseUrl` 或 `provider` 中的一个

### 支持的预定义提供商

| 提供商 | provider 值 | 默认 baseUrl |
|--------|-------------|-------------|
| Novita | `novita` | `https://api.novita.ai/v3/openai` |
| SiliconFlow | `siliconflow` | `https://api.siliconflow.cn/v1` |
| Groq | `groq` | `https://api.siliconflow.cn/v1` |
| xAI | `xAI` | `https://api.x.ai/v1` |
| Gemini | `gemini` | `https://generativelanguage.googleapis.com/v1beta/openai` |

## 端口冲突处理

服务器启动时会检查端口是否被占用：
- 如果起始端口被占用，会自动尝试下一个端口
- 最大尝试次数由 `server.maxPortAttempts` 配置
- 所有尝试失败后会抛出错误并退出

## 测试

运行测试脚本验证代理服务器是否正常工作：

```bash
# 确保服务器正在运行
bun run test
```

测试脚本会自动测试以下端点：
- 健康检查 (`/`)
- 模型列表 (`/v1/models`)
- Ollama 标签 (`/api/tags`)
- 聊天完成 (`/v1/chat/completions`)
- 模型详情 (`/api/show`)

## 支持的 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /` | - | 健康检查 |
| `GET /v1/models` | - | 列出所有配置的模型 |
| `GET /api/tags` | - | Ollama 兼容的模型标签列表 |
| `POST /api/show` | - | Ollama 兼容的模型详情 |
| `POST /v1/chat/completions` | - | 代理到目标提供商的聊天接口 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CONFIG_PATH` | `config.yaml` | 配置文件路径 |
| `DEBUG` | `false` | 启用调试日志 |

## 项目结构

```
ollama-proxy/
├── src/
│   ├── config.ts          # 配置管理
│   ├── handlers.ts        # 请求处理器
│   ├── proxy.ts           # 代理逻辑
│   └── server.ts          # 主服务器文件
├── config.yaml            # 配置文件（运行时创建）
├── config.yaml.example    # 配置示例
├── test-proxy.js          # 测试脚本
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
└── README.md              # 说明文档
```

## 开发

```bash
# 启动开发服务器
bun run start

# 查看类型检查
bun tsc --noEmit

# 运行测试
bun run test
```

## 架构说明

项目采用模块化架构，主要分为以下几个部分：

1. **config.ts**: 负责配置文件的加载、保存和监听
2. **handlers.ts**: 实现各种 API 端点的处理逻辑
3. **proxy.ts**: 处理代理请求，包括 TLS 证书验证问题
4. **server.ts**: 服务器启动和请求路由

这种架构使得代码更易于维护和扩展，每个模块都有明确的职责。

## 许可证
[MIT](LICENSE)
