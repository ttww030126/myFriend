<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { memoryApi, type Insight, type MemoryProfile, type ReviewEntity, type ReviewOverview } from '@/api/memories'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfSpinner from '@/components/ui/MfSpinner.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfModal from '@/components/ui/MfModal.vue'

const ui = useUiStore()
const profile = ref<MemoryProfile | null>(null)
const insights = ref<Insight[]>([])
const loading = ref(true)
const rememberText = ref('')
const saving = ref(false)
const reflecting = ref(false)
const tab = ref<'profile' | 'insights' | 'review'>('profile')

// ── 记忆审查与人类反馈 ──
const reviewOv = ref<ReviewOverview | null>(null)
const reviewList = ref<ReviewEntity[]>([])
const reviewLoading = ref(false)
const maxConf = ref(0.75)
const includeVerified = ref(false)
const editing = ref<ReviewEntity | null>(null)
const editForm = ref({ name: '', type: '', description: '' })

async function loadReview() {
  reviewLoading.value = true
  try {
    const [ov, ents] = await Promise.all([
      memoryApi.reviewOverview(30),
      memoryApi.reviewEntities({ maxConfidence: maxConf.value, includeVerified: includeVerified.value, limit: 100 }),
    ])
    reviewOv.value = ov.data
    reviewList.value = ents.data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    reviewLoading.value = false
  }
}

watch([maxConf, includeVerified], () => {
  if (tab.value === 'review') loadReview()
})
watch(tab, (t) => {
  if (t === 'review' && !reviewOv.value) loadReview()
})

async function confirmEntity(e: ReviewEntity) {
  try {
    await memoryApi.reviewConfirm(e.id)
    e.human_verified = true
    ui.success(`已确认「${e.name}」`)
    if (reviewOv.value) {
      reviewOv.value.verified += 1
      reviewOv.value.pending = Math.max(0, reviewOv.value.pending - 1)
    }
  } catch (err) {
    ui.error((err as Error).message)
  }
}

function startEdit(e: ReviewEntity) {
  editing.value = e
  editForm.value = { name: e.name, type: e.type, description: e.description || '' }
}

