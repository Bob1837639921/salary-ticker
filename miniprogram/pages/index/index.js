const STORAGE_KEY = 'salaryTickerSettings'
const SCHEDULES = ['double', 'single', 'none']
const SCHEDULE_LABELS = ['双休（周六、周日休）', '单休（周日休）', '无休']
const DEFAULTS = { salary: 12000, start: '09:00', end: '18:00', schedule: 'double' }
const MASCOT_FRAMES = [1, 2, 3, 4].map(index => `/assets/mascot-gallop-${index}-v2.png`)
const DAILY_QUOTES = [
  ['人在工位', '心在下班'], ['上班求财', '不求感动'], ['工资到账', '烦恼退散'], ['老板画饼', '我先加葱'],
  ['班可以上', '钱不能少'], ['今日营业', '只为发薪'], ['嘴上加油', '心里下班'], ['打工不易', '求财保命'],
  ['带薪喝水', '也是正事'], ['工位坐稳', '暴富靠运'], ['周末太短', '工资太慢'], ['不要鸡汤', '只要到账'],
  ['财神保佑', '少点加班'], ['会议太长', '人生苦短'], ['活可以干', '钱请到位'], ['牛马开工', '钱包争气']
]

function quoteForDate(date) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
  return DAILY_QUOTES[((day % DAILY_QUOTES.length) + DAILY_QUOTES.length) % DAILY_QUOTES.length]
}

function sceneLayout(width, height) {
  const scale = Math.max(1, height * 1.35 / 1058)
  const left = width * 0.55 - 1080 * scale
  const quoteCenter = left + 1086 * scale
  return {
    sceneStyle: `width:${1487 * scale}px;height:${1058 * scale}px;left:${left}px;`,
    figurineStyle: `width:${42 * scale}px;height:${43 * scale}px;left:${left + 1090 * scale}px;top:${521 * scale}px;`,
    letteringStyle: `width:220px;height:95px;left:${quoteCenter - 110}px;top:${390 * scale}px;`
  }
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function money(value) {
  const number = Number.isFinite(value) ? value : 0
  const parts = number.toFixed(2).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `¥${parts.join('.')}`
}

function timeOn(date, value) {
  const [hour, minute] = value.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hour, minute, 0, 0)
  return result
}

function isWorkday(date, schedule) {
  const weekday = date.getDay()
  if (schedule === 'none') return true
  if (schedule === 'single') return weekday !== 0
  return weekday !== 0 && weekday !== 6
}

function countMonthWorkdays(date, schedule) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const days = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let day = 1; day <= days; day += 1) {
    if (isWorkday(new Date(year, month, day), schedule)) count += 1
  }
  return count
}

function calculate(settings, now = new Date()) {
  let start = timeOn(now, settings.start)
  const end = timeOn(now, settings.end)
  if (end <= start) {
    if (now < end) {
      start.setDate(start.getDate() - 1)
    } else {
      end.setDate(end.getDate() + 1)
    }
  }

  const workdays = countMonthWorkdays(now, settings.schedule)
  const totalSeconds = Math.max(60, (end - start) / 1000)
  const dayRate = settings.salary / Math.max(1, workdays)
  const secondRate = dayRate / totalSeconds
  let state = 'working'
  let remaining = end - now
  let elapsedSeconds = Math.max(0, (now - start) / 1000)

  if (!isWorkday(start, settings.schedule)) {
    state = 'off'
    remaining = 0
    elapsedSeconds = 0
  } else if (now < start) {
    state = 'before'
    remaining = start - now
    elapsedSeconds = 0
  } else if (now >= end) {
    state = 'after'
    remaining = 0
    elapsedSeconds = totalSeconds
  }

  const progress = state === 'after' ? 1 : Math.min(1, Math.max(0, elapsedSeconds / totalSeconds))
  return { state, remaining, earned: dayRate * progress, progress, dayRate, secondRate, workdays }
}

function duration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
}

