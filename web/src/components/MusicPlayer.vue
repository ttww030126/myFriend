<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import MfIcon from '@/components/ui/MfIcon.vue'

const music = useMusicStore()
const audio = ref<HTMLAudioElement | null>(null)

// 同步 store.playing → audio
watch(
  () => music.playing,
  (p) => {
    if (!audio.value) return
    if (p) audio.value.play().catch(() => music.setPlaying(false))
    else audio.value.pause()
  },
)
// 切歌时重新加载并播放
watch(
  () => music.track?.url,
  async (url) => {
    if (!audio.value || !url) return
    audio.value.src = url
    if (music.playing) audio.value.play().catch(() => {})
  },
)

onMounted(() => {
  if (audio.value && music.track?.url) audio.value.src = music.track.url
})
</script>

<template>
  <div class="fixed bottom-4 right-4 z-40 w-80 overflow-hidden rounded-2xl bg-ink text-white shadow-lift animate-fade-up">
    <audio ref="audio" @ended="music.next()" />

    <div class="flex items-center gap-3 p-3">
      <div
        class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl mf-gradient"
      >
        <img v-if="music.track?.coverUrl" :src="music.track.coverUrl" class="h-full w-full object-cover" />
        <MfIcon v-else name="music" :size="22" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold">{{ music.track?.title || '未在播放' }}</p>
        <p class="truncate text-xs text-white/50">{{ music.track?.artist || '—' }}</p>
      </div>
      <button class="rounded-lg p-1.5 text-white/60 hover:text-white" @click="music.close()">✕</button>
    </div>

    <div v-if="music.recommendReason" class="border-t border-white/10 px-3 py-2 text-xs text-white/60">
      <span class="mf-gradient-text font-semibold">为你挑的 · </span>{{ music.recommendReason }}
    </div>

    <div class="flex items-center justify-center gap-6 border-t border-white/10 py-2.5">
      <button class="text-white/70 hover:text-white" @click="music.prev()">⏮</button>
      <button
        class="flex h-10 w-10 items-center justify-center rounded-full mf-gradient text-lg shadow-coral"
        @click="music.setPlaying(!music.playing)"
      >
        <span v-if="music.resolving" class="animate-spin">◌</span>
        <span v-else>{{ music.playing ? '⏸' : '▶' }}</span>
      </button>
      <button class="text-white/70 hover:text-white" @click="music.next()">⏭</button>
    </div>
  </div>
</template>
