<script setup lang="ts">
defineProps<{ open: boolean; title?: string; width?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm" @click="emit('close')" />
        <!--
          关键修复：
          1) 盒子改成 flex 纵向布局 + max-h-[90vh]，超高时不再撑出屏幕外
          2) header / footer 固定（shrink-0），中间正文区独立滚动（flex-1 + overflow-y-auto）
          原来盒子是 overflow-hidden 且垂直居中，长报告会被裁掉且无法滚动
        -->
        <div
          class="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl bg-surface shadow-lift animate-fade-up"
          :style="{ maxWidth: width || '32rem' }"
        >
          <header v-if="title" class="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
            <h3 class="font-display text-lg font-bold text-ink">{{ title }}</h3>
            <button
              class="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-ink/5 hover:text-ink"
              @click="emit('close')"
            >
              ✕
            </button>
          </header>
          <div class="flex-1 overflow-y-auto px-6 py-5"><slot /></div>
          <footer v-if="$slots.footer" class="flex shrink-0 justify-end gap-2 border-t border-line px-6 py-4">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
