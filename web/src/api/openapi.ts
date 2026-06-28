export const OPENAPI_URL = import.meta.env.VITE_OPENAPI_URL || '/openapi.json'
export const SWAGGER_URL = OPENAPI_URL.replace(/\/openapi\.json$/, '/docs')

export const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const
export type HttpMethod = (typeof httpMethods)[number]

export interface ReferenceObject {
  $ref: string
}

export type SchemaLike = OpenApiSchema | ReferenceObject

export interface OpenApiSchema {
  type?: string
  format?: string
  title?: string
  description?: string
  nullable?: boolean
  default?: unknown
  example?: unknown
  enum?: unknown[]
  properties?: Record<string, SchemaLike>
  required?: string[]
  items?: SchemaLike
  anyOf?: SchemaLike[]
  oneOf?: SchemaLike[]
  allOf?: SchemaLike[]
  additionalProperties?: boolean | SchemaLike
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number | boolean
  exclusiveMaximum?: number | boolean
  multipleOf?: number
  pattern?: string
  minItems?: number
  maxItems?: number
}

export interface OpenApiParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  description?: string
  schema?: SchemaLike
  example?: unknown
}

export interface OpenApiMediaType {
  schema?: SchemaLike
  example?: unknown
}

export interface OpenApiRequestBody {
  description?: string
  required?: boolean
  content?: Record<string, OpenApiMediaType>
}

export interface OpenApiResponse {
  description?: string
  content?: Record<string, OpenApiMediaType>
}

export interface OpenApiOperation {
  tags?: string[]
  summary?: string
  description?: string
  operationId?: string
  parameters?: Array<OpenApiParameter | ReferenceObject>
  requestBody?: OpenApiRequestBody | ReferenceObject
  responses?: Record<string, OpenApiResponse | ReferenceObject>
  security?: Array<Record<string, string[]>>
  deprecated?: boolean
}

export interface OpenApiPathItem {
  parameters?: Array<OpenApiParameter | ReferenceObject>
  get?: OpenApiOperation
  post?: OpenApiOperation
  put?: OpenApiOperation
  patch?: OpenApiOperation
  delete?: OpenApiOperation
  options?: OpenApiOperation
  head?: OpenApiOperation
  trace?: OpenApiOperation
}

export interface OpenApiComponents {
  schemas?: Record<string, OpenApiSchema>
}

export interface OpenApiSpec {
  openapi?: string
  info?: {
    title?: string
    version?: string
    description?: string
  }
  servers?: Array<{ url?: string; description?: string }>
  tags?: Array<{ name: string; description?: string }>
  paths?: Record<string, OpenApiPathItem>
  components?: OpenApiComponents
  security?: Array<Record<string, string[]>>
}

export interface FieldRow {
  name: string
  type: string
  required: boolean
  description: string
  constraints: string
  defaultValue: string
}

export interface ParameterRow extends FieldRow {
  location: OpenApiParameter['in']
}

export interface BodyDoc {
  contentType: string
  required: boolean
  description: string
  schemaType: string
  fields: FieldRow[]
}

export interface ResponseDoc {
  status: string
  description: string
  contentTypes: string[]
  schemaType: string
  fields: FieldRow[]
}

export interface EndpointDoc {
  key: string
  path: string
  method: HttpMethod
  tags: string[]
  summary: string
  description: string
  operationId: string
  authRequired: boolean
  deprecated: boolean
  parameters: ParameterRow[]
  requestBodies: BodyDoc[]
  responses: ResponseDoc[]
}

export async function fetchOpenApiSpec(signal?: AbortSignal): Promise<OpenApiSpec> {
  const resp = await fetch(OPENAPI_URL, {
    signal,
    credentials: 'include',
  })
  if (!resp.ok) {
    throw new Error(`接口文档加载失败（${resp.status} ${resp.statusText}）`)
  }
  return resp.json() as Promise<OpenApiSpec>
}

