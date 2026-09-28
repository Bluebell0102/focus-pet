import { getAiSettings } from '../storage/aiSettings'

export type AiDiaryInput = {
  summaryTitle: string
  summaryLines: string[]
  summaryFooter: string
}

export type AiDiaryResult = {
  text: string
}

export type GenerateAiDiaryOptions = {
  signal?: AbortSignal
}

type ChatMessage = {
  role: 'system' | 'user'
  content: string
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
}

const REQUEST_TIMEOUT_MS = 15_000
const MAX_SUMMARY_LINE_LENGTH = 120
const MAX_DIARY_LENGTH = 260

const aiDiarySystemPrompt = [
  '你是桌面陪伴角色霍霍，胆小但认真，温柔、低干扰。',
  '请根据用户今天的本地小结，写一段简短日记。',
  '不要说教，不要夸张，不要制造焦虑，不要评价用户效率低。',
  '不要编造没有提供的信息，不要输出 Markdown 标题。',
  '字数控制在 100-200 个中文字符左右。',
].join('\n')

export class AiDiaryRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiDiaryRequestError'
  }
}

export class AiDiaryRequestCanceledError extends Error {
  constructor(message = '这次先不写了。') {
    super(message)
    this.name = 'AiDiaryRequestCanceledError'
  }
}

function buildChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.trim().replace(/\/+$/, '')}/chat/completions`
}

function connectAbortSignal(controller: AbortController, signal?: AbortSignal) {
  if (!signal) return undefined

  if (signal.aborted) {
    controller.abort()
    return undefined
  }

  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })

  return () => signal.removeEventListener('abort', abort)
}

function normalizeSummaryLines(lines: string[]) {
  if (!Array.isArray(lines)) return []

  return lines
    .map((line) => line.trim().slice(0, MAX_SUMMARY_LINE_LENGTH))
    .filter(Boolean)
    .slice(0, 4)
}

function buildUserContent(input: AiDiaryInput) {
  const title = input.summaryTitle.trim().slice(0, 40) || '今日小结'
  const lines = normalizeSummaryLines(input.summaryLines)
  const footer = input.summaryFooter.trim().slice(0, MAX_SUMMARY_LINE_LENGTH)

  return [
    '请只根据下面的今日小结写一段温柔日记。',
    `标题：${title}`,
    `内容：${lines.length > 0 ? lines.join('\n') : '今天还没有太多记录。'}`,
    `总结：${footer || '慢慢来，我会在旁边陪着。'}`,
  ].join('\n')
}

function buildMessages(input: AiDiaryInput): ChatMessage[] {
  return [
    {
      role: 'system',
      content: aiDiarySystemPrompt,
    },
    {
      role: 'user',
      content: buildUserContent(input),
    },
  ]
}

function getFriendlyHttpError(status: number) {
  if (status === 401 || status === 403) return '还差一点配置。填好 API Key 后，霍霍就能写日记了。'
  if (status === 400 || status === 404) return '地址或模型好像还没填对，检查一下配置吧。'
  if (status === 429) return '好像太频繁了，稍微等一下再写吧。'
  if (status >= 500) return '那边好像有点忙，稍后再试一次吧。'
  return '好像没写出来……检查一下网络或配置吧。'
}

function trimDiaryText(value: string) {
  const text = value.trim()
  if (text.length <= MAX_DIARY_LENGTH) return text

  return `${text.slice(0, MAX_DIARY_LENGTH).replace(/[，。？?、；;\s]+$/, '')}……`
}

function parseDiary(data: ChatCompletionResponse) {
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') return ''

  return trimDiaryText(content)
}

export async function generateAiDiary(
  input: AiDiaryInput,
  options: GenerateAiDiaryOptions = {},
): Promise<AiDiaryResult> {
  const settings = getAiSettings()
  if (!settings.chatEnabled) {
    throw new AiDiaryRequestError('AI 陪伴还没开启，可以去设置里打开。')
  }

  if (
    settings.provider !== 'openai-compatible' ||
    !settings.baseUrl.trim() ||
    !settings.apiKey.trim() ||
    !settings.model.trim()
  ) {
    throw new AiDiaryRequestError('还差一点配置。填好 API Key 后，霍霍就能写日记了。')
  }

  const controller = new AbortController()
  const cleanupExternalAbort = connectAbortSignal(controller, options.signal)
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(buildChatCompletionsUrl(settings.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model.trim(),
        messages: buildMessages(input),
        temperature: 0.7,
        max_tokens: 220,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new AiDiaryRequestError(getFriendlyHttpError(response.status))
    }

    let data: ChatCompletionResponse
    try {
      data = (await response.json()) as ChatCompletionResponse
    } catch {
      throw new AiDiaryRequestError('霍霍刚才没写出内容……再试一次可以吗？')
    }

    const text = parseDiary(data)
    if (!text) {
      throw new AiDiaryRequestError('霍霍刚才没写出内容……再试一次可以吗？')
    }

    return { text }
  } catch (error) {
    if (error instanceof AiDiaryRequestError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (options.signal?.aborted) {
        throw new AiDiaryRequestCanceledError()
      }

      throw new AiDiaryRequestError('好像写得太久了……要不再试一次？')
    }

    console.warn('AI diary request failed.', error)
    throw new AiDiaryRequestError('好像没写出来……检查一下网络或配置吧。')
  } finally {
    window.clearTimeout(timeoutId)
    cleanupExternalAbort?.()
  }
}
