# myfriend 数据库表结构说明

> 本文档由后端 ORM 模型（`api/app/models/`，SQLAlchemy）自动梳理生成。

> 主存储为 **PostgreSQL**，共 **35 张表**（含 2 张多对多关联表）。

> 此外系统还使用 **Neo4j**（记忆知识图谱：实体/关系/社区/洞察）与 **Elasticsearch**（文档/图片向量 chunk 检索）做非关系型存储，二者不在本表清单内。


## 目录

- **用户与认证**：`users`
- **对话与消息**：`conversations`、`messages`、`message_feedbacks`、`conversation_shares`
- **多人实时群聊**：`group_members`
- **Agent 人格与技能**：`agent_configs`、`agent_personas`、`persona_groups`、`skills`
- **记忆与情绪**：`memories`、`memory_corrections`、`emotion_records`、`emotion_profiles`
- **知识库与资料**：`knowledge_bases`、`documents`、`images`、`tags`、`document_tags`、`image_tags`、`favorites`
- **深度研究与定时任务**：`research_reports`、`report_shares`、`agent_tasks`、`daily_reviews`
- **Agent 可观测（Tracing / Verifier Loop）**：`agent_traces`、`agent_spans`、`loop_runs`、`loop_iterations`
- **音乐**：`songs`、`play_histories`
- **模型 / 工具 / 集成配置**：`model_configs`、`mcp_servers`、`tool_configs`、`notify_channels`

---


## 用户与认证


### 1. `users` — 用户账号


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `username` | String(64) | 唯一、索引、可空 |  |
| `nickname` | String(64) | 可空 |  |
| `email` | String(255) | 唯一、索引、可空 |  |
| `avatar` | String(512) | 可空 |  |
| `password_hash` | String(255) | 可空 |  |
| `briefing_seen_at` | DateTime | 可空 | Agent 简报「未读红点」基准：进任务/简报页时更新；判定 created_at > 此值的定时报告为未读 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


## 对话与消息


### 2. `conversations` — 对话会话


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `title` | String(256) | 可空、默认 '新对话' |  |
| `is_group` | Boolean | 索引、可空、默认 False | 是否群聊会话（多角色卡）。普通单聊为 false。 |
| `member_persona_ids` | JSONB | 可空 | 群成员角色卡 id 列表（仅 is_group=true 时有意义）。 |
| `enable_tools` | Boolean | 可空、默认 False | 群聊是否允许成员调用工具（知识库/记忆/联网/MCP），全群统一，默认关。 |
| `join_code` | String(16) | 索引、可空 | 多人实时群聊邀请码（仅 is_group=true 有意义）：他人凭此码加入群聊。 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 3. `messages` — 对话消息


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `conversation_id` | UUID | FK→conversations.id、索引、可空 |  |
| `role` | String(16) | 可空 | user \| assistant \| system |
| `content` | Text | 可空 |  |
| `sender_persona_id` | UUID | 可空 | 群聊中该消息由哪个角色卡发出（user 消息为空；单聊 assistant 也为空）。 |
| `sender_user_id` | UUID | 可空 | 多人实时群聊中该 user 消息由哪个真人发出（单人会话/AI 消息为空）。 |
| `meta_data` | JSONB | 可空 | 附加信息：引用 citations / 工具调用 tool_calls / token usage / 图片等 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |


### 4. `message_feedbacks` — 消息赞/踩反馈


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `message_id` | UUID | FK→messages.id、索引、可空 |  |
| `conversation_id` | UUID | FK→conversations.id、索引、可空 |  |
| `rating` | String(8) | 可空 | up \| down |
| `comment` | Text | 可空 | 可选文字反馈 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 5. `conversation_shares` — 对话分享快照


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `conversation_id` | UUID | 索引、可空 | 来源会话（会话被删不影响分享快照，故仅记录不设级联约束的强依赖） |
| `share_token` | String(64) | 唯一、索引、可空 | 公开访问令牌：随机不可猜，唯一 |
| `title` | String(256) | 可空、默认 '对话分享' | 分享标题（取会话标题快照） |
| `snapshot` | JSONB | 可空 | 消息快照：[{role, content, images?}]，脱敏（不含工具/引用/记忆等内部细节） |
| `user_avatar` | Text | 可空 | 头像快照（data URL，公开页无需鉴权直接显示）：用户头像 / AI 角色头像 |
| `ai_avatar` | Text | 可空 |  |
| `ai_name` | String(64) | 可空 |  |
| `is_active` | Boolean | 索引、可空、默认 True | 是否有效（取消即置 false，保留痕迹） |
| `expire_at` | DateTime | 可空 | 过期时间（可空=永久） |
| `view_count` | Integer | 可空、默认 0 | 浏览次数 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


