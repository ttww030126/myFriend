<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  notifyApi,
  type ChannelType,
  type NotifyChannel,
  type NotifyChannelCreate,
} from '@/api/notify'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfModal from '@/components/ui/MfModal.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfSpinner from '@/components/ui/MfSpinner.vue'
import MfIcon from '@/components/ui/MfIcon.vue'

interface ChannelMeta {
  label: string
  hint: string
  apply?: string
}

const CHANNEL_META: Record<ChannelType, ChannelMeta> = {
  serverchan: {
    label: 'Server酱（微信推送）',
    hint: '填 SendKey。用 GitHub 登录 Server酱³ 拿到 SendKey，绑定后消息推到你微信/手机 App。',
    apply: 'https://sc3.ft07.com',
  },
  wecom: {
    label: '企业微信群机器人',
    hint: '填群机器人的 Webhook 地址（群设置 → 群机器人 → 添加）。',
  },
  dingtalk: {
    label: '钉钉群机器人',
    hint: '填群机器人的 Webhook 地址（群设置 → 智能群助手 → 添加机器人）。',
  },
  webhook: {
    label: '通用 Webhook',
    hint: '填任意接收 POST JSON 的地址，body 为 {title, content}，由你自行处理。',
  },
}

const CHANNEL_TYPES = Object.keys(CHANNEL_META) as ChannelType[]

const ui = useUiStore()
const list = ref<NotifyChannel[]>([])
const loading = ref(false)
const helpOpen = ref(false)
const testingId = ref<string | null>(null)

const modalOpen = ref(false)
const form = reactive<NotifyChannelCreate>({
  channel_type: 'serverchan',
  name: '',
  target: '',
  enabled: true,
})

async function load() {
  loading.value = true
  try {
    const { data } = await notifyApi.list()
    list.value = data
  } catch {
    /* 忽略 */
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  form.channel_type = 'serverchan'
  form.name = ''
  form.target = ''
  form.enabled = true
  modalOpen.value = true
}

async function submit() {
  if (!form.target.trim()) return ui.error('请填写密钥 / Webhook 地址')
  try {
    await notifyApi.create({
      channel_type: form.channel_type,
      name: (form.name || '').trim(),
      target: form.target.trim(),
      enabled: form.enabled,
    })
    ui.success('已添加')
    modalOpen.value = false
    load()
  } catch (e) {
    ui.error((e as Error).message || '添加失败')
  }
}

async function toggle(ch: NotifyChannel) {
  try {
    await notifyApi.update(ch.id, { enabled: !ch.enabled })
    ch.enabled = !ch.enabled
  } catch {
    ui.error('操作失败')
  }
}

async function test(ch: NotifyChannel) {
  testingId.value = ch.id
  try {
    await notifyApi.test(ch.id)
    ui.success('已发送测试消息，请查收')
  } catch (e) {
    ui.error((e as Error).message || '推送失败')
  } finally {
    testingId.value = null
  }
}

async function remove(ch: NotifyChannel) {
  if (!confirm(`确定删除「${ch.name || CHANNEL_META[ch.channel_type].label}」吗？`)) return
  try {
    await notifyApi.remove(ch.id)
    ui.success('已删除')
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-8 py-10">
    <PageHeader
      eyebrow="设置"
      title="消息推送"
      desc="配置后，定时任务跑完会把报告摘要主动推到你的手机 / 群里。每个渠道配你自己的 key，各推各的。"
    >
      <template #actions>
        <button class="mf-btn-primary" @click="openCreate">
          <MfIcon name="plus" :size="16" /> 添加渠道
        </button>
      </template>
    </PageHeader>

    <!-- 帮助折叠 -->
    <button
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-coral-deep"
      @click="helpOpen = !helpOpen"
    >
      <MfIcon name="sparkle" :size="15" /> 各渠道怎么配？
    </button>
    <div v-if="helpOpen" class="mf-card mb-5 space-y-2 p-5 text-sm leading-relaxed text-ink-soft">
      <p v-for="t in CHANNEL_TYPES" :key="t">
        <b class="text-ink">{{ CHANNEL_META[t].label }}</b
        >：{{ CHANNEL_META[t].hint }}
        <a
          v-if="CHANNEL_META[t].apply"
          :href="CHANNEL_META[t].apply"
          target="_blank"
          rel="noreferrer"
          class="text-coral-deep underline underline-offset-2"
        >
          前往申请 →</a
        >
      </p>
    </div>

    <div v-if="loading" class="flex justify-center py-16"><MfSpinner /></div>
    <MfEmpty
      v-else-if="list.length === 0"
      icon="🔔"
      title="还没有推送渠道"
      hint="添加一个，让 AI 跑完任务主动通知你"
    >
      <button class="mf-btn-primary mt-5" @click="openCreate">
        <MfIcon name="plus" :size="16" /> 添加渠道
      </button>
    </MfEmpty>

    <div v-else class="space-y-3">
      <div v-for="ch in list" :key="ch.id" class="mf-card flex flex-wrap items-center gap-3 p-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold text-ink">{{ ch.name || CHANNEL_META[ch.channel_type].label }}</span>
            <span class="mf-pill bg-lilac-soft text-lilac">{{ CHANNEL_META[ch.channel_type].label }}</span>
          </div>
          <p class="mt-0.5 font-mono text-xs text-ink-faint">密钥 {{ ch.target_mask }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="relative h-6 w-11 rounded-full transition"
            :class="ch.enabled ? 'bg-coral' : 'bg-ink/15'"
            @click="toggle(ch)"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
              :class="ch.enabled ? 'left-[22px]' : 'left-0.5'"
            />
          </button>
          <button class="mf-btn-outline mf-btn-sm" :disabled="testingId === ch.id" @click="test(ch)">
            {{ testingId === ch.id ? '发送中…' : '测试' }}
          </button>
          <button
            class="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-coral-soft hover:text-coral-deep"
            @click="remove(ch)"
          >
            <MfIcon name="trash" :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- 添加渠道弹窗 -->
    <MfModal :open="modalOpen" title="添加推送渠道" @close="modalOpen = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-soft">渠道类型</label>
          <select v-model="form.channel_type" class="mf-input">
            <option v-for="t in CHANNEL_TYPES" :key="t" :value="t">{{ CHANNEL_META[t].label }}</option>
          </select>
          <p class="mt-1.5 text-xs leading-relaxed text-ink-faint">
            {{ CHANNEL_META[form.channel_type].hint }}
            <a
              v-if="CHANNEL_META[form.channel_type].apply"
              :href="CHANNEL_META[form.channel_type].apply"
              target="_blank"
              rel="noreferrer"
              class="text-coral-deep underline underline-offset-2"
            >
              前往申请 →</a
            >
          </p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-soft">备注名（可选）</label>
          <input v-model="form.name" class="mf-input" placeholder="例如：我的微信" maxlength="64" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink-soft">
            {{ form.channel_type === 'serverchan' ? 'SendKey' : 'Webhook 地址' }}
          </label>
          <textarea
            v-model="form.target"
            class="mf-input"
            rows="2"
            :placeholder="form.channel_type === 'serverchan' ? 'SCT... 或 sctp...' : 'https://...'"
          />
        </div>
        <label class="flex items-center gap-2 text-sm text-ink-soft">
          <input v-model="form.enabled" type="checkbox" class="h-4 w-4 accent-coral" /> 立即启用
        </label>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="modalOpen = false">取消</button>
        <button class="mf-btn-primary" @click="submit">保存</button>
      </template>
    </MfModal>
  </div>
</template>
