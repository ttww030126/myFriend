<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchPublicReportShare, type PublicReportShare } from '@/api/research'
import MfLogo from '@/components/ui/MfLogo.vue'
import MarkdownMessage from '@/components/ui/MarkdownMessage.vue'
import MfSpinner from '@/components/ui/MfSpinner.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

// 研究报告公开查看页（无需登录）：只读渲染报告 Markdown 快照。
const route = useRoute()
const loading = ref(true)
const error = ref(false)
const data = ref<PublicReportShare | null>(null)

onMounted(async () => {
  try {
    const token = route.params.token as string
    const res = await fetchPublicReportShare(token)
    data.value = res.data
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-bg">
    <header class="border-b border-line bg-surface/80 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <MfLogo :size="30" />
        <span class="mf-pill bg-lilac-soft text-lilac">深度研究报告</span>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-10">
      <div v-if="loading" class="flex justify-center py-20"><MfSpinner /></div>
      <MfEmpty
        v-else-if="error || !data"
        icon="🔗"
        title="分享不可用"
        hint="该分享链接不存在、已取消或已过期"
      />
      <article v-else>
        <h1 class="mb-2 font-display text-3xl font-extrabold tracking-tight text-ink">
          {{ data.title }}
        </h1>
        <p class="mb-8 text-sm text-ink-faint">来自 MyFriend · 知己 的深度研究报告</p>
        <div class="mf-card p-8">
          <MarkdownMessage :content="data.markdown" />
        </div>
        <p class="mt-12 text-center text-sm text-ink-faint">本页内容由用户分享 · 由 MyFriend · 知己 生成</p>
      </article>
    </main>
  </div>
</template>
