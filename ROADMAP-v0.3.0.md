# Cade v0.3.0 Roadmap

> **Goal**: Transform Cade from a functional block editor into a polished, scalable, education-first IDE with full multi-language support.

---

## Completed (as of 2026-09-08)

### Phase 1 — Foundation & QoL ✅
- Q2: CodeMirror 6 syntax highlighting (C/C++/Python/JS/Rust/Go/Java/TypeScript)
- Q7: Auto-save + crash recovery
- Q9: Command palette (Ctrl+Shift+P)
- Q10: Right-click context menus
- Q12: Block comments (Ctrl+/)
- Q14: Resizable panels
- Native window controls (minimize/maximize/close)
- Toast notification system
- Keyboard shortcuts help dialog (Ctrl+/)
- Window state persistence

### Phase 2 — Multi-Language Parity ✅
- Go: Palette blocks, CodeMirror, diagnostics (`go build`), sample programs
- Java: Palette blocks, CodeMirror, diagnostics (`javac`), sample programs
- TypeScript: Palette blocks, CodeMirror (via JS), diagnostics (`tsc --noEmit`)
- Dynamic palette filtering per language
- Native diagnostics for all 8 languages

### Phase 3 — Academic Features ✅ (partial)
- A1: Visual Code Execution Tracer — C interpreter with step-through, variable inspector, line highlighting
- A9: Concept-mastery badges (5 badges)
- A11: Daily streak tracking (UTC-normalized)
- Leitner spaced-repetition mastery system

---

## Phase 1 — Foundation & Quality of Life (Weeks 1–3)

### 1.1 Editor Core

| # | Feature | Complexity | Details |
|---|---------|-----------|---------|
| Q1 | **Autocomplete / Intellisense** | Medium | LSP integration for each language. Show completions as user types in text mode. C/C++: clangd. Python: pylsp. JS: typescript-language-server. Rust: rust-analyzer. |
| Q2 | **Syntax highlighting in text mode** | Low | Replace raw textarea with CodeMirror 6 or Monaco. Token-based coloring, bracket matching, auto-close brackets. |
| Q3 | **Inline error markers** | Low | Pipe language-server diagnostics to squiggly underlines + problem panel. Already partially done for C/C++ via clang — extend to all languages. |
| Q4 | **Find & Replace (regex)** | Low | Already exists — extend with regex toggle, file-scope vs project-scope, match count. |
| Q5 | **Minimap** | Low | CodeMirror 6 minimap plugin or custom PixiJS overview strip. |
| Q6 | **Multi-file tabs** | Medium | Currently single-file. Add tab bar, dirty-dot indicators, close/save per tab. Store open files in state array. |
| Q7 | **Auto-save + recover** | Low | Debounced save to localStorage every 2s. Session recovery on crash (Tauri `data-dir`). |
| Q8 | **Bracket matching highlight** | Low | CodeMirror 6 built-in or PixiJS highlight overlay. |

### 1.2 UX Polish

| # | Feature | Complexity | Details |
|---|---------|-----------|---------|
| Q9 | **Command palette (Ctrl+Shift+P)** | Medium | Fuzzy-searchable list of all actions. Already have shortcuts dialog — extend to full palette. |
| Q10 | **Right-click context menus** | Medium | Context-aware menus on blocks (duplicate, delete, comment, collapse), on canvas (paste, undo), on files (rename, delete). |
| Q11 | **Block collapse / fold** | Medium | Collapse compound blocks (for, while, if) to a single summary line. Reduces visual noise for large programs. |
| Q12 | **Block comments** | Low | Comment/uncomment blocks. Visually dimmed, preserved across round-trips. |
| Q13 | **Export as image** | Low | `canvas.toDataURL()` or `html2canvas` for stage + blocks. PNG/SVG export. |
| Q14 | **Resizable panels** | Low | Drag-dividers between palette, blocks, text, stage, console. Store sizes in state. |
| Q15 | **Splash screen language quick-pick** | Low | Grid of language cards on splash — click to start immediately (already exists, polish it). |

### 1.3 File System

| # | Feature | Complexity | Details |
|---|---------|-----------|---------|
| Q16 | **Project folder support** | High | Currently single-file. Add `open-folder` Tauri command, tree view in sidebar, watch for external changes. |
| Q17 | **File creation/deletion/rename** | Medium | Tree view context menu actions. Sync with workspace JSON store. |
| Q18 | **Import from GitHub URL** | Medium | `git clone` via Tauri shell, open in project folder. |

