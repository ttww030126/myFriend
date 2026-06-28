import client, { type Wrapped } from './client'

export interface GroupRoom {
  id: string
  title: string | null
  member_persona_ids: string[]
  created_at: string | null
  is_owner?: boolean
  avatar_members?: { name: string; avatar_url: string | null }[]
}

export interface GroupMember {
  id: string
  name: string
  avatar_url: string | null
}

export interface GroupMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  sender_name: string | null
}

export interface GroupCreatePayload {
  title?: string | null
  member_persona_ids: string[]
  enable_tools?: boolean
}

export const groupApi = {
  list() {
    return client.get<unknown, Wrapped<GroupRoom[]>>('/groups')
  },
  create(body: GroupCreatePayload) {
    return client.post<unknown, Wrapped<GroupRoom>>('/groups', body)
  },
  members(convId: string) {
    return client.get<unknown, Wrapped<GroupMember[]>>(`/groups/${convId}/members`)
  },
  messages(convId: string) {
    return client.get<unknown, Wrapped<GroupMessage[]>>(`/groups/${convId}/messages`)
  },
  clearMessages(convId: string) {
    return client.delete<unknown, Wrapped<null>>(`/groups/${convId}/messages`)
  },
  invite(convId: string) {
    return client.post<unknown, Wrapped<{ join_code: string }>>(`/groups/${convId}/invite`)
  },
  resetInvite(convId: string) {
    return client.post<unknown, Wrapped<{ join_code: string }>>(`/groups/${convId}/invite/reset`)
  },
  setTools(convId: string, enabled: boolean) {
    return client.patch<unknown, Wrapped<{ enable_tools: boolean }>>(`/groups/${convId}/tools`, { enabled })
  },
  leave(convId: string) {
    return client.post<unknown, Wrapped<null>>(`/groups/${convId}/leave`)
  },
}

// 群聊 SSE 事件（与后端 group_chat_service 对齐）：
// meta / speaker_start{persona_id,name,avatar_url} / token{text}
// tool_start / tool_result / speaker_end{persona_id,message_id} / done / error
export interface GroupStreamHandlers {
  onMeta?: (d: { conversation_id: string; title: string }) => void
  onSpeakerStart?: (d: { persona_id: string; name: string; avatar_url: string | null }) => void
  onToken?: (text: string) => void
  onToolStart?: (d: Record<string, unknown>) => void
  onToolResult?: (d: Record<string, unknown>) => void
  onSpeakerEnd?: (d: { persona_id: string; message_id: string }) => void
  onDone?: () => void
  onError?: (msg: string) => void
}

export async function streamGroupChat(
  convId: string,
  message: string,
  handlers: GroupStreamHandlers,
  imageKeys: string[] = [],
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem('access_token')
  const resp = await fetch('/api/groups/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ conversation_id: convId, message, image_keys: imageKeys }),
    signal,
  })
  if (!resp.ok || !resp.body) {
    handlers.onError?.(`请求失败（HTTP ${resp.status}）`)
    return
  }
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      let event = 'message'
      let data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(data)
      } catch {
        continue
      }
      switch (event) {
        case 'meta':
          handlers.onMeta?.(payload as never)
          break
        case 'speaker_start':
          handlers.onSpeakerStart?.(payload as never)
          break
        case 'token':
          handlers.onToken?.(payload.text as string)
          break
        case 'tool_start':
          handlers.onToolStart?.(payload)
          break
        case 'tool_result':
          handlers.onToolResult?.(payload)
          break
        case 'speaker_end':
          handlers.onSpeakerEnd?.(payload as never)
          break
        case 'done':
          handlers.onDone?.()
          break
        case 'error':
          handlers.onError?.((payload.message as string) || '群聊出错')
          break
      }
    }
  }
}
