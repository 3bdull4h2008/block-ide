# Block-IDE

A Scratch-style block editor for **real C**, where the `.c` file on disk is
the single source of truth and blocks are a live, bidirectional projection of
its syntax tree. Compile + run with a sandboxed one-click Run; watch your
heap with live pointer arrows; learn through 30 Academy levels.

## Running the app

| You want | Command / path |
|---|---|
| Develop (hot reload) | `cd app && npm run app` — starts Vite + the app together |
| Just use it (fast) | `target\release\app.exe` after `npm run installer` or `cargo build --release -p app` |
| Install it | run `target\release\bundle\nsis\block-ide_*_x64-setup.exe` |

> **"localhost refused to connect"?** You launched a **debug** binary
> (`target\debug\app.exe`) directly. Debug builds contain no frontend — they
> load `http://localhost:5173`, which only exists while `npm run app`
> (`tauri dev`) is running. Use the release exe or the installed app instead.

## Build from source

```powershell
npm install --prefix app          # frontend deps
cargo build --release -p app      # backend (needs MSVC clang for stdio.h)
npm run installer --prefix app    # optional: NSIS setup.exe (bundles vendored tcc)
```

The execution backend is the vendored **tcc 0.9.27** (`third_party/tcc`,
~12 ms hello-world); system **clang** is the diagnostic authority and fallback.
Everything is offline-first — no accounts, no telemetry.

## Gates

`tools\run_gates.ps1` enforces 12 gates on every change (round-trip fidelity,
sandbox escapes, diag mapping, frame pipeline, memory tracer, academy solves,
perf...). All green as of v0.1.0 — receipts in [LOG.md](LOG.md), plan in
[PLAN.md](PLAN.md).

## Layout

- `crates/core-parser` — tree-sitter-c canonical AST, emitter, diag mapping
- `crates/runner` — job-object sandboxed compile+run, stage/memtrace IPC,
  academy level schema, validators
- `app` — Tauri 2 UI (PixiJS block canvas)
- `third_party/include` — `stage.h`, `memtrace.h`, vendored `fenster.h`
- `academy/worlds` — 30 TOML levels + reference solutions
