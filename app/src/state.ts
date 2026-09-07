import { type SourceLang } from './palette'

export type Lang = SourceLang

export interface AppState {
  src: string
  lang: Lang
  activePath: string | null
  workspace: string | null
  dirty: boolean
  running: boolean
  theme: 'light' | 'dark'
  sidebarTab: 'palette' | 'files'
  consoleVisible: boolean
  panX: number
  panY: number
  zoom: number
}

type StateKey = keyof AppState

type StateListener<K extends StateKey> = (value: AppState[K], prev: AppState[K]) => void

type ListenerEntry = { key: StateKey; fn: (value: unknown, prev: unknown) => void }

const listeners: ListenerEntry[] = []

export const state: AppState = {
  src: '',
  lang: 'c',
  activePath: null,
  workspace: null,
  dirty: false,
  running: false,
  theme: 'dark',
  sidebarTab: 'palette',
  consoleVisible: true,
  panX: 0,
  panY: 0,
  zoom: 1,
}

export function setState<K extends StateKey>(key: K, value: AppState[K]): void {
  const prev = state[key]
  if (prev === value) return
  ;(state as Record<K, AppState[K]>)[key] = value
  for (const l of listeners) {
    if (l.key === key) l.fn(value, prev)
  }
}

export function onStateChange<K extends StateKey>(key: K, listener: StateListener<K>): () => void {
  const entry: ListenerEntry = { key, fn: listener as (value: unknown, prev: unknown) => void }
  listeners.push(entry)
  return () => {
    const i = listeners.indexOf(entry)
    if (i >= 0) listeners.splice(i, 1)
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null')
    return (v ?? fallback) as T
  } catch {
    return fallback
  }
}

export function initState(): void {
  state.theme = readJson<'light' | 'dark'>('theme', 'dark')
  state.lang = readJson<Lang>('blockide-lang', 'c')
  state.workspace = readJson<string | null>('blockide-workspace', null)
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

export function persistState(): void {
  if (persistTimer !== null) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      localStorage.setItem('theme', JSON.stringify(state.theme))
      localStorage.setItem('blockide-lang', JSON.stringify(state.lang))
      localStorage.setItem('blockide-workspace', JSON.stringify(state.workspace))
    } catch {
      // quota or SSR — silently ignore
    }
  }, 300)
}
