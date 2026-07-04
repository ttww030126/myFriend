<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  mcpApi,
  type McpAuthType,
  type McpServerItem,
  type McpTransport,
} from '@/api/mcp'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfModal from '@/components/ui/MfModal.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

const ui = useUiStore()
const items = ref<McpServerItem[]>([])
const loading = ref(true)
const showForm = ref(false)
const busy = ref<string | null>(null) // 正在 test/sync 的 server id
const editingId = ref<string | null>(null)

const TRANSPORTS: { value: McpTransport; label: string }[] = [
  { value: 'streamable_http', label: 'Streamable HTTP' },
  { value: 'sse', label: 'SSE' },
]
const AUTH_TYPES: { value: McpAuthType; label: string }[] = [
  { value: 'none', label: '无认证' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key（自定义 Header）' },
]

// 表单：认证密钥单独存，提交时按 auth_type 组装 auth_config
const form = reactive({
  name: '',
  transport: 'streamable_http' as McpTransport,
  url: '',
  auth_type: 'none' as McpAuthType,
  token: '', // bearer
  authHeader: 'X-Api-Key', // api_key
  authKey: '', // api_key
})

function resetForm() {
  Object.assign(form, {
    name: '',
    transport: 'streamable_http',
    url: '',
    auth_type: 'none',
    token: '',
    authHeader: 'X-Api-Key',
    authKey: '',
  })
}

async function load() {
  loading.value = true
  try {
    items.value = (await mcpApi.list()).data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

function openNew() {
  editingId.value = null
  resetForm()
  showForm.value = true
}

function openEdit(it: McpServerItem) {
  editingId.value = it.id
  resetForm()
  Object.assign(form, {
    name: it.name,
    transport: it.transport,
    url: it.url,
    auth_type: it.auth_type,
    // 密钥是掩码，留空表示不修改
    authHeader: 'X-Api-Key',
  })
  showForm.value = true
}

// 按 auth_type 组装 auth_config；编辑时密钥留空则返回 undefined（表示不改认证）
function buildAuthConfig(): Record<string, string> | null | undefined {
  if (form.auth_type === 'none') return null
  if (form.auth_type === 'bearer') {
    if (form.token.trim()) return { token: form.token.trim() }
    return editingId.value ? undefined : null
  }
  // api_key
  if (form.authKey.trim()) {
    return { header: form.authHeader.trim() || 'X-Api-Key', key: form.authKey.trim() }
  }
  return editingId.value ? undefined : null
}

async function submit() {
  if (!form.name.trim() || !form.url.trim()) return ui.error('请填写名称与服务地址 URL')
  if (!editingId.value && form.auth_type === 'bearer' && !form.token.trim()) {
    return ui.error('Bearer 认证请填写 Token')
  }
  if (!editingId.value && form.auth_type === 'api_key' && !form.authKey.trim()) {
    return ui.error('API Key 认证请填写 Key')
  }
  const auth_config = buildAuthConfig()
  try {
    if (editingId.value) {
      const payload: Record<string, unknown> = {
        name: form.name,
        transport: form.transport,
        url: form.url,
        auth_type: form.auth_type,
      }
      if (auth_config !== undefined) payload.auth_config = auth_config
      await mcpApi.update(editingId.value, payload)
      ui.success('已保存')
    } else {
      await mcpApi.create({
        name: form.name,
        transport: form.transport,
        url: form.url,
        auth_type: form.auth_type,
        auth_config,
        enabled: true,
      })
      ui.success('已添加，可点「同步」拉取工具列表')
    }
    showForm.value = false
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function test(it: McpServerItem) {
  busy.value = it.id
  try {
    const { data } = await mcpApi.test(it.id)
    if (data.success) {
      ui.success(`连接正常，发现 ${data.tools.length} 个工具`)
    } else {
      ui.error(data.message || '连接失败')
    }
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    busy.value = null
  }
}

async function sync(it: McpServerItem) {
  busy.value = it.id
  try {
    await mcpApi.sync(it.id)
    ui.success('已同步工具列表')
    load()
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    busy.value = null
  }
}

async function toggle(it: McpServerItem) {
  const next = !it.enabled
  try {
    await mcpApi.toggle(it.id, next)
    it.enabled = next
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function remove(it: McpServerItem) {
  try {
    await mcpApi.remove(it.id)
    items.value = items.value.filter((x) => x.id !== it.id)
  } catch (e) {
    ui.error((e as Error).message)
  }
}

function statusMeta(s: string) {
  if (s === 'ok') return { label: '正常', cls: 'bg-sage-soft text-sage' }
  if (s === 'error') return { label: '异常', cls: 'bg-coral-soft text-coral-deep' }
  return { label: '待同步', cls: 'bg-ink/5 text-ink-soft' }
}
const transportLabel = (t: string) => TRANSPORTS.find((x) => x.value === t)?.label || t

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <PageHeader eyebrow="设置" title="MCP 服务" desc="接入外部 MCP 服务器，把它们提供的工具接进 MyFriend 的大脑">
      <template #actions>
        <button class="mf-btn-primary" @click="openNew"><MfIcon name="plus" :size="18" /> 添加服务</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="mf-skeleton h-24" />
    </div>

    <MfEmpty
      v-else-if="!items.length"
      icon="🔌"
      title="还没有接入 MCP 服务"
      hint="MCP（Model Context Protocol）让你把外部工具服务器接进来，添加后点「同步」即可拉取可用工具"
    >
      <button class="mf-btn-soft mt-4" @click="openNew">添加服务</button>
    </MfEmpty>

    <div v-else class="space-y-3">
      <div v-for="it in items" :key="it.id" class="mf-card p-5">
        <div class="flex flex-wrap items-center gap-3">
          <span class="mf-pill bg-lilac-soft text-lilac">{{ transportLabel(it.transport) }}</span>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-ink">
              {{ it.name }}
              <span class="mf-pill ml-1" :class="statusMeta(it.status).cls">{{ statusMeta(it.status).label }}</span>
            </p>
            <p class="truncate font-mono text-xs text-ink-faint">{{ it.url }}</p>
          </div>
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
            <input type="checkbox" :checked="it.enabled" class="accent-coral" @change="toggle(it)" /> 启用
          </label>
        </div>

        <p v-if="it.last_error" class="mt-2 rounded-lg bg-coral-soft px-3 py-1.5 text-xs text-coral-deep">
          {{ it.last_error }}
        </p>

        <div v-if="it.tools_cache?.length" class="mt-2.5 flex flex-wrap gap-1.5">
          <span v-for="t in it.tools_cache" :key="t.name" class="mf-pill bg-sage-soft text-sage" :title="t.description">
            {{ t.name }}
          </span>
        </div>
        <p v-else class="mt-2.5 text-xs text-ink-faint">尚未同步到工具，点「同步」拉取。</p>

        <div class="mt-3 flex gap-2">
          <button class="mf-btn-sm mf-btn-ghost" :disabled="busy === it.id" @click="test(it)">
            {{ busy === it.id ? '处理中…' : '测试' }}
          </button>
          <button class="mf-btn-sm mf-btn-ghost" :disabled="busy === it.id" @click="sync(it)">同步工具</button>
          <button class="mf-btn-sm mf-btn-ghost" @click="openEdit(it)">编辑</button>
          <button class="ml-auto text-ink-faint transition hover:text-coral" @click="remove(it)">
            <MfIcon name="trash" :size="16" />
          </button>
        </div>
      </div>
    </div>

    <MfModal :open="showForm" :title="editingId ? '编辑 MCP 服务' : '添加 MCP 服务'" width="34rem" @close="showForm = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">名称</label>
          <input v-model="form.name" class="mf-input" placeholder="比如：我的检索服务器" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">传输方式</label>
            <select v-model="form.transport" class="mf-input">
              <option v-for="t in TRANSPORTS" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">认证方式</label>
            <select v-model="form.auth_type" class="mf-input">
              <option v-for="a in AUTH_TYPES" :key="a.value" :value="a.value">{{ a.label }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">服务地址 URL</label>
          <input v-model="form.url" class="mf-input font-mono" placeholder="https://example.com/mcp" />
        </div>

        <div v-if="form.auth_type === 'bearer'">
          <label class="mb-1.5 block text-sm font-medium text-ink">Bearer Token</label>
          <input
            v-model="form.token"
            type="password"
            class="mf-input"
            :placeholder="editingId ? '留空则不修改' : 'Token'"
          />
        </div>

        <template v-if="form.auth_type === 'api_key'">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">Header 名</label>
            <input v-model="form.authHeader" class="mf-input font-mono" placeholder="X-Api-Key" />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">Key</label>
            <input
              v-model="form.authKey"
              type="password"
              class="mf-input"
              :placeholder="editingId ? '留空则不修改' : 'Key'"
            />
          </div>
        </template>

        <p class="text-xs text-ink-faint">
          添加后请点列表里的「同步」拉取该服务提供的工具；被 Agent 使用需保持「启用」。
        </p>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showForm = false">取消</button>
        <button class="mf-btn-primary" @click="submit">{{ editingId ? '保存' : '添加' }}</button>
      </template>
    </MfModal>
  </div>
</template>