---

## Phase 2 — Multi-Language Parity (Weeks 3–6)

### 2.1 Language Gaps to Close

Currently C is the reference language (production-ready). C++ is beta. Python, JS, Rust are alpha.

| Gap | Priority | Languages Affected | Approach |
|-----|----------|-------------------|----------|
| **Diagnostics overlay** | Critical | Python, JS, Rust | Integrate language servers: `pylsp` (Python), `typescript-language-server` (JS), `rust-analyzer` (Rust). Pipe diagnostics to block markers + problem panel. |
| **Missing palette blocks** | High | Python (no `return`), Rust (no `try/catch`, no `?` operator), JS (no `async/await` blocks) | Add language-specific blocks to palette.ts per-category. |
| **Error handling blocks** | High | Rust (`Result`, `?`, `match`), Python (`except`, `finally`) | Add try/catch/except/finally/Result blocks with proper nesting. |
| **Memory tracing** | Medium | C++ only currently | Extend `memtrace.h` interposition to C++ builds. Python/JS/WASM — not applicable (managed memory). |
| **Canonical formatting** | Medium | Python, JS, Rust | Python: `black` via Tauri command. JS: `prettier`. Rust: `rustfmt`. Pipe to canonical formatter on save. |

### 2.2 New Language: Go

| Aspect | Implementation |
|--------|---------------|
| Parser | `tree-sitter-go` grammar |
| Compilation | `go run` via PATH probe |
| Diagnostics | `gopls` LSP |
| Palette | `func`, `if`/`else`, `for`/`range`, `switch`/`case`, `defer`, `go`, `chan`, `struct`, `interface`, `fmt.Print`, `fmt.Scan`, `make`, `len`, `cap` |
| Sample | Hello world with goroutine |

### 2.3 New Language: TypeScript (strict JS)

| Aspect | Implementation |
|--------|---------------|
| Parser | `tree-sitter-typescript` grammar |
| Compilation | `ts-node` or `tsx` via PATH |
| Diagnostics | `typescript-language-server` |
| Palette | JS palette + `type`, `interface`, `enum`, `namespace`, `as`, `keyof`, `typeof` blocks |
| Sample | Typed function with interface |

### 2.4 New Language: Java

| Aspect | Implementation |
|--------|---------------|
| Parser | `tree-sitter-java` grammar |
| Compilation | `javac` + `java` via PATH |
| Diagnostics | `jdtls` (Eclipse JDT) LSP |
| Palette | `class`, `public static void main`, `System.out.println`, `Scanner`, `if`/`else`/`for`/`while`/`switch`, `try`/`catch`, `extends`, `implements`, `interface` |
| Sample | Hello world class |

### 2.5 Palette System Redesign

Current palette is a flat list with category tabs. Redesign for scalability:

```
palette.ts
├── categories[]          → { id, label, icon, languages: Lang[] }
│   ├── universal/        → operators, control-flow (all languages)
│   ├── io/               → print, scan, console (lang-specific)
│   ├── variables/        → declare, assign, arrays (C/C++ typed, others untyped)
│   ├── functions/        → define, call, return, async
│   ├── classes/          → struct, class, interface, enum
│   ├── memory/           → pointers, heap (C/C++ only)
│   └── advanced/         → concurrency, error handling, modules
├── items[]               → { id, label, category, languages, shape, codeTemplate }
└── renderPalette(lang)   → filter by lang, group by category, insert into sidebar
```

Key changes:
- Each block declares which languages it supports (already partially done)
- Categories are language-aware (show/hide per language)
- New "Advanced" category for concurrency, error handling, modules
- Block search in palette (type to filter)

---

## Phase 3 — Academic / Learning Features (Weeks 5–8)

### 3.1 Core Learning Mechanics

| # | Feature | Complexity | Details |
|---|---------|-----------|---------|
| A1 | **Visual Code Execution Tracer** | Medium | Step-by-step: highlight current block, show variables pane, call stack, output. Instrumented runtime (Python: `sys.settrace`, JS: V8 inspector, C/C++: GDB/LLDB `--interp`). State stored in `TraceStep[]` with block-id, variables snapshot, stack depth. |
| A2 | **Progressive Hint Escalation** | Medium | 4-tier Socratic coaching: (1) directional nudge, (2) approach sketch, (3) pseudocode, (4) full walkthrough. Escalate on consecutive failures. Hints stored per-block-type in JSON. |
| A3 | **Predict-Observe-Explain (POE)** | Medium | Before running: "What will this output?" → student types prediction → run → compare → "Why did it happen?" (free text, AI-scored). Builds conceptual understanding, not just code-writing. |
| A4 | **Mastery-Based Progression** | High | Bayesian Knowledge Tracing per concept. Concepts unlock only after ≥80% mastery proof. Prevents "move on before understanding." Requires concept DAG + BKT model per node. |

