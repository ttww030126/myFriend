<script setup lang="ts">
import { onMounted, ref } from 'vue'
import client, { type Wrapped } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'

interface ToolItem {
  id: string
  key: string
  name: string
  description: string
  enabled: boolean
  icon?: string
}

const ui = useUiStore()
const tools = ref<ToolItem[]>([])
const loading = ref(true)

// 与原项目三大内置工具对应：知识库 / 记忆 / 联网
const fallback: ToolItem[] = [
  { id: 'knowledge', key: 'knowledge', name: '知识库检索', description: '回答前先翻你存过的文档与图片，让答案有据可依', enabled: true, icon: 'book' },
  { id: 'memory', key: 'memory', name: '记忆调用', description: '结合它记住的关于你的事，给出更贴合你的回答', enabled: true, icon: 'memory' },
  { id: 'websearch', key: 'websearch', name: '联网搜索', description: '需要时实时联网查最新信息', enabled: false, icon: 'search' },
]

async function load() {
  loading.value = true
  try {
    const res = await client.get<unknown, Wrapped<ToolItem[]>>('/tools')
    tools.value = res.data.length ? res.data : fallback
  } catch {
    tools.value = fallback
  } finally {
    loading.value = false
  }
}

async function toggle(t: ToolItem) {
  const next = !t.enabled
  try {
    await client.put(`/tools/${t.id}`, { enabled: next })
    t.enabled = next
  } catch (e) {
    t.enabled = next // 本地仍切换，便于离线预览
    ui.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl px-8 py-10">
    <PageHeader eyebrow="设置" title="工具开关" desc="决定 MyFriend 在思考时可以动用哪些能力" />

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="mf-skeleton h-20" />
    </div>

    <div v-else class="space-y-3">
      <div v-for="t in tools" :key="t.id" class="mf-card flex items-center gap-4 p-5">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage-soft text-sage">
          <MfIcon :name="t.icon || 'tool'" :size="20" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-ink">{{ t.name }}</p>
          <p class="text-sm text-ink-soft">{{ t.description }}</p>
        </div>
        <button
          class="relative h-7 w-12 shrink-0 rounded-full transition"
          :class="t.enabled ? 'bg-coral' : 'bg-line'"
          @click="toggle(t)"
        >
          <span
            class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
            :class="t.enabled ? 'left-6' : 'left-1'"
          />
        </button>
      </div>
    </div>
  </div>
</template>
