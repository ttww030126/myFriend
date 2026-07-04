<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import client, { type Wrapped } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'

type TriggerType = 'daily' | 'weekly' | 'interval'

// 与后端 AgentTask.to_dict / AgentTaskUpsertRequest 字段严格对齐
interface AgentTask {
  id: string
  name: string
  instruction: string
  kb_ids: string[]
  trigger_type: TriggerType
  trigger_time: string | null
  trigger_weekday: number | null
  trigger_interval_hours: number | null
  enabled: boolean
  notify_enabled: boolean
  last_run_at: string | null
  last_status: string | null
  next_run_at: string | null
  created_at: string | null
}

interface TaskForm {
  name: string
  instruction: string
  trigger_type: TriggerType
  trigger_time: string
  trigger_weekday: number
  trigger_interval_hours: number
  notify_enabled: boolean
}

const ui = useUiStore()
const tasks = ref<AgentTask[]>([])
const loading = ref(true)
const showForm = ref(false)
const saving = ref(false)

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function emptyForm(): TaskForm {
  return {
    name: '',
    instruction: '',
    trigger_type: 'daily',
    trigger_time: '09:00',
    trigger_weekday: 0,
    trigger_interval_hours: 6,
    notify_enabled: true,
  }
}
const form = ref<TaskForm>(emptyForm())

// 把结构化触发规则转成人话（列表展示用）
function scheduleLabel(t: AgentTask): string {
  if (t.trigger_type === 'interval') {
    return `每 ${t.trigger_interval_hours ?? '-'} 小时执行一次`
  }
  if (t.trigger_type === 'weekly') {
    const wd = t.trigger_weekday ?? 0
    return `每${WEEKDAYS[wd] ?? '周一'} ${t.trigger_time ?? '09:00'} 执行`
  }
  return `每天 ${t.trigger_time ?? '09:00'} 执行`
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('zh-CN', { hour12: false })
}

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

function openCreate() {
  form.value = emptyForm()
  showForm.value = true
}

// 只提交后端 AgentTaskUpsertRequest 认识的字段，按 trigger_type 精简
function buildPayload(f: TaskForm) {
  const payload: Record<string, unknown> = {
    name: f.name.trim(),
    instruction: f.instruction.trim(),
    trigger_type: f.trigger_type,
    enabled: true,
    notify_enabled: f.notify_enabled,
  }
  if (f.trigger_type === 'interval') {
    payload.trigger_interval_hours = f.trigger_interval_hours
  } else {
    payload.trigger_time = f.trigger_time
    if (f.trigger_type === 'weekly') payload.trigger_weekday = f.trigger_weekday
  }
  return payload
}

async function create() {
  if (!form.value.name.trim() || !form.value.instruction.trim()) {
    return ui.error('请填写任务名与指令')
  }
  if (form.value.trigger_type !== 'interval' && !/^\d{1,2}:\d{2}$/.test(form.value.trigger_time)) {
    return ui.error('请填写有效的执行时间（HH:MM）')
  }
  saving.value = true
  try {
    await client.post('/agent-tasks', buildPayload(form.value))
    ui.success('定时任务已创建')
    showForm.value = false
    form.value = emptyForm()
    load()
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

// 启停走专用的 PATCH 端点，只传 enabled（不会触发整体校验）
async function toggle(t: AgentTask) {
  const next = !t.enabled
  try {
    await client.patch(`/agent-tasks/${t.id}/enabled`, { enabled: next })
    t.enabled = next
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function runNow(t: AgentTask) {
  try {
    await client.post(`/agent-tasks/${t.id}/run`)
    ui.success('已触发运行，稍后在深度研究里查看报告')
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

const triggerTypeName = computed(() => ({
  daily: '每天',
  weekly: '每周',
  interval: '按间隔',
}))

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl px-8 py-10">
    <PageHeader eyebrow="陪你" title="定时任务" desc="让 MyFriend 在固定时间替你跑些活儿——每日简报、定期整理、自动提醒">
      <template #actions>
        <button class="mf-btn-primary" @click="openCreate"><MfIcon name="plus" :size="18" /> 新建任务</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="mf-skeleton h-20" />
    </div>

    <MfEmpty v-else-if="!tasks.length" icon="⏰" title="还没有定时任务" hint="比如：每天早上 9 点，把昨天聊到的要点整理给我">
      <button class="mf-btn-soft mt-4" @click="openCreate">创建任务</button>
    </MfEmpty>

    <div v-else class="space-y-3">
      <div v-for="t in tasks" :key="t.id" class="mf-card flex items-center gap-4 p-5">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-apricot/20 text-apricot">
          <MfIcon name="task" :size="20" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-ink">{{ t.name }}</p>
          <p class="truncate text-sm text-ink-soft">{{ t.instruction }}</p>
          <p class="mt-0.5 text-xs text-ink-faint">
            {{ scheduleLabel(t) }} · 下次 {{ fmt(t.next_run_at) }}
            <span v-if="t.last_status"> · 上次 {{ t.last_status }}</span>
          </p>
        </div>
        <button class="mf-btn-ghost text-xs" @click="runNow(t)">立即运行</button>
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
          <textarea v-model="form.instruction" rows="3" class="mf-input" placeholder="告诉 MyFriend 每次该做什么，例如：收集网上大家发表的 agent 面经" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">执行频率</label>
          <div class="flex gap-2">
            <button
              v-for="opt in (['daily', 'weekly', 'interval'] as const)"
              :key="opt"
              type="button"
              class="flex-1 rounded-xl border px-3 py-2 text-sm transition"
              :class="form.trigger_type === opt ? 'border-coral bg-coral-soft text-coral-deep' : 'border-line text-ink-soft'"
              @click="form.trigger_type = opt"
            >
              {{ triggerTypeName[opt] }}
            </button>
          </div>
        </div>

        <div v-if="form.trigger_type === 'weekly'">
          <label class="mb-1.5 block text-sm font-medium text-ink">星期几</label>
          <select v-model.number="form.trigger_weekday" class="mf-input">
            <option v-for="(w, i) in WEEKDAYS" :key="i" :value="i">{{ w }}</option>
          </select>
        </div>

        <div v-if="form.trigger_type === 'interval'">
          <label class="mb-1.5 block text-sm font-medium text-ink">间隔小时数（1–720）</label>
          <input v-model.number="form.trigger_interval_hours" type="number" min="1" max="720" class="mf-input" />
        </div>

        <div v-else>
          <label class="mb-1.5 block text-sm font-medium text-ink">执行时间</label>
          <input v-model="form.trigger_time" type="time" class="mf-input" />
        </div>

        <label class="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input v-model="form.notify_enabled" type="checkbox" class="accent-coral" /> 跑完推送到消息渠道
        </label>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showForm = false">取消</button>
        <button class="mf-btn-primary" :disabled="saving" @click="create">{{ saving ? '创建中…' : '创建' }}</button>
      </template>
    </MfModal>
  </div>
</template>
