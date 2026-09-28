export type CompanionMemory = {
  version: 1
  userPreferences: {
    preferredFocusMinutes?: number
    preferredTone?: 'gentle' | 'quiet' | 'encouraging'
  }
  companionProfile: {
    name: string
    personality: string
  }
  recentMoodTags: string[]
  notes: Array<{
    id: string
    type: 'focus' | 'mood' | 'note'
    text: string
    createdAt: string
  }>
}

export const AI_COMPANION_ENABLED_KEY = 'focusPet.aiCompanionEnabled'
export const COMPANION_MEMORY_KEY = 'focusPet.companionMemory'

const MAX_NOTES = 20
const MAX_MOOD_TAGS = 5
const MAX_AI_MEMORY_INPUT_LENGTH = 60
const MAX_AI_MEMORY_REPLY_LENGTH = 100

const defaultCompanionMemory: CompanionMemory = {
  version: 1,
  userPreferences: {
    preferredTone: 'gentle',
  },
  companionProfile: {
    name: '霍霍',
    personality: '胆小但认真，温柔陪你专注',
  },
  recentMoodTags: [],
  notes: [],
}

function hasLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function normalizeCompanionMemory(value: unknown): CompanionMemory {
  if (!value || typeof value !== 'object') return defaultCompanionMemory

  const memory = value as Partial<CompanionMemory>
  const userPreferences =
    memory.userPreferences && typeof memory.userPreferences === 'object'
      ? memory.userPreferences
      : defaultCompanionMemory.userPreferences
  const companionProfile =
    memory.companionProfile && typeof memory.companionProfile === 'object'
      ? memory.companionProfile
      : defaultCompanionMemory.companionProfile
  const notes = Array.isArray(memory.notes)
    ? memory.notes
        .filter(
          (note) =>
            note &&
            typeof note.id === 'string' &&
            (note.type === 'focus' || note.type === 'mood' || note.type === 'note') &&
            typeof note.text === 'string' &&
            typeof note.createdAt === 'string',
        )
        .slice(0, MAX_NOTES)
    : []

  return {
    version: 1,
    userPreferences: {
      preferredFocusMinutes:
        typeof userPreferences.preferredFocusMinutes === 'number'
          ? userPreferences.preferredFocusMinutes
          : undefined,
      preferredTone:
        userPreferences.preferredTone === 'quiet' || userPreferences.preferredTone === 'encouraging'
          ? userPreferences.preferredTone
          : 'gentle',
    },
    companionProfile: {
      name:
        typeof companionProfile.name === 'string'
          ? companionProfile.name
          : defaultCompanionMemory.companionProfile.name,
      personality:
        typeof companionProfile.personality === 'string'
          ? companionProfile.personality
          : defaultCompanionMemory.companionProfile.personality,
    },
    recentMoodTags: Array.isArray(memory.recentMoodTags)
      ? memory.recentMoodTags.filter((tag) => typeof tag === 'string').slice(0, MAX_MOOD_TAGS)
      : [],
    notes,
  }
}

export function getCompanionMemory(): CompanionMemory {
  if (!hasLocalStorage()) return defaultCompanionMemory

  try {
    const raw = window.localStorage.getItem(COMPANION_MEMORY_KEY)
    if (!raw) {
      saveCompanionMemory(defaultCompanionMemory)
      return defaultCompanionMemory
    }

    return normalizeCompanionMemory(JSON.parse(raw))
  } catch (error) {
    console.warn('Failed to read companion memory.', error)
    return defaultCompanionMemory
  }
}

export function saveCompanionMemory(memory: CompanionMemory) {
  if (!hasLocalStorage()) return

  try {
    const normalized = normalizeCompanionMemory(memory)
    window.localStorage.setItem(COMPANION_MEMORY_KEY, JSON.stringify(normalized))
  } catch (error) {
    console.warn('Failed to save companion memory.', error)
  }
}

export function updateCompanionMemory(partial: Partial<CompanionMemory>) {
  const current = getCompanionMemory()
  const next = normalizeCompanionMemory({
    ...current,
    ...partial,
    userPreferences: {
      ...current.userPreferences,
      ...partial.userPreferences,
    },
    companionProfile: {
      ...current.companionProfile,
      ...partial.companionProfile,
    },
  })

  saveCompanionMemory(next)
  return next
}

export function resetCompanionMemory() {
  saveCompanionMemory(defaultCompanionMemory)
  return defaultCompanionMemory
}

export function appendCompanionMemoryNote(note: CompanionMemory['notes'][number]) {
  const current = getCompanionMemory()
  const next = updateCompanionMemory({
    notes: [note, ...current.notes].slice(0, MAX_NOTES),
  })

  return next
}

function trimMemoryText(value: string, maxLength: number) {
  const trimmedValue = value.trim()
  if (trimmedValue.length <= maxLength) return trimmedValue

  return `${trimmedValue.slice(0, maxLength).replace(/[，。,.、；;：:\s]+$/, '')}……`
}

export function rememberAiReply(input: string, reply: string) {
  const trimmedInput = trimMemoryText(input, MAX_AI_MEMORY_INPUT_LENGTH)
  const trimmedReply = trimMemoryText(reply, MAX_AI_MEMORY_REPLY_LENGTH)
  if (!trimmedInput || !trimmedReply) return getCompanionMemory()

  return appendCompanionMemoryNote({
    id: `ai-note-${Date.now()}`,
    type: 'note',
    text: `问过霍霍：${trimmedInput}｜霍霍说：${trimmedReply}`,
    createdAt: new Date().toISOString(),
  })
}

export function clearCompanionNotes() {
  return updateCompanionMemory({
    recentMoodTags: [],
    notes: [],
  })
}

export function recordMoodTag(tag: string) {
  const trimmedTag = tag.trim()
  const current = getCompanionMemory()
  if (!trimmedTag) return current

  const recentMoodTags = [
    trimmedTag,
    ...current.recentMoodTags.filter((value) => value !== trimmedTag),
  ].slice(0, MAX_MOOD_TAGS)
  const moodNote: CompanionMemory['notes'][number] = {
    id: `mood-${Date.now()}`,
    type: 'mood',
    text: `今天的状态：${trimmedTag}`,
    createdAt: new Date().toISOString(),
  }

  return updateCompanionMemory({
    recentMoodTags,
    notes: [moodNote, ...current.notes].slice(0, MAX_NOTES),
  })
}

export function getAiCompanionEnabled() {
  if (!hasLocalStorage()) return false

  try {
    const raw = window.localStorage.getItem(AI_COMPANION_ENABLED_KEY)
    if (raw === null) {
      window.localStorage.setItem(AI_COMPANION_ENABLED_KEY, 'false')
      return false
    }

    return raw === 'true'
  } catch (error) {
    console.warn('Failed to read AI companion setting.', error)
    return false
  }
}

export function saveAiCompanionEnabled(enabled: boolean) {
  if (!hasLocalStorage()) return false

  try {
    window.localStorage.setItem(AI_COMPANION_ENABLED_KEY, String(enabled))
    return enabled
  } catch (error) {
    console.warn('Failed to save AI companion setting.', error)
    return false
  }
}
