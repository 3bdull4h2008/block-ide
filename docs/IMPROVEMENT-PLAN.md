# Improvement Plan — code-scan findings (2026-08-25, RUN 42)

Method: full scan of `app/src/main.ts` (2,581 lines), `blocks.ts`, `palette.ts`,
`history.ts`, `ops.ts`, `caret.ts`, `commands.rs` (835), `runner/lib.rs`,
gates tooling, capabilities, package scripts. Every finding cites file:line
evidence. Severity: P0 = correctness bug shipping today · P1 = perf/robustness
debt that scales badly · P2 = commercial polish · P3 = tracked big rocks.

## What is already solid (do not rework)

- The gates culture itself: 14 enforced gates incl. a 10k-op randomized
  differential (G-SYNC-FUZZ) and scripted 48-assertion UI E2E.
- Content-addressed staging + rustc hash-cache in runner (two Prepared values
  can never clobber each other; unchanged programs skip recompiles).
- Job-object sandbox + escape validator; academy checks keep their own 10 s
  deadline (`academy_check → run_prepared(&prepared, 10_000, …)`) so the
  interactive-timeout change (RUN_TIMEOUT_MS=0) cannot hang grading.
- History coalescing with cap (200 snapshots); single-seam discipline holds.

---

## P0 — correctness bugs (fix now)

### 1. `render()` silently drops overlapping renders — canvas desyncs from text

**Evidence:** main.ts:280 `if (rendering) return`. `render()` awaits an async
IPC parse; a second edit arriving mid-await is dropped WITHOUT rescheduling.
The textarea already shows edit B; the Pixi canvas shows edit A's tree. In
Split view the user sees two different programs. Violates the visibility rule
behind Golden Rule 1 ("file is truth" must be visibly true).

**Fix:** latest-wins generation token:
```ts
let renderGen = 0
async function render(source: string): Promise<void> {
  const gen = ++renderGen
  rendering = true
  try {
    const out = await invoke('parse_c', { src: source, lang: activeLang })
    if (gen !== renderGen) return // a newer render owns the canvas now
    …draw…
    rendering = false
    if (gen === renderGen && srcEl.value !== source) return render(srcEl.value)
  } finally { if (gen === renderGen) rendering = false }
}
```
**Acceptance:** vitest simulating two overlapping renders asserts final
blocksShape matches final src; add a fast-typing assertion to G-UI-E2E
(type 5 chars quickly, blocks header contains last char).

### 2. `sanitize_abs` weaker than workspace guard

**Evidence:** commands.rs `sanitize_abs` rejects empty + ParentDir only;
`resolve_in_workspace` also rejects RootDir + Prefix components. An absolute
path like `\\?\C:\...` (Prefix) or drive-relative weirdness slips through to
std::fs. Low practical risk (paths come from native dialogs), but the two
guards should agree.

**Fix:** reuse one predicate for both; reject Component::RootDir and
Component::Prefix in sanitize_abs too. **Acceptance:** unit test in recovery
drill style: 4 hostile paths rejected, normal path accepted.

### 3. Dead tauri command `run_c`

**Evidence:** commands.rs `run_c` + registration in lib.rs; frontend calls
only `run_start` (main.ts:1087). Two execution entries = two places to drift
(RUN_TIMEOUT_MS semantics already diverged once).

**Fix:** delete the command + registration (keep `runner::run_c` — validators
use it). **Acceptance:** cargo check clean; grep shows no `'run_c'` invoke.

---

## P1 — performance & robustness debt

### 4. Every keystroke rebuilds the ENTIRE block scene

**Evidence:** setSrc → render() → `world.removeChildren()` + drawBlock over
all roots (main.ts:304-307). No incremental invalidation — this is exactly
the still-open P0.5.1 changed-ranges work. Fine at sample size; breaks the
≤50 ms p95 budget on 2k-line files (G-PERF covers file listing, not canvas).

**Fix path:** short term — rAF-coalesce renders + skip when canonical
signature unchanged; long term — land P0.5.1 (changed-ranges → invalidate
O(affected) subtrees). **Acceptance:** new gate metric: median keystroke→paint
on the 2k-line corpus file ≤50 ms.

### 5. Toolchain probes run per run (no cache)

**Evidence:** runner/lib.rs:489-499 — python_path/node_path/rustc_path call
probe() every prepare_lang; each probe SPAWNS `<tool> --version` (Windows
Store python stub alone can cost 100-300 ms). C is unaffected; py/js/rust pay
on EVERY run.

