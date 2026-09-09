# Cade (Block-IDE) — Module Map

> Current architecture after Phase 4 decomposition.
> main.ts: 3690 → 1337 lines (-64%)
> 21 modules extracted, 43 E2E tests passing.

---

## Module Dependency Graph

```
main.ts (1337 lines) — orchestrator, wires all modules
  ├── blocks.ts          — BBlock types, layout, hit-testing, colors
  ├── ops.ts             — splice/move/source operations
  ├── history.ts         — undo/redo stack
  ├── caret.ts           — semantic caret anchoring
  ├── types.ts           — shared ViewMode, Diag, SlotHit types
  ├── palette.ts         — palette items, groups, validation, chips
  ├── palette-cmd.ts     — command palette registration
  ├── palette-render.ts  — palette rendering (grouped, variable chips)
  ├── kbd-palette.ts     — keyboard navigation of palette
  ├── drag-drop.ts       — HTML drag system with snap/drop
  ├── block-draw.ts      — PixiJS block rendering
  ├── inline-slot-editor.ts — inline slot editing (double-click)
  ├── diagnostics.ts     — diagnostic overlay + panel rendering
  ├── autosave.ts        — auto-save to localStorage
  ├── stage-run.ts       — run/stop, FPS, stage rendering
  ├── mem-view.ts        — memory trace visualization
  ├── editor.ts          — CodeMirror editor wrapper
  ├── editor-keys.ts     — editor keyboard shortcuts
  ├── keybindings.ts     — global keyboard shortcuts
  ├── pan-zoom.ts        — canvas pan/zoom
  ├── file-drop.ts       — drag-drop file open
  ├── exit-alert.ts      — unsaved changes dialog
  ├── debug-hooks.ts     — window.__ debug APIs
  ├── context-menu.ts    — context menu provider
  ├── resize.ts          — panel resizing
  ├── tour.ts            — onboarding tour
  ├── splash.ts          — splash screen
  ├── window-state.ts    — window position persistence
  ├── lang-data.ts       — sample code per language
  ├── academy.ts         — academy mode, XP, levels, hints
  ├── academy-extras.ts  — mastery/streak logic (pure functions)
  ├── tracer.ts          — C interpreter engine
  ├── trace-panel.ts     — trace panel UI (not wired)
  ├── theme.ts           — theme toggle (not wired)
  └── style.css          — all CSS
```

## Extracted Modules (wired into main.ts)

### Batch 1 — Foundation (8 modules)
| Module | Lines | Purpose |
|--------|-------|---------|
| `splash.ts` | ~200 | Splash screen, recent projects, settings UI |
| `tour.ts` | ~100 | Onboarding tour with event-driven advancement |
| `window-state.ts` | ~50 | Save/restore window position + debounce |
| `lang-data.ts` | ~80 | Sample code and templates per language |
| `mem-view.ts` | ~100 | Memory trace visualization (heap boxes + SVG) |
| `editor-keys.ts` | ~60 | Editor keyboard shortcuts (Tab/Enter/arrows) |
| `utils/pure.ts` | ~95 | Pure helpers: path utils, JSON store, text entry |
| `utils/drawing.ts` | ~88 | Drawing helpers: statementPath, catColor, etc. |

### Batch 2 — UI Components (7 modules)
| Module | Lines | Purpose |
|--------|-------|---------|
| `exit-alert.ts` | ~30 | Unsaved changes confirmation dialog |
| `debug-hooks.ts` | ~50 | `window.__*` debug APIs |
| `pan-zoom.ts` | ~80 | Canvas pan/zoom with pointer/wheel |
| `keybindings.ts` | ~50 | Global keyboard shortcuts (F5, Ctrl+B, etc.) |
| `file-drop.ts` | ~40 | Drag-drop files onto app to open |
| `types.ts` | ~10 | Shared ViewMode, Diag, SlotHit types |
| `caret.ts` | ~86 | Semantic caret anchoring (survives re-parse) |

### Batch 3 — Block System (2 modules)
| Module | Lines | Purpose |
|--------|-------|---------|
| `block-draw.ts` | ~200 | PixiJS block rendering (drawBlock) |
| `inline-slot-editor.ts` | ~100 | Double-click slot editing |

### Batch 4 — Palette & Academy (3 modules)
| Module | Lines | Purpose |
|--------|-------|---------|
| `academy.ts` | ~173 | Academy mode, XP, levels, hints, profile |
| `kbd-palette.ts` | ~120 | Keyboard palette navigation + filter |
| `palette-render.ts` | ~270 | Full palette rendering with variable chips |

### Batch 5 — Runtime (3 modules)
| Module | Lines | Purpose |
|--------|-------|---------|
| `drag-drop.ts` | ~300 | HTML drag system with snap/preview |
| `stage-run.ts` | ~175 | Run/stop, stage rendering, FPS, stdin |
| `diagnostics.ts` | ~91 | Diagnostic overlay + panel rendering |
| `autosave.ts` | ~72 | Auto-save to localStorage |

## Modules NOT wired (kept inline)
| Module | Lines | Reason |
|--------|-------|--------|
| `trace-panel.ts` | ~80 | Heavy local state coupling |
| `theme.ts` | ~24 | Low ROI (24 lines) |

## Key Design Patterns

### Dependency Injection (DI)
Most modules use a `*Deps` interface pattern:
```typescript
export interface StageRunDeps {
  consoleEl: HTMLPreElement
  src: () => string
  // ... other deps as getters or values
}
export function initStageRun(deps: StageRunDeps) { ... }
```

### Getter Functions
State that changes at runtime is passed as getter functions:
```typescript
src: () => src        // current source code
activeLang: () => activeLang  // current language
running: () => getRunning()    // run state
```

### Closure Wrappers
Some modules return values that are wrapped in main.ts:
```typescript
const { startRun, stopRun } = initStageRun(deps)
// startRun/stopRun close over internal state
```

## Architecture Stats

| Metric | Value |
|--------|-------|
| main.ts lines | 1337 |
| Total modules | 36 files |
| Wired modules | 32 |
| E2E tests | 43 passing |
| TypeScript | Clean (no errors) |
| Build | Clean |
