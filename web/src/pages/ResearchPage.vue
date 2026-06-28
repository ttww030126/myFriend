<script setup lang="ts">
import { onMounted, ref } from 'vue'
import client, { type Wrapped } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

interface ResearchTask {
  id: string
  topic: string
  status: 'running' | 'done' | 'failed'
  summary: string | null
  created_at: string
}

const ui = useUiStore()
const topic = ref('')
const tasks = ref<ResearchTask[]>([])
const loading = ref(true)
const submitting = ref(false)

const statusMap: Record<string, { label: string; cls: string }> = {
  running: { label: '研究中', cls: 'bg-apricot/20 text-apricot' },
  done: { label: '已完成', cls: 'bg-sage-soft text-sage' },
  failed: { label: '失败', cls: 'bg-coral-soft text-coral-deep' },
}

async function load() {
  loading.value = true
  try {
    const res = await client.get<unknown, Wrapped<ResearchTask[]>>('/research/tasks')
    tasks.value = res.data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function start() {
  if (!topic.value.trim()) return
  submitting.value = true
  try {
    await client.post('/research/tasks', { topic: topic.value.trim() })
    ui.success('已交给 MyFriend，去深入研究了')
    topic.value = ''
    load()
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl px-8 py-10">
    <PageHeader eyebrow="陪你" title="深度研究" desc="给一个题目，MyFriend 会多轮检索、交叉求证，最后给你一份有出处的报告" />

    <div class="mf-card mb-8 p-6">
      <label class="mb-2 block text-sm font-medium text-ink">想研究什么？</label>
      <textarea
        v-model="topic"
        rows="3"
        class="mf-input mb-4"
        placeholder="比如：对比几款主流向量数据库的取舍，并给出选型建议"
      />
      <button class="mf-btn-primary" :disabled="submitting" @click="start">
        <MfIcon name="research" :size="18" /> {{ submitting ? '正在启动…' : '开始研究' }}
      </button>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="mf-skeleton h-24" />
    </div>

    <MfEmpty v-else-if="!tasks.length" icon="🔬" title="还没有研究任务" hint="在上面写下一个题目，开启你的第一次深度研究" />

    <div v-else class="space-y-3">
      <div v-for="t in tasks" :key="t.id" class="mf-card p-5">
        <div class="mb-2 flex items-start justify-between gap-3">
          <p class="font-display font-bold text-ink">{{ t.topic }}</p>
          <span class="mf-pill shrink-0" :class="(statusMap[t.status] || statusMap.running).cls">
            {{ (statusMap[t.status] || statusMap.running).label }}
          </span>
        </div>
        <p v-if="t.summary" class="line-clamp-3 text-sm text-ink-soft">{{ t.summary }}</p>
        <p class="mt-2 font-mono text-xs text-ink-faint">{{ new Date(t.created_at).toLocaleString('zh-CN') }}</p>
      </div>
    </div>
  </div>
</template>
