<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { traceApi, type CostSummary, type SpanItem, type TraceDetail, type TraceListItem } from '@/api/traces'
import { dashboardApi, type LoopHealthData } from '@/api/dashboard'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'

const ui = useUiStore()
const route = useRoute()

const items = ref<TraceListItem[]>([])
const total = ref(0)
const loading = ref(true)
const days = ref(7)
const taskType = ref<string>('')
const status = ref<string>('')

const cost = ref<CostSummary | null>(null)
const loop = ref<LoopHealthData | null>(null)

const detailOpen = ref(false)
const detail = ref<TraceDetail | null>(null)
const detailLoading = ref(false)
const openSpan = ref<string | null>(null)

const TASK_TYPE: Record<string, { label: string; cls: string }> = {
  research: { label: '深度研究', cls: 'bg-lilac-soft text-lilac' },
  chat: { label: '对话', cls: 'bg-sage-soft text-sage' },
  agent_task: { label: '定时任务', cls: 'bg-apricot/20 text-apricot' },
  verify: { label: '审稿', cls: 'bg-lilac-soft text-lilac' },
  repair: { label: '修复', cls: 'bg-coral-soft text-coral-deep' },
}
const SPAN_TYPE: Record<string, { label: string; color: string }> = {
  planner: { label: '规划', color: '#8B7FF0' },
  retriever: { label: '检索', color: '#2FB59C' },
  writer: { label: '写作', color: '#369F21' },
  tool_call: { label: '工具', color: '#FFB088' },
  mcp_call: { label: 'MCP', color: '#FFB088' },
  verifier: { label: '审稿', color: '#8B7FF0' },
  repair: { label: '修复', color: '#FF6B5E' },
  llm_call: { label: 'LLM', color: '#9A93AB' },
  other: { label: '其他', color: '#C9C3D6' },
}
const KEY_LABELS: Record<string, string> = {
  'gen_ai.system': '模型厂商',
  'gen_ai.request.model': '模型',
  'gen_ai.request.temperature': '温度',
  'gen_ai.response.finish_reasons': '结束原因',
  'gen_ai.operation.name': '操作',
  'comet.chat.mode': '调用模式',
  'comet.chat.iteration': '对话轮次',
  'comet.tool.name': '工具',
  'comet.tool.query': '查询内容',
  'comet.retrieval.query_count': '检索角度数',
  'comet.retrieval.hit_count': '命中条数',
  'comet.verifier.kind': '审稿模式',
  'comet.loop.iteration_no': '回炉轮次',
  'comet.repair.action': '修复策略',
  request_summary: '请求内容',
  response_preview: '回复预览',
  output_preview: '工具返回预览',
  total_score: '总分',
  rationale: '决策理由',
  status: '状态',
}

function fmtMs(ms: number | null) {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(1)}m`
}
function fmtCost(c: number) {
  if (!c) return '-'
  return c < 0.01 ? `¥${c.toFixed(5)}` : `¥${c.toFixed(4)}`
}
function fmtTokens(n: number) {
  if (!n) return '0'
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(1)}k`
}
function fmtTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
const spanMeta = (t: string) => SPAN_TYPE[t] || SPAN_TYPE.other
const taskMeta = (t: string) => TASK_TYPE[t] || { label: t, cls: 'bg-ink/5 text-ink-soft' }
const keyLabel = (k: string) => KEY_LABELS[k] || k

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

