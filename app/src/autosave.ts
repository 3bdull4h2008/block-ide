import { SAMPLES } from './lang-data'
import { toast } from './ui/toasts'
import { readSetting } from './utils/pure'
import type { SourceLang } from './palette'
import type { CadeEditor } from './editor'

export interface AutosaveDeps {
  activePath: () => string | null
  src: () => string
  setSrc: (s: string) => void
  activeLang: () => SourceLang
  setActiveLang: (l: SourceLang) => void
  editor: CadeEditor | null
  render: (s: string) => Promise<void>
  markDirty: () => void
  /** true when the buffer matches its save baseline — clean buffers are
   *  not recovery candidates (replaces the never-written snapshot key) */
  isClean: () => boolean
}

let autoSaveTimer = 0

export function scheduleAutoSave(deps: AutosaveDeps): void {
  const mode = String(readSetting('autosave', 'after-delay'))
  if (mode === 'off') return
  clearTimeout(autoSaveTimer)
  autoSaveTimer = window.setTimeout(() => {
    if (deps.isClean()) return
    const activePath = deps.activePath()
    const src = deps.src()
    const activeLang = deps.activeLang()
    if (activePath !== null) {
      localStorage.setItem(`blockide-autosave:${activePath}`, JSON.stringify({
        src, lang: activeLang, ts: Date.now()
      }))
    } else if (src.trim().length > 0 && src !== SAMPLES[activeLang]) {
      localStorage.setItem('blockide-autosave:scratch', JSON.stringify({
        src, lang: activeLang, ts: Date.now()
      }))
    }
  }, 2000)
}

export function recoverSession(deps: AutosaveDeps): void {
  const activePath = deps.activePath()
  if (activePath !== null) {
    const saved = localStorage.getItem(`blockide-autosave:${activePath}`)
    if (saved) {
      try {
        const { src: savedSrc, ts } = JSON.parse(saved)
        if (savedSrc && savedSrc !== deps.src()) {
          toast(`Recovered unsaved changes from ${new Date(ts).toLocaleTimeString()}`, 'info', 5000)
          // setSrc syncs srcEl + editor (guarded) and pushes history —
          // driving editor.setSource here too re-fired onUpdate unguarded
          deps.setSrc(savedSrc)
          void deps.render(savedSrc)
          deps.markDirty()
        }
      } catch { /* corrupt autosave — ignore */ }
    }
  }
  const scratchSaved = localStorage.getItem('blockide-autosave:scratch')
  if (scratchSaved && activePath === null) {
    try {
      const { src: savedSrc, lang: savedLang, ts } = JSON.parse(scratchSaved) as { src: string; lang: SourceLang; ts: number }
      if (savedSrc && savedSrc !== SAMPLES[savedLang]) {
        toast(`Recovered unsaved scratch buffer from ${new Date(ts).toLocaleTimeString()}`, 'info', 5000)
        deps.setActiveLang(savedLang)
        deps.editor?.setLang(savedLang)
        deps.setSrc(savedSrc)
        void deps.render(savedSrc)
        deps.markDirty()
      }
    } catch { /* corrupt autosave — ignore */ }
  }
}
