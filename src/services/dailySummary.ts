export type DailySummaryInput = {
  focusCount: number
  focusMinutes: number
  completedTaskCount: number
  todayEnergy: number
  recentMoodTags: string[]
  dailyGoalAchieved?: boolean
}

export type DailySummary = {
  title: string
  lines: string[]
  footer: string
}

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function normalizeMoodTags(tags: string[]) {
  if (!Array.isArray(tags)) return []

  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3)
}

export function buildLocalDailySummary(input: DailySummaryInput): DailySummary {
  const safeInput: Partial<DailySummaryInput> =
    input && typeof input === 'object' ? input : {}
  const focusCount = safeCount(safeInput.focusCount ?? 0)
  const focusMinutes = safeCount(safeInput.focusMinutes ?? 0)
  const completedTaskCount = safeCount(safeInput.completedTaskCount ?? 0)
  const todayEnergy = safeCount(safeInput.todayEnergy ?? 0)
  const recentMoodTags = normalizeMoodTags(safeInput.recentMoodTags ?? [])

  const lines = [
    focusCount > 0
      ? `今天完成了 ${focusCount} 轮专注，共 ${focusMinutes} 分钟。`
      : '今天还没有完成专注，先从很小的一轮开始也可以。',
    completedTaskCount > 0
      ? `还完成了 ${completedTaskCount} 个小任务。`
      : '今天的小任务还可以慢慢来。',
    todayEnergy > 0
      ? `霍霍能量 +${todayEnergy}。`
      : '完成专注或小任务后，霍霍能量会慢慢增加。',
    recentMoodTags.length > 0
      ? `今天的状态像是：${recentMoodTags.join('、')}。`
      : '今天还没有记录状态。',
  ]

  const footer =
    focusCount === 0 && completedTaskCount === 0
      ? '不用一下子做很多，先开始一点点就好。'
      : safeInput.dailyGoalAchieved
        ? '今天的目标已经完成啦，辛苦了。'
        : focusMinutes >= 25
          ? '今天已经认真前进了一段路。'
          : completedTaskCount > 0
            ? '小任务也在一点点变少，已经很好了。'
            : '慢慢来，我会在旁边陪着。'

  return {
    title: '今日小结',
    lines,
    footer,
  }
}
