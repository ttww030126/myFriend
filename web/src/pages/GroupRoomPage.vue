<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { groupApi, streamGroupChat, type GroupMember } from '@/api/groups'
import { useUiStore } from '@/stores/ui'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfModal from '@/components/ui/MfModal.vue'
import MarkdownMessage from '@/components/ui/MarkdownMessage.vue'

interface Bubble {
  key: string
  role: 'user' | 'assistant'
  sender_name: string | null
  avatar_url: string | null
  content: string
  streaming?: boolean
}

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const convId = route.params.convId as string

const title = ref((route.query.title as string) || '群聊')
const members = ref<GroupMember[]>([])
const bubbles = ref<Bubble[]>([])
const input = ref('')
const sending = ref(false)
const abort = shallowRef<AbortController | null>(null)
const scroller = ref<HTMLDivElement | null>(null)

// 邀请码弹窗
const showInvite = ref(false)
const joinCode = ref('')

let seq = 0
const nextKey = () => `b${Date.now()}_${seq++}`

function avatarOf(name: string | null): string | null {
  if (!name) return null
  return members.value.find((m) => m.name === name)?.avatar_url ?? null
}

async function scrollToEnd() {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
}

async function load() {
  try {
    const [mem, msgs] = await Promise.all([groupApi.members(convId), groupApi.messages(convId)])
    members.value = mem.data
    bubbles.value = msgs.data
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        key: nextKey(),
        role: m.role as 'user' | 'assistant',
        sender_name: m.sender_name,
        avatar_url: m.role === 'assistant' ? avatarOf(m.sender_name) : null,
        content: m.content,
      }))
    scrollToEnd()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  bubbles.value.push({ key: nextKey(), role: 'user', sender_name: '你', avatar_url: null, content: text })
  scrollToEnd()

  sending.value = true
  abort.value = new AbortController()
  let current: Bubble | null = null
  try {
    await streamGroupChat(
      convId,
      text,
      {
        onMeta: (d) => {
          if (d.title) title.value = d.title
        },
        onSpeakerStart: (d) => {
          bubbles.value.push({ key: nextKey(), role: 'assistant', sender_name: d.name, avatar_url: d.avatar_url, content: '', streaming: true })
          // 取回响应式代理引用，后续 mutate 才能触发视图更新
          current = bubbles.value[bubbles.value.length - 1]
          scrollToEnd()
        },
        onToken: (t) => {
          if (current) {
            current.content += t
            scrollToEnd()
          }
        },
        onSpeakerEnd: () => {
          if (current) current.streaming = false
          current = null
        },
        onError: (msg) => ui.error(msg),
      },
      [],
      abort.value.signal,
    )
  } catch (e) {
    if ((e as Error).name !== 'AbortError') ui.error((e as Error).message)
  } finally {
    if (current) current.streaming = false
    sending.value = false
    abort.value = null
  }
}

function stop() {
  abort.value?.abort()
  sending.value = false
}

async function showInviteCode() {
  try {
    joinCode.value = (await groupApi.invite(convId)).data.join_code
    showInvite.value = true
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function copyInvite() {
  const link = `${window.location.origin}/groups/join/${joinCode.value}`
  try {
    await navigator.clipboard.writeText(link)
    ui.success('邀请链接已复制')
  } catch {
    ui.error('复制失败，请手动复制')
  }
}

async function clearAll() {
  try {
    await groupApi.clearMessages(convId)
    bubbles.value = []
    ui.success('已清空消息')
  } catch (e) {
    ui.error((e as Error).message)
  }
}

onMounted(load)
onBeforeUnmount(() => abort.value?.abort())
</script>

<template>
  <div class="flex h-screen flex-col">
    <!-- 顶栏 -->
    <header class="flex items-center gap-3 border-b border-line bg-surface/80 px-6 py-3 backdrop-blur">
      <button class="text-ink-soft transition hover:text-coral" @click="router.push('/group-chat')">
        <MfIcon name="chat" :size="18" />
      </button>
      <div class="min-w-0 flex-1">
        <p class="truncate font-display font-bold text-ink">{{ title }}</p>
        <div class="mt-0.5 flex items-center gap-1">
          <span v-for="m in members" :key="m.id" class="mf-pill bg-lilac-soft text-lilac">{{ m.name }}</span>
        </div>
      </div>
      <button class="mf-btn-sm mf-btn-ghost" @click="showInviteCode">邀请</button>
      <button class="mf-btn-sm mf-btn-ghost" @click="clearAll">清空</button>
    </header>

    <!-- 消息区 -->
    <div ref="scroller" class="flex-1 overflow-y-auto px-6 py-6">
      <div class="mx-auto max-w-3xl space-y-4">
        <div v-if="!bubbles.length" class="py-20 text-center text-ink-faint">
          发一句话，让 {{ members.map((m) => m.name).join('、') }} 一起接话吧
        </div>
        <div v-for="b in bubbles" :key="b.key" class="flex gap-3" :class="b.role === 'user' ? 'flex-row-reverse' : ''">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
            :class="b.role === 'user' ? 'bg-ink text-white' : 'mf-gradient text-white'"
          >
            <img v-if="b.avatar_url" :src="b.avatar_url" class="h-full w-full object-cover" alt="" />
            <span v-else>{{ b.role === 'user' ? '你' : (b.sender_name || 'AI').slice(0, 1) }}</span>
          </div>
          <div class="max-w-[78%]">
            <p v-if="b.role === 'assistant'" class="mb-1 text-xs font-semibold text-lilac">{{ b.sender_name }}</p>
            <div class="rounded-2xl px-4 py-3" :class="b.role === 'user' ? 'bg-ink text-white' : 'mf-card'">
              <MarkdownMessage v-if="b.role === 'assistant' && b.content" :content="b.content" />
              <p v-else-if="b.role === 'user'" class="whitespace-pre-wrap text-[15px] leading-relaxed">{{ b.content }}</p>
              <span v-if="b.streaming" class="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-lilac align-middle" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="border-t border-line bg-surface/80 px-6 py-4 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          v-model="input"
          rows="1"
          class="mf-input flex-1 resize-none"
          placeholder="说点什么…（用 @角色名 可指定某个角色回复）"
          :disabled="sending"
          @keydown.enter.exact.prevent="send"
        />
        <button v-if="!sending" class="mf-btn-primary shrink-0" :disabled="!input.trim()" @click="send">
          <MfIcon name="send" :size="18" />
        </button>
        <button v-else class="mf-btn-ghost shrink-0" @click="stop">停止</button>
      </div>
    </div>

    <MfModal :open="showInvite" title="邀请好友加入群聊" @close="showInvite = false">
      <p class="mb-3 text-sm text-ink-soft">把下面的邀请码或链接发给朋友，他们就能以真人身份加入这个群聊。</p>
      <div class="mf-card flex items-center justify-between gap-3 p-4">
        <span class="font-mono text-lg font-bold tracking-widest text-ink">{{ joinCode }}</span>
        <button class="mf-btn-sm mf-btn-primary" @click="copyInvite">复制链接</button>
      </div>
      <template #footer>
        <button class="mf-btn-primary" @click="showInvite = false">完成</button>
      </template>
    </MfModal>
  </div>
</template>
