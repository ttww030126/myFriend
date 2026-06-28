import { defineStore } from 'pinia'
import { musicApi, type Recommendation, type Song } from '@/api/music'

// 播放器当前曲目
export interface PlayerTrack {
  id: string | null
  title: string
  artist: string
  url: string | null
  playable: boolean
  coverUrl: string | null
  lyric: string | null
  reason?: string
  sourceLayer?: string
}

function songToTrack(song: Song): PlayerTrack {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    url: song.url,
    playable: song.playable,
    coverUrl: song.cover_url,
    lyric: song.lyric,
    sourceLayer: song.file_key ? 'local' : song.source_url ? 'manual' : 'migu_free',
  }
}

function recToTrack(rec: Recommendation): PlayerTrack {
  const url = rec.url ?? rec.source_url ?? null
  return {
    id: rec.id,
    title: rec.title ?? '未知歌曲',
    artist: rec.artist ?? '',
    url,
    playable: rec.playable ?? !!url,
    coverUrl: rec.cover_url ?? null,
    lyric: rec.lyric ?? null,
    reason: rec.reason,
    sourceLayer: rec.source_layer,
  }
}

// 解析某首曲目的真实音源直链
async function resolveTrack(t: PlayerTrack): Promise<PlayerTrack> {
  if (t.url || !t.id) return t
  try {
    const { data } = await musicApi.resolveAudio(t.id)
    if (data.url) return { ...t, url: data.url, playable: true, sourceLayer: data.source_layer }
    return { ...t, playable: false, sourceLayer: 'display_only' }
  } catch {
    return { ...t, playable: false }
  }
}

// 切歌令牌：作废过期的异步解析
let pendingToken: symbol | null = null

export const useMusicStore = defineStore('music', {
  state: () => ({
    playlist: [] as PlayerTrack[],
    index: -1,
    track: null as PlayerTrack | null,
    visible: false,
    expanded: false,
    playing: false,
    loading: false,
    resolving: false,
    recommendReason: '',
  }),
  actions: {
    setPlaying(v: boolean) {
      this.playing = v
    },
    setExpanded(v: boolean) {
      this.expanded = v
    },
    close() {
      this.visible = false
      this.playing = false
    },
    // 从 startIndex 朝 dir 方向找到第一首能播的歌
    async _playFrom(startIndex: number, dir: 1 | -1) {
      const n = this.playlist.length
      if (n === 0) return
      const token = Symbol('playFrom')
      pendingToken = token
      this.resolving = true
      for (let step = 0; step < n; step++) {
        const idx = (((startIndex + dir * step) % n) + n) % n
        const base = this.playlist[idx]
        if (base.url) {
          if (pendingToken !== token) return
          this.index = idx
          this.track = base
          this.playing = true
          this.resolving = false
          void musicApi
            .recordPlay({ song_id: base.id, title: base.title, artist: base.artist })
            .catch(() => {})
          return
        }
        const resolved = await resolveTrack(base)
        if (pendingToken !== token) return
        this.playlist[idx] = resolved
        if (resolved.playable && resolved.url) {
          this.index = idx
          this.track = resolved
          this.playing = true
          this.resolving = false
          void musicApi
            .recordPlay({ song_id: resolved.id, title: resolved.title, artist: resolved.artist })
            .catch(() => {})
          return
        }
      }
      if (pendingToken !== token) return
      const idx = ((startIndex % n) + n) % n
      this.index = idx
      this.track = this.playlist[idx]
      this.playing = false
      this.resolving = false
    },
    playList(songs: Song[], startIndex: number) {
      const list = songs.map(songToTrack)
      const idx = Math.max(0, Math.min(startIndex, list.length - 1))
      this.playlist = list
      this.visible = true
      this.recommendReason = ''
      void this._playFrom(idx, 1)
    },
    next() {
      if (this.playlist.length === 0) return
      void this._playFrom(this.index + 1, 1)
    },
    prev() {
      if (this.playlist.length === 0) return
      void this._playFrom(this.index - 1, -1)
    },
    async recommend() {
      this.loading = true
      this.visible = true
      try {
        const { data } = await musicApi.recommend()
        const list = (data.items ?? []).map(recToTrack)
        if (list.length === 0) return
        this.playlist = list
        this.index = -1
        this.recommendReason = data.reason || ''
        await this._playFrom(0, 1)
      } finally {
        this.loading = false
      }
    },
  },
})
