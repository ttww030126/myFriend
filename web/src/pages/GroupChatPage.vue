<script setup lang="ts">
import { onMounted, ref } from 'vue'
import client, { type Wrapped } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'

interface GroupRoom {
  id: string
  name: string
  topic: string | null
  member_count: number
  created_at: string
}

const ui = useUiStore()
const rooms = ref<GroupRoom[]>([])
const loading = ref(true)
const showForm = ref(false)
const form = ref({ name: '', topic: '' })

async function load() {
  loading.value = true
  try {
    const res = await client.get<unknown, Wrapped<GroupRoom[]>>('/group-chats')
    rooms.value = res.data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!form.value.name.trim()) return ui.error('给群聊起个名字')
  try {
    await client.post('/group-chats', form.value)
    ui.success('多智能体群聊已创建')
    showForm.value = false
    form.value = { name: '', topic: '' }
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <PageHeader eyebrow="陪你" title="多智能体群聊" desc="把不同性格、不同专长的 AI 角色拉进一个房间，让它们替你头脑风暴">
      <template #actions>
        <button class="mf-btn-primary" @click="showForm = true"><MfIcon name="plus" :size="18" /> 新建群聊</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2">
      <div v-for="i in 4" :key="i" class="mf-skeleton h-32" />
    </div>

    <MfEmpty v-else-if="!rooms.length" icon="💬" title="还没有群聊" hint="创建一个房间，邀请几个 AI 角色一起讨论">
      <button class="mf-btn-soft mt-4" @click="showForm = true">创建群聊</button>
    </MfEmpty>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <div v-for="r in rooms" :key="r.id" class="mf-card mf-card-hover cursor-pointer p-5">
        <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-lilac-soft text-lilac">
          <MfIcon name="group" :size="20" />
        </div>
        <p class="font-display text-lg font-bold text-ink">{{ r.name }}</p>
        <p class="mt-1 line-clamp-2 text-sm text-ink-soft">{{ r.topic || '自由讨论' }}</p>
        <p class="mt-3 font-mono text-xs text-ink-faint">{{ r.member_count }} 位成员</p>
      </div>
    </div>

    <MfModal :open="showForm" title="新建多智能体群聊" @close="showForm = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">群聊名称</label>
          <input v-model="form.name" class="mf-input" placeholder="产品点子局" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">讨论主题（可选）</label>
          <textarea v-model="form.topic" rows="2" class="mf-input" placeholder="这个房间主要聊什么？" />
        </div>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showForm = false">取消</button>
        <button class="mf-btn-primary" @click="create">创建</button>
      </template>
    </MfModal>
  </div>
</template>
