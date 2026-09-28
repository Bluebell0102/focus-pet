export type ProactiveCompanionSettings = {
  version: 1
  enabled: boolean
  lastNudgeAt?: string
}

export const PROACTIVE_COMPANION_SETTINGS_KEY = 'focusPet.proactiveCompanionSettings'

const defaultProactiveCompanionSettings: ProactiveCompanionSettings = {
  version: 1,
  enabled: true,
}

function hasLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function normalizeProactiveCompanionSettings(value: unknown): ProactiveCompanionSettings {
  if (!value || typeof value !== 'object') return defaultProactiveCompanionSettings

  const settings = value as Partial<ProactiveCompanionSettings>
  return {
    version: 1,
    enabled: typeof settings.enabled === 'boolean' ? settings.enabled : true,
    lastNudgeAt: typeof settings.lastNudgeAt === 'string' ? settings.lastNudgeAt : undefined,
  }
}

export function getProactiveCompanionSettings(): ProactiveCompanionSettings {
  if (!hasLocalStorage()) return defaultProactiveCompanionSettings

  try {
    const raw = window.localStorage.getItem(PROACTIVE_COMPANION_SETTINGS_KEY)
    if (!raw) {
      saveProactiveCompanionSettings(defaultProactiveCompanionSettings)
      return defaultProactiveCompanionSettings
    }

    return normalizeProactiveCompanionSettings(JSON.parse(raw))
  } catch (error) {
    console.warn('Failed to read proactive companion settings.', error)
    return defaultProactiveCompanionSettings
  }
}

export function saveProactiveCompanionSettings(settings: ProactiveCompanionSettings) {
  const normalized = normalizeProactiveCompanionSettings(settings)
  if (!hasLocalStorage()) return normalized

  try {
    window.localStorage.setItem(PROACTIVE_COMPANION_SETTINGS_KEY, JSON.stringify(normalized))
  } catch (error) {
    console.warn('Failed to save proactive companion settings.', error)
  }

  return normalized
}

export function saveProactiveCompanionEnabled(enabled: boolean) {
  return saveProactiveCompanionSettings({
    ...getProactiveCompanionSettings(),
    enabled,
  })
}

export function saveProactiveCompanionLastNudgeAt(lastNudgeAt: string) {
  return saveProactiveCompanionSettings({
    ...getProactiveCompanionSettings(),
    lastNudgeAt,
  })
}
