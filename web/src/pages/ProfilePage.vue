<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfIcon from '@/components/ui/MfIcon.vue'

const auth = useAuthStore()
const ui = useUiStore()

const nickname = ref('')
const pwd = ref({ old: '', next: '' })
const avatarInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  if (!auth.user) await auth.fetchUser()
  nickname.value = auth.user?.nickname || ''
})

async function saveNickname() {
  if (!nickname.value.trim()) return ui.error('昵称不能为空')
  try {
    const { data } = await authApi.updateProfile(nickname.value.trim())
    auth.user = data
    ui.success('昵称已更新')
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function changePassword() {
  if (!pwd.value.old || !pwd.value.next) return ui.error('请填写完整')
  try {
    await authApi.changePassword(pwd.value.old, pwd.value.next)
    pwd.value = { old: '', next: '' }
    ui.success('密码已修改')
  } catch (e) {
    ui.error((e as Error).message)
  }
}

async function onAvatar(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const { data } = await authApi.uploadAvatar(file)
    auth.user = data
    ui.success('头像已更新')
  } catch (err) {
    ui.error((err as Error).message)
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-8 py-10">
    <PageHeader eyebrow="设置" title="个人资料" desc="让 MyFriend 更认识你" />

    <div class="mf-card mb-6 flex items-center gap-5 p-6">
      <div class="relative">
        <div class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-coral to-apricot text-2xl font-bold text-white">
          <img v-if="auth.user?.avatar" :src="auth.user.avatar" class="h-full w-full object-cover" alt="" />
          <span v-else>{{ auth.displayName.charAt(0).toUpperCase() }}</span>
        </div>
        <button
          class="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-paper shadow-lift"
          @click="avatarInput?.click()"
        >
          <MfIcon name="upload" :size="13" />
        </button>
        <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatar" />
      </div>
      <div>
        <p class="font-display text-xl font-bold text-ink">{{ auth.displayName }}</p>
        <p class="text-sm text-ink-soft">@{{ auth.user?.username }}</p>
        <p class="mt-1 font-mono text-xs text-ink-faint">
          加入于 {{ auth.user ? new Date(auth.user.created_at).toLocaleDateString('zh-CN') : '—' }}
        </p>
      </div>
    </div>

    <div class="mf-card mb-6 p-6">
      <h3 class="mb-4 font-display font-bold text-ink">昵称</h3>
      <div class="flex gap-3">
        <input v-model="nickname" class="mf-input" placeholder="你希望我怎么称呼你？" />
        <button class="mf-btn-primary shrink-0" @click="saveNickname">保存</button>
      </div>
    </div>

    <div class="mf-card p-6">
      <h3 class="mb-4 font-display font-bold text-ink">修改密码</h3>
      <div class="space-y-3">
        <input v-model="pwd.old" type="password" class="mf-input" placeholder="当前密码" />
        <input v-model="pwd.next" type="password" class="mf-input" placeholder="新密码" />
        <button class="mf-btn-outline" @click="changePassword">更新密码</button>
      </div>
    </div>
  </div>
</template>