### 3.2 Adaptive Learning

| # | Feature | Complexity | Details |
|---|---------|-----------|---------|
| A5 | **Spaced Repetition Review Queue** | Medium | FSRS (Free Spaced Repetition Scheduler) for concepts. Surfaces due-for-review problems ranked by predicted recall probability. Integrate with existing mastery system. |
| A6 | **Adaptive Difficulty Routing** | High | Track per-skill Elo ratings weighted by runtime/memory efficiency. Route through prerequisite DAG. Detect struggling vs. oscillating patterns (Wald-Wolfowitz test). |
| A7 | **Personalized Curriculum Generation** | Medium | Onboarding: 4 questions (background, goals, language, level) → generate custom learning path with escalating difficulty. LLM + structured JSON output. |
| A8 | **Stuckness Detection** | Low-Med | Monitor repeated failures on same step. Auto-escalate hints. Show "Try a different approach" nudges after 3+ failures on same block. |

### 3.3 Gamification That Works

| # | Feature | Complexity | Details |
|---|---------|-----------|---------|
| A9 | **Concept-Mastery Badges** | Low | Badges for demonstrating understanding, not completing steps. Tied to mastery thresholds. E.g., "Loop Master" = solve 5 loop problems at ≥90% accuracy without hints. |
| A10 | **Efficiency-Weighted Scoring** | Medium | O(n) solution under 60ms = 1.5× multiplier. Memory-hungry brute force penalized. Re-solving old problems = 0 (anti-farming). |
| A11 | **Meaningful Daily Streak** | Low | Count consecutive days of mastery-level practice. Hint-assisted solves don't earn streak bonuses. |
| A12 | **Weekly Challenges** | Medium | Time-limited challenges testing applied knowledge. Difficulty scales. Auto-generated from concept bank. |

### 3.4 Feedback & Assessment

| # | Feature | Complexity | Details |
|---|---------|-----------|---------|
| A13 | **Error Root-Cause Analysis** | Medium | Real-time logic error detection with friendly messages + fix suggestions. Pattern matching + LLM explanation. Teaches debugging, not just "error on line X." |
| A14 | **Parsons Problems as Scaffold** | Medium | When stuck, offer drag-and-drop block arrangement as alternative. Reduces cognitive load while maintaining learning gains. |
| A15 | **Knowledge Radar Dashboard** | Medium | Visual radar chart of proficiency across domains (Arrays, Strings, Loops, etc.) with weak-topic coaching recommendations. |
| A16 | **Subproblem Decomposition** | Medium | Hard problems auto-decompose into labeled subgoals with progress tracking per subgoal. |

### 3.5 Teacher Features (Future)

| # | Feature | Complexity | Details |
|---|---------|-----------|---------|
| A17 | **Live Student Workspace Preview** | High | Teacher dashboard showing every student's workspace in real-time. WebSocket sync. One-click co-debugging. |
| A18 | **Help Interaction Timeline** | Low-Med | Chronological log of hints shown/skipped, scaffolds used per student. Formative assessment tool. |

---

## Phase 4 — Logic Rewrite & Architecture (Weeks 6–10)

### 4.1 main.ts Decomposition

Current `main.ts` is ~3500 lines — a god module. Decompose into:

