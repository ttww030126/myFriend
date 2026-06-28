# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

## 项目概览

MyFriend（知己）是一个多用户的「个人 AI 知识库 + 记忆助手」应用。它会记住关于用户的点滴、把用户资料织成知识网、在对话中调用知识库/记忆/联网等工具回答问题，同时支持深度研究、定时任务、情绪音乐推荐、多 Agent 群聊等功能。

- **前端**：Vue 3 + Pinia + TypeScript + Tailwind CSS（由 React + Ant Design 完全重写而来）
- **后端**：FastAPI + PostgreSQL + Elasticsearch + Neo4j + Redis + Celery
- **接口契约**与原后端保持兼容

## 常用命令

### 前端（`web/`）

```bash
cd web
npm install                  # 安装依赖
cp .env.example .env         # 默认配置即可用于本地开发
npm run dev                  # 启动开发服务器 http://localhost:5173
npm run build                # 生产构建 → web/dist
npm run preview              # 本地预览构建产物
npm run type-check           # TypeScript 类型检查（vue-tsc --noEmit）
```

Vite 开发服务器将 `/api`、`/openapi.json`、`/docs` 代理到 `http://localhost:8000`。

### 后端（`api/`）

**前置条件**：需先启动 PostgreSQL、Elasticsearch、Neo4j、Redis 四个存储服务。可用根目录 `docker-compose.yml` 一键启动，或分别用 Docker 运行。

```bash
cd api
uv sync                                           # 安装依赖（自动创建 .venv）
cp .env.example .env                              # 至少填写 JWT_SECRET 和 FERNET_KEY
uv run alembic upgrade head                       # 执行数据库迁移
uv run python run.py                              # 启动 API http://localhost:8000
uv run ruff check .                               # 代码检查
```

**Celery Worker**（另开终端）：

```bash
# 全队列（Linux/macOS）：
uv run celery -A app.celery_app.celery_app worker -l info -Q default,parse,memory,beat,research --concurrency=10
# Windows（必须用 solo 池）：
uv run celery -A app.celery_app.celery_app worker -l info -Q default,parse,memory,beat,research --pool=solo

# Beat 定时调度器：
uv run celery -A app.celery_app.celery_app beat -l info
```

**生成 FERNET_KEY**（一次性，生成后不可更改）：

```bash
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Docker Compose（全栈部署）

```bash
# 开发环境：
docker compose up -d

# 生产环境（在基础 compose 上叠加）：
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 数据库迁移

修改 `api/app/models/` 下的 ORM 模型后：

```bash
uv run alembic revision --autogenerate -m "说明"   # 生成迁移脚本
uv run alembic upgrade head                          # 应用迁移
```

新增 model 需在 `api/app/models/__init__.py` 中注册导入，否则 autogenerate 检测不到。后端启动时会通过 lifespan 自动执行 `alembic upgrade head`。

## 架构

### 后端分层（严格单向）

```
Controller（路由、入参校验、包装响应）
  → Service（业务逻辑、编排）
    → Repository（纯数据访问，不写业务规则）
      → Model / DB（SQLAlchemy ORM、Neo4j Cypher、ES 查询）
```

- **Controllers**（`api/app/controllers/`）：每个模块一个 controller 文件，所有路由通过 `router.py` 挂载在 `/api` 前缀下。禁止在此层写业务逻辑。
- **Services**（`api/app/services/`）：业务逻辑与编排层。
- **Repositories**（`api/app/repositories/`）：纯数据访问。Neo4j 查询放在 `repositories/neo4j/` 下。
- **Core**（`api/app/core/`）：横切基础设施，按子系统分目录。
- **Schemas**（`api/app/schemas/`）：Pydantic 请求/响应模型。
- **Models**（`api/app/models/`）：SQLAlchemy ORM 模型，全部映射到 PostgreSQL。

统一响应格式：`{ code: 0, message: "...", data: {...} }`。业务失败抛 `BizError`，错误提示用中文。所有业务查询强制带 `user_id` 过滤，防止越权。鉴权走 JWT（`Depends(get_current_user)`）。

### 四大存储服务

| 服务               | 用途                                      | 端口                     |
| ------------------ | ----------------------------------------- | ------------------------ |
| PostgreSQL 16      | 关系数据（用户、配置、对话、文档等）      | 5432                     |
| Elasticsearch 8.17 | IK 中文分词全文检索 + 稠密向量检索（RAG） | 9200                     |
| Neo4j 5            | 记忆知识图谱（实体、关系、社区、洞察）    | 7687 (bolt)、7474 (http) |
| Redis 7            | 缓存 + Celery broker 与结果后端           | 6379                     |

