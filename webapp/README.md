# SkillForge Web App

SkillForge 的 Web 应用版本，将 7 步 Skill 生成流程自动化为一键生成。

---

## 技术栈

| 层     | 技术                                        |
| ------ | ------------------------------------------- |
| 前端   | React 19 + Tailwind CSS 4 + shadcn/ui       |
| 后端   | Express 4 + tRPC 11                         |
| 数据库 | MySQL / TiDB / PostgreSQL（Drizzle ORM）    |
| LLM    | OpenAI-compatible API（支持任意兼容提供商） |
| 认证   | 本地免登录模式 / Manus OAuth（可选）        |

---

## 快速开始

### 前置条件

- Node.js 22+
- pnpm
- OpenAI-compatible LLM API Key

默认情况下不需要单独安装数据库。未设置 `DATABASE_URL` 时，应用会自动使用本地 SQLite 文件：

```env
DATABASE_URL=file:.data/skillforge.sqlite
```

如果你已经有 MySQL、TiDB 或 PostgreSQL，也可以继续显式配置。

### 安装

```bash
# 克隆仓库
git clone https://github.com/mmlong818/skillforge.git
cd skillforge/webapp

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的数据库连接和 API Key
```

### 数据库初始化

如果使用外部数据库，设置 `DATABASE_URL` 后运行：

```bash
pnpm db:push
```

`drizzle-kit` 会根据连接串自动选择方言：

- `mysql://` / `mariadb://` / `tidb://` 使用 MySQL Schema 和现有迁移目录
- `postgres://` / `postgresql://` 使用 PostgreSQL Schema，并在 `drizzle/postgres/` 下生成迁移
- `file:` / `sqlite:` 使用 SQLite Schema，并在 `drizzle/sqlite/` 下生成迁移

如果你使用默认本地 SQLite：

- 首次启动会自动创建 `.data/skillforge.sqlite`
- 会自动创建 `users`、`skill_generations`、`generation_steps` 三张表
- 对新增的轻量字段会在启动时自动补列，例如 `llmApiUrl`、`llmApiKey`、`llmModel`、`llmMaxTokens`

也就是说，默认 SQLite 模式下不需要额外执行 `pnpm db:push` 就能直接跑起来。

### 启动开发服务器

```bash
pnpm dev
```

访问 `http://localhost:3000` 即可使用。

### 构建生产版本

```bash
pnpm build
node dist/index.js
```

---

## LLM 配置

本应用使用 OpenAI-compatible API 格式调用 LLM。你可以使用任何支持 `/v1/chat/completions` 端点的提供商：

| 提供商      | API URL                                        | 说明              |
| ----------- | ---------------------------------------------- | ----------------- |
| OpenAI      | `https://api.openai.com/v1/chat/completions`   | 推荐使用 GPT-4o   |
| DeepSeek    | `https://api.deepseek.com/v1/chat/completions` | 性价比高          |
| Together AI | `https://api.together.xyz/v1/chat/completions` | 支持多种开源模型  |
| 自建        | `http://localhost:11434/v1/chat/completions`   | Ollama 等本地部署 |

在 `.env` 中设置 `BUILT_IN_FORGE_API_URL`、`BUILT_IN_FORGE_API_KEY`、`BUILT_IN_FORGE_MODEL` 和 `BUILT_IN_FORGE_MAX_TOKENS` 即可。

`BUILT_IN_FORGE_API_URL` 支持两种写法：

- Base URL：`https://api.deepseek.com`
- 完整 endpoint：`https://api.deepseek.com/v1/chat/completions`

推荐同时设置模型和 token 上限，例如：

```env
BUILT_IN_FORGE_API_URL=https://api.deepseek.com
BUILT_IN_FORGE_API_KEY=your-key
BUILT_IN_FORGE_MODEL=deepseek-chat
BUILT_IN_FORGE_MAX_TOKENS=4096
```

注意：

- 某些提供商不接受额外的私有推理字段，因此当前实现只发送通用 OpenAI-compatible 参数
- `BUILT_IN_FORGE_MAX_TOKENS` 必须落在提供商允许的范围内；如果不确定，先用 `4096`
- 如果设置 `USE_OPENAI_OAUTH=true`，请求会直接走 OpenAI OAuth 通道，不再使用 `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY`；模型默认是 `gpt-5.4`，也可以用 `BUILT_IN_FORGE_MODEL` 覆盖
- `.openai-credentials.json` 属于本地 OAuth 凭证，不能提交到 GitHub
- 修改 `.env` 后需要重启 `pnpm dev`

首页表单还提供当前任务的模型设置：

- 可覆盖默认的 `BUILT_IN_FORGE_MODEL` / `BUILT_IN_FORGE_MAX_TOKENS`
- 当服务端未配置 `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` 时，可直接使用前端设置页里的 `API URL` / `API Key`
- 服务端 `.env` 一旦配置了默认值，服务端配置优先

注意：前端填写的 `API Key` 会保存在当前浏览器本地，并随任务一起保存到服务端生成记录中，以支持后台 7 步流程和后续 resume；但接口不会把该字段返回给前端页面。

---

## 项目结构

```
webapp/
├── client/               # 前端 React 应用
│   ├── src/
│   │   ├── pages/        # 页面组件（Home, Generate, History）
│   │   ├── components/   # 可复用组件（shadcn/ui）
│   │   └── lib/          # tRPC 客户端
│   └── index.html
├── server/               # 后端 Express + tRPC
│   ├── skillEngine.ts    # 7 步 LLM 生成引擎
│   ├── prompts.json      # 7 步提示词配置
│   ├── routers.ts        # tRPC API 路由
│   ├── db.ts             # 数据库查询
│   └── _core/            # 框架层（认证、LLM、上下文）
├── drizzle/              # 数据库 Schema 和迁移
└── shared/               # 前后端共享类型
```

---

## 核心功能

| 功能     | 说明                                         |
| -------- | -------------------------------------------- |
| 一键生成 | 输入 Skill 名称和描述，自动执行 7 步生成流程 |
| 实时进度 | 每个步骤的执行状态实时展示                   |
| 结果预览 | 生成完成后预览 SKILL.md 和配套文件           |
| ZIP 下载 | 一键打包下载完整 Skill 目录                  |
| 历史记录 | 查看和管理所有生成记录                       |
| 任务控制 | 支持取消运行中的任务、删除历史记录           |

---

## 认证说明

本应用现在默认支持两种模式：

1. 本地免登录模式
2. Manus OAuth 模式

如果 `JWT_SECRET`、`VITE_APP_ID`、`OAUTH_SERVER_URL`、`VITE_OAUTH_PORTAL_URL` 保持为空或示例占位值，服务会只在开发环境回退到本地免登录模式，并注入一个本地用户用于开发。

只有在这 4 个值都配置为真实值时，才会启用 Manus OAuth。生产环境缺失这些值会直接拒绝启动，避免匿名管理员模式被带到线上。

推荐 Manus OAuth 配置：

```env
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
```

## 可选 Analytics

如果你要接入 Umami，可额外配置：

```env
VITE_ANALYTICS_ENDPOINT=https://your-umami.example.com
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

未配置时不会注入 analytics 脚本，也不会产生占位符 URL 报错。

---

## 许可证

本项目采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 许可证，禁止商业用途。
