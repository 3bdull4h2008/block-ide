import type { BBlock } from './blocks'

/** Pure source-splice operations shared by the UI and the E2E tests.
 *  Every block gesture reduces to one of these edits on the .c text. */

export function cutRange(
  text: string,
  range: { start: number; end: number },
): { text: string; snippet: string } {
  return {
    text: text.slice(0, range.start) + text.slice(range.end),
    snippet: text.slice(range.start, range.end),
  }
}

export function adjustOffset(offset: number, cut: { start: number; end: number }): number {
  if (offset > cut.end) return offset - (cut.end - cut.start)
  return offset
}

export function overlaps(offset: number, cut: { start: number; end: number }): boolean {
  return offset >= cut.start && offset <= cut.end
}

export function spliceInsert(text: string, offset: number, snippet: string): string {
  let insert = snippet
  const pre = text.slice(0, offset)
  if (pre.length > 0 && !pre.endsWith('\n')) insert = '\n' + insert
  const post = text.slice(offset)
  if (!post.startsWith('\n') && !insert.endsWith('\n')) insert += '\n'
  return text.slice(0, offset) + insert + post
}

export function spliceMove(
  text: string,
  move: { start: number; end: number },
  rawOffset: number,
): string | null {
  if (overlaps(rawOffset, move)) return null
  const { snippet } = cutRange(text, move)
  let t = cutRange(text, move).text
  const offset = adjustOffset(rawOffset, move)
  return spliceInsert(t, offset, snippet)
}

export function applyEdit(b: BBlock, replacement: string): (text: string) => string {
  return (text) => text.slice(0, b.start) + replacement + text.slice(b.headerEnd)
}

/** Splice at FILE SCOPE — for function definitions, which are not nestable
 *  in C. Appends after the last top-level block (or EOF when empty). */
export function insertTopLevel(
  src: string,
  rootEnds: { end: number }[],
  snippet: string,
): string {
  if (rootEnds.length === 0) return spliceInsert(src, src.length, snippet)
  const last = rootEnds[rootEnds.length - 1]
  return spliceInsert(src, Math.min(last.end, src.length), snippet)
}