async function saveCorrect() {
  if (!editing.value) return
  try {
    await memoryApi.reviewCorrect(editing.value.id, {
      name: editForm.value.name,
      type: editForm.value.type,
      description: editForm.value.description,
    })
    ui.success('已修正并标记为人工确认')
    editing.value = null
    loadReview()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function deleteReview(e: ReviewEntity) {
  try {
    await memoryApi.reviewDelete(e.id, '人工审查删除')
    reviewList.value = reviewList.value.filter((x) => x.id !== e.id)
    ui.success(`已删除「${e.name}」`)
  } catch (err) {
    ui.error((err as Error).message)
  }
}

function confColor(c: number) {
  if (c >= 0.9) return 'bg-sage-soft text-sage'
  if (c >= 0.75) return 'bg-lilac-soft text-lilac'
  if (c >= 0.6) return 'bg-apricot/20 text-apricot'
  return 'bg-coral-soft text-coral-deep'
}

// 萃取/反思都是后台异步任务，单次刷新往往拿不到结果，这里轮询几次
const pollTimer = ref<number | null>(null)

function stopPolling() {
  if (pollTimer.value !== null) {
    window.clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

// 起点 total 作为基准，画像数量变化或达到次数上限就停止
function pollProfile(times = 6, interval = 4000) {
  stopPolling()
  const baseline = profile.value?.total ?? 0
  let count = 0
  pollTimer.value = window.setInterval(async () => {
    count += 1
    await load(true)
    const grew = (profile.value?.total ?? 0) > baseline
    if (grew || count >= times) stopPolling()
  }, interval)
}

async function load(silent = false) {
  if (!silent) loading.value = true
  try {
    const [p, ins] = await Promise.all([memoryApi.profile(), memoryApi.insights()])
    profile.value = p.data
    insights.value = ins.data
  } catch (e) {
    if (!silent) ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function remember() {
  if (!rememberText.value.trim()) return
  saving.value = true
  try {
    await memoryApi.remember(rememberText.value)
    ui.success('好，我记住了 · 正在后台萃取，稍后自动刷新')
    rememberText.value = ''
    pollProfile()
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
onBeforeUnmount(stopPolling)
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
        v-for="t in (['profile', 'insights', 'review'] as const)"
        :key="t"
        class="flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition"
        :class="tab === t ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'"
        @click="tab = t"
      >
        {{ t === 'profile' ? `画像（${profile?.total ?? 0}）` : t === 'insights' ? `洞察（${insights.length}）` : '审查纠错' }}
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
    <template v-else-if="tab === 'insights'">
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

    <!-- 审查纠错 -->
    <template v-else>
      <!-- 记忆全景 KPI -->
      <div v-if="reviewOv" class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="mf-card p-4">
          <p class="mf-eyebrow mb-1">已记住</p>
          <p class="font-display text-2xl font-bold text-ink">{{ reviewOv.total_entities }}</p>
        </div>
        <div class="mf-card p-4">
          <p class="mf-eyebrow mb-1">长期记忆</p>
          <p class="font-display text-2xl font-bold text-lilac">{{ reviewOv.long_term }}</p>
        </div>
        <div class="mf-card p-4">
          <p class="mf-eyebrow mb-1">已确认</p>
          <p class="font-display text-2xl font-bold text-sage">{{ reviewOv.verified }}</p>
        </div>
        <button class="mf-card p-4 text-left transition hover:shadow-lift" @click="maxConf = 0.75">
          <p class="mf-eyebrow mb-1">待确认</p>
          <p class="font-display text-2xl font-bold text-coral">{{ reviewOv.pending }}</p>
        </button>
      </div>

      <!-- 筛选 -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <div class="flex gap-1 rounded-xl bg-ink/5 p-1">
          <button
            v-for="b in [{ v: 0.6, l: '≤60%' }, { v: 0.75, l: '≤75%' }, { v: 0.9, l: '≤90%' }, { v: 1.01, l: '全部' }]"
            :key="b.v"
            class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
            :class="maxConf === b.v ? 'bg-surface text-ink shadow-soft' : 'text-ink-soft'"
            @click="maxConf = b.v"
          >
            {{ b.l }}
          </button>
        </div>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input v-model="includeVerified" type="checkbox" class="accent-coral" /> 含已确认
        </label>
      </div>

      <div v-if="reviewLoading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="mf-skeleton h-24" />
      </div>
      <MfEmpty v-else-if="!reviewList.length" icon="✅" title="没有需要审查的记忆" hint="降低置信度阈值或勾选「含已确认」看看其它实体" />
      <div v-else class="space-y-3">
        <div v-for="e in reviewList" :key="e.id" class="mf-card flex flex-wrap items-start gap-3 p-4">
          <span class="mf-pill" :class="confColor(e.confidence)">{{ Math.round(e.confidence * 100) }}%</span>
          <div class="min-w-0 flex-1">
            <p class="font-display font-bold text-ink">
              {{ e.name }}
              <span class="mf-pill ml-1 bg-lilac-soft text-lilac">{{ e.type }}</span>
              <span v-if="e.memory_layer === 'long_term'" class="mf-pill ml-1 bg-apricot/20 text-apricot">长期</span>
              <span v-if="e.human_verified" class="mf-pill ml-1 bg-sage-soft text-sage">已确认</span>
            </p>
            <p v-if="e.description" class="mt-1 text-sm text-ink-soft">{{ e.description }}</p>
            <div v-if="e.relations?.length" class="mt-1.5 space-y-0.5 text-xs text-ink-faint">
              <p v-for="(r, i) in e.relations.slice(0, 3)" :key="i">
                <span class="text-sage">{{ r.predicate }}</span> → {{ r.object_name }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 gap-2">
            <button v-if="!e.human_verified" class="mf-btn-sm mf-btn-ghost" @click="confirmEntity(e)">确认</button>
            <button class="mf-btn-sm mf-btn-ghost" @click="startEdit(e)">修正</button>
            <button class="text-ink-faint transition hover:text-coral" @click="deleteReview(e)"><MfIcon name="trash" :size="16" /></button>
          </div>
        </div>
      </div>
    </template>

    <!-- 修正弹窗 -->
    <MfModal :open="!!editing" title="修正这条记忆" @close="editing = null">
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">名称</label>
          <input v-model="editForm.name" class="mf-input" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">类型</label>
          <input v-model="editForm.type" class="mf-input" placeholder="人物 / 地点 / 物品 / 概念…" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">描述</label>
          <textarea v-model="editForm.description" rows="3" class="mf-input" />
        </div>
        <p class="text-xs text-ink-faint">修正后会标记为「人工确认」，并在主动召回时获得最高权重。</p>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="editing = null">取消</button>
        <button class="mf-btn-primary" @click="saveCorrect">保存修正</button>
      </template>
    </MfModal>
  </div>
</template>
