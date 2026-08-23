# LOG.md — Run Receipts (PLAN.md Loop Discipline)

```
RUN 19: trigger=UI redesign via stockmate opencode skills (ui-ux-pro-max +
ui-design-system), brief: Scratch inspiration, sea-blue primary
expect: claymorphism style (skill match for education/kids), sea palette,
offline-vendored fonts, blocks read as Scratch chunks
obs: skill search.py prescribed claymorphism (soft-3D, 3-4px borders,
double shadows, 16-24px radius, soft press) + ocean palette (#0891B2
primary/#ECFEFF foam/#164E63 ink) + Baloo 2/Comic Neue. Vendored 3 woff2
(72KB) instead of Google import - offline Rule 6. CSS token rewrite; blocks:
BORDER shade map + 3px outlines + two-tone containers (Scratch signature) +
inner highlight; pixi bg theme-aware; default theme now LIGHT. Verified via
CDP screenshot (light theme visually confirmed: sea-foam canvas, clay
buttons, two-tone blocks). Dark shot script race noted - dark uses same
token path proven in RUN 17. tsc clean, vitest 4/4, ALL TWELVE gates PASS.
Pushed ef4b8cc..115d66b.
state=SUCCESS | next: user eyes-on pass; block notch/puzzle shapes if wanted
```

```
RUN 18: trigger=P5 closeout: recovery drill gate, hint UX, boss art, installer
expect: crash journal proven via automated drill; hint button shows tier;
boss solution animates on stage; NSIS installer ships app + tcc offline
obs: journal seam split (write/read/clear _at(dir) fns) -> G-RECOVERY
integration test: kill-survival, torn-.tmp never shadows real file, atomic
rewrite clears stale tmp, blank entries never resurrect. Hint btn shows
"(n/3)" live count. w5-06 boss art: pulsing target rings, shots fly in
frame-by-frame w/ hit flashes - still solves 2/2 headless. Installer: fixed
dev identifier + window sizing, targets=[nsis], tcc vendored as Tauri
resource (bundle grew 2.3->2.6MB; NSIS script writes $INSTDIR\tcc which the
new exe-adjacent lookup finds). RELEASE build runs clean. ALL TWELVE gates
PASS exit 0. Gate 5 verdict: MET (vanilla-VM install drill remains manual).
state=SUCCESS | next: v1.0 punch list is MANUAL-ONLY: vanilla install drill,
keybinding E2E scripting, then repo first-commit + tag v0.1.0
```

```
RUN 17: trigger=P5 polish sweep: themes, keybindings, onboarding, crash
journal (P1.6 pulled forward), G-PERF
expect: light/dark themes persisted; Ctrl+Enter/F5 run; journal survives kill;
5k-file workspace opens <3s enforced
obs: CSS refactored to variables + Catppuccin Latte light theme, toggle
persisted. Journal = write-temp-then-rename JSON in app-data; boot restores
unsaved work with age notice; cleared on explicit save. Onboarding: 4-step
tour overlay. FOUND: list_c_files caps (2000 files/depth 5) silently
truncated big workspaces — lifted to 20k/12 to honor G-PERF's premise.
G-PERF NEW ENFORCED GATE: integration test walks 5000 files (+noise) in
~2s incl compile, deep read <100ms. Installer deferred (needs NSIS/WiX
download prep) — recorded in PLAN Gate 5 as PARTIAL. ALL TWELVE gates PASS,
tsc clean, vitest 4/4, app boots with tour+themes+journal.
state=SUCCESS | next: v1.0 punch list — kill -9 recovery drill, hint UX,
boss-battle art pass, installer machine setup
```

```
RUN 16: trigger=P4 bulk: content to 30 levels + profile store + academy UI loop
expect: 30 levels across 5 worlds solve headlessly; profile.json persists
XP/completions; palette gated by D8 unlock ladder; hints reveal in tiers
obs: authored 27 new levels+solutions. CONTENT BUGS caught by G-ACADEMY
lint: PS5.1 Set-Content wrote CP1252 em-dashes (invalid UTF-8) -> rewrote by
hand; literal-string hints broke on embedded ' -> switched quoting;
w2-03 solution missing; generator mangled """ starters -> hand-write rule.
LESSON: content is code - lint gates earn their keep. Profile store (JSON in
app-data, offline-first Rule 6) + UNLOCK_RULES ladder (control@3 loops@7
functions@12 structs@17 completions). App: Academy drawer (level select/
Load/Hint x3/Check) wired to hidden-test runner with first-pass XP awards;
palette chips lock/unlock live; XP badge in toolbar. ALL ELEVEN gates PASS,
tsc+vitest clean, app boots.
state=SUCCESS | next: boss battles visual polish + hint UX tiering + P5
polish (themes, keybindings, installer, perf)
```

