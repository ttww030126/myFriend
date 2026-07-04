<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import {
  modelApi,
  type ModelConfigItem,
  type ModelConfigPayload,
  type ModelType,
  type Provider,
} from '@/api/models'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfModal from '@/components/ui/MfModal.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import {
  CAPABILITY_OPTIONS,
  CAP_LABEL,
  PROVIDER_DEFAULT_BASE_URL,
  PROVIDER_LINKS,
  PROVIDER_OPTIONS,
  TYPE_GUIDE,
  TYPE_LABEL,
  TYPE_OPTIONS,
} from './modelConfig/constants'

const ui = useUiStore()
const items = ref<ModelConfigItem[]>([])
const loading = ref(true)
const showForm = ref(false)
const showGuide = ref(false)
const testing = ref<string | null>(null)
// 正在编辑的配置 id；为 null 表示"新增"模式
const editingId = ref<string | null>(null)

const types = TYPE_OPTIONS
const providers = PROVIDER_OPTIONS

const form = reactive<ModelConfigPayload>({
  type: 'chat',
  provider: 'openai',
  name: '',
  model_name: '',
  api_key: '',
  base_url: '',
  capability: [],
  is_default: false,
})

// 切换供应商时自动带出默认 base_url（仅当当前为空或仍是上一个默认值时覆盖，避免冲掉手填内容）
watch(
  () => form.provider,
  (next, prev) => {
    // 编辑模式下供应商不可改，也不自动覆盖已有 base_url
    if (editingId.value) return
    const prevDefault = prev ? PROVIDER_DEFAULT_BASE_URL[prev] : ''
    if (!form.base_url || form.base_url === prevDefault) {
      form.base_url = PROVIDER_DEFAULT_BASE_URL[next] || ''
    }
  },
)

async function load() {
  loading.value = true
  try {
    items.value = (await modelApi.list()).data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
    // 一个模型都没有时，默认把配置指南展开
    if (!items.value.length) showGuide.value = true
  }
}

function openNew() {
  editingId.value = null
  Object.assign(form, {
    type: 'chat',
    provider: 'openai',
    name: '',
    model_name: '',
    api_key: '',
    base_url: PROVIDER_DEFAULT_BASE_URL.openai,
    capability: [],
    is_default: false,
  })
  showForm.value = true
}

// 编辑已有配置：把当前值回填进表单。api_key 是掩码值，留空表示不改。
function openEdit(it: ModelConfigItem) {
  editingId.value = it.id
  Object.assign(form, {
    type: it.type,
    provider: it.provider,
    name: it.name,
    model_name: it.model_name,
    api_key: '',
    base_url: it.base_url,
    capability: [...(it.capability || [])],
    is_default: it.is_default,
  })
  showForm.value = true
}

function toggleCap(v: string) {
  const i = form.capability.indexOf(v)
  if (i >= 0) form.capability.splice(i, 1)
  else form.capability.push(v)
}

