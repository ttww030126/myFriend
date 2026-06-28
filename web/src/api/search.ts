import client, { type Wrapped } from './client'
import type { SearchHit } from './documents'
import type { MemoryHit } from './memories'

export interface GlobalSearchResult {
  documents: SearchHit[]
  images: SearchHit[]
  memories: MemoryHit[]
}

export const searchApi = {
  global(q: string, topK = 8) {
    const params = new URLSearchParams({ q, top_k: String(topK) })
    return client.get<unknown, Wrapped<GlobalSearchResult>>(`/search?${params.toString()}`)
  },
}