## 多人实时群聊


### 6. `group_members` — 群聊真人成员


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `conversation_id` | UUID | FK→conversations.id、索引、可空 |  |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `role` | String(16) | 可空、默认 GROUP_ROLE_MEMBER | owner（建群者）\| member（凭码加入） |
| `nickname` | String(64) | 可空 | 群内显示昵称（默认取用户邮箱前缀，可与全局用户名不同） |
| `joined_at` | DateTime | 可空、默认 now() |  |


## Agent 人格与技能


### 7. `agent_configs` — Agent 全局配置


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、唯一、索引、可空 | 所属用户 |
| `system_prompt` | Text | 可空、默认 '' | 自定义系统提示词（人设/风格），问答时作为 system message 注入 |
| `temperature` | Float | 可空、默认 0.7 |  |
| `enable_knowledge` | Boolean | 可空、默认 True | 工具默认开关（联网搜索默认关，知识库/记忆默认开） |
| `enable_memory` | Boolean | 可空、默认 True |  |
| `enable_web_search` | Boolean | 可空、默认 False |  |
| `enable_active_recall` | Boolean | 可空、默认 True | 主动记忆：每轮提问自动召回相关记忆 + 洞察注入上下文（默认开） |
| `enable_cross_session` | Boolean | 可空、默认 False | 跨会话上下文：注入最近其他会话的摘要，让跨会话也能接着聊（默认关） |
| `show_avatar` | Boolean | 可空、默认 False | 对话界面是否显示头像（开 → AI 人格头像 + 用户头像；关 → 两边都不显示） |
| `human_mode` | Boolean | 可空、默认 False | 真人对话模式（全局）：开启后单聊/群聊都像真人微信聊天（口语短句、可多气泡），关闭恢复助手风格 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 8. `agent_personas` — 对话人格（角色卡）


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `name` | String(64) | 可空 | 组名（如「周杰伦」「严谨助理」） |
| `avatar_key` | String(512) | 可空 | 头像文件 key（存储 key，非 URL）；为空则该人格不显示 AI 头像 |
| `system_prompt` | Text | 可空、默认 '' | 人格提示词（人设/语气/口头禅），对话时作为 system message 注入 |
| `temperature` | Float | 可空、默认 0.7 |  |
| `is_active` | Boolean | 索引、可空、默认 False | 是否当前生效（每用户最多一条 true，service 层保证互斥） |
| `in_group_only` | Boolean | 可空、默认 False | 仅作为角色卡组成员存在（如内置场景拉入的角色），不在「单个角色」列表单独展示 |
| `sort` | Integer | 可空、默认 0 | 列表排序（预留） |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 9. `persona_groups` — 角色卡组（场景）


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `name` | String(64) | 可空 | 组名（如「A股投研天团」） |
| `description` | Text | 可空、默认 '' | 组描述（一句话说明这组角色干嘛的） |
| `icon` | String(16) | 可空、默认 '' | 组图标（emoji 或简单标识） |
| `member_persona_ids` | JSONB | 可空 | 成员角色 id 列表（引用 agent_personas，保序），删卡组不删成员 |
| `enable_tools` | Boolean | 可空、默认 False | 开群聊时是否默认开启工具（联网/知识库/记忆/MCP） |
| `is_builtin` | Boolean | 可空、默认 False | 是否由内置场景模板复制而来（标记用途，用户仍可改删） |
| `sort` | Integer | 可空、默认 0 | 列表排序 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 10. `skills` — 技能（任务能力包）


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `name` | String(64) | 可空 | 技能名（如「论文精读」「代码审查」） |
| `description` | String(256) | 可空、默认 '' | 简介（一句话说明用途） |
| `icon` | String(16) | 可空、默认 '🧩' | 图标（emoji） |
| `prompt` | Text | 可空、默认 '' | 专属任务提示词，对话时与角色卡 system_prompt 叠加注入 |
| `tool_keys` | JSONB | 可空 | 工具白名单：内置工具 key 列表。非空=只用这些；空列表=不限定（用全局工具配置） |
| `kb_id` | UUID | FK→knowledge_bases.id、索引、可空 | 可选绑定知识库（删库则置空），绑了优先用此库做检索范围 |
| `config` | JSONB | 可空 | 轻量配置：{ quick_prompts: [str], few_shots: [{input, output}] } |
| `enabled` | Boolean | 可空、默认 True | 是否在对话页技能选择器中显示（关闭则不占用对话框入口，避免技能多时拥挤） |
| `is_builtin` | Boolean | 可空、默认 False | 是否由内置模板复制而来（标记用途，用户仍可改删） |
| `sort` | Integer | 可空、默认 0 | 列表排序 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


