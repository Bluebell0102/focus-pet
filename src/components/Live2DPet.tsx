import { memo, useEffect, useRef } from 'react'
import { init } from 'l2d'
import type { L2D } from 'l2d'
import type { PetMood } from '../hooks/usePetState'

export type Live2DPetState =
  | PetMood
  | 'ready'
  | 'preparing'
  | 'focusing'
  | 'distraction'
  | 'completed'
  | 'resting'
  | 'restComplete'

const MODEL_PATH = './assets/huohuo/huohuo.model3.json'
const MODEL_POSITION: [number, number] = [0, -0.16]
const MODEL_SCALE = 0.56

const LOOK_RESET_DELAY_MS = 180
const LOOK_RESET_DURATION_MS = 520

const LOOK_PARAM_IDS = [
  'ParamAngleX',
  'ParamAngleY',
  'ParamAngleZ',
  'ParamBodyAngleX',
  'ParamEyeBallX',
  'ParamEyeBallY',
] as const

type LookParamId = (typeof LOOK_PARAM_IDS)[number]
type LookParams = Record<LookParamId, number>

const LOOK_CENTER = Object.fromEntries(LOOK_PARAM_IDS.map((id) => [id, 0])) as LookParams

type Live2DPrivateBridge = {
  _state?: {
    l2d6Model?: {
      _subdelegates?: Array<{
        getLive2DManager?: () => {
          onDrag?: (x: number, y: number) => void
        }
      }>
    }
  }
}

/** 各状态优先播放的动作组，按顺序取模型里第一个存在的；都没有时兜底 Scene1。 */
const MOTION_PREFERENCES: Record<Live2DPetState, string[]> = {
  idle: ['Scene1', 'haoqi'],
  ready: ['haoqi', 'Scene1'],
  preparing: ['haoqi', 'Scene1'],
  focus: ['Scene1', 'keshui'],
  focusing: ['Scene1', 'keshui'],
  distraction: ['yaotou', 'haoqi', 'zhentou', 'Scene1'],
  cheer: ['qizi', 'linghun', 'zhentou', 'haoqi', 'Scene1'],
  completed: ['qizi', 'linghun', 'zhentou', 'haoqi', 'Scene1'],
  sleepy: ['keshui', 'Scene1'],
  resting: ['keshui', 'Scene1'],
  restComplete: ['haoqi', 'qizi', 'Scene1'],
}

type IdleSchedule = { candidates: string[]; minDelayMs: number; maxDelayMs: number }

/** 长期停留在某个状态时，低频随机播放的待机动作。 */
const IDLE_MOTION_SCHEDULE: Partial<Record<Live2DPetState, IdleSchedule>> = {
  idle: { candidates: ['Scene1', 'haoqi', 'qizi'], minDelayMs: 18_000, maxDelayMs: 35_000 },
  ready: { candidates: ['Scene1', 'haoqi'], minDelayMs: 18_000, maxDelayMs: 35_000 },
  focusing: { candidates: ['Scene1', 'keshui'], minDelayMs: 30_000, maxDelayMs: 60_000 },
  resting: { candidates: ['keshui', 'Scene1'], minDelayMs: 20_000, maxDelayMs: 45_000 },
  sleepy: { candidates: ['keshui', 'Scene1'], minDelayMs: 20_000, maxDelayMs: 45_000 },
}

interface Props {
  state: Live2DPetState
  /** 每次递增都会触发一次“分心提醒”动作（yaotou 等）。 */
  motionEventId?: number
}

function findMotionGroup(instance: L2D, candidates: string[]) {
  const groups = Object.keys(instance.getMotions())

  for (const candidate of [...candidates, 'Scene1']) {
    const group = groups.find((name) => name.toLowerCase() === candidate.toLowerCase())
    if (group) return group
  }

  return undefined
}