```
app/src/
├── main.ts              → bootstrap only (~200 lines): init, event wiring, startup
├── core/
│   ├── state.ts         → global state (src, running, roots, activeLang, etc.)
│   ├── history.ts       → undo/redo (move from root)
│   ├── settings.ts      → readJsonStore/writeJsonStore delegation
│   └── events.ts        → typed event bus (replaces ad-hoc DOM events)
├── editor/
│   ├── palette.ts       → palette definitions + rendering (enhance current)
│   ├── blocks.ts        → PixiJS block rendering (move from root)
│   ├── canvas.ts        → canvas interaction (pan, zoom, hit-test)
│   ├── drag.ts          → drag-and-drop logic (startHtmlDrag, snap, etc.)
│   ├── ghost.ts         → ghost/preview rendering
│   ├── caret.ts         → semantic cursor anchoring (move from root)
│   └── operators.ts     → operator block definitions
├── langs/
│   ├── c.ts             → C-specific palette blocks, sample program
│   ├── cpp.ts           → C++ specifics
│   ├── python.ts        → Python specifics
│   ├── js.ts            → JavaScript specifics
│   ├── rust.ts          → Rust specifics
│   ├── go.ts            → Go specifics (new)
│   ├── java.ts          → Java specifics (new)
│   └── typescript.ts    → TypeScript specifics (new)
├── ui/
│   ├── toasts.ts        → toast notifications
│   ├── shortcuts.ts     → keyboard shortcuts dialog
│   ├── findbar.ts       → find & replace
│   ├── console.ts       → console I/O
│   ├── stage.ts         → stage rendering + run loop
│   └── dialogs.ts       → exit confirm, about, settings, tour
├── features/
│   ├── tracer.ts        → visual execution tracer (A1)
│   ├── hints.ts         → hint escalation system (A2)
│   ├── mastery.ts       → mastery tracking + badges (A4, A9)
│   ├── spaced-rep.ts    → spaced repetition queue (A5)
│   └── scoring.ts       → efficiency scoring (A10)
└── utils/
    ├── audio.ts         → blip presets + future sounds
    ├── styles.ts        → WHITE_LABEL, DARK_LABEL, theme tokens
    └── dom.ts           → DOM helper functions (el, show, hide, etc.)
```

### 4.2 Type System Overhaul

```typescript
// types.ts — single source of truth
interface PaletteBlock {
  id: string
  label: string
  category: CategoryId
  languages: Lang[]
  shape: 'stack' | 'reporter' | 'boolean' | 'hat' | 'cap'
  codeTemplate: Record<Lang, string>  // per-language code generation
  inputs?: InputDef[]
 _colour?: string  // override category color
  tooltip?: string
}

interface BlockNode {
  id: string
  kind: string      // references PaletteBlock.id
  fields: FieldValue[]
  children: BlockNode[]
  parent?: BlockNode
}

interface CTreeJSON {
  // tree-sitter CST from Rust backend
  children: CTreeJSON[]
  text: string
  type: string
  named: boolean
}

type Lang = 'c' | 'cpp' | 'python' | 'javascript' | 'rust' | 'go' | 'java' | 'typescript'
type CategoryId = 'control' | 'io' | 'variables' | 'functions' | 'classes' | 'operators' | 'memory' | 'advanced'
type BlockShape = 'stack' | 'reporter' | 'boolean' | 'hat' | 'cap'
```

### 4.3 Canvas Rendering Rewrite

Current canvas uses a mix of PixiJS Application and raw `Container` objects. Standardize:

```typescript
// canvas.ts
class EditorCanvas {
  app: Application
  worldContainer: Container   // pans/zooms
  gridLayer: Container        // background grid
  blockLayer: Container       // rendered blocks
  ghostLayer: Container       // drag previews
  selectionLayer: Container   // selection rectangles
  
  constructor(canvasEl: HTMLCanvasElement)
  panBy(dx: number, dy: number): void
  zoomAt(factor: number, pivot: Point): void
  screenToWorld(screen: Point): Point
  worldToScreen(world: Point): Point
  hitTest(world: Point): BlockNode | null
  destroy(): void
}
```

### 4.4 Block Rendering Pipeline

```
Source Code
  ↓ (Rust tree-sitter parse)
CST (CTreeJSON)
  ↓ (buildBlocks)
BlockNode[]
  ↓ (renderBlocks — layout pass)
BlockSprite[] (PixiJS Containers with hit areas)
  ↓ (drawBlock — paint pass)
Canvas display
```

Current issues to fix:
- `drawBlock()` is 128 lines with 7 nested functions — decompose into `drawStackBlock`, `drawReporterBlock`, `drawBooleanBlock`
- `measure()` uses global cache with no eviction — already fixed (cap at 200)
- `startHtmlDrag()` is 95 lines — extract `computeSnapTargets()`, `animateSnap()`, `finalizeDrop()`

### 4.5 CSS Architecture

Move from flat `style.css` to CSS modules or BEM naming:

```
style.css (root tokens + reset)
├── layout.css           → grid, sidebar, panels
├── palette.css          → palette items, categories
├── blocks.css           → block chips, labels, shapes
├── stage.css            → canvas, run controls
├── editor.css           → textarea, findbar, console
├── dialogs.css          → modals, tour, about
└── themes.css           → light/dark variables
```

