<script setup lang="ts">
defineProps<{ eyebrow?: string; title: string; desc?: string }>()
</script>

<template>
  <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p v-if="eyebrow" class="mf-eyebrow mb-1.5">{{ eyebrow }}</p>
      <h1 class="font-display text-2xl font-extrabold tracking-tight text-ink">{{ title }}</h1>
      <p v-if="desc" class="mt-1 text-sm text-ink-soft">{{ desc }}</p>
    </div>
    <div class="flex items-center gap-2"><slot name="actions" /></div>
  </header>
</template>
