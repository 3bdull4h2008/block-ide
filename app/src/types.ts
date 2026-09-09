import type { BBlock, BlockPart } from './blocks'

export type ViewMode = 'split' | 'blocks' | 'text'

export interface Diag {
  line: number
  col: number
  severity: string
  message: string
  offset: number
  node_id: number
  node_kind: string
}

/** Editable slot hit-boxes in world coords, rebuilt on every render. */
export interface SlotHit {
  block: BBlock
  part: BlockPart
  x: number
  y: number
  w: number
  h: number
}
