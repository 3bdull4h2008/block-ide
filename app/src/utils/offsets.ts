/**
 * Byte-offset normalization — the single conversion point between the
 * parser and the editor.
 *
 * tree-sitter emits UTF-8 BYTE offsets (canonical.rs `start_byte()` /
 * `end_byte()`), but every JS consumer — `String.slice`, splice arithmetic
 * in ops.ts, `setSelectionRange`, caret anchors — works in UTF-16 code
 * units. For pure-ASCII sources the two coincide, which is exactly why the
 * mismatch went unnoticed: the first `// café` or `// 你好` in a file made
 * every downstream span land past the character it pointed at.
 *
 * Normalize once at the IPC boundary; everything downstream stays untouched.
 */

import type { CNodeJSON, CTreeJSON } from '../blocks'
import type { Diag } from '../types'

/** Parse-independent byte length of one UTF-16 code unit. Surrogate halves
 *  count as 2 each — their pair encodes to 4 bytes total. */
function unitBytes(u: number): number {
  if (u < 0x80) return 1
  if (u < 0x800) return 2
  if (u >= 0xd800 && u <= 0xdfff) return 2 // surrogate half (pair = 4)
  return 3
}

/** table[i] = UTF-8 bytes used by text.slice(0, i); table.length = len+1.
 *  Strictly increasing, so byte offsets binary-search back to indices. */
export function byteIndexTable(text: string): Uint32Array {
  const table = new Uint32Array(text.length + 1)
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    table[i] = bytes
    bytes += unitBytes(text.charCodeAt(i))
  }
  table[text.length] = bytes
  return table
}

export function byteToIndex(table: Uint32Array, byteOffset: number): number {
  // clamp to table range, then find the last index whose cumulative byte
  // count is <= the offset (spans in error recovery can point mid-character)
  if (byteOffset <= 0) return 0
  let lo = 0
  let hi = table.length - 1
  if (byteOffset >= table[hi]) return hi
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (table[mid] <= byteOffset) lo = mid
    else hi = mid
  }
  return lo
}

function walkNormalize(n: CNodeJSON, table: Uint32Array): void {
  n.start = byteToIndex(table, n.start)
  n.end = byteToIndex(table, n.end)
  for (const c of n.children) walkNormalize(c, table)
}

/** Rewrite a freshly parsed CTreeJSON in place: byte offsets → UTF-16
 *  indices for the root and every descendant. */
export function normalizeTreeOffsets(tree: CTreeJSON, source: string): void {
  walkNormalize(tree.root, byteIndexTable(source))
}

/** Same conversion for diagnostics (`diag_c` returns byte offsets too). */
export function normalizeDiagOffsets(diags: Diag[], source: string): void {
  const table = byteIndexTable(source)
  for (const d of diags) d.offset = byteToIndex(table, d.offset)
}