## 记忆与情绪


### 11. `memories` — 记忆原文与溯源


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `raw_text` | Text | 可空 | 原始陈述/来源文本 |
| `source` | String(16) | 可空、默认 MEMORY_SOURCE_MANUAL |  |
| `source_message_id` | UUID | 可空 | 来源对话消息（对话萃取时填，阶段5 接入） |
| `status` | String(16) | 索引、可空、默认 MEMORY_STATUS_PENDING |  |
| `error_msg` | Text | 可空 |  |
| `graph_dialogue_id` | String(64) | 可空 | 图谱溯源：本次萃取在 Neo4j 写入的 dialogue / 实体 id 等 |
| `graph_stats` | JSONB | 可空 |  |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 12. `memory_corrections` — 记忆人工纠错记录

用户对记忆实体的人工纠错记录。


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `entity_id` | String(128) | 索引、可空 | 被操作的实体(Neo4j entity.id,String 不是 FK 因为跨库) |
| `action` | String(16) | 索引、可空 | 动作:confirm / correct / delete |
| `before` | JSONB | 可空 | 操作前的实体快照(name / type / description / aliases),用于回滚 + 给 V0.0.6 LLM 总结改进点 |
| `after` | JSONB | 可空 | 操作后的快照(correct 时非空;confirm/delete 可以为空字典或包含 human_verified=True) |
| `reason` | String(256) | 可空 | 用户填的原因(可选)或系统填的「确认/修正/删除」 |
| `source_dialogue_id` | String(128) | 可空 | 该记忆萃取自哪段对话(便于跳来源 + 用作训练信号) |
| `created_at` | DateTime | 索引、可空、默认 now() | 创建时间 |


### 13. `emotion_records` — 单轮情绪记录

单轮对话的用户情绪记录。


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `conversation_id` | UUID | 可空 |  |
| `message_id` | UUID | 可空 |  |
| `emotion_type` | String(32) | 索引、可空 | 主情绪（受控词表） |
| `intensity` | Float | 可空、默认 0.0 | 强度 0~1 |
| `valence` | Float | 可空、默认 0.0 | 效价 -1~1 |
| `arousal` | Float | 可空、默认 0.0 | 唤醒度 0~1 |
| `keywords` | JSONB | 可空 | 情绪关键词 |
| `trigger` | String(255) | 可空 | 触发事件 |
| `summary` | Text | 可空 | 一句话描述 |
| `created_at` | DateTime | 索引、可空、默认 now() | 创建时间 |


### 14. `emotion_profiles` — 用户情绪画像

用户当前情绪画像（每用户一条，滚动更新）。


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `dominant_emotion` | String(32) | 可空、默认 '平静' |  |
| `avg_valence` | Float | 可空、默认 0.0 |  |
| `avg_arousal` | Float | 可空、默认 0.0 |  |
| `sample_count` | Integer | 可空、默认 0 | 聚合所用样本数 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


## 知识库与资料


