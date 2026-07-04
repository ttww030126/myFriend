import client, { type Wrapped } from './client'

// ── 技能（Skill）：提示词 + 工具白名单 + 绑定知识库 的能力包 ──
// 对齐后端 SkillOut（api/app/schemas/skill_schema.py）

export interface Skill {
  id: string
  name: string
  description: string
  icon: string
  prompt: string
  tool_keys: string[]
  kb_id: string | null
  enabled: boolean
  config: Record<string, unknown>
  is_builtin: boolean
}

export const skillApi = {
  list() {
    return client.get<unknown, Wrapped<Skill[]>>('/skills')
  },
}
