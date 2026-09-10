import { trimmedEndsWithOpener } from './utils/pure'
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
  const prefixLen = prefix.length

  if (sel === end) {
    const lineStart = text.lastIndexOf('\n', sel - 1) + 1
    const lineEnd = text.indexOf('\n', sel)
    const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)

    if (line.trimStart().startsWith(prefix)) {
      const indent = line.length - line.trimStart().length
      const removeStart = lineStart + indent
      const removeEnd = removeStart + prefixLen
      const newText = text.slice(0, removeStart) + text.slice(removeEnd)
      const newCaret = Math.max(lineStart, sel - prefixLen)
      editTextArea(deps, newText, newCaret)
    } else {
      const indent = line.length - line.trimStart().length
      const insertPos = lineStart + indent
      const newText = text.slice(0, insertPos) + prefix + text.slice(insertPos)
      editTextArea(deps, newText, sel + prefixLen)
    }
  } else {
    const lineStart = text.lastIndexOf('\n', sel - 1) + 1
    const lineEnd = text.indexOf('\n', end)
    const block = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
    const lines = block.split('\n')

    const allCommented = lines.every(l => l.trimStart().startsWith(prefix) || l.trim() === '')

    const newLines = allCommented
      ? lines.map(l => {
          if (l.trim() === '') return l
          const indent = l.length - l.trimStart().length
          const removeStart = indent
          return l.slice(0, removeStart) + l.slice(removeStart + prefixLen)
        })
      : lines.map(l => {
          if (l.trim() === '') return l
          const indent = l.length - l.trimStart().length
          return l.slice(0, indent) + prefix + l.slice(indent)
        })

    const newText = text.slice(0, lineStart) + newLines.join('\n') + text.slice(lineEnd === -1 ? text.length : lineEnd)
    const delta = allCommented ? -prefixLen * lines.filter(l => l.trim() !== '').length : prefixLen * lines.filter(l => l.trim() !== '').length
    editTextArea(deps, newText, Math.min(sel + delta, newText.length))
  }
}

export function initEditorKeys(deps: EditorKeysDeps): void {
  deps.srcEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' && e.key !== 'Enter') return
    const start = deps.srcEl.selectionStart ?? 0
    const end = deps.srcEl.selectionEnd ?? 0
    const value = deps.srcEl.value
    if (e.key === 'Tab') {
      e.preventDefault()
      if (start === end) {
        if (e.shiftKey) {
          const lineStart = value.lastIndexOf('\n', start - 1) + 1
          const cut = Math.min(2, /^ {1,2}/.exec(value.slice(lineStart))?.[0].length ?? 0)
          if (cut > 0) editTextArea(deps, value.slice(0, lineStart) + value.slice(lineStart + cut), Math.max(lineStart, start - cut))
        } else {
          editTextArea(deps, value.slice(0, start) + '  ' + value.slice(end), start + 2)
        }
        return
      }
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const nlAt = value.indexOf('\n', end)
      const lineEnd = nlAt === -1 ? value.length : nlAt
      const block = value.slice(lineStart, lineEnd)
      const shiftedBlock = e.shiftKey
        ? block.replace(/^ {1,2}/gm, '')
        : block.replace(/^/gm, '  ')
      const firstDelta =
        shiftedBlock.split('\n')[0].length - block.split('\n')[0].length
      editTextArea(
        deps,
        value.slice(0, lineStart) + shiftedBlock + value.slice(lineEnd),
        Math.max(lineStart, start + firstDelta),
      )
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const pos = start
      const lineStart = value.lastIndexOf('\n', pos - 1) + 1
      const prevLine = value.slice(lineStart, pos).trimEnd()
      let indent = /^[ \t]*/.exec(prevLine)?.[0] ?? ''
      const opens = trimmedEndsWithOpener(prevLine)
      if (opens) indent += '    '
      if (opens && value[pos] === '}') {
        editTextArea(
          deps,
          value.slice(0, pos) + '\n' + indent + '\n' + indent.slice(0, -4) + value.slice(pos),
          pos + 1 + indent.length,
        )
        return
      }
      editTextArea(deps, value.slice(0, pos) + '\n' + indent + value.slice(end), pos + 1 + indent.length)
    }
  })

  deps.srcEl.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault()
      toggleComment(deps)
    }
  })
}
