export type ProactivePetStatus =
  | 'idle'
  | 'preparing'
  | 'focusing'
  | 'distraction'
  | 'completed'
  | 'breakPrompt'
  | 'resting'
  | 'restComplete'

export type ProactiveNudge = {
  id: string
  text: string
  reason: 'idle' | 'no-focus-today' | 'rest-complete' | 'daily-goal-done'
}

export type ProactiveNudgeContext = {
  status: ProactivePetStatus
  todayFocusCount: number
  dailyGoalAchieved: boolean
  appIdleMs: number
  lastNudgeAt?: string
  panelOpen: boolean
}

const MIN_NUDGE_INTERVAL_MS = 30 * 60 * 1000
const STARTUP_GRACE_MS = 5 * 60 * 1000
const LONG_IDLE_MS = 20 * 60 * 1000

const idleNudges = [
  '要不要先来 5 分钟？我会在旁边陪着。',
  '先从很小的一轮开始也可以。',
  '不用一下子做很多，先开始一点点就好。',
]

const restCompleteNudges = [
  '休息好了吗？要不要再来一小轮？',
  '再来一轮也可以，不来也没关系。',
]

const dailyGoalDoneNudges = [
  '今天的目标已经完成啦，辛苦了。',
  '已经很不错了，后面可以轻一点。',
]

function pickByDay(messages: string[], salt: string) {
  const today = new Date().toDateString()
  const seed = `${today}-${salt}`.split('').reduce((total, char) => total + char.charCodeAt(0), 0)
  return messages[seed % messages.length]
}

function parseTime(value?: string) {
  if (!value) return null

  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export function getProactiveNudge(context: ProactiveNudgeContext): ProactiveNudge | null {
  if (context.status === 'preparing' || context.status === 'focusing' || context.status === 'distraction') {
    return null
  }

  if (context.status === 'completed' || context.status === 'breakPrompt' || context.status === 'resting') {
    return null
  }

  if (context.panelOpen) return null

  const lastNudgeTime = parseTime(context.lastNudgeAt)
  if (lastNudgeTime !== null && Date.now() - lastNudgeTime < MIN_NUDGE_INTERVAL_MS) return null

  if (context.status === 'restComplete') {
    return {
      id: 'rest-complete',
      reason: 'rest-complete',
      text: pickByDay(restCompleteNudges, 'rest-complete'),
    }
  }

  if (context.dailyGoalAchieved && context.todayFocusCount > 0) {
    return {
      id: 'daily-goal-done',
      reason: 'daily-goal-done',
      text: pickByDay(dailyGoalDoneNudges, 'daily-goal-done'),
    }
  }

  if (context.status === 'idle' && context.todayFocusCount === 0 && context.appIdleMs >= LONG_IDLE_MS) {
    return {
      id: 'long-idle',
      reason: 'idle',
      text: pickByDay(idleNudges, 'long-idle'),
    }
  }

  if (context.status === 'idle' && context.todayFocusCount === 0 && context.appIdleMs >= STARTUP_GRACE_MS) {
    return {
      id: 'no-focus-today',
      reason: 'no-focus-today',
      text: pickByDay(idleNudges, 'no-focus-today'),
    }
  }

  return null
}
