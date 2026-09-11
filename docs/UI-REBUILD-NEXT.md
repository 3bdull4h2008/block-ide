# UI Rebuild — Status & Next Agent Handoff

> Session: 2026-09-10/11 · Theme score path **5.5 → 7.2/10**
> Design language: `DESIGN.md` (Sea palette, Comic Neue + Baloo 2, Scratch blocks)
> **Logic track (2026-09-11): `docs/LOGIC-MAP.md`** — architecture map, 24 logic
> bugs fixed, 35 external Node tests (`npm run test:logic`). Read it before
> touching parse/render/gesture/academy logic.

## What shipped (do not re-do)

### Design system
- Rebuilt CSS stack: `tokens.css` → `components.css` → `layout.css` → `style.css`
- `DESIGN.md` is the brand-side source of truth (palette, type, DOM contracts)
- Selection language: accent rail + soft fill on files / nav / view modes / tabs
- Run is the sole primary toolbar action; file actions are ghost buttons
- SVG icon system in `app/src/ui/icons.ts` (`currentColor`, 16px stroke)
- Language splash cards use letter tiles (C, C+, Py, JS…) — not emoji

### Performance
- Debug log: no `console.log` recursion; overlay only updates when open; 200-line cap
- IPC log ring-capped at 400
- Renders coalesced on `requestAnimationFrame`; identical buffers skip paint (`scheduleRender` / `lastPaintedSrc`)
- Palette `drop-shadow` filter → `box-shadow`

### Correctness (UI)
- **Meaningful dirty**: `isMeaningfullyDirty()` — whitespace-only drift does not nag
- Tab switch guards CodeMirror `setSource` with `srcSetting`
- New File → untitled buffer; Save → Save As on first write
- Open Folder: `try/catch` + toast + `recursive: true`; dialog perms explicit in capabilities
- Toasts: exit class is `removing` (was `toast-exit` — stuck forever)
- Native window chrome only (custom min/max/close removed)

### Blocks / palette
- `findCompound` no longer deep-searches (namespace no longer mashes functions)
- Class/struct `field_declaration_list` nests methods correctly
- Diagnostic overlay: soft wash + left rail (not red boxes); skips sticky comments when possible
- Category filter pills (All / Control / Loops / …) with `--pill-c` when active
- Expanded Functions / Structs / Notes chips (struct, enum, union, main, void fn, block comments…)
- Canvas `COLORS_DARK` / `BORDER_DARK` + `palColors()` for dark theme

### Theme polish
- Editor dark/light fully sea-retinted; **`oneDark` removed** (no slate leak)
- Dark borders `#245064`; muted text AA (`#8fb4c4` dark / `#5a7d8d` light)
- Stage canvas `#061820`; dark semantic softs blue-green
- Empty badges hide; Problems strip hides when 0 issues; Console header bar
- Canvas 24px grid + empty-state card (`#canvas-empty`)

## Hard constraints for the next agent

1. **Never rename** element IDs queried by TS (`getElementById` list — see `DESIGN.md` §6).
2. **Token names** in `tokens.css` are contracts (`--c-*`, `--sp-*`, `--pal-*`).
3. Prefer CSS/TS polish over architecture rewrites.
4. Run `cd app && npm run typecheck && npm run test && npm run build` before claiming done.
5. `main.ts` is large — **do not truncate it**; use surgical edits.

## Next priorities (ordered)

All six items from the 2026-09-10 handoff are DONE (same day, second pass):

| # | Task | Status |
|---|------|--------|
| 1 | Repaint canvas on theme toggle | **DONE** — `setTheme` resets `lastPaintedSrc` + `scheduleRender(src)` |
| 2 | Collapse Open+File | **DONE** — single "Open…" dropdown (`.menu`/`.menu-pop`); `open-folder`/`open-file` IDs preserved |
| 3 | Branded splash shell | **DONE** — logo + wordmark + tagline header, sea gradient |
| 4 | Inline SVG in HTML | **DONE** — all chrome icons inlined in `index.html`; `applyChromeIcons()` deleted from `icons.ts`; trace play/pause swaps use `icons.play`/`icons.pause` (were emoji) |
| 5 | Incremental block invalidation | **DONE** — per-root draw cache in `main.ts` `render()` keyed by theme+lang+cat+range+text+x+y; unchanged statements reuse their Pixi subtree, replaced ones are `destroy({children:true})`d (fixes Text-texture leak) |
| 6 | Dark canvas block edges | **DONE** — `BORDER_DARK` retuned (edge-vs-fill 1.7–2.1 → 2.8–4.3:1); block labels use ink (`#0c3543`) under dark theme and on `comment` blocks in both themes (white was 1.2–2.6:1) |

### Skills installed from online (2026-09-11) — `.agents/skills/` + `skills-lock.json`

7 new UI skills (302 files), verified clean of unsafe instructions:

| Skill | Source | Use here |
|-------|--------|----------|
| `theme-factory` | anthropics/skills | Theme/color-system generation (Sea tokens) |
| `webapp-testing` | anthropics/skills | Playwright-driven UI verification of the shell |
| `typography-audit` | mblode/agent-skills | 78-rule type audit (fonts, scale, punctuation) |
| `ui-design` | mblode/agent-skills | Audit/Build/Direction modes with rule files |
| `ui-verification` | mblode/agent-skills | Runtime browser probes (focus, hit targets, themes) |
| `ui-animation` | mblode/agent-skills | Motion work with scripts |
| `ax-audit` | mblode/agent-skills | Accessibility + architecture rule audits |

