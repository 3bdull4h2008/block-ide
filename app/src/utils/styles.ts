export const WHITE_LABEL = {
  fontFamily: "'Baloo 2', 'Segoe UI', sans-serif",
  fontSize: 13,
  fontWeight: '600' as const,
  fill: 0xffffff,
}
export const DARK_LABEL: typeof WHITE_LABEL = { ...WHITE_LABEL, fill: 0x0c3543 }
