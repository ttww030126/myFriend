<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import client, { type Wrapped } from '@/api/client'
import MfSpinner from '@/components/ui/MfSpinner.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfLogo from '@/components/ui/MfLogo.vue'

// 凭邀请链接加入群聊：/groups/join/:code
// 未登录会跳登录页（带 redirect），登录后回来自动加入并跳进群聊。
const route = useRoute()
const router = useRouter()
const status = ref<'joining' | 'error'>('joining')
const errMsg = ref('')

onMounted(async () => {
  const code = route.params.code as string
  if (!code) {
    errMsg.value = '邀请链接无效'
    status.value = 'error'
    return
  }
  // 未登录：记下目标，去登录页
  if (!localStorage.getItem('access_token')) {
    router.replace({ name: 'login', query: { redirect: `/groups/join/${code}` } })
    return
  }
  try {
    const res = await client.post<unknown, Wrapped<{ id: string }>>('/groups/join', { code })
    router.replace({ name: 'group-chat', query: { conv: res.data.id } })
  } catch (e) {
    errMsg.value = (e as Error).message || '加入失败，邀请码可能已失效'
    status.value = 'error'
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
    <MfLogo :size="34" class="mb-10" />
    <template v-if="status === 'joining'">
      <MfSpinner :size="30" label="正在加入群聊…" />
    </template>
    <template v-else>
      <MfEmpty icon="🙈" title="加入群聊失败" :hint="errMsg">
        <button class="mf-btn-primary mt-5" @click="router.replace({ name: 'group-chat' })">
          去群聊看看
        </button>
      </MfEmpty>
    </template>
  </div>
</template>
