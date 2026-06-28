<script setup lang="ts">
import { onMounted, ref } from 'vue'
import client, { type Wrapped } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'

interface AgentTask {
  id: string
  name: string
  prompt: string
  schedule: string
  enabled: boolean
  last_run: string | null
  status: string
}

const ui = useUiStore()
const tasks = ref<AgentTask[]>([])
const loading = ref(true)
const showForm = ref(false)
const form = ref({ name: '', prompt: '', schedule: '0 9 * * *' })

async function load() {
  loading.value = true
  try {
    const res = await client.get<unknown, Wrapped<AgentTask[]>>('/agent-tasks')
    tasks.value = res.data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!form.value.name.trim() || !form.value.prompt.trim()) return ui.error('请填写任务名与指令')
  try {
    await client.post('/agent-tasks', form.value)
    ui.success('定时任务已创建')
    showForm.value = false
    form.value = { name: '', prompt: '', schedule: '0 9 * * *' }
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function toggle(t: AgentTask) {
  try {
    await client.put(`/agent-tasks/${t.id}`, { enabled: !t.enabled })
    t.enabled = !t.enabled
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function remove(t: AgentTask) {
  try {
    await client.delete(`/agent-tasks/${t.id}`)
    tasks.value = tasks.value.filter((x) => x.id !== t.id)
  } catch (e) {
    ui.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl px-8 py-10">
    <PageHeader eyebrow="陪你" title="定时任务" desc="让 MyFriend 在固定时间替你跑些活儿——每日简报、定期整理、自动提醒">
      <template #actions>
        <button class="mf-btn-primary" @click="showForm = true"><MfIcon name="plus" :size="18" /> 新建任务</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="mf-skeleton h-20" />
    </div>

    <MfEmpty v-else-if="!tasks.length" icon="⏰" title="还没有定时任务" hint="比如：每天早上 9 点，把昨天聊到的要点整理给我">
      <button class="mf-btn-soft mt-4" @click="showForm = true">创建任务</button>
    </MfEmpty>

    <div v-else class="space-y-3">
      <div v-for="t in tasks" :key="t.id" class="mf-card flex items-center gap-4 p-5">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-apricot/20 text-apricot">
          <MfIcon name="task" :size="20" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-ink">{{ t.name }}</p>
          <p class="truncate text-sm text-ink-soft">{{ t.prompt }}</p>
          <p class="mt-0.5 font-mono text-xs text-ink-faint">cron: {{ t.schedule }}</p>
        </div>
        <label class="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" :checked="t.enabled" class="accent-coral" @change="toggle(t)" /> 启用
        </label>
        <button class="text-ink-faint transition hover:text-coral" @click="remove(t)"><MfIcon name="trash" :size="16" /></button>
      </div>
    </div>

    <MfModal :open="showForm" title="新建定时任务" @close="showForm = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">任务名称</label>
          <input v-model="form.name" class="mf-input" placeholder="每日要点回顾" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">指令</label>
          <textarea v-model="form.prompt" rows="3" class="mf-input" placeholder="告诉 MyFriend 每次该做什么" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">执行频率（cron）</label>
          <input v-model="form.schedule" class="mf-input font-mono" placeholder="0 9 * * *" />
        </div>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showForm = false">取消</button>
        <button class="mf-btn-primary" @click="create">创建</button>
      </template>
    </MfModal>
  </div>
</template>
