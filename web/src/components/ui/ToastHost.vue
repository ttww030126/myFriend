<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
const ui = useUiStore()
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-5 z-[100] flex flex-col items-center gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="t in ui.toasts"
          :key="t.id"
          class="pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lift backdrop-blur"
          :class="{
            'bg-ink text-bg': t.type === 'info',
            'bg-sage text-white': t.type === 'success',
            'bg-coral-deep text-white': t.type === 'error',
          }"
        >
          <span class="text-base leading-none">
            {{ t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '◆' }}
          </span>
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
