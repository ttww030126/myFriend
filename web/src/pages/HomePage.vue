<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi, type DailyReview, type OverviewData } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useMusicStore } from '@/stores/music'
import MarkdownMessage from '@/components/ui/MarkdownMessage.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfSpinner from '@/components/ui/MfSpinner.vue'

const router = useRouter()
const auth = useAuthStore()
const music = useMusicStore()

const review = ref<DailyReview | null>(null)
const overview = ref<OverviewData | null>(null)
const loadingReview = ref(true)

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

const stats = () => [
  { key: 'conversations', label: '对话', icon: 'chat', tint: 'coral' },
  { key: 'documents', label: '文档', icon: 'book', tint: 'lilac' },
  { key: 'entities', label: '记忆实体', icon: 'memory', tint: 'sage' },
  { key: 'images', label: '图片', icon: 'image', tint: 'coral' },
]

const quick = [
  { to: '/chat', icon: 'chat', title: '随便聊聊', desc: '和你的 AI 朋友开始对话' },
  { to: '/knowledge', icon: 'book', title: '喂点资料', desc: '把文档沉淀进知识库' },
  { to: '/memory', icon: 'memory', title: '记住一件事', desc: '让它更懂你' },
]

onMounted(async () => {
  try {
    review.value = (await dashboardApi.dailyReview()).data
  } catch {
    /* 后端未就绪时静默 */
  } finally {
    loadingReview.value = false
  }
  try {
    overview.value = (await dashboardApi.overview()).data
  } catch {
    /* ignore */
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-8 py-10">
    <!-- 问候 -->
    <header class="mb-8">
      <p class="mf-eyebrow mb-1.5">今日 · {{ new Date().toLocaleDateString('zh-CN') }}</p>
      <h1 class="font-display text-3xl font-extrabold tracking-tight text-ink">
        {{ greeting() }}，{{ auth.displayName }}
      </h1>
    </header>

    <!-- AI 每日关心 -->
    <section class="mf-card relative mb-8 overflow-hidden p-7">
      <div class="absolute -right-16 -top-16 h-48 w-48 rounded-full mf-gradient opacity-10 blur-2xl" />
      <div class="relative flex items-start gap-4">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl mf-gradient text-white">
          <MfIcon name="sparkle" :size="22" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="mf-eyebrow mb-2 text-coral-deep">来自 MyFriend 的话</p>
          <div v-if="loadingReview"><MfSpinner label="正在想今天想对你说的话…" /></div>
          <template v-else-if="review">
            <p v-if="review.care" class="mb-3 font-display text-lg font-semibold leading-snug text-ink">
              {{ review.care }}
            </p>
            <MarkdownMessage v-if="review.content" :content="review.content" />
          </template>
          <p v-else class="text-sm text-ink-soft">
            还没有今天的回顾。先去聊几句、记点东西，傍晚我会为你总结一天。
          </p>
        </div>
      </div>
    </section>

    <!-- 概览统计 -->
    <section class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div
        v-for="s in stats()"
        :key="s.key"
        class="mf-card mf-card-hover cursor-default p-5"
      >
        <div
          class="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
          :class="{
            'bg-coral-soft text-coral-deep': s.tint === 'coral',
            'bg-lilac-soft text-lilac': s.tint === 'lilac',
            'bg-sage-soft text-sage': s.tint === 'sage',
          }"
        >
          <MfIcon :name="s.icon" :size="18" />
        </div>
        <p class="font-display text-3xl font-extrabold text-ink">
          {{ (overview?.counts as any)?.[s.key] ?? '—' }}
        </p>
        <p class="text-sm text-ink-soft">{{ s.label }}</p>
      </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- 快捷入口 -->
      <section class="lg:col-span-2">
        <p class="mf-eyebrow mb-3">从哪儿开始</p>
        <div class="grid gap-3 sm:grid-cols-3">
          <button
            v-for="q in quick"
            :key="q.to"
            class="mf-card mf-card-hover group p-5 text-left"
            @click="router.push(q.to)"
          >
            <div
              class="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white transition group-hover:mf-gradient"
            >
              <MfIcon :name="q.icon" :size="20" />
            </div>
            <p class="font-display font-bold text-ink">{{ q.title }}</p>
            <p class="mt-0.5 text-xs text-ink-soft">{{ q.desc }}</p>
          </button>
        </div>

        <button class="mf-btn-soft mt-3 w-full" @click="music.recommend()">
          <MfIcon name="music" :size="18" /> 按我现在的心情推荐一首歌
        </button>
      </section>

      <!-- 最近 -->
      <section>
        <p class="mf-eyebrow mb-3">最近</p>
        <div class="mf-card divide-y divide-line">
          <div
            v-for="(r, i) in overview?.recent?.slice(0, 6) || []"
            :key="i"
            class="flex items-center gap-3 px-4 py-3"
          >
            <span class="h-2 w-2 shrink-0 rounded-full mf-gradient" />
            <p class="min-w-0 flex-1 truncate text-sm text-ink">{{ r.title }}</p>
            <span class="shrink-0 font-mono text-[11px] text-ink-faint">{{ r.type }}</span>
          </div>
          <p v-if="!overview?.recent?.length" class="px-4 py-8 text-center text-sm text-ink-faint">
            还没有动态
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
