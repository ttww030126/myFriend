import type { ModelType, Provider } from '@/api/models'

export const TYPE_OPTIONS: { label: string; value: ModelType }[] = [
  { label: '对话', value: 'chat' },
  { label: '多模态', value: 'multimodal' },
  { label: '向量 Embedding', value: 'embedding' },
  { label: '重排 Rerank', value: 'rerank' },
  { label: '联网搜索', value: 'websearch' },
  { label: '语音识别 ASR', value: 'asr' },
]

export const TYPE_LABEL: Record<ModelType, string> = {
  chat: '对话',
  multimodal: '多模态',
  embedding: '向量',
  rerank: '重排',
  websearch: '联网',
  asr: '语音',
}

export const PROVIDER_OPTIONS: { label: string; value: Provider }[] = [
  { label: 'OpenAI', value: 'openai' },
  { label: '通义千问', value: 'qwen' },
  { label: '豆包', value: 'doubao' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '智谱', value: 'zhipu' },
  { label: '百度千帆（联网搜索）', value: 'qianfan' },
  { label: 'Tavily（联网搜索）', value: 'tavily' },
]

// 各 provider 默认 base_url，与后端 provider.py 保持一致
export const PROVIDER_DEFAULT_BASE_URL: Record<Provider, string> = {
  openai: 'https://api.openai.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  deepseek: 'https://api.deepseek.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  qianfan: '',
  tavily: '',
}

export const CAPABILITY_OPTIONS = [
  { label: 'Function Call（工具调用）', value: 'function_call' },
  { label: 'Vision（图片理解）', value: 'vision' },
]

export const CAP_LABEL: Record<string, string> = {
  function_call: '工具调用',
  vision: '图片理解',
}

// 每种模型类型有什么用、怎么配
export const TYPE_GUIDE: { name: string; tag: '必配' | '可选'; desc: string; provider: string }[] = [
  { name: '对话 Chat', tag: '必配', desc: '负责所有问答对话的大语言模型。建议选支持 Function Call 的强模型（勾上「工具调用」能力），才能自动调用知识库 / 记忆 / 联网等工具。', provider: '智谱 glm-4 / DeepSeek deepseek-chat / 通义 qwen-max' },
  { name: '向量 Embedding', tag: '必配', desc: '把文档和问题转成向量，知识库检索和记忆召回都依赖它。配了知识库才有意义。', provider: '智谱 embedding-3 / 通义 text-embedding-v3' },
  { name: '多模态 Multimodal', tag: '可选', desc: '能看图理解的模型。对话 / 群聊发图片让 AI 分析时用到（勾「图片理解」能力）。', provider: '智谱 glm-4v / 通义 qwen-vl-max / 豆包 vision' },
  { name: 'Rerank 重排', tag: '可选', desc: '对知识库检索结果重新排序，提升相关度。不配也能用，配了检索更准。', provider: '通义 gte-rerank' },
  { name: '联网搜索 Websearch', tag: '可选', desc: '让 AI 能查实时信息（新闻 / 股价 / 天气）。配了并在对话开启联网开关才生效。', provider: '百度千帆 / Tavily' },
  { name: '语音识别 ASR', tag: '可选', desc: '把语音转文字，对话输入框的麦克风用它（更准）。不配则用浏览器免费识别。', provider: '通义千问 paraformer-v2 / OpenAI whisper-1' },
]

// 各供应商获取 API Key 的官网地址（密钥管理控制台）
export const PROVIDER_LINKS: { label: string; desc: string; url: string }[] = [
  {
    label: '智谱 AI（BigModel 开放平台）',
    desc: '国内，注册即送额度，chat / embedding / 多模态 / rerank 齐全，推荐新手首选',
    url: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    label: 'DeepSeek',
    desc: '国内，对话与推理性价比高，仅 chat（不提供向量模型）',
    url: 'https://platform.deepseek.com/api_keys',
  },
  {
    label: '通义千问（阿里云百炼）',
    desc: '国内，chat / 多模态 / embedding / rerank 都有，OpenAI 兼容',
    url: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
  },
  {
    label: '豆包（火山方舟）',
    desc: '国内，字节跳动，chat / 多模态，需在控制台开通模型',
    url: 'https://console.volcengine.com/ark',
  },
  {
    label: 'OpenAI',
    desc: '海外，需科学上网与海外支付，GPT 系列',
    url: 'https://platform.openai.com/api-keys',
  },
  {
    label: '百度千帆（联网搜索）',
    desc: '联网搜索数据源，中文实时信息效果好',
    url: 'https://console.bce.baidu.com/iam/#/iam/apikey/list',
  },
  {
    label: 'Tavily（联网搜索）',
    desc: '海外联网搜索，每月有免费额度',
    url: 'https://app.tavily.com/home',
  },
  {
    label: '语音识别 ASR（通义千问 DashScope）',
    desc: '语音转文字，与通义共用一个 DashScope Key，模型名填 paraformer-v2；也可用 OpenAI whisper-1',
    url: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
  },
]
