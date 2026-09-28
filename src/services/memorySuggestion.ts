const MIN_SUGGESTION_INPUT_LENGTH = 6

const explicitRememberPatterns = [
  '以后提醒我',
  '以后记得',
  '记住',
  '你记一下',
  '帮我记',
  '别忘了',
]

const rememberSuggestionPatterns = [
  '我喜欢',
  '我不喜欢',
  '我更喜欢',
  '我讨厌',
  '我偏好',
  '我习惯',
  '我一般',
  '我通常',
  '我经常',
  '我总是',
  '每次',
  '每天',
  '每周',
  '以后',
  '下次',
  '我最近',
  '最近总是',
  '这几天',
  '最近有点',
  '我想养成',
  '我正在准备',
  '我现在主要',
  '我希望以后',
]

const shortNonMemoryInputs = new Set(['你好', '在吗', '谢谢', '谢了', '好的', '好', '嗯', '哦'])

export function shouldSuggestRemember(input: string, reply?: string) {
  const normalizedInput = input.trim().toLocaleLowerCase()
  if (shortNonMemoryInputs.has(normalizedInput)) return false

  const hasExplicitRememberIntent = explicitRememberPatterns.some((pattern) =>
    normalizedInput.includes(pattern.toLocaleLowerCase()),
  )
  if (hasExplicitRememberIntent) return true
  if (normalizedInput.length < MIN_SUGGESTION_INPUT_LENGTH) return false

  return rememberSuggestionPatterns.some((pattern) => normalizedInput.includes(pattern.toLocaleLowerCase()))
}
