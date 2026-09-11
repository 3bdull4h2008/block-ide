# Cade Logic Map — architecture, invariants, and the 2026-09-11 logic pass

> Companion to `DESIGN.md` (visual) and `UI-REBUILD-NEXT.md` (UI track).
> This is the logic-side map: data flow, module contracts, the invariants the
> code assumes, and every bug found & fixed. External tests: `npm run test:logic`.

## 1. End-to-end data flow

```
CodeMirror editor (src/editor.ts; legacy hidden textarea #src)
  → onUpdate (main.ts:151) — srcSetting guard prevents programmatic re-entry
  → src (main.ts:245) + hist.push(prevSrcForUndo) (history.ts)
  → scheduleRender — rAF-coalesced (main.ts:314)
  → render(source) (main.ts:328)
      → invoke('parse_c')            Rust/tree-sitter — UTF-8 BYTE offsets
      → normalizeTreeOffsets         NEW: bytes → UTF-16 units, once, here
      → buildBlocks (blocks.ts:348)  CTreeJSON → BBlock[] (SHAPE per lang)
      → layoutStack (blocks.ts:428)  x/y/w/h
      → palette signature walk       kinds+includes+harvestVars
      → per-root draw cache          reuse keyed by theme|lang|cat|sticky|
                                     container|nodeKind|span|pos|slice-text
      → block-draw.ts drawBlock      Pixi Graphics + Text per block
  → caret anchors (caret.ts)         node+edge, NEVER raw offsets across parses
  → gestures (drag-drop.ts, inline-slot-editor.ts, ops.ts)
      → splice ops on src (ops.ts)   one splice per gesture
      → setSrc → canonicalize → re-render
```

## 2. Module map

| Module | Responsibility | Key exports |
|---|---|---|
| `main.ts` | orchestration, state ownership (src, roots, caches, tabs, files, theme, mode) | boot only |
| `blocks.ts` | parse-tree → Scratch-block model, geometry, drop-target math, palettes | `buildBlocks`, `layoutStack`, `flatten`, `findDropTarget`, `hitTestHeader`, `harvestVars`, `measure` |
| `block-draw.ts` | one block → Pixi subtree (+ recursion for children) | `drawBlock` |
| `utils/drawing.ts` | pure path builders (notch/mouth/tab), color mixing | `statementPath`, `cHeaderPath`, `cBodyPath`, `mixWhite` |
| `utils/offsets.ts` | **NEW** — byte↔UTF-16 offset normalization at the IPC boundary | `normalizeTreeOffsets`, `normalizeDiagOffsets`, `byteIndexTable`, `byteToIndex` |
| `caret.ts` | semantic caret anchor: node id + edge + discriminator | `pickAnchor`, `caretOffset` |
| `ops.ts` | pure source-splice algebra (one splice per gesture) | `spliceInsert`, `spliceMove`, `applyEdit`, `insertTopLevel` |
| `history.ts` | push-before-mutate undo stack, 900ms type-coalescing, cap 200 | `History` |
| `editor.ts` | CodeMirror wrapper: compartments for lang/theme/history | `createCodeMirrorEditor` |
| `drag-drop.ts` | pointer gestures: ghost, dropbar, drop resolution, splice | `startHtmlDrag` |
| `inline-slot-editor.ts` | typed slot editing (bool/ident/number/string) | `commitSlotValue`, `openSlotEditor` |
| `palette.ts` | block chip data + slot validation | `validateSlotValue`, `reporterFits` |
| `diagnostics.ts` | diag overlay + Problems strip; jump-to-offset | `refreshDiagsMod` |
| `academy.ts` / `academy-extras.ts` | academy mode chrome, XP/mastery/badges/streak persistence | `setMode`, `applyModeChrome`, pure: `updateStreak`, `masteryDue`, `checkBadges` |
| `autosave.ts` | 2s-debounced recovery snapshots + session restore | `scheduleAutoSave`, `recoverSession` |
| `keybindings.ts` / `editor-keys.ts` | global dispatch / textarea editing ops | — |

## 3. Invariants (now enforced or documented)

1. **One offset unit.** Everything downstream of `render`/`refreshDiags`
   operates on UTF-16 code-unit indices. The parser's byte offsets are
   converted exactly once (offsets.ts). ASCII made the old mismatch invisible.
2. **Draw-cache identity.** A cache hit requires same theme, lang, cat,
   stickiness, container-ness, nodeKind, span, position AND exact slice text —
   so ids/parts/closures of reused subtrees are numerically and semantically
   equal; slot hits are rebound to the fresh parse's node objects anyway.
3. **History is push-before-mutate**, coalesces only consecutive `'type'`
   pushes within 900ms, and undo/redo break coalescing. CodeMirror's own
   history is suspended (compartment) around programmatic `setSource`, so
   exactly ONE undo system owns each edit.
4. **`prevSrcForUndo` is reset** on tab activation, session start, and the
   close-to-scratch fallback — the previous document can never become the new
   tab's undo target.
5. **Render errors can't leak Pixi objects**: the draw-cache destroy-diff runs
   in `finally` (fresh wraps destroyed on mid-loop throw; reusables stay live).
