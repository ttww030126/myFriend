<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { favoriteApi, type FavoriteItem, type FavoriteType } from '@/api/favorites'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

const ui = useUiStore()
const items = ref<FavoriteItem[]>([])
const loading = ref(true)
const filter = ref<FavoriteType | 'all'>('all')

const tabs: { key: FavoriteType | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: 'star' },
  { key: 'message', label: '对话', icon: 'chat' },
  { key: 'document', label: '文档', icon: 'book' },
  { key: 'image', label: '图片', icon: 'image' },
  { key: 'memory', label: '记忆', icon: 'memory' },
]

const shown = computed(() =>
  filter.value === 'all' ? items.value : items.value.filter((i) => i.target_type === filter.value),
)

async function load() {
  loading.value = true
  try {
    items.value = (await favoriteApi.list()).data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function remove(it: FavoriteItem) {
  try {
    await favoriteApi.remove(it.id)
    items.value = items.value.filter((x) => x.id !== it.id)
    ui.success('已取消收藏')
  } catch (e) {
    ui.error((e as Error).message)
  }
}

const typeLabel: Record<FavoriteType, string> = {
  message: '对话',
  document: '文档',
  image: '图片',
  memory: '记忆',
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <PageHeader eyebrow="一起探索" title="收藏夹" desc="那些你想再回头看看的片段，都在这儿" />

    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition"
        :class="filter === t.key ? 'bg-ink text-paper' : 'bg-white text-ink-soft hover:bg-coral-soft'"
        @click="filter = t.key"
      >
        <MfIcon :name="t.icon" :size="15" /> {{ t.label }}
      </button>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="mf-skeleton h-20" />
    </div>

    <MfEmpty v-else-if="!shown.length" icon="⭐" title="这里还空着" hint="在对话、文档或记忆里点一下收藏，就会出现在这里" />

    <div v-else class="space-y-3">
      <div v-for="it in shown" :key="it.id" class="mf-card mf-card-hover flex items-start gap-4 p-4">
        <span class="mf-pill shrink-0 bg-coral-soft text-coral-deep">{{ typeLabel[it.target_type] }}</span>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-ink">{{ it.snapshot?.title || '未命名内容' }}</p>
          <p v-if="it.snapshot?.summary" class="mt-1 line-clamp-2 text-sm text-ink-soft">{{ it.snapshot.summary }}</p>
          <p class="mt-1.5 font-mono text-xs text-ink-faint">{{ new Date(it.created_at).toLocaleString('zh-CN') }}</p>
        </div>
        <button class="text-ink-faint transition hover:text-coral" @click="remove(it)">
          <MfIcon name="trash" :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>
