import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Live2DPet, type Live2DPetState } from './components/Live2DPet'
import { petFeedbackText, petMessageTitles, petMessages, pickMessage } from './copy/petMessages'
import { usePetState } from './hooks/usePetState'
import {
  AiCompanionRequestCanceledError,
  AiCompanionRequestError,
  askAiCompanion,
  type AiCompanionTemporaryTurn,
} from './services/aiCompanion'
import {
  AiDiaryRequestCanceledError,
  AiDiaryRequestError,
  generateAiDiary,
} from './services/aiDiary'
import { buildLocalDailySummary } from './services/dailySummary'
import { shouldSuggestRemember } from './services/memorySuggestion'
import { getProactiveNudge, type ProactivePetStatus } from './services/proactiveCompanion'
import {
  getAiSettings,
  resetAiSettings,
  saveAiSettings,
  type AiSettings,
} from './storage/aiSettings'
import {
  clearCompanionNotes,
  getAiCompanionEnabled,
  getCompanionMemory,
  rememberAiReply,
  recordMoodTag,
  saveAiCompanionEnabled,
  type CompanionMemory,
} from './storage/companionMemory'
import {
  addMicroTask,
  completeMicroTask,
  deleteMicroTask,
  getMicroTaskState,
  type MicroTask,
  type MicroTaskState,
} from './storage/microTasks'
import {
  addGrowthEnergyEvent,
  getTodayGrowthEnergy,
  type GrowthEnergyState,
} from './storage/growthEnergy'
import {
  addDailyDiary,
  deleteDailyDiary,
  getRecentDailyDiaries,
  type DailyDiary,
} from './storage/dailyDiaries'
import {
  getProactiveCompanionSettings,
  saveProactiveCompanionEnabled,
  saveProactiveCompanionLastNudgeAt,
  type ProactiveCompanionSettings,
} from './storage/proactiveSettings'

declare global {
  interface Window {
    focusPet?: {
      hide: () => Promise<void>
      minimize: () => Promise<void>
      show: () => Promise<void>
      close: () => Promise<void>
      moveBy: (deltaX: number, deltaY: number) => Promise<void>
      setWindowMode?: (mode: 'compact' | 'expanded') => Promise<void>
      setWindowBounds?: (bounds: { height: number }) => Promise<void>
      setIgnoreMouseEvents?: (ignore: boolean) => Promise<void>
      getOpenAtLogin?: () => Promise<boolean>
      setOpenAtLogin?: (enabled: boolean) => Promise<boolean>
      notify: (title: string, body: string) => Promise<void>
    }
  }
}

const petName = '\u4e13\u6ce8\u642d\u5b50'
const startLabel = '\u5f00\u59cb\u4e13\u6ce8'
const stopLabel = '\u7ed3\u675f\u4e13\u6ce8'
const confirmStopLabel = '\u786e\u8ba4\u7ed3\u675f'
const breakLabel = '\u4f11\u606f 5 \u5206\u949f'
const endBreakLabel = '\u7ed3\u675f\u4f11\u606f'
const laterLabel = '\u7a0d\u540e'
const againLabel = '\u518d\u6765'
const changeDurationLabel = '\u6362\u4e2a\u65f6\u957f'
const minimizeLabel = '\u6700\u5c0f\u5316'
const closeLabel = '\u5173\u95ed'
const settingsLabel = '设置'
const settingsDoneLabel = '完成'
const settingsPanelTitle = 'Focus Pet 设置'
const settingsAiSectionTitle = 'AI 配置'
const settingsPrivacySectionTitle = '本地数据与隐私'
const settingsWindowSectionTitle = '窗口与启动'
const settingsAboutSectionTitle = '关于'
const openAtLoginEnabledLabel = '开机启动：已开启'
const openAtLoginDisabledLabel = '开机启动：已关闭'
const moreLabel = '\u66f4\u591a'
const idleLabel = '\u5f85\u673a'
const sleepyLabel = '\u56f0\u4e86'
const stateLabel = '\u72b6\u6001'
const durationTitle = '\u4e13\u6ce8\u65f6\u957f'
const goalTitle = '\u672c\u8f6e\u76ee\u6807'
const goalPlaceholder = '这一轮只做什么？'
const focusStartHint = '写一个小目标，选个时长，我们就开始。'
const missingGoal = '\u672a\u586b\u5199\u76ee\u6807'
const todayTitle = '\u4eca\u65e5\u4e13\u6ce8'
const dailyGoalTitle = '\u4eca\u65e5\u76ee\u6807'
const progressLabel = '\u8fdb\u5ea6'
const roundLabel = '\u8f6e'
const devToolsTitle = 'DEV \u6d4b\u8bd5'
const quickTestLabel = '\u5feb\u901f\u5012\u8ba1\u65f6'
const enabledLabel = '\u5f00\u542f'
const disabledLabel = '\u5173\u95ed'
const quickTestNote = '\u4e13\u6ce8 / \u4f11\u606f\u4f1a\u6309 10 \u79d2\u8dd1\u5b8c'
const completedLabel = '\u4eca\u65e5\u5df2\u5b8c\u6210'
const totalLabel = '\u4eca\u65e5\u7d2f\u8ba1'
const timesLabel = '\u6b21'
const minutesLabel = '\u5206\u949f'
const emptyTitle = '还没有完成记录'
const emptyHint = '先来一轮 5 分钟热身吧。'
const focusNudgeTitle = petMessageTitles.focusNudge
const breakPromptTitle = petMessageTitles.breakPrompt
const breakPromptText = petFeedbackText.breakPrompt
const restCompleteTitle = petMessageTitles.restComplete
const restCompleteText = petFeedbackText.restComplete
const focusDoneNotification = petFeedbackText.focusDoneNotification
const restDoneNotification = petFeedbackText.restDoneNotification
const focusingTitle = petMessageTitles.focusing
const remainingLabel = '\u5269\u4f59\u65f6\u95f4'
const cheerPanelTitle = petMessageTitles.cheerPanel
const companionNotesTitle = '陪伴小记'
const aiCompanionClosedTitle = 'AI 陪伴还未开启。'
const aiCompanionClosedText = '本地记忆仍会用于记录你的专注习惯。'
const aiCompanionOpenTitle = 'AI 陪伴入口已开启。'
const aiCompanionOpenText = '下一步可以接入真实对话能力。'
const enableAiCompanionLabel = '开启 AI 陪伴'
const disableAiCompanionLabel = '关闭 AI 陪伴'
const recentMemoryLabel = '最近记住：'
const companionMemoryEmptyText = '还没有小记。完成一轮专注，或者问问霍霍后，可以选择记住一些事。'
const companionMemoryPrivacyText = '状态和陪伴记录只保存在本地，不会上传。'
const companionEmptyActionText = '去问问'
const viewAllMemoryLabel = '查看全部'
const collapseMemoryLabel = '收起'
const clearMemoryLabel = '清空记忆'
const clearMemoryConfirmText = '确定清空吗？'
const confirmClearMemoryLabel = '确认清空'
const cancelLabel = '取消'
const moodSectionTitle = '今天的状态'
const moodSummaryLabel = '最近状态：'
const moodEmptyText = '今天还没记录状态。慢慢来就好。'
const moodFeedbackText = '记下来了，慢慢来就好。'
const moodTags = ['有点累', '还可以', '有点焦虑', '慢慢来', '完成了一点', '想休息'] as const
const localCompanionReviewTitle = '本地小回顾'
const localCompanionReviewNote = '等你多完成几轮，我会更了解你的节奏。'
const aiChatTitle = 'AI 对话'
const aiChatSettingsLabel = 'AI 设置'
const aiChatConfigureLabel = '配置 AI 对话'
const aiChatCollapseLabel = '收起 AI 设置'
const aiChatEnabledLabel = '已开启'
const aiChatDisabledLabel = '未开启'
const aiChatProviderNoneLabel = '暂不使用'
const aiChatProviderOpenAiCompatibleLabel = 'OpenAI-compatible'
const aiChatNotConfiguredLabel = '未配置'
const aiChatDeepSeekPresetLabel = '填入 DeepSeek 推荐配置'
const aiChatSaveLabel = '保存配置'
const aiChatResetLabel = '清空配置'
const aiChatPrivacyText = 'API Key 只保存在本机 localStorage。'
const aiDiaryPrivacyText = 'AI 日记只发送今日小结摘要，保存的日记只保存在本地。'
const localOnlyPrivacyText = '当前没有登录、后端或云同步。'
const aboutFocusPetText = 'Focus Pet 是一个本地优先的桌面专注陪伴工具。'
const openAtLoginSettingsText = '也可以在三点菜单里快速切换开机启动。'
const aiChatIncompleteText = '还差一点配置。填好 API Key、Base URL 和 Model 后就能问我了。'
const aiChatReadyText = '配置已保存。只有点击发送时才会请求你配置的 AI 服务。'
const aiChatOffText = 'AI 对话还没开启。打开后，再填入服务配置就能问霍霍了。'
const aiChatContextHint = '发送问题时，会把你的输入和少量本地摘要发给配置的 AI 服务。'
const aiConfiguredClickOnlyText = '点击发送时才会请求'
const aiAskTitle = '问问霍霍'
const aiAskPlaceholder = '想问霍霍什么？'
const aiAskSendLabel = '发送'
const aiAskPendingText = '霍霍想一想……'
const aiAskStatusPendingText = '霍霍想一想……'
const aiCancelLabel = '取消'
const aiAskPrivacyText = '点击发送后，会发送输入和少量本地摘要到你配置的 AI 服务。'
const aiAskShortPrivacyText = 'AI 回复会使用你配置的服务。'
const aiTemporaryContextText = '本次对话会临时带上最近 3 轮上下文，关闭后不会保存。'
const clearTemporaryChatLabel = '清空临时对话'
const goSettingsLabel = '去设置'
const aiAskDisabledTitle = 'AI 陪伴还没开启。'
const aiAskDisabledText = '可以去设置里打开。打开前，这里不会发送任何请求。'
const aiAskIncompleteTitle = '还差一点配置。'
const aiAskIncompleteText = '去设置里填好 API Key、Base URL 和 Model，就能问我了。'
const aiSettingsPresetHint = '推荐使用 DeepSeek 配置，一键填入 Base URL 和模型名。'
const temporaryChatClearedText = '嗷，我先不记刚才那些了。'
const aiAskFocusHint = '专注中先别聊，结束后再问我也可以。'
const aiRememberLabel = '记住这次'
const aiRememberDoneLabel = '已记住'
const aiRememberSuccessText = '我、我记住了……'
const aiRememberFailedText = '好像没记下来……稍后再试试。'
const aiMemorySuggestionText = '这件事要不要我记一下？'
const aiMemorySuggestionRememberLabel = '记住'
const aiMemorySuggestionDismissLabel = '不用'
const aiMemorySuggestionDismissedText = '好，那我先不记。'

