import { useEffect, useMemo, useRef, useState } from 'react'
import { petMessages, pickMessage } from '../copy/petMessages'
import { appendCompanionMemoryNote } from '../storage/companionMemory'
import { addGrowthEnergyEvent } from '../storage/growthEnergy'

export type PetMood = 'idle' | 'focus' | 'cheer' | 'sleepy'

type TimerStatus = 'idle' | 'preparing' | 'running' | 'completed' | 'breakPrompt' | 'resting' | 'restComplete'

const DEFAULT_SECONDS = 10 * 60
const DEFAULT_MINUTES = DEFAULT_SECONDS / 60
const BREAK_SECONDS = 5 * 60
const DAILY_RECORDS_KEY = 'focus-pet-daily-records'
const DAILY_GOAL_KEY = 'focus-pet-daily-goal'
const QUICK_TEST_KEY = 'focus-pet-dev-quick-test'
const SELECTED_DURATION_KEY = 'focusPet.selectedDurationMinutes'
const PREPARING_SECONDS = 3
const QUICK_TEST_SECONDS = 10
const FOCUS_DURATIONS = [5, 10, 25] as const
const DAILY_GOAL_OPTIONS = [1, 2, 3, 4] as const
const DEFAULT_DAILY_GOAL = 3

export type FocusRecord = {
  id: string
  completedAt: string
  durationMinutes: number
  goal?: string
}

type DailyFocusRecords = {
  date: string
  records: FocusRecord[]
}

type DailyFocusGoal = {
  date: string
  targetSessions: number
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatLocalTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function createEmptyDailyRecords(): DailyFocusRecords {
  return {
    date: formatLocalDate(),
    records: [],
  }
}

function readDailyRecords(): DailyFocusRecords {
  if (typeof window === 'undefined') return createEmptyDailyRecords()

  try {
    const raw = window.localStorage.getItem(DAILY_RECORDS_KEY)
    if (!raw) return createEmptyDailyRecords()

    const parsed = JSON.parse(raw) as DailyFocusRecords
    const today = formatLocalDate()
    if (
      parsed.date !== today ||
      !Array.isArray(parsed.records) ||
      !parsed.records.every(
        (record) =>
          typeof record.id === 'string' &&
          typeof record.completedAt === 'string' &&
          typeof record.durationMinutes === 'number' &&
          (record.goal === undefined || typeof record.goal === 'string'),
      )
    ) {
      return createEmptyDailyRecords()
    }

    return parsed
  } catch {
    return createEmptyDailyRecords()
  }
}

function writeDailyRecords(records: DailyFocusRecords) {
  window.localStorage.setItem(DAILY_RECORDS_KEY, JSON.stringify(records))
}

function createDefaultDailyGoal(): DailyFocusGoal {
  return {
    date: formatLocalDate(),
    targetSessions: DEFAULT_DAILY_GOAL,
  }
}

function normalizeDailyGoal(target: number) {
  return DAILY_GOAL_OPTIONS.includes(target as (typeof DAILY_GOAL_OPTIONS)[number])
    ? target
    : DEFAULT_DAILY_GOAL
}

function readDailyGoal(): DailyFocusGoal {
  if (typeof window === 'undefined') return createDefaultDailyGoal()

  try {
    const raw = window.localStorage.getItem(DAILY_GOAL_KEY)
    if (!raw) return createDefaultDailyGoal()

    const parsed = JSON.parse(raw) as DailyFocusGoal
    const today = formatLocalDate()
    if (parsed.date !== today || typeof parsed.targetSessions !== 'number') {
      return createDefaultDailyGoal()
    }

    return {
      date: today,
      targetSessions: normalizeDailyGoal(parsed.targetSessions),
    }
  } catch {
    return createDefaultDailyGoal()
  }
}

function writeDailyGoal(goal: DailyFocusGoal) {
  window.localStorage.setItem(DAILY_GOAL_KEY, JSON.stringify(goal))
}

function readQuickTestMode() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  return window.localStorage.getItem(QUICK_TEST_KEY) === 'true'
}

