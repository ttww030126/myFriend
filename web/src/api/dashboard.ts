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
}
