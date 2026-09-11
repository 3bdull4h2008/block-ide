/**
 * Pure text-editing transforms behind the editor's Tab / Enter / Ctrl+/
 * handling. DOM-free and Node-testable; editor-keys.ts applies the results
 * to whatever editor surface is active.
 */

import { trimmedEndsWithOpener } from './pure'

/** Insert/remove two spaces at the caret or across the selected lines.
 *  Shift removes up to two leading spaces per line. */
export function indentLines(
  text: string,
  start: number,
  end: number,
  shift: boolean,
): { text: string; caret: number } {
  if (start === end) {
    if (shift) {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1
      const cut = Math.min(2, /^ {1,2}/.exec(text.slice(lineStart))?.[0].length ?? 0)
      if (cut === 0) return { text, caret: start }
      return {
        text: text.slice(0, lineStart) + text.slice(lineStart + cut),
        caret: Math.max(lineStart, start - cut),
      }
    }
    return { text: text.slice(0, start) + '  ' + text.slice(end), caret: start + 2 }
  }
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const nlAt = text.indexOf('\n', end)
  const lineEnd = nlAt === -1 ? text.length : nlAt
  const block = text.slice(lineStart, lineEnd)
  const shiftedBlock = shift ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ')
  const firstDelta = shiftedBlock.split('\n')[0].length - block.split('\n')[0].length
  return {
    text: text.slice(0, lineStart) + shiftedBlock + text.slice(lineEnd),
    caret: Math.max(lineStart, start + firstDelta),
  }
}

/** Enter inside the code: continue the current indent, deepen after an
 *  opener (`{` / `:`), and pair a `}` onto its own line after an opener. */
export function splitLine(
  text: string,
  pos: number,
  end: number,
): { text: string; caret: number } {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1
  const prevLine = text.slice(lineStart, pos).trimEnd()
  let indent = /^[ \t]*/.exec(prevLine)?.[0] ?? ''
  const opens = trimmedEndsWithOpener(prevLine)
  if (opens) indent += '    '
  if (opens && text[pos] === '}') {
    return {
      text: text.slice(0, pos) + '\n' + indent + '\n' + indent.slice(0, -4) + text.slice(pos),
      caret: pos + 1 + indent.length,
    }
  }
  return { text: text.slice(0, pos) + '\n' + indent + text.slice(end), caret: pos + 1 + indent.length }
}

/** Toggle `prefix` comments on the caret's line or the selected block.
 *  A block is uncommented only when every non-blank line is commented. */
export function toggleCommentLines(
  text: string,
  sel: number,
  end: number,
  prefix: string,
): { text: string; caret: number } {
  const prefixLen = prefix.length

  if (sel === end) {
    const lineStart = text.lastIndexOf('\n', sel - 1) + 1
    const lineEnd = text.indexOf('\n', sel)
    const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
    const indent = line.length - line.trimStart().length

    if (line.trimStart().startsWith(prefix)) {
      const removeStart = lineStart + indent
      const newText = text.slice(0, removeStart) + text.slice(removeStart + prefixLen)
      return { text: newText, caret: Math.max(lineStart, sel - prefixLen) }
    }
    const insertPos = lineStart + indent
    return { text: text.slice(0, insertPos) + prefix + text.slice(insertPos), caret: sel + prefixLen }
  }

  const lineStart = text.lastIndexOf('\n', sel - 1) + 1
  const lineEnd = text.indexOf('\n', end)
  const block = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
  const lines = block.split('\n')
  const nonBlank = lines.filter((l) => l.trim() !== '')
  const allCommented = nonBlank.every((l) => l.trimStart().startsWith(prefix))

  const newLines = allCommented
    ? lines.map((l) => {
        if (l.trim() === '') return l
        const indent = l.length - l.trimStart().length
        return l.slice(0, indent) + l.slice(indent + prefixLen)
      })
    : lines.map((l) => {
        if (l.trim() === '') return l
        const indent = l.length - l.trimStart().length
        return l.slice(0, indent) + prefix + l.slice(indent)
      })

  const newText = text.slice(0, lineStart) + newLines.join('\n') + text.slice(lineEnd === -1 ? text.length : lineEnd)
  const delta = (allCommented ? -prefixLen : prefixLen) * nonBlank.length
  return { text: newText, caret: Math.min(sel + delta, newText.length) }
}
