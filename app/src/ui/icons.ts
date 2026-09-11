/**
 * Inline SVG icons — currentColor, 16×16, 1.75 stroke.
 * Matches Cade sea-chrome: no emoji, inherits accent/fg from CSS.
 */

const svg = (paths: string, size = 16): string =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

export const icons = {
  folder: svg(
    '<path d="M1.5 4.2c0-.7.5-1.2 1.2-1.2h3.1l1.4 1.5h6.1c.7 0 1.2.5 1.2 1.2v6.1c0 .7-.5 1.2-1.2 1.2H2.7c-.7 0-1.2-.5-1.2-1.2V4.2z"/>',
  ),
  file: svg(
    '<path d="M4 1.5h5.2L12.5 5v9.5h-8.5z"/><path d="M9.2 1.5V5h3.3"/>',
  ),
  filePlus: svg(
    '<path d="M4 1.5h5.2L12.5 5v9.5h-8.5z"/><path d="M9.2 1.5V5h3.3"/><path d="M8 8.5v4M6 10.5h4"/>',
  ),
  save: svg(
    '<path d="M2.5 2.5h9l2 2v9h-11z"/><path d="M5 2.5v4h6v-4"/><path d="M5 13.5v-4h6v4"/>',
  ),
  play: svg('<path d="M5 3.2v9.6l8-4.8-8-4.8z" fill="currentColor" stroke="none"/>'),
  sun: svg(
    '<circle cx="8" cy="8" r="2.6"/><path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1"/>',
  ),
  moon: svg('<path d="M12.5 9.2A5.2 5.2 0 0 1 6.8 3.5 5.4 5.4 0 1 0 12.5 9.2z"/>'),
  plus: svg('<path d="M8 3v10M3 8h10"/>'),
  academy: svg(
    '<path d="M1.5 6.2 8 3l6.5 3.2L8 9.4 1.5 6.2z"/><path d="M4 7.4v3.2c0 1.2 1.8 2.2 4 2.2s4-1 4-2.2V7.4"/>',
  ),
  recent: svg(
    '<circle cx="8" cy="8" r="5.8"/><path d="M8 4.8V8l2.2 1.6"/>',
  ),
  settings: svg(
    '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.3M8 12.9v1.3M1.8 8h1.3M12.9 8h1.3M3.6 3.6l.9.9M11.5 11.5l.9.9M12.4 3.6l-.9.9M4.5 11.5l-.9.9"/>',
  ),
  newDoc: svg(
    '<path d="M4 1.5h5.2L12.5 5v9.5h-8.5z"/><path d="M9.2 1.5V5h3.3"/><path d="M8 8v4M6 10h4"/>',
  ),
  stop: svg('<rect x="4" y="4" width="8" height="8" rx="1.2" fill="currentColor" stroke="none"/>'),
  pause: svg('<rect x="4" y="3.5" width="2.5" height="9" rx="0.6" fill="currentColor" stroke="none"/><rect x="9.5" y="3.5" width="2.5" height="9" rx="0.6" fill="currentColor" stroke="none"/>'),
  step: svg('<path d="M4 3.2v9.6l6-4.8-6-4.8z" fill="currentColor" stroke="none"/><path d="M12 3.5v9" stroke-width="1.75"/>'),
  rewind: svg('<path d="M11.5 3.2v9.6L5.5 8l6-4.8z" fill="currentColor" stroke="none"/><path d="M4 3.5v9" stroke-width="1.75"/>'),
}

/** Prefix a button label with its icon (keeps the text label for a11y). */
export function iconLabel(icon: string, label: string): string {
  return `${icon}<span>${label}</span>`
}
