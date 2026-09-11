import { indentLines, splitLine, toggleCommentLines } from './utils/edit-ops'
import type { SourceLang } from './palette'
import type { CadeEditor } from './editor'

export interface EditorKeysDeps {
  srcEl: HTMLTextAreaElement
  editor: () => CadeEditor | null
  activeLang: () => SourceLang
}

function editTextArea(deps: EditorKeysDeps, next: string, caret: number): void {
  deps.srcEl.value = next
  deps.editor()?.setSource(next)
  deps.srcEl.setSelectionRange(caret, caret)
  deps.srcEl.dispatchEvent(new Event('input'))
}

function toggleComment(deps: EditorKeysDeps): void {
  const sel = deps.srcEl.selectionStart ?? 0
  const end = deps.srcEl.selectionEnd ?? 0
  const text = deps.srcEl.value
  const prefix = deps.activeLang() === 'python' ? '# ' : '// '
  const res = toggleCommentLines(text, sel, end, prefix)
  editTextArea(deps, res.text, res.caret)
}

export function initEditorKeys(deps: EditorKeysDeps): void {
  deps.srcEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' && e.key !== 'Enter') return
    const start = deps.srcEl.selectionStart ?? 0
    const end = deps.srcEl.selectionEnd ?? 0
    const value = deps.srcEl.value
    if (e.key === 'Tab') {
      e.preventDefault()
      const res = indentLines(value, start, end, e.shiftKey)
      editTextArea(deps, res.text, res.caret)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const res = splitLine(value, start, end)
      editTextArea(deps, res.text, res.caret)
    }
  })

  deps.srcEl.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault()
      toggleComment(deps)
    }
  })
}