```
RUN 15: trigger=P3 closeout (3.4 pointer arrows) + P4 kickoff (level format + runner)
expect: pointer arrows drawn from REAL child memory (ReadProcessMemory over
tracer-reconstructed heap); GATE 3 closed; academy levels lint + solve
headlessly with anti-hardcode decoys
obs: spawn_inspectable added (pid callback, ReadProcessMemory via
Win32_System_Diagnostics_Debug feature). FOUND SEAM BUG: prepare() staged
every program to the same main.c — academy decoy OVERWROTE the solution's
file before it ran; fixed with content-addressed staging (main-<fnv>.c).
memview: 8 boxes / 7 edges ALL at offset 8 (next field), teardown reaches
zero. stdin injection added to run_job (academy tests). G-MEMVIEW + G-ACADEMY
enforced: 3 seed levels (2 worlds) schema-clean, 7/7 hidden tests solved,
hardcoded decoy rejected by weak-test check. Gate-3 verdict MET (step mode →
P5, decision recorded). PS5.1 stderr quirk hardened in gates script.
ALL ELEVEN gates PASS exit 0; tsc clean; app boots on inspectable-run path.
state=SUCCESS | next: P4 bulk content to 30 levels + profile store (4.3) +
hint/palette unlock UI (4.5/D8)
```

```
RUN 14: trigger=P3 completion: G-STAGE-FPS measurement + memory tracer (3.3)
expect: zero-loss 60fps shm pipeline; macro-interposed memtrace → live heap
replay with exact leak detection; branch-only overhead when off
obs: FPS validator initially showed 19.9% "loss" — Windows Sleep granularity
(15.6ms) made the poller skip frames at 60fps production; spin-poll proves
pipeline: 240/240 frames, 16.0ms cadence, 0% loss (UI is latest-wins by
design). memtrace.h interposes malloc/free/calloc/realloc AFTER capturing
real fns, emits 40B events to 'Local\BlockIDEMemTraceV1' ring gated on
BLOCKIDE_MEMTRACE env; IDE prepends include to STAGED copy only (Golden Rule
1). FOUND+FIXED: reader wrap-guard inverted (wrapping_sub when behind →
instant break, 0 events); section-lifetime race (child died before attach →
hold-open Sleep in validator); validator compared printf's __LINE__ not the
alloc's — pinned per-line reports. SOAK: 35003 events, counts exact
(15002/15000/5001), gaps=0 dropped=0, replay reconstructs EXACTLY the 3
leaks w/ correct sizes+lines; overhead-when-off = one env branch (measured
delta is tcc parse of header once). UI: memory toggle → live heap box list +
end-of-run leak report in console. Gates: all NINE enforced PASS exit 0.
state=SUCCESS | next: P3 leftovers — pointer arrows/watch boxes (3.4),
step mode (3.5); then P4 Academy level format + runner
```

```
RUN 13: trigger=P3 kickoff: stage.h + stage panel (steps 3.1/3.2) + prior-art sweep
expect: deterministic pixel stage over named shm embedded in IDE; vendored
fenster.h as window layer per research (olive.c/fenster/picofb surveyed;
BLOCKGRAM/scrap/c-scratch all use custom parsers/VMs — our tree-sitter file-
as-truth approach stays differentiated)
obs: stage.h written (shm FB 'Local\BlockIDEStageV1', keys, xorshift random
keyed on frame → determinism, sprite/rect/pixel, fenster window mode behind
STAGE_WINDOW). runner::stage Rust reader/writer. App: async run model
(run_start/run_poll threads — UI stays live), base64 frame pump to canvas,
keydown/up→shm forwarding, stop button sets quit flag. FOUND+FIXED during
build: c_void pointer add() stride bug; StageReader Send/Sync for static
mutex; run_poll move-out-of-guard. G-STAGE-DET NEW ENFORCED GATE: two runs →
identical frame hashes (51ab386e… both), quitter exits 7 fast, clang backend
also builds stage demos. corpus/stage/bounce.c demo committed. tsc clean,
vitest 4/4, app.exe boots with stage UI.
state=SUCCESS | next: G-STAGE-FPS measurement in live panel; memory tracer
(3.3) design; then P4 Academy content pipeline
```