const proactiveCompanionTitle = '低频主动陪伴'
const proactiveCompanionDescription = '偶尔提醒你开始一小轮，专注中不会打扰。'
const proactiveCompanionPrivacy = '只根据本地状态更新气泡，不调用 AI，也不会上传。'
const proactiveStartFiveLabel = '开始 5 分钟'
const proactiveSnoozeLabel = '稍后'
const proactiveSnoozedText = '好，那我晚点再提醒。'
const proactiveDefaultGoal = '先开始一小步'
const microTaskTitle = '今日小任务'
const microTaskPlaceholder = '写下一个小任务'
const microTaskAddLabel = '添加'
const microTaskSetGoalLabel = '设为目标'
const microTaskCompleteLabel = '完成'
const microTaskDeleteLabel = '×'
const microTaskEmptyText = '可以先写一个很小的任务，比如：看 2 页书。'
const microTaskOverflowHint = '小提示：先处理最前面的几个就好。'
const microTaskSetGoalFeedback = '那这一轮就先做这个。'
const linkedTaskPromptTitle = '这项小任务完成了吗？'
const linkedTaskCompleteLabel = '完成了'
const linkedTaskKeepLabel = '还没'
const linkedTaskKeepFeedback = '那就先留着，慢慢来。'
const growthEnergyLabel = '霍霍能量'
const growthEnergyEmptyText = '完成一轮专注或一个小任务，就会多一点能量。'
const growthEnergyNote = '完成专注和小任务都会让霍霍更有精神。'
const growthEnergyFocusFeedback = '霍霍能量 +1'
const microTaskEnergyFeedback = '完成一个小任务啦，霍霍能量 +1。'
const aiDiaryButtonLabel = '让霍霍写成日记'
const aiDiaryRegenerateLabel = '让霍霍重新写'
const aiDiaryPendingText = '霍霍在写……'
const aiDiaryCancelLabel = '取消'
const aiDiaryTitle = '霍霍写的小日记'
const aiDiaryDisabledText = 'AI 陪伴还没开启，可以去设置里打开。'
const aiDiaryIncompleteText = '还差一点配置。填好 API Key 后，霍霍就能写日记了。'
const aiDiaryCanceledText = '这次先不写了。'
const aiDiarySaveLabel = '保存这篇日记'
const aiDiarySavedLabel = '已保存'
const aiDiarySaveSuccessText = '这篇日记已经保存啦。'
const aiDiarySaveDuplicateText = '这篇已经保存过啦。'
const aiDiarySaveFailedText = '好像没保存成功……稍后再试试。'
const savedDiariesTitle = '最近保存的日记'
const savedDiariesEmptyText = '还没有保存的日记。生成 AI 日记后，可以手动保存到这里。'
const savedDiaryExpandLabel = '展开'
const savedDiaryCollapseLabel = '收起'
const savedDiaryDeleteLabel = '删除'
const savedDiaryDeletedText = '这篇日记已经删除。'

type AiAskResultState = 'idle' | 'success' | 'canceled' | 'error'
type PanelTab = 'focus' | 'companion' | 'ask'

const panelTabs: Array<{ id: PanelTab; label: string }> = [
  { id: 'focus', label: '专注' },
  { id: 'companion', label: '陪伴' },
  { id: 'ask', label: '问问' },
]

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatCompanionMemoryTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfNoteDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  if (startOfNoteDay === startOfToday) return `今天 ${time}`
  if (startOfNoteDay === startOfToday - 24 * 60 * 60 * 1000) return `昨天 ${time}`

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatSavedDiaryPreview(text: string) {
  const normalizedText = text.trim().replace(/\s+/g, ' ')
  if (normalizedText.length <= 60) return normalizedText

  return `${normalizedText.slice(0, 60).replace(/[，。,.、；;：:\s]+$/, '')}……`
}

function buildLocalCompanionReview(sessionCount: number, totalMinutes: number, moodTags: string[]) {
  const latestMood = moodTags[0]

  if (sessionCount === 0 && !latestMood) {
    return '今天还没有留下太多记录。先来一小轮也可以，我会慢慢记下来。'
  }

  if (sessionCount === 0 && latestMood) {
    return `今天的状态是“${latestMood}”。不急，先照顾好现在的节奏。`
  }

  const focusText = `今天已经完成 ${sessionCount} 轮，累计 ${totalMinutes} 分钟。`
  if (!latestMood) return `${focusText} 这一点已经被好好记下来了。`

  return `${focusText} 最近状态是“${latestMood}”，慢慢来就好。`
}

