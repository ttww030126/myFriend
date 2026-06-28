import client, { type Wrapped } from './client'

// 深度研究接口——对应后端 /research 与公开分享 /public/report-shares
export type ResearchStatus = 'pending' | 'planning' | 'searching' | 'writing' | 'summarizing' | 'done' | 'failed'

export interface ResearchSource {
  index: number
  type: 'web' | 'kb' | 'mcp'
  title: string
  url: string | null
}

export interface PlanSection {
  heading: string
  points: string
}
export interface ResearchPlan {
  title: string
  sections: PlanSection[]
  queries: string[]
}

export interface ReportBrief {
  id: string
  topic: string
  title: string | null
  status: ResearchStatus
  created_at: string | null
}

export interface ReportDetail extends ReportBrief {
  report_md: string | null
  outline: ResearchPlan | null
  sources: ResearchSource[]
  error_msg: string | null
}

// Verifier Loop 详情（质量评分卡用）
export interface LoopIterationDetail {
  iteration_no: number
  scores: { raw: Record<string, number>; total: number } | Record<string, never>
  feedback: {
    summary?: string
    issues?: { dim: string; detail: string }[]
    missing_coverage?: string[]
    wrong_citations?: number[]
    weak_chapters?: string[]
  }
  decision: string
  repair_action: { kind: string; patch_queries?: string[]; rewrite_chapters?: string[]; rationale?: string } | null
  duration_ms: number | null
  artifact_snapshot: Record<string, unknown>
}
export interface LoopDetail {
  run_id: string
  task_type: string
  status: 'running' | 'passed' | 'failed' | 'exceeded'
  iterations: number
  final_score: number | null
  pass_threshold: number
  max_iterations: number
  rubric_name: string | null
  generator_model: string | null
  verifier_model: string | null
  verifier_kind: string | null
  note: string | null
  started_at: string | null
  finished_at: string | null
  iterations_detail: LoopIterationDetail[]
}

export interface ReportShare {
  id: string
  report_id: string
  share_token: string
  title: string
  is_active: boolean
  expire_at: string | null
  view_count: number
  created_at: string | null
}

export interface PublicReportShare {
  title: string
  markdown: string
  sources: ResearchSource[]
  created_at: string | null
}

export const researchApi = {
  list(page = 1, pageSize = 20) {
    return client.get<unknown, Wrapped<{ items: ReportBrief[]; total: number }>>(
      `/research?page=${page}&page_size=${pageSize}`,
    )
  },
  detail(id: string) {
    return client.get<unknown, Wrapped<ReportDetail>>(`/research/${id}`)
  },
  loop(id: string) {
    return client.get<unknown, Wrapped<LoopDetail | null>>(`/research/${id}/loop`)
  },
  remove(id: string) {
    return client.delete<unknown, Wrapped<null>>(`/research/${id}`)
  },
  share(id: string, payload?: { title?: string; expire_days?: number | null }) {
    return client.post<unknown, Wrapped<ReportShare>>(`/research/${id}/share`, {
      title: payload?.title ?? null,
      expire_days: payload?.expire_days ?? null,
    })
  },
}

// 发起研究：SSE 流式。逐事件回调；首个 meta 事件带 report_id。
// 用 fetch + ReadableStream 解析 SSE（axios 不便处理流）。
export async function startResearchStream(
  topic: string,
  onEvent: (type: string, data: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem('access_token')
  const resp = await fetch('/api/research/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ topic }),
    signal,
  })
  if (!resp.ok || !resp.body) throw new Error(`研究启动失败（${resp.status}）`)
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    // SSE 以空行分隔事件块
    const blocks = buf.split('\n\n')
    buf = blocks.pop() || ''
    for (const block of blocks) {
      let ev = 'message'
      const dataLines: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) ev = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      }
      if (!dataLines.length) continue
      try {
        onEvent(ev, JSON.parse(dataLines.join('\n')))
      } catch {
        onEvent(ev, { raw: dataLines.join('\n') })
      }
    }
  }
}

// 研究报告公开查看（无需登录）
export function fetchPublicReportShare(token: string) {
  return client.get<unknown, Wrapped<PublicReportShare>>(`/public/report-shares/${token}`)
}
