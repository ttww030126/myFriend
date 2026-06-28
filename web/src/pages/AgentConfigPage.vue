<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { agentConfigApi, type AgentConfig } from '@/api/agentConfig'
import { personaApi, type Persona, type PersonaPayload } from '@/api/personas'
import {
  personaGroupApi,
  type BuiltinGroup,
  type PersonaGroup,
  type PersonaGroupPayload,
} from '@/api/personaGroups'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfModal from '@/components/ui/MfModal.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfSpinner from '@/components/ui/MfSpinner.vue'
import MfIcon from '@/components/ui/MfIcon.vue'

const router = useRouter()
const ui = useUiStore()

const loading = ref(true)
const tab = ref<'single' | 'group'>('single')

// ── 全局开关 ──
const cfg = reactive({
  show_avatar: true,
  enable_active_recall: true,
  enable_cross_session: false,
  human_mode: false,
})
const switches = [
  { key: 'show_avatar', label: '显示对话头像', hint: '对话界面显示角色头像与你的头像' },
  { key: 'enable_active_recall', label: '主动记忆', hint: '每轮自动检索相关记忆，让回答更懂你' },
  { key: 'enable_cross_session', label: '跨会话上下文', hint: '参考最近其他会话的内容，跨会话接着聊' },
  { key: 'human_mode', label: '真人对话模式', hint: '像真人微信聊天：口语、简短、分多条气泡' },
] as const

// ── 角色 ──
const personas = ref<Persona[]>([])
const activatingId = ref<string | null>(null)

// ── 卡组 ──
const groups = ref<PersonaGroup[]>([])
const builtins = ref<BuiltinGroup[]>([])
const busyKey = ref<string | null>(null)
const builtinOpen = ref(false)

const addedNames = computed(() => new Set(groups.value.map((g) => g.name)))

