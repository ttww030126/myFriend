<script setup lang="ts">
// MyFriend 签名 logo：记忆线连接三个节点（知识·记忆·你）
withDefaults(defineProps<{ size?: number; wordmark?: boolean }>(), {
  size: 36,
  wordmark: true,
})
</script>

<template>
  <span class="inline-flex items-center gap-2.5">
    <svg :width="size" :height="size" viewBox="0 0 64 64" class="shrink-0">
      <defs>
        <linearGradient id="mf-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FF6B5E" />
          <stop offset="1" stop-color="#FFB088" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#2A2438" />
      <path
        d="M16 40 C26 24 38 24 48 40"
        fill="none"
        stroke="url(#mf-logo-g)"
        stroke-width="4"
        stroke-linecap="round"
        stroke-dasharray="2 7"
        class="animate-thread-dash"
      />
      <circle cx="16" cy="40" r="5" fill="url(#mf-logo-g)" />
      <circle cx="48" cy="40" r="5" fill="#2FB59C" />
      <circle cx="32" cy="28" r="4" fill="#8B7FF0" class="animate-breathe" style="transform-origin: 32px 28px" />
    </svg>
    <span v-if="wordmark" class="font-display text-xl font-extrabold tracking-tight text-ink">
      My<span class="mf-gradient-text">Friend</span>
    </span>
  </span>
</template>