### 15. `knowledge_bases` — 知识库分类


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `name` | String(128) | 可空 |  |
| `description` | String(512) | 可空 |  |
| `icon` | String(32) | 可空 | emoji |
| `color` | String(16) | 可空 | 卡片主题色 |
| `is_default` | Boolean | 索引、可空、默认 False |  |
| `chat_enabled` | Boolean | 可空、默认 False | 是否参与对话检索：对话时检索所有 chat_enabled=True 的库。默认库默认开，其余默认关。 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 16. `documents` — 文档元数据


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `kb_id` | UUID | FK→knowledge_bases.id、索引、可空 | 所属知识库（多知识库分类）。删库时整库资料一并删除，故 CASCADE。 |
| `file_name` | String(512) | 可空 |  |
| `file_ext` | String(16) | 可空 |  |
| `file_size` | Integer | 可空、默认 0 |  |
| `file_key` | String(512) | 可空 | 对象存储中的 key |
| `source_type` | String(16) | 可空、默认 'file' | file \| url |
| `source_url` | String(1024) | 可空 |  |
| `status` | String(16) | 索引、可空、默认 DOC_STATUS_PENDING |  |
| `progress` | Float | 可空、默认 0.0 |  |
| `chunk_num` | Integer | 可空、默认 0 |  |
| `error_msg` | Text | 可空 |  |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 17. `images` — 图片元数据


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `kb_id` | UUID | FK→knowledge_bases.id、索引、可空 | 所属知识库（多知识库分类）。删库时整库资料一并删除，故 CASCADE。 |
| `file_name` | String(512) | 可空 |  |
| `file_ext` | String(16) | 可空 |  |
| `file_size` | Integer | 可空、默认 0 |  |
| `file_key` | String(512) | 可空 |  |
| `description` | Text | 可空 | AI 详细描述 |
| `ocr_text` | Text | 可空 | 图中文字 |
| `objects` | JSONB | 可空 | 物体列表 |
| `scene` | String(256) | 可空 | 场景 |
| `status` | String(16) | 索引、可空、默认 IMG_STATUS_PENDING |  |
| `error_msg` | Text | 可空 |  |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 18. `tags` — 标签


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `name` | String(64) | 可空 |  |
| `color` | String(16) | 可空、默认 '#155EEF' | 155EEF") |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |


### 19. `document_tags` — 文档-标签关联

多对多关联表


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `document_id` | UUID | 主键、FK→documents.id、非空 |  |
| `tag_id` | UUID | 主键、FK→tags.id、非空 |  |


### 20. `image_tags` — 图片-标签关联

多对多关联表


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `image_id` | UUID | 主键、FK→images.id、非空 |  |
| `tag_id` | UUID | 主键、FK→tags.id、非空 |  |


### 21. `favorites` — 收藏夹


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `target_type` | String(16) | 可空 | message \| document \| memory |
| `target_id` | String(64) | 可空 | 源对象 id（UUID 或图谱实体 id） |
| `snapshot` | JSONB | 可空 | 收藏时的标题/摘要快照，便于列表展示 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |


## 深度研究与定时任务


### 22. `research_reports` — 深度研究报告


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `topic` | Text | 可空 | 用户原始一句话需求 |
| `title` | String(255) | 可空 | 生成的标题 |
| `status` | String(16) | 索引、可空、默认 RESEARCH_STATUS_PENDING |  |
| `report_md` | Text | 可空 | 最终 Markdown |
| `outline` | JSONB | 可空 | 提纲+查询 |
| `sources` | JSONB | 可空 | 来源列表 |
| `error_msg` | Text | 可空 |  |
| `task_id` | UUID | 可空 | 预留：关联定时任务（②）；本批次为空 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 23. `report_shares` — 研究报告分享快照


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `report_id` | UUID | 索引、可空 | 来源报告（报告被删不影响分享快照，仅记录不设强级联） |
| `share_token` | String(64) | 唯一、索引、可空 | 公开访问令牌：随机不可猜，唯一 |
| `title` | String(256) | 可空、默认 '研究报告' |  |
| `content_md` | Text | 可空、默认 '' | 报告 Markdown 正文快照 |
| `sources` | JSONB | 可空 | 来源列表快照：[{index,type,title,url}] |
| `is_active` | Boolean | 索引、可空、默认 True |  |
| `expire_at` | DateTime | 可空 |  |
| `view_count` | Integer | 可空、默认 0 |  |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 24. `agent_tasks` — 定时/主动研究任务


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `name` | String(128) | 可空 | 任务名 |
| `instruction` | Text | 可空 | 自然语言研究指令/主题 |
| `kb_ids` | JSONB | 可空 | 检索范围，空=默认 |
| `trigger_type` | String(16) | 可空、默认 TRIGGER_DAILY |  |
| `trigger_time` | String(8) | 可空 | "HH:MM" |
| `trigger_weekday` | Integer | 可空 | 0=周一 .. 6=周日（weekly 用） |
| `trigger_interval_hours` | Integer | 可空 | interval 用 |
| `enabled` | Boolean | 索引、可空、默认 True |  |
| `notify_enabled` | Boolean | 可空、默认 True | 本任务跑完是否推送到用户的消息渠道（默认推） |
| `last_run_at` | DateTime | 可空 |  |
| `last_status` | String(16) | 可空、默认 TASK_RUN_NONE |  |
| `next_run_at` | DateTime | 索引、可空 |  |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 25. `daily_reviews` — 每日回顾简报


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `review_date` | Date | 索引、可空 |  |
| `content` | Text | 可空 | 简报正文（Markdown） |
| `care` | Text | 可空 | 前瞻关怀句：基于情绪+记忆+洞察生成的一句主动关心/提醒（⑧），可点击「聊聊」开聊 |
| `stats` | JSONB | 可空 | 统计快照：当日新增对话/记忆/文档数等 |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |


