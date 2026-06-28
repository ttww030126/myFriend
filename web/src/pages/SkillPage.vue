<script setup lang="ts">
import { onMounted, ref } from 'vue'
import client, { type Wrapped } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'

interface Skill {
  id: string
  name: string
  emoji: string | null
  description: string | null
  prompt: string
  is_builtin: boolean
}

const ui = useUiStore()
const skills = ref<Skill[]>([])
const loading = ref(true)
const showForm = ref(false)
const form = ref({ name: '', emoji: '✨', description: '', prompt: '' })

async function load() {
  loading.value = true
  try {
    const res = await client.get<unknown, Wrapped<Skill[]>>('/skills')
    skills.value = res.data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!form.value.name.trim() || !form.value.prompt.trim()) return ui.error('请填写名称与人设提示词')
  try {
    await client.post('/skills', form.value)
    ui.success('角色卡已创建')
    showForm.value = false
    form.value = { name: '', emoji: '✨', description: '', prompt: '' }
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function remove(s: Skill) {
  if (s.is_builtin) return
  try {
    await client.delete(`/skills/${s.id}`)
    skills.value = skills.value.filter((x) => x.id !== s.id)
  } catch (e) {
    ui.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <PageHeader eyebrow="设置" title="角色卡 · 技能" desc="为 MyFriend 预设不同的人设与专长，对话时一键切换">
      <template #actions>
        <button class="mf-btn-primary" @click="showForm = true"><MfIcon name="plus" :size="18" /> 新建角色</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="mf-skeleton h-36" />
    </div>

    <MfEmpty v-else-if="!skills.length" icon="🎭" title="还没有角色卡" hint="创建一个，比如「严格的代码审查员」或「温柔的写作教练」">
      <button class="mf-btn-soft mt-4" @click="showForm = true">新建角色</button>
    </MfEmpty>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="s in skills" :key="s.id" class="mf-card mf-card-hover group p-5">
        <div class="mb-3 flex items-start justify-between">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-coral-soft text-xl">{{ s.emoji || '✨' }}</div>
          <button
            v-if="!s.is_builtin"
            class="text-ink-faint opacity-0 transition hover:text-coral group-hover:opacity-100"
            @click="remove(s)"
          >
            <MfIcon name="trash" :size="16" />
          </button>
          <span v-else class="mf-pill bg-ink/5 text-ink-soft">内置</span>
        </div>
        <p class="font-display text-lg font-bold text-ink">{{ s.name }}</p>
        <p class="mt-1 line-clamp-3 text-sm text-ink-soft">{{ s.description || s.prompt }}</p>
      </div>
    </div>

    <MfModal :open="showForm" title="新建角色卡" @close="showForm = false">
      <div class="space-y-4">
        <div class="flex gap-3">
          <div class="w-20">
            <label class="mb-1.5 block text-sm font-medium text-ink">图标</label>
            <input v-model="form.emoji" class="mf-input text-center" maxlength="2" />
          </div>
          <div class="flex-1">
            <label class="mb-1.5 block text-sm font-medium text-ink">名称</label>
            <input v-model="form.name" class="mf-input" placeholder="写作教练" />
          </div>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">简介（可选）</label>
          <input v-model="form.description" class="mf-input" placeholder="一句话说明这个角色擅长什么" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">人设提示词</label>
          <textarea v-model="form.prompt" rows="4" class="mf-input" placeholder="你是一位温柔而严谨的写作教练……" />
        </div>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showForm = false">取消</button>
        <button class="mf-btn-primary" @click="create">创建</button>
      </template>
    </MfModal>
  </div>
</template>
