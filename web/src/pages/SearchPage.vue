<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { searchApi, type GlobalSearchResult } from '@/api/search'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

const router = useRouter()
const ui = useUiStore()
const q = ref('')
const loading = ref(false)
const searched = ref(false)
const result = ref<GlobalSearchResult>({ documents: [], images: [], memories: [] })

async function run() {
  if (!q.value.trim()) return
  loading.value = true
  searched.value = true
  try {
    result.value = (await searchApi.global(q.value.trim())).data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

const total = () =>
  result.value.documents.length + result.value.images.length + result.value.memories.length
</script>

<template>
  <div class="mx-auto max-w-5xl px-8 py-10">
    <PageHeader eyebrow="一起探索" title="全局搜索" desc="一次搜遍你的文档、图片与记忆" />

    <div class="mf-card mb-8 flex items-center gap-3 p-2 pl-5">
      <MfIcon name="search" :size="20" class="text-ink-faint" />
      <input
        v-model="q"
        class="flex-1 bg-transparent py-2.5 text-ink outline-none placeholder:text-ink-faint"
        placeholder="想找点什么？输入关键词，回车搜索"
        @keyup.enter="run"
      />
      <button class="mf-btn-primary" :disabled="loading" @click="run">
        {{ loading ? '搜索中…' : '搜索' }}
      </button>
    </div>

    <div v-if="loading" class="grid gap-5 md:grid-cols-3">
      <div v-for="i in 3" :key="i" class="mf-skeleton h-48" />
    </div>

    <MfEmpty v-else-if="searched && total() === 0" icon="🔍" title="没找到相关内容" hint="换个说法，或者先往知识库、记忆里多存一些东西" />

    <div v-else-if="searched" class="grid gap-5 md:grid-cols-3">
      <section class="mf-card p-5">
        <h3 class="mb-3 flex items-center gap-2 font-display font-bold text-ink">
          <MfIcon name="book" :size="18" class="text-lilac" /> 文档 · {{ result.documents.length }}
        </h3>
        <div class="space-y-3">
          <div v-for="h in result.documents" :key="h.chunk_id" class="rounded-2xl bg-paper p-3 text-sm">
            <p class="mb-1 font-medium text-ink">{{ h.doc_name || '未命名文档' }}</p>
            <p class="line-clamp-3 text-ink-soft">{{ h.content }}</p>
          </div>
          <p v-if="!result.documents.length" class="text-sm text-ink-faint">无匹配</p>
        </div>
      </section>

      <section class="mf-card p-5">
        <h3 class="mb-3 flex items-center gap-2 font-display font-bold text-ink">
          <MfIcon name="image" :size="18" class="text-coral" /> 图片 · {{ result.images.length }}
        </h3>
        <div class="space-y-3">
          <div v-for="h in result.images" :key="h.chunk_id" class="rounded-2xl bg-paper p-3 text-sm">
            <p class="line-clamp-3 text-ink-soft">{{ h.content }}</p>
          </div>
          <p v-if="!result.images.length" class="text-sm text-ink-faint">无匹配</p>
        </div>
      </section>

      <section class="mf-card p-5">
        <h3 class="mb-3 flex items-center gap-2 font-display font-bold text-ink">
          <MfIcon name="memory" :size="18" class="text-sage" /> 记忆 · {{ result.memories.length }}
        </h3>
        <div class="space-y-3">
          <div
            v-for="(h, i) in result.memories"
            :key="i"
            class="cursor-pointer rounded-2xl bg-paper p-3 text-sm transition hover:bg-sage-soft"
            @click="router.push('/memory')"
          >
            <p class="mb-0.5 font-medium text-ink">{{ h.name }}</p>
            <p class="line-clamp-2 text-ink-soft">{{ h.description || h.type }}</p>
          </div>
          <p v-if="!result.memories.length" class="text-sm text-ink-faint">无匹配</p>
        </div>
      </section>
    </div>

    <MfEmpty v-else icon="✨" title="搜点什么吧" hint="MyFriend 会同时翻看你存过的每一类内容" />
  </div>
</template>
