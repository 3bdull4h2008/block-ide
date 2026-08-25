# Cade

A Scratch-style block editor for **real programming languages** — C, C++,
Python, JavaScript, Rust — where the file on disk is the single source of
truth and blocks are a live, bidirectional projection of its syntax tree.
Break the code or break the blocks: they stay in sync. One-click sandboxed
compile+run (vendored tcc, clang, python, node, rustc — detected at
runtime); a visual Stage; a memory view that draws your pointers as arrows;
and a 30-level Academy with XP, unlocks, spaced review, and levels that
start from *your own* previous solution.

## Running the app

| You want | Command / path |
|---|---|
| Develop (hot reload) | `cd app && npm run app` — starts Vite + the app together |
| Just use it (fast) | `target\release\app.exe` after `npm run installer` or `cargo build --release -p app` |
| Install it | run `target\release\bundle\nsis\Cade_*_x64-setup.exe` |

> **"localhost refused to connect"?** You launched a **debug** binary
> (`target\debug\app.exe`) directly. Debug builds contain no frontend — they
> load `http://localhost:5173`, which only exists while `npm run app`
> (`tauri dev`) is running. Use the release exe or the installed app instead.

## Build from source

```powershell
npm install --prefix app          # frontend deps
cargo build --release -p app      # backend (C/C++ need MSVC clang for headers)
npm run installer --prefix app    # optional: NSIS setup.exe (bundles vendored tcc)
```

Execution backends are detected on the machine: vendored **tcc 0.9.27**
(`third_party/tcc`, ~12 ms hello-world) for C, system **clang** for C++
diagnostics + fallback, **python / node / rustc** from PATH for their
languages (missing toolchain = friendly console hint). Everything is
offline-first — no accounts, no telemetry. Crash-safety: every edit lands in
a journalled autosave that rotates five backup snapshots.

## Gates

`tools\run_gates.ps1` enforces 14 gates on every change (round-trip fidelity,
edit-model fuzzing, sandbox escapes, diagnostic mapping, frame pipeline,
memory tracer, academy solves, perf, scripted UI end-to-end...). All green —
receipts in [LOG.md](LOG.md), plan in [PLAN.md](PLAN.md), competitive
analysis in [docs/COMPETITOR-RESEARCH.md](docs/COMPETITOR-RESEARCH.md).

## Layout

- `crates/core-parser` — tree-sitter canonical ASTs (c/cpp/python/js/rust),
  emitter, diag mapping
- `crates/runner` — job-object sandboxed compile+run, stage/memtrace IPC,
  academy level schema, validators
- `app` — Tauri 2 UI (PixiJS block canvas, per-language palettes)
- `third_party/include` — `stage.h`, `memtrace.h`, vendored `fenster.h`
- `academy/worlds` — 30 TOML levels + reference solutions
- `logos/` — brand lockups (see [branding/README.md](branding/README.md))
