import { blip } from './utils/audio'
import { readSetting, writeSetting } from './utils/pure'
import type { SourceLang } from './palette'

type Lang = SourceLang
type AppMode = 'sandbox' | 'academy'

export interface RecentEntry {
  root: string
  rel: string
  ts: number
  mode?: AppMode
}

export interface SplashDeps {
  beginSession(lang: Lang, mode?: AppMode): Promise<void>
  beginFromRecent(entry: RecentEntry): Promise<void>
  setTheme(t: 'dark' | 'light'): void
  srcEl: HTMLTextAreaElement
  recentList(): RecentEntry[]
}

const splashEl = document.getElementById('splash') as HTMLDivElement

export function showSplashPanel(id: string): void {
  splashEl.querySelectorAll('.splash-panel').forEach((p) => {
    p.classList.remove('active')
    ;(p as HTMLElement).style.display = 'none'
  })
  const panel = document.getElementById(id)
  if (panel) {
    panel.style.display = 'flex'
    panel.classList.add('active')
  }
  splashEl.querySelectorAll('.sidebar-row[data-panel]').forEach((r) => {
    const row = r as HTMLElement
    row.classList.toggle('active', row.dataset.panel === id.replace('splash-', ''))
  })
}

export function renderRecentProjects(deps: SplashDeps): void {
  const list = document.getElementById('recent-list') as HTMLDivElement
  const recents = deps.recentList().slice(0, 6)
  list.innerHTML = ''
  if (recents.length === 0) {
    list.innerHTML = '<div class="splash-recent-empty">no recent projects</div>'
    return
  }
  for (const r of recents) {
    const el = document.createElement('div')
    el.className = 'recent-item'
    const info = document.createElement('div')
    info.className = 'recent-item-info'
    const name = document.createElement('b')
    name.textContent = r.rel.split('/').pop() ?? r.rel
    const path = document.createElement('span')
    path.textContent = r.root
    info.append(name, path)
    el.appendChild(info)
    if (r.mode) {
      const tag = document.createElement('span')
      tag.className = `recent-tag ${r.mode}`
      tag.textContent = r.mode
      el.appendChild(tag)
    }
    el.addEventListener('click', () => void deps.beginFromRecent(r))
    list.appendChild(el)
  }
}

export function initSplashSettings(deps: SplashDeps): void {
  const themeSel = document.getElementById('set-theme') as HTMLSelectElement
  const currentTheme = (localStorage.getItem('theme') as string) ?? 'light'
  themeSel.value = currentTheme === 'auto' ? 'auto' : currentTheme
  themeSel.addEventListener('change', () => {
    const v = themeSel.value as 'light' | 'dark' | 'auto'
    if (v === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      deps.setTheme(prefersDark ? 'dark' : 'light')
    } else {
      deps.setTheme(v)
    }
    writeSetting('theme', v)
  })

  const fontSizeSel = document.getElementById('set-font-size') as HTMLSelectElement
  fontSizeSel.value = readSetting('fontSize', '13')
  fontSizeSel.addEventListener('change', () => {
    writeSetting('fontSize', fontSizeSel.value)
    deps.srcEl.style.fontSize = `${fontSizeSel.value}px`
  })

  const fontFamilySel = document.getElementById('set-font-family') as HTMLSelectElement
  fontFamilySel.value = readSetting('fontFamily', 'Consolas')
  fontFamilySel.addEventListener('change', () => {
    writeSetting('fontFamily', fontFamilySel.value)
    deps.srcEl.style.fontFamily = `'${fontFamilySel.value}', monospace`
  })

  const tabSizeSel = document.getElementById('set-tab-size') as HTMLSelectElement
  tabSizeSel.value = readSetting('tabSize', '4')
  tabSizeSel.addEventListener('change', () => writeSetting('tabSize', tabSizeSel.value))

  const lineHeightSel = document.getElementById('set-line-height') as HTMLSelectElement
  lineHeightSel.value = readSetting('lineHeight', '1.5')
  lineHeightSel.addEventListener('change', () => {
    writeSetting('lineHeight', lineHeightSel.value)
    deps.srcEl.style.lineHeight = lineHeightSel.value
  })

  const setupToggle = (id: string, key: string, defaultVal = false): void => {
    const btn = document.getElementById(id) as HTMLButtonElement
    let on = readSetting(key, defaultVal)
    btn.classList.toggle('on', on)
    btn.textContent = on ? 'On' : 'Off'
    btn.addEventListener('click', () => {
      on = !on
      btn.classList.toggle('on', on)
      btn.textContent = on ? 'On' : 'Off'
      writeSetting(key, on)
    })
  }

  setupToggle('set-word-wrap', 'wordWrap', false)
  setupToggle('set-minimap', 'minimap', false)
  setupToggle('set-line-numbers', 'lineNumbers', true)
  setupToggle('set-bracket-match', 'bracketMatch', true)
  setupToggle('set-auto-brackets', 'autoBrackets', true)
  setupToggle('set-highlight-line', 'highlightLine', true)
  setupToggle('set-format-save', 'formatSave', true)
  setupToggle('set-confirm-exit', 'confirmExit', true)
  setupToggle('set-restore-session', 'restoreSession', true)
  setupToggle('set-sounds', 'sounds', true)
  setupToggle('set-animations', 'animations', true)
  setupToggle('set-clear-run', 'clearRun', true)
  setupToggle('set-mem-trace', 'memTrace', false)
  setupToggle('set-show-xp', 'showXp', true)
  setupToggle('set-spaced-rep', 'spacedRep', true)
  setupToggle('set-ctrl-view', 'ctrlView', true)
  setupToggle('set-slash-filter', 'slashFilter', true)
  setupToggle('set-tab-indent', 'tabIndent', true)

  const setupSelect = (id: string, key: string, fallback: string): void => {
    const sel = document.getElementById(id) as HTMLSelectElement
    sel.value = readSetting(key, fallback)
    sel.addEventListener('change', () => writeSetting(key, sel.value))
  }
  setupSelect('set-autosave', 'autosave', 'after-delay')
  setupSelect('set-run-shortcut', 'runShortcut', 'ctrl+enter')
  setupSelect('set-hint-limit', 'hintLimit', '3')
  setupSelect('set-ghost-opacity', 'ghostOpacity', '0.5')
  setupSelect('set-sidebar-style', 'sidebarStyle', 'source')

  const colorDots = splashEl.querySelectorAll('.color-dot')
  let currentAccent = readSetting('accent', 'teal')
  if (!['teal', 'purple', 'pink', 'green', 'orange', 'red'].includes(currentAccent)) {
    currentAccent = 'teal'
  }
  document.documentElement.setAttribute('data-accent', currentAccent)
  colorDots.forEach((dot) => {
    const d = dot as HTMLElement
    d.classList.toggle('active', d.dataset.accent === currentAccent)
    d.addEventListener('click', () => {
      currentAccent = d.dataset.accent ?? 'teal'
      colorDots.forEach((c) => c.classList.remove('active'))
      d.classList.add('active')
      writeSetting('accent', currentAccent)
      document.documentElement.setAttribute('data-accent', currentAccent)
    })
  })
}