function writeQuickTestMode(enabled: boolean) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  window.localStorage.setItem(QUICK_TEST_KEY, String(enabled))
}

function normalizeDuration(minutes: number) {
  return FOCUS_DURATIONS.includes(minutes as (typeof FOCUS_DURATIONS)[number])
    ? minutes
    : DEFAULT_MINUTES
}

function readSelectedDurationMinutes() {
  if (typeof window === 'undefined') return DEFAULT_MINUTES

  const raw = window.localStorage.getItem(SELECTED_DURATION_KEY)
  if (!raw) return DEFAULT_MINUTES

  return normalizeDuration(Number(raw))
}

function writeSelectedDurationMinutes(minutes: number) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SELECTED_DURATION_KEY, String(normalizeDuration(minutes)))
}

function getActualDurationSeconds(minutes: number, quickTestMode: boolean) {
  return quickTestMode ? QUICK_TEST_SECONDS : minutes * 60
}

function getActualBreakSeconds(quickTestMode: boolean) {
  return quickTestMode ? QUICK_TEST_SECONDS : BREAK_SECONDS
}

function pickFocusStartMessage(goal: string) {
  return pickMessage(goal.trim() ? 'focusing' : 'emptyGoal')
}

export function usePetState() {
  const [mood, setMood] = useState<PetMood>('idle')
  const [message, setMessage] = useState(() => pickMessage('idle'))
  const [timerStatus, setTimerStatus] = useState<TimerStatus>('idle')
  const [quickTestMode, setQuickTestModeState] = useState(() => readQuickTestMode())
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState(() => readSelectedDurationMinutes())
  const [preparingSecondsLeft, setPreparingSecondsLeft] = useState(PREPARING_SECONDS)
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getActualDurationSeconds(readSelectedDurationMinutes(), readQuickTestMode()),
  )
  const [lastFocusDurationMinutes, setLastFocusDurationMinutes] = useState(() => readSelectedDurationMinutes())
  const [currentGoal, setCurrentGoal] = useState('')
  const [dailyGoal, setDailyGoal] = useState<DailyFocusGoal>(() => {
    const goal = readDailyGoal()
    writeDailyGoal(goal)
    return goal
  })
  const [dailyRecords, setDailyRecords] = useState<DailyFocusRecords>(() => {
    const records = readDailyRecords()
    writeDailyRecords(records)
    return records
  })
  const [completionText, setCompletionText] = useState<string | null>(null)

  const startTimeRef = useRef(0)
  const totalRef = useRef(getActualDurationSeconds(selectedDurationMinutes, quickTestMode))
  const selectedDurationRef = useRef(selectedDurationMinutes)
  const activeDurationRef = useRef(selectedDurationMinutes)
  const activeGoalRef = useRef('')
  const preparingTimerRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const cheerTimerRef = useRef<number | null>(null)

  const isPreparing = timerStatus === 'preparing'
  const isFocusing = timerStatus === 'running'
  const isBreakPrompt = timerStatus === 'breakPrompt'
  const isRestComplete = timerStatus === 'restComplete'
  const isResting = timerStatus === 'resting'
  const todayRecords = dailyRecords.records
  const todaySessionCount = todayRecords.length
  const todayTotalMinutes = todayRecords.reduce(
    (total, record) => total + record.durationMinutes,
    0,
  )
  const todayGoal = dailyGoal.targetSessions
  const remainingGoalSessions = Math.max(todayGoal - todaySessionCount, 0)
  const isTodayGoalCompleted = todaySessionCount >= todayGoal

  function clearIntervalRef() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function clearPreparingTimerRef() {
    if (preparingTimerRef.current !== null) {
      window.clearInterval(preparingTimerRef.current)
      preparingTimerRef.current = null
    }
  }

  function clearCheerTimerRef() {
    if (cheerTimerRef.current !== null) {
      window.clearTimeout(cheerTimerRef.current)
      cheerTimerRef.current = null
    }
  }

  function scheduleIdleAfterCheer(delayMs: number) {
    clearCheerTimerRef()
    cheerTimerRef.current = window.setTimeout(() => {
      setMood('idle')
      setTimerStatus('idle')
      setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
      setCompletionText(null)
      setMessage(pickMessage('idle'))
      cheerTimerRef.current = null
    }, delayMs)
  }

  function scheduleBreakPromptAfterCheer(delayMs: number) {
    clearCheerTimerRef()
    cheerTimerRef.current = window.setTimeout(() => {
      setMood('idle')
      setTimerStatus('breakPrompt')
      setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
      setCompletionText(pickMessage('completed'))
      cheerTimerRef.current = null
    }, delayMs)
  }

  function beginFocusTimer(duration: number, goal: string) {
    const durationSeconds = getActualDurationSeconds(duration, quickTestMode)

    clearIntervalRef()
    startTimeRef.current = Date.now()
    totalRef.current = durationSeconds
    activeDurationRef.current = duration
    activeGoalRef.current = goal

    setMood('focus')
    setMessage(pickFocusStartMessage(goal))
    setTimerStatus('running')
    setRemainingSeconds(durationSeconds)

    intervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const remaining = Math.max(0, totalRef.current - elapsed)

      setRemainingSeconds(remaining)

      if (remaining <= 0) {
        clearIntervalRef()
        setTimerStatus('completed')
        addCompletedRecord(activeDurationRef.current, activeGoalRef.current)
        setCurrentGoal('')
        setMood('cheer')
        scheduleBreakPromptAfterCheer(6000)
      }
    }, 250)
  }

  function addCompletedRecord(durationMinutes: number, goal: string) {
    const now = new Date()
    const today = formatLocalDate(now)
    const trimmedGoal = goal.trim()
    const record: FocusRecord = {
      id: Date.now().toString(),
      completedAt: formatLocalTime(now),
      durationMinutes,
      goal: trimmedGoal || undefined,
    }

    addGrowthEnergyEvent('focus', record.id)

    appendCompanionMemoryNote({
      id: `focus-${record.id}`,
      type: 'focus',
      text: trimmedGoal
        ? `完成了一轮 ${durationMinutes} 分钟专注：${trimmedGoal}`
        : `完成了一轮 ${durationMinutes} 分钟专注`,
      createdAt: now.toISOString(),
    })

    setDailyRecords((current) => {
      const baseRecords = current.date === today ? current.records : []
      const nextRecords = [record, ...baseRecords]
      const next = {
        date: today,
        records: nextRecords,
      }

      writeDailyRecords(next)
      setCompletionText(`${pickMessage('completed')}\n今天第 ${nextRecords.length} 次专注。`)

      return next
    })
  }

  useEffect(() => {
    if (timerStatus === 'idle' && mood === 'idle') {
      setMessage(pickMessage('idle'))
      return
    }

    if (timerStatus === 'idle' && mood === 'sleepy') {
      setMessage(pickMessage('resting'))
      return
    }

    if (timerStatus === 'preparing') {
      return
    }

    if (timerStatus === 'resting') {
      setMessage(pickMessage('resting'))
      return
    }

    if (timerStatus === 'restComplete') {
      setMessage(pickMessage('restFinished'))
      return
    }

    if (timerStatus === 'completed' || timerStatus === 'breakPrompt' || mood === 'cheer') {
      setMessage(pickMessage('completed'))
      return
    }

    if (timerStatus === 'running') {
      setMessage(pickFocusStartMessage(activeGoalRef.current))
    }
  }, [mood, timerStatus])

  useEffect(() => {
    return () => {
      clearPreparingTimerRef()
      clearIntervalRef()
      clearCheerTimerRef()
    }
  }, [])

  const displayText = useMemo(() => {
    if (isPreparing) {
      return `${message}\n${preparingSecondsLeft} 秒后开始`
    }

    if (isResting) {
      return `休息中 ${formatTime(remainingSeconds)}\n${message}`
    }

    if (!isFocusing) return completionText ?? message

    const goal = activeGoalRef.current
    if (!goal) return `${formatTime(remainingSeconds)}\n${message}`

    const shortGoal = goal.length > 12 ? `${goal.slice(0, 12)}...` : goal
    return `${formatTime(remainingSeconds)}\n${shortGoal}`
  }, [completionText, isFocusing, isPreparing, isResting, message, preparingSecondsLeft, remainingSeconds])

  function updateCurrentGoal(goal: string) {
    if (timerStatus === 'preparing' || timerStatus === 'running' || timerStatus === 'resting') return
    setCurrentGoal(goal)
  }

  function selectDuration(minutes: number) {
    if (timerStatus === 'preparing' || timerStatus === 'running' || timerStatus === 'resting') return

    const duration = normalizeDuration(minutes)
    selectedDurationRef.current = duration
    writeSelectedDurationMinutes(duration)
    setSelectedDurationMinutes(duration)
    setRemainingSeconds(getActualDurationSeconds(duration, quickTestMode))
  }

  function updateTodayGoal(target: number) {
    const today = formatLocalDate()
    const next = {
      date: today,
      targetSessions: normalizeDailyGoal(target),
    }

    setDailyGoal(next)
    writeDailyGoal(next)
  }

  function toggleQuickTestMode() {
    if (!import.meta.env.DEV || timerStatus === 'preparing' || timerStatus === 'running' || timerStatus === 'resting') return

    setQuickTestModeState((enabled) => {
      const next = !enabled
      writeQuickTestMode(next)
      setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, next))
      return next
    })
  }

  function startFocus(
    durationMinutes = selectedDurationMinutes,
    options: { goal?: string; rememberDuration?: boolean } = {},
  ) {
    if (timerStatus === 'preparing' || timerStatus === 'running') return

    clearPreparingTimerRef()
    clearIntervalRef()
    clearCheerTimerRef()
    setCompletionText(null)

    const duration = normalizeDuration(durationMinutes)
    const goal = (options.goal ?? currentGoal).trim()
    const rememberDuration = options.rememberDuration ?? true

    if (rememberDuration) {
      selectedDurationRef.current = duration
      writeSelectedDurationMinutes(duration)
      setSelectedDurationMinutes(duration)
    }
    activeGoalRef.current = goal

    setMood('focus')
    setMessage(pickMessage('preparing'))
    setTimerStatus('preparing')
    setLastFocusDurationMinutes(duration)
    setPreparingSecondsLeft(PREPARING_SECONDS)
    setRemainingSeconds(getActualDurationSeconds(duration, quickTestMode))

    let secondsLeft = PREPARING_SECONDS
    preparingTimerRef.current = window.setInterval(() => {
      secondsLeft -= 1

      if (secondsLeft <= 0) {
        clearPreparingTimerRef()
        beginFocusTimer(duration, goal)
        return
      }

      setPreparingSecondsLeft(secondsLeft)
    }, 1000)
  }

  function startBreak() {
    if (timerStatus === 'preparing' || timerStatus === 'running' || timerStatus === 'resting') return

    clearPreparingTimerRef()
    clearIntervalRef()
    clearCheerTimerRef()
    setCompletionText(null)
    activeGoalRef.current = ''
    setCurrentGoal('')

    startTimeRef.current = Date.now()
    totalRef.current = getActualBreakSeconds(quickTestMode)

    setMood('sleepy')
    setMessage(pickMessage('resting'))
    setTimerStatus('resting')
    setRemainingSeconds(totalRef.current)

    intervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const remaining = Math.max(0, totalRef.current - elapsed)

      setRemainingSeconds(remaining)

      if (remaining <= 0) {
        clearIntervalRef()
        setMood('idle')
        setTimerStatus('restComplete')
        setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
        setCompletionText(pickMessage('restFinished'))
      }
    }, 250)
  }

  function endBreak() {
    if (timerStatus !== 'resting') return

    clearPreparingTimerRef()
    clearIntervalRef()
    clearCheerTimerRef()
    setMood('idle')
    setMessage(pickMessage('idle'))
    setTimerStatus('idle')
    setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
    setCompletionText(null)
  }

  function dismissBreakPrompt() {
    if (timerStatus !== 'breakPrompt') return

    clearPreparingTimerRef()
    clearCheerTimerRef()
    setMood('idle')
    setMessage(pickMessage('idle'))
    setTimerStatus('idle')
    setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
    setCompletionText(null)
  }

  function prepareNextFocus(durationMinutes = lastFocusDurationMinutes) {
    if (timerStatus !== 'restComplete') return

    const duration = normalizeDuration(durationMinutes)
    selectedDurationRef.current = duration
    activeGoalRef.current = ''
    writeSelectedDurationMinutes(duration)

    setMood('idle')
    setTimerStatus('idle')
    setSelectedDurationMinutes(duration)
    setRemainingSeconds(getActualDurationSeconds(duration, quickTestMode))
    setCurrentGoal('')
    setCompletionText(null)
    setMessage(pickMessage('ready'))
  }

  function dismissRestComplete() {
    if (timerStatus !== 'restComplete') return

    setMood('idle')
    setMessage(pickMessage('idle'))
    setTimerStatus('idle')
    setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
    setCompletionText(null)
  }

  function endFocus() {
    clearPreparingTimerRef()
    clearIntervalRef()
    clearCheerTimerRef()
    setCompletionText(null)
    activeGoalRef.current = ''
    setCurrentGoal('')
    setTimerStatus('idle')
    setMood('idle')
    setMessage(pickMessage('idle'))
    setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
  }

  function rest() {
    if (timerStatus !== 'idle') return

    clearPreparingTimerRef()
    clearCheerTimerRef()
    setCompletionText(null)
    setTimerStatus('idle')
    setMood('sleepy')
    setMessage(pickMessage('resting'))
    setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
  }

  function cheer() {
    if (timerStatus !== 'idle') return

    clearPreparingTimerRef()
    clearCheerTimerRef()
    setCompletionText(null)
    setTimerStatus('idle')
    setMood('cheer')
    setMessage(pickMessage('completed'))
    setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
    scheduleIdleAfterCheer(3500)
  }

  function reset() {
    clearPreparingTimerRef()
    clearIntervalRef()
    clearCheerTimerRef()
    setCompletionText(null)
    setTimerStatus('idle')
    setMood('idle')
    setMessage(pickMessage('idle'))
    setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
  }

  function cancelPreparing() {
    if (timerStatus !== 'preparing') return

    clearPreparingTimerRef()
    clearIntervalRef()
    clearCheerTimerRef()
    setCompletionText(null)
    setTimerStatus('idle')
    setMood('idle')
    setMessage(pickMessage('idle'))
    setPreparingSecondsLeft(PREPARING_SECONDS)
    setRemainingSeconds(getActualDurationSeconds(selectedDurationRef.current, quickTestMode))
  }

  return {
    cancelPreparing,
    cheer,
    currentGoal,
    dismissBreakPrompt,
    dismissRestComplete,
    displayText,
    endBreak,
    endFocus,
    focusDurations: FOCUS_DURATIONS,
    isDevMode: import.meta.env.DEV,
    isBreakPrompt,
    isFocusing,
    isPreparing,
    isRestComplete,
    isResting,
    lastFocusDurationMinutes,
    message,
    mood,
    preparingSecondsLeft,
    remainingSeconds,
    prepareNextFocus,
    reset,
    rest,
    remainingGoalSessions,
    selectDuration,
    selectedDurationMinutes,
    sessions: todaySessionCount,
    startBreak,
    startFocus,
    isQuickTestMode: quickTestMode,
    isTodayGoalCompleted,
    dailyGoalOptions: DAILY_GOAL_OPTIONS,
    todayRecords,
    todayGoal,
    todaySessionCount,
    todayTotalMinutes,
    timerStatus,
    toggleQuickTestMode,
    updateCurrentGoal,
    updateTodayGoal,
  }
}