6. **Clean-buffer semantics**: the empty/sample exemptions in
   `isMeaningfullyDirty` apply ONLY to the scratch buffer; real files that are
   emptied or equal a sample are dirty.
7. **Autosave writes only when `!isClean()`** (the old `blockide-snapshot:*`
   guard read a key that was never written), and recovery drives the editor
   exclusively through `setSrc` (no unguarded second `setSource`).

## 4. Bugs found & fixed (2026-09-11 logic pass)

### P0 — data corruption / broken core flows
| Bug | Where | Fix |
|---|---|---|
| Parser byte offsets vs JS UTF-16 indices: every span past the first non-ASCII char landed wrong (splices, caret, diag jumps, dup/delete) | Rust IPC boundary | `utils/offsets.ts` — normalize tree + diags once on arrival; binary-search byte→index table |
| Python auto-indent drop DELETED the target line's text (`spliceInsert` early return dropped `[lineStart, offset)`) | ops.ts:41 | removed early return; shared splice preserves the prefix |
| One Ctrl+Z ran BOTH undo systems (CM history + app history), double-undoing and polluting the stack so undo/redo toggled | main.ts keydown, editor.ts | `defaultPrevented` guard; `srcSetting` wraps; history compartment suspends CM history around `setSource` |
| Cross-tab undo injection: first keystroke after a tab switch pushed the PREVIOUS tab's doc as the undo target | activateTab/closeTab/beginSession | `prevSrcForUndo = src` resets |
| Bodyless control statement (error recovery) threw `null.start` in `headerEnd` — canvas froze, wraps leaked per keystroke | blocks.ts toBlock | `compound?.start ?? n.end` |

### P1 — logic defects
| Bug | Fix |
|---|---|
| Draw cache reused stale node identities (slot editor fell back to prompt after equal-length edits); key omitted container/nodeKind | rebind `SlotHit.block` to the fresh node; key extended |
| Render error path leaked GPU/text objects (partial `nextCache` discarded un-destroyed) | destroy-diff moved into `finally` |
| "Virtual root" drag fallback spliced after the first character of a non-container root (`i|nt x;`) | route through `insertTopLevel` (file-scope append) |
| `harvestVars` harvested initializer expressions (`int x = y;` → vars x AND y; calls polluted the palette) | descend the `declarator` field only; declarator-chain filter for array/pointer |
| Python `try` header spliced in `except`/`finally` clauses | `handler`/`finalbody` added to `BODY_FIELDS` |
| Context-menu Enter executed the wrong item when a divider preceded (index space mismatch) | parallel `rowItems` (DOM-row order) for keyboard activation |
| Empty file / sample-equal REAL files counted as clean → silent discard | exemptions now scratch-only |
| Streak broke on UTC-negative timezones (`new Date('YYYY-MM-DD')` local getters shift a day) | parse date components directly |
| `bug_squasher` / `loop_master` badges were unobtainable (counters never incremented) | fail→pass = fix; distinct looping levels passed = concepts mastered (persisted) |

### P2/P3 — robustness
- Drag: re-entrancy guard + `pointercancel`/`blur` cleanup (ghost could follow the mouse forever).
- Pan-zoom: scale clamped 0.2–3; panning cleared on `pointercancel`/`blur`.
- Resize: canvas divider no longer sticks `.active`; mouseup dispatches `resize` so Pixi re-renders.
- Slot editor: mounted in the shipped `#slot-editor` wrapper (duplicate id removed), visible `.bad` error state, user text preserved on invalid commit.
- Keybindings: `defaultPrevented` guard; `/` no longer hijacks CM's contenteditable.
- fileCache eviction skips entries backing open tabs (evicted+reopened was an empty, "clean" buffer).
- Save-As onto an existing path now runs the switched-path housekeeping (palette, view mode).
- Autosave: clean-buffer guard now real (`isClean` dep); recovery no longer double-drives the editor.
- History: undo/redo break type-coalescing; boot no longer runs `setTheme` twice.

## 5. External tests

```
cd app
npm run test:logic      # 35 standalone Node assertions, real TS sources, no DOM/IPC
npm test                # 43 vitest e2e-style tests
npm run typecheck && npm run build
```

`scripts/register-ts.mjs` + `scripts/ts-resolve.mjs` are a resolution hook so
plain Node (≥23.6) imports the app's extension-less TS imports directly —
the tests run OUTSIDE the app, before any bundling. Every P0/P1 fix above has
a named regression test in `scripts/test-logic.ts`.

## 6. Known remaining debt (deliberately not fixed now)

- `editor-keys.ts` transforms are welded to the hidden textarea (latent, unreachable) — extract pure `indentBlock`/`toggleCommentLines` before reuse.
- `canonicalize` caret restore can race a pending rAF render; `setSrc` doesn't await the actual render promise.
- `LANG_SHAPES` lacks go/java/typescript — they parse but render with C shapes (New File offers them).
- `hitTestHeader` returns the deepest match; container headers lose to child rows on overlap (fine today).
- Drag/slot gestures splice against the last COMPLETED render without a `renderSettled` check — mitigated by rAF coalescing but not airtight.
