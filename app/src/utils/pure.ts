/**
 * Pure utility functions extracted from main.ts.
 * No side effects, no global dependencies.
 */

export function langOf(path: string | null): string {
  const ext = (path ?? '').toLowerCase().split('.').pop() ?? ''
  if (['cpp', 'cc', 'cxx', 'hpp', 'hh'].includes(ext)) return 'cpp'
  if (ext === 'py' || ext === 'pyw') return 'python'
  if (['js', 'mjs', 'cjs'].includes(ext)) return 'javascript'
  if (ext === 'rs') return 'rust'
  if (ext === 'go') return 'go'
  if (ext === 'java') return 'java'
  if (ext === 'ts' || ext === 'tsx' || ext === 'mts' || ext === 'cts') return 'typescript'
  return 'c'
}

export const isWinPath = (p: string): boolean => /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('/')
export const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p
export const dirName = (p: string): string => {
  const parts = p.split(/[\\/]/)
  parts.pop()
  return parts.length > 0 ? parts.join('\\') : '.'
}
export const normSlashes = (p: string): string => p.replace(/\\/g, '/')

export function trimmedEndsWithOpener(line: string): boolean {
  const t = line.trimEnd()
  return t.endsWith('{') || t.endsWith(':')
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function keyToCode(e: KeyboardEvent): number | null {
  switch (e.key) {
    case 'ArrowLeft': return 1
    case 'ArrowUp': return 2
    case 'ArrowRight': return 3
    case 'ArrowDown': return 4
  }
  if (e.key.length === 1) {
    const c = e.key.toUpperCase().charCodeAt(0)
    if (c >= 32 && c <= 126) return c
  }
  return null
}

export const isTextEntryTarget = (e: Event): boolean => {
  const t = e.target as HTMLElement | null
  if (!t) return false
  if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return true
  return !!t.closest('#console-input-row, #pal-filter')
}

export function readJsonStore<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null')
    return (v ?? fallback) as T
  } catch {
    return fallback
  }
}

export function writeJsonStore<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function readSetting<T>(key: string, fallback: T): T {
  return readJsonStore<T>(`blockide-set-${key}`, fallback)
}

export function writeSetting(key: string, val: unknown): void {
  localStorage.setItem(`blockide-set-${key}`, JSON.stringify(val))
}
