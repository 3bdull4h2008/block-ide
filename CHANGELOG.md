# Changelog

## 0.2.0 — 2026-08-26

Multi-language packs, commercial save/load, and a hardening sweep.

### Added
- **Python, JavaScript, Rust language packs** alongside C/C++: per-language
  grammars (tree-sitter), palettes with split logic operators
  (`and/or/not` vs `&&/||/!`), interpreter/rustc backends detected at
  runtime, splash language cards, per-language new-file templates.
- **Commercial save model**: explicit Save (Ctrl+S) / Save As
  (Ctrl+Shift+S); standalone New File / Open File via native dialogs with no
  folder required; unsaved-changes guards on every navigation; dirty dot in
  the window title; crash journal reduced to a close-time checkpoint with
  **five rotating backup snapshots** and boot-time salvage.
- **Academy**: ownership chaining (level N starts from your own N−1
  solution) and spaced mastery (Leitner boxes, ⟳review markers).
- **Context-aware onboarding tour** — steps close when you actually perform
  the action.
- **Off-ramp ladder** — every run reveals the real code from Blocks view;
  🎓 Graduate button switches to code.
- **Keyboard-first palette** — `/` focuses filter, type-to-filter,
  arrow-key highlight, Enter splices through existing seams.
- **Find & Replace** (Ctrl+F / Ctrl+H) in the text editor.
- **Diagnostics panel** — scannable problem list above the console; click to
  jump to the offending line (console now keeps program output only).
- **Drag & drop** source files onto the window to open them as tabs.

### Fixed
- Tauri sync commands ran on the main thread — one slow call (clang-format
  on blur) froze ALL IPC. Every command is now async; the eternal-spinner
  class of bugs is gone.
- Render race: rapid edits could leave blocks showing an older program than
  the text pane (latest-wins rendering).
- Comment stickies and error mystery blocks rendered blank — they show raw
  text now.
- Tab key stole focus in the text editor — it indents/outdents; Enter
  auto-indents with brace/colon expansion.
- Gate flake: killed runs left dirty journals that restored over the sample.

### Internal
- Toolchain probes memoized (py/js/rust run latency down ~100-300 ms).
- Title-bar IPC throttled to real transitions; doc caches capped at 64.
- Gates rebuild dist+release before UI-E2E and sweep stray process locks.
- Absolute-path document IO guarded (traversal/drive-relative rejected).

## 0.1.0 — 2026-08-25

First tagged build: C block IDE with round-trip fidelity gates, sandboxed
tcc execution (~18 ms hello-world), stage panel, memory visualizer with
pointer arrows, 30-level Academy, NSIS installer.
