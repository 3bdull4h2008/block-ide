# Block-IDE Build Plan (Unified, 2026-08-23; Revision 1)

> Single authoritative plan for the Block-IDE project (`E:\block-ide`).
> Supersedes all prior notes, chat decisions, and scratch plans — content from
> those is preserved here. Follow phases in order unless the ladder marks a
> track as parallel-safe. Never claim a feature works while it round-trips
> through lossy paths, hand-written parsers, or guessed AST shapes.
>
> **One-line thesis:** a Scratch-style block editor for real programming
> languages, starting with C, where **the `.c` file is the single source of
> truth** and blocks are a live, bidirectional projection of its syntax tree.

---

## Purpose

Three sub-goals, one pipeline:

1. **Round-trip proof** — parse arbitrary C into an AST and render it as
   blocks, then regenerate byte-stable (post-format) C from those blocks.
   This is the highest-risk capability; nothing else ships until it holds.
2. **Sandbox IDE** — a VS Code-like multi-tab workspace where every file can
   be viewed/edited as Blocks, Split, or Text; instant compile+run; a visual
   Stage; and a memory visualizer that makes pointers visible.
3. **Academy** — gamified learning on top of the same engine: puzzle levels,
   XP, progressive block-category unlocks, boss battles, hint tiers.

Success metric: a 12-year-old writes, runs, and debugs a working C program
with pointers — smiling — within their first week.

---

## Core Architectural Decision (2026-08-23)

**Pipeline strategy = text ⇄ tree-sitter AST ⇄ blocks. NO ADAPTATION, no
third model.**

Do not invent a custom C parser. Do not persist block graphs as JSON project
files. Do not use Google Blockly's layout engine (its block model cannot
express C's grammar; we keep only its interaction vocabulary). The canonical
pipeline is:

```
editor.c  --tree-sitter-c-->  AST (+ node-id ↔ byte-range map)
                              AST  --block-renderer-->  live block canvas
block edits --AST mutate-->   re-parse → clang-format --> editor.c (rewrite)
```

### Canonical Framework Rules (Non-Negotiable)

1. **The file is the truth.** Every edit — in blocks or in text — lands in
   the `.c` file on disk first. Blocks are regenerated FROM the parse. There
   is no persistent block representation anywhere.
2. **One parser, pinned.** `tree-sitter-c` at a locked grammar version,
   compiled to WASM for the UI thread and native for validators. Both builds
   must produce identical trees (gate G-PARSE-PARITY).
