import client, { type Wrapped } from './client'

// ── MCP 服务配置（对齐后端 /tools/mcp 与 mcp_schema）──

export type McpTransport = 'sse' | 'streamable_http'
export type McpAuthType = 'none' | 'bearer' | 'api_key'

export interface McpToolMeta {
  name: string
  description: string
}

export interface McpServerItem {
  id: string
  name: string
  transport: McpTransport
  url: string
  auth_type: McpAuthType
  auth_masked: string
  enabled: boolean
  status: string // pending / ok / error（后端 status 字符串）
  last_error: string | null
  tools_cache: McpToolMeta[] | null
  synced_at: string | null
  created_at: string
}

export interface McpServerPayload {
  name: string
  transport: McpTransport
  url: string
  auth_type: McpAuthType
  // bearer: { token }；api_key: { header, key }；none: null。留空(undefined)表示不修改认证
  auth_config?: Record<string, string> | null
  enabled?: boolean
}

export interface McpTestResult {
  success: boolean
  message: string
  tools: McpToolMeta[]
}

export const mcpApi = {
  list() {
    return client.get<unknown, Wrapped<McpServerItem[]>>('/tools/mcp')
  },
  create(payload: McpServerPayload) {
    return client.post<unknown, Wrapped<McpServerItem>>('/tools/mcp', payload)
  },
  update(id: string, payload: Partial<McpServerPayload>) {
    return client.put<unknown, Wrapped<McpServerItem>>(`/tools/mcp/${id}`, payload)
  },
  remove(id: string) {
    return client.delete<unknown, Wrapped<null>>(`/tools/mcp/${id}`)
  },
  test(id: string) {
    return client.post<unknown, Wrapped<McpTestResult>>(`/tools/mcp/${id}/test`)
  },
  sync(id: string) {
    return client.post<unknown, Wrapped<McpServerItem>>(`/tools/mcp/${id}/sync`)
  },
  toggle(id: string, enabled: boolean) {
    return client.put<unknown, Wrapped<McpServerItem>>(`/tools/mcp/${id}/toggle`, { enabled })
  },
}
