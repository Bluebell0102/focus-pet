export type AiProvider = 'none' | 'openai-compatible'

export type AiSettings = {
  version: 1
  chatEnabled: boolean
  provider: AiProvider
  baseUrl: string
  apiKey: string
  model: string
}

export const AI_SETTINGS_KEY = 'focusPet.aiSettings'

const defaultAiSettings: AiSettings = {
  version: 1,
  chatEnabled: false,
  provider: 'none',
  baseUrl: '',
  apiKey: '',
  model: '',
}

function hasLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function normalizeAiSettings(value: unknown): AiSettings {
  if (!value || typeof value !== 'object') return defaultAiSettings

  const settings = value as Partial<AiSettings>
  return {
    version: 1,
    chatEnabled: settings.chatEnabled === true,
    provider: settings.provider === 'openai-compatible' ? 'openai-compatible' : 'none',
    baseUrl: typeof settings.baseUrl === 'string' ? settings.baseUrl : '',
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    model: typeof settings.model === 'string' ? settings.model : '',
  }
}

export function getAiSettings(): AiSettings {
  if (!hasLocalStorage()) return defaultAiSettings

  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_KEY)
    if (!raw) {
      saveAiSettings(defaultAiSettings)
      return defaultAiSettings
    }

    return normalizeAiSettings(JSON.parse(raw))
  } catch (error) {
    console.warn('Failed to read AI settings.', error)
    return defaultAiSettings
  }
}

export function saveAiSettings(settings: AiSettings) {
  const normalized = normalizeAiSettings(settings)
  if (!hasLocalStorage()) return normalized

  try {
    window.localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(normalized))
  } catch (error) {
    console.warn('Failed to save AI settings.', error)
  }

  return normalized
}

export function updateAiSettings(partial: Partial<AiSettings>) {
  return saveAiSettings({
    ...getAiSettings(),
    ...partial,
  })
}

export function resetAiSettings() {
  return saveAiSettings(defaultAiSettings)
}

export function hasAiApiKey() {
  return getAiSettings().apiKey.trim().length > 0
}
