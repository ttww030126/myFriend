<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { ECharts } from 'echarts'
import {
  researchApi,
  startResearchStream,
  type LoopDetail,
  type ReportBrief,
  type ReportDetail,
} from '@/api/research'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'
import MarkdownMessage from '@/components/ui/MarkdownMessage.vue'

const ui = useUiStore()
const topic = ref('')
const reports = ref<ReportBrief[]>([])
const loading = ref(true)
const running = ref(false)
const progress = ref<string[]>([])
const abort = shallowRef<AbortController | null>(null)

const statusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: '排队中', cls: 'bg-ink/5 text-ink-soft' },
  planning: { label: '规划中', cls: 'bg-lilac-soft text-lilac' },
  searching: { label: '检索中', cls: 'bg-lilac-soft text-lilac' },
  writing: { label: '撰写中', cls: 'bg-apricot/20 text-apricot' },
  summarizing: { label: '汇总中', cls: 'bg-apricot/20 text-apricot' },
  done: { label: '已完成', cls: 'bg-sage-soft text-sage' },
  failed: { label: '失败', cls: 'bg-coral-soft text-coral-deep' },
}
const RUBRIC_LABELS: Record<string, string> = {
  coverage: '覆盖度',
  faithfulness: '引用对齐',
  depth: '论证深度',
  timeliness: '时效性',
  relevance: '相关性',
  readability: '可读性',
}

