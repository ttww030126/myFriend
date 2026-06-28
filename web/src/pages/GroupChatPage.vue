<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { groupApi, type GroupRoom } from '@/api/groups'
import { personaApi, type Persona } from '@/api/personas'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'

const ui = useUiStore()
const router = useRouter()
const rooms = ref<GroupRoom[]>([])
const personas = ref<Persona[]>([])
const loading = ref(true)
const showForm = ref(false)
const creating = ref(false)
const form = ref<{ title: string; member_persona_ids: string[]; enable_tools: boolean }>({
  title: '',
  member_persona_ids: [],
  enable_tools: false,
})

const canCreate = computed(
  () => form.value.title.trim() && form.value.member_persona_ids.length >= 2 && form.value.member_persona_ids.length <= 5,
)

async function load() {
  loading.value = true
  try {
    rooms.value = (await groupApi.list()).data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

function enterRoom(r: GroupRoom) {
  router.push({ name: 'group-room', params: { convId: r.id }, query: { title: r.title || '群聊' } })
}

async function openForm() {
  showForm.value = true
  if (!personas.value.length) {
    try {
      personas.value = (await personaApi.list(true)).data
    } catch (e) {
      ui.error((e as Error).message)
    }
  }
}

function togglePersona(id: string) {
  const arr = form.value.member_persona_ids
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  else if (arr.length < 5) arr.push(id)
  else ui.error('最多选 5 个角色')
}

async function create() {
  if (!canCreate.value) return ui.error('填写群名，并选择 2~5 个角色')
  creating.value = true
  try {
    const room = (await groupApi.create({
      title: form.value.title.trim(),
      member_persona_ids: form.value.member_persona_ids,
      enable_tools: form.value.enable_tools,
    })).data
    ui.success('多智能体群聊已创建')
    showForm.value = false
    form.value = { title: '', member_persona_ids: [], enable_tools: false }
    enterRoom(room)
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-8 py-10">
    <PageHeader eyebrow="陪你" title="多智能体群聊" desc="把不同性格、不同专长的 AI 角色拉进一个房间，让它们替你头脑风暴">
      <template #actions>
        <button class="mf-btn-primary" @click="openForm"><MfIcon name="plus" :size="18" /> 新建群聊</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2">
      <div v-for="i in 4" :key="i" class="mf-skeleton h-32" />
    </div>

    <MfEmpty v-else-if="!rooms.length" icon="💬" title="还没有群聊" hint="创建一个房间，邀请几个 AI 角色一起讨论">
      <button class="mf-btn-soft mt-4" @click="openForm">创建群聊</button>
    </MfEmpty>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <button v-for="r in rooms" :key="r.id" class="mf-card cursor-pointer p-5 text-left transition hover:shadow-lift" @click="enterRoom(r)">
        <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-lilac-soft text-lilac">
          <MfIcon name="group" :size="20" />
        </div>
        <p class="font-display text-lg font-bold text-ink">{{ r.title || '未命名群聊' }}</p>
        <div v-if="r.avatar_members?.length" class="mt-2 flex flex-wrap gap-1.5">
          <span v-for="(m, i) in r.avatar_members" :key="i" class="mf-pill bg-ink/5 text-ink-soft">{{ m.name }}</span>
        </div>
        <p class="mt-3 font-mono text-xs text-ink-faint">{{ r.member_persona_ids?.length || 0 }} 位 AI 成员 · 点击进入</p>
      </button>
    </div>

    <MfModal :open="showForm" title="新建多智能体群聊" width="34rem" @close="showForm = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">群聊名称</label>
          <input v-model="form.title" class="mf-input" placeholder="产品点子局" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">
            选择 2~5 个 AI 角色（已选 {{ form.member_persona_ids.length }}）
          </label>
          <MfEmpty v-if="!personas.length" icon="🎭" title="还没有角色卡" hint="先到「角色」里创建几个人设，再来组群" />
          <div v-else class="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
            <button
              v-for="p in personas"
              :key="p.id"
              type="button"
              class="flex items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition"
              :class="form.member_persona_ids.includes(p.id) ? 'border-coral bg-coral-soft/40 text-ink' : 'border-line text-ink-soft hover:border-coral/40'"
              @click="togglePersona(p.id)"
            >
              <span class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lilac-soft text-lilac">
                <img v-if="p.avatar_url" :src="p.avatar_url" class="h-full w-full object-cover" alt="" />
                <MfIcon v-else name="user" :size="14" />
              </span>
              <span class="truncate">{{ p.name }}</span>
            </button>
          </div>
        </div>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input v-model="form.enable_tools" type="checkbox" class="accent-coral" />
          开启群工具（让角色能查知识库 / 记忆 / 联网，回复更慢但更准）
        </label>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showForm = false">取消</button>
        <button class="mf-btn-primary" :disabled="!canCreate || creating" @click="create">{{ creating ? '创建中…' : '创建' }}</button>
      </template>
    </MfModal>
  </div>
</template>
