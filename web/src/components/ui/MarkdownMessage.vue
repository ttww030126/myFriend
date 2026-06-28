<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps<{ content: string }>()
marked.setOptions({ breaks: true, gfm: true })
const html = computed(() => marked.parse(props.content || '') as string)
</script>

<template>
  <div class="mf-prose" v-html="html" />
</template>