## Agent 可观测（Tracing / Verifier Loop）


### 26. `agent_traces` — Agent 执行 Trace

一次完整的 Agent 任务执行 = 一条 Trace。


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `trace_id` | UUID | 唯一、索引、可空 | 全局 trace_id(展示用,与 id 同源 UUID,便于跨日志/前端定位) |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `task_type` | String(32) | 索引、可空 | 任务类型 + 关联的业务 id(不加 FK 解耦:业务删除时 trace 仍保留作 audit) |
| `task_id` | UUID | 索引、可空 |  |
| `task_name` | String(256) | 可空 | 人话名(如「深度研究:量子计算最新进展」),便于列表页展示 |
| `root_span_id` | UUID | 可空 | 根 span(便于前端时间线从根开始展开) |
| `status` | String(16) | 索引、可空、默认 STATUS_RUNNING | 状态机:running / ok / error |
| `error_message` | Text | 可空 |  |
| `started_at` | datetime | 索引、非空、默认 now() | 时间(duration 在 finish 时回填,便于前端列表排序/聚合) |
| `finished_at` | datetime | None | 可空 |  |
| `duration_ms` | Integer | 可空 |  |
| `total_input_tokens` | Integer | 可空、默认 0 | 成本与 token 聚合(span 落库时累加;cached_tokens 单独算便于查缓存命中率) |
| `total_output_tokens` | Integer | 可空、默认 0 |  |
| `total_cached_tokens` | Integer | 可空、默认 0 |  |
| `total_cost_cny` | Float | 可空、默认 0.0 |  |
| `models_used` | JSONB | 可空 | 模型审计:这次任务用到了哪些模型(JSON 列表,便于跨模型成本对比) |
| `loop_run_id` | UUID | 索引、可空 | 关联 ② Verifier Loop(若该 trace 走了 verify),便于「报告页 → 评分卡 → 查看执行轨迹」下钻 |
| `attributes` | JSONB | 可空 | 扩展属性(放暂未结构化的元数据,如 user_agent / client_ip / debug flag 等) |


### 27. `agent_spans` — Trace 内执行节点 Span