```
RUN 12: trigger=P2 closeout: G-RUN-HELLO bench + D4 toolchain decision
expect: run→output ≤150 ms via cached-env + hash-skip; tcc-class beats clang
per D4 criterion
obs: BASELINE 1.45 s/Run (vcvars64 called per click). Fixes: vcvars env
captured ONCE (cmd /C raw_arg quoting bug found by bench), direct clang
invocation, FNV source-hash compile skip. Clang then: cold 186 / edit 170 /
spam 18 ms. Vendored tcc 0.9.27 win64 (1.6 MB, third_party/tcc) → `tcc -run`
production median 18.5 ms. D4 LOCKED: tcc = execution backend; clang =
diagnostic authority + fallback. Bench initially mislabeled backends (run_c
already routed to tcc) — fixed with explicit clang_run comparison rows.
Gates: all SIX enforced PASS incl. G-RUN-HELLO, exit 0. P2 GATE MET;
step 2.5 clangd hovers deferred to P3 hover work.
state=SUCCESS | next: P3 — stage.h graphics library + stage panel (3.1/3.2),
memory tracer design (3.3)
```

```
RUN 11: trigger=P2 gate completion: G-DIAG-MAP fixtures + sandbox escape validator
expect: 7 diag-class fixtures map 100% diags→valid nodeIds; 5 jailbreak cases
terminate within deadline; gates wired into run_gates.ps1, exit 0
obs: FOUND LATENT BUG — clang echoes ABSOLUTE path in diagnostics; app's
strip_prefix("main.c") matched nothing ⇒ live block outlines were silently
empty since RUN 10. Fixed via shared parse_clang_diags (suffix anchor) +
toolchain.rs seam. FOUND RUNNER BUG — spawn_tree stalled 51s: read_to_end
blocked on pipe handles inherited by grandchildren while job close waited
behind it; fixed by dropping Job BEFORE draining pipes (5.1s). EOF diags now
backtrack to nearest subtree (missing-brace no longer surfaces root). runner
crate extracted from app (one owner of compile+run seam). Gates: G-BUILD+
G-ROUNDTRIP+G-EDIT-E2E+G-DIAG-MAP+G-SANDBOX-ESCAPE all PASS, exit 0.
state=SUCCESS | next: P2 closeout — G-RUN-HELLO latency bench + toolchain
bundle decision (D4), then P3 stage.h graphics library
```

```
RUN 1: trigger=P0 scaffold (workspace + core-parser + Vite/Tauri shell)
expect: parse→error-detect→sexp→verbatim-emit tests green on hello.c sample
observed: 4/4 cargo test PASS after u32 child-index fix + gap-stitching emitter
state=SUCCESS | next: corpus seeding + roundtrip_validator binary (step 0.5/0.6)
```

```
RUN 2: trigger=step 0.2 canonical node model (canonical.rs)
expect: stable preorder-dense ids, field capture, lossless emit from CTree alone
observed: 3 bugs found+fixed — double id-increment, cursor overwrite past
unclaimed gaps (stale lines), golden expectation missing anonymous ";" node.
Final: 8/8 cargo test PASS (lib 4 + canonical 4)
state=SUCCESS | next: step 0.4 clang-format canonical emitter; then 0.5 corpus harness
```

```
RUN 4: trigger=step 0.4 canonical emitter (emitter.rs)
expect: parse→reflow→clang-format deterministic; double-emission byte-identical;
mangled input == clean input after canonicalization
observed: 12/12 tests PASS incl. G-CANON-IDEMPOTENT + preproc line isolation.
Style pinned via repo .clang-format (LLVM base, Allman, 4w, col 100).
NOTE: reflow currently drops comments by design — restoration lands with
block-layer anchoring (P0.5 step 4 / G-COMMENT-SURVIVAL)
state=SUCCESS | next: step 0.5 corpus harness + roundtrip_validator binary
```

```
RUN 5: trigger=step 0.5 corpus harness + roundtrip_validator
expect: corpus good/* lossless-verbatim + idempotent-canonical; malformed/*
no-panic + error nodes; G-ROUNDTRIP enforced in gates runner
observed: 10/10 PASS (7 good incl. pointers/structs/switch/ugly_format,
3 malformed). Gates: G-BUILD + G-ROUNDTRIP green, exit 0
state=SUCCESS | next: FUN SLICE — palette drag-drop + Run button + console
(compressed P1.3+P2 vertical slice, user-directed priority)
```