async function load() {
  loading.value = true
  try {
    reports.value = (await researchApi.list(1, 30)).data.items
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function start() {
  if (!topic.value.trim() || running.value) return
  running.value = true
  progress.value = []
  abort.value = new AbortController()
  const t = topic.value.trim()
  try {
    await startResearchStream(
      t,
      (ev, data) => {
        if (ev === 'meta' && data.report_id) {
          progress.value.push('已建报告，开始规划…')
        } else if (ev === 'plan' || ev === 'planning') {
          progress.value.push('已生成研究大纲')
        } else if (ev === 'search' || ev === 'searching' || ev === 'step') {
          const txt = (data.text as string) || (data.query as string) || '检索资料中…'
          progress.value.push(String(txt))
        } else if (ev === 'writing' || ev === 'chapter') {
          progress.value.push((data.heading as string) ? `撰写：${data.heading}` : '撰写章节中…')
        } else if (ev === 'loop_verify_done') {
          const total = (data.scores as { total?: number })?.total
          progress.value.push(`质量复核：${total != null ? Math.round(total * 100) + '分' : '完成'}`)
        } else if (ev === 'loop_finished') {
          progress.value.push(`质量闭环：${data.status}（评分 ${data.final_score ?? '-'}）`)
        } else if (ev === 'done' || ev === 'finished') {
          progress.value.push('报告完成 ✓')
        } else if (ev === 'error') {
          progress.value.push(`出错：${data.message || data.raw || '未知错误'}`)
        }
      },
      abort.value.signal,
    )
    ui.success('研究完成')
    topic.value = ''
  } catch (e) {
    if ((e as Error).name !== 'AbortError') ui.error((e as Error).message)
  } finally {
    running.value = false
    abort.value = null
    load()
  }
}

function stop() {
  abort.value?.abort()
  running.value = false
}

async function remove(r: ReportBrief) {
  try {
    await researchApi.remove(r.id)
    reports.value = reports.value.filter((x) => x.id !== r.id)
  } catch (e) {
    ui.error((e as Error).message)
  }
}

// ── 报告详情 + 质量卡 ──
const detailOpen = ref(false)
const detail = ref<ReportDetail | null>(null)
const detailLoading = ref(false)
const loop = ref<LoopDetail | null>(null)
const radarEl = ref<HTMLDivElement | null>(null)
const radarChart = shallowRef<ECharts | null>(null)

async function openReport(r: ReportBrief) {
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  loop.value = null
  try {
    detail.value = (await researchApi.detail(r.id)).data
    try {
      loop.value = (await researchApi.loop(r.id)).data
    } catch {
      loop.value = null
    }
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    detailLoading.value = false
  }
}

// 取最后一轮的维度分画雷达
function latestScores(): Record<string, number> | null {
  if (!loop.value?.iterations_detail?.length) return null
  for (let i = loop.value.iterations_detail.length - 1; i >= 0; i--) {
    const s = loop.value.iterations_detail[i].scores
    if (s && 'raw' in s && Object.keys((s as { raw: Record<string, number> }).raw).length) {
      return (s as { raw: Record<string, number> }).raw
    }
  }
  return null
}

async function renderRadar() {
  const raw = latestScores()
  if (!raw || !radarEl.value) return
  const echarts = await import('echarts')
  if (!radarChart.value) radarChart.value = echarts.init(radarEl.value)
  const dims = Object.keys(raw)
  radarChart.value.setOption(
    {
      tooltip: {},
      radar: {
        indicator: dims.map((d) => ({ name: RUBRIC_LABELS[d] || d, max: 5 })),
        radius: '62%',
        axisName: { color: '#6B6480', fontSize: 11 },
        splitLine: { lineStyle: { color: '#ECE6DD' } },
        splitArea: { areaStyle: { color: ['#FFFFFF', '#FBF8F4'] } },
        axisLine: { lineStyle: { color: '#ECE6DD' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: dims.map((d) => raw[d]),
              name: '质量评分',
              areaStyle: { color: 'rgba(139,127,240,0.18)' },
              lineStyle: { color: '#8B7FF0', width: 2 },
              itemStyle: { color: '#8B7FF0' },
            },
          ],
        },
      ],
    },
    true,
  )
  requestAnimationFrame(() => radarChart.value?.resize())
}

watch([detailOpen, loop], async () => {
  if (detailOpen.value && loop.value) {
    await nextTick()
    renderRadar()
  }
})

onMounted(load)
onBeforeUnmount(() => {
  abort.value?.abort()
  radarChart.value?.dispose()
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-8 py-10">
    <PageHeader eyebrow="陪你" title="深度研究" desc="给一个题目，MyFriend 会多轮检索、交叉求证，再经质量复核，最后给你一份有出处的报告" />

    <div class="mf-card mb-8 p-6">
      <label class="mb-2 block text-sm font-medium text-ink">想研究什么？</label>
      <textarea
        v-model="topic"
        rows="3"
        class="mf-input mb-4"
        :disabled="running"
        placeholder="比如：对比几款主流向量数据库的取舍，并给出选型建议"
      />
      <div class="flex items-center gap-3">
        <button v-if="!running" class="mf-btn-primary" :disabled="!topic.trim()" @click="start">
          <MfIcon name="research" :size="18" /> 开始研究
        </button>
        <button v-else class="mf-btn-ghost" @click="stop">停止</button>
        <span v-if="running" class="text-sm text-apricot">研究进行中…完成后自动出现在下方</span>
      </div>

      <!-- 实时进度 -->
      <div v-if="running && progress.length" class="mt-4 space-y-1 rounded-xl bg-paper/60 p-3 text-xs text-ink-soft">
        <p v-for="(p, i) in progress.slice(-8)" :key="i" class="flex items-center gap-1.5">
          <span class="text-lilac">◌</span> {{ p }}
        </p>
      </div>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="mf-skeleton h-24" />
    </div>

    <MfEmpty v-else-if="!reports.length" icon="🔬" title="还没有研究报告" hint="在上面写下一个题目，开启你的第一次深度研究" />

    <div v-else class="space-y-3">
      <div
        v-for="r in reports"
        :key="r.id"
        class="mf-card group cursor-pointer p-5 transition hover:shadow-lift"
        @click="r.status === 'done' ? openReport(r) : null"
      >
        <div class="mb-2 flex items-start justify-between gap-3">
          <p class="font-display font-bold text-ink">{{ r.title || r.topic }}</p>
          <div class="flex shrink-0 items-center gap-2">
            <span class="mf-pill" :class="(statusMap[r.status] || statusMap.pending).cls">
              {{ (statusMap[r.status] || statusMap.pending).label }}
            </span>
            <button class="text-ink-faint opacity-0 transition hover:text-coral group-hover:opacity-100" @click.stop="remove(r)">
              <MfIcon name="trash" :size="15" />
            </button>
          </div>
        </div>
        <p class="font-mono text-xs text-ink-faint">
          {{ r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '' }}
          <span v-if="r.status === 'done'"> · 点击查看报告</span>
        </p>
      </div>
    </div>

    <!-- 报告详情 + 质量卡 -->
    <MfModal :open="detailOpen" title="研究报告" width="56rem" @close="detailOpen = false">
      <div v-if="detailLoading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="mf-skeleton h-6" />
      </div>
      <div v-else-if="detail" class="space-y-6">
        <!-- 质量评分卡 -->
        <section v-if="loop && latestScores()" class="rounded-2xl border border-lilac/30 bg-lilac-soft/30 p-5">
          <div class="mb-1 flex items-center gap-2">
            <MfIcon name="sparkle" :size="16" class="text-lilac" />
            <span class="font-display font-bold text-ink">质量评分</span>
            <span class="mf-pill ml-auto" :class="loop.status === 'passed' ? 'bg-sage-soft text-sage' : loop.status === 'failed' ? 'bg-coral-soft text-coral-deep' : 'bg-apricot/20 text-apricot'">
              {{ loop.status === 'passed' ? '已通过' : loop.status === 'exceeded' ? '超限收尾' : loop.status === 'failed' ? '未通过' : '进行中' }}
            </span>
          </div>
          <p class="mb-3 font-mono text-xs text-ink-faint">
            总分 {{ loop.final_score != null ? Math.round(loop.final_score * 100) : '-' }} / 门槛 {{ Math.round(loop.pass_threshold * 100) }}
            · 迭代 {{ loop.iterations }}/{{ loop.max_iterations }}
            <span v-if="loop.verifier_kind"> · {{ loop.verifier_kind === 'cross' ? '跨模型审稿' : '同模型自评' }}</span>
          </p>
          <div ref="radarEl" class="h-64 w-full" />
          <!-- 各轮反馈 -->
          <div v-if="loop.iterations_detail?.length" class="mt-2 space-y-2">
            <details v-for="it in loop.iterations_detail" :key="it.iteration_no" class="rounded-xl bg-surface/70 p-3 text-xs">
              <summary class="cursor-pointer font-medium text-ink">
                第 {{ it.iteration_no }} 轮 · {{ it.decision }}
                <span v-if="it.scores && 'total' in it.scores" class="text-ink-faint">（{{ Math.round((it.scores as { total: number }).total * 100) }}分）</span>
              </summary>
              <p v-if="it.feedback?.summary" class="mt-2 leading-relaxed text-ink-soft">{{ it.feedback.summary }}</p>
            </details>
          </div>
        </section>

        <!-- 正文 -->
        <article v-if="detail.report_md">
          <MarkdownMessage :content="detail.report_md" />
        </article>
        <MfEmpty v-else icon="📄" title="报告还在生成" hint="稍后回来查看完整内容" />

        <!-- 来源 -->
        <section v-if="detail.sources?.length">
          <p class="mf-eyebrow mb-2">引用来源（{{ detail.sources.length }}）</p>
          <ol class="space-y-1.5">
            <li v-for="s in detail.sources" :key="s.index" class="flex gap-2 text-sm">
              <span class="shrink-0 font-mono text-ink-faint">[{{ s.index }}]</span>
              <a v-if="s.url" :href="s.url" target="_blank" rel="noreferrer" class="break-all text-lilac hover:text-coral">{{ s.title }}</a>
              <span v-else class="text-ink-soft">{{ s.title }}</span>
            </li>
          </ol>
        </section>
      </div>
      <template #footer>
        <button class="mf-btn-primary" @click="detailOpen = false">关闭</button>
      </template>
    </MfModal>
  </div>
</template>
