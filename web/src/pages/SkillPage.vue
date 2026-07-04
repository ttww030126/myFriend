<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import client, { type Wrapped } from '@/api/client'
import { knowledgeBaseApi, type KnowledgeBase } from '@/api/knowledgeBases'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'

// 对齐后端 SkillOut：注意字段是 icon（不是 emoji），并带 tool_keys / kb_id
interface Skill {
  id: string
  name: string
  icon: string | null
  description: string | null
  prompt: string
  tool_keys: string[]
  kb_id: string | null
  enabled: boolean
  is_builtin: boolean
}

interface ToolLite {
  tool_key: string
  name: string
}

const ui = useUiStore()
const skills = ref<Skill[]>([])
const tools = ref<ToolLite[]>([])
const kbs = ref<KnowledgeBase[]>([])
const loading = ref(true)
const showForm = ref(false)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  icon: '✨',
  description: '',
  prompt: '',
  tool_keys: [] as string[],
  kb_id: '' as string, // '' 表示不绑定
})

function resetForm() {
  Object.assign(form, {
    name: '',
    icon: '✨',
    description: '',
    prompt: '',
    tool_keys: [],
    kb_id: '',
  })
}

async function load() {
  loading.value = true
  try {
    const res = await client.get<unknown, Wrapped<Skill[]>>('/skills')
    skills.value = res.data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

// 拉取可选工具（内置工具）与知识库列表，供表单勾选。失败不阻塞主流程。
async function loadOptions() {
  try {
    const res = await client.get<unknown, Wrapped<ToolLite[]>>('/tools')
    tools.value = res.data
  } catch {
    tools.value = []
  }
  try {
    kbs.value = (await knowledgeBaseApi.list()).data
  } catch {
    kbs.value = []
  }
}

function openNew() {
  editingId.value = null
  resetForm()
  showForm.value = true
}

function openEdit(s: Skill) {
  if (s.is_builtin) return
  editingId.value = s.id
  Object.assign(form, {
    name: s.name,
    icon: s.icon || '✨',
    description: s.description || '',
    prompt: s.prompt,
    tool_keys: [...(s.tool_keys || [])],
    kb_id: s.kb_id || '',
  })
  showForm.value = true
}

function toggleTool(key: string) {
  const i = form.tool_keys.indexOf(key)
  if (i >= 0) form.tool_keys.splice(i, 1)
  else form.tool_keys.push(key)
}

async function submit() {
  if (!form.name.trim() || !form.prompt.trim()) return ui.error('请填写名称与人设提示词')
  const payload = {
    name: form.name,
    icon: form.icon,
    description: form.description,
    prompt: form.prompt,
    tool_keys: [...form.tool_keys],
    kb_id: form.kb_id || null, // 不绑定时传 null
  }
  try {
    if (editingId.value) {
      await client.put(`/skills/${editingId.value}`, payload)
      ui.success('技能已保存')
    } else {
      await client.post('/skills', payload)
      ui.success('技能已创建')
    }
    showForm.value = false
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function remove(s: Skill) {
  if (s.is_builtin) return
  try {
    await client.delete(`/skills/${s.id}`)
    skills.value = skills.value.filter((x) => x.id !== s.id)
  } catch (e) {
    ui.error((e as Error).message)
  }
}

const toolName = (key: string) => tools.value.find((t) => t.tool_key === key)?.name || key
const kbName = (id: string | null) => (id ? kbs.value.find((k) => k.id === id)?.name || '知识库' : '')

onMounted(() => {
  load()
  loadOptions()
})
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <PageHeader eyebrow="设置" title="技能" desc="把「提示词 + 工具 + 知识库」打包成一个技能，对话时按需调用">
      <template #actions>
        <button class="mf-btn-primary" @click="openNew"><MfIcon name="plus" :size="18" /> 新建技能</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="mf-skeleton h-36" />
    </div>

    <MfEmpty v-else-if="!skills.length" icon="🧩" title="还没有技能" hint="创建一个，比如「面试复盘」：配好提示词、勾上联网搜索、挂上对应知识库">
      <button class="mf-btn-soft mt-4" @click="openNew">新建技能</button>
    </MfEmpty>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="s in skills" :key="s.id" class="mf-card mf-card-hover group p-5">
        <div class="mb-3 flex items-start justify-between">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral-soft text-xl">{{ s.icon || '✨' }}</div>
          <div class="flex items-center gap-1">
            <button
              v-if="!s.is_builtin"
              class="text-ink-faint opacity-0 transition hover:text-coral group-hover:opacity-100"
              title="编辑"
              @click="openEdit(s)"
            >
              <MfIcon name="model" :size="16" />
            </button>
            <button
              v-if="!s.is_builtin"
              class="text-ink-faint opacity-0 transition hover:text-coral group-hover:opacity-100"
              title="删除"
              @click="remove(s)"
            >
              <MfIcon name="trash" :size="16" />
            </button>
            <span v-if="s.is_builtin" class="mf-pill bg-ink/5 text-ink-soft">内置</span>
          </div>
        </div>
        <p class="font-display text-lg font-bold text-ink">{{ s.name }}</p>
        <p class="mt-1 line-clamp-2 text-sm text-ink-soft">{{ s.description || s.prompt }}</p>
        <div v-if="s.tool_keys?.length || s.kb_id" class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="k in s.tool_keys" :key="k" class="mf-pill bg-sage-soft text-sage">{{ toolName(k) }}</span>
          <span v-if="s.kb_id" class="mf-pill bg-lilac-soft text-lilac">📚 {{ kbName(s.kb_id) }}</span>
        </div>
      </div>
    </div>

    <MfModal :open="showForm" :title="editingId ? '编辑技能' : '新建技能'" width="34rem" @close="showForm = false">
      <div class="space-y-4">
        <div class="flex gap-3">
          <div class="w-20">
            <label class="mb-1.5 block text-sm font-medium text-ink">图标</label>
            <input v-model="form.icon" class="mf-input text-center" maxlength="2" />
          </div>
          <div class="flex-1">
            <label class="mb-1.5 block text-sm font-medium text-ink">名称</label>
            <input v-model="form.name" class="mf-input" placeholder="面试复盘" />
          </div>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">简介（可选）</label>
          <input v-model="form.description" class="mf-input" placeholder="一句话说明这个技能擅长什么" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">人设 / 任务提示词</label>
          <textarea v-model="form.prompt" rows="4" class="mf-input" placeholder="你是一位资深面试官，帮我复盘每一场面试……" />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">可用工具（可多选）</label>
          <div v-if="tools.length" class="flex flex-wrap gap-2">
            <button
              v-for="t in tools"
              :key="t.tool_key"
              type="button"
              class="mf-pill cursor-pointer transition"
              :class="form.tool_keys.includes(t.tool_key) ? 'bg-coral-soft text-coral-deep' : 'bg-ink/5 text-ink-soft'"
              @click="toggleTool(t.tool_key)"
            >
              {{ t.name }}
            </button>
          </div>
          <p v-else class="text-xs text-ink-faint">未获取到工具列表。</p>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">绑定知识库（可选）</label>
          <select v-model="form.kb_id" class="mf-input">
            <option value="">不绑定</option>
            <option v-for="k in kbs" :key="k.id" :value="k.id">{{ k.name }}</option>
          </select>
        </div>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showForm = false">取消</button>
        <button class="mf-btn-primary" @click="submit">{{ editingId ? '保存' : '创建' }}</button>
      </template>
    </MfModal>
  </div>
</template>
