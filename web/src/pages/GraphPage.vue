<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { ECharts } from 'echarts'
import { memoryApi, type GraphData } from '@/api/memories'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

const ui = useUiStore()
const el = ref<HTMLDivElement | null>(null)
const chart = shallowRef<ECharts | null>(null)
const loading = ref(true)
const empty = ref(false)

const palette = ['#FF6B5E', '#8B7FF0', '#2FB59C', '#FFB088', '#F0473A']

async function render(data: GraphData) {
  if (!el.value) return
  if (!data.nodes.length) {
    empty.value = true
    return
  }
  const echarts = await import('echarts')
  chart.value = echarts.init(el.value)
  const categories = data.communities.map((c) => ({ name: c.name || c.id }))
  const catIndex = new Map(data.communities.map((c, i) => [c.id, i]))
  chart.value.setOption({
    tooltip: {},
    legend: [{ data: categories.map((c) => c.name), bottom: 0, textStyle: { color: '#6B6480' } }],
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        categories,
        label: { show: true, color: '#2A2438', fontSize: 11 },
        force: { repulsion: 180, edgeLength: 120 },
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
  })
}

function resize() {
  chart.value?.resize()
}

onMounted(async () => {
  try {
    const { data } = await memoryApi.graph()
    await render(data)
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart.value?.dispose()
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-8 py-10">
    <PageHeader eyebrow="你的记忆" title="记忆图谱" desc="MyFriend 把你提到的人、事、物连成了一张网" />

    <div v-if="loading" class="mf-skeleton h-[60vh]" />
    <MfEmpty v-else-if="empty" icon="🕸" title="图谱还很稀疏" hint="多和 MyFriend 聊聊，它会慢慢织出你的记忆之网" />
    <div v-show="!loading && !empty" ref="el" class="mf-card h-[60vh] w-full p-2" />
  </div>
</template>
