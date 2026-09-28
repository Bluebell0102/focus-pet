export type MicroTaskStatus = 'active' | 'completed'

export type MicroTask = {
  id: string
  text: string
  status: MicroTaskStatus
  createdAt: string
  completedAt?: string
}

export type MicroTaskState = {
  version: 1
  tasks: MicroTask[]
}

export const MICRO_TASKS_KEY = 'focusPet.microTasks'

const MAX_MICRO_TASKS = 50
const MAX_MICRO_TASK_TEXT_LENGTH = 40

const defaultMicroTaskState: MicroTaskState = {
  version: 1,
  tasks: [],
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

function normalizeTaskText(text: string) {
  return text.trim().slice(0, MAX_MICRO_TASK_TEXT_LENGTH)
}

function normalizeMicroTaskState(value: unknown): MicroTaskState {
  if (!value || typeof value !== 'object') return defaultMicroTaskState

  const state = value as Partial<MicroTaskState>
  const tasks = Array.isArray(state.tasks)
    ? state.tasks
        .filter(
          (task): task is MicroTask =>
            task &&
            typeof task.id === 'string' &&
            typeof task.text === 'string' &&
            (task.status === 'active' || task.status === 'completed') &&
            typeof task.createdAt === 'string' &&
            (task.completedAt === undefined || typeof task.completedAt === 'string'),
        )
        .map((task) => ({
          ...task,
          text: normalizeTaskText(task.text),
        }))
        .filter((task) => task.text.length > 0)
        .slice(0, MAX_MICRO_TASKS)
    : []

  return {
    version: 1,
    tasks,
  }
}

export function getMicroTaskState(): MicroTaskState {
  if (!hasLocalStorage()) return defaultMicroTaskState

  try {
    const raw = window.localStorage.getItem(MICRO_TASKS_KEY)
    if (!raw) {
      saveMicroTaskState(defaultMicroTaskState)
      return defaultMicroTaskState
    }

    return normalizeMicroTaskState(JSON.parse(raw))
  } catch (error) {
    console.warn('Failed to read micro tasks.', error)
    return defaultMicroTaskState
  }
}

export function saveMicroTaskState(state: MicroTaskState) {
  const normalized = normalizeMicroTaskState(state)
  if (!hasLocalStorage()) return normalized

  try {
    window.localStorage.setItem(MICRO_TASKS_KEY, JSON.stringify(normalized))
  } catch (error) {
    console.warn('Failed to save micro tasks.', error)
  }

  return normalized
}

export function addMicroTask(text: string) {
  const normalizedText = normalizeTaskText(text)
  const current = getMicroTaskState()
  if (!normalizedText) return current
  const task: MicroTask = {
    id: `micro-task-${Date.now()}`,
    text: normalizedText,
    status: 'active',
    createdAt: new Date().toISOString(),
  }

  return saveMicroTaskState({
    version: 1,
    tasks: [task, ...current.tasks].slice(0, MAX_MICRO_TASKS),
  })
}

export function completeMicroTask(id: string) {
  const current = getMicroTaskState()
  const completedAt = new Date().toISOString()

  return saveMicroTaskState({
    version: 1,
    tasks: current.tasks.map((task) =>
      task.id === id && task.status === 'active'
        ? {
            ...task,
            status: 'completed',
            completedAt,
          }
        : task,
    ),
  })
}

export function deleteMicroTask(id: string) {
  const current = getMicroTaskState()

  return saveMicroTaskState({
    version: 1,
    tasks: current.tasks.filter((task) => task.id !== id),
  })
}

export function getActiveMicroTasks() {
  return getMicroTaskState().tasks.filter((task) => task.status === 'active')
}

export function getTodayCompletedMicroTasks() {
  const today = formatLocalDate()

  return getMicroTaskState().tasks.filter(
    (task) =>
      task.status === 'completed' &&
      task.completedAt !== undefined &&
      formatLocalDate(new Date(task.completedAt)) === today,
  )
}

export function clearCompletedMicroTasks() {
  const current = getMicroTaskState()

  return saveMicroTaskState({
    version: 1,
    tasks: current.tasks.filter((task) => task.status !== 'completed'),
  })
}
