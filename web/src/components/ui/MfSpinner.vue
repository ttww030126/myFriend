<script setup lang="ts">
withDefaults(defineProps<{ size?: number; label?: string }>(), { size: 22 })
</script>

<template>
  <span class="inline-flex items-center gap-2 text-ink-soft">
    <svg :width="size" :height="size" viewBox="0 0 24 24" class="animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-width="3" />
      <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke="#FF6B5E" stroke-width="3" stroke-linecap="round" />
    </svg>
    <span v-if="label" class="text-sm">{{ label }}</span>
  </span>
</template>