export function parseOpenApiSpec(spec: OpenApiSpec): EndpointDoc[] {
  const endpoints: EndpointDoc[] = []
  const pathMap = spec.paths || {}
  for (const [path, item] of Object.entries(pathMap)) {
    const baseParameters = resolveParameterList(item.parameters, spec)
    for (const method of httpMethods) {
      const operation = item[method]
      if (!operation) continue
      endpoints.push({
        key: `${method.toUpperCase()} ${path}`,
        path,
        method,
        tags: operation.tags?.length ? [...operation.tags] : ['未分类'],
        summary: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
        description: operation.description?.trim() || '',
        operationId: operation.operationId || '',
        authRequired:
          operation.security !== undefined ? operation.security.length > 0 : Boolean(spec.security?.length),
        deprecated: Boolean(operation.deprecated),
        parameters: [...baseParameters, ...resolveParameterList(operation.parameters, spec)],
        requestBodies: resolveRequestBodies(operation.requestBody, spec),
        responses: resolveResponses(operation.responses, spec),
      })
    }
  }
  return endpoints.sort((a, b) => {
    const tagCompare = a.tags[0].localeCompare(b.tags[0], 'zh-Hans-CN')
    if (tagCompare !== 0) return tagCompare
    const pathCompare = a.path.localeCompare(b.path, 'zh-Hans-CN')
    if (pathCompare !== 0) return pathCompare
    return methodRank(a.method) - methodRank(b.method)
  })
}

export function specStats(spec: OpenApiSpec, endpoints: EndpointDoc[]) {
  const tags = new Set<string>()
  for (const endpoint of endpoints) {
    for (const tag of endpoint.tags) tags.add(tag)
  }
  return {
    total: endpoints.length,
    tags: tags.size,
    auth: endpoints.filter((item) => item.authRequired).length,
    public: endpoints.filter((item) => !item.authRequired).length,
    title: spec.info?.title || 'OpenAPI',
    version: spec.info?.version || '',
    description: spec.info?.description || '',
  }
}

function methodRank(method: HttpMethod) {
  return httpMethods.indexOf(method)
}

function isReference(value: unknown): value is ReferenceObject {
  return Boolean(value && typeof value === 'object' && '$ref' in value)
}

function getRefName(ref: string) {
  return ref.split('/').pop() || ref
}

function resolveSchema(
  schema: SchemaLike | undefined,
  spec: OpenApiSpec,
  seen = new Set<string>(),
): OpenApiSchema | undefined {
  if (!schema) return undefined
  if (!isReference(schema)) return schema

  const refName = getRefName(schema.$ref)
  if (seen.has(refName)) return { title: refName }

  const resolved = spec.components?.schemas?.[refName]
  if (!resolved) return { title: refName }

  const nextSeen = new Set(seen)
  nextSeen.add(refName)
  return { ...resolved, title: resolved.title || refName }
}

function resolveParameterList(
  parameters: Array<OpenApiParameter | ReferenceObject> | undefined,
  spec: OpenApiSpec,
): ParameterRow[] {
  return (parameters || [])
    .map((item) => resolveParameter(item, spec))
    .filter((item): item is ParameterRow => Boolean(item))
}

function resolveParameter(
  parameter: OpenApiParameter | ReferenceObject,
  spec: OpenApiSpec,
): ParameterRow | null {
  const resolved = isReference(parameter)
    ? undefined
    : {
        ...parameter,
        schema: resolveSchema(parameter.schema, spec),
      }

  if (!resolved) return null

  return {
    location: resolved.in,
    name: resolved.name,
    type: schemaLabel(resolved.schema),
    required: Boolean(resolved.required),
    description: resolved.description || '',
    constraints: schemaConstraints(resolved.schema),
    defaultValue: schemaDefault(resolved.schema),
  }
}

function resolveRequestBodies(
  requestBody: OpenApiRequestBody | ReferenceObject | undefined,
  spec: OpenApiSpec,
): BodyDoc[] {
  if (!requestBody) return []
  const resolved = isReference(requestBody) ? undefined : requestBody
  if (!resolved) return []

  const bodies: BodyDoc[] = []
  for (const [contentType, media] of Object.entries(resolved.content || {})) {
    const schema = resolveSchema(media.schema, spec)
    bodies.push({
      contentType,
      required: Boolean(resolved.required),
      description: resolved.description || '',
      schemaType: schemaLabel(schema),
      fields: schemaFields(schema, spec),
    })
  }
  return bodies
}

