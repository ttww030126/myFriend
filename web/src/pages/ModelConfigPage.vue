<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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

const ui = useUiStore()
const items = ref<ModelConfigItem[]>([])
const loading = ref(true)
const showForm = ref(false)
const testing = ref<string | null>(null)

const types: { v: ModelType; label: string }[] = [
  { v: 'chat', label: '对话' },
  { v: 'multimodal', label: '多模态' },
  { v: 'embedding', label: '向量' },
  { v: 'rerank', label: '重排' },
  { v: 'websearch', label: '联网' },
  { v: 'asr', label: '语音' },
]
const providers: Provider[] = ['openai', 'qwen', 'doubao', 'deepseek', 'zhipu', 'qianfan', 'tavily']

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

async function load() {
  loading.value = true
  try {
    items.value = (await modelApi.list()).data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

function openNew() {
  Object.assign(form, {
    type: 'chat',
    provider: 'openai',
    name: '',
    model_name: '',
    api_key: '',
    base_url: '',
    capability: [],
    is_default: false,
  })
  showForm.value = true
}

async function submit() {
  if (!form.name.trim() || !form.model_name.trim()) return ui.error('请填写名称与模型标识')
  try {
    await modelApi.create({ ...form })
    ui.success('模型已添加')
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

const typeLabel = (t: ModelType) => types.find((x) => x.v === t)?.label || t

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <PageHeader eyebrow="设置" title="模型配置" desc="接入你自己的大模型 API，MyFriend 的大脑由你挑选">
      <template #actions>
        <button class="mf-btn-primary" @click="openNew"><MfIcon name="plus" :size="18" /> 添加模型</button>
      </template>
    </PageHeader>

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
          <p class="truncate font-mono text-xs text-ink-faint">{{ it.provider }} · {{ it.model_name }}</p>
        </div>
        <div class="flex gap-2">
          <button class="mf-btn-sm mf-btn-ghost" :disabled="testing === it.id" @click="test(it)">
            {{ testing === it.id ? '测试中…' : '测试' }}
          </button>
          <button v-if="!it.is_default" class="mf-btn-sm mf-btn-ghost" @click="setDefault(it)">设为默认</button>
          <button class="text-ink-faint transition hover:text-coral" @click="remove(it)"><MfIcon name="trash" :size="16" /></button>
        </div>
      </div>
    </div>

    <MfModal :open="showForm" title="添加模型" @close="showForm = false">
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">类型</label>
            <select v-model="form.type" class="mf-input">
              <option v-for="t in types" :key="t.v" :value="t.v">{{ t.label }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">供应商</label>
            <select v-model="form.provider" class="mf-input">
              <option v-for="p in providers" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">显示名称</label>
          <input v-model="form.name" class="mf-input" placeholder="比如：我的 GPT-4o" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">模型标识</label>
          <input v-model="form.model_name" class="mf-input" placeholder="gpt-4o / qwen-max …" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">API Key</label>
          <input v-model="form.api_key" type="password" class="mf-input" placeholder="sk-…" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">Base URL（可选）</label>
          <input v-model="form.base_url" class="mf-input" placeholder="https://api.openai.com/v1" />
        </div>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input v-model="form.is_default" type="checkbox" class="accent-coral" /> 设为该类型默认模型
        </label>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showForm = false">取消</button>
        <button class="mf-btn-primary" @click="submit">添加</button>
      </template>
    </MfModal>
  </div>
</template>