async function load() {
  loading.value = true
  try {
    const [pResp, cResp] = await Promise.all([personaApi.list(), agentConfigApi.get()])
    personas.value = pResp.data
    cfg.show_avatar = cResp.data.show_avatar
    cfg.enable_active_recall = cResp.data.enable_active_recall
    cfg.enable_cross_session = cResp.data.enable_cross_session
    cfg.human_mode = cResp.data.human_mode
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
  loadGroups()
}

function loadGroups() {
  personaGroupApi.list().then((r) => (groups.value = r.data)).catch(() => {})
  personaGroupApi.listBuiltins().then((r) => (builtins.value = r.data)).catch(() => {})
}

onMounted(load)

async function toggleCfg(key: (typeof switches)[number]['key']) {
  const next = !cfg[key]
  cfg[key] = next
  try {
    await agentConfigApi.update({ [key]: next } as Partial<AgentConfig>)
  } catch (e) {
    cfg[key] = !next
    ui.error((e as Error).message)
  }
}

async function onActivate(p: Persona) {
  activatingId.value = p.id
  try {
    await personaApi.activate(p.id)
    personas.value = personas.value.map((x) => ({ ...x, is_active: x.id === p.id }))
    ui.success(`已切换到「${p.name}」`)
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    activatingId.value = null
  }
}

async function onDeletePersona(p: Persona) {
  if (!confirm(`删除角色「${p.name}」？`)) return
  try {
    await personaApi.remove(p.id)
    ui.success('已删除')
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

// ── 角色编辑弹窗 ──
const personaModal = ref(false)
const editingPersona = ref<Persona | null>(null)
const personaForm = reactive<PersonaPayload>({ name: '', system_prompt: '', temperature: 0.7 })

function openPersonaCreate() {
  editingPersona.value = null
  personaForm.name = ''
  personaForm.system_prompt = ''
  personaForm.temperature = 0.7
  personaModal.value = true
}
function openPersonaEdit(p: Persona) {
  editingPersona.value = p
  personaForm.name = p.name
  personaForm.system_prompt = p.system_prompt
  personaForm.temperature = p.temperature
  personaModal.value = true
}
async function savePersona() {
  if (!personaForm.name.trim()) return ui.error('请填写角色名')
  try {
    if (editingPersona.value) {
      await personaApi.update(editingPersona.value.id, { ...personaForm })
    } else {
      await personaApi.create({ ...personaForm })
    }
    ui.success('已保存')
    personaModal.value = false
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

// ── 卡组操作 ──
async function onAddBuiltin(b: BuiltinGroup) {
  busyKey.value = b.key
  try {
    await personaGroupApi.addBuiltin(b.key)
    ui.success(`已添加「${b.name}」`)
    loadGroups()
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    busyKey.value = null
  }
}

async function onOpenGroupChat(g: PersonaGroup) {
  busyKey.value = g.id
  try {
    await personaGroupApi.openChat(g.id)
    ui.success('已开启群聊')
    router.push({ name: 'group-chat' })
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    busyKey.value = null
  }
}

async function onDeleteGroup(g: PersonaGroup) {
  if (!confirm(`删除卡组「${g.name}」？组内角色仍保留。`)) return
  try {
    await personaGroupApi.remove(g.id)
    ui.success('已删除')
    loadGroups()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

// ── 卡组编辑弹窗 ──
const groupModal = ref(false)
const editingGroup = ref<PersonaGroup | null>(null)
const groupForm = reactive<PersonaGroupPayload>({
  name: '',
  description: '',
  icon: '🗂',
  member_persona_ids: [],
  enable_tools: false,
})

function openGroupCreate() {
  editingGroup.value = null
  groupForm.name = ''
  groupForm.description = ''
  groupForm.icon = '🗂'
  groupForm.member_persona_ids = []
  groupForm.enable_tools = false
  groupModal.value = true
}
function openGroupEdit(g: PersonaGroup) {
  editingGroup.value = g
  groupForm.name = g.name
  groupForm.description = g.description
  groupForm.icon = g.icon || '🗂'
  groupForm.member_persona_ids = [...g.member_persona_ids]
  groupForm.enable_tools = g.enable_tools
  groupModal.value = true
}
function toggleMember(id: string) {
  const idx = groupForm.member_persona_ids.indexOf(id)
  if (idx >= 0) groupForm.member_persona_ids.splice(idx, 1)
  else groupForm.member_persona_ids.push(id)
}
async function saveGroup() {
  if (!groupForm.name.trim()) return ui.error('请填写卡组名')
  if (groupForm.member_persona_ids.length === 0) return ui.error('至少选择一个角色')
  try {
    if (editingGroup.value) {
      await personaGroupApi.update(editingGroup.value.id, { ...groupForm })
    } else {
      await personaGroupApi.create({ ...groupForm })
    }
    ui.success('已保存')
    groupModal.value = false
    loadGroups()
  } catch (e) {
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-8 py-10">
    <PageHeader eyebrow="设置" title="我的角色" desc="单个角色化身你想聊的人，卡组把多个角色打包成一键群聊的场景" />

    <!-- 全局开关 -->
    <div class="mf-card mb-6 grid gap-3 p-5 sm:grid-cols-2">
      <div
        v-for="s in switches"
        :key="s.key"
        class="flex items-center justify-between gap-3 rounded-xl bg-bg px-4 py-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold text-ink">{{ s.label }}</p>
          <p class="truncate text-xs text-ink-faint">{{ s.hint }}</p>
        </div>
        <button
          class="relative h-6 w-11 shrink-0 rounded-full transition"
          :class="cfg[s.key] ? 'bg-coral' : 'bg-ink/15'"
          @click="toggleCfg(s.key)"
        >
          <span
            class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
            :class="cfg[s.key] ? 'left-[22px]' : 'left-0.5'"
          />
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mb-6 inline-flex rounded-xl bg-ink/5 p-1">
      <button
        class="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
        :class="tab === 'single' ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'"
        @click="tab = 'single'"
      >
        单个角色
      </button>
      <button
        class="rounded-lg px-4 py-1.5 text-sm font-semibold transition"
        :class="tab === 'group' ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'"
        @click="tab = 'group'"
      >
        角色卡组
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-16"><MfSpinner /></div>

    <!-- 单个角色 -->
    <div v-else-if="tab === 'single'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        class="mf-card mf-card-hover flex min-h-[150px] flex-col items-center justify-center gap-2 border-dashed text-ink-soft"
        @click="openPersonaCreate"
      >
        <MfIcon name="plus" :size="24" />
        <span class="text-sm font-medium">新建角色</span>
      </button>
      <div
        v-for="p in personas"
        :key="p.id"
        class="mf-card mf-card-hover flex flex-col p-5"
        :class="p.is_active ? 'ring-2 ring-coral' : ''"
      >
        <div class="mb-3 flex items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-coral to-apricot text-lg font-bold text-white">
            <img v-if="p.avatar_url" :src="p.avatar_url" class="h-full w-full object-cover" alt="" />
            <span v-else>{{ p.name.charAt(0) }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-display font-bold text-ink">{{ p.name }}</p>
            <span v-if="p.is_active" class="mf-pill bg-coral-soft text-coral-deep">当前角色</span>
          </div>
        </div>
        <p class="mb-4 line-clamp-3 flex-1 text-sm text-ink-soft">
          {{ p.system_prompt || '这个角色还没有设定' }}
        </p>
        <div class="flex items-center gap-2">
          <button
            v-if="!p.is_active"
            class="mf-btn-soft mf-btn-sm flex-1"
            :disabled="activatingId === p.id"
            @click="onActivate(p)"
          >
            {{ activatingId === p.id ? '切换中…' : '切到这个' }}
          </button>
          <button class="mf-btn-outline mf-btn-sm" @click="openPersonaEdit(p)">编辑</button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-coral-soft hover:text-coral-deep"
            @click="onDeletePersona(p)"
          >
            <MfIcon name="trash" :size="15" />
          </button>
        </div>
      </div>
    </div>

    <!-- 角色卡组 -->
    <div v-else>
      <!-- 内置场景（折叠） -->
      <div v-if="builtins.length" class="mb-6">
        <button
          class="flex w-full items-center justify-between rounded-xl bg-bg px-4 py-3 text-left"
          @click="builtinOpen = !builtinOpen"
        >
          <span class="font-display font-bold text-ink">
            🎭 内置场景
            <span class="ml-2 text-xs font-normal text-ink-faint">一键添加成你的卡组，共 {{ builtins.length }} 个</span>
          </span>
          <span class="text-ink-faint transition" :class="builtinOpen ? 'rotate-180' : ''">▾</span>
        </button>
        <div v-if="builtinOpen" class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="b in builtins" :key="b.key" class="mf-card flex flex-col p-4">
            <div class="mb-2 text-2xl">{{ b.icon }}</div>
            <p class="font-display font-bold text-ink">{{ b.name }}</p>
            <p class="mb-3 mt-0.5 line-clamp-2 text-xs text-ink-soft">{{ b.description }}</p>
            <div class="mb-3 flex flex-wrap gap-1">
              <span v-for="m in b.members" :key="m.name" class="mf-pill bg-lilac-soft text-lilac">{{ m.name }}</span>
            </div>
            <button class="mf-btn-outline mf-btn-sm mt-auto" :disabled="busyKey === b.key" @click="onAddBuiltin(b)">
              <MfIcon name="plus" :size="14" />
              {{ busyKey === b.key ? '添加中…' : addedNames.has(b.name) ? '再加一个' : '添加到我的卡组' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 我的卡组 -->
      <h3 class="mb-3 font-display font-bold text-ink">🗂 我的卡组 <span class="ml-2 text-xs font-normal text-ink-faint">把几个角色打包成场景，一键开群聊</span></h3>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          class="mf-card mf-card-hover flex min-h-[150px] flex-col items-center justify-center gap-2 border-dashed text-ink-soft"
          @click="openGroupCreate"
        >
          <MfIcon name="plus" :size="24" />
          <span class="text-sm font-medium">新建卡组</span>
        </button>
        <div v-for="g in groups" :key="g.id" class="mf-card flex flex-col p-5">
          <div class="mb-2 flex items-center justify-between">
            <p class="font-display font-bold text-ink">{{ g.icon }} {{ g.name }}</p>
            <span class="text-xs text-ink-faint">{{ g.members.length }} 位成员</span>
          </div>
          <p class="mb-3 line-clamp-2 flex-1 text-sm text-ink-soft">{{ g.description || '这个卡组还没有描述' }}</p>
          <div class="mb-3 flex flex-wrap gap-1">
            <span v-for="m in g.members" :key="m.id" class="mf-pill bg-coral-soft text-coral-deep">{{ m.name }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button class="mf-btn-soft mf-btn-sm flex-1" :disabled="busyKey === g.id" @click="onOpenGroupChat(g)">
              <MfIcon name="chat" :size="14" /> {{ busyKey === g.id ? '开启中…' : '开始群聊' }}
            </button>
            <button class="mf-btn-outline mf-btn-sm" @click="openGroupEdit(g)">编辑</button>
            <button
              class="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-coral-soft hover:text-coral-deep"
              @click="onDeleteGroup(g)"
            >
              <MfIcon name="trash" :size="15" />
            </button>
          </div>
        </div>
      </div>
      <MfEmpty v-if="groups.length === 0 && builtins.length === 0" icon="🎭" title="还没有卡组" hint="新建一个，把几个角色打包成群聊场景" />
    </div>

    <!-- 角色编辑弹窗 -->
    <MfModal :open="personaModal" :title="editingPersona ? '编辑角色' : '新建角色'" @close="personaModal = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-soft">角色名</label>
          <input v-model="personaForm.name" class="mf-input" placeholder="例如：温柔的朋友 / 苏格拉底" maxlength="64" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-soft">人设（System Prompt）</label>
          <textarea v-model="personaForm.system_prompt" class="mf-input" rows="6" placeholder="描述这个角色的性格、说话风格、背景…" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-soft">
            温度 · {{ personaForm.temperature?.toFixed(1) }}
          </label>
          <input v-model.number="personaForm.temperature" type="range" min="0" max="1.5" step="0.1" class="w-full accent-coral" />
        </div>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="personaModal = false">取消</button>
        <button class="mf-btn-primary" @click="savePersona">保存</button>
      </template>
    </MfModal>

    <!-- 卡组编辑弹窗 -->
    <MfModal :open="groupModal" :title="editingGroup ? '编辑卡组' : '新建卡组'" width="34rem" @close="groupModal = false">
      <div class="space-y-4">
        <div class="flex gap-3">
          <div class="w-20">
            <label class="mb-1.5 block text-sm font-medium text-ink-soft">图标</label>
            <input v-model="groupForm.icon" class="mf-input text-center text-xl" maxlength="2" />
          </div>
          <div class="flex-1">
            <label class="mb-1.5 block text-sm font-medium text-ink-soft">卡组名</label>
            <input v-model="groupForm.name" class="mf-input" placeholder="例如：人生导师团" maxlength="64" />
          </div>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-soft">描述（可选）</label>
          <input v-model="groupForm.description" class="mf-input" placeholder="这个卡组适合聊什么？" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-soft">选择成员（{{ groupForm.member_persona_ids.length }}）</label>
          <div class="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2">
            <label
              v-for="p in personas"
              :key="p.id"
              class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-bg"
            >
              <input
                type="checkbox"
                class="h-4 w-4 accent-coral"
                :checked="groupForm.member_persona_ids.includes(p.id)"
                @change="toggleMember(p.id)"
              />
              <span class="text-sm text-ink">{{ p.name }}</span>
            </label>
            <p v-if="personas.length === 0" class="px-2 py-3 text-center text-sm text-ink-faint">还没有角色，先去新建角色</p>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm text-ink-soft">
          <input v-model="groupForm.enable_tools" type="checkbox" class="h-4 w-4 accent-coral" /> 群聊开启工具（知识库 / 记忆 / 联网）
        </label>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="groupModal = false">取消</button>
        <button class="mf-btn-primary" @click="saveGroup">保存</button>
      </template>
    </MfModal>
  </div>
</template>
