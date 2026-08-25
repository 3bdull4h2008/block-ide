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

### 0. Tauri sync commands ran ON THE MAIN THREAD — one slow call froze all IPC ✅ DONE (RUN 43)

**Found while fixing #1.** Evidence: ipcLog timings showed parse_c/diag_c
executing SERIALLY (6959 ms + 6960 ms back-to-back for ~10 ms of work), then
canonicalize_c ×2 + run_start pending FOREVER while the JS thread stayed
healthy — classic main-thread starvation. A blur-triggered clang-format
blocked every later command; explains historic ctrl+enter flakes.

**Fix shipped:** all 26 commands converted to `async fn` (off the main
thread); perf.rs call sites wrapped in `tauri::async_runtime::block_on`.
**Acceptance:** full suite green twice consecutively incl. new race + tab
assertions.

### 1. `render()` silently drops overlapping renders — canvas desyncs from text ✅ DONE (RUN 43)

**Evidence:** main.ts:280 `if (rendering) return`. `render()` awaits an async
IPC parse; a second edit arriving mid-await was dropped WITHOUT rescheduling.
The textarea already showed edit B; the Pixi canvas showed edit A's tree.

**Fix shipped:** latest-wins generation token (`renderGen`); stale renders
abort after await; the finally-clause re-renders when the newest buffer
differs from the parsed source. Gate assertion added to G-UI-E2E
("render race: rapid edits converge on canvas") + `__labels` debug hook.

### 2. `sanitize_abs` weaker than workspace guard ✅ DONE (RUN 43)

**Fix shipped:** prefix-aware component walk — ParentDir rejected anywhere,
exactly one root segment allowed directly after an optional Windows prefix
(drive-relative "C:file" forms rejected as ambiguous). Inline tests:
`abs_guard_tests` (6 hostile rejects / 4 accepts).

### 3. Dead tauri command `run_c` ✅ DONE (RUN 43)

**Fix shipped:** command + registration removed (runner::run_c kept for
rust-side validators); comment marks the seam.

### BONUS fixes landed during the sweep (RUN 43)

- **Comment stickies + error mystery blocks rendered BLANK** — label was
  hardcoded '' since the sticky era; now `leafText` supplies raw text
  (Rule 5). New vitest: e2e/comments.test.ts.
- **main.ts was full of committed double-mojibake** (`ΓÇÖ` etc. from an old
  PS5.1 ANSI write) — byte-level cp1252↔utf8 round-trip restored every
  em-dash/ellipsis/arrow; tsc + gates verified.
- **canonicalize() rewrote the buffer under the user's caret on blur** —
  caret is now semantically re-mapped onto the formatted tree without
  stealing focus.
- **run_start/run_poll failures were swallowed** (`.catch(() => {})`,
  eternal spinner) — launch/poll errors now surface as `[launch]`/`[poll]`
  console lines and reset the run state.
- **Gates now rebuild dist + release exe before G-UI-E2E** and sweep stray
  app.exe locks at startup — the tested binary can never be stale again.

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

### 8. Tab key unusable in the text editor ✅ DONE (RUN 43)

**Evidence:** no Tab handler for srcEl anywhere in main.ts — pressing Tab in
Text view moved FOCUS out of the editor (browser default).

**Fix shipped:** Tab inserts two spaces (collapsed caret), Shift+Tab outdents
line by up to two spaces, multi-line selections indent/outdent line-wise,
Enter auto-indents to the previous line and brace-expands `{` / python `:`.
Gate assertion added ("editor: Tab indents, focus stays").

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