### 核心子系统

- **`core/llm/`**：LLM 客户端工厂。所有供应商走 OpenAI 兼容协议。`resolver.py` 按用户默认配置从加密的 API Key 构建客户端。chat/embedding/rerank/multimodal/ASR/websearch 几种模型类型均由用户在前端配置，不写在 `.env`。
- **`core/rag/`**：文档知识库管道 — 解析（PDF/Word/MD/TXT/HTML）、tiktoken 分块（父子块）、写入 ES（IK 分词 + 向量）、混合检索（BM25 + 向量融合 + 可选 rerank + 父块上下文）、AI 自动分类打标签、图片多模态描述。
- **`core/memory/`**：记忆萃取管道 — 文本拆分原子陈述 → 三元组抽取（实体-关系-实体）→ 向量化 → 去重 → 写入 Neo4j 图谱。支持 LPA 标签传播社区聚类、记忆巩固（短期 → 长期提升）、反思引擎（归纳高层洞察）。
- **`core/agent/`**：智能问答 Agent。强模型走原生 function calling；弱模型降级为 ReAct 提示词模拟。工具包括：知识库检索、记忆召回、联网搜索、日期时间、定时任务。通过 `langchain-mcp-adapters` 支持 MCP Server。群聊支持多 Agent SSE 流式输出。
- **`core/emotion/`**：逐条消息情绪分析（valence-arousal 维度，13 类情绪）。滑动窗口聚合为当前情绪画像。低于阈值的弱情绪丢弃不入库。
- **`core/music/`**：情绪化音乐推荐，按情绪距离 + 偏好歌手打分排序。集成咪咕搜索 API 获取免费播放直链。
- **`core/storage/`**：文件存储抽象，支持本地存储和阿里云 OSS 两种后端。
- **`core/research/`**：深度研究引擎 — 规划 → 多查询搜索 + 网页抓取 → 逐源提炼 → 反思 + 补搜 → 分章节写作 → 最终报告合成。可用时集成 MCP 工具增强检索。

### API Key 管理机制

LLM 的 API Key **绝不**存储在 `.env` 中。用户在前端（设置 → 模型配置）自行添加，后端用 **Fernet 对称加密**后存入 `model_configs.api_key_encrypted`。`.env` 里只放 `JWT_SECRET`（登录签名）和 `FERNET_KEY`（加密密钥）两个系统密钥。重新生成 `FERNET_KEY` 会使之前加密的所有 Key 无法解密，务必妥善保管。

### Celery 任务队列

| 队列       | 用途                                                                                   |
| ---------- | -------------------------------------------------------------------------------------- |
| `parse`    | 文档解析、图片处理、歌曲处理                                                           |
| `memory`   | 记忆三元组萃取、情绪分析                                                               |
| `beat`     | 定时任务（每日回顾 22:00、全量聚类 03:00、记忆巩固 04:00、反思 04:30）+ Agent 任务心跳 |
| `research` | 深度研究重活执行（与 beat 分离，避免堵住调度心跳）                                     |
| `default`  | 通用任务                                                                               |

Windows 下 Celery Worker 必须加 `--pool=solo`。

### 前端结构

```
web/src/
├── api/           # 按模块封装的接口层（axios，框架无关 TS）
├── stores/        # Pinia 状态：auth.ts（登录态）、ui.ts（侧栏/提示）、music.ts（全局播放器）
├── router/        # Vue Router + 登录守卫（无 access_token 跳 /login）
├── pages/         # 页面组件（懒加载），每个路由对应一个页面
├── components/    # 共享 UI 组件 + 全局音乐播放器
├── layouts/       # MainLayout 主布局（侧栏导航）
├── composables/   # Vue 组合式函数
└── style.css      # 设计系统令牌 + 组件样式类
```

- **设计系统**：暖纸白底 `#FBF8F4`、梅墨字色 `#2A2438`、珊瑚橘渐变 `#FF6B5E→#FFB088`、鼠尾草绿（记忆）`#2FB59C`、紫丁香（知识）`#8B7FF0`。字体：标题 Bricolage Grotesque、正文 Plus Jakarta Sans、数据 Space Mono。
- **代码分割**：ECharts 单独拆包（仅记忆图谱页使用）。`@` 别名映射到 `src/`。
