<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMusicStore } from '@/stores/music'
import MfLogo from '@/components/ui/MfLogo.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MusicPlayer from '@/components/MusicPlayer.vue'

const router = useRouter()
const auth = useAuthStore()
const music = useMusicStore()
const menuOpen = ref(false)

// 导航分组——按"陪你 / 你的知识 / 你的记忆 / 一起探索 / 设置"组织
const groups = [
  {
    label: '陪你',
    items: [
      { to: '/', icon: 'home', label: '今日', exact: true },
      { to: '/chat', icon: 'chat', label: '对话' },
      { to: '/group-chat', icon: 'group', label: '群聊' },
      { to: '/settings/agent', icon: 'user', label: '角色' },
    ],
  },
  {
    label: '你的知识',
    items: [
      { to: '/knowledge', icon: 'book', label: '知识库' },
      { to: '/images', icon: 'image', label: '图片' },
      { to: '/search', icon: 'search', label: '搜索' },
    ],
  },
  {
    label: '你的记忆',
    items: [
      { to: '/memory', icon: 'memory', label: '记忆' },
      { to: '/graph', icon: 'graph', label: '图谱' },
    ],
  },
  {
    label: '一起探索',
    items: [
      { to: '/research', icon: 'research', label: '深度研究' },
      { to: '/agent-tasks', icon: 'task', label: '任务' },
      { to: '/music', icon: 'music', label: '音乐' },
      { to: '/favorites', icon: 'star', label: '收藏' },
      { to: '/traces', icon: 'trace', label: '执行轨迹' },
    ],
  },
  {
    label: '设置',
    items: [
      { to: '/settings/models', icon: 'model', label: '模型' },
      { to: '/settings/skills', icon: 'skill', label: '技能' },
      { to: '/settings/tools', icon: 'tool', label: '工具' },
      { to: '/settings/mcp', icon: 'graph', label: 'MCP' },
      { to: '/settings/notify', icon: 'bell', label: '推送' },
    ],
  },
]

onMounted(() => auth.fetchUser())

async function onLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- 侧栏 -->
    <aside class="flex w-64 shrink-0 flex-col bg-ink text-white">
      <div class="px-5 pb-3 pt-6">
        <MfLogo :size="34" />
      </div>

      <nav class="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        <div v-for="g in groups" :key="g.label">
          <p class="px-3.5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
            {{ g.label }}
          </p>
          <RouterLink
            v-for="it in g.items"
            :key="it.to"
            :to="it.to"
            class="mf-nav-item"
            :class="{ 'is-active': it.exact ? $route.path === '/' : $route.path.startsWith(it.to) && it.to !== '/' }"
          >
            <MfIcon :name="it.icon" :size="18" class="shrink-0 opacity-90" />
            {{ it.label }}
          </RouterLink>
        </div>
      </nav>

      <!-- 用户区 -->
      <div class="relative border-t border-white/10 p-3">
        <button
          class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/5"
          @click="menuOpen = !menuOpen"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full mf-gradient font-display text-sm font-bold text-white"
          >
            {{ (auth.displayName || 'M')[0].toUpperCase() }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-white">{{ auth.displayName }}</span>
            <span class="block truncate text-xs text-white/45">已陪伴 · 在线</span>
          </span>
        </button>

        <Transition name="fade">
          <div
            v-if="menuOpen"
            class="absolute inset-x-3 bottom-[68px] overflow-hidden rounded-xl bg-surface text-ink shadow-lift"
          >
            <RouterLink
              to="/profile"
              class="flex items-center gap-2.5 px-4 py-3 text-sm transition hover:bg-ink/5"
              @click="menuOpen = false"
            >
              <MfIcon name="user" :size="16" /> 个人资料
            </RouterLink>
            <button
              class="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-coral-deep transition hover:bg-coral-soft"
              @click="onLogout"
            >
              <MfIcon name="logout" :size="16" /> 退出登录
            </button>
          </div>
        </Transition>
      </div>
    </aside>

    <!-- 主区 -->
    <main class="relative flex-1 overflow-y-auto">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <!-- 全局音乐播放器 -->
    <MusicPlayer v-if="music.visible" />
  </div>
</template>
