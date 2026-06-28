<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { ECharts } from 'echarts'
import { memoryApi, type GraphData } from '@/api/memories'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

const ui = useUiStore()
const el = ref<HTMLDivElement | null>(null)
const chart = shallowRef<ECharts | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const empty = ref(false)
const stats = ref({ nodes: 0, edges: 0 })
let ro: ResizeObserver | null = null

const palette = ['#FF6B5E', '#8B7FF0', '#2FB59C', '#FFB088', '#F0473A']

function buildOption(data: GraphData) {
  const categories = data.communities.map((c) => ({ name: c.name || c.id }))
  const catIndex = new Map(data.communities.map((c, i) => [c.id, i]))
  return {
    tooltip: {},
    legend: [{ data: categories.map((c) => c.name), bottom: 0, textStyle: { color: '#6B6480' } }],
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        // 让力导布局收敛后自动居中、铺满容器
        center: ['50%', '50%'],
        categories,
        label: { show: true, color: '#2A2438', fontSize: 11 },
        force: { repulsion: 180, edgeLength: 120, gravity: 0.08 },
        lineStyle: { color: '#ECE6DD', width: 1.5, curveness: 0.1 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 3, color: '#FF6B5E' } },
        data: data.nodes.map((n) => ({
          id: n.id,
          name: n.name,
          symbolSize: 18 + (n.importance || 0) * 14,
          category: n.community_id != null ? catIndex.get(n.community_id) : undefined,
          itemStyle: { color: palette[(n.community_id != null ? catIndex.get(n.community_id) ?? 0 : 0) % palette.length] },
        })),
        edges: data.edges.map((e) => ({
          source: e.source,
          target: e.target,
          label: { show: false, formatter: e.predicate_surface || e.predicate },
        })),
      },
    ],
  }
}

// 关键：只有在容器已可见且有尺寸时才初始化/渲染，否则力导图会以 0×0 收敛，导致显示不全/不居中
async function render(data: GraphData) {
  stats.value = { nodes: data.nodes.length, edges: data.edges.length }
  if (!data.nodes.length) {
    empty.value = true
    return
  }
  empty.value = false
  // 等 DOM 把容器显示出来（v-show 解除）后再拿尺寸
  await nextTick()
  const host = el.value
  if (!host) return

  const echarts = await import('echarts')
  if (!chart.value) {
    chart.value = echarts.init(host)
    // 容器尺寸变化（首次出现、窗口缩放、侧栏开合）时自动重排居中
    ro = new ResizeObserver(() => chart.value?.resize())
    ro.observe(host)
  }
  chart.value.setOption(buildOption(data), true)
  // 兜底：若首帧拿到的还是 0 尺寸，下一帧再 resize 一次确保居中铺满
  requestAnimationFrame(() => chart.value?.resize())
  setTimeout(() => chart.value?.resize(), 200)
}

async function fetchGraph(silent = false) {
  if (silent) refreshing.value = true
  else loading.value = true
  try {
    const { data } = await memoryApi.graph()
    await render(data)
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function resize() {
  chart.value?.resize()
}

onMounted(() => {
  fetchGraph()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  ro?.disconnect()
  chart.value?.dispose()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-8 py-10">
    <PageHeader eyebrow="你的记忆" title="记忆图谱" desc="MyFriend 把你提到的人、事、物连成了一张网">
      <template #actions>
        <button class="mf-btn-ghost" :disabled="refreshing || loading" @click="fetchGraph(true)">
          <MfIcon name="refresh" :size="16" :class="refreshing ? 'animate-spin' : ''" /> 刷新
        </button>
      </template>
    </PageHeader>

    <p v-if="!loading && !empty" class="mb-3 font-mono text-xs text-ink-faint">
      {{ stats.nodes }} 个节点 · {{ stats.edges }} 条关系
    </p>

    <div v-if="loading" class="mf-skeleton h-[60vh]" />
    <MfEmpty v-else-if="empty" icon="🕸" title="图谱还很稀疏" hint="多和 MyFriend 聊聊，它会慢慢织出你的记忆之网" />
    <!-- v-show 而非 v-if：容器始终在 DOM 中，但渲染要等 loading=false 后容器可见才触发，避免 0 尺寸初始化 -->
    <div v-show="!loading && !empty" ref="el" class="mf-card h-[60vh] w-full p-2" />
  </div>
</template>
