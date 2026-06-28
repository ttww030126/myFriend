import { defineStore } from 'pinia'

export interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

let seq = 0

// 全局 UI store：轻提示
export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [] as Toast[],
  }),
  actions: {
    notify(message: string, type: Toast['type'] = 'info') {
      const id = ++seq
      this.toasts.push({ id, message, type })
      setTimeout(() => this.dismiss(id), 3200)
    },
    success(message: string) {
      this.notify(message, 'success')
    },
    error(message: string) {
      this.notify(message, 'error')
    },
    dismiss(id: number) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
  },
})
