<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import MfEmpty from '@/components/ui/MfEmpty.vue'
import MfIcon from '@/components/ui/MfIcon.vue'
import MfSpinner from '@/components/ui/MfSpinner.vue'
import {
  fetchOpenApiSpec,
  parseOpenApiSpec,
  specStats,
  type EndpointDoc,
  type HttpMethod,
  type OpenApiSpec,
} from '@/api/openapi'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const spec = ref<OpenApiSpec | null>(null)
const endpoints = ref<EndpointDoc[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const selectedTag = ref('全部')
const selectedMethod = ref<'全部' | HttpMethod>('全部')
const selectedAuth = ref<'全部' | '需要登录' | '公开'>('全部')
const expanded = ref<string | null>(null)

const methodOptions: Array<'全部' | HttpMethod> = ['全部', 'get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']
const authOptions: Array<'全部' | '需要登录' | '公开'> = ['全部', '需要登录', '公开']

const stats = computed(() => (spec.value ? specStats(spec.value, endpoints.value) : null))

const tagOptions = computed(() => {
  const items = new Set<string>()
  for (const endpoint of endpoints.value) {
    for (const tag of endpoint.tags) items.add(tag)
  }
  return ['全部', ...Array.from(items).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))]
})

const filtered = computed(() =>
  endpoints.value.filter((item) => {
    if (selectedTag.value !== '全部' && !item.tags.includes(selectedTag.value)) return false
    if (selectedMethod.value !== '全部' && item.method !== selectedMethod.value) return false
    if (selectedAuth.value === '需要登录' && !item.authRequired) return false
    if (selectedAuth.value === '公开' && item.authRequired) return false
    const q = search.value.trim().toLowerCase()
    if (!q) return true
    const haystack = [
      item.method.toUpperCase(),
      item.path,
      item.summary,
      item.description,
      item.operationId,
      item.tags.join(' '),
      ...item.parameters.map((p) => `${p.name} ${p.description} ${p.type}`),
      ...item.requestBodies.flatMap((b) => b.fields.map((f) => `${f.name} ${f.description} ${f.type}`)),
      ...item.responses.flatMap((r) => r.fields.map((f) => `${f.name} ${f.description} ${f.type}`)),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  }),
)

const grouped = computed(() => {
  const map = new Map<string, EndpointDoc[]>()
  for (const item of filtered.value) {
    const key = item.tags[0] || '未分类'
    const list = map.get(key) || []
    list.push(item)
    map.set(key, list)
  }
  return Array.from(map.entries()).map(([tag, items]) => ({
    tag,
    items,
  }))
})

function load() {
  loading.value = true
  error.value = ''
  const controller = new AbortController()
  fetchOpenApiSpec(controller.signal)
    .then((data) => {
      spec.value = data
      endpoints.value = parseOpenApiSpec(data)
      expanded.value = endpoints.value[0]?.key || null
    })
    .catch((e) => {
      error.value = (e as Error).message
      ui.error(error.value)
    })
    .finally(() => {
      loading.value = false
    })
}

function methodClass(method: HttpMethod) {
  return {
    get: 'bg-sage-soft text-sage',
    post: 'bg-coral-soft text-coral-deep',
    put: 'bg-lilac-soft text-lilac',
    patch: 'bg-apricot/20 text-ink',
    delete: 'bg-ink/10 text-ink',
    options: 'bg-ink/10 text-ink',
    head: 'bg-ink/10 text-ink',
    trace: 'bg-ink/10 text-ink',
  }[method]
}

function toggle(item: EndpointDoc) {
  expanded.value = expanded.value === item.key ? null : item.key
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => ui.success('已复制'),
    () => ui.error('复制失败'),
  )
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-7xl px-8 py-10">
    <PageHeader
      eyebrow="开发文档"
      :title="stats?.title || '接口说明'"
      :desc="stats?.description || '直接读取后端 OpenAPI 规范生成的网页版接口说明。'"
    >
      <template #actions>
        <button class="mf-btn-outline" @click="load">
          <MfIcon name="refresh" :size="18" /> 刷新
        </button>
        <a class="mf-btn-soft" :href="SWAGGER_URL" target="_blank" rel="noreferrer">
          <MfIcon name="external" :size="18" /> Swagger UI
        </a>
      </template>
    </PageHeader>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <MfSpinner label="正在加载接口规范" />
    </div>

    <MfEmpty
      v-else-if="error"
      icon="⚠"
      title="接口文档加载失败"
      :hint="error"
    >
      <button class="mf-btn-primary mt-4" @click="load">重试</button>
    </MfEmpty>

    <template v-else>
      <section class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="mf-card p-5">
          <p class="mf-eyebrow mb-2">接口总数</p>
          <p class="font-display text-3xl font-extrabold text-ink">{{ stats?.total || 0 }}</p>
        </div>
        <div class="mf-card p-5">
          <p class="mf-eyebrow mb-2">分类标签</p>
          <p class="font-display text-3xl font-extrabold text-ink">{{ stats?.tags || 0 }}</p>
        </div>
        <div class="mf-card p-5">
          <p class="mf-eyebrow mb-2">需要登录</p>
          <p class="font-display text-3xl font-extrabold text-ink">{{ stats?.auth || 0 }}</p>
        </div>
        <div class="mf-card p-5">
          <p class="mf-eyebrow mb-2">公开接口</p>
          <p class="font-display text-3xl font-extrabold text-ink">{{ stats?.public || 0 }}</p>
        </div>
      </section>

      <section class="mf-card mb-6 p-5">
        <div class="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <input v-model="search" class="mf-input" placeholder="搜索路径、方法、参数、说明" />
          <select v-model="selectedTag" class="mf-input">
            <option v-for="tag in tagOptions" :key="tag" :value="tag">{{ tag }}</option>
          </select>
          <select v-model="selectedMethod" class="mf-input">
            <option v-for="method in methodOptions" :key="method" :value="method">
              {{ method === '全部' ? '全部方法' : method.toUpperCase() }}
            </option>
          </select>
          <select v-model="selectedAuth" class="mf-input">
            <option v-for="item in authOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
      </section>

      <section class="space-y-4">
        <div v-for="group in grouped" :key="group.tag" class="space-y-3">
          <p class="mf-eyebrow px-1">{{ group.tag }}</p>
          <div v-for="item in group.items" :key="item.key" class="mf-card overflow-hidden">
            <button class="flex w-full items-start gap-4 px-5 py-4 text-left" @click="toggle(item)">
              <span class="mf-pill shrink-0" :class="methodClass(item.method)">{{ item.method.toUpperCase() }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-display text-base font-bold text-ink">{{ item.summary }}</p>
                  <span v-if="item.authRequired" class="mf-pill bg-ink/5 text-ink-soft">登录</span>
                  <span v-if="item.deprecated" class="mf-pill bg-apricot/20 text-ink">废弃</span>
                </div>
                <p class="mt-1 font-mono text-xs text-ink-soft">{{ item.path }}</p>
                <p v-if="item.description" class="mt-2 text-sm text-ink-soft">{{ item.description }}</p>
              </div>
              <MfIcon :name="expanded === item.key ? 'chevronDown' : 'chevronDown'" :size="18" class="mt-1 shrink-0 transition" :class="{ 'rotate-180': expanded === item.key }" />
            </button>

            <div v-if="expanded === item.key" class="border-t border-line px-5 py-4">
              <div class="mb-4 flex flex-wrap gap-2 text-xs">
                <span v-for="tag in item.tags" :key="tag" class="mf-pill bg-ink/5 text-ink-soft">{{ tag }}</span>
                <span v-if="item.operationId" class="mf-pill bg-lilac-soft text-lilac">operationId: {{ item.operationId }}</span>
              </div>

              <div v-if="item.parameters.length" class="mb-5">
                <p class="mb-2 font-display text-sm font-bold text-ink">参数</p>
                <div class="overflow-hidden rounded-2xl border border-line">
                  <table class="w-full border-collapse text-sm">
                    <thead class="bg-paper text-left text-xs uppercase tracking-[0.12em] text-ink-faint">
                      <tr>
                        <th class="px-3 py-2">位置</th>
                        <th class="px-3 py-2">名称</th>
                        <th class="px-3 py-2">类型</th>
                        <th class="px-3 py-2">必填</th>
                        <th class="px-3 py-2">说明</th>
                        <th class="px-3 py-2">约束</th>
                        <th class="px-3 py-2">默认值</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in item.parameters" :key="`${item.key}-${row.name}-${row.location}`" class="border-t border-line">
                        <td class="px-3 py-2 font-mono text-xs text-ink-soft">{{ row.location }}</td>
                        <td class="px-3 py-2 font-mono text-xs text-ink">{{ row.name }}</td>
                        <td class="px-3 py-2 font-mono text-xs text-ink-soft">{{ row.type }}</td>
                        <td class="px-3 py-2 text-xs text-ink-soft">{{ row.required ? '是' : '否' }}</td>
                        <td class="px-3 py-2 text-xs text-ink-soft">{{ row.description || '-' }}</td>
                        <td class="px-3 py-2 text-xs text-ink-soft">{{ row.constraints || '-' }}</td>
                        <td class="px-3 py-2 text-xs text-ink-soft">{{ row.defaultValue || '-' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-if="item.requestBodies.length" class="mb-5">
                <p class="mb-2 font-display text-sm font-bold text-ink">请求体</p>
                <div v-for="body in item.requestBodies" :key="body.contentType" class="mb-3 rounded-2xl border border-line p-4">
                  <div class="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span class="mf-pill bg-sage-soft text-sage">{{ body.contentType }}</span>
                    <span v-if="body.required" class="mf-pill bg-ink/5 text-ink-soft">必填</span>
                    <span class="mf-pill bg-lilac-soft text-lilac">{{ body.schemaType }}</span>
                  </div>
                  <p v-if="body.description" class="mb-3 text-sm text-ink-soft">{{ body.description }}</p>
                  <div v-if="body.fields.length" class="overflow-hidden rounded-2xl border border-line">
                    <table class="w-full border-collapse text-sm">
                      <thead class="bg-paper text-left text-xs uppercase tracking-[0.12em] text-ink-faint">
                        <tr>
                          <th class="px-3 py-2">字段</th>
                          <th class="px-3 py-2">类型</th>
                          <th class="px-3 py-2">必填</th>
                          <th class="px-3 py-2">说明</th>
                          <th class="px-3 py-2">约束</th>
                          <th class="px-3 py-2">默认值</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in body.fields" :key="`${item.key}-${body.contentType}-${row.name}`" class="border-t border-line">
                          <td class="px-3 py-2 font-mono text-xs text-ink">{{ row.name }}</td>
                          <td class="px-3 py-2 font-mono text-xs text-ink-soft">{{ row.type }}</td>
                          <td class="px-3 py-2 text-xs text-ink-soft">{{ row.required ? '是' : '否' }}</td>
                          <td class="px-3 py-2 text-xs text-ink-soft">{{ row.description || '-' }}</td>
                          <td class="px-3 py-2 text-xs text-ink-soft">{{ row.constraints || '-' }}</td>
                          <td class="px-3 py-2 text-xs text-ink-soft">{{ row.defaultValue || '-' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div>
                <p class="mb-2 font-display text-sm font-bold text-ink">响应</p>
                <div class="space-y-3">
                  <div v-for="resp in item.responses" :key="`${item.key}-${resp.status}`" class="rounded-2xl border border-line p-4">
                    <div class="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <span class="mf-pill bg-ink/5 text-ink-soft">HTTP {{ resp.status }}</span>
                      <span class="mf-pill bg-lilac-soft text-lilac">{{ resp.schemaType }}</span>
                      <span v-for="ct in resp.contentTypes" :key="ct" class="mf-pill bg-sage-soft text-sage">{{ ct }}</span>
                    </div>
                    <p v-if="resp.description" class="mb-3 text-sm text-ink-soft">{{ resp.description }}</p>
                    <div v-if="resp.fields.length" class="overflow-hidden rounded-2xl border border-line">
                      <table class="w-full border-collapse text-sm">
                        <thead class="bg-paper text-left text-xs uppercase tracking-[0.12em] text-ink-faint">
                          <tr>
                            <th class="px-3 py-2">字段</th>
                            <th class="px-3 py-2">类型</th>
                            <th class="px-3 py-2">必填</th>
                            <th class="px-3 py-2">说明</th>
                            <th class="px-3 py-2">约束</th>
                            <th class="px-3 py-2">默认值</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="row in resp.fields" :key="`${item.key}-${resp.status}-${row.name}`" class="border-t border-line">
                            <td class="px-3 py-2 font-mono text-xs text-ink">{{ row.name }}</td>
                            <td class="px-3 py-2 font-mono text-xs text-ink-soft">{{ row.type }}</td>
                            <td class="px-3 py-2 text-xs text-ink-soft">{{ row.required ? '是' : '否' }}</td>
                            <td class="px-3 py-2 text-xs text-ink-soft">{{ row.description || '-' }}</td>
                            <td class="px-3 py-2 text-xs text-ink-soft">{{ row.constraints || '-' }}</td>
                            <td class="px-3 py-2 text-xs text-ink-soft">{{ row.defaultValue || '-' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap gap-2">
                <button class="mf-btn-soft" @click="copy(item.path)">
                  <MfIcon name="plus" :size="16" /> 复制路径
                </button>
                <button class="mf-btn-outline" @click="copy(`${item.method.toUpperCase()} ${item.path}`)">
                  <MfIcon name="plus" :size="16" /> 复制请求行
                </button>
              </div>
            </div>
          </div>
        </div>

        <MfEmpty v-if="!grouped.length" icon="📭" title="没有匹配的接口" hint="换一个关键词或筛选条件。">
          <button class="mf-btn-soft mt-4" @click="search = ''; selectedTag = '全部'; selectedMethod = '全部'; selectedAuth = '全部'">
            清空筛选
          </button>
        </MfEmpty>
      </section>
    </template>
  </div>
</template>
