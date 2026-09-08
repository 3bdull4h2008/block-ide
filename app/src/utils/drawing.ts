/**
 * Pure drawing utility functions extracted from main.ts.
 * These draw PixiJS Graphics paths for Scratch-style block shapes.
 */
import { Graphics } from 'pixi.js'
import { NX, TW, TD, BR, COLORS, type BBlock } from '../blocks'

export function mixWhite(c: number, f: number): number {
  const r = (c >> 16) & 255
  const g = (c >> 8) & 255
  const b = c & 255
  const m = (v: number) => Math.round(v + (255 - v) * f)
  return (m(r) << 16) | (m(g) << 8) | m(b)
}

export function statementPath(g: Graphics, ox: number, oy: number, w: number, h: number): void {
  g.moveTo(ox, oy + BR)
  g.quadraticCurveTo(ox, oy, ox + BR, oy)
  g.lineTo(ox + NX, oy)
  g.lineTo(ox + NX + 3, oy + TD)
  g.lineTo(ox + NX + TW - 3, oy + TD)
  g.lineTo(ox + NX + TW, oy)
  g.lineTo(ox + w - BR, oy)
  g.quadraticCurveTo(ox + w, oy, ox + w, oy + BR)
  g.lineTo(ox + w, oy + h - BR)
  g.quadraticCurveTo(ox + w, oy + h, ox + w - BR, oy + h)
  g.lineTo(ox + NX + TW, oy + h)
  g.lineTo(ox + NX + TW - 3, oy + h + TD)
  g.lineTo(ox + NX + 3, oy + h + TD)
  g.lineTo(ox + NX, oy + h)
  g.lineTo(ox + BR, oy + h)
  g.quadraticCurveTo(ox, oy + h, ox, oy + h - BR)
  g.closePath()
}

export function cHeaderPath(g: Graphics, ox: number, oy: number, w: number, h: number): void {
  g.moveTo(ox, oy + BR)
  g.quadraticCurveTo(ox, oy, ox + BR, oy)
  g.lineTo(ox + NX, oy)
  g.lineTo(ox + NX + 3, oy + TD)
  g.lineTo(ox + NX + TW - 3, oy + TD)
  g.lineTo(ox + NX + TW, oy)
  g.lineTo(ox + w - BR, oy)
  g.quadraticCurveTo(ox + w, oy, ox + w, oy + BR)
  g.lineTo(ox + w, oy + h)
  g.lineTo(ox, oy + h)
  g.closePath()
}

export function cBodyPath(g: Graphics, ox: number, oy: number, w: number, top: number, h: number, close: boolean): void {
  const y0 = oy + top
  const y1 = oy + h
  g.moveTo(ox + w, y0)
  g.lineTo(ox + w, y1 - BR)
  g.quadraticCurveTo(ox + w, y1, ox + w - BR, y1)
  g.lineTo(ox + NX + TW, y1)
  g.lineTo(ox + NX + TW - 3, y1 + TD)
  g.lineTo(ox + NX + 3, y1 + TD)
  g.lineTo(ox + NX, y1)
  g.lineTo(ox + BR, y1)
  g.quadraticCurveTo(ox, y1, ox, y1 - BR)
  g.lineTo(ox, y0)
  if (close) g.closePath()
}

export function catColor(cat: string | undefined, fallback = COLORS.statement): number {
  switch (cat) {
    case 'control':
    case 'loops':
      return COLORS.control
    case 'variables':
      return COLORS.variables
    case 'functions':
      return COLORS.function
    case 'structs':
      return 0xec4899
    case 'operators':
      return 0x59c059
    case 'comment':
      return COLORS.comment
    default:
      return fallback
  }
}

export function isInsideRange(inner: BBlock, outer: { start: number; end: number }): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}
