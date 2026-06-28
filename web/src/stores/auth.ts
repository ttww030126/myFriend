import { defineStore } from 'pinia'
import { authApi, type UserInfo } from '@/api/auth'

// 认证 store（移植自原 Zustand authStore）
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as UserInfo | null,
    loading: false,
  }),
  getters: {
    isAuthenticated: () => !!localStorage.getItem('access_token'),
    displayName: (s) => s.user?.nickname || s.user?.username || '朋友',
  },
  actions: {
    async login(username: string, password: string) {
      const { data } = await authApi.login(username, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      await this.fetchUser()
    },
    async register(username: string, password: string) {
      await authApi.register(username, password)
    },
    async fetchUser() {
      if (!localStorage.getItem('access_token')) {
        this.user = null
        return
      }
      this.loading = true
      try {
        const { data } = await authApi.me()
        this.user = data
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        this.user = null
      } finally {
        this.loading = false
      }
    },
    async logout() {
      try {
        await authApi.logout()
      } catch {
        // 忽略登出接口错误，本地清理为准
      }
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      this.user = null
    },
  },
})
