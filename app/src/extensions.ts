/**
 * extensions.ts — Lightweight extension system for Cade.
 *
 * Provides a hook registry for lifecycle events and a plugin manifest format.
 * Extensions register callbacks; the host calls them at the right times.
 *
 * Usage:
 *   import { registerExtension, callHook } from './extensions'
 *   registerExtension({ name: 'my-plugin', version: '1.0.0', hooks: { onBlockRender(b) { ... } } })
 *   callHook('onBlockRender', block)
 */

export interface ExtensionManifest {
  name: string
  version: string
  description?: string
  hooks?: Partial<HookMap>
}

export interface HookMap {
  onParse: (src: string, lang: string) => string | void
  onBlockRender: (block: any) => void
  onRunStart: (src: string, lang: string) => void
  onRunStop: () => void
  onPaletteRender: (items: any[]) => any[] | void
  onThemeChange: (theme: 'light' | 'dark') => void
  onSave: (src: string, path: string) => void
  onNewFile: (lang: string) => void
}

const extensions: ExtensionManifest[] = []

export function registerExtension(ext: ExtensionManifest): void {
  if (extensions.some(e => e.name === ext.name)) {
    console.warn(`[extensions] "${ext.name}" already registered, skipping`)
    return
  }
  extensions.push(ext)
  console.log(`[extensions] registered: ${ext.name}@${ext.version}`)
}

export function unregisterExtension(name: string): void {
  const idx = extensions.findIndex(e => e.name === name)
  if (idx >= 0) {
    extensions.splice(idx, 1)
    console.log(`[extensions] unregistered: ${name}`)
  }
}

export function listExtensions(): ReadonlyArray<ExtensionManifest> {
  return extensions
}

export function callHook<K extends keyof HookMap>(
  hook: K,
  ...args: Parameters<HookMap[K]>
): ReturnType<HookMap[K]> | undefined {
  let result: any
  for (const ext of extensions) {
    const fn = ext.hooks?.[hook]
    if (fn) {
      try {
        result = (fn as any)(...args)
      } catch (err) {
        console.error(`[extensions] error in ${ext.name}.${hook}:`, err)
      }
    }
  }
  return result
}

export function callHookReduce<K extends keyof HookMap>(
  hook: K,
  initial: any,
  ...args: any[]
): any {
  let value = initial
  for (const ext of extensions) {
    const fn = ext.hooks?.[hook]
    if (fn) {
      try {
        const result = (fn as any)(value, ...args)
        if (result !== undefined) value = result
      } catch (err) {
        console.error(`[extensions] error in ${ext.name}.${hook}:`, err)
      }
    }
  }
  return value
}

export function initExtensions(): void {
  const w = window as any
  if (w.__extensions) return
  w.__extensions = {
    register: registerExtension,
    unregister: unregisterExtension,
    list: listExtensions,
    callHook,
    callHookReduce
  }
}