Trace 内的一个执行节点(planner/retriever/writer/tool_call/verifier/repair/llm_call …)。


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `span_id` | UUID | 唯一、索引、可空 | 业务上 span 唯一 id(便于 parent_span_id 引用,与 id 同源 UUID) |
| `parent_span_id` | UUID | 索引、可空 | 父 span(根 span 该字段为 NULL) |
| `trace_id` | UUID | FK→agent_traces.trace_id、索引、可空 | 所属 trace(冗余存便于按 trace 一次查全部 span) |
| `span_type` | String(32) | 索引、可空 | span_type 与 name:类型用于聚合归因,name 用于前端展示 |
| `name` | String(128) | 可空 |  |
| `status` | String(16) | 索引、可空、默认 STATUS_RUNNING | 状态机:running / ok / error |
| `error_message` | Text | 可空 |  |
| `started_at` | datetime | 非空、默认 now() | 时间 |
| `finished_at` | datetime | None | 可空 |  |
| `duration_ms` | Integer | 可空 |  |
| `model_name` | String(128) | 可空 | LLM 调用相关(llm_call span 时填充;其他 span 默认 0/None) |
| `input_tokens` | Integer | 可空、默认 0 |  |
| `output_tokens` | Integer | 可空、默认 0 |  |
| `cached_tokens` | Integer | 可空、默认 0 |  |
| `cost_cny` | Float | 可空、默认 0.0 |  |
| `payload` | JSONB | 可空 | payload:输入/输出摘要(不存全文,存哈希 + 长度 + 关键参数,避免表膨胀) 大文本需要详情时,业务表(research_reports.content_md / messages.content 等)里查 |
| `attributes` | JSONB | 可空 | attributes:OTel GenAI 标准属性 + 业务扩展属性 如 {gen_ai.system: "deepseek", gen_ai.request.model: "deepseek-v3", ...} |
| `iteration_id` | UUID | 索引、可空 | 关联 ② Verifier Loop 的某一轮迭代(verifier/repair span 时填充), 实现「报告页评分卡 → 时间线 → 第 N 轮 verify/repair span」精确定位 |


### 28. `loop_runs` — Verifier Loop 运行

一次完整的 Verifier Loop。


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `task_type` | String(32) | 索引、可空 | 任务类型:research / agent_task / 未来扩展 |
| `task_id` | UUID | 索引、可空 | 关联的业务 id(research_reports.id / agent_tasks.id);不加 FK 以解耦,业务删除不应级联清 loop |
| `status` | String(16) | 索引、可空、默认 STATUS_RUNNING | 状态机:running / passed / failed / exceeded |
| `iterations` | Integer | 可空、默认 0 | 迭代次数(实际跑了几轮 verify;通过/超限/失败都计入) |
| `final_score` | Float | 可空 | 最终加权总分(0~1) |
| `pass_threshold` | Float | 可空、默认 0.7 | 通过阈值与最大迭代数(快照,便于不同 run 间对比策略变化) |
| `max_iterations` | Integer | 可空、默认 2 |  |
| `generator_model` | String(128) | 可空 | 模型审计:generator/verifier 用了什么模型(便于后续对比实验) |
| `verifier_model` | String(128) | 可空 |  |
| `verifier_kind` | String(16) | 可空 | verifier 配置:same(同模型 critic)/ cross(跨 family);A/B 实验时区分 |
| `rubric_name` | String(32) | 可空 | 用的 rubric 名(research / task / 未来扩展) |
| `note` | Text | 可空 | 失败/超限时的简要原因(给前端展示) |
| `started_at` | datetime | 非空、默认 now() |  |
| `finished_at` | datetime | None | 可空 |  |


### 29. `loop_iterations` — Loop 单轮迭代

LoopRun 内的一轮迭代:generate → verify → decide。


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `run_id` | UUID | FK→loop_runs.id、索引、可空 |  |
| `iteration_no` | Integer | 可空 | 轮次序号(1 起) |
| `artifact_snapshot` | JSONB | 可空 | artifact 摘要:不存全文(那会让表膨胀),存哈希 + 长度 + 引用数 + section 数等结构化字段 全文在业务表(research_reports.content_md 等)里查 |
| `scores` | JSONB | 可空 | verifier 评分:{coverage:0.7, faithfulness:0.9, ...} + total |
| `feedback` | JSONB | 可空 | verifier 给的具体问题(供 repair 消费;含 missing_coverage / wrong_citations / weak_chapters 等) |
| `decision` | String(16) | 可空 | 决策:pass / retry_patch / retry_rewrite / exceed |
| `repair_action` | JSONB | 可空 | 本轮选的修复动作详情(retry_* 时非空;含 patch queries / 重写章节列表 等) |
| `duration_ms` | Integer | 可空 | 本轮耗时(毫秒,含 generate + verify;repair 算在下一轮的 generate) |
| `created_at` | datetime | 非空、默认 now() | 创建时间 |


## 音乐


### 30. `songs` — 自建曲库歌曲