function playMotion(instance: L2D, candidates: string[], priority = 1) {
  const group = findMotionGroup(instance, candidates)
  if (!group) {
    if (import.meta.env.DEV) console.warn('[Live2D] no motion group available for', candidates)
    return
  }

  try {
    instance.playMotion(group, undefined, priority)
  } catch (error) {
    if (import.meta.env.DEV) console.warn(`[Live2D] motion failed: ${group}`, error)
  }
}

function playStateMotion(instance: L2D, state: Live2DPetState, priority = 1) {
  playMotion(instance, MOTION_PREFERENCES[state] ?? MOTION_PREFERENCES.idle, priority)
}

function Live2DPetComponent({ state, motionEventId = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const l2dRef = useRef<L2D | null>(null)
  const loadedRef = useRef(false)
  const motionPlayingRef = useRef(false)
  const lookResetTimeoutRef = useRef<number | null>(null)
  const lookResetRafRef = useRef<number | null>(null)
  const idleMotionTimeoutRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  const lastStateRef = useRef<Live2DPetState | null>(null)
  const lastMotionEventIdRef = useRef(0)

  stateRef.current = state

  function getReadyInstance() {
    return loadedRef.current ? l2dRef.current : null
  }

  function clearLookResetTimers() {
    if (lookResetTimeoutRef.current !== null) {
      window.clearTimeout(lookResetTimeoutRef.current)
      lookResetTimeoutRef.current = null
    }

    if (lookResetRafRef.current !== null) {
      window.cancelAnimationFrame(lookResetRafRef.current)
      lookResetRafRef.current = null
    }
  }

  function clearIdleMotionTimer() {
    if (idleMotionTimeoutRef.current !== null) {
      window.clearTimeout(idleMotionTimeoutRef.current)
      idleMotionTimeoutRef.current = null
    }
  }

  /** 清掉 l2d 内部记住的鼠标拖拽方向，否则视线会回弹到最后一个鼠标位置。 */
  function resetInternalDrag(instance: L2D) {
    const bridge = instance as unknown as Live2DPrivateBridge
    bridge._state?.l2d6Model?._subdelegates?.[0]?.getLive2DManager?.()?.onDrag?.(0, 0)
  }

  function getLookParams(instance: L2D): LookParams {
    const snapshot = { ...LOOK_CENTER }
    for (const param of instance.getParams()) {
      if ((LOOK_PARAM_IDS as readonly string[]).includes(param.id)) {
        snapshot[param.id as LookParamId] = param.value
      }
    }
    return snapshot
  }

  function setLookCenter(instance: L2D, releaseAfter = false) {
    instance.setParams(LOOK_CENTER)
    resetInternalDrag(instance)
    if (releaseAfter) instance.setParams({})
  }

  /** 视线平滑回正到正前方。 */
  function resetLookToCenter() {
    const instance = getReadyInstance()
    if (!instance) return

    clearLookResetTimers()
    resetInternalDrag(instance)
    const start = getLookParams(instance)
    const startedAt = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / LOOK_RESET_DURATION_MS)
      const remain = Math.pow(1 - progress, 3)
      instance.setParams(
        Object.fromEntries(LOOK_PARAM_IDS.map((id) => [id, start[id] * remain])) as LookParams,
      )

      if (progress < 1) {
        lookResetRafRef.current = window.requestAnimationFrame(tick)
        return
      }

      lookResetRafRef.current = null
      setLookCenter(instance, true)
    }

    lookResetRafRef.current = window.requestAnimationFrame(tick)
  }

  function scheduleLookReset() {
    clearLookResetTimers()
    lookResetTimeoutRef.current = window.setTimeout(() => {
      lookResetTimeoutRef.current = null
      resetLookToCenter()
    }, LOOK_RESET_DELAY_MS)
  }

  function handlePointerEnter() {
    clearLookResetTimers()
    const instance = getReadyInstance()
    if (!instance) return

    // 专注中不追踪鼠标，保持低干扰
    if (stateRef.current === 'focusing') {
      setLookCenter(instance)
      return
    }

    instance.setParams({})
  }

  // 初始化画布并加载霍霍模型
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    const instance = init(canvas)
    l2dRef.current = instance
    instance.on('motionstart', () => {
      motionPlayingRef.current = true
    })
    instance.on('motionend', () => {
      motionPlayingRef.current = false
    })

    instance
      .load({ path: MODEL_PATH, position: MODEL_POSITION, scale: MODEL_SCALE, volume: 0 })
      .then(() => {
        if (cancelled) return

        loadedRef.current = true
        if (import.meta.env.DEV) {
          const summary = Object.entries(instance.getMotions()).map(([group, files]) => [group, files.length])
          console.info('[Live2D] available motions:', Object.fromEntries(summary))
        }
        lastStateRef.current = stateRef.current
        playStateMotion(instance, stateRef.current)
      })
      .catch((error) => {
        console.warn('[Live2D] failed to load huohuo model.', error)
      })

    return () => {
      cancelled = true
      loadedRef.current = false
      motionPlayingRef.current = false
      clearLookResetTimers()
      clearIdleMotionTimer()
      instance.destroy()
      l2dRef.current = null
    }
  }, [])

  // 状态切换时播放对应动作；完成 / 欢呼用高优先级
  useEffect(() => {
    const instance = getReadyInstance()
    if (!instance || lastStateRef.current === state) return

    lastStateRef.current = state
    playStateMotion(instance, state, state === 'completed' || state === 'cheer' ? 3 : 1)

    if (state === 'focusing') {
      clearLookResetTimers()
      setLookCenter(instance)
    } else {
      instance.setParams({})
      scheduleLookReset()
    }
  }, [state])

  // 窗口失焦、鼠标离开文档或页面不可见时，视线回正
  useEffect(() => {
    const handleWindowBlur = () => scheduleLookReset()
    const handleDocumentMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget === null) scheduleLookReset()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') scheduleLookReset()
    }

    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('mouseout', handleDocumentMouseOut)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('mouseout', handleDocumentMouseOut)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // 分心提醒：motionEventId 递增时播放一次
  useEffect(() => {
    const instance = getReadyInstance()
    if (!instance || motionEventId <= lastMotionEventIdRef.current) return

    lastMotionEventIdRef.current = motionEventId
    playStateMotion(instance, 'distraction', 3)
  }, [motionEventId])

  // 待机动作调度：没有动作在播时才插入
  useEffect(() => {
    const schedule = IDLE_MOTION_SCHEDULE[state]
    if (!schedule) return

    let cancelled = false

    function queueNextMotion() {
      const delay =
        schedule!.minDelayMs + Math.floor(Math.random() * (schedule!.maxDelayMs - schedule!.minDelayMs + 1))

      idleMotionTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return

        const instance = getReadyInstance()
        if (instance && !motionPlayingRef.current) {
          playMotion(instance, schedule!.candidates)
        }

        queueNextMotion()
      }, delay)
    }

    queueNextMotion()

    return () => {
      cancelled = true
      clearIdleMotionTimer()
    }
  }, [state])

  // 外层容器的轻微呼吸 / 浮动，增强待机生命感
  const lifeClass =
    state === 'focusing'
      ? ' live2d-pet-life live2d-pet-life--focus'
      : state === 'resting' || state === 'sleepy'
        ? ' live2d-pet-life live2d-pet-life--rest'
        : state === 'completed' || state === 'cheer'
          ? ''
          : ' live2d-pet-life live2d-pet-life--idle'

  return (
    <span
      className={`live2d-pet-wrap${lifeClass}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={scheduleLookReset}
      onMouseEnter={handlePointerEnter}
      onMouseLeave={scheduleLookReset}
    >
      <canvas
        ref={canvasRef}
        className="live2d-pet mouse-interactive"
        style={{ width: 336, height: 388, display: 'block', cursor: 'pointer' }}
      />
    </span>
  )
}

export const Live2DPet = memo(Live2DPetComponent)