function safeSettings(value) {
  const source = value && typeof value === 'object' ? value : {}
  const salary = Number(source.salary)
  return {
    salary: source.salary !== '' && Number.isFinite(salary) ? Math.max(0, salary) : DEFAULTS.salary,
    start: /^([01]\d|2[0-3]):[0-5]\d$/.test(source.start) ? source.start : DEFAULTS.start,
    end: /^([01]\d|2[0-3]):[0-5]\d$/.test(source.end) ? source.end : DEFAULTS.end,
    schedule: SCHEDULES.includes(source.schedule) ? source.schedule : DEFAULTS.schedule
  }
}

Page({
  data: {
    settings: DEFAULTS,
    draft: DEFAULTS,
    scheduleLabels: SCHEDULE_LABELS,
    draftScheduleIndex: 0,
    settingsVisible: false,
    contentTop: 96,
    sceneStyle: '',
    figurineStyle: '',
    letteringStyle: '',
    dailyQuote: DAILY_QUOTES[0],
    trackDashes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    dateText: '',
    state: 'working',
    statusText: '工作进行中',
    countdownLabel: '距离下班还有',
    countdown: '00:00:00',
    countdownCompact: false,
    earnedLabel: '今天已经赚到',
    earned: '¥0.00',
    secondRate: '0.0000',
    progressPercent: 0,
    visualProgress: 6,
    mascotFrame: MASCOT_FRAMES[0],
    mascotMessage: '向下班前进',
    showMascotNote: false,
    stats: { workdays: 0, hourRate: '¥0.00', minuteRate: '¥0.00', secondRate: '0.0000', dayRate: '¥0.00' }
  },

  onLoad(options = {}) {
    this.demoMode = options.preview === '1'
    this.demoStartedAt = Date.now()
    let contentTop = 96
    let scene = {}
    try {
      const menu = wx.getMenuButtonBoundingClientRect()
      if (menu && menu.bottom) contentTop = Math.ceil(menu.bottom + 12)
    } catch (_) {}
    try {
      const system = wx.getSystemInfoSync()
      scene = sceneLayout(system.windowWidth, system.windowHeight)
    } catch (_) {}
    let stored
    try { stored = wx.getStorageSync(STORAGE_KEY) } catch (_) {}
    const settings = safeSettings(stored)
    this.setData({ contentTop, ...scene, settings, draft: { ...settings }, draftScheduleIndex: SCHEDULES.indexOf(settings.schedule) })
    this.render()
  },

  onShow() {
    this.startTimers()
  },

  onHide() {
    this.stopTimers()
  },

  onUnload() {
    this.stopTimers()
  },

  startTimers() {
    this.stopTimers()
    this.renderTimer = setInterval(() => this.render(), this.demoMode ? 100 : 1000)
    this.frameTimer = setInterval(() => this.advanceMascot(), 160)
  },

  stopTimers() {
    if (this.renderTimer) clearInterval(this.renderTimer)
    if (this.frameTimer) clearInterval(this.frameTimer)
    if (this.noteTimer) clearTimeout(this.noteTimer)
  },

  render() {
    const now = new Date()
    let result = calculate(this.data.settings, now)
    if (this.demoMode) {
      const workdays = countMonthWorkdays(now, this.data.settings.schedule)
      const dayRate = this.data.settings.salary / Math.max(1, workdays)
      const totalSeconds = 8 * 60 * 60
      const secondRate = dayRate / totalSeconds
      const progress = ((Date.now() - this.demoStartedAt) % 10000) / 10000
      result = {
        state: 'working',
        remaining: (1 - progress) * totalSeconds * 1000,
        earned: dayRate * progress,
        progress,
        dayRate,
        secondRate,
        workdays
      }
    }
    this.latestResult = result
    const progressPercent = Math.round(result.progress * 100)
    const base = {
      dateText: `${now.getMonth() + 1}月${now.getDate()}日 星期${'日一二三四五六'[now.getDay()]}`,
      dailyQuote: quoteForDate(now),
      state: result.state,
      earned: money(result.earned),
      secondRate: result.secondRate.toFixed(4),
      progressPercent,
      visualProgress: Math.max(6, Math.min(94, result.progress * 100)),
      mascotMessage: this.mascotMessage(result),
      stats: {
        workdays: result.workdays,
        hourRate: money(result.secondRate * 3600),
        minuteRate: money(result.secondRate * 60),
        secondRate: result.secondRate.toFixed(4),
        dayRate: money(result.dayRate)
      }
    }

    if (result.state === 'off') {
      Object.assign(base, { statusText: '今天休息', countdownLabel: '不用打卡', countdown: '休息日', countdownCompact: true, earnedLabel: '今日收入', mascotFrame: MASCOT_FRAMES[0] })
    } else if (result.state === 'before') {
      Object.assign(base, { statusText: '等待上班', countdownLabel: '距离上班还有', countdown: duration(result.remaining), countdownCompact: false, earnedLabel: '今天已经赚到', mascotFrame: MASCOT_FRAMES[0] })
    } else if (result.state === 'after') {
      Object.assign(base, { statusText: '今日已收工', countdownLabel: '今天辛苦了', countdown: '已下班', countdownCompact: true, earnedLabel: '今日收入估算', mascotFrame: MASCOT_FRAMES[3] })
    } else {
      Object.assign(base, { statusText: this.demoMode ? '小牛跑动预览' : '工作进行中', countdownLabel: '距离下班还有', countdown: duration(result.remaining), countdownCompact: false, earnedLabel: '今天已经赚到' })
    }
    this.setData(base)
  },

  advanceMascot() {
    if (!this.latestResult || this.latestResult.state !== 'working') return
    this.frameIndex = ((this.frameIndex || 0) + 1) % MASCOT_FRAMES.length
    this.setData({ mascotFrame: MASCOT_FRAMES[this.frameIndex] })
  },

  mascotMessage(result) {
    if (result.state === 'off') return '今天歇一歇'
    const mode = this.mascotMode || 0
    if (mode === 1) return `已赚 ${money(result.earned)}`
    if (mode === 2) return result.state === 'after' ? '今天完成啦' : `还剩 ${duration(result.remaining)}`
    if (mode === 3) return `今日进度 ${Math.round(result.progress * 100)}%`
    if (result.state === 'before') return '等待打卡'
    if (result.state === 'after') return '成功抵达下班'
    if (result.progress >= 0.85) return '马上到下班站'
    if (result.progress >= 0.5) return '已过半程'
    return '向下班前进'
  },

  tapMascot() {
    this.mascotMode = ((this.mascotMode || 0) + 1) % 4
    if (this.noteTimer) clearTimeout(this.noteTimer)
    this.setData({ showMascotNote: true, mascotMessage: this.mascotMessage(this.latestResult) })
    this.noteTimer = setTimeout(() => this.setData({ showMascotNote: false }), 1450)
  },

  openSettings() {
    const draft = { ...this.data.settings }
    this.setData({ settingsVisible: true, draft, draftScheduleIndex: SCHEDULES.indexOf(draft.schedule) })
  },

  closeSettings() {
    this.setData({ settingsVisible: false })
  },

  stopPropagation() {},

  onSalaryInput(event) {
    this.setData({ 'draft.salary': event.detail.value })
    this.previewDraft()
  },

  onTimeChange(event) {
    const key = event.currentTarget.dataset.key
    this.setData({ [`draft.${key}`]: event.detail.value })
    this.previewDraft()
  },

  onScheduleChange(event) {
    const index = Number(event.detail.value)
    this.setData({ draftScheduleIndex: index, 'draft.schedule': SCHEDULES[index] })
    this.previewDraft()
  },

  previewDraft() {
    const draft = safeSettings(this.data.draft)
    const result = calculate(draft)
    this.setData({
      stats: {
        workdays: result.workdays,
        hourRate: money(result.secondRate * 3600),
        minuteRate: money(result.secondRate * 60),
        secondRate: result.secondRate.toFixed(4),
        dayRate: money(result.dayRate)
      }
    })
  },

  saveSettings() {
    const settings = safeSettings(this.data.draft)
    try { wx.setStorageSync(STORAGE_KEY, settings) } catch (_) {}
    this.setData({ settings, settingsVisible: false })
    this.render()
    wx.showToast({ title: '已保存', icon: 'success' })
  }
})
