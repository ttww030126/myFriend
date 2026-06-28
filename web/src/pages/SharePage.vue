<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import client, { type Wrapped } from '@/api/client'
import type { ChatMessage } from '@/api/chat'
import MfLogo from '@/components/ui/MfLogo.vue'
import MarkdownMessage from '@/components/ui/MarkdownMessage.vue'
import MfSpinner from '@/components/ui/MfSpinner.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

interface ShareData {
  title: string
  messages: ChatMessage[]
}

const route = useRoute()
const loading = ref(true)
const error = ref(false)
const data = ref<ShareData | null>(null)

onMounted(async () => {
  try {
    const token = route.params.token as string
    const res = await client.get<unknown, Wrapped<ShareData>>(`/share/${token}`)
    data.value = res.data
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-paper">
    <header class="border-b border-line bg-white/80 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <MfLogo :size="30" />
        <span class="mf-pill bg-coral-soft text-coral-deep">分享的对话</span>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-10">
      <div v-if="loading" class="flex justify-center py-20"><MfSpinner /></div>
      <MfEmpty v-else-if="error || !data" icon="🔗" title="链接已失效" hint="这条分享可能已被取消，或链接不正确" />
      <div v-else>
        <h1 class="mb-8 font-display text-2xl font-bold text-ink">{{ data.title }}</h1>
        <div class="space-y-6">
          <div v-for="m in data.messages" :key="m.id" class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
            <div
              class="max-w-[85%] rounded-3xl px-5 py-3"
              :class="m.role === 'user' ? 'bg-gradient-to-br from-coral to-apricot text-white' : 'mf-card'"
            >
              <MarkdownMessage v-if="m.role !== 'user'" :content="m.content" />
              <p v-else class="whitespace-pre-wrap">{{ m.content }}</p>
            </div>
          </div>
        </div>
        <p class="mt-12 text-center text-sm text-ink-faint">由 MyFriend · 知己 生成</p>
      </div>
    </main>
  </div>
</template>
