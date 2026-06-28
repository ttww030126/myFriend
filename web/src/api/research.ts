import client, { type Wrapped } from './client'

// 深度研究相关接口——对应后端 /research 与公开分享 /public/report-shares
export type ResearchStatus =
  | 'pending'
  | 'planning'
  | 'searching'
  | 'writing'
  | 'summarizing'
  | 'done'
  | 'failed'

export interface ResearchSource {
  index: number
  type: 'web' | 'kb' | 'mcp'
  title: string
  url: string | null
}

export interface ReportBrief {
  id: string
  topic: string
  title: string | null
  status: ResearchStatus
  created_at: string | null
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
    return client.get<unknown, Wrapped<unknown>>(`/research/${id}`)
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

// 研究报告公开查看（无需登录）
export function fetchPublicReportShare(token: string) {
  return client.get<unknown, Wrapped<PublicReportShare>>(
    `/public/report-shares/${token}`,
  )
}
