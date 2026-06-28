import client, { type Wrapped } from './client'

export interface DailyReview {
  date: string
  content: string
  care?: string
  stats: { messages: number; memories: number; documents: number; songs?: number } | null
  generating?: boolean
  created_at: string
}

export interface OverviewData {
  counts: {
    documents: number
    images: number
    conversations: number
    entities: number
    communities: number
  }
  tag_distribution: { name: string; value: number }[]
  recent: { type: string; title: string; time: string | null }[]
}

export const dashboardApi = {
  dailyReview() {
    return client.get<unknown, Wrapped<DailyReview>>('/dashboard/daily-review')
  },
  overview() {
    return client.get<unknown, Wrapped<OverviewData>>('/dashboard/overview')
  },
  loopHealth(days = 30) {
    return client.get<unknown, Wrapped<LoopHealthData>>(`/dashboard/loop-health?days=${days}`)
  },
}

// ── Verifier Loop 健康度 ──
export interface LoopHealthData {
  days: number
  total: number
  passed: number
  exceeded: number
  failed: number
  one_shot_pass_rate: number // 一次通过率 0~1
  avg_iterations: number
  avg_final_score: number
  failure_dims: { dim: string; label: string; count: number }[]
  verifier_kinds: Record<string, number>
}
