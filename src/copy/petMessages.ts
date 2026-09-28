export const petMessages = {
  idle: [
    '今天想先专注一下吗？',
    '我在这里，准备好了就开始吧。',
    '先来一小轮也可以。',
    '不用很久，5 分钟也算开始。',
    '今天也慢慢来。',
    '想做什么，我陪你一会儿。',
    '先把一件小事做完吧。',
  ],
  ready: [
    '写下这一轮要做什么吧。',
    '目标越小，越容易开始。',
    '这一轮只管这一件事。',
    '选个时长，我们开始。',
    '不用完美，先开始。',
  ],
  preparing: [
    '准、准备开始了……',
    '先深呼吸一下。',
    '这一轮，只看这一件事。',
    '我会陪着你的。',
  ],
  focusing: [
    '专注中，别跑远。',
    '先别切走，我陪你守着。',
    '这一轮只做这件事。',
    '快了，再坚持一下。',
    '慢慢来，保持住。',
  ],
  distraction: [
    '先别分心，这一轮快完成了。结束后再问我也可以……',
    '等结束后再看也来得及。',
    '我先帮你守着目标。',
    '现在只做这一件事。',
    '再坚持一下下。',
  ],
  completed: [
    '完成啦，这一轮很棒。',
    '契约达成。',
    '这一轮守住了。',
    '做得好，休息一下吧。',
    '又完成了一小步。',
  ],
  resting: [
    '休息一下，眼睛也要放松。',
    '现在是休息时间。',
    '站起来动一动也不错。',
    '喝口水吧。',
    '休息好了再继续。',
  ],
  restFinished: [
    '休息结束，要再来一轮吗？',
    '准备好了就继续。',
    '再来一小轮也可以。',
    '今天已经不错了，也可以稍后继续。',
    '下一轮想做什么？',
  ],
  emptyGoal: [
    '没写目标也可以，但这一轮要心里有数哦。',
    '这一轮先开始，目标可以简单一点。',
    '不知道写什么，就先做眼前这件事。',
  ],
} as const

export type PetMessageGroup = keyof typeof petMessages

export const petMessageTitles = {
  focusNudge: '正在专注',
  breakPrompt: '完成啦',
  restComplete: '休息好啦',
  focusing: '专注中',
  cheerPanel: '专注完成',
} as const

export const petFeedbackText = {
  breakPrompt: '做得好，先让眼睛和脑子都休息一下。',
  restComplete: '休息结束，要再来一轮吗？',
  focusDoneNotification: '完成啦，这一轮很棒。休息一下吧。',
  restDoneNotification: '休息结束，可以准备下一轮。',
} as const

export function pickMessage(group: PetMessageGroup) {
  const messages = petMessages[group]
  return messages[Math.floor(Math.random() * messages.length)]
}