```
RUN 6: trigger=FUN SLICE (compressed P1.3+P2): palette drag-drop, block move,
dblclick edit, canonicalize on edit, Run+console
expect: drop palette blocks into containers w/ indicator bar; drag existing
blocks to move; dblclick edits header slice; ▶ Run compiles via LLVM clang
and streams stdout/stderr/exit into console panel
observed: app.exe RUNNING. Text-centric mutation (splice source at byte
offsets → reparse → rebuild) keeps Golden Rule 1; clang-format normalizes all
inserts. Known v0 limits: prompt()-based editing, no snap ghosts, no sandbox
(trusted local runs), comments not yet re-emitted from reflow
state=SUCCESS | next: P1 remaining — undo/redo, tabs, save/load, E2E flows
```

```
RUN 7: trigger=P1 completion: undo/redo, folder workspace + file tree, tabs,
save (Ctrl+S), new-file, dialog plugin
expect: open any folder → .c files listed → tabs with dirty dots; block edits
undoable via Ctrl+Z/Y; saves persist to disk; path-escape guard on fs commands
observed: app.exe RUNNING. History = source snapshots w/ type-coalescing;
fs commands restricted to workspace root (no ParentDir/RootDir/Prefix);
tauri-plugin-dialog wired w/ dialog:default capability. TS build +
cargo check --workspace green
state=SUCCESS | next: P1 gate G-EDIT-E2E scripted flows, then P2 sandbox hardening
```

```
RUN 8: trigger=G-EDIT-E2E (vitest driving real pipeline via ctree_json/canon_c bins)
expect: loop program authored purely via drop-splices parses clean + canonical
idempotent; move op preserves validity + rejects self-drop; broken program
located via hit-test and fixed via applyEdit; deterministic layout
observed: FOUND REAL BUG — reflow joined string-literal sub-leaves with spaces
corrupting "%d\n" → " %d \n ". Fixed: strings/chars/system_lib_string now
atomic in collect_tokens + regression test. ALSO: missing-';' recovery nodes
carry kind ';' with is_missing FLAG, not kind MISSING — added CNode.missing +
fixed ctree_has_errors (+ test). 14/14 rust tests, 4/4 vitest.
Gates: G-BUILD+G-ROUNDTRIP+G-EDIT-E2E all PASS
state=SUCCESS | next: run_c MSVC env fix (clang stdio.h not found), then job-object sandbox
```

```
RUN 9: trigger=run_c compile failure: clang w/o vcvars can't find MSVC SDK headers
expect: Run button compiles+executes user code using BuildTools vcvars64 env
observed: build.bat now calls vcvars64 before clang; headless verify: hi + exit 0.
App restarted with fix. -W0 removed (warnings visible to learners)
state=SUCCESS | next: P2 proper — job-object sandbox (mem/CPU caps), diag mapping polish
```

```
RUN 10: trigger=P2 steps 2.2+2.4: Job Object sandbox + diagnostic→block mapping
expect: run_c child capped at 256MB via JOB_OBJECT_LIMIT_PROCESS_MEMORY with
KILL_ON_JOB_CLOSE; clang -fsyntax-only diags parsed, line:col→byte-offset→
deepest non-missing node mapped, red/amber outlines drawn on offending blocks
observed: windows-sys Job wired (assign after spawn, Drop closes handle).
diagmap.rs: half-open [start,end) containment (inclusive end matched earlier
siblings — boundary bug found by tests); zero-width missing tokens climb to
parent statement. 17/17 lib tests. Frontend overlay lives inside world container
(re-added post-clear) so outlines pan/zoom correctly. WS build green; app RUNNING.
state=SUCCESS | next: G-DIAG-MAP fixtures suite; escape-attempt validator (P2 gate);
then P3 Stage graphics library
```

```
RUN 3: trigger=step 0.3 read-only block renderer end-to-end
expect: type C in Tauri app → invoke parse_c → CTree JSON → blocks render on
PixiJS canvas; pan/zoom works
observed: serde derives added to CNode/CTree; tauri command parse_c moved to
own module (E0255 macro-namespace clash when inline); frontend blocks.ts
(kind→category mapping, compound_statement containers, comment stickies,
cached monospace measurement) + main.ts pan/zoom/zoom-to-cursor.
npm build + cargo check --workspace green; `app.exe` RUNNING w/ Block-IDE window
state=SUCCESS | next: step 0.4 clang-format canonical emitter; then 0.5 corpus harness
```
