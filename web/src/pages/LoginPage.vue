<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import MfLogo from '@/components/ui/MfLogo.vue'
import MfSpinner from '@/components/ui/MfSpinner.vue'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const loading = ref(false)

async function submit() {
  if (!username.value || !password.value) {
    ui.error('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    if (mode.value === 'register') {
      await auth.register(username.value, password.value)
      ui.success('注册成功，正在登录…')
    }
    await auth.login(username.value, password.value)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen">
    <!-- 左：品牌叙事 -->
    <section class="relative hidden flex-1 overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between">
      <div class="absolute -right-24 -top-24 h-96 w-96 rounded-full mf-gradient opacity-30 blur-3xl" />
      <div class="absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-lilac opacity-25 blur-3xl" />

      <div class="relative z-10 p-12">
        <MfLogo :size="40" :wordmark="false" />
      </div>

      <div class="relative z-10 max-w-lg p-12">
        <p class="mf-eyebrow mb-4 text-white/50">你的个人 AI · 知己</p>
        <h1 class="font-display text-5xl font-extrabold leading-tight text-white">
          一个<span class="mf-gradient-text">真正记得你</span>的 AI 朋友
        </h1>
        <p class="mt-5 text-lg leading-relaxed text-white/60">
          把文档、图片、网页沉淀成你的知识库；从每次对话里记住你是谁。MyFriend 自己编排
          知识、记忆与联网，懂你所想，答你所问。
        </p>
        <div class="mt-8 flex flex-wrap gap-2.5">
          <span class="mf-pill bg-white/10 text-white/80">📚 知识库 RAG</span>
          <span class="mf-pill bg-white/10 text-white/80">🧠 记忆图谱</span>
          <span class="mf-pill bg-white/10 text-white/80">🎵 情绪音乐</span>
          <span class="mf-pill bg-white/10 text-white/80">👥 多角色群聊</span>
        </div>
      </div>

      <div class="relative z-10 p-12 font-mono text-xs text-white/30">MyFriend · 懂你 · 陪你 · 帮你</div>
    </section>

    <!-- 右：表单 -->
    <section class="flex flex-1 items-center justify-center px-6 py-12">
      <div class="w-full max-w-sm">
        <div class="mb-8 lg:hidden"><MfLogo :size="36" /></div>

        <h2 class="font-display text-2xl font-extrabold text-ink">
          {{ mode === 'login' ? '欢迎回来' : '认识一下' }}
        </h2>
        <p class="mt-1.5 text-sm text-ink-soft">
          {{ mode === 'login' ? '继续和你的 AI 朋友聊聊吧' : '创建账号，开始让它了解你' }}
        </p>

        <div class="mt-8 space-y-4">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">用户名</label>
            <input v-model="username" class="mf-input" placeholder="给自己起个名字" @keyup.enter="submit" />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-ink">密码</label>
            <input
              v-model="password"
              type="password"
              class="mf-input"
              placeholder="至少 6 位"
              @keyup.enter="submit"
            />
          </div>

          <button class="mf-btn-primary w-full" :disabled="loading" @click="submit">
            <MfSpinner v-if="loading" :size="18" />
            <span v-else>{{ mode === 'login' ? '进入' : '注册并进入' }}</span>
          </button>
        </div>

        <p class="mt-6 text-center text-sm text-ink-soft">
          {{ mode === 'login' ? '还没有账号？' : '已经有账号了？' }}
          <button
            class="font-semibold text-coral-deep hover:underline"
            @click="mode = mode === 'login' ? 'register' : 'login'"
          >
            {{ mode === 'login' ? '注册一个' : '去登录' }}
          </button>
        </p>
      </div>
    </section>
  </div>
</template>