### 4.6 State Management

Replace scattered global variables with a typed state object:

```typescript
// state.ts
interface AppState {
  // Editor
  src: string
  lang: Lang
  dirty: boolean
  files: FileRecord[]
  activeFile: string
  
  // Canvas
  panX: number
  panY: number
  zoom: number
  
  // Run
  running: boolean
  stdout: string
  errors: Diagnostic[]
  
  // UI
  theme: 'light' | 'dark'
  sidebarTab: 'palette' | 'files' | 'mastery'
  consoleVisible: boolean
}

const state: AppState = { /* defaults */ }
const listeners: Map<keyof AppState, Set<() => void>> = new Map()

function setState<K extends keyof AppState>(key: K, value: AppState[K]): void {
  state[key] = value
  listeners.get(key)?.forEach(fn => fn())
}
```

---

## Phase 5 — Polish & Ship (Weeks 9–12)

| # | Task | Details |
|---|------|---------|
| P1 | **Performance audit** | Profile parse → render pipeline. Target: <100ms for 500 blocks. Cache tree-sitter parses. Debounce re-renders. |
| P2 | **Accessibility audit** | WCAG 2.1 AA. Keyboard-only block editing (Blockly v13 style). Screen reader announcements for block operations. |
| P3 | **Onboarding flow** | First-launch tour → language picker → sample program → "Run your first program" guided experience. |
| P4 | **Error recovery** | Graceful handling of: missing compiler, network offline, corrupt save file, tree-sitter parse failure. |
| P5 | **Testing** | Unit tests for: palette filtering, block layout, code generation, history operations. Integration tests for: parse → render → run pipeline. |
| P6 | **Documentation** | User guide (Markdown), API docs for block definitions, contribution guide for adding new languages. |
| P7 | **CI/CD** | GitHub Actions: lint → typecheck → test → build → release. Auto-publish on tag push. |
| P8 | **Extension system** | Plugin API: custom blocks, custom palettes, custom compilers. JSON manifest + runtime loader. |

---

## Implementation Priority Matrix

| Phase | Effort | Impact | Ship Order |
|-------|--------|--------|-----------|
| Phase 1: QoL (editor, UX, files) | 3 weeks | High | **First** — makes daily use pleasant |
| Phase 2: Multi-language parity | 3 weeks | High | **Second** — broadens audience |
| Phase 4: Logic rewrite | 4 weeks | High | **Third** — enables everything else |
| Phase 3: Academic features | 3 weeks | Medium-High | **Fourth** — differentiator |
| Phase 5: Polish & ship | 3 weeks | Medium | **Last** — production quality |

**Total estimated effort**: ~12 weeks for one developer, ~6 weeks with 2.

---

## Language Support Roadmap

| Language | Current | v0.3.0 Target | Key Additions |
|----------|---------|---------------|---------------|
| **C** | Production | Production | Autocomplete, LSP diagnostics |
| **C++** | Beta | Production | Memory tracing, autocomplete |
| **Python** | Alpha | Production | Diagnostics (pylsp), `return` block, `except`/`finally`, autocomplete |
| **JavaScript** | Alpha | Production | Diagnostics (tsserver), `async/await`, `class` blocks, autocomplete |
| **Rust** | Alpha | Beta | Diagnostics (rust-analyzer), `Result`/`?`, `match` blocks, `impl`/`trait` |
| **Go** | None | Alpha | New language: tree-sitter-go, `gopls` diagnostics, goroutine/channel blocks |
| **Java** | None | Alpha | New language: tree-sitter-java, `jdtls` diagnostics, class/main blocks |
| **TypeScript** | None | Alpha | New language: tree-sitter-typescript, type/interface/enum blocks |

---

## Success Metrics

| Metric | Current | v0.3.0 Target |
|--------|---------|---------------|
| Languages supported | 5 | 8 |
| Languages with diagnostics | 2 (C, C++) | 8 (all) |
| Palette blocks per language | ~30 | ~50 |
| TypeScript lines | ~6000 | ~15000 (after rewrite) |
| Test coverage | 43 tests | 200+ tests |
| Parse → render latency (500 blocks) | Unknown | <100ms |
| Accessibility score | Partial ARIA | WCAG 2.1 AA |

---

*This roadmap is a living document. Priorities shift based on user feedback and research findings.*
