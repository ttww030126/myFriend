<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { musicApi, type Song } from '@/api/music'
import { useMusicStore } from '@/stores/music'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

const player = useMusicStore()
const ui = useUiStore()
const songs = ref<Song[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    songs.value = (await musicApi.listSongs()).data.items
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

function playAt(i: number) {
  player.playList(songs.value, i)
}

async function recommend() {
  try {
    await player.recommend()
    if (player.recommendReason) ui.success(player.recommendReason)
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function remove(s: Song, e: Event) {
  e.stopPropagation()
  try {
    await musicApi.removeSong(s.id)
    songs.value = songs.value.filter((x) => x.id !== s.id)
  } catch (err) {
    ui.error((err as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <PageHeader eyebrow="一起探索" title="心情电台" desc="把此刻的情绪交给 MyFriend，它会挑一首懂你的歌">
      <template #actions>
        <button class="mf-btn-primary" :disabled="player.loading" @click="recommend">
          <MfIcon name="sparkle" :size="18" /> {{ player.loading ? '聆听你的情绪…' : '按心情推荐' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 8" :key="i" class="mf-skeleton h-16" />
    </div>

    <MfEmpty v-else-if="!songs.length" icon="🎧" title="曲库还是空的" hint="先去后台导入一些音乐，或直接点上方按钮让我现挑一首" />

    <div v-else class="mf-card divide-y divide-line/70 overflow-hidden p-0">
      <div
        v-for="(s, i) in songs"
        :key="s.id"
        class="group flex cursor-pointer items-center gap-4 px-5 py-3.5 transition hover:bg-coral-soft/40"
        :class="{ 'bg-coral-soft/60': player.track?.id === s.id }"
        @click="playAt(i)"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-coral to-apricot text-white">
          <MfIcon name="music" :size="18" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-ink">{{ s.title }}</p>
          <p class="truncate text-sm text-ink-soft">{{ s.artist }}<span v-if="s.album"> · {{ s.album }}</span></p>
        </div>
        <div class="hidden gap-1.5 sm:flex">
          <span v-for="t in s.mood_tags.slice(0, 2)" :key="t" class="mf-pill bg-lilac-soft text-lilac">{{ t }}</span>
        </div>
        <span v-if="!s.playable" class="mf-pill bg-ink/5 text-ink-faint">需解析</span>
        <button class="text-ink-faint opacity-0 transition hover:text-coral group-hover:opacity-100" @click="remove(s, $event)">
          <MfIcon name="trash" :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>