canvas-design (anthropics) was skipped — 5.4 MB of bundled fonts, low fit for an app
with its own design language. Lockfile hashes are sha256 of the installed SKILL.md.

### UI enhancement pass (2026-09-11)

- **Tab dirty state made visible** — `markDirty()` toggled a `.dirty` class with zero
  CSS (invisible). Now: accent dot replaces the close '×' until hover (VS-Code style).
- **Open… menu pop-in** — scale+fade with bounce, matching the dialog language.
- **View modes → segmented control** — sunken pill container, raised surface thumb,
  no divider borders.
- **Splash entrance** — brand/nav/lang-cards/actions stagger in (splash-rise);
  global `prefers-reduced-motion` guard neutralizes all of it.
- **XP badge pulse** — CSS hook existed, nothing triggered it; now fires once per
  XP award (`animationend` cleanup, retrigger-safe).

### Mode separation (2026-09-11): Academy chrome is Academy-exclusive

The sandbox previously leaked Academy UI. All of it is now gated by `applyModeChrome()`
in `src/academy.ts`, called from `setMode()` and at init:

- `#xp-badge` (★ XP) — hidden in sandbox (also honors the Settings "Show XP" toggle,
  which was stored but never wired — now live via `refreshModeChrome()`); needs the
  `#xp-badge[hidden]` CSS guard in `style.css` because `.badge` sets `display`.
- `#academy-section` (level/hint/check sidebar) — was permanently `hidden` even in
  Academy mode (dead since decomposition); now shows in Academy, never in sandbox.
- `#mode-toggle` — the only wired way out of Academy mode; now visible in Academy only.
- Command palette "Check Code" — new `when?: () => boolean` gate in `palette-cmd.ts`;
  Academy-only.
- Splash "Open Folder…" forced `mode: 'sandbox'` (was inheriting stale Academy mode
  from localStorage); "Start Coding" already did.
- `#app` `data-mode` default was the bogus `"blocks"` — now `"sandbox"`, synced at boot.

### Bugs found & fixed during the pass
- `blockDrawDeps` captured the initial `slotHits` array while `render()` reassigned
  `slotHits = []` — slot hit-regions landed in an orphaned array. The incremental
  renderer passes a fresh per-root array instead.
- `applyChromeIcons()` would have clobbered the Open-menu item labels (`Open Folder… <kbd>Ctrl+O</kbd>` → "Open").

### Remaining (next agent)
| Task | Why | Where |
|------|-----|-------|
| Run support for non-C languages | **Kindness pass DONE 2026-09-12** — non-C langs now get "`<lang>` can't run in the sandbox yet — the runner speaks C (and C++)" instead of a raw clang linker error | `stage-run.ts` `startRun` |

**Live pass COMPLETE (2026-09-11/12, window control):** sandbox surfaces all verified —
splash (brand header/tiles/stagger), Open… menu (after the two CSS fixes), view modes,
theme repaint both ways, ink labels both themes, typing→canvas sync, dirty dot (title +
tab), drag+drop+canonicalize, Run (exit 0 on C), Go native rendering, unsaved-changes
and reload guards, autosave recovery. **Academy mode verified too:** XP badge appears,
ACADEMY section (Level/Load/Hint/Check) appears, Graduate + Mode buttons appear, level
load seeds from the student's own solution, Run executes with [exit 0]. Nothing left
unverified visually.

**Live-pass bug fixes (2026-09-11, commit d9e7e77):** the Open… menu was invisible —
`.toolbar-nav` `overflow:hidden` clipped it AND `.toolbar` needed `position:relative`
for its z-index; and `updateTitle` gated the dirty dot on `activePath`, so a typed-into
scratch never showed the `•`.
**Gotcha:** `npm run app` serves `dist` (tauri CLI on :1430) — frontend edits need
`vite build` + webview reload; there is no HMR on this script.
| ~~Light-theme block label contrast~~ | **DONE 2026-09-11** — ink labels on control/variables/comment (`block-draw.ts` `LIGHT_INK`) | — |
| ~~Code-split the >500 kB chunk~~ | **DONE 2026-09-11** — lazy CM language packs; initial chunk 892→244 KB | — |
| ~~Offline font fallback~~ | **DONE 2026-09-11** — self-hosted @font-face (Baloo 2 var + Comic Neue), CDN link removed | — |

## Known leftovers / debt

- `skills-lock.json` and `.agents/` are workspace tooling — left untracked deliberately.
- Some deleted modules (`state.ts`, `theme.ts`, `trace-panel.ts`) were leftover dead files removed during rebuild.
- Google Fonts still load from CDN — offline fallbacks are system stacks (acceptable).
- Academy/tour emoji cleaned 2026-09-10: carousel icons are inline SVG (puzzle/trophy/rocket), badges toast by name, streak copy is text-only. Remaining ✓ ✖ ▲ ▸ ▾ ⟳ ★ glyphs are typographic and intentional.

## Score path (for continuity)

| Review | Overall | Notes |
|--------|---------|-------|
| Round 1 | 5.5 | Dual-brand editor, red boxes, fake dirty |
| Round 2 | 7.2 | Sea editor, AA text, selection rail, meaningful dirty |

Target ~9+: theme-switch canvas repaint, splash brand moment, Open menu density.

## Verify after any UI change

```powershell
cd app
npm run typecheck
npm run test
npm run build
```

Visual: light + dark, split/blocks/text, splash panels, empty workspace, open folder, New File → Save As.