async function submit() {
  if (!form.name.trim() || !form.model_name.trim()) return ui.error('请填写名称与模型标识')
  try {
    if (editingId.value) {
      // 后端 ModelConfigUpdate 只接受这几项；type/provider 不可改，is_default 用「设为默认」单独接口
      const payload: Partial<ModelConfigPayload> = {
        name: form.name,
        model_name: form.model_name,
        base_url: form.base_url,
        capability: [...form.capability],
      }
      // 只有填了新 Key 才提交，留空则保留原 Key
      if (form.api_key.trim()) payload.api_key = form.api_key
      await modelApi.update(editingId.value, payload)
      ui.success('模型已更新')
    } else {
      await modelApi.create({ ...form })
      ui.success('模型已添加')
    }
    showForm.value = false
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function test(it: ModelConfigItem) {
  testing.value = it.id
  try {
    const { data } = await modelApi.test(it.id)
    data.success ? ui.success(data.message || '连接正常') : ui.error(data.message || '连接失败')
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    testing.value = null
  }
}

async function setDefault(it: ModelConfigItem) {
  try {
    await modelApi.setDefault(it.id)
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function remove(it: ModelConfigItem) {
  try {
    await modelApi.remove(it.id)
    items.value = items.value.filter((x) => x.id !== it.id)
  } catch (e) {
    ui.error((e as Error).message)
  }
}

const typeLabel = (t: ModelType) => TYPE_LABEL[t] || t
const providerLabel = (p: Provider) => PROVIDER_OPTIONS.find((x) => x.value === p)?.label || p

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <PageHeader eyebrow="设置" title="模型配置" desc="接入你自己的大模型 API，MyFriend 的大脑由你挑选">
      <template #actions>
        <button class="mf-btn-ghost" @click="showGuide = !showGuide">
          <MfIcon name="book" :size="16" /> 配置说明
        </button>
        <button class="mf-btn-primary" @click="openNew"><MfIcon name="plus" :size="18" /> 添加模型</button>
      </template>
    </PageHeader>

    <!-- 配置指南：去哪申请 Key / 各模型类型怎么配 -->
    <section v-if="showGuide" class="mf-card mb-6 space-y-6 p-6">
      <div>
        <p class="mf-eyebrow mb-2 text-sage">先读我 · 怎么配</p>
        <p class="text-sm leading-relaxed text-ink-soft">
          MyFriend 不内置任何模型，需要你自己填入大模型供应商的 API Key（密钥加密存储，仅你可见）。新手推荐先去
          <b class="text-ink">智谱 AI</b> 注册（送额度、模型类型最全），至少配置
          <b class="text-ink">对话</b> 和 <b class="text-ink">向量</b> 两类即可开聊。
        </p>
      </div>

      <div>
        <p class="mf-eyebrow mb-3">各模型类型有什么用</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="g in TYPE_GUIDE" :key="g.name" class="rounded-2xl border border-line/70 p-4">
            <div class="mb-1.5 flex items-center gap-2">
              <span class="font-display font-bold text-ink">{{ g.name }}</span>
              <span class="mf-pill" :class="g.tag === '必配' ? 'bg-coral-soft text-coral-deep' : 'bg-ink/5 text-ink-soft'">{{ g.tag }}</span>
            </div>
            <p class="text-xs leading-relaxed text-ink-soft">{{ g.desc }}</p>
            <p class="mt-2 text-xs text-sage">推荐：{{ g.provider }}</p>
          </div>
        </div>
      </div>

      <div>
        <p class="mf-eyebrow mb-3">各供应商申请入口</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <a
            v-for="p in PROVIDER_LINKS"
            :key="p.label"
            :href="p.url"
            target="_blank"
            rel="noreferrer"
            class="group rounded-2xl border border-line/70 p-4 transition hover:border-coral/40 hover:bg-coral-soft/30"
          >
            <div class="flex items-center gap-1.5 font-medium text-ink">
              <MfIcon name="research" :size="14" class="text-coral" /> {{ p.label }}
            </div>
            <p class="mt-1 text-xs leading-relaxed text-ink-soft">{{ p.desc }}</p>
          </a>
        </div>
        <p class="mt-3 text-xs text-ink-faint">提示：以上为第三方平台地址，注册与计费以各平台为准；密钥请勿泄露给他人。</p>
      </div>
    </section>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="mf-skeleton h-20" />
    </div>

    <MfEmpty v-else-if="!items.length" icon="🧠" title="还没有配置模型" hint="添加一个对话模型，就能开始和 MyFriend 聊天了">
      <button class="mf-btn-soft mt-4" @click="openNew">添加模型</button>
    </MfEmpty>

    <div v-else class="space-y-3">
      <div v-for="it in items" :key="it.id" class="mf-card flex flex-wrap items-center gap-4 p-5">
        <span class="mf-pill bg-lilac-soft text-lilac">{{ typeLabel(it.type) }}</span>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-ink">
            {{ it.name }}
            <span v-if="it.is_default" class="mf-pill ml-1 bg-sage-soft text-sage">默认</span>
          </p>
          <p class="truncate font-mono text-xs text-ink-faint">{{ providerLabel(it.provider) }} · {{ it.model_name }}</p>
          <div v-if="it.capability?.length" class="mt-1.5 flex flex-wrap gap-1.5">
            <span v-for="c in it.capability" :key="c" class="mf-pill bg-sage-soft text-sage">{{ CAP_LABEL[c] || c }}</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="mf-btn-sm mf-btn-ghost" :disabled="testing === it.id" @click="test(it)">
            {{ testing === it.id ? '测试中…' : '测试' }}
          </button>
          <button v-if="!it.is_default" class="mf-btn-sm mf-btn-ghost" @click="setDefault(it)">设为默认</button>
          <button class="mf-btn-sm mf-btn-ghost" @click="openEdit(it)">编辑</button>
          <button class="text-ink-faint transition hover:text-coral" @click="remove(it)"><MfIcon name="trash" :size="16" /></button>
        </div>
      </div>
    </div>

    <MfModal :open="showForm" :title="editingId ? '编辑模型' : '添加模型'" @close="showForm = false">
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">类型</label>
            <select v-model="form.type" class="mf-input" :disabled="!!editingId">
              <option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">供应商</label>
            <select v-model="form.provider" class="mf-input" :disabled="!!editingId">
              <option v-for="p in providers" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </div>
        </div>
        <p v-if="editingId" class="-mt-2 text-xs text-ink-faint">类型与供应商不可修改，如需更换请删除后重新添加。</p>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">显示名称</label>
          <input v-model="form.name" class="mf-input" placeholder="比如：我的 GPT-4o" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">模型标识</label>
          <input v-model="form.model_name" class="mf-input" placeholder="gpt-4o / qwen-max / glm-4 …" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">API Key</label>
          <input v-model="form.api_key" type="password" class="mf-input" :placeholder="editingId ? '留空则不修改，仅在需要换 Key 时填写' : 'sk-…'" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">Base URL（切换供应商自动带出，可改）</label>
          <input v-model="form.base_url" class="mf-input" placeholder="https://api.openai.com/v1" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">能力（可多选）</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in CAPABILITY_OPTIONS"
              :key="c.value"
              type="button"
              class="mf-pill cursor-pointer transition"
              :class="form.capability.includes(c.value) ? 'bg-coral-soft text-coral-deep' : 'bg-ink/5 text-ink-soft'"
              @click="toggleCap(c.value)"
            >
              {{ c.label }}
            </button>
          </div>
        </div>
        <label v-if="!editingId" class="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input v-model="form.is_default" type="checkbox" class="accent-coral" /> 设为该类型默认模型
        </label>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showForm = false">取消</button>
        <button class="mf-btn-primary" @click="submit">{{ editingId ? '保存' : '添加' }}</button>
      </template>
    </MfModal>
  </div>
</template>
