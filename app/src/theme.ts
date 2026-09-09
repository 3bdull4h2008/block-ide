import type { Application, Container } from 'pixi.js'
import type { CadeEditor } from './editor'

export interface ThemeDeps {
  app: Application
  editor: CadeEditor | null
  world: Container
}

export function setTheme(deps: ThemeDeps, t: 'dark' | 'light'): void {
  const { app, editor, world } = deps
  document.documentElement.dataset.theme = t
  const btn = document.getElementById('theme-toggle') as HTMLButtonElement
  btn.textContent = t === 'dark' ? '☾' : '☀'
  localStorage.setItem('theme', t)
  app.renderer.background.color = t === 'dark' ? 0x0c3543 : 0xdff3fa
  editor?.setTheme(t === 'dark')
  world.emit('blockide:theme', t)
}

export function initTheme(deps: ThemeDeps): void {
  setTheme(deps, (localStorage.getItem('theme') as 'dark' | 'light') ?? 'light')
  const btn = document.getElementById('theme-toggle') as HTMLButtonElement
  btn.addEventListener('click', () =>
    setTheme(deps, document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
  )
}