function App() {
  const {
    cancelPreparing,
    currentGoal,
    dismissBreakPrompt,
    dismissRestComplete,
    displayText,
    endBreak,
    endFocus,
    focusDurations,
    dailyGoalOptions,
    isDevMode,
    isBreakPrompt,
    isFocusing,
    isPreparing,
    isQuickTestMode,
    isRestComplete,
    isResting,
    isTodayGoalCompleted,
    lastFocusDurationMinutes,
    mood,
    prepareNextFocus,
    remainingSeconds,
    reset,
    rest,
    remainingGoalSessions,
    selectDuration,
    selectedDurationMinutes,
    sessions,
    startBreak,
    startFocus,
    todayRecords,
    todayGoal,
    todaySessionCount,
    todayTotalMinutes,
    timerStatus,
    toggleQuickTestMode,
    updateCurrentGoal,
    updateTodayGoal,
  } = usePetState()
  const [panelOpen, setPanelOpen] = useState(false)
  const [activePanelTab, setActivePanelTab] = useState<PanelTab>('focus')
  const [windowMenuOpen, setWindowMenuOpen] = useState(false)
  const [windowMenuDragging, setWindowMenuDragging] = useState(false)
  const [petControlsVisible, setPetControlsVisible] = useState(false)
  const [openAtLogin, setOpenAtLogin] = useState(false)
  const [openAtLoginAvailable, setOpenAtLoginAvailable] = useState(true)
  const [focusNudgeIndex, setFocusNudgeIndex] = useState(0)
  const [stopConfirming, setStopConfirming] = useState(false)
  const [idlePromptText, setIdlePromptText] = useState(() => pickMessage('idle'))
  const [readyPromptText, setReadyPromptText] = useState(() => pickMessage('ready'))
  const [cheerPanelText, setCheerPanelText] = useState(() => pickMessage('completed'))
  const [proactiveSettings, setProactiveSettings] = useState<ProactiveCompanionSettings>(() =>
    getProactiveCompanionSettings(),
  )
  const [proactiveNudgeText, setProactiveNudgeText] = useState('')
  const [proactiveSnoozeFeedbackText, setProactiveSnoozeFeedbackText] = useState('')
  const [microTaskState, setMicroTaskState] = useState<MicroTaskState>(() => getMicroTaskState())
  const [microTaskInput, setMicroTaskInput] = useState('')
  const [microTaskFeedback, setMicroTaskFeedback] = useState('')
  const [linkedFocusTaskId, setLinkedFocusTaskId] = useState<string | null>(null)
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(null)
  const [pendingTaskCompletionPrompt, setPendingTaskCompletionPrompt] = useState<MicroTask | null>(null)
  const [todayGrowthEnergy, setTodayGrowthEnergy] = useState(() => getTodayGrowthEnergy())
  const [aiCompanionEnabled, setAiCompanionEnabled] = useState(() => getAiCompanionEnabled())
  const [companionMemory, setCompanionMemory] = useState<CompanionMemory>(() => getCompanionMemory())
  const [companionMemoryExpanded, setCompanionMemoryExpanded] = useState(false)
  const [companionMemoryClearConfirming, setCompanionMemoryClearConfirming] = useState(false)
  const [moodFeedbackVisible, setMoodFeedbackVisible] = useState(false)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => getAiSettings())
  const [aiSettingsDraft, setAiSettingsDraft] = useState<AiSettings>(() => getAiSettings())
  const [aiAskInput, setAiAskInput] = useState('')
  const [aiAskLastInput, setAiAskLastInput] = useState('')
  const [aiAskReply, setAiAskReply] = useState('')
  const [aiAskStatus, setAiAskStatus] = useState('')
  const [aiAskPending, setAiAskPending] = useState(false)
  const [aiAskResultState, setAiAskResultState] = useState<AiAskResultState>('idle')
  const [aiRemembered, setAiRemembered] = useState(false)
  const [aiRememberStatus, setAiRememberStatus] = useState('')
  const [aiMemorySuggestionVisible, setAiMemorySuggestionVisible] = useState(false)
  const [temporaryChatTurns, setTemporaryChatTurns] = useState<AiCompanionTemporaryTurn[]>([])
  const [aiDiaryText, setAiDiaryText] = useState('')
  const [aiDiaryStatus, setAiDiaryStatus] = useState('')
  const [aiDiaryError, setAiDiaryError] = useState('')
  const [aiDiarySaved, setAiDiarySaved] = useState(false)
  const [aiDiarySaveStatus, setAiDiarySaveStatus] = useState('')
  const [aiDiarySaveError, setAiDiarySaveError] = useState('')
  const [dailyDiaries, setDailyDiaries] = useState<DailyDiary[]>(() => getRecentDailyDiaries(3))
  const [expandedDiaryId, setExpandedDiaryId] = useState<string | null>(null)
  const [savedDiaryStatus, setSavedDiaryStatus] = useState('')
  const [isAiDiaryGenerating, setIsAiDiaryGenerating] = useState(false)
  const [live2DMotionEventId, setLive2DMotionEventId] = useState(0)
  const contentFitRef = useRef<HTMLDivElement>(null)
  const windowMenuRef = useRef<HTMLDivElement>(null)
  const aiAbortControllerRef = useRef<AbortController | null>(null)
  const aiDiaryAbortControllerRef = useRef<AbortController | null>(null)
  const compactFitRafRef = useRef<number | null>(null)
  const compactFitTimersRef = useRef<number[]>([])
  const lastCompactHeightRef = useRef(0)
  const ignoreMouseEventsRef = useRef<boolean | null>(null)
  const mousePassthroughRafRef = useRef<number | null>(null)
  const pendingMousePassthroughTargetRef = useRef<EventTarget | null>(null)
  const windowDragRef = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    pointerId: -1,
    startX: 0,
    startY: 0,
  })
  const appStartedAtRef = useRef(Date.now())
  const shownProactiveNudgeReasonsRef = useRef(new Set<string>())
  const wasBreakPromptRef = useRef(false)
  const wasRestCompleteRef = useRef(false)
  const wasCompletionCheerRef = useRef(false)

  const status = isFocusing
    ? 'Focus mode'
    : isPreparing
      ? 'Starting soon'
    : isResting
      ? 'Break time'
      : isRestComplete
        ? 'Ready again'
        : mood
  const recentRecords = useMemo(() => todayRecords.slice(0, 5), [todayRecords])
  const focusNudge = petMessages.distraction[focusNudgeIndex % petMessages.distraction.length]
  const remainingTime = formatTime(remainingSeconds)
  const isCompletionCheer = timerStatus === 'completed' && mood === 'cheer'
  const isIdleControlPanel =
    timerStatus === 'idle' &&
    !isPreparing &&
    !isFocusing &&
    !isBreakPrompt &&
    !isResting &&
    !isRestComplete &&
    !isCompletionCheer
  const isIdleMinimal = isIdleControlPanel && !panelOpen
  const windowMode = panelOpen && !isFocusing ? 'expanded' : 'compact'
  const proactiveStatus: ProactivePetStatus = isPreparing
    ? 'preparing'
    : isFocusing
      ? 'focusing'
      : isResting
        ? 'resting'
        : isRestComplete
          ? 'restComplete'
          : isBreakPrompt
            ? 'breakPrompt'
            : isCompletionCheer
              ? 'completed'
              : 'idle'
  const canShowProactiveNudge =
    proactiveSettings.enabled &&
    Boolean(proactiveNudgeText) &&
    !panelOpen &&
    (proactiveStatus === 'idle' || proactiveStatus === 'restComplete')
  const canShowProactiveFeedback =
    proactiveSettings.enabled &&
    Boolean(proactiveSnoozeFeedbackText) &&
    !panelOpen &&
    proactiveStatus === 'idle'
  const bubbleText = isPreparing
    ? displayText
    : canShowProactiveNudge
      ? proactiveNudgeText
      : canShowProactiveFeedback
        ? proactiveSnoozeFeedbackText
        : isIdleMinimal
          ? idlePromptText
          : isIdleControlPanel
            ? readyPromptText
            : displayText
  const petVisualState: Live2DPetState = isPreparing
    ? 'preparing'
    : isFocusing
    ? 'focusing'
    : isResting
      ? 'resting'
      : isRestComplete
        ? 'restComplete'
        : isCompletionCheer || isBreakPrompt
          ? 'completed'
          : isIdleControlPanel && panelOpen
            ? 'ready'
            : mood
  const dailyGoalMessage = isTodayGoalCompleted
    ? '\u4eca\u5929\u7684\u5c0f\u76ee\u6807\u5b8c\u6210\u5566 \ud83c\udf89 \u4f11\u606f\u4e00\u4e0b\u4e5f\u5f88\u503c\u5f97\u3002'
    : todaySessionCount === 0
      ? todayGoal === 1
        ? '\u5b8c\u6210 1 \u8f6e\u5c31\u8fbe\u6210\u4eca\u5929\u7684\u5c0f\u76ee\u6807\u5566\u3002'
        : '\u4eca\u5929\u8fd8\u6ca1\u5f00\u59cb\uff0c\u5148\u6765\u4e00\u8f6e 5 \u5206\u949f\u70ed\u8eab\u5427\u3002'
      : `\u6162\u6162\u6765\uff0c\u518d\u5b8c\u6210 ${remainingGoalSessions} \u8f6e\u5c31\u5230\u4eca\u5929\u7684\u5c0f\u76ee\u6807\u5566\u3002`
  const lastCompletedRecord = isCompletionCheer ? todayRecords[0] : null
  const completionGoalText = lastCompletedRecord?.goal
    ? `\u8fd9\u4e00\u8f6e\u5b8c\u6210\u4e86\uff1a${lastCompletedRecord.goal}`
    : '\u8fd9\u4e00\u8f6e\u5b8c\u6210\u4e86\u3002'
  const completionDailyGoalText = isTodayGoalCompleted
    ? '\u4eca\u65e5\u76ee\u6807\u5df2\u7ecf\u8fbe\u6210\u4e86\u2026\u2026\u592a\u597d\u4e86\u3002'
    : `\u8fd8\u5dee ${remainingGoalSessions} \u8f6e\uff0c\u6162\u6162\u6765\u5c31\u597d\u3002`
  const activeMicroTasks = useMemo(
    () => microTaskState.tasks.filter((task) => task.status === 'active'),
    [microTaskState.tasks],
  )
  const visibleMicroTasks = useMemo(() => activeMicroTasks.slice(0, 5), [activeMicroTasks])
  const todayCompletedMicroTaskCount = useMemo(() => {
    const now = new Date()

    return microTaskState.tasks.filter((task) => {
      if (task.status !== 'completed' || !task.completedAt) return false

      const completedAt = new Date(task.completedAt)
      return (
        completedAt.getFullYear() === now.getFullYear() &&
        completedAt.getMonth() === now.getMonth() &&
        completedAt.getDate() === now.getDate()
      )
    }).length
  }, [microTaskState.tasks])
  const companionMemoryNotes = useMemo(
    () => (companionMemoryExpanded ? companionMemory.notes : companionMemory.notes.slice(0, 3)),
    [companionMemory.notes, companionMemoryExpanded],
  )
  const canExpandCompanionMemory = companionMemory.notes.length > 3
  const latestMoodTag = companionMemory.recentMoodTags[0]
  const recentMoodTagsText = useMemo(
    () => companionMemory.recentMoodTags.join('、'),
    [companionMemory.recentMoodTags],
  )
  const localCompanionReview = useMemo(
    () =>
      buildLocalCompanionReview(
        todaySessionCount,
        todayTotalMinutes,
        companionMemory.recentMoodTags,
      ),
    [companionMemory.recentMoodTags, todaySessionCount, todayTotalMinutes],
  )
  const dailySummary = useMemo(
    () =>
      buildLocalDailySummary({
        focusCount: todaySessionCount,
        focusMinutes: todayTotalMinutes,
        completedTaskCount: todayCompletedMicroTaskCount,
        todayEnergy: todayGrowthEnergy,
        recentMoodTags: companionMemory.recentMoodTags,
        dailyGoalAchieved: isTodayGoalCompleted,
      }),
    [
      companionMemory.recentMoodTags,
      isTodayGoalCompleted,
      todayCompletedMicroTaskCount,
      todayGrowthEnergy,
      todaySessionCount,
      todayTotalMinutes,
    ],
  )
  const aiChatConfigured =
    aiSettings.provider === 'openai-compatible' &&
    aiSettings.baseUrl.trim().length > 0 &&
    aiSettings.apiKey.trim().length > 0 &&
    aiSettings.model.trim().length > 0
  const aiAskReady = aiSettings.chatEnabled && aiChatConfigured
  const hasCompanionNotes = companionMemory.notes.length > 0
  const aiChatStatusText = aiSettings.chatEnabled
    ? aiChatEnabledLabel
    : aiChatDisabledLabel
  const aiChatProviderText =
    aiSettings.provider === 'openai-compatible'
      ? aiChatProviderOpenAiCompatibleLabel
      : aiChatNotConfiguredLabel
  const aiChatModelText = aiSettings.model.trim() || aiChatNotConfiguredLabel
  const aiChatNotice = aiSettings.chatEnabled
    ? aiChatConfigured
      ? aiChatReadyText
      : aiChatIncompleteText
    : aiChatOffText
  const aiChatLightStatus = aiChatConfigured
    ? `AI：${aiSettings.baseUrl.trim().replace(/\/+$/, '') === 'https://api.deepseek.com' ? 'DeepSeek' : aiChatModelText} 已配置 · ${aiConfiguredClickOnlyText}`
    : 'AI：未配置'

  useEffect(() => {
    if (!isFocusing && !isResting) {
      setStopConfirming(false)
    }
  }, [isFocusing, isResting])

  useEffect(() => {
    if (isIdleMinimal) {
      setIdlePromptText(pickMessage('idle'))
    }
  }, [isIdleMinimal])

  useEffect(() => {
    if (panelOpen && isIdleControlPanel) {
      setReadyPromptText(pickMessage('ready'))
      setCompanionMemory(getCompanionMemory())
    }
  }, [isIdleControlPanel, panelOpen])

  useEffect(() => {
    if (isBreakPrompt || isRestComplete) {
      setPanelOpen(true)
    }
  }, [isBreakPrompt, isRestComplete])

  useEffect(() => {
    if (isCompletionCheer) {
      setCheerPanelText(pickMessage('completed'))
      setPanelOpen(true)
    }
  }, [isCompletionCheer])

  useEffect(() => {
    if (isCompletionCheer && !wasCompletionCheerRef.current) {
      refreshTodayGrowthEnergy()

      if (activeFocusTaskId) {
        const activeTask = microTaskState.tasks.find(
          (task) => task.id === activeFocusTaskId && task.status === 'active',
        )

        if (activeTask) {
          setPendingTaskCompletionPrompt(activeTask)
          setLinkedFocusTaskId((currentId) => (currentId === activeFocusTaskId ? null : currentId))
        } else {
          setActiveFocusTaskId(null)
          setLinkedFocusTaskId((currentId) => (currentId === activeFocusTaskId ? null : currentId))
        }
      }
    }

    wasCompletionCheerRef.current = isCompletionCheer
  }, [activeFocusTaskId, isCompletionCheer, microTaskState.tasks])

  useEffect(() => {
    if (!proactiveSnoozeFeedbackText) return

    const timer = window.setTimeout(() => {
      setProactiveSnoozeFeedbackText('')
    }, 4000)

    return () => window.clearTimeout(timer)
  }, [proactiveSnoozeFeedbackText])

  useEffect(() => {
    if (
      !proactiveSettings.enabled ||
      isPreparing ||
      isFocusing ||
      isBreakPrompt ||
      isResting ||
      isCompletionCheer ||
      panelOpen
    ) {
      setProactiveNudgeText('')
      setProactiveSnoozeFeedbackText('')
    }
  }, [
    isBreakPrompt,
    isCompletionCheer,
    isFocusing,
    isPreparing,
    isResting,
    panelOpen,
    proactiveSettings.enabled,
  ])

  useEffect(() => {
    if (!proactiveSettings.enabled) return

    function checkProactiveNudge() {
      const nudge = getProactiveNudge({
        status: proactiveStatus,
        todayFocusCount: todaySessionCount,
        dailyGoalAchieved: isTodayGoalCompleted,
        appIdleMs: Date.now() - appStartedAtRef.current,
        lastNudgeAt: proactiveSettings.lastNudgeAt,
        panelOpen,
      })

      if (!nudge) return
      if (shownProactiveNudgeReasonsRef.current.has(nudge.reason)) return

      shownProactiveNudgeReasonsRef.current.add(nudge.reason)
      const nextSettings = saveProactiveCompanionLastNudgeAt(new Date().toISOString())
      setProactiveSettings(nextSettings)
      setProactiveNudgeText(nudge.text)
    }

    const initialTimer = window.setTimeout(checkProactiveNudge, 5000)
    const interval = window.setInterval(checkProactiveNudge, 60 * 1000)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
    }
  }, [
    isTodayGoalCompleted,
    panelOpen,
    proactiveSettings.enabled,
    proactiveSettings.lastNudgeAt,
    proactiveStatus,
    todaySessionCount,
  ])

  useEffect(() => {
    if (windowMode === 'expanded') {
      cancelScheduledCompactFit()
      window.focusPet?.setWindowMode?.('expanded').catch((error) => {
        console.warn('Failed to update window mode.', error)
      })
      return
    }

    scheduleCompactWindowFit()

    return cancelScheduledCompactFit
  }, [isFocusing, isPreparing, isRestComplete, isResting, panelOpen, windowMenuOpen, windowMode])

  useEffect(() => {
    refreshOpenAtLogin()
  }, [])

  useEffect(() => {
    return () => {
      aiAbortControllerRef.current?.abort()
      aiAbortControllerRef.current = null
      aiDiaryAbortControllerRef.current?.abort()
      aiDiaryAbortControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (windowMenuOpen) {
      refreshOpenAtLogin()
    }
  }, [windowMenuOpen])

  useEffect(() => {
    if (!panelOpen) {
      setSettingsPanelOpen(false)
    }
  }, [panelOpen])

  useEffect(() => {
    setIgnoreMouseEvents(true)

    function handleMouseMove(event: MouseEvent) {
      pendingMousePassthroughTargetRef.current = event.target
      if (mousePassthroughRafRef.current !== null) return

      mousePassthroughRafRef.current = window.requestAnimationFrame(() => {
        mousePassthroughRafRef.current = null
        const target = pendingMousePassthroughTargetRef.current
        const interactive = target instanceof Element && Boolean(target.closest('.mouse-interactive'))
        setIgnoreMouseEvents(!interactive)
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (mousePassthroughRafRef.current !== null) {
        window.cancelAnimationFrame(mousePassthroughRafRef.current)
        mousePassthroughRafRef.current = null
      }
      pendingMousePassthroughTargetRef.current = null
      setIgnoreMouseEvents(false)
    }
  }, [])

  useEffect(() => {
    if (!windowMenuOpen) return

    function handlePointerDown(event: globalThis.PointerEvent) {
      if (windowMenuRef.current?.contains(event.target as Node)) return
      setWindowMenuOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [windowMenuOpen])

  useEffect(() => {
    if (isBreakPrompt && !wasBreakPromptRef.current) {
      window.focusPet?.notify(breakPromptTitle, focusDoneNotification)
    }

    wasBreakPromptRef.current = isBreakPrompt
  }, [isBreakPrompt])

  useEffect(() => {
    if (isRestComplete && !wasRestCompleteRef.current) {
      window.focusPet?.notify(restCompleteTitle, restDoneNotification)
    }

    wasRestCompleteRef.current = isRestComplete
  }, [isRestComplete])

  const showFocusNudge = useCallback(() => {
    setStopConfirming(false)
    setLive2DMotionEventId((value) => value + 1)
    setPanelOpen((value) => {
      const nextValue = !value
      if (nextValue) {
        setFocusNudgeIndex((index) => index + 1)
      }

      return nextValue
    })
  }, [])

  const handleEndFocus = useCallback(() => {
    if (!stopConfirming) {
      setStopConfirming(true)
      return
    }

    setStopConfirming(false)
    setLinkedFocusTaskId(null)
    setActiveFocusTaskId(null)
    setPendingTaskCompletionPrompt(null)
    endFocus()
  }, [endFocus, stopConfirming])

  const handlePetClick = useCallback(() => {
    if (isPreparing) {
      return
    }

    if (isFocusing) {
      showFocusNudge()
      return
    }

    if (isResting || isBreakPrompt || isRestComplete) {
      setPanelOpen(true)
      return
    }

    setPanelOpen((value) => !value)
  }, [isBreakPrompt, isFocusing, isPreparing, isRestComplete, isResting, showFocusNudge])

  const openSettingsPanel = useCallback(() => {
    setWindowMenuOpen(false)
    setPanelOpen(true)
    setSettingsPanelOpen(true)
  }, [])

  const closeSettingsPanel = useCallback(() => {
    setSettingsPanelOpen(false)
  }, [])

  function setIgnoreMouseEvents(ignore: boolean) {
    if (ignoreMouseEventsRef.current === ignore) return

    ignoreMouseEventsRef.current = ignore
    window.focusPet?.setIgnoreMouseEvents?.(ignore).catch((error) => {
      console.warn('Failed to update mouse passthrough.', error)
    })
  }

  function cancelScheduledCompactFit() {
    if (compactFitRafRef.current !== null) {
      window.cancelAnimationFrame(compactFitRafRef.current)
      compactFitRafRef.current = null
    }

    compactFitTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    compactFitTimersRef.current = []
  }

  function scheduleCompactWindowFit() {
    cancelScheduledCompactFit()

    compactFitRafRef.current = window.requestAnimationFrame(() => {
      compactFitRafRef.current = null
      fitCompactWindowToContent()
      compactFitTimersRef.current = [
        window.setTimeout(fitCompactWindowToContent, 90),
        window.setTimeout(fitCompactWindowToContent, 240),
      ]
    })
  }

  function fitCompactWindowToContent() {
    const contentRect = contentFitRef.current?.getBoundingClientRect()
    const menuRect = windowMenuRef.current?.getBoundingClientRect()
    const rects = [contentRect, menuRect].filter((rect): rect is DOMRect => Boolean(rect && rect.width && rect.height))

    if (rects.length === 0) {
      window.focusPet?.setWindowMode?.('compact').catch((error) => {
        console.warn('Failed to update compact window mode.', error)
      })
      return
    }

    const top = Math.min(...rects.map((rect) => rect.top))
    const bottom = Math.max(...rects.map((rect) => rect.bottom))
    const verticalPadding = 32
    const nextHeight = bottom - top + verticalPadding

    if (Math.abs(nextHeight - lastCompactHeightRef.current) < 2) return
    lastCompactHeightRef.current = nextHeight

    window.focusPet
      ?.setWindowBounds?.({
        height: nextHeight,
      })
      .catch((error) => {
        console.warn('Failed to fit compact window to content.', error)
      })
  }

  async function refreshOpenAtLogin() {
    if (!window.focusPet?.getOpenAtLogin) {
      setOpenAtLoginAvailable(false)
      return
    }

    try {
      setOpenAtLogin(await window.focusPet.getOpenAtLogin())
      setOpenAtLoginAvailable(true)
    } catch (error) {
      console.warn('Failed to read open-at-login setting.', error)
      setOpenAtLoginAvailable(false)
    }
  }

  async function toggleOpenAtLogin() {
    if (!window.focusPet?.setOpenAtLogin) {
      console.warn('Open-at-login API is not available.')
      setOpenAtLoginAvailable(false)
      return
    }

    try {
      const actual = await window.focusPet.setOpenAtLogin(!openAtLogin)
      setOpenAtLogin(actual)
      setOpenAtLoginAvailable(true)
    } catch (error) {
      console.warn('Failed to update open-at-login setting.', error)
    }
  }

  function toggleAiCompanion() {
    const nextEnabled = saveAiCompanionEnabled(!aiCompanionEnabled)
    setAiCompanionEnabled(nextEnabled)
    setCompanionMemory(getCompanionMemory())
    setCompanionMemoryClearConfirming(false)
  }

  function toggleProactiveCompanion() {
    const nextSettings = saveProactiveCompanionEnabled(!proactiveSettings.enabled)
    setProactiveSettings(nextSettings)
    if (!nextSettings.enabled) {
      setProactiveNudgeText('')
      setProactiveSnoozeFeedbackText('')
    }
  }

  function updateProactiveNudgeTime() {
    const nextSettings = saveProactiveCompanionLastNudgeAt(new Date().toISOString())
    setProactiveSettings(nextSettings)
  }

  function handleStartSmallFocusFromNudge() {
    updateProactiveNudgeTime()
    setProactiveNudgeText('')
    setProactiveSnoozeFeedbackText('')
    setLinkedFocusTaskId(null)
    setActiveFocusTaskId(null)
    setPendingTaskCompletionPrompt(null)
    startFocus(5, {
      goal: currentGoal.trim() || proactiveDefaultGoal,
      rememberDuration: false,
    })
    setPanelOpen(false)
  }

  function handleSnoozeProactiveNudge() {
    updateProactiveNudgeTime()
    setProactiveNudgeText('')
    setProactiveSnoozeFeedbackText(proactiveSnoozedText)
  }

  function clearCompanionMemoryNotes() {
    const nextMemory = clearCompanionNotes()
    setCompanionMemory(nextMemory)
    setCompanionMemoryExpanded(false)
    setCompanionMemoryClearConfirming(false)
    setMoodFeedbackVisible(false)
  }

  function handleMoodTagClick(tag: string) {
    const nextMemory = recordMoodTag(tag)
    setCompanionMemory(nextMemory)
    setMoodFeedbackVisible(true)
    setCompanionMemoryClearConfirming(false)
  }

  function updateAiSettingsDraft(partial: Partial<AiSettings>) {
    setAiSettingsDraft((current) => ({
      ...current,
      ...partial,
    }))
  }

  function saveAiSettingsDraft() {
    const nextSettings = saveAiSettings(aiSettingsDraft)
    setAiSettings(nextSettings)
    setAiSettingsDraft(nextSettings)
  }

  function clearAiSettingsDraft() {
    const nextSettings = resetAiSettings()
    setAiSettings(nextSettings)
    setAiSettingsDraft(nextSettings)
  }

  function applyDeepSeekPreset() {
    updateAiSettingsDraft({
      provider: 'openai-compatible',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
    })
  }

  async function handleAiAskSubmit() {
    if (aiAskPending) return

    const trimmedInput = aiAskInput.trim()
    if (!trimmedInput) {
      setAiAskStatus('先写一句想说的话吧。')
      setAiAskResultState('error')
      return
    }

    const controller = new AbortController()
    aiAbortControllerRef.current = controller
    setAiAskPending(true)
    setAiAskResultState('idle')
    setAiAskStatus(aiAskStatusPendingText)

    try {
      const reply = await askAiCompanion(trimmedInput, {
        recentMoodTags: companionMemory.recentMoodTags.slice(0, 3),
        todayFocusCount: todaySessionCount,
        todayFocusMinutes: todayTotalMinutes,
        lastMemoryText: companionMemory.notes[0]?.text,
      }, temporaryChatTurns, { signal: controller.signal })

      setAiAskLastInput(trimmedInput)
      setAiAskReply(reply)
      setAiAskInput('')
      setAiAskStatus('')
      setAiAskResultState('success')
      setAiRemembered(false)
      setAiRememberStatus('')
      setAiMemorySuggestionVisible(shouldSuggestRemember(trimmedInput, reply))
      setTemporaryChatTurns((turns) => [
        ...turns,
        {
          user: trimmedInput,
          assistant: reply,
          createdAt: new Date().toISOString(),
        },
      ].slice(-3))
    } catch (error) {
      setAiRemembered(false)
      setAiMemorySuggestionVisible(false)
      setAiRememberStatus('')

      const message =
        error instanceof AiCompanionRequestCanceledError
          ? error.message
          : error instanceof AiCompanionRequestError
            ? error.message
            : '请求失败了，但专注功能不受影响。'
      setAiAskResultState(error instanceof AiCompanionRequestCanceledError ? 'canceled' : 'error')
      setAiAskStatus(message)
    } finally {
      if (aiAbortControllerRef.current === controller) {
        aiAbortControllerRef.current = null
      }
      setAiAskPending(false)
    }
  }

  function cancelAiAskRequest() {
    aiAbortControllerRef.current?.abort()
  }

  async function handleGenerateAiDiary() {
    if (isAiDiaryGenerating) return

    if (!aiSettings.chatEnabled) {
      setAiDiaryStatus('')
      setAiDiaryError(aiDiaryDisabledText)
      return
    }

    if (!aiChatConfigured) {
      setAiDiaryStatus('')
      setAiDiaryError(aiDiaryIncompleteText)
      return
    }

    const controller = new AbortController()
    aiDiaryAbortControllerRef.current = controller
    setIsAiDiaryGenerating(true)
    setAiDiaryStatus(aiDiaryPendingText)
    setAiDiaryError('')
    setAiDiaryText('')
    setAiDiarySaved(false)
    setAiDiarySaveStatus('')
    setAiDiarySaveError('')

    try {
      const result = await generateAiDiary(
        {
          summaryTitle: dailySummary.title,
          summaryLines: dailySummary.lines,
          summaryFooter: dailySummary.footer,
        },
        { signal: controller.signal },
      )

      setAiDiaryText(result.text)
      setAiDiaryStatus('')
      setAiDiaryError('')
      setAiDiarySaved(false)
      setAiDiarySaveStatus('')
      setAiDiarySaveError('')
    } catch (error) {
      const message =
        error instanceof AiDiaryRequestCanceledError
          ? error.message
          : error instanceof AiDiaryRequestError
            ? error.message
            : '好像没写出来……检查一下网络或配置吧。'

      if (error instanceof AiDiaryRequestCanceledError) {
        setAiDiaryStatus(message || aiDiaryCanceledText)
        setAiDiaryError('')
      } else {
        setAiDiaryStatus('')
        setAiDiaryError(message)
      }
    } finally {
      if (aiDiaryAbortControllerRef.current === controller) {
        aiDiaryAbortControllerRef.current = null
      }
      setIsAiDiaryGenerating(false)
    }
  }

  function cancelAiDiaryRequest() {
    aiDiaryAbortControllerRef.current?.abort()
  }

  function handleSaveAiDiary() {
    const text = aiDiaryText.trim()
    if (!text || isAiDiaryGenerating || aiDiarySaved) return

    try {
      const result = addDailyDiary({
        title: aiDiaryTitle,
        text,
        summarySnapshot: {
          title: dailySummary.title,
          lines: dailySummary.lines,
          footer: dailySummary.footer,
        },
      })

      if (result.saved || result.duplicate) {
        setAiDiarySaved(true)
        setAiDiarySaveStatus(result.duplicate ? aiDiarySaveDuplicateText : aiDiarySaveSuccessText)
        setAiDiarySaveError('')
        setDailyDiaries(getRecentDailyDiaries(3))
        setSavedDiaryStatus('')
        return
      }

      setAiDiarySaveStatus('')
      setAiDiarySaveError(aiDiarySaveFailedText)
    } catch (error) {
      console.warn('Failed to save AI diary.', error)
      setAiDiarySaveStatus('')
      setAiDiarySaveError(aiDiarySaveFailedText)
    }
  }

  function handleToggleSavedDiary(id: string) {
    setExpandedDiaryId((currentId) => (currentId === id ? null : id))
  }

  function handleDeleteSavedDiary(id: string) {
    try {
      deleteDailyDiary(id)
      setDailyDiaries(getRecentDailyDiaries(3))
      setExpandedDiaryId((currentId) => (currentId === id ? null : currentId))
      setSavedDiaryStatus(savedDiaryDeletedText)
    } catch (error) {
      console.warn('Failed to delete saved diary.', error)
    }
  }

  function handleRememberAiReply() {
    if (aiAskResultState !== 'success') return
    if (!aiAskLastInput.trim() || !aiAskReply.trim() || aiRemembered) return

    try {
      const nextMemory = rememberAiReply(aiAskLastInput, aiAskReply)
      setCompanionMemory(nextMemory)
      setCompanionMemoryClearConfirming(false)
      setAiRemembered(true)
      setAiRememberStatus(aiRememberSuccessText)
      setAiMemorySuggestionVisible(false)
    } catch (error) {
      console.warn('Failed to remember AI reply.', error)
      setAiRememberStatus(aiRememberFailedText)
    }
  }

  function dismissAiMemorySuggestion() {
    setAiMemorySuggestionVisible(false)
    setAiRememberStatus(aiMemorySuggestionDismissedText)
  }

  function clearTemporaryChatTurns() {
    setTemporaryChatTurns([])
    setAiAskStatus(temporaryChatClearedText)
  }

  function refreshMicroTaskState(nextState: MicroTaskState) {
    setMicroTaskState(nextState)
  }

  function refreshTodayGrowthEnergy(nextState?: GrowthEnergyState) {
    setTodayGrowthEnergy(getTodayGrowthEnergy(nextState))
  }

  function completeMicroTaskWithEnergy(id: string) {
    const wasActive = microTaskState.tasks.some((task) => task.id === id && task.status === 'active')
    const nextMicroTaskState = completeMicroTask(id)

    refreshMicroTaskState(nextMicroTaskState)
    if (wasActive) {
      refreshTodayGrowthEnergy(addGrowthEnergyEvent('micro-task', id))
    }
  }

  function handleStartFocusFromUi() {
    if (isPreparing || isFocusing) return

    const linkedTaskIsActive =
      linkedFocusTaskId !== null &&
      microTaskState.tasks.some((task) => task.id === linkedFocusTaskId && task.status === 'active')

    setProactiveNudgeText('')
    setProactiveSnoozeFeedbackText('')
    setPendingTaskCompletionPrompt(null)
    setActiveFocusTaskId(linkedTaskIsActive ? linkedFocusTaskId : null)
    if (linkedFocusTaskId && !linkedTaskIsActive) {
      setLinkedFocusTaskId(null)
    }
    startFocus()
    setPanelOpen(false)
  }

  function handleCancelPreparing() {
    setActiveFocusTaskId(null)
    setPendingTaskCompletionPrompt(null)
    cancelPreparing()
  }

  function handleAddMicroTask() {
    const trimmedText = microTaskInput.trim()
    if (!trimmedText) return

    refreshMicroTaskState(addMicroTask(trimmedText))
    setMicroTaskInput('')
    setMicroTaskFeedback('')
  }

  function handleSetMicroTaskAsGoal(task: MicroTask) {
    updateCurrentGoal(task.text)
    setLinkedFocusTaskId(task.id)
    setMicroTaskFeedback(microTaskSetGoalFeedback)
  }

  function handleCompleteMicroTask(id: string) {
    completeMicroTaskWithEnergy(id)
    if (linkedFocusTaskId === id) setLinkedFocusTaskId(null)
    if (activeFocusTaskId === id) setActiveFocusTaskId(null)
    if (pendingTaskCompletionPrompt?.id === id) setPendingTaskCompletionPrompt(null)
    setMicroTaskFeedback(microTaskEnergyFeedback)
  }

  function handleDeleteMicroTask(id: string) {
    refreshMicroTaskState(deleteMicroTask(id))
    if (linkedFocusTaskId === id) setLinkedFocusTaskId(null)
    if (activeFocusTaskId === id) setActiveFocusTaskId(null)
    if (pendingTaskCompletionPrompt?.id === id) setPendingTaskCompletionPrompt(null)
    setMicroTaskFeedback('')
  }

  function handleConfirmLinkedTaskComplete() {
    if (!pendingTaskCompletionPrompt) return

    completeMicroTaskWithEnergy(pendingTaskCompletionPrompt.id)
    setLinkedFocusTaskId(null)
    setActiveFocusTaskId(null)
    setPendingTaskCompletionPrompt(null)
    setMicroTaskFeedback(microTaskEnergyFeedback)
  }

  function handleKeepLinkedTaskActive() {
    setLinkedFocusTaskId(null)
    setActiveFocusTaskId(null)
    setPendingTaskCompletionPrompt(null)
    setMicroTaskFeedback(linkedTaskKeepFeedback)
  }

  function renderLinkedTaskPrompt() {
    if (!pendingTaskCompletionPrompt) return null

    return (
      <section className="linked-task-prompt" aria-label={linkedTaskPromptTitle}>
        <p className="linked-task-prompt-title">{linkedTaskPromptTitle}</p>
        <p className="linked-task-prompt-text">{pendingTaskCompletionPrompt.text}</p>
        <div className="linked-task-prompt-actions">
          <button type="button" className="linked-task-complete-button" onClick={handleConfirmLinkedTaskComplete}>
            {linkedTaskCompleteLabel}
          </button>
          <button type="button" className="linked-task-keep-button" onClick={handleKeepLinkedTaskActive}>
            {linkedTaskKeepLabel}
          </button>
        </div>
      </section>
    )
  }

  function renderFocusTab() {
    return (
      <>
        <section className="focus-start-section panel-section panel-section--focus-start">
          <div className="focus-goal-section">
            <label className="focus-goal-label" htmlFor="focus-goal">
              {goalTitle}
            </label>
            <p className="focus-start-hint">{focusStartHint}</p>
            <input
              id="focus-goal"
              className="focus-goal-input"
              type="text"
              maxLength={40}
              value={currentGoal}
              placeholder={goalPlaceholder}
              onChange={(event) => {
                updateCurrentGoal(event.target.value)
                setLinkedFocusTaskId(null)
              }}
            />
          </div>

          <div className="duration-section">
            <p>{durationTitle}</p>
            <div className="duration-options">
              {focusDurations.map((duration) => (
                <button
                  key={duration}
                  type="button"
                  className={duration === selectedDurationMinutes ? 'active' : ''}
                  aria-pressed={duration === selectedDurationMinutes}
                  onClick={() => selectDuration(duration)}
                >
                  {duration}
                  <span>{minutesLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="actions idle-actions">
            <button
              type="button"
              className="primary"
              onClick={handleStartFocusFromUi}
            >
              {startLabel} {selectedDurationMinutes} {minutesLabel}
            </button>
          </div>
        </section>

        <section className="micro-task-card panel-section" aria-label={microTaskTitle}>
          <div className="micro-task-header">
            <h2>{microTaskTitle}</h2>
            <span className="micro-task-stat">今日完成 {todayCompletedMicroTaskCount} 个小任务</span>
          </div>
          <form
            className="micro-task-input-row"
            onSubmit={(event) => {
              event.preventDefault()
              handleAddMicroTask()
            }}
          >
            <input
              type="text"
              maxLength={40}
              value={microTaskInput}
              placeholder={microTaskPlaceholder}
              onChange={(event) => {
                setMicroTaskInput(event.target.value)
                if (microTaskFeedback) setMicroTaskFeedback('')
              }}
            />
            <button type="submit" disabled={!microTaskInput.trim()}>
              {microTaskAddLabel}
            </button>
          </form>
          {visibleMicroTasks.length > 0 ? (
            <>
              <ul className="micro-task-list">
                {visibleMicroTasks.map((task) => (
                  <li key={task.id} className="micro-task-item">
                    <span className="micro-task-title">{task.text}</span>
                    <div className="micro-task-actions">
                      <button
                        type="button"
                        className="micro-task-secondary-button"
                        onClick={() => handleSetMicroTaskAsGoal(task)}
                      >
                        {microTaskSetGoalLabel}
                      </button>
                      <button
                        type="button"
                        className="micro-task-complete-button"
                        onClick={() => handleCompleteMicroTask(task.id)}
                      >
                        {microTaskCompleteLabel}
                      </button>
                      <button
                        type="button"
                        className="micro-task-delete-button"
                        aria-label="删除小任务"
                        onClick={() => handleDeleteMicroTask(task.id)}
                      >
                        {microTaskDeleteLabel}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {activeMicroTasks.length > visibleMicroTasks.length && (
                <p className="micro-task-overflow">{microTaskOverflowHint}</p>
              )}
            </>
          ) : (
            <p className="micro-task-empty">{microTaskEmptyText}</p>
          )}
          {microTaskFeedback && <p className="micro-task-feedback">{microTaskFeedback}</p>}
        </section>

        <section className="today-section panel-section panel-section--today" aria-label={todayTitle}>
          <h2>{todayTitle}</h2>
          <p className="today-summary">
            {completedLabel} <strong>{todaySessionCount}</strong> {timesLabel} ·{' '}
            {totalLabel} <strong>{todayTotalMinutes}</strong> {minutesLabel}
          </p>
          <p className="growth-energy-pill">
            {growthEnergyLabel} +{todayGrowthEnergy}
          </p>
          <section className="daily-goal-section" aria-label={dailyGoalTitle}>
            <h3 className="daily-goal-title">{dailyGoalTitle}</h3>
            <div className="daily-goal-options">
              {dailyGoalOptions.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  className={`daily-goal-option${goal === todayGoal ? ' active' : ''}`}
                  aria-pressed={goal === todayGoal}
                  onClick={() => updateTodayGoal(goal)}
                >
                  {goal}
                  {roundLabel}
                </button>
              ))}
            </div>
            <p className="daily-goal-progress">
              {progressLabel}: {todaySessionCount} / {todayGoal}
            </p>
            <p className="daily-goal-message">{dailyGoalMessage}</p>
          </section>

          {recentRecords.length > 0 ? (
            <ul className="record-list">
              {recentRecords.slice(0, 3).map((record) => (
                <li key={record.id} className="record-item">
                  <div className="record-meta">
                    <span className="record-time">{record.completedAt}</span>
                    <span className="record-duration">
                      {record.durationMinutes} {minutesLabel}
                    </span>
                  </div>
                  <span className="focus-record-goal">{record.goal || missingGoal}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-records">
              <strong>{emptyTitle}</strong>
              <span>{emptyHint}</span>
            </div>
          )}
        </section>

        <div className="idle-state-actions" aria-label={stateLabel}>
          <span>{stateLabel}:</span>
          <button type="button" onClick={reset}>
            {idleLabel}
          </button>
          <span aria-hidden="true">{'\u00b7'}</span>
          <button type="button" onClick={rest}>
            {sleepyLabel}
          </button>
        </div>

        {isDevMode && (
          <section className="dev-tools-section" aria-label={devToolsTitle}>
            <p className="dev-tools-title">{devToolsTitle}</p>
            <div className="dev-tools-row">
              <span>
                {quickTestLabel}: {isQuickTestMode ? enabledLabel : disabledLabel}
              </span>
              <button type="button" className="dev-toggle-button" onClick={toggleQuickTestMode}>
                {isQuickTestMode ? disabledLabel : enabledLabel}
              </button>
            </div>
            {isQuickTestMode && <p className="dev-tools-note">{quickTestNote}</p>}
          </section>
        )}
      </>
    )
  }

  function renderCompanionTab() {
    return (
      <section className="companion-memory-section panel-section panel-section--companion" aria-label={companionNotesTitle}>
        <div className="companion-memory-header">
          <h3>{companionNotesTitle}</h3>
        </div>
        <p className="companion-memory-status">
          {aiCompanionEnabled ? aiCompanionOpenTitle : aiCompanionClosedTitle}
        </p>
        <p className="companion-memory-description">
          {aiCompanionEnabled ? aiCompanionOpenText : aiCompanionClosedText}
        </p>
        <section className="local-companion-review" aria-label={localCompanionReviewTitle}>
          <p className="local-companion-review-title">{localCompanionReviewTitle}</p>
          <p className="local-companion-review-text">{localCompanionReview}</p>
          <p className="local-companion-review-note">{localCompanionReviewNote}</p>
        </section>
        <section className="growth-energy-card" aria-label={growthEnergyLabel}>
          <p className="growth-energy-title">{growthEnergyLabel}</p>
          <p className="growth-energy-value">今天积攒了 {todayGrowthEnergy} 点能量。</p>
          <p className="growth-energy-note">
            {todayGrowthEnergy > 0 ? growthEnergyNote : growthEnergyEmptyText}
          </p>
        </section>
        <section className="daily-summary-card" aria-label={dailySummary.title}>
          <p className="daily-summary-title">{dailySummary.title}</p>
          <div className="daily-summary-lines">
            {dailySummary.lines.map((line) => (
              <p key={line} className="daily-summary-line">
                {line}
              </p>
            ))}
          </div>
          <p className="daily-summary-footer">{dailySummary.footer}</p>
          <div className="ai-diary-actions">
            <button
              type="button"
              className="ai-diary-button"
              disabled={isAiDiaryGenerating}
              onClick={handleGenerateAiDiary}
            >
              {isAiDiaryGenerating ? aiDiaryPendingText : aiDiaryText ? aiDiaryRegenerateLabel : aiDiaryButtonLabel}
            </button>
            {isAiDiaryGenerating && (
              <button type="button" className="ai-diary-cancel-button" onClick={cancelAiDiaryRequest}>
                {aiDiaryCancelLabel}
              </button>
            )}
          </div>
          {aiDiaryStatus && <p className="ai-diary-status">{aiDiaryStatus}</p>}
          {aiDiaryError && (
            <div className="ai-diary-error">
              <span>{aiDiaryError}</span>
              {(aiDiaryError === aiDiaryDisabledText || aiDiaryError === aiDiaryIncompleteText) && (
                <button type="button" className="ai-diary-settings-button" onClick={openSettingsPanel}>
                  {goSettingsLabel}
                </button>
              )}
            </div>
          )}
          {aiDiaryText && (
            <section className="ai-diary-card" aria-label={aiDiaryTitle}>
              <p className="ai-diary-title">{aiDiaryTitle}</p>
              <p className="ai-diary-text">{aiDiaryText}</p>
              <div className="ai-diary-save-row">
                <button
                  type="button"
                  className={aiDiarySaved ? 'ai-diary-saved-button' : 'ai-diary-save-button'}
                  disabled={aiDiarySaved || isAiDiaryGenerating}
                  onClick={handleSaveAiDiary}
                >
                  {aiDiarySaved ? aiDiarySavedLabel : aiDiarySaveLabel}
                </button>
                {aiDiarySaveStatus && <span className="ai-diary-save-status">{aiDiarySaveStatus}</span>}
                {aiDiarySaveError && <span className="ai-diary-save-error">{aiDiarySaveError}</span>}
              </div>
            </section>
          )}
        </section>
        <section className="saved-diaries-card" aria-label={savedDiariesTitle}>
          <p className="saved-diaries-title">{savedDiariesTitle}</p>
          {dailyDiaries.length > 0 ? (
            <ul className="saved-diary-list">
              {dailyDiaries.map((diary) => {
                const isExpanded = expandedDiaryId === diary.id

                return (
                  <li key={diary.id} className="saved-diary-item">
                    <div className="saved-diary-meta">
                      <span>{formatCompanionMemoryTime(diary.createdAt) || diary.date}</span>
                      <span>{diary.source === 'ai' ? 'AI 日记' : diary.source}</span>
                    </div>
                    <p className="saved-diary-title">{diary.title}</p>
                    <p className={isExpanded ? 'saved-diary-text' : 'saved-diary-preview'}>
                      {isExpanded ? diary.text : formatSavedDiaryPreview(diary.text)}
                    </p>
                    <div className="saved-diary-actions">
                      <button
                        type="button"
                        className="saved-diary-button"
                        onClick={() => handleToggleSavedDiary(diary.id)}
                      >
                        {isExpanded ? savedDiaryCollapseLabel : savedDiaryExpandLabel}
                      </button>
                      <button
                        type="button"
                        className="saved-diary-delete"
                        onClick={() => handleDeleteSavedDiary(diary.id)}
                      >
                        {savedDiaryDeleteLabel}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="saved-diaries-empty">{savedDiariesEmptyText}</p>
          )}
          {savedDiaryStatus && <p className="saved-diary-status">{savedDiaryStatus}</p>}
        </section>
        <section className="mood-section" aria-label={moodSectionTitle}>
          <p className="mood-section-title">{moodSectionTitle}</p>
          <div className="mood-chip-list">
            {moodTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`mood-chip${latestMoodTag === tag ? ' mood-chip--active' : ''}`}
                aria-pressed={latestMoodTag === tag}
                onClick={() => handleMoodTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="mood-summary">
            {companionMemory.recentMoodTags.length > 0
              ? `${moodSummaryLabel}${recentMoodTagsText}`
              : moodEmptyText}
          </p>
          {moodFeedbackVisible && <p className="mood-feedback">{moodFeedbackText}</p>}
        </section>
        {hasCompanionNotes ? (
            <ul className={`companion-memory-list${companionMemoryExpanded ? ' expanded' : ''}`}>
              {companionMemoryNotes.map((note, index) => (
                <li key={note.id} className="companion-memory-item">
                  <span className="companion-memory-time">{formatCompanionMemoryTime(note.createdAt)}</span>
                  <span className="companion-memory-text">
                    {!companionMemoryExpanded && index === 0 ? recentMemoryLabel : ''}
                    {note.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
          <div className="companion-empty-guide">
            <p className="companion-memory-empty">{companionMemoryEmptyText}</p>
            <button type="button" className="companion-memory-link" onClick={() => setActivePanelTab('ask')}>
              {companionEmptyActionText}
            </button>
          </div>
        )}
        <p className="companion-memory-privacy">{companionMemoryPrivacyText}</p>
        <div className="companion-memory-actions">
          {canExpandCompanionMemory && (
            <button
              type="button"
              className="companion-memory-link"
              onClick={() => setCompanionMemoryExpanded((value) => !value)}
            >
              {companionMemoryExpanded ? collapseMemoryLabel : viewAllMemoryLabel}
            </button>
          )}
          {companionMemory.notes.length > 0 && !companionMemoryClearConfirming && (
            <button
              type="button"
              className="companion-memory-danger"
              onClick={() => setCompanionMemoryClearConfirming(true)}
            >
              {clearMemoryLabel}
            </button>
          )}
        </div>
        {companionMemoryClearConfirming && (
          <div className="companion-memory-confirm">
            <span>{clearMemoryConfirmText}</span>
            <button type="button" className="companion-memory-danger" onClick={clearCompanionMemoryNotes}>
              {confirmClearMemoryLabel}
            </button>
            <button
              type="button"
              className="companion-memory-link"
              onClick={() => setCompanionMemoryClearConfirming(false)}
            >
              {cancelLabel}
            </button>
          </div>
        )}
      </section>
    )
  }

  function renderAskTab() {
    const askGuideTitle = aiSettings.chatEnabled ? aiAskIncompleteTitle : aiAskDisabledTitle
    const askGuideText = aiSettings.chatEnabled ? aiAskIncompleteText : aiAskDisabledText

    return (
      <section className="ai-ask-card panel-section panel-section--ai-ask" aria-label={aiAskTitle}>
        <div className="ai-ask-header">
          <p className="ai-ask-title">{aiAskTitle}</p>
          {(isFocusing || isPreparing) && <span>{aiAskFocusHint}</span>}
        </div>
        {!aiAskReady ? (
          <div className="ai-ask-guide">
            <p className="ai-ask-guide-title">{askGuideTitle}</p>
            <p className="ai-ask-guide-text">{askGuideText}</p>
            <button type="button" className="ai-ask-guide-button" onClick={openSettingsPanel}>
              {goSettingsLabel}
            </button>
          </div>
        ) : (
          <>
            <form
              className="ai-ask-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleAiAskSubmit()
              }}
            >
              <input
                className="ai-ask-input"
                type="text"
                maxLength={500}
                value={aiAskInput}
                placeholder={aiAskPlaceholder}
                disabled={aiAskPending}
                onChange={(event) => {
                  setAiAskInput(event.target.value)
                  if (aiAskStatus && event.target.value.trim()) setAiAskStatus('')
                }}
              />
              <button type="submit" className="ai-ask-send" disabled={aiAskPending}>
                {aiAskPending ? aiAskPendingText : aiAskSendLabel}
              </button>
            </form>
            {aiAskPending && (
              <div className="ai-request-actions">
                <button type="button" className="ai-cancel-button" onClick={cancelAiAskRequest}>
                  {aiCancelLabel}
                </button>
              </div>
            )}
          </>
        )}
        {aiAskReply && (
          <>
            <p className="ai-ask-reply">{aiAskReply}</p>
            {aiAskResultState === 'success' && (
              aiMemorySuggestionVisible && !aiRemembered ? (
                <div className="ai-memory-suggestion">
                  <p className="ai-memory-suggestion-text">{aiMemorySuggestionText}</p>
                  <div className="ai-memory-suggestion-actions">
                    <button
                      type="button"
                      className="ai-memory-suggestion-button"
                      onClick={handleRememberAiReply}
                    >
                      {aiMemorySuggestionRememberLabel}
                    </button>
                    <button
                      type="button"
                      className="ai-memory-suggestion-secondary"
                      onClick={dismissAiMemorySuggestion}
                    >
                      {aiMemorySuggestionDismissLabel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ai-remember-action">
                  <button
                    type="button"
                    className="ai-remember-button"
                    disabled={aiRemembered}
                    onClick={handleRememberAiReply}
                  >
                    {aiRemembered ? aiRememberDoneLabel : aiRememberLabel}
                  </button>
                  {aiRememberStatus && <span className="ai-remember-status">{aiRememberStatus}</span>}
                </div>
              )
            )}
          </>
        )}
        {aiAskStatus && <p className="ai-ask-status">{aiAskStatus}</p>}
        {aiAskReady && (
          <>
            <div className="ai-temporary-context-row">
              <span>{aiTemporaryContextText}</span>
              {temporaryChatTurns.length > 0 && (
                <button type="button" onClick={clearTemporaryChatTurns}>
                  {clearTemporaryChatLabel}
                </button>
              )}
            </div>
            <p className="ai-ask-privacy">{aiAskShortPrivacyText}</p>
          </>
        )}
      </section>
    )
  }

  function renderSettingsTab() {
    return (
      <section className="settings-panel" aria-label={settingsPanelTitle}>
        <div className="settings-panel-header">
          <p className="settings-panel-title">{settingsPanelTitle}</p>
          <button type="button" className="settings-panel-close" onClick={closeSettingsPanel}>
            {settingsDoneLabel}
          </button>
        </div>
        <section className="settings-panel-section" aria-label={settingsAiSectionTitle}>
          <p className="settings-panel-section-title">{settingsAiSectionTitle}</p>
          <section className="companion-memory-section panel-section--settings-companion" aria-label="AI 陪伴开关">
            <div className="companion-memory-header">
              <h3>AI 陪伴</h3>
              <button type="button" className="companion-memory-toggle" onClick={toggleAiCompanion}>
                {aiCompanionEnabled ? disableAiCompanionLabel : enableAiCompanionLabel}
              </button>
            </div>
            <p className="companion-memory-status">
              {aiCompanionEnabled ? aiCompanionOpenTitle : aiCompanionClosedTitle}
            </p>
            <p className="companion-memory-description">
              {aiCompanionEnabled ? aiCompanionOpenText : aiCompanionClosedText}
            </p>
          </section>
          <section className="ai-settings-section panel-section--ai-settings" aria-label={aiChatTitle}>
            <div className="ai-settings-header">
              <p className="ai-settings-summary">{aiChatLightStatus}</p>
            </div>
            <div className="ai-settings-form" aria-label={aiChatSettingsLabel}>
              <p className="ai-settings-notice">
                {aiChatNotice} · {aiChatStatusText} · Provider: {aiChatProviderText} · Model: {aiChatModelText}
              </p>
              <label className="ai-settings-check">
                <input
                  type="checkbox"
                  checked={aiSettingsDraft.chatEnabled}
                  onChange={(event) => updateAiSettingsDraft({ chatEnabled: event.target.checked })}
                />
                <span>开启 AI 对话</span>
              </label>
              <p className="ai-settings-context">{aiSettingsPresetHint}</p>
              <button type="button" className="ai-settings-preset" onClick={applyDeepSeekPreset}>
                {aiChatDeepSeekPresetLabel}
              </button>
              <label className="ai-settings-field">
                <span>Provider</span>
                <select
                  value={aiSettingsDraft.provider}
                  onChange={(event) =>
                    updateAiSettingsDraft({
                      provider: event.target.value === 'openai-compatible' ? 'openai-compatible' : 'none',
                    })
                  }
                >
                  <option value="none">{aiChatProviderNoneLabel}</option>
                  <option value="openai-compatible">{aiChatProviderOpenAiCompatibleLabel}</option>
                </select>
              </label>
              <label className="ai-settings-field">
                <span>Base URL</span>
                <input
                  type="text"
                  value={aiSettingsDraft.baseUrl}
                  placeholder="https://..."
                  onChange={(event) => updateAiSettingsDraft({ baseUrl: event.target.value })}
                />
              </label>
              <label className="ai-settings-field">
                <span>API Key</span>
                <input
                  type="password"
                  value={aiSettingsDraft.apiKey}
                  placeholder="仅保存在本地"
                  onChange={(event) => updateAiSettingsDraft({ apiKey: event.target.value })}
                />
                <small>只保存在本机，不会上传到 Focus Pet。</small>
              </label>
              <label className="ai-settings-field">
                <span>Model</span>
                <input
                  type="text"
                  value={aiSettingsDraft.model}
                  placeholder="model name"
                  onChange={(event) => updateAiSettingsDraft({ model: event.target.value })}
                />
              </label>
              <p className="ai-settings-context">{aiChatContextHint}</p>
              <div className="ai-settings-actions">
                <button type="button" className="ai-settings-save" onClick={saveAiSettingsDraft}>
                  {aiChatSaveLabel}
                </button>
                <button type="button" className="ai-settings-reset" onClick={clearAiSettingsDraft}>
                  {aiChatResetLabel}
                </button>
              </div>
            </div>
          </section>
        </section>
        <section className="settings-panel-section" aria-label={settingsWindowSectionTitle}>
          <p className="settings-panel-section-title">{settingsWindowSectionTitle}</p>
          {openAtLoginAvailable && (
            <button type="button" className="settings-panel-toggle" onClick={toggleOpenAtLogin}>
              {openAtLogin ? openAtLoginEnabledLabel : openAtLoginDisabledLabel}
            </button>
          )}
          <p className="settings-panel-hint">{openAtLoginSettingsText}</p>
        </section>
        <section className="settings-panel-section" aria-label={proactiveCompanionTitle}>
          <div className="companion-memory-header">
            <h3>{proactiveCompanionTitle}</h3>
            <button type="button" className="companion-memory-toggle" onClick={toggleProactiveCompanion}>
              {proactiveSettings.enabled ? disabledLabel : enabledLabel}
            </button>
          </div>
          <p className="companion-memory-description">{proactiveCompanionDescription}</p>
          <p className="companion-memory-privacy">{proactiveCompanionPrivacy}</p>
        </section>
        <section className="settings-panel-section" aria-label={settingsPrivacySectionTitle}>
          <p className="settings-panel-section-title">{settingsPrivacySectionTitle}</p>
          <p className="settings-panel-hint">{aiChatPrivacyText}</p>
          <p className="settings-panel-hint">{aiAskPrivacyText}</p>
          <p className="settings-panel-hint">{aiDiaryPrivacyText}</p>
          <p className="settings-panel-hint">{localOnlyPrivacyText}</p>
        </section>
        <section className="settings-panel-section" aria-label={settingsAboutSectionTitle}>
          <p className="settings-panel-section-title">{settingsAboutSectionTitle}</p>
          <p className="settings-panel-hint">{aboutFocusPetText}</p>
          <p className="settings-panel-hint">当前版本：v1.0.0-dev，本地自用构建。</p>
        </section>
      </section>
    )
  }

  function renderActivePanelTab() {
    if (activePanelTab === 'companion') return renderCompanionTab()
    if (activePanelTab === 'ask') return renderAskTab()
    return renderFocusTab()
  }

  function handleWindowMenuPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    setIgnoreMouseEvents(false)
    event.currentTarget.setPointerCapture(event.pointerId)
    windowDragRef.current = {
      dragging: false,
      lastX: event.screenX,
      lastY: event.screenY,
      pointerId: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
    }
  }

  function handleWindowMenuPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = windowDragRef.current
    if (drag.pointerId !== event.pointerId) return

    const totalDeltaX = event.screenX - drag.startX
    const totalDeltaY = event.screenY - drag.startY
    if (!drag.dragging && Math.hypot(totalDeltaX, totalDeltaY) > 5) {
      drag.dragging = true
      setWindowMenuDragging(true)
      setWindowMenuOpen(false)
    }

    if (!drag.dragging) return

    const deltaX = event.screenX - drag.lastX
    const deltaY = event.screenY - drag.lastY
    drag.lastX = event.screenX
    drag.lastY = event.screenY
    window.focusPet?.moveBy(deltaX, deltaY)
  }

  function finishWindowMenuPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = windowDragRef.current
    if (drag.pointerId !== event.pointerId) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!drag.dragging) {
      setWindowMenuOpen((value) => !value)
    }

    windowDragRef.current = {
      dragging: false,
      lastX: 0,
      lastY: 0,
      pointerId: -1,
      startX: 0,
      startY: 0,
    }
    setWindowMenuDragging(false)
  }

  return (
    <main className={`pet-window pet-window--${windowMode}`} aria-label="Focus Pet desktop companion">
      <div
        className="pet-content-fit"
        ref={contentFitRef}
        onMouseEnter={() => setPetControlsVisible(true)}
        onMouseLeave={() => {
          if (!windowMenuOpen) {
            setPetControlsVisible(false)
          }
        }}
      >
        <div
          className={`window-menu-wrap mouse-interactive${petControlsVisible || windowMenuOpen ? ' visible' : ''}`}
          ref={windowMenuRef}
        >
          <button
            type="button"
            className={`window-menu-trigger mouse-interactive${windowMenuDragging ? ' dragging' : ''}`}
            aria-label="Window controls"
            aria-expanded={windowMenuOpen}
            onPointerDown={handleWindowMenuPointerDown}
            onPointerMove={handleWindowMenuPointerMove}
            onPointerUp={finishWindowMenuPointer}
            onPointerCancel={finishWindowMenuPointer}
          >
            <span />
          </button>

          {windowMenuOpen && (
            <div className="window-menu mouse-interactive" role="menu">
              <button
                type="button"
                className="window-menu-item mouse-interactive"
                role="menuitem"
                onClick={openSettingsPanel}
              >
                {settingsLabel}
              </button>
              {openAtLoginAvailable && (
                <button
                  type="button"
                  className="window-menu-toggle mouse-interactive"
                  role="menuitemcheckbox"
                  aria-checked={openAtLogin}
                  onClick={toggleOpenAtLogin}
                >
                  <span>{openAtLogin ? openAtLoginEnabledLabel : openAtLoginDisabledLabel}</span>
                </button>
              )}

              {openAtLoginAvailable && <span className="window-menu-divider" aria-hidden="true" />}

              <button
                type="button"
                className="window-menu-item mouse-interactive"
                role="menuitem"
                onClick={() => {
                  setWindowMenuOpen(false)
                  window.focusPet?.minimize()
                }}
              >
                {minimizeLabel}
              </button>
              <button
                type="button"
                className="window-menu-item danger mouse-interactive"
                role="menuitem"
                onClick={() => {
                  setWindowMenuOpen(false)
                  window.focusPet?.close()
                }}
              >
                {closeLabel}
              </button>
            </div>
          )}
        </div>

        <button type="button" className="companion mouse-interactive" onClick={handlePetClick}>
          <Live2DPet state={petVisualState} motionEventId={live2DMotionEventId} />
        </button>

        <button
          type="button"
          className={`bubble mouse-interactive${isFocusing ? ' bubble-focus focus-mini-bubble' : ''}`}
          aria-expanded={panelOpen}
          onClick={() => {
            if (isPreparing) {
              return
            }

            if (isFocusing) {
              showFocusNudge()
              return
            }

            if (isResting || isBreakPrompt || isRestComplete) {
              setPanelOpen(true)
              return
            }

            setPanelOpen((value) => !value)
          }}
        >
          {bubbleText}
        </button>

        {canShowProactiveNudge && (
          <div className="proactive-actions mouse-interactive" aria-label="低频主动陪伴操作">
            <button
              type="button"
              className="proactive-action-button proactive-action-primary mouse-interactive"
              onClick={handleStartSmallFocusFromNudge}
            >
              {proactiveStartFiveLabel}
            </button>
            <button
              type="button"
              className="proactive-action-button proactive-action-secondary mouse-interactive"
              onClick={handleSnoozeProactiveNudge}
            >
              {proactiveSnoozeLabel}
            </button>
          </div>
        )}

        {isIdleMinimal && (
          <div className="quick-start-row mouse-interactive">
            <button
              type="button"
              className="quick-start-button mouse-interactive"
              onClick={handleStartFocusFromUi}
            >
              {startLabel} {selectedDurationMinutes} {minutesLabel}
            </button>
            <button type="button" className="more-button mouse-interactive" onClick={() => setPanelOpen(true)}>
              {moreLabel}
            </button>
          </div>
        )}

        {isPreparing && (
          <div className="preparing-row mouse-interactive">
            <button type="button" className="preparing-cancel-button mouse-interactive" onClick={handleCancelPreparing}>
              取消
            </button>
          </div>
        )}

        {panelOpen && (
          <section
            className={`panel mouse-interactive${isFocusing ? ' pet-panel--focus' : ''}${isCompletionCheer ? ' panel--cheer' : ''}${isIdleControlPanel ? ' panel--idle' : ''}${settingsPanelOpen ? ' panel--settings-open' : ''}`}
          >
          {!isFocusing && !isCompletionCheer && (
            <div className="panel-header">
              <div>
                <p className="eyebrow">{status}</p>
                <h1>{petName}</h1>
              </div>
              <div className="stats">
                <span className="stats-value">{sessions}</span>
                <small className="stats-label">today</small>
              </div>
            </div>
          )}

          {isBreakPrompt && (
            <section className="break-prompt">
              <h2>{breakPromptTitle}</h2>
              <p>{breakPromptText}</p>
              <div className="break-actions">
                <button type="button" onClick={startBreak}>
                  {breakLabel}
                </button>
                <button type="button" className="secondary" onClick={dismissBreakPrompt}>
                  {laterLabel}
                </button>
              </div>
            </section>
          )}

          {isResting && (
            <>
              <p className="current-goal">
                {displayText}
              </p>
              <div className="actions focus-actions">
                <button type="button" onClick={endBreak}>
                  {endBreakLabel}
                </button>
              </div>
            </>
          )}

          {isRestComplete && (
            <section className="break-prompt">
              <h2>{restCompleteTitle}</h2>
              <p>{restCompleteText}</p>
              <div className="break-actions rest-complete-actions">
                <button type="button" onClick={() => prepareNextFocus(lastFocusDurationMinutes)}>
                  {againLabel} {lastFocusDurationMinutes} {minutesLabel}
                </button>
                <button type="button" className="secondary" onClick={() => prepareNextFocus()}>
                  {changeDurationLabel}
                </button>
                <button type="button" className="secondary" onClick={dismissRestComplete}>
                  {laterLabel}
                </button>
              </div>
            </section>
          )}

          {isCompletionCheer && (
            <section className="cheer-panel" aria-label={cheerPanelTitle}>
              <p className="eyebrow">COMPLETE</p>
              <h2>{cheerPanelTitle}</h2>
              <p>{cheerPanelText}</p>
              <div className="cheer-feedback" aria-label="\u5b8c\u6210\u53cd\u9988">
                <p>{completionGoalText}</p>
                <p>
                  \u4eca\u5929\u5df2\u7ecf\u5b8c\u6210 <strong>{todaySessionCount}</strong> {roundLabel}\u4e86\u3002
                  \u7d2f\u8ba1\u4e13\u6ce8 <strong>{todayTotalMinutes}</strong> {minutesLabel}\u3002
                </p>
                <p>{completionDailyGoalText}</p>
                <p className="growth-energy-feedback">
                  {growthEnergyFocusFeedback}，今天 +{todayGrowthEnergy}。
                </p>
              </div>
              <div className="cheer-actions">
                <button type="button" onClick={startBreak}>
                  {breakLabel}
                </button>
                <button type="button" className="secondary" onClick={reset}>
                  {laterLabel}
                </button>
              </div>
            </section>
          )}

          {!isPreparing && !isFocusing && renderLinkedTaskPrompt()}

          {isIdleControlPanel && (
            <>
              <nav className="panel-tabs" aria-label="完整面板分区">
                {panelTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`panel-tab${activePanelTab === tab.id ? ' panel-tab-active' : ''}`}
                    aria-pressed={activePanelTab === tab.id}
                    onClick={() => setActivePanelTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              <div key={activePanelTab} className="panel-tab-content">
                {renderActivePanelTab()}
              </div>
            </>
          )}

          {isFocusing && (
            <>
              <div className="focus-panel-header">
                <p className="eyebrow">FOCUSING</p>
                <h1>{focusingTitle}</h1>
              </div>
              <div className="focus-panel-goal">
                <span>{goalTitle}</span>
                <strong>{currentGoal.trim() || missingGoal}</strong>
              </div>
              <div className="focus-panel-time">
                <span>{remainingLabel}</span>
                <strong>{remainingTime}</strong>
              </div>
              <div className="focus-nudge">
                <p>{focusNudgeTitle}</p>
                <span>{focusNudge}</span>
              </div>
              <div className="actions focus-actions">
                <button
                  type="button"
                  className={stopConfirming ? 'confirm' : ''}
                  onClick={handleEndFocus}
                >
                  {stopConfirming ? confirmStopLabel : stopLabel}
                </button>
              </div>
            </>

          )}

          {settingsPanelOpen && (
            <div className="settings-panel-overlay">
              {renderSettingsTab()}
            </div>
          )}

          </section>
        )}
      </div>
    </main>
  )
}

export default App
