export type GrowthEnergySource = 'focus' | 'micro-task'

export type GrowthEnergyEvent = {
  id: string
  source: GrowthEnergySource
  amount: number
  createdAt: string
  refId?: string
}

export type GrowthEnergyState = {
  version: 1
  events: GrowthEnergyEvent[]
}

export const GROWTH_ENERGY_KEY = 'focusPet.growthEnergy'

const MAX_GROWTH_ENERGY_EVENTS = 100
const ENERGY_AMOUNT = 1

const defaultGrowthEnergyState: GrowthEnergyState = {
  version: 1,
  events: [],
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

function normalizeGrowthEnergyState(value: unknown): GrowthEnergyState {
  if (!value || typeof value !== 'object') return defaultGrowthEnergyState

  const state = value as Partial<GrowthEnergyState>
  const events = Array.isArray(state.events)
    ? state.events
        .filter(
          (event): event is GrowthEnergyEvent =>
            event &&
            typeof event.id === 'string' &&
            (event.source === 'focus' || event.source === 'micro-task') &&
            typeof event.amount === 'number' &&
            typeof event.createdAt === 'string' &&
            (event.refId === undefined || typeof event.refId === 'string'),
        )
        .map((event) => ({
          ...event,
          amount: ENERGY_AMOUNT,
        }))
        .slice(0, MAX_GROWTH_ENERGY_EVENTS)
    : []

  return {
    version: 1,
    events,
  }
}

export function getGrowthEnergyState(): GrowthEnergyState {
  if (!hasLocalStorage()) return defaultGrowthEnergyState

  try {
    const raw = window.localStorage.getItem(GROWTH_ENERGY_KEY)
    if (!raw) {
      saveGrowthEnergyState(defaultGrowthEnergyState)
      return defaultGrowthEnergyState
    }

    return normalizeGrowthEnergyState(JSON.parse(raw))
  } catch (error) {
    console.warn('Failed to read growth energy.', error)
    return defaultGrowthEnergyState
  }
}

export function saveGrowthEnergyState(state: GrowthEnergyState) {
  const normalized = normalizeGrowthEnergyState(state)
  if (!hasLocalStorage()) return normalized

  try {
    window.localStorage.setItem(GROWTH_ENERGY_KEY, JSON.stringify(normalized))
  } catch (error) {
    console.warn('Failed to save growth energy.', error)
  }

  return normalized
}

export function addGrowthEnergyEvent(source: GrowthEnergySource, refId?: string) {
  const current = getGrowthEnergyState()
  if (refId && current.events.some((event) => event.source === source && event.refId === refId)) {
    return current
  }

  const now = new Date()
  const event: GrowthEnergyEvent = {
    id: `growth-${source}-${refId ?? now.getTime()}-${now.getTime()}`,
    source,
    amount: ENERGY_AMOUNT,
    createdAt: now.toISOString(),
    ...(refId ? { refId } : {}),
  }

  return saveGrowthEnergyState({
    version: 1,
    events: [event, ...current.events].slice(0, MAX_GROWTH_ENERGY_EVENTS),
  })
}

export function getTodayGrowthEnergyEvents(state = getGrowthEnergyState()) {
  const today = formatLocalDate()

  return state.events.filter((event) => {
    const createdAt = new Date(event.createdAt)
    if (Number.isNaN(createdAt.getTime())) return false

    return formatLocalDate(createdAt) === today
  })
}

export function getTodayGrowthEnergy(state = getGrowthEnergyState()) {
  return getTodayGrowthEnergyEvents(state).reduce((total, event) => total + event.amount, 0)
}

export function clearGrowthEnergyEvents() {
  return saveGrowthEnergyState(defaultGrowthEnergyState)
}
