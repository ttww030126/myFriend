<script setup lang="ts">
import { onMounted, ref } from 'vue'
import client, { type Wrapped } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'

// 与后端 list_tools_for_user 返回字段严格对齐：主键是 tool_key（不是 id）
interface ToolItem {
  tool_key: string
  name: string
  description: string
  icon?: string
  tool_type: string
  needs_config: boolean
  config_hint: string | null
  enabled: boolean
}

const ui = useUiStore()
const tools = ref<ToolItem[]>([])
const loading = ref(true)

// 兜底数据用真实的内置 tool_key，避免离线预览时再次踩 undefined
const fallback: ToolItem[] = [
  { tool_key: 'knowledge_search', name: '知识库检索', description: '回答前先翻你存过的文档与图片，让答案有据可依', enabled: true, icon: 'book', tool_type: 'builtin', needs_config: false, config_hint: null },
  { tool_key: 'memory_search', name: '记忆检索', description: '结合它记住的关于你的事，给出更贴合你的回答', enabled: true, icon: 'memory', tool_type: 'builtin', needs_config: false, config_hint: null },
  { tool_key: 'web_search', name: '联网搜索', description: '需要时实时联网查最新信息', enabled: false, icon: 'search', tool_type: 'builtin', needs_config: true, config_hint: '需先在「模型配置」添加 websearch 类型模型（百度千帆 / Tavily）' },
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
    // 用真实 tool_key 调用，而不是不存在的 t.id
    await client.put(`/tools/${t.tool_key}`, { enabled: next })
    t.enabled = next
    if (next && t.needs_config && t.config_hint) {
      ui.notify(t.config_hint, 'info')
    }
  } catch (e) {
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
      <div v-for="t in tools" :key="t.tool_key" class="mf-card flex items-center gap-4 p-5">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage-soft text-sage">
          <MfIcon :name="t.icon || 'tool'" :size="20" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-ink">{{ t.name }}</p>
          <p class="text-sm text-ink-soft">{{ t.description }}</p>
          <p v-if="t.needs_config && t.config_hint" class="mt-0.5 text-xs text-apricot">
            {{ t.config_hint }}
          </p>
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