export function initAcademyCarousel(): void {
  const panel = document.getElementById('splash-academy') as HTMLDivElement
  const slides = panel.querySelectorAll('.carousel-slide')
  const dots = panel.querySelectorAll('.c-dot')
  let cur = 0

  const show = (i: number): void => {
    slides.forEach((s) => s.classList.remove('active'))
    dots.forEach((d) => d.classList.remove('active'))
    slides[i]?.classList.add('active')
    dots[i]?.classList.add('active')
    cur = i
  }

  dots.forEach((d) => {
    d.addEventListener('click', () => show(parseInt(d.getAttribute('data-slide') ?? '0')))
  })

  let timer = setInterval(() => {
    if (cur < slides.length - 1) show(cur + 1)
    else clearInterval(timer)
  }, 4000)

  show(0)
}

export function initSplashSidebar(deps: SplashDeps): void {
  let selectedLang: Lang = 'c'

  splashEl.querySelectorAll<HTMLElement>('.sidebar-row[data-panel]').forEach((row) => {
    row.addEventListener('click', () => {
      const panel = 'splash-' + row.dataset.panel
      showSplashPanel(panel)
    })
  })

  const langCards = splashEl.querySelectorAll<HTMLElement>('.lang-card')
  langCards.forEach((card) => {
    card.addEventListener('click', () => {
      langCards.forEach((c) => c.classList.remove('selected'))
      card.classList.add('selected')
      selectedLang = (card.dataset.lang as Lang) ?? 'c'
    })
  })

  document.getElementById('hero-start')?.addEventListener('click', () => {
    blip(740, 0.07, 'sine', 0.06)
    void deps.beginSession(selectedLang, 'sandbox')
  })

  document.getElementById('hero-open')?.addEventListener('click', () => {
    void deps.beginSession('c').then(() => {
      window.setTimeout(() => document.getElementById('open-folder')?.click(), 150)
    })
  })

  document.getElementById('academy-start')?.addEventListener('click', () => {
    blip(740, 0.07, 'sine', 0.06)
    void deps.beginSession(selectedLang, 'academy')
  })
}

export function wireSplash(deps: SplashDeps): void {
  renderRecentProjects(deps)
  initSplashSettings(deps)
  initSplashSidebar(deps)
  initAcademyCarousel()
  showSplashPanel('splash-sandbox')
}