function resolveResponses(
  responses: Record<string, OpenApiResponse | ReferenceObject> | undefined,
  spec: OpenApiSpec,
): ResponseDoc[] {
  const docs: ResponseDoc[] = []
  for (const [status, response] of Object.entries(responses || {})) {
    const resolved = isReference(response) ? undefined : response
    if (!resolved) continue

    const contentEntries = Object.entries(resolved.content || {})
    const schema = resolveSchema(contentEntries[0]?.[1]?.schema, spec)
    docs.push({
      status,
      description: resolved.description || '',
      contentTypes: contentEntries.map(([contentType]) => contentType),
      schemaType: schemaLabel(schema),
      fields: schemaFields(schema, spec),
    })
  }
  return docs
}

function schemaFields(schema: OpenApiSchema | undefined, spec: OpenApiSpec): FieldRow[] {
  const resolved = schema
  if (!resolved) return []
  if (resolved.type === 'array' && resolved.items) {
    const item = resolveSchema(resolved.items, spec)
    return [
      {
        name: 'items',
        type: schemaLabel(item),
        required: true,
        description: item?.description || '',
        constraints: schemaConstraints(item),
        defaultValue: schemaDefault(item),
      },
    ]
  }

  if (resolved.type !== 'object' && !resolved.properties) return []

  const requiredSet = new Set(resolved.required || [])
  const rows: FieldRow[] = []
  for (const [name, value] of Object.entries(resolved.properties || {})) {
    const child = resolveSchema(value, spec)
    rows.push({
      name,
      type: schemaLabel(child),
      required: requiredSet.has(name),
      description: child?.description || '',
      constraints: schemaConstraints(child),
      defaultValue: schemaDefault(child),
    })

    if (child?.type === 'object' && child.properties) {
      const nested = schemaFields(child, spec)
      for (const row of nested) {
        rows.push({
          ...row,
          name: `${name}.${row.name}`,
        })
      }
    }

    if (child?.type === 'array' && child.items) {
      const item = resolveSchema(child.items, spec)
      if (item?.type === 'object' && item.properties) {
        const nested = schemaFields(item, spec)
        for (const row of nested) {
          rows.push({
            ...row,
            name: `${name}[].${row.name}`,
          })
        }
      }
    }
  }

  return rows
}

function schemaLabel(schema?: OpenApiSchema): string {
  if (!schema) return '未知'
  if (schema.title && !schema.type && !schema.properties && !schema.items) return schema.title
  if (schema.type === 'array') {
    return `array<${schemaLabel(resolveSchema(schema.items, { info: {}, paths: {}, components: {} }))}>`
  }
  if (schema.type === 'object' || schema.properties) return schema.title || 'object'
  if (schema.type) {
    return schema.format ? `${schema.type}(${schema.format})` : schema.type
  }
  if (schema.oneOf?.length) return `oneOf<${schema.oneOf.map((item) => schemaLabel(resolveSchema(item, { info: {}, paths: {}, components: {} }))).join(' | ')}>`
  if (schema.anyOf?.length) return `anyOf<${schema.anyOf.map((item) => schemaLabel(resolveSchema(item, { info: {}, paths: {}, components: {} }))).join(' | ')}>`
  return schema.title || 'object'
}

function schemaConstraints(schema?: OpenApiSchema): string {
  if (!schema) return ''
  const parts: string[] = []
  if (schema.enum?.length) parts.push(`enum: ${schema.enum.map(formatValue).join(' | ')}`)
  if (schema.pattern) parts.push(`pattern: ${schema.pattern}`)
  if (schema.minLength !== undefined) parts.push(`minLength: ${schema.minLength}`)
  if (schema.maxLength !== undefined) parts.push(`maxLength: ${schema.maxLength}`)
  if (schema.minimum !== undefined) parts.push(`minimum: ${schema.minimum}`)
  if (schema.maximum !== undefined) parts.push(`maximum: ${schema.maximum}`)
  if (schema.exclusiveMinimum !== undefined) parts.push(`exclusiveMin: ${schema.exclusiveMinimum}`)
  if (schema.exclusiveMaximum !== undefined) parts.push(`exclusiveMax: ${schema.exclusiveMaximum}`)
  if (schema.minItems !== undefined) parts.push(`minItems: ${schema.minItems}`)
  if (schema.maxItems !== undefined) parts.push(`maxItems: ${schema.maxItems}`)
  if (schema.multipleOf !== undefined) parts.push(`multipleOf: ${schema.multipleOf}`)
  return parts.join(' · ')
}

function schemaDefault(schema?: OpenApiSchema): string {
  if (!schema || schema.default === undefined) return ''
  return formatValue(schema.default)
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
