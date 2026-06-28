<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import {
  chatApi,
  streamChat,
  type ChatMessage,
  type Conversation,
  type ToolRun,
} from '@/api/chat'
import { useUiStore } from '@/stores/ui'
import MarkdownMessage from '@/components/ui/MarkdownMessage.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

const ui = useUiStore()

const conversations = ref<Conversation[]>([])
const activeId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const input = ref('')
const streaming = ref(false)
const streamText = ref('')
const toolRuns = ref<ToolRun[]>([])
const scroller = ref<HTMLElement | null>(null)
let abort: AbortController | null = null

// 工具开关
const tools = ref({ knowledge: true, memory: true, web: false })

const toolLabel: Record<string, string> = {
  knowledge_search: '查知识库',
  memory_search: '翻记忆',
  web_search: '联网搜',
}

async function loadConversations() {
  try {
    conversations.value = (await chatApi.listConversations()).data
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function openConversation(id: string) {
  activeId.value = id
  streamText.value = ''
  toolRuns.value = []
  try {
    messages.value = (await chatApi.listMessages(id)).data
    await scrollToBottom()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

function newConversation() {
  activeId.value = null
  messages.value = []
  streamText.value = ''
  toolRuns.value = []
}

async function scrollToBottom() {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

async function send() {
  const text = input.value.trim()
  if (!text || streaming.value) return
  input.value = ''
  messages.value.push({
    id: 'local-' + Date.now(),
    role: 'user',
    content: text,
    meta_data: null,
    created_at: new Date().toISOString(),
  })
  streaming.value = true
  streamText.value = ''
  toolRuns.value = []
  await scrollToBottom()

  abort = new AbortController()
  await streamChat(
    {
      conversationId: activeId.value ?? undefined,
      message: text,
      enableKnowledge: tools.value.knowledge,
      enableMemory: tools.value.memory,
      enableWebSearch: tools.value.web,
    },
    {
      onMeta: (d) => {
        if (!activeId.value) {
          activeId.value = d.conversation_id
          loadConversations()
        }
      },
      onToken: (t) => {
        streamText.value += t
        scrollToBottom()
      },
      onToolStart: (d) => {
        toolRuns.value.push({ id: 't' + Date.now() + Math.random(), tool: d.tool, query: d.query, status: 'running' })
      },
      onToolResult: (d) => {
        const run = [...toolRuns.value].reverse().find((r) => r.tool === d.tool && r.status === 'running')
        if (run) {
          run.status = (d.status as ToolRun['status']) || 'success'
          run.stats = d.stats
        }
      },
      onDone: () => {
        if (streamText.value) {
          messages.value.push({
            id: 'a-' + Date.now(),
            role: 'assistant',
            content: streamText.value,
            meta_data: null,
            created_at: new Date().toISOString(),
          })
        }
        streamText.value = ''
        streaming.value = false
        scrollToBottom()
      },
      onError: (m) => {
        ui.error(m)
        streaming.value = false
      },
    },
    abort.signal,
  )
}

function stop() {
  abort?.abort()
  streaming.value = false
}

async function removeConversation(id: string, e: Event) {
  e.stopPropagation()
  try {
    await chatApi.deleteConversation(id)
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (activeId.value === id) newConversation()
  } catch (err) {
    ui.error((err as Error).message)
  }
}

onMounted(loadConversations)
</script>

<template>
  <div class="flex h-screen">
    <!-- 会话列表 -->
    <div class="flex w-72 shrink-0 flex-col border-r border-line bg-surface/60">
      <div class="p-4">
        <button class="mf-btn-primary w-full" @click="newConversation">
          <MfIcon name="plus" :size="18" /> 新对话
        </button>
      </div>
      <div class="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <button
          v-for="c in conversations"
          :key="c.id"
          class="group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition"
          :class="activeId === c.id ? 'bg-coral-soft text-coral-deep' : 'text-ink-soft hover:bg-ink/5'"
          @click="openConversation(c.id)"
        >
          <MfIcon name="chat" :size="16" class="shrink-0 opacity-70" />
          <span class="min-w-0 flex-1 truncate font-medium">{{ c.title }}</span>
          <span
            class="shrink-0 opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
            @click="removeConversation(c.id, $event)"
          >
            <MfIcon name="trash" :size="14" />
          </span>
        </button>
        <p v-if="!conversations.length" class="px-3 py-6 text-center text-xs text-ink-faint">
          还没有对话，开始第一句吧
        </p>
      </div>
    </div>

    <!-- 消息区 -->
    <div class="flex flex-1 flex-col">
      <div ref="scroller" class="flex-1 overflow-y-auto px-6 py-8">
        <div class="mx-auto max-w-3xl space-y-6">
          <MfEmpty
            v-if="!messages.length && !streaming"
            icon="💬"
            title="说点什么吧"
            hint="我会一边听你说，一边记住你。需要时还会自己去翻知识库、回忆过往、联网查证。"
          />

          <div v-for="m in messages" :key="m.id" class="flex gap-3" :class="m.role === 'user' ? 'flex-row-reverse' : ''">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              :class="m.role === 'user' ? 'bg-ink text-white' : 'mf-gradient text-white'"
            >
              {{ m.role === 'user' ? '你' : 'M' }}
            </div>
            <div
              class="max-w-[80%] rounded-2xl px-4 py-3"
              :class="m.role === 'user' ? 'bg-ink text-white' : 'mf-card'"
            >
              <MarkdownMessage v-if="m.role === 'assistant'" :content="m.content" />
              <p v-else class="whitespace-pre-wrap text-[15px] leading-relaxed">{{ m.content }}</p>
            </div>
          </div>

          <!-- 流式气泡 -->
          <div v-if="streaming" class="flex gap-3">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mf-gradient text-sm font-bold text-white">
              M
            </div>
            <div class="max-w-[80%] space-y-2">
              <!-- 工具调用 -->
              <div v-if="toolRuns.length" class="flex flex-wrap gap-2">
                <span
                  v-for="r in toolRuns"
                  :key="r.id"
                  class="mf-pill"
                  :class="r.status === 'running' ? 'bg-lilac-soft text-lilac' : 'bg-sage-soft text-sage'"
                >
                  <span :class="r.status === 'running' ? 'animate-spin' : ''">{{ r.status === 'running' ? '◌' : '✓' }}</span>
                  {{ toolLabel[r.tool] || r.tool }}
                  <span class="opacity-60">{{ r.query }}</span>
                </span>
              </div>
              <div class="mf-card px-4 py-3">
                <MarkdownMessage v-if="streamText" :content="streamText" />
                <span v-else class="inline-flex gap-1">
                  <span class="h-2 w-2 animate-breathe rounded-full bg-coral" />
                  <span class="h-2 w-2 animate-breathe rounded-full bg-apricot" style="animation-delay: 0.3s" />
                  <span class="h-2 w-2 animate-breathe rounded-full bg-lilac" style="animation-delay: 0.6s" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="border-t border-line bg-surface px-6 py-4">
        <div class="mx-auto max-w-3xl">
          <div class="mb-2 flex gap-2">
            <button
              v-for="(on, key) in tools"
              :key="key"
              class="mf-pill border transition"
              :class="on ? 'border-coral/40 bg-coral-soft text-coral-deep' : 'border-line text-ink-faint'"
              @click="tools[key] = !tools[key]"
            >
              {{ key === 'knowledge' ? '📚 知识库' : key === 'memory' ? '🧠 记忆' : '🌐 联网' }}
            </button>
          </div>
          <div class="flex items-end gap-2 rounded-2xl border border-line bg-bg p-2 focus-within:border-coral/50">
            <textarea
              v-model="input"
              rows="1"
              placeholder="和 MyFriend 说点什么…（Enter 发送，Shift+Enter 换行）"
              class="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-ink outline-none placeholder:text-ink-faint"
              @keydown.enter.exact.prevent="send"
            />
            <button v-if="streaming" class="mf-btn-outline mf-btn-sm" @click="stop">停止</button>
            <button v-else class="mf-btn-primary mf-btn-sm !px-3" :disabled="!input.trim()" @click="send">
              <MfIcon name="send" :size="18" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
