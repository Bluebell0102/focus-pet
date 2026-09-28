export type DailyDiarySource = 'ai'

export type DailyDiary = {
  id: string
  date: string
  source: DailyDiarySource
  title: string
  text: string
  summarySnapshot: {
    title: string
    lines: string[]
    footer: string
  }
  createdAt: string
}

export type DailyDiaryState = {
  version: 1
  diaries: DailyDiary[]
}

export type AddDailyDiaryInput = {
  title: string
  text: string
  summarySnapshot: {
    title: string
    lines: string[]
    footer: string
  }
}

export type AddDailyDiaryResult = {
  state: DailyDiaryState
  diary?: DailyDiary
  saved: boolean
  duplicate: boolean
}

export const DAILY_DIARIES_KEY = 'focusPet.dailyDiaries'

const MAX_DAILY_DIARIES = 100
const MAX_DIARY_TEXT_LENGTH = 1000
const MAX_SUMMARY_TITLE_LENGTH = 80
const MAX_SUMMARY_LINE_LENGTH = 140
const MAX_SUMMARY_LINES = 6

const defaultDailyDiaryState: DailyDiaryState = {
  version: 1,
  diaries: [],
}

function hasLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''

  return value.trim().slice(0, maxLength)
}

function normalizeSummarySnapshot(value: unknown): DailyDiary['summarySnapshot'] {
  const snapshot =
    value && typeof value === 'object'
      ? (value as Partial<DailyDiary['summarySnapshot']>)
      : {}

  return {
    title: normalizeText(snapshot.title, MAX_SUMMARY_TITLE_LENGTH),
    lines: Array.isArray(snapshot.lines)
      ? snapshot.lines
          .map((line) => normalizeText(line, MAX_SUMMARY_LINE_LENGTH))
          .filter(Boolean)
          .slice(0, MAX_SUMMARY_LINES)
      : [],
    footer: normalizeText(snapshot.footer, MAX_SUMMARY_LINE_LENGTH),
  }
}

function normalizeDailyDiary(value: unknown): DailyDiary | null {
  if (!value || typeof value !== 'object') return null

  const diary = value as Partial<DailyDiary>
  const text = normalizeText(diary.text, MAX_DIARY_TEXT_LENGTH)
  if (!text) return null

  return {
    id: typeof diary.id === 'string' && diary.id.trim() ? diary.id : `daily-diary-${Date.now()}`,
    date: typeof diary.date === 'string' && diary.date.trim() ? diary.date : formatLocalDate(),
    source: 'ai',
    title: normalizeText(diary.title, MAX_SUMMARY_TITLE_LENGTH) || '霍霍写的小日记',
    text,
    summarySnapshot: normalizeSummarySnapshot(diary.summarySnapshot),
    createdAt:
      typeof diary.createdAt === 'string' && diary.createdAt.trim()
        ? diary.createdAt
        : new Date().toISOString(),
  }
}

function normalizeDailyDiaryState(value: unknown): DailyDiaryState {
  if (!value || typeof value !== 'object') return defaultDailyDiaryState

  const state = value as Partial<DailyDiaryState>
  const diaries = Array.isArray(state.diaries)
    ? state.diaries
        .map(normalizeDailyDiary)
        .filter((diary): diary is DailyDiary => diary !== null)
        .slice(0, MAX_DAILY_DIARIES)
    : []

  return {
    version: 1,
    diaries,
  }
}

export function getDailyDiaryState(): DailyDiaryState {
  if (!hasLocalStorage()) return defaultDailyDiaryState

  try {
    const raw = window.localStorage.getItem(DAILY_DIARIES_KEY)
    if (!raw) {
      saveDailyDiaryState(defaultDailyDiaryState)
      return defaultDailyDiaryState
    }

    return normalizeDailyDiaryState(JSON.parse(raw))
  } catch (error) {
    console.warn('Failed to read daily diaries.', error)
    return defaultDailyDiaryState
  }
}

export function saveDailyDiaryState(state: DailyDiaryState) {
  const normalized = normalizeDailyDiaryState(state)
  if (!hasLocalStorage()) return normalized

  try {
    window.localStorage.setItem(DAILY_DIARIES_KEY, JSON.stringify(normalized))
  } catch (error) {
    console.warn('Failed to save daily diaries.', error)
  }

  return normalized
}

export function hasSavedDiaryByText(text: string) {
  const normalizedText = normalizeText(text, MAX_DIARY_TEXT_LENGTH)
  if (!normalizedText) return false

  const today = formatLocalDate()
  return getDailyDiaryState().diaries.some(
    (diary) => diary.date === today && diary.text.trim() === normalizedText,
  )
}

export function addDailyDiary(input: AddDailyDiaryInput): AddDailyDiaryResult {
  const text = normalizeText(input.text, MAX_DIARY_TEXT_LENGTH)
  const current = getDailyDiaryState()

  if (!text) {
    return {
      state: current,
      saved: false,
      duplicate: false,
    }
  }

  const today = formatLocalDate()
  const duplicateDiary = current.diaries.find(
    (diary) => diary.date === today && diary.text.trim() === text,
  )

  if (duplicateDiary) {
    return {
      state: current,
      diary: duplicateDiary,
      saved: false,
      duplicate: true,
    }
  }

  const diary: DailyDiary = {
    id: `daily-diary-${Date.now()}`,
    date: today,
    source: 'ai',
    title: normalizeText(input.title, MAX_SUMMARY_TITLE_LENGTH) || '霍霍写的小日记',
    text,
    summarySnapshot: normalizeSummarySnapshot(input.summarySnapshot),
    createdAt: new Date().toISOString(),
  }
  const nextState: DailyDiaryState = {
    version: 1,
    diaries: [diary, ...current.diaries].slice(0, MAX_DAILY_DIARIES),
  }
  saveDailyDiaryState(nextState)

  const state = getDailyDiaryState()
  const saved = state.diaries.some((savedDiary) => savedDiary.id === diary.id)

  return {
    state,
    diary: saved ? diary : undefined,
    saved,
    duplicate: false,
  }
}

export function getDailyDiaries() {
  return getDailyDiaryState().diaries
}

export function getRecentDailyDiaries(limit = 3) {
  const safeLimit = Math.max(0, Math.floor(limit) || 0)

  return [...getDailyDiaries()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, safeLimit)
}

export function getTodayDailyDiaries() {
  const today = formatLocalDate()

  return getDailyDiaries().filter((diary) => diary.date === today)
}

export function deleteDailyDiary(id: string) {
  const current = getDailyDiaryState()
  if (!id.trim()) return current

  return saveDailyDiaryState({
    version: 1,
    diaries: current.diaries.filter((diary) => diary.id !== id),
  })
}
