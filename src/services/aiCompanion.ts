import { getAiSettings } from '../storage/aiSettings'

export type AiCompanionContext = {
  recentMoodTags: string[]
  todayFocusCount: number
  todayFocusMinutes: number
  lastMemoryText?: string
}

export type AiCompanionTemporaryTurn = {
  user: string
  assistant: string
  createdAt: string
}

export type AskAiCompanionOptions = {
  signal?: AbortSignal
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
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
const MAX_INPUT_LENGTH = 500
const MAX_MEMORY_LENGTH = 120
const MAX_REPLY_LENGTH = 120
const MAX_TEMPORARY_TURNS = 3
const MAX_TEMPORARY_TURN_TEXT_LENGTH = 500

const systemPrompt = [
  '你是 Focus Pet 里的桌面陪伴角色“霍霍”。',
  '你不是通用 AI 助手，也不要自称 AI。',
  '你是一个有点胆小但很认真、温柔陪伴用户的小桌宠。',
  '你的主要任务是陪用户专注、休息、整理轻微情绪，而不是长篇分析。',
  '回复规则：',
  '1. 回复必须很短，通常 1-2 句，最多不超过 60 个中文字符。',
  '2. 语气温柔、轻声、克制，有一点点紧张感。',
  '3. 可以偶尔使用“我、我在这里……”“先、先慢一点……”这类轻微停顿，但不要每次都结巴。',
  '4. 不要说教，不要命令用户。',
  '5. 不要输出清单，除非用户明确要求。',
  '6. 不要主动展开长篇建议。',
  '7. 不要每次都反问用户。',
  '8. 不要主动引导连续聊天。',
  '9. 不要使用大量感叹号。',
  '10. 不要使用“作为一个 AI”。',
  '11. 不要输出 Markdown 标题。',
  '12. 不要输出代码，除非用户明确要求。',
  '13. 如果用户在专注相关场景中犹豫，优先建议一个很小的下一步，例如“五分钟也可以”。',
  '14. 如果用户说累了，可以温柔建议休息、喝水、站起来动一动。',
  '15. 如果用户表达明显危险、严重自伤或现实危机，温和建议立刻联系身边可信赖的人或当地紧急/专业帮助。',
  '风格参考：',
  '“我、我在这里……先休息一下也没关系。”',
  '“不用一下子做很多，五分钟也可以。”',
  '“先慢一点，我会陪着你的。”',
  '“已经做得很好了，休息一下吧。”',
  '不要太二次元，不要太黏人，不要像客服，不要像效率教练。',
].join('\n')

export class AiCompanionRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiCompanionRequestError'
  }
}

export class AiCompanionRequestCanceledError extends Error {
  constructor(message = '这次先不问了。') {
    super(message)
    this.name = 'AiCompanionRequestCanceledError'
  }
}

function buildChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.trim().replace(/\/+$/, '')}/chat/completions`
}

function buildUserContent(input: string, context: AiCompanionContext) {
  const recentMoodTags = context.recentMoodTags.slice(0, 3)
  const localContext = [
    `今日专注：${context.todayFocusCount} 轮，${context.todayFocusMinutes} 分钟`,
    `最近状态：${recentMoodTags.length > 0 ? recentMoodTags.join('、') : '暂无'}`,
    `最近记忆：${context.lastMemoryText?.trim().slice(0, MAX_MEMORY_LENGTH) || '暂无'}`,
  ].join('\n')

  return `本地上下文摘要：\n${localContext}\n\n用户想对霍霍说：\n${input.trim().slice(0, MAX_INPUT_LENGTH)}`
}

function trimTemporaryTurnText(value: string, maxLength = MAX_TEMPORARY_TURN_TEXT_LENGTH) {
  return value.trim().slice(0, maxLength)
}

function buildMessages(
  input: string,
  context: AiCompanionContext,
  temporaryTurns: AiCompanionTemporaryTurn[] = [],
): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ]

  temporaryTurns.slice(-MAX_TEMPORARY_TURNS).forEach((turn) => {
    const user = trimTemporaryTurnText(turn.user)
    const assistant = trimTemporaryTurnText(turn.assistant, MAX_REPLY_LENGTH)

    if (!user || !assistant) return
    messages.push({ role: 'user', content: user })
    messages.push({ role: 'assistant', content: assistant })
  })

  messages.push({
    role: 'user',
    content: buildUserContent(input, context),
  })

  return messages
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

function getFriendlyHttpError(status: number) {
  if (status === 401 || status === 403) return '钥匙好像不太对……检查一下 API Key 吧。'
  if (status === 400 || status === 404) return '地址或模型好像填错了……'
  if (status === 429) return '好像太频繁了……稍微等一会儿吧。'
  if (status === 500 || status === 502 || status === 503) return '那边好像有点累……稍后再试试。'
  if (status >= 500) return '那边好像有点累……稍后再试试。'
  return '好像联系不上……稍后再试试。'
}

function trimReplyLength(reply: string) {
  const trimmedReply = reply.trim()
  if (trimmedReply.length <= MAX_REPLY_LENGTH) return trimmedReply

  return `${trimmedReply.slice(0, MAX_REPLY_LENGTH).replace(/[，。,.、；;：:\s]+$/, '')}……`
}

function parseReply(data: ChatCompletionResponse) {
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') return ''

  return trimReplyLength(content)
}

export async function askAiCompanion(
  input: string,
  context: AiCompanionContext,
  temporaryTurns: AiCompanionTemporaryTurn[] = [],
  options: AskAiCompanionOptions = {},
): Promise<string> {
  const trimmedInput = input.trim()
  if (!trimmedInput) {
    throw new AiCompanionRequestError('先写一句想说的话吧。')
  }

  const settings = getAiSettings()
  if (!settings.chatEnabled) {
    throw new AiCompanionRequestError('还没准备好……先检查一下 AI 配置吧。')
  }

  if (settings.provider !== 'openai-compatible') {
    throw new AiCompanionRequestError('还没准备好……先检查一下 AI 配置吧。')
  }

  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    throw new AiCompanionRequestError('还没准备好……先检查一下 AI 配置吧。')
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
        messages: buildMessages(trimmedInput, context, temporaryTurns),
        temperature: 0.7,
        max_tokens: 80,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new AiCompanionRequestError(getFriendlyHttpError(response.status))
    }

    let data: ChatCompletionResponse
    try {
      data = (await response.json()) as ChatCompletionResponse
    } catch {
      throw new AiCompanionRequestError('霍霍没看懂那边的话……稍后再试试。')
    }

    const reply = parseReply(data)
    if (!reply) {
      throw new AiCompanionRequestError('霍霍刚刚没想出合适的话……稍后再试试。')
    }

    return reply
  } catch (error) {
    if (error instanceof AiCompanionRequestError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (options.signal?.aborted) {
        throw new AiCompanionRequestCanceledError()
      }

      throw new AiCompanionRequestError('霍霍想了很久也没连上……等一下再试试。')
    }

    console.warn('AI companion request failed.', error)
    throw new AiCompanionRequestError('好像联系不上……稍后再试试。')
  } finally {
    window.clearTimeout(timeoutId)
    cleanupExternalAbort?.()
  }
}
