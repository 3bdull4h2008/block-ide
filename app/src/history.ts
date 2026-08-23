export class History {
  private past: string[] = []
  private future: string[] = []
  private lastKind = ''
  private lastAt = 0
  private readonly cap = 200

  push(prev: string, kind: 'op' | 'type'): void {
    const now = Date.now()
    const coalesce = kind === 'type' && this.lastKind === 'type' && now - this.lastAt < 900
    this.lastKind = kind
    this.lastAt = now
    if (coalesce) return
    this.past.push(prev)
    if (this.past.length > this.cap) this.past.shift()
    this.future = []
  }

  undo(current: string): string | null {
    const prev = this.past.pop()
    if (prev === undefined) return null
    this.future.push(current)
    return prev
  }

  redo(current: string): string | null {
    const next = this.future.pop()
    if (next === undefined) return null
    this.past.push(current)
    return next
  }

  reset(): void {
    this.past = []
    this.future = []
    this.lastKind = ''
  }
}
