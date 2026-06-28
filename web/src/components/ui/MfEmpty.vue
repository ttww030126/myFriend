<script setup lang="ts">
defineProps<{ title?: string; hint?: string; icon?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-coral-soft text-3xl">
      {{ icon || '🌱' }}
    </div>
    <p class="font-display text-base font-semibold text-ink">{{ title || '这里还空着' }}</p>
    <p v-if="hint" class="mt-1 max-w-xs text-sm text-ink-soft">{{ hint }}</p>
    <slot />
  </div>
</template>
