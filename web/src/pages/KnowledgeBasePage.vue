<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { knowledgeBaseApi, type KnowledgeBase } from '@/api/knowledgeBases'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfModal from '@/components/ui/MfModal.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'

const router = useRouter()
const ui = useUiStore()
const bases = ref<KnowledgeBase[]>([])
const loading = ref(true)
const showCreate = ref(false)
const form = ref({ name: '', description: '' })

const tints = ['coral', 'lilac', 'sage']

async function load() {
  loading.value = true
  try {
    bases.value = (await knowledgeBaseApi.list()).data
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!form.value.name.trim()) return ui.error('给知识库起个名字')
  try {
    await knowledgeBaseApi.create({ name: form.value.name, description: form.value.description })
    ui.success('知识库已创建')
    showCreate.value = false
    form.value = { name: '', description: '' }
    load()
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function toggleChat(kb: KnowledgeBase, e: Event) {
  e.stopPropagation()
  try {
    await knowledgeBaseApi.setChatEnabled(kb.id, !kb.chat_enabled)
    kb.chat_enabled = !kb.chat_enabled
  } catch (err) {
    ui.error((err as Error).message)
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl px-8 py-10">
    <PageHeader eyebrow="你的知识" title="知识库" desc="把资料分门别类地存好，让 MyFriend 答题时有据可依">
      <template #actions>
        <button class="mf-btn-primary" @click="showCreate = true">
          <MfIcon name="plus" :size="18" /> 新建知识库
        </button>
      </template>
    </PageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="mf-skeleton h-40" />
    </div>

    <MfEmpty v-else-if="!bases.length" icon="📚" title="还没有知识库" hint="新建一个，把文档喂进去试试">
      <button class="mf-btn-soft mt-4" @click="showCreate = true">新建知识库</button>
    </MfEmpty>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="(kb, i) in bases"
        :key="kb.id"
        class="mf-card mf-card-hover cursor-pointer p-5"
        @click="router.push(`/knowledge-bases/${kb.id}`)"
      >
        <div class="mb-4 flex items-start justify-between">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-2xl text-xl"
            :class="{
              'bg-coral-soft': tints[i % 3] === 'coral',
              'bg-lilac-soft': tints[i % 3] === 'lilac',
              'bg-sage-soft': tints[i % 3] === 'sage',
            }"
          >
            {{ kb.icon || '📁' }}
          </div>
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft" @click.stop>
            <input type="checkbox" :checked="kb.chat_enabled" class="accent-coral" @change="toggleChat(kb, $event)" />
            对话可用
          </label>
        </div>
        <p class="font-display text-lg font-bold text-ink">
          {{ kb.name }}
          <span v-if="kb.is_default" class="mf-pill ml-1 bg-ink/5 text-ink-soft">默认</span>
        </p>
        <p class="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-ink-soft">
          {{ kb.description || '暂无描述' }}
        </p>
        <div class="mt-4 flex gap-4 font-mono text-xs text-ink-faint">
          <span>📄 {{ kb.doc_count }} 文档</span>
          <span>🖼 {{ kb.image_count }} 图片</span>
        </div>
      </div>
    </div>

    <MfModal :open="showCreate" title="新建知识库" @close="showCreate = false">
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">名称</label>
          <input v-model="form.name" class="mf-input" placeholder="比如：读书笔记 / 工作资料" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-ink">描述（可选）</label>
          <textarea v-model="form.description" rows="3" class="mf-input" placeholder="这个库装些什么？" />
        </div>
      </div>
      <template #footer>
        <button class="mf-btn-ghost" @click="showCreate = false">取消</button>
        <button class="mf-btn-primary" @click="create">创建</button>
      </template>
    </MfModal>
  </div>
</template>
