# UI Rebuild — Status & Next Agent Handoff

> Session: 2026-09-10 · Theme score path **5.5 → 7.2/10**
> Design language: `DESIGN.md` (Sea palette, Comic Neue + Baloo 2, Scratch blocks)

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

| # | Task | Why | Where |
|---|------|-----|--------|
| 1 | **Repaint canvas on theme toggle** | `COLORS_DARK` exists but blocks don't re-draw when `data-theme` flips | `main.ts` `setTheme` → `lastPaintedSrc = null; void scheduleRender(src)` |
| 2 | **Collapse Open+File** into one “Open…” menu | Toolbar density (reviewer +0.3 hierarchy) | `index.html` toolbar + `main.ts` handlers |
| 3 | **Branded splash shell** | Still a generic dialog; distinctive moment for first impression | `index.html` `#splash` + `style.css` |
| 4 | **Inline SVG in HTML** for remaining controls | Avoid post-boot `innerHTML` swap flash | `index.html` + `icons.ts` |
| 5 | **Incremental block invalidation** | Perf: only redraw changed subtrees (IMPROVEMENT-PLAN #4) | `main.ts` `render` / `blocks.ts` |
| 6 | **Dark canvas block edges** | Verify `palColors()` under dark; tune `BORDER_DARK` contrast | `blocks.ts` |

## Known leftovers / debt

- `skills-lock.json` and `.agents/` are workspace tooling — commit or ignore deliberately.
- Some deleted modules (`state.ts`, `theme.ts`, `trace-panel.ts`) were leftover dead files removed during rebuild.
- Google Fonts still load from CDN — offline fallbacks are system stacks (acceptable).
- Academy / tour copy still has light emoji in a few places — replace when touching those surfaces.

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
