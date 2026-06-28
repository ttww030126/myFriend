<script setup lang="ts">
import { onMounted, ref } from 'vue'
import client, { type Wrapped } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

interface ImageItem {
  id: string
  url: string
  thumbnail_url: string | null
  caption: string | null
  tags: { name: string; color: string }[]
  created_at: string
}

const ui = useUiStore()
const images = ref<ImageItem[]>([])
const loading = ref(true)
const fileInput = ref<HTMLInputElement | null>(null)

async function load() {
  loading.value = true
  try {
    const res = await client.get<unknown, Wrapped<{ items: ImageItem[] }>>('/images?page=1&page_size=60')
    images.value = res.data.items
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function onFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files?.length) return
  for (const f of Array.from(files)) {
    const form = new FormData()
    form.append('file', f)
    try {
      await client.post('/images/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      ui.success(`已上传 ${f.name}`)
    } catch (err) {
      ui.error((err as Error).message)
    }
  }
  load()
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl px-8 py-10">
    <PageHeader eyebrow="你的知识" title="图片记忆" desc="上传图片，MyFriend 会自动看懂内容、打上标签，让它们可被搜索">
      <template #actions>
        <button class="mf-btn-primary" @click="fileInput?.click()"><MfIcon name="upload" :size="18" /> 上传图片</button>
        <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onFiles" />
      </template>
    </PageHeader>

    <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      <div v-for="i in 8" :key="i" class="mf-skeleton aspect-square" />
    </div>

    <MfEmpty v-else-if="!images.length" icon="🖼" title="还没有图片" hint="上传一些照片或截图，它们会变成可搜索的记忆">
      <button class="mf-btn-soft mt-4" @click="fileInput?.click()">上传第一张</button>
    </MfEmpty>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      <figure v-for="img in images" :key="img.id" class="mf-card mf-card-hover group overflow-hidden p-0">
        <div class="aspect-square overflow-hidden bg-paper">
          <img :src="img.thumbnail_url || img.url" class="h-full w-full object-cover transition group-hover:scale-105" :alt="img.caption || ''" />
        </div>
        <figcaption v-if="img.caption" class="line-clamp-2 px-3 py-2 text-xs text-ink-soft">{{ img.caption }}</figcaption>
      </figure>
    </div>
  </div>
</template>