**Fix:** `static TOOL_CACHE: OnceLock<...>` memoize first success (re-probe
only on failure). **Acceptance:** bench in run_hello_bench-style: second
python run's prepare time < first by probe cost.

### 6. Title IPC fired per keystroke

**Evidence:** setSrc → markDirty (every op/type edit) → updateTitle →
`getCurrentWindow().setTitle(...)` IPC (main.ts:1476). Cheap individually,
needless ×N.

**Fix:** call updateTitle only when dirty-state OR name transitions (track
last title string; skip identical). **Acceptance:** manual; no gate needed.

### 7. Unbounded caches/maps

**Evidence:** fileCache/savedCache/tabViews cleared only on Open Folder
(main.ts:1412-1416). A long session opening hundreds of files grows without
bound; closed tabs never evict (there ARE no close buttons — see #13).

**Fix:** tab close buttons (#13) + evict that doc from all three maps on
close; optional LRU cap 64. **Acceptance:** close a dirty-guarded tab →
reopen shows disk content; memory flat over 100 open/close cycles.

### 8. Tab key unusable in the text editor

**Evidence:** no Tab handler for srcEl anywhere in main.ts — pressing Tab in
Text view moves FOCUS out of the editor (browser default). Text-mode learners
hit this immediately.

**Fix:** keydown on srcEl: Tab inserts two spaces (Shift+Tab outdents line);
Enter auto-indents to previous line's leading whitespace. **Acceptance:**
G-UI-E2E assertion: dispatch Tab in textarea → value contains "\n  " and
focus stays.

---

## P2 — commercial polish

| # | Item | Evidence / rationale | Effort |
|---|---|---|---|
| 9 | Tab close buttons (+ middle-click, Ctrl+W) with discard guard | tabs have no close affordance at all; pairs with #7 | S |
| 10 | Diagnostics PANEL (list of errors, click → jump to block/line) | outlines exist; learners need a scannable list like VS Code Problems | M |
| 11 | Find & Replace (Ctrl+F/H) in text view | table stakes for "real editor" perception | M |
| 12 | Drag-drop files onto the window to open | standard desktop convention; cheap via tauri onDragDrop event | S |
| 13 | CI: GitHub Actions running `cargo test --workspace` + `vitest run` (+ tsc) on every push | zero CI today (.github absent); gates are local-only trust | M |
| 14 | ESLint + Prettier + `npm test` script wired into gates pre-flight | package.json has no test/lint/format scripts; TS quality is eyeballed | S |
| 15 | Version 0.2.0 + rebuilt NSIS installer + CHANGELOG.md | exe shipped at v0.1.0 predates EVERYTHING since; version stale | S + drill |
| 16 | Zoom-to-fit button + fit-on-load for block canvas | wheel-zoom exists; newcomers get lost on big programs | S |

## P3 — tracked big rocks (already on PLAN; ordered by leverage)

17. **P0.5 trio**: changed-ranges incremental sync (feeds #4), AST-mutation
    API seam, comment-anchor persistence + G-COMMENT-SURVIVAL (emitter still
    drops comments by design — RUN 4 note).
18. **G-PARSE-PARITY WASM gate**: `-SkipWasm` param exists in run_gates.ps1
    with NO wasm section behind it — native↔WASM tree equality is asserted
    nowhere automated.
19. **clangd hovers + go-to-def** (step 2.5, deferred twice).
20. **Step-mode debugger** (3.5, deferred RUN 15).
21. **Multi-language diagnostic→block mapping** beyond clang (py/js/rust show
    stderr text only — D11 known limit; py right-edge: parse-tree error nodes
    could map without external LSP).
22. **Keyboard socket cycling** (frame-based research remainder: arrows
    between sockets of the focused block).

## Suggested order (next sessions)

1. #1 render race + #8 Tab key + #2/#3 cleanups (one session, P0 sweep)
2. #6/#5/#7 quick wins (one session)
3. #9+#12+#16 UI completion batch
4. #14+#13 engineering hygiene batch
5. #15 release train: 0.2.0 + installer + vanilla-Windows drill (manual)
6. Then P3 by leverage: comments emitter → WASM gate → P0.5.1 (unlocks #4)

Every P0/P1 item above gets a receipt + gate/vitest coverage per Loop
Discipline before its session closes.