自建曲库歌曲。


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `title` | String(255) | 索引、可空 | 歌名 |
| `artist` | String(255) | 可空、默认 '' | 歌手 |
| `album` | String(255) | 可空 | 专辑 |
| `file_key` | String(512) | 可空 | 本地曲库音频文件 key（对象存储）；为空表示仅元数据 / 外链 |
| `source_url` | Text | 可空 | 外链音频 url（咪咕免费歌缓存，可选） |
| `cover_url` | Text | 可空 | 封面 url |
| `lyric` | Text | 可空 | LRC 歌词文本 |
| `valence` | Float | 可空、默认 0.0 | 效价 -1~1 |
| `arousal` | Float | 可空、默认 0.3 | 唤醒度 0~1 |
| `mood_tags` | JSONB | 可空 | 情绪标签 |
| `tag_status` | String(16) | 可空、默认 SONG_TAG_PENDING |  |
| `playable` | Boolean | 可空 | 音源是否可播放：None=待验证，True=可播，False=无可用音源（不推荐、不可点播） |
| `duration` | Integer | 可空 | 时长秒 |
| `created_at` | DateTime | 索引、可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 31. `play_histories` — 播放历史


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `song_id` | UUID | 可空 | 曲库歌曲 id（可能为空：外部推荐曲未入库时） |
| `title` | String(255) | 可空、默认 '' | 快照：歌名/歌手，避免曲库删后历史不可读 |
| `artist` | String(255) | 可空、默认 '' |  |
| `played_at` | DateTime | 索引、可空、默认 now() |  |


## 模型 / 工具 / 集成配置


### 32. `model_configs` — 模型配置


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `type` | String(32) | 索引、可空 | 模型类型：chat（对话）/ multimodal（多模态/图片理解）/ embedding（向量化） |
| `provider` | String(32) | 可空 | 供应商：openai / qwen / doubao / deepseek |
| `name` | String(128) | 可空 | 配置显示名 |
| `model_name` | String(128) | 可空 | 实际模型名，如 gpt-4o |
| `api_key_encrypted` | String(512) | 可空 | Fernet 密文 |
| `base_url` | String(255) | 可空 |  |
| `capability` | JSONB | 可空 | 能力标记，如 ["function_call", "vision"]，阶段5 强弱模型路由用 |
| `is_default` | Boolean | 可空、默认 False |  |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 33. `mcp_servers` — 外部 MCP 服务


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `name` | String(128) | 可空 | 服务显示名（拼工具名前缀用） |
| `transport` | String(32) | 可空、默认 TRANSPORT_STREAMABLE_HTTP |  |
| `url` | String(512) | 可空 |  |
| `auth_type` | String(16) | 可空、默认 AUTH_NONE |  |
| `auth_config` | JSONB | 可空 | 认证敏感信息：{"token": "<Fernet密文>"} 或 {"header": "X-Api-Key", "key": "<密文>"} |
| `enabled` | Boolean | 可空、默认 True |  |
| `status` | String(16) | 可空、默认 STATUS_UNKNOWN |  |
| `last_error` | String(1024) | 可空 |  |
| `tools_cache` | JSONB | 可空 | 同步下来的工具清单：[{"name","description"}] |
| `synced_at` | DateTime | 可空 |  |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 34. `tool_configs` — 内置工具启停配置


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `tool_key` | String(128) | 索引、可空 | 内置工具 key |
| `tool_type` | String(16) | 可空、默认 TOOL_TYPE_BUILTIN |  |
| `enabled` | Boolean | 可空、默认 True |  |
| `config` | JSONB | 可空 | 工具特定配置（预留） |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |


### 35. `notify_channels` — 消息推送渠道


| 字段 | 类型 | 约束 | 含义 |
| --- | --- | --- | --- |
| `id` | UUID | 主键、非空 | 主键 ID |
| `user_id` | UUID | FK→users.id、索引、可空 | 所属用户 |
| `channel_type` | String(16) | 可空 |  |
| `name` | String(64) | 可空、默认 '' | 渠道备注名 |
| `target_encrypted` | Text | 可空 | SendKey / webhook URL：Fernet 加密存储 |
| `enabled` | Boolean | 索引、可空、默认 True |  |
| `created_at` | DateTime | 可空、默认 now() | 创建时间 |
| `updated_at` | DateTime | 可空、默认 now() | 更新时间 |