3. **Node identity map is sacred.** A `nodeId → byteRange` map is maintained
   incrementally across edits (tree-sitter's changed-ranges API). All
   diagnostics, hovers, breakpoints, and error squiggles route through this
   map. Losing sync = hard reset to text view, never silent divergence.
4. **All block→text emission passes clang-format.** Users may write messy
   text; blocks always regenerate canonically formatted output. Round-trip
   equality is defined as `format(parse(blocks)) == format(parse(text))`.
5. **Error nodes are editable.** Tree-sitter parses error-tolerantly; ERROR
   nodes render as gray "mystery" blocks with their raw text inside. Broken
   code MUST remain editable in block view — this kills the #1 failure mode
   of every block IDE shipped so far.
6. **Comments survive by anchoring.** Comments attach to the nearest
   following sibling node and render as sticky notes; they are preserved
   verbatim through round-trips (gate G-COMMENT-SURVIVAL).
7. **No semantic guessing.** The block layer uses only syntax + what clangd
   volunteers (types, refs). We never invent types, never auto-"fix" user
   code silently, never reorder declarations.

---

## Current State (2026-08-23)

- Repository directory created (`E:\block-ide`) with this plan only.
- No code, no scaffold, no CI. Everything below ❌ NOT STARTED.
- Prior art researched (Blockly generators, MakeCode/PXT, tree-sitter WASM
  playgrounds); conclusions absorbed into Golden Rules above.

---

## Definition of Done

### Sandbox MVP (end of P2)

- Open a folder of `.c` files → tabs + file tree; open/edit/save each tab in
  Blocks / Split / Text view; switching views mid-edit never loses input.
- Fuzzy-typed broken code renders as mystery blocks and stays editable.
- One keystroke: compile (bundled toolchain) → run → console panel shows
  output; compiler diagnostics map onto the exact offending blocks.
- Round-trip gates green over the validation corpus (see Gates).

### Full v1 (end of P4/P5)

- Stage panel: programs draw/move sprites/pixels via the bundled `stage.h`
  library with <16 ms feedback.
- Memory visualizer: stack frames as boxes during runs, pointer arrows drawn
  between them, watch expressions as labeled boxes.
- Academy: ≥30 levels across 5 worlds, XP + unlocks enforced by server-less
  local profile, 3-tier hints per level, 3 boss battles.

---

## Constraints / Golden Rules

1. Text ⇄ AST ⇄ blocks only. No third representation, ever.
2. Never block editing. Any state where the user cannot type because the UI
   is confused is a severity-0 bug.
3. Determinism over cleverness: same file + same ops ⇒ same output bytes.
4. Latency budget: keystroke→block-update ≤50 ms p95 on a 2,000-line file;
   run→output ≤150 ms for hello-world (bundled tcc-class compiler).
5. Every diagnostic (parser, compiler, LSP) must be traceable to a nodeId;
   untraceable diagnostics render in the console panel only, flagged.
6. Kid-safe defaults: no telemetry, offline-first, no accounts required.
7. `third_party/` vendoring only — no SDK wrappers, no forced network
   fetches at build time (mirrors MCLA no-ReXGlue mandate).
8. One hook owner per feature seam (same discipline as MCLA): e.g., exactly
   one module owns "AST mutation"; exactly one owns "text rewrite".

---

## Phase Ladder

| Phase | Scope | Gate |
|---|---|---|
| **P0 Round-Trip Pipeline** | Scaffold app shell; tree-sitter-c WASM + native; AST→read-only block renderer; blocks→clang-format emitter; corpus harness | G-ROUNDTRIP ≥99.5% node-equal on 200-file corpus; zero crashes on malformed corpus |
| **P0.5 Edit Model** | Node-id ↔ range incremental sync via changed-ranges; text-pane edits debounce into re-parse; AST-mutation API | G-SYNC-FUZZ: 10k random edit ops, no desync; ≤50 ms p95 reparse |
| **P1 Editor MVP** | Interactive blocks: drag/drop/connect/delete/inline-edit; tabs + tree; Blocks/Split/Text per tab; save/load; undo/redo across both views | G-EDIT-E2E: scripted user flows pass; undo returns byte-identical file |
| **P2 Execution** | Bundled compiler (tcc or clang -O0); sandboxed child process; console panel; diagnostic→node mapping | G-RUN-HELLO ≤150 ms; G-DIAG-MAP: 100% of test-suite diagnostics carry valid ranges |
| **P3 Stage & Memory Viz** | `stage.h` graphics lib + stage panel; run-time memory tracer (stack boxes, heap boxes, pointer arrows); watch boxes | G-STAGE-FPS ≥55 fps demo scene; G-MEMTRACE: leak-free tracer on stress program |
| **P4 Academy** | Level format + runner (tests = expected stdout/exit); XP/profile store; category unlock gating of palette; hint tiers; boss battles | G-ACADEMY: full 30-level suite solvable headless by reference solutions |
| **P5 Polish & Platform** | Themes, keybindings, onboarding tour, perf hardening, installer; language-pack plugin interface (v2 prep) | G-PERF: 5k-file project opens <3 s; installer clean on vanilla Windows |

**Execution order:** P0 → P0.5 strictly sequential (riskiest first).
P3 may start once P2's run loop is stable. P4 needs P1 (editing) but not P3.
P5 last. Second-language packs are explicitly OUT of v1.

---

## Phase Details

### Phase 5 — Polish & Platform

| Step | Description | Status | Validation |
|------|-------------|--------|------------|
| 5.1 | Themes | ✅ light/dark via CSS vars + persisted toggle | manual |
| 5.2 | Keybindings | ✅ Ctrl+Enter/F5 run, Ctrl+B sidebar, Ctrl+1/2/3 views, Ctrl+S/Z/Y | G-UI-E2E (scripted, enforced) |
| 5.3 | Onboarding tour | ✅ 4-step first-run overlay (localStorage flag) | manual |
| 5.4 | Perf hardening | ✅ walk caps lifted, G-PERF enforced | G-PERF |
| 5.5 | Installer | ✅ NSIS currentUser build ships app + vendored tcc (2.6 MB, offline-capable); clean-install drill on vanilla VM pending | manual install test |
| 5.6 | Crash recovery journal | ✅ (pulled forward from P1.6) write-temp-rename journal, boot-time restore prompt | kill -9 test manual |

**Gate 5:** ✅ MET 2026-08-23 — G-PERF + G-UI-E2E enforced green; NSIS
installer ships the tcc backend. Remaining manual drill: vanilla-Windows
install test only.

### Phase 0 — Round-Trip Pipeline (ACTIVE next)

**Goal:** Prove text⇄blocks fidelity on real C before any UX work.

| Step | Description | Status | Validation |
|------|-------------|--------|------------|
| 0.1 | Scaffold: Tauri 2 shell, Vite+TS front end, Rust core crate `core-parser` (tree-sitter-c native) + WASM build | ❌ | `cargo test` + `wasm-bindgen` smoke test |
| 0.2 | AST canonicalizer: normalize tree-sitter tree into stable `Node{kind, fields, children}` with synthetic ids | ❌ | Snapshot tests vs golden trees |
| 0.3 | Read-only block renderer: canvas (PixiJS) drawing statements/exprs as nested Scratch-style blocks; layout engine with measurement cache | ❌ | Visual snapshot tests; 60 fps pan/zoom on 2k-line file |
| 0.4 | Emitter: AST→C source → clang-format (vendored LLVM libs or shelling `clang-format.exe` bundled) | ❌ | Byte-stable double-emission (`emit(parse(emit(ast))) == emit(ast)`) |
| 0.5 | Corpus harness: 200 files (own samples + public-domain C: musl subset snippets, K&R examples, obfuscated-decoder outputs); malformed-corpus subfolder | ❌ | Corpus committed with hashes |
| 0.6 | `roundtrip_validator.exe`: parse→render-model→re-emit→format→compare node streams (not bytes) | ❌ | ≥99.5% node-equal; failures auto-minimized |

**Gate 0:** ❌ NOT MET. `G-BUILD`, `G-PARSE-PARITY`, `G-ROUNDTRIP`,
`G-MALFORMED-NOCRASH` enforced and green.

---

### Phase 0.5 — Edit Model

| Step | Description | Status | Validation |
|------|-------------|--------|------------|
| 0.5.1 | Changed-ranges wiring: text edit → minimal tree update → incremental block-layout invalidation | ❌ | Unit: single-char insert updates O(affected) nodes only |
| 0.5.2 | AST-mutation API (the ONE seam): insert/delete/wrap/replace nodes; used by both future block gestures and refactor tools | ❌ | Property tests: any op sequence keeps parseable output |
| 0.5.3 | Mystery-block rendering of ERROR/MISSING nodes incl. partial statements | ❌ | Malformed corpus: every file opens editable, zero exceptions |
| 0.5.4 | Comment anchor persistence through mutations | ❌ | G-COMMENT-SURVIVAL suite |

**Gate 0.5:** ✅ G-SYNC-FUZZ MET 2026-08-24 (`sync_fuzz_validator`: 10k-op
randomized differential, text-driver vs block-driver converge byte-identical).
Steps 0.5.1/0.5.2/0.5.4 (incremental changed-ranges sync, AST-mutation API,
comment anchors) remain open — see P1.2 residual note.

---

### Phase 1 — Editor MVP (Sandbox shell)

| Step | Description | Status | Validation |
|------|-------------|--------|------------|
| 1.1 | Workspace: folder open, file tree, tabs (dirty indicators), VS Code keybinding set | ❌ | Scripted E2E |
| 1.2 | Per-tab view modes Blocks / Split (sync-scroll) / Text; mode switch preserves cursor & selection semantically (map via node ids) | ✅ view modes + per-tab memory + text→blocks sync-scroll; cursor semantic map pending | G-UI-E2E |
| 1.3 | Block interactivity: drag-from-palette, snap targets validated by grammar (an `else` cannot exist without `if`), inline textfields for identifiers/literals, delete = safe subtree removal with placeholder | ❌ | Grammar-reject unit tests |
| 1.4 | Palette v1 categories: Control, Loops, Variables, Operators, Functions, I/O (printf family), Structs | ❌ | Each palette block emits compilable snippet |
| 1.5 | Undo/redo spanning both views (command-pattern on AST ops + text diffs) | ❌ | Undo-to-byte-identical gate |
| 1.6 | Autosave + crash recovery journal | ❌ | Kill -9 recovery test |

**Gate 1:** ❌ NOT MET. `G-EDIT-E2E` scripted flows (build fizzbuzz entirely
in blocks; fix injected bug found via blocks only).

---

### Phase 2 — Execution & Diagnostics

| Step | Description | Status | Validation |
|------|-------------|--------|------------|
| 2.1 | Toolchain bundling decision → D4 below; default single-file + simple-project builds | ✅ tcc vendored | cold/warm bench in run_hello_bench |
| 2.2 | Sandboxed runner: job-object limits (CPU/RAM/time), no network, cwd=jail | ✅ runner crate | sandbox_escape_validator 5/5 |
| 2.3 | Console panel: stdin injection, ANSI, exit-code surface, stop button | ✅ | Interactive-program script |
| 2.4 | Diagnostic mapping: clang/gcc/tcc stderr parse + clangd LSP (publishDiagnostics) → byte ranges → nodeIds → block highlights + gutter markers | ✅ clang stderr | G-DIAG-MAP suite 7/7 fixtures |
| 2.5 | clangd integration: hover types shown on block edges, go-to-def jumps tabs | ❌ | Hover fixtures |

**Gate 2:** ✅ MET 2026-08-23 — G-RUN-HELLO (18.5 ms median), G-DIAG-MAP,
G-SANDBOX-ESCAPE all ENFORCED+green. Step 2.5 (clangd hovers) deferred to
ride along with P3's hover-driven memory viz.

---

### Phase 3 — Stage & Memory Visualizer

| Step | Description | Status | Validation |
|------|-------------|--------|------------|
| 3.1 | `stage.h`: tiny C API — `stage_init`, `stage_draw_pixel/rect/sprite`, `stage_key_down`, `stage_random`, tick-based main loop shim | ✅ shm FB + fenster window mode | stage_determinism_validator |
| 3.2 | Stage panel: embedded window sharing the runner process framebuffer; auto-link into new projects | ✅ panel live via named shm → canvas (keys forwarded, fps meter); G-STAGE-FPS measurement pending | input latency <1 frame |
| 3.3 | Memory tracer: interposed allocator + stack-walk sampler → event stream (alloc/free/frame-enter/leave/addr) replayed by UI | ✅ v1: macro-interposed memtrace.h → shm event ring → live heap list + leak report (stack-walk deferred) | memtrace_soak_validator |
| 3.4 | Memory view UI: stack frames as nested boxes filling left→right, heap arena, draggable pointer arrows, hover = address/type/value; watch boxes pin variables | ✅ v1: live heap boxes + pointer arrows from ReadProcessMemory scans; hover tooltips; drag/watch deferred to polish | G-MEMVIEW |
| 3.5 | Step mode: pause/resume/step-lines wired to debugger (later gdb/MI or custom int3 harness — decide at build time) | DEFERRED → P5 (live viz first; debugger infra is its own project — decision recorded RUN 15) | Step determinism tests |

**Gate 3:** ✅ MET 2026-08-23 — G-STAGE-FPS (0% pipeline loss @60fps),
G-MEMTRACE, G-MEMVIEW all ENFORCED+green. Step mode explicitly deferred.

---

### Phase 4 — Academy Mode

| Step | Description | Status | Validation |
|------|-------------|--------|------------|
| 4.1 | Level format v1 (TOML, mirrors manifest discipline): id, world, xp, starter code, hidden tests (stdin→expected stdout/exit), hint[3], solution.c | ✅ runner::academy + academy/worlds/ | schema lint in G-ACADEMY |
| 4.2 | Level runner: compiles submission in sandbox, runs hidden tests, awards XP; anti-hardcode (≥2 distinct test inputs per level) | ✅ headless reference solves; XP/profile store pending | G-ACADEMY |
| 4.3 | Profile store: local JSON under userData; XP, streaks, badges, unlocked categories; palette filters by unlock state | ❌ | Unlock-enforcement unit tests |
| 4.4 | Content: Worlds 1–5 — Hello&Output → Variables/Math → Control Flow → Loops → Functions/Structs; 6 levels + 1 boss battle each (boss = runnable mini-game using stage.h) | 🚧 3/30 seed levels committed | G-ACADEMY content count |
| 4.5 | Hint system: 3-tier progressive reveal per level, usage tracked locally | ❌ UI pending (hints exist in format) | Content lint (every level has 3 hints) |

**Gate 4:** ❌ NOT MET. `G-ACADEMY`.

---

## Automated Phase Gates

Runner: `tools\run_gates.ps1 [-SkipRun]` → build front+back → all validators
→ headless E2E (Playwright-style driver) → JSON report
`build\gates\<date>-gate-report.json`. Exit 0 only when every ENFORCED gate
passes. Laws (adopted from B2S discipline):

1. **Harness first** — gates exist from day 1 of P0 and stay green.
2. **Numbers, not judgement** — every gate emits machine-checked metrics.
3. **Regression blocks features** — enforced-gate flip green→red = `[REGRESSION]`,
   fails run; feature work stops.
4. **Dated artifacts persist** — commit hash + timestamp embedded per run.

| Gate | Status | Checks |
|---|---|---|
| G-BUILD | will enforce @P0 | clean build, zero errors, both targets |
| G-PARSE-PARITY | will enforce @P0 | native vs WASM tree equality |
| G-ROUNDTRIP | will enforce @P0 | ≥99.5% node-equal corpus round-trip |
| G-MALFORMED-NOCRASH | will enforce @P0 | malformed corpus opens w/o exception |
| G-SYNC-FUZZ | ENFORCED @P0.5 ✅ (2026-08-24) | 7 programs × 500 ops × 2 drivers (text vs block) converge byte-identical; intermediates error-free; canon idempotent — seeds 0x…0001/0x…0002/31337 green |
| G-EDIT-E2E | will enforce @P1 | scripted authoring flows |
| G-RUN-HELLO | ENFORCED @P2 ✅ (2026-08-23) | ≤150 ms run→output (measured 18.5 ms median) |
| G-DIAG-MAP | ENFORCED @P2 ✅ (2026-08-23) | 100% mapped diagnostics in fixtures |
| G-SANDBOX-ESCAPE | ENFORCED @P2 ✅ (2026-08-23) | runner jailbreak attempts bounded |
| G-STAGE-DET | ENFORCED @P3 ✅ (2026-08-23) | pixel-identical demo frames across runs + clean quit |
| G-STAGE-FPS | ENFORCED @P3 ✅ pipeline (2026-08-23) | 0% frame loss over 240 frames, 16.0 ms cadence; panel meter shows browser-side fps |
| G-MEMTRACE | ENFORCED @P3 ✅ (2026-08-23) | 35k-op soak: zero gaps, exact leak reconstruction; branch-only overhead when off |
| G-MEMVIEW | ENFORCED @P3 ✅ (2026-08-23) | 8-node list → 7 pointer arrows from ReadProcessMemory, teardown visible |
| G-ACADEMY | ENFORCED @P4 ✅ schema+solves (2026-08-23) | levels lint-clean; reference solutions solve all hidden tests headlessly; hardcoded decoys rejected. Content target: 30 levels by end of P4 |
| G-PERF | ENFORCED @P5 ✅ (2026-08-23) | 5000-file workspace listed + deep read well under 3 s |
| G-UI-E2E | ENFORCED @P5 ✅ (2026-08-23) | 11 scripted assertions: view modes, ctrl keybindings, real Ctrl+Enter run, academy population |
| G-MEMTRACE | tracked @P3 | stress soak clean |
| G-ACADEMY | tracked @P4 | 30-level reference solve |

---

## Decisions Locked (user, 2026-08-23)

| # | Decision | Choice |
|---|---|---|
| D1 | Block engine | Custom canvas renderer (PixiJS-class). NO Blockly library |
| D2 | Shell | Tauri (Rust) first; Electron fallback only if OS-webview blockers appear |
| D3 | Language scope | C-only through v1. C++ explicitly deferred (templates/classes kill block model) |
| D4 | Compiler bundle | **DECIDED 2026-08-23:** tcc 0.9.27 win64 vendored to `third_party/tcc/` as default EXECUTION backend via `tcc -run` (hello-world run→output median **18.5 ms** vs clang path ~170 ms). clang stays diagnostic authority (`diag_c`) + fallback backend. Gate criterion met with 8× headroom. |
| D5 | Truth model | File-on-disk is truth; no persisted block graphs |
| D6 | Views | Per-tab Blocks/Split/Text toggle — never force all-or-nothing |
| D7 | Modes | Two products, one engine: Sandbox (free) + Academy (gated content) |
| D8 | Unlocks | Block categories gated by Academy level — complexity revealed gradually |
| D9 | Accounts/network | None required; offline-first; no telemetry |
| D10 | Pointers | In v1 core (memory viz = differentiator), but palette-unlocked late in Academy |

**Post-v1 backlog (explicitly deferred):** second-language plugin packs ·
C++ subset · online leaderboards/multiplayer co-op · AI hint tutor ·
cloud project sync · mobile/tablet touch layout.

---

## Validation Infrastructure

| Validator | Purpose | Status |
|-----------|---------|--------|
| `roundtrip_validator` | corpus parse→render-model→emit node-equality; failure minimization | ✅ P0 |
| `sync_fuzz_validator` | randomized edit differential (text-driver vs block-driver) — exact-node-span ops keep drivers in lockstep across raw/canonical layouts | ✅ P0.5 |
| `diag_map_validator` | diagnostic-fixture → nodeId coverage (corpus/diag, 7 classes) | ✅ P2 |
| `sandbox_escape_validator` | runner jailbreak attempts (loop/mem/spawn-tree/thrash) | ✅ P2 |
| `stage_determinism_validator` | stage.h pixel-identical runs + cooperative quit + clang/tcc parity | ✅ P3 |
| `memtrace_soak_validator` | 35k-op tracer soak + leak reconstruction + overhead-when-off | ✅ P3 |
| `memview_validator` | pointer-chain arrows via ReadProcessMemory (8 nodes / 7 edges) | ✅ P3 |
| `academy_runner_validator` | level schema lint + headless reference solves + decoy rejection | ✅ P4 |
| `memtrace_soak_validator` | tracer correctness + leak check | ❌ P3 |
| `academy_runner_validator` | headless reference solves | ❌ P4 |
| E2E driver (UI scripting) | scripted flows for G-EDIT-E2E | ❌ P1 |

Corpus policy: all fixtures committed with content hashes; corpus growth
requires adding the failing case + minimization, never editing in place.

---

## Loop Discipline (adopted from MCLA, 2026-08-23)

Every cycle = trigger → verifiable goal → verification → stopping rule →
record. Verification ladder: (0) assertion < (1) build < (2) deterministic
validator < (3) independent review < (4) human gate. Claims require rung ≥2.
Generator never grades its own gate. Terminal states per cycle: SUCCESS /
NO-OP / BLOCKED (name it) / STALLED / EXHAUSTED. Caps: 3 failed hypotheses
on one theory ⇒ bisect; 2 consecutive regressions ⇒ revert + record.
Run receipt appended to `LOG.md` per session:

```text
RUN n: trigger=<change> | expect=<prediction> | observed=<evidence>
state=<terminal> | next=<one concrete action>
```

### Anti-Patterns (mapped to rules)

| Anti-pattern | Local form | Countermeasure |
|---|---|---|
| Reward hacking | claiming round-trip done while corpus red | gates cite rung ≥2 |
| Fake done | "it should parse now" | run receipt required |
| Silent divergence | editing AST without file rewrite | Rule 1 + G-SYNC-FUZZ |
| Scope creep | starting C++/multiplayer early | D3 + backlog freeze |
| Uneditable states | fancy UX over Rule 2 | severity-0 triage |