async function load() {
  loading.value = true
  try {
    const res = await traceApi.list({
      days: days.value,
      limit: 50,
      task_type: taskType.value || undefined,
      status: status.value || undefined,
    })
    items.value = res.data.items
    total.value = res.data.total
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function loadCost() {
  try {
    cost.value = (await traceApi.costSummary(days.value)).data
  } catch {
    cost.value = null
  }
}
async function loadLoop() {
  try {
    loop.value = (await dashboardApi.loopHealth(30)).data
  } catch {
    loop.value = null
  }
}

function setDays(d: number) {
  days.value = d
  load()
  loadCost()
}

async function openDetail(t: TraceListItem) {
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  openSpan.value = null
  try {
    detail.value = (await traceApi.detail(t.trace_id)).data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    detailLoading.value = false
  }
}

// 时间线：把 span 按起止时间归一化成百分比偏移和宽度
const timeline = computed(() => {
  const spans = detail.value?.spans || []
  if (!spans.length) return { rows: [] as Array<SpanItem & { offset: number; width: number }>, t0: 0, span: 1 }
  const starts = spans.map((s) => new Date(s.started_at).getTime())
  const ends = spans.map((s) => (s.finished_at ? new Date(s.finished_at).getTime() : new Date(s.started_at).getTime()))
  const t0 = Math.min(...starts)
  const t1 = Math.max(...ends)
  const span = Math.max(1, t1 - t0)
  const rows = spans
    .slice()
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .map((s) => {
      const st = new Date(s.started_at).getTime()
      const en = s.finished_at ? new Date(s.finished_at).getTime() : st
      return { ...s, offset: ((st - t0) / span) * 100, width: Math.max(1.5, ((en - st) / span) * 100) }
    })
  return { rows, t0, span }
})

function spanAttrs(s: SpanItem) {
  const merged: Record<string, unknown> = { ...(s.attributes || {}), ...(s.payload || {}) }
  return Object.entries(merged).filter(([, v]) => v !== null && v !== undefined && v !== '')
}

onMounted(() => {
  // 支持 /traces?trace_id=xxx 直接打开详情（来自对话消息/研究报告的「执行轨迹」入口）
  const tid = route.query.trace_id as string | undefined
  load()
  loadCost()
  loadLoop()
  if (tid) openDetail({ trace_id: tid } as TraceListItem)
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-8 py-10">
    <PageHeader eyebrow="可观测" title="执行轨迹" desc="每一次 Agent 任务的完整链路、耗时与花费，都在这里">
      <template #actions>
        <button class="mf-btn-ghost" @click="load(); loadCost(); loadLoop()">
          <MfIcon name="refresh" :size="16" /> 刷新
        </button>
      </template>
    </PageHeader>

    <!-- 天数切换 + 成本 KPI -->
    <div class="mb-5 flex flex-wrap items-center gap-2">
      <div class="flex gap-1 rounded-xl bg-ink/5 p-1">
        <button
          v-for="d in [7, 30, 90]"
          :key="d"
          class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
          :class="days === d ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'"
          @click="setDays(d)"
        >
          近 {{ d }} 天
        </button>
      </div>
    </div>

    <div v-if="cost" class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="mf-card p-4">
        <p class="mf-eyebrow mb-1">任务数</p>
        <p class="font-display text-2xl font-bold text-ink">{{ cost.total_traces }}</p>
      </div>
      <div class="mf-card p-4">
        <p class="mf-eyebrow mb-1">总 Token</p>
        <p class="font-display text-2xl font-bold text-ink">{{ fmtTokens(cost.total_input_tokens + cost.total_output_tokens) }}</p>
      </div>
      <div class="mf-card p-4">
        <p class="mf-eyebrow mb-1">总花费</p>
        <p class="font-display text-2xl font-bold text-coral">¥{{ cost.total_cost_cny.toFixed(4) }}</p>
      </div>
      <div class="mf-card p-4">
        <p class="mf-eyebrow mb-1">平均每任务</p>
        <p class="font-display text-2xl font-bold text-ink">{{ fmtCost(cost.total_traces ? cost.total_cost_cny / cost.total_traces : 0) }}</p>
      </div>
    </div>

    <!-- Verifier Loop 健康度 -->
    <div v-if="loop && loop.total" class="mf-card mb-5 p-5">
      <div class="mb-3 flex items-center gap-2">
        <MfIcon name="sparkle" :size="16" class="text-lilac" />
        <span class="font-display font-bold text-ink">质量复核（Verifier Loop · 近 30 天）</span>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><p class="mf-eyebrow mb-1">总复核</p><p class="font-display text-xl font-bold text-ink">{{ loop.total }}</p></div>
        <div><p class="mf-eyebrow mb-1">一次通过率</p><p class="font-display text-xl font-bold text-sage">{{ Math.round(loop.one_shot_pass_rate * 100) }}%</p></div>
        <div><p class="mf-eyebrow mb-1">平均迭代</p><p class="font-display text-xl font-bold text-ink">{{ loop.avg_iterations.toFixed(1) }}</p></div>
        <div><p class="mf-eyebrow mb-1">平均评分</p><p class="font-display text-xl font-bold text-ink">{{ loop.avg_final_score.toFixed(2) }}</p></div>
      </div>
      <div v-if="loop.failure_dims?.length" class="mt-3 flex flex-wrap gap-1.5">
        <span class="text-xs text-ink-faint">常失败维度：</span>
        <span v-for="f in loop.failure_dims.slice(0, 4)" :key="f.dim" class="mf-pill bg-coral-soft text-coral-deep">{{ f.label }} · {{ f.count }}</span>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="mb-4 flex flex-wrap gap-2">
      <select v-model="taskType" class="mf-input max-w-[10rem]" @change="load">
        <option value="">全部类型</option>
        <option value="research">深度研究</option>
        <option value="chat">对话</option>
        <option value="agent_task">定时任务</option>
      </select>
      <select v-model="status" class="mf-input max-w-[10rem]" @change="load">
        <option value="">全部状态</option>
        <option value="ok">成功</option>
        <option value="error">失败</option>
        <option value="running">进行中</option>
      </select>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="mf-skeleton h-20" />
    </div>

    <MfEmpty v-else-if="!items.length" icon="🔍" title="还没有执行轨迹" hint="发起一次深度研究或对话，这里就会记录完整链路" />

    <div v-else class="space-y-3">
      <button
        v-for="t in items"
        :key="t.trace_id"
        class="mf-card flex w-full flex-wrap items-center gap-3 p-4 text-left transition hover:shadow-lift"
        @click="openDetail(t)"
      >
        <span class="mf-pill" :class="taskMeta(t.task_type).cls">{{ taskMeta(t.task_type).label }}</span>
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :class="t.status === 'ok' ? 'bg-sage' : t.status === 'error' ? 'bg-coral' : 'bg-apricot'"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-ink">{{ t.task_name || t.task_type }}</p>
          <p class="font-mono text-xs text-ink-faint">{{ fmtTime(t.started_at) }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-4 font-mono text-xs text-ink-soft">
          <span><MfIcon name="task" :size="12" class="inline" /> {{ fmtMs(t.duration_ms) }}</span>
          <span>{{ fmtTokens(t.total_input_tokens + t.total_output_tokens) }} tok</span>
          <span class="text-coral">{{ fmtCost(t.total_cost_cny) }}</span>
        </div>
      </button>
    </div>

    <!-- 详情 -->
    <MfModal :open="detailOpen" title="执行轨迹详情" width="56rem" @close="detailOpen = false">
      <div v-if="detailLoading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="mf-skeleton h-12" />
      </div>
      <div v-else-if="detail" class="space-y-5">
        <!-- KPI -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><p class="mf-eyebrow mb-1">类型</p><p class="font-medium text-ink">{{ taskMeta(detail.task_type).label }}</p></div>
          <div><p class="mf-eyebrow mb-1">总耗时</p><p class="font-medium text-ink">{{ fmtMs(detail.duration_ms) }}</p></div>
          <div><p class="mf-eyebrow mb-1">Token</p><p class="font-medium text-ink">{{ fmtTokens(detail.total_input_tokens + detail.total_output_tokens) }}</p></div>
          <div><p class="mf-eyebrow mb-1">花费</p><p class="font-medium text-coral">{{ fmtCost(detail.total_cost_cny) }}</p></div>
        </div>
        <p v-if="detail.error_message" class="rounded-xl bg-coral-soft px-3 py-2 text-sm text-coral-deep">{{ detail.error_message }}</p>

        <!-- 甘特时间线 -->
        <div>
          <p class="mf-eyebrow mb-2">链路时间线 · 共 {{ timeline.rows.length }} 步</p>
          <div class="space-y-1">
            <div v-for="s in timeline.rows" :key="s.span_id">
              <div class="group flex cursor-pointer items-center gap-2" @click="openSpan = openSpan === s.span_id ? null : s.span_id">
                <span class="w-14 shrink-0 text-right font-mono text-[11px]" :style="{ color: spanMeta(s.span_type).color }">
                  {{ spanMeta(s.span_type).label }}
                </span>
                <div class="relative h-6 flex-1 rounded-md bg-ink/5">
                  <div
                    class="absolute top-0 flex h-6 items-center rounded-md px-2 text-[11px] font-medium text-white"
                    :style="{ left: s.offset + '%', width: s.width + '%', minWidth: '2.5rem', background: spanMeta(s.span_type).color, opacity: s.status === 'error' ? 0.6 : 1 }"
                    :title="s.name"
                  >
                    <span class="truncate">{{ s.name }}</span>
                  </div>
                </div>
                <span class="w-14 shrink-0 font-mono text-[11px] text-ink-faint">{{ fmtMs(s.duration_ms) }}</span>
              </div>
              <!-- 行内展开 span 详情 -->
              <div v-if="openSpan === s.span_id" class="ml-16 mt-1 rounded-xl bg-paper/60 p-3 text-xs">
                <div class="mb-2 flex flex-wrap gap-3 font-mono text-ink-soft">
                  <span v-if="s.model_name">模型：{{ s.model_name }}</span>
                  <span v-if="s.input_tokens || s.output_tokens">tokens：{{ s.input_tokens }}→{{ s.output_tokens }}</span>
                  <span v-if="s.cost_cny" class="text-coral">{{ fmtCost(s.cost_cny) }}</span>
                  <span :class="s.status === 'error' ? 'text-coral' : 'text-sage'">{{ s.status === 'ok' ? '成功' : s.status === 'error' ? '失败' : '进行中' }}</span>
                </div>
                <div v-if="spanAttrs(s).length" class="space-y-1">
                  <div v-for="[k, v] in spanAttrs(s)" :key="k" class="flex gap-2">
                    <span class="shrink-0 text-ink-faint">{{ keyLabel(k) }}：</span>
                    <span class="break-all text-ink-soft">{{ fmtVal(v) }}</span>
                  </div>
                </div>
                <p v-if="s.error_message" class="mt-1 text-coral-deep">{{ s.error_message }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="mf-btn-primary" @click="detailOpen = false">关闭</button>
      </template>
    </MfModal>
  </div>
</template>
