<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { memoryApi, type Insight, type MemoryProfile } from '@/api/memories'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfSpinner from '@/components/ui/MfSpinner.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

const ui = useUiStore()
const profile = ref<MemoryProfile | null>(null)
const insights = ref<Insight[]>([])
const loading = ref(true)
const rememberText = ref('')
const saving = ref(false)
const reflecting = ref(false)
const tab = ref<'profile' | 'insights'>('profile')

async function load() {
  loading.value = true
  try {
    const [p, ins] = await Promise.all([memoryApi.profile(), memoryApi.insights()])
    profile.value = p.data
    insights.value = ins.data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function remember() {
  if (!rememberText.value.trim()) return
  saving.value = true
  try {
    await memoryApi.remember(rememberText.value)
    ui.success('好，我记住了 · 正在后台萃取')
    rememberText.value = ''
    setTimeout(load, 1500)
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

async function reflect() {
  reflecting.value = true
  try {
    const { data } = await memoryApi.reflect()
    ui.success(`新增 ${data.insights} 条洞察`)
    load()
    tab.value = 'insights'
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    reflecting.value = false
  }
}

async function delEntity(id: string) {
  try {
    await memoryApi.deleteEntity(id)
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl px-8 py-10">
    <PageHeader eyebrow="你的记忆" title="记忆" desc="MyFriend 眼中的你——从对话里萃取，越聊越懂">
      <template #actions>
        <button class="mf-btn-outline" :disabled="reflecting" @click="reflect">
          <MfSpinner v-if="reflecting" :size="16" />
          <MfIcon v-else name="sparkle" :size="16" /> 反思一下
        </button>
      </template>
    </PageHeader>

    <!-- 主动记住 -->
    <section class="mf-card mb-6 p-5">
      <p class="mf-eyebrow mb-2 text-sage">告诉我一件关于你的事</p>
      <div class="flex items-end gap-2">
        <textarea
          v-model="rememberText"
          rows="2"
          class="mf-input flex-1"
          placeholder="例如：我在准备考研，喜欢深夜写代码，养了一只叫芝麻的猫…"
          @keydown.enter.exact.prevent="remember"
        />
        <button class="mf-btn-primary shrink-0" :disabled="saving || !rememberText.trim()" @click="remember">
          <MfSpinner v-if="saving" :size="16" />
          <span v-else>记住</span>
        </button>
      </div>
    </section>

    <!-- 标签页 -->
    <div class="mb-5 flex gap-1 rounded-xl bg-ink/5 p-1">
      <button
        v-for="t in (['profile', 'insights'] as const)"
        :key="t"
        class="flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition"
        :class="tab === t ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'"
        @click="tab = t"
      >
        {{ t === 'profile' ? `画像（${profile?.total ?? 0}）` : `洞察（${insights.length}）` }}
      </button>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="mf-skeleton h-28" />
    </div>

    <!-- 画像分组 -->
    <template v-else-if="tab === 'profile'">
      <MfEmpty v-if="!profile?.groups?.length" icon="🧠" title="记忆还是空白" hint="先记点东西，或多聊几句" />
      <div v-else class="space-y-6">
        <section v-for="g in profile.groups" :key="g.type">
          <p class="mf-eyebrow mb-3">{{ g.type }} · {{ g.entities.length }}</p>
          <div class="grid gap-3 sm:grid-cols-2">
            <div v-for="e in g.entities" :key="e.id" class="mf-card group p-4">
              <div class="flex items-start justify-between">
                <p class="font-display font-bold text-ink">{{ e.name }}</p>
                <button
                  class="opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
                  @click="delEntity(e.id)"
                >
                  <MfIcon name="trash" :size="14" />
                </button>
              </div>
              <p v-if="e.description" class="mt-1 text-sm text-ink-soft">{{ e.description }}</p>
              <div v-if="e.traits?.length" class="mt-2.5 flex flex-wrap gap-1.5">
                <span v-for="t in e.traits" :key="t" class="mf-pill bg-lilac-soft text-lilac">{{ t }}</span>
              </div>
              <div v-if="e.relations?.length" class="mt-2 space-y-1 text-xs text-ink-faint">
                <p v-for="(r, i) in e.relations.slice(0, 3)" :key="i">
                  <span class="text-sage">{{ r.predicate }}</span> → {{ r.object_name }}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- 洞察 -->
    <template v-else>
      <MfEmpty v-if="!insights.length" icon="✨" title="还没有洞察" hint="点右上角「反思一下」，让 AI 归纳关于你的洞察" />
      <div v-else class="space-y-3">
        <div v-for="ins in insights" :key="ins.id" class="mf-card p-5">
          <div class="flex items-center justify-between">
            <span class="mf-pill bg-coral-soft text-coral-deep">{{ ins.theme }}</span>
            <span class="font-mono text-xs text-ink-faint">置信 {{ Math.round(ins.confidence * 100) }}%</span>
          </div>
          <p class="mt-2.5 leading-relaxed text-ink">{{ ins.content }}</p>
        </div>
      </div>
    </template>
  </div>
</template>
