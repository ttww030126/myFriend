<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentApi, type DocumentItem } from '@/api/documents'
import { knowledgeBaseApi, type KnowledgeBase } from '@/api/knowledgeBases'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const kbId = route.params.kbId as string

const kb = ref<KnowledgeBase | null>(null)
const docs = ref<DocumentItem[]>([])
const loading = ref(true)
const fileInput = ref<HTMLInputElement | null>(null)
const showUrl = ref(false)
const url = ref('')

const statusMap: Record<string, { label: string; cls: string }> = {
  done: { label: '已就绪', cls: 'bg-sage-soft text-sage' },
  parsing: { label: '解析中', cls: 'bg-apricot/20 text-apricot' },
  pending: { label: '排队中', cls: 'bg-ink/5 text-ink-soft' },
  failed: { label: '失败', cls: 'bg-coral-soft text-coral-deep' },
}

async function load() {
  loading.value = true
  try {
    kb.value = (await knowledgeBaseApi.detail(kbId)).data
    docs.value = (await documentApi.list(1, 100, undefined, kbId)).data.items
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function onFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files?.length) return
  for (const f of Array.from(files)) {
    try {
      await documentApi.upload(f, kbId)
      ui.success(`已上传 ${f.name}`)
    } catch (err) {
      ui.error((err as Error).message)
    }
  }
  load()
}

async function importUrl() {
  if (!url.value.trim()) return
  try {
    await documentApi.importUrl(url.value.trim(), kbId)
    ui.success('已开始抓取网页')
    showUrl.value = false
    url.value = ''
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function remove(d: DocumentItem) {
  try {
    await documentApi.remove(d.id)
    docs.value = docs.value.filter((x) => x.id !== d.id)
  } catch (e) {
    ui.error((e as Error).message)
  }
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <button class="mb-4 flex items-center gap-1 text-sm text-ink-soft transition hover:text-coral" @click="router.push('/knowledge')">
      ← 返回知识库
    </button>

    <PageHeader eyebrow="你的知识" :title="kb?.name || '知识库'" :desc="kb?.description || '管理这个库里的文档'">
      <template #actions>
        <button class="mf-btn-ghost" @click="showUrl = true">导入网页</button>
        <button class="mf-btn-primary" @click="fileInput?.click()"><MfIcon name="upload" :size="18" /> 上传文档</button>
        <input ref="fileInput" type="file" multiple class="hidden" @change="onFiles" />
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="mf-skeleton h-16" />
    </div>

    <MfEmpty v-else-if="!docs.length" icon="📄" title="还没有文档" hint="上传 PDF、Word、Markdown，或导入一个网页链接">
      <button class="mf-btn-soft mt-4" @click="fileInput?.click()">上传第一个文档</button>
    </MfEmpty>

    <div v-else class="mf-card divide-y divide-line/70 overflow-hidden p-0">
      <div v-for="d in docs" :key="d.id" class="group flex items-center gap-4 px-5 py-3.5">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lilac-soft text-lilac">
          <MfIcon name="book" :size="18" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-ink">{{ d.file_name }}</p>
          <p class="font-mono text-xs text-ink-faint">{{ fmtSize(d.file_size) }} · {{ d.chunk_num }} 片段</p>
        </div>
        <span class="mf-pill" :class="(statusMap[d.status] || statusMap.pending).cls">
          {{ (statusMap[d.status] || statusMap.pending).label }}
        </span>
        <button v-if="d.status === 'failed'" class="mf-btn-sm mf-btn-ghost" @click="documentApi.retry(d.id).then(load)">重试</button>
        <button class="text-ink-faint opacity-0 transition hover:text-coral group-hover:opacity-100" @click="remove(d)">
          <MfIcon name="trash" :size="16" />
        </button>
      </div>
    </div>

    <MfModal :open="showUrl" title="导入网页" @close="showUrl = false">
      <input v-model="url" class="mf-input" placeholder="https://…" @keyup.enter="importUrl" />
      <template #footer>
        <button class="mf-btn-ghost" @click="showUrl = false">取消</button>
        <button class="mf-btn-primary" @click="importUrl">抓取</button>
      </template>
    </MfModal>
  </div>
</template>
