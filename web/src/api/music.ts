import client, { type Wrapped } from './client'

export type SongTagStatus = 'pending' | 'done' | 'failed'

export interface Song {
  id: string
  title: string
  artist: string
  album: string | null
  file_key: string | null
  source_url: string | null
  url: string | null
  playable: boolean
  cover_url: string | null
  lyric: string | null
  valence: number
  arousal: number
  mood_tags: string[]
  tag_status: SongTagStatus
  duration: number | null
  created_at: string | null
}

export interface SongListData {
  items: Song[]
  total: number
}

export type RecommendSourceLayer = 'local' | 'migu_free' | 'display_only' | 'empty'

export interface Recommendation {
  id: string | null
  title: string | null
  artist?: string | null
  url?: string | null
  source_url?: string | null
  playable?: boolean
  cover_url?: string | null
  lyric?: string | null
  valence?: number
  arousal?: number
  reason?: string
  source_layer?: RecommendSourceLayer
}

export interface RecommendResult {
  items: Recommendation[]
  reason: string
  emotion?: { dominant: string; valence: number; arousal: number }
}

export const musicApi = {
  recommend() {
    return client.get<unknown, Wrapped<RecommendResult>>('/music/recommend')
  },
  listSongs(limit = 200, offset = 0) {
    return client.get<unknown, Wrapped<SongListData>>(`/music/songs?limit=${limit}&offset=${offset}`)
  },
  removeSong(id: string) {
    return client.delete<unknown, Wrapped<null>>(`/music/songs/${id}`)
  },
  resolveAudio(id: string) {
    return client.get<unknown, Wrapped<{ url: string | null; source_layer: string }>>(
      `/music/songs/${id}/audio`,
    )
  },
  recordPlay(payload: { song_id: string | null; title: string; artist: string }) {
    return client.post<unknown, Wrapped<null>>('/music/play-record', payload)
  },
}
