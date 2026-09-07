# Cade (Block-IDE) — Complete Logic Map (Line-by-Line)

> Every function, event handler, and data flow path in the codebase.
> Line numbers refer to the CURRENT file state after all fixes.

---

## FILE: `app/src/main.ts` (3491 lines)

### SECTION 1: Imports & IPC Wrapper (lines 1–75)

```
Line   1–2:    Import pixi.js (Application, Container, Graphics, Text) and Tauri's invoke.
Line   4–9:    Create ipcStats object and ipcLog array, exposed on window.__ipc / window.__ipcLog
               for headless test drivers to inspect call counts.
Line  10–29:   invoke<T>(cmd, args) — wraps tauriInvoke:
                 - Increments rec.calls and rec.pending
                 - Logs "+Xms call cmd" to ipcLog
                 - On resolve: decrements pending, logs "+Xms ok   cmd (Yms)"
                 - On reject:  decrements pending, increments errs, logs "+Xms ERR  cmd"
                 - Returns the promise unchanged
Line  30:      Import open/save dialogs from @tauri-apps/plugin-dialog
Line  31–32:   Import getCurrentWindow from @tauri-apps/api/window; LogicalSize/LogicalPosition from dpi
Line  33–67:   Import from ./blocks (buildBlocks, harvestVars, layoutStack, findDropTarget,
               hitTestHeader, flatten, COLORS, BORDER, PAD, ROW_H, INDENT, measure, partWidth,
               BBlock, BlockPart, Cat, CNodeJSON, CTreeJSON)
Line  53:      Import History from ./history
Line  54:      Import spliceInsert, spliceMove, applyEdit, insertTopLevel from ./ops
Line  55:      Import pickAnchor, caretOffset, CaretAnchor from ./caret
Line  56–67:   Import from ./palette (PALETTE_GROUPS, VARIABLES_COLOR, validateSlotValue,
               validateVarName, SourceLang, reporterFits, varChips, varTypes, listChips, PaletteItem)
Line  68–74:   Import from ./academy-extras (nextMastery, masteryDue, masteryNextIn,
               previousLevel, MasteryState)
Line  75:      Import ./style.css (Vite CSS import)
```

### SECTION 2: DragPayload Interface & Sample Code (lines 77–133)

```
Line  77–90:   DragPayload interface — describes what's being dragged:
                 label: display text
                 snippet?: code to splice (statement chips)
                 cat?: category color key
                 move?: { start, end } — relocating existing code (not new)
                 slotValue?: reporter expression to fill a socket
                 slotKind?: 'round' | 'bool' — which socket shape
                 toplevel?: splice at file scope (function defs)
                 insertTop?: splice at very top (#includes)

Line  92–133:  Sample/template code constants:
                 SAMPLE (C hello-world with for loop)
                 NEW_TEMPLATE (C minimal hello)
                 CPP_SAMPLE (C++ hello-world with for loop)
                 CPP_TEMPLATE (C++ minimal hello)
```

### SECTION 3: DOM References & PixiJS Init (lines 135–170)

```
Line 135–143:  Grab DOM elements by ID:
                 srcEl        ← #src (textarea)
                 statusEl     ← #status (span)
                 hostEl       ← #canvas-host (div)
                 consoleEl    ← #console (pre)
                 consoleInputRow ← #console-input-row
                 consoleInput ← #console-input
                 paletteEl    ← #palette
                 tabsEl       ← #tabs
                 filesEl      ← #files

Line 145–152:  PixiJS bootstrap:
                 app = new Application()
                 await app.init({ resizeTo: hostEl, background: '#dff3fa', antialias: true })
                 hostEl.appendChild(app.canvas)
                 world = new Container()  → app.stage child #1 (block canvas)
                 overlay = new Container() → app.stage child #2 (diag highlights)
                 snapLayer = new Container() → (ghost previews during drag)

Line 154–162:  Diag interface: { line, col, severity, message, offset, node_id, node_kind }

Line 164–170:  Create and append dynamic DOM elements:
                 dropbar: div#dropbar — yellow insertion indicator bar
                 ghost: div#ghost — floating block preview during drag
```

### SECTION 4: Sound Effects (lines 172–206)

```
Line 172–193:  blip(freq, dur, type, gain) — Web Audio oscillator blip:
                 - Lazily creates AudioContext on first call
                 - Creates OscillatorNode + GainNode
                 - Sets frequency, type, gain envelope (exponential ramp to 0)
                 - Connects: oscillator → gain → destination
                 - Starts and stops oscillator
                 - Wrapped in try/catch (audio is best-effort)

Line 195–206:  toast(msg, kind, durationMs) — non-intrusive notification:
                 - Creates div.toast.toast-{kind}
                 - Appends to #toasts container
                 - After durationMs: adds .toast-exit class, removes on animationend
```

### SECTION 5: Global State Variables (lines 208–373)

```
Line 208–215:  Workspace state:
                 workspace: string | null — root folder path (null = standalone file)
                 savedSnapshot: string — last saved/loaded content (dirty baseline)
                 activePath: string | null — current file path
                 savedCache: Map<path, content> — loaded content per file (64-entry cap)
                 fileCache: Map<path, content> — open document content cache
                 files: string[] — workspace file list

Line 218–269:  Exit/close interception:
                 hasUnsavedChanges():
                   Returns true if: (file open AND content differs from snapshot)
                   OR (scratch buffer AND non-empty AND differs from language sample)
                 showExitDialog(): Promise<boolean>
                   Shows #exit-confirm overlay
                   Returns true if user clicks Quit, false if Cancel or overlay click
                 getCurrentWindow().onCloseRequested():
                   If exitHandled flag → return (prevent double-fire)
                   If hasUnsavedChanges(): preventDefault(), show dialog
                   If confirmed: destroy window; else: reset flag
                 beforeunload listener: preventDefault() if unsaved (web/dev mode)

Line 272–280:  langOf(path): maps file extension → SourceLang
                 .cpp/.cc/.cxx/.hpp/.hh → 'cpp'
                 .py/.pyw → 'python'
                 .js/.mjs/.cjs → 'javascript'
                 .rs → 'rust'
                 default → 'c'

Line 282–303:  Settings helpers:
                 readSetting<T>(key, fallback): reads localStorage `blockide-set-{key}`
                 writeSetting(key, val): writes localStorage
                 applySettings(): applies font, lineHeight, whiteSpace, tabSize to srcEl

Line 304:      activeLang: Lang = 'c' — current language

Line 306–358:  Sample code per language:
                 SAMPLES[lang] — full sample programs (shown on new session)
                 NEW_TEMPLATES[lang] — minimal starter templates

Line 360–362:  Core editor state:
                 src: string = SAMPLE — current buffer content
                 roots: BBlock[] = [] — parsed block tree (rebuilt on each render)
                 hist: History — undo/redo stack

Line 364–373:  SlotHit interface + slotHits array:
                 { block, part, x, y, w, h } — editable socket hit boxes in world coords
                 Rebuilt on every render() call
```

### SECTION 6: Dirty Tracking, Tour Hooks, setSrc (lines 375–396)

```
Line 375–382:  markDirty():
                 Compares src vs savedCache.get(activePath)
                 Toggles .dirty class on the matching tab element
                 Toggles .active class on all tabs
                 Calls updateTitle()

Line 384–387:  tourHooks: { advance?: (ev) => void }
                 Context-aware tour: hooks fire on real user actions, not timers

Line 389–396:  setSrc(next, kind='op'): Promise<void>
                 Pushes current src onto undo history
                 Updates src and srcEl.value
                 Calls render(next) and markDirty()
                 Returns the render promise
```

### SECTION 7: Render Pipeline (lines 398–465)

```
Line 398–402:  renderGen counter — latest-wins rendering:
                 Each render() call increments gen
                 If a newer render completes, the stale one returns early

Line 404–465:  async render(source):
                 gen = ++renderGen
                 Invoke Tauri: invoke('parse_c', { src: source, lang: activeLang })
                   → Returns { tree: CTreeJSON, has_errors: boolean }
                 If gen !== renderGen: return (stale)
                 roots = buildBlocks(out.tree) — convert parse tree → BBlock[]
                 layoutStack(roots, 40, 40) — compute x, y, w, h for every block
                 Walk tree to collect:
                   kinds: Set<string> — all node kinds in the program
                   includes: Set<string> — all #include directives
                 harvestVars(out.tree.root) — extract variable declarations
                 Build paletteSignature from kinds + includes + vars
                 If signature changed: re-render palette (new blocks/vars appeared)
                 Clear world, rebuild slotHits[]
                 Draw every block: for (b of roots) drawBlock(b)
                 Re-add overlay and snapLayer as world children
                 Set status text: "parsed clean" or "parsed with errors"
                 On error: set status to error message
                 Finally: if this render is still newest AND srcEl.value changed,
                   re-render with the newest buffer (nothing skipped)
```

### SECTION 8: Canonicalization (lines 467–493)

```
Line 467–493:  canonicalize():
                 Snapshots buf = src, lang = activeLang
                 Invoke: invoke('canonicalize_c', { src: buf, lang })
                   → Returns clean: string (formatted code)
                 If clean differs AND buffer hasn't moved on:
                   Capture caret anchor from current position
                   Call setSrc(clean) — reformats code
                   On next frame: restore caret position via caretOffset()
                 After canonicalize: calls refreshDiags()
```

### SECTION 9: Diagnostics Overlay & Panel (lines 495–569)

```
Line 495–518:  drawDiagOverlay(ds: Diag[]):
                 Clears overlay container
                 For each diagnostic:
                   Find blocks whose byte range contains the diagnostic offset
                   Pick the smallest block (fewest pixels)
                   Draw a roundRect stroke (red for error, yellow for warning)

Line 520–544:  renderDiagList(ds: Diag[]):
                 Stores in lastDiags
                 Updates #diag-count text
                 If panel is hidden: skip rendering rows
                 For each diagnostic: create button.diag-row with severity icon + location + message
                 Click on row → jumpToOffset(d.offset)

Line 546–557:  jumpToOffset(offset):
                 Switch to split view
                 Focus srcEl, select the line at offset
                 Scroll to center the line

Line 559–569:  refreshDiags():
                 Invoke: invoke('diag_c', { src, lang: activeLang })
                 Calls drawDiagOverlay() and renderDiagList()
```

### SECTION 10: Block Rendering Geometry (lines 571–767)

```
Line 571–577:  mixWhite(c, f): blends color c toward white by fraction f

Line 579–584:  Geometry constants:
                 NX=10 (mouth/tab x offset), TW=18 (tab width), TD=4.5 (tab depth), BR=8 (corner radius)

Line 586–604:  statementPath(g, ox, oy, w, h): draws a Scratch-style statement block shape
                 Top edge: rounded corners → tab mouth recess → straight → tab recess → rounded
                 Bottom edge: straight → tab protrusion → straight → rounded corners

Line 606–618:  cHeaderPath(g, ox, oy, w, h): draws a C-block header (top half only, no bottom mouth)

Line 620–634:  cBodyPath(g, ox, oy, w, top, h, close): draws the C-block body (below header)
                 Right wall → bottom tab → left wall → optional close

Line 636–767:  drawBlock(b: BBlock): renders one block onto the PixiJS canvas
                 Color lookup: fill = COLORS[b.cat], edge = BORDER[b.cat]

                 IF sticky (comment):
                   Draw roundRect fill + stroke
                   Create Text with label (dark text on yellow)
                   Attach header events, add to world, return

                 Draw clay drop shadow: roundRect(x+2, y+4, w, h+TD) with alpha 0.18

                 IF container (C-block / if / for / while):
                   Draw body: cBodyPath → fill with mixWhite(fill, 0.62) (lighter)
                   Draw header: cHeaderPath → fill with fill color
                   Draw highlight strip: white alpha 0.4
                   Stroke header: 3px edge color
                   Stroke body: 3px edge color

                 ELSE (flat statement):
                   Draw shadow again
                   Draw statementPath → fill
                   Draw highlight strip: white alpha 0.35
                   Stroke: 3px edge color

                 Render header content (parts array):
                   IF no parts: single Text with label or nodeKind (white text)
                   IF has parts: iterate parts, lay out left-to-right:
                     'text': white Text at cx
                     'bool': hexagonal box (6-point polygon) with dark text → register in slotHits
                     'round'/'ident'/'number'/'string': rounded rect box with dark text → register in slotHits
                     Advance cx by partWidth + 7px gap

                 Draw category notch: small dark rect at (x+5, y+5, 5, min(ROW_H-10, h-10))

                 Add all Graphics + Text children to world
                 Set eventMode='static', attach header drag events
                 Recursively drawBlock() for all children
```

### SECTION 11: Coordinate Transform & Drag System (lines 769–1110)

```
Line 769–771:  screenToWorld(ox, oy): converts screen coords → world coords
                 x = (ox - world.x) / world.scale.x
                 y = (oy - world.y) / world.scale.y

Line 773–819:  startHtmlDrag(e, payload):
                 Stores payload in global `drag`
                 Creates a PixiJS Container with block shape + text in snapLayer
                 Shows HTML ghost div (floating preview)
                 Registers pointermove → onDragMove, pointerup → onDragEnd (once)
                 Plays blip(520) sound

Line 821–837:  catColor(cat): maps category string → hex color number

Line 839–879:  drawSnapGhost / clearSnapGhost: translucent block preview at drop position

Line 881–908:  slotUnderWorldPoint / nearestCompatibleSlot:
                 Hit-tests editable sockets by world coordinates
                 nearestCompatibleSlot: finds matching-shape socket on the block under point

Line 910–1001: onDragMove(e): pointermove handler during drag
                 Updates ghost position
                 Converts to world coords
                 IF dragging a reporter chip (slotValue):
                   Find compatible socket → highlight it with orange outline
                   Ghost opacity = 1 (snapped) or 0.5 (not snapped)
                 ELSE (statement/toplevel drag):
                   findDropTarget → find insertion point
                   Draw yellow dropbar at insertion position
                   Draw translucent snap ghost preview

Line 1003–1005: isInsideRange(inner, outer): checks if block range is inside another range

Line 1007–1090: onDragEnd(e): pointerup handler — commit the drag
                 Remove event listeners, hide ghost/dropbar/snapLayer
                 If dropped outside canvas: return (cancel)

                 CASE 1: Reporter chip → commitSlotValue(socket, value)
                 CASE 2: Toplevel (function def) → insertTopLevel(src, roots, snippet)
                 CASE 3: Include chip → prepend to file
                 CASE 4: Statement/variable → findDropTarget → spliceInsert or spliceMove
                 After each: setSrc(), canonicalize(), tourHooks.advance('edit'), blip()

Line 1092–1110: attachHeaderEvents(obj, b):
                 pointerdown on block header → startHtmlDrag with move payload
                 Filters right-click (button !== 0)
                 Converts PixiJS global coords → client coords for the drag
```

### SECTION 12: Inline Slot Editor (lines 1112–1191)

```
Line 1112–1127: commitSlotValue(s, raw):
                  Validates raw value against slot type via validateSlotValue()
                  If invalid: returns error string
                  If valid and changed: splice into src at slot's byte range
                  Calls canonicalize()

Line 1129–1176: Slot editor (Scratch-style inline input):
                  Creates <input#slot-editor> element, appended to body
                  openSlotEditor(s): positions input over the socket in screen coords
                  closeSlotEditor(commit): if commit, calls commitSlotValue()
                  Enter → commit, Escape → cancel, blur → commit
                  Invalid input → reopens with .bad class (shake animation)

Line 1178–1191: slotAt(b, wx, wy): finds the editable slot on block b at world coords
```

### SECTION 13: Double-Click Edit (lines 1193–1208)

```
Line 1193–1208: hostEl dblclick handler:
                  Convert to world coords, hit-test header
                  Skip sticky (comments)
                  If clicked on a slot: openSlotEditor(slot) — inline edit
                  Else: window.prompt('Edit statement:', label) — full replacement
                  applyEdit(block, replacement)(src) → setSrc() + canonicalize()
```

### SECTION 14: Run/Stage System (lines 1210–1522)

```
Line 1210–1212: Run button click → startRun()

Line 1214–1233: Stage state:
                  stageCanvas, stageCtx (2d context)
                  stopBtn, fpsEl
                  running, lastFrame, pollTimer, fpsFrames, fpsT0
                  u32max = 4294967295 (sentinel for "no frame yet")
                  downKeys: Set<number> — currently pressed keys

Line 1235–1260: keyToCode(e): maps KeyboardEvent → numeric key code
                  Arrow keys → 1-4, printable ASCII → char code
                  isTextEntryTarget(e): returns true if target is textarea/input/findbar/filter

Line 1262–1278: Keyboard forwarding to running program:
                  keydown: if running AND not text entry → invoke('stage_keys', { down })
                  keyup: delete from downKeys, invoke('stage_keys', { down })

Line 1280–1304: paintStage():
                  invoke('stage_frame', { last: lastFrame })
                  Returns { frame, w, h, b64 } or null
                  Decode base64 → ImageData → OffscreenCanvas → drawImage to stage canvas
                  Track FPS every 500ms

Line 1306–1324: finishRun(r):
                  Display stdout + stderr + exit code in console
                  If in blocks view: switch to split (off-ramp — show generated code)

Line 1326–1390: startRun():
                  Set console to "running..."
                  Clear keys, set running=true, show stop button + stdin row
                  Check memTrace checkbox → set lastMemState
                  Invoke 'run_start' with { src, traceMem, lang }
                    On error: reset state, show error, return
                  If tracing: invoke 'mem_attach' → startMemPoll()
                  Invoke 'stage_attach'
                  Start paintStage loop (requestAnimationFrame)
                  Start pollTimer (120ms interval):
                    invoke('run_poll')
                    If result: stop everything, finishRun(), reportLeaks()
                    On error: stop everything, show error

Line 1392–1414: Console stdin:
                  sendConsoleLine(): read input → invoke('run_stdin', { line })
                  Enter key or send button → sendConsoleLine()

Line 1416–1518: Memory view:
                  MemBox/MemEdge/MemState interfaces
                  renderMemView(): builds HTML heap boxes + SVG pointer arrows
                  startMemPoll(): 150ms interval → invoke('mem_state') → renderMemView()
                  reportLeaks(): after run ends, report live allocations

Line 1520–1522: Stop button → invoke('stage_stop')
```

### SECTION 15: Context Menu (lines 1524–1580)

```
Line 1524–1580: Right-click context menu on blocks:
                  Creates div#ctx-menu, appended to body
                  hostEl contextmenu: hit-test block, show menu with "Duplicate" / "Delete"
                  Duplicate: slice block code, insert after it
                  Delete: remove entire line from source
                  Click outside / Escape → hide menu
```

### SECTION 16: Workspace & Tab System (lines 1583–1932)

```
Line 1583–1612: Path utilities:
                  isWinPath(p): checks for Windows absolute path (C:\ or /)
                  baseName(p): last path component
                  dirName(p): parent directory
                  normSlashes(p): backslash → forward slash
                  asRelInWorkspace(abs): converts absolute to workspace-relative
                  fsRead(p): routes to read_file (relative) or read_abs (absolute)
                  fsWrite(p, c): routes to write_file or write_abs

Line 1614–1651: refreshFiles():
                  invoke('list_c_files', { root: workspace }) → string[]
                  Group files by directory, sort dirs (root first)
                  Create .file-dir headers + .file items
                  Click on file → guardedOpenTab(f)

Line 1653–1692: createTab(path, content):
                  Remove duplicate tab if path already open
                  Cache content in fileCache + savedCache
                  Evict oldest entries if cache > 64
                  Create .tab element with .tab-label + .tab-x (close button)
                  Click → guardedOpenTab, middle-click → closeTab
                  Append to tabsEl, call activateTab()

Line 1696–1721: closeTab(path):
                  If active: confirmDiscard()
                  Remove tab element, delete from caches + tabViews
                  If was active: activate next tab, or reset to scratch buffer

Line 1706–1717: confirmDiscard():
                  If empty or matches sample: return true (no discard needed)
                  If file open and matches snapshot: return true
                  Otherwise: ask() dialog, return boolean

Line 1714–1728: guardedOpenTab(path): confirmDiscard() → openTab()
                  openTab(rel): if already open → activateTab()
                  Otherwise: fsRead() → createTab(), push to recents

Line 1730–1743: activateTab(rel):
                  Reset history, clear caret anchor
                  Set activePath, activeLang (from langOf)
                  Load src from fileCache, set as savedSnapshot
                  Set srcEl.value, renderPalette(), render(), markDirty()
                  Restore per-tab view mode

Line 1745–1855: Toolbar button handlers:
                  open-folder: openDialog({ directory: true }) → set workspace, refreshFiles()
                  open-file: openDialog with file filters → openTab(abs path)
                  new-file: language selector modal → name prompt → write file → openTab()

Line 1857–1932: Save system:
                  saveActive(saveAs=false):
                    If no file open and not save-as: show message
                    If save-as: saveDialog() → write to new path
                    Else: write to current path
                    On success: update caches, savedSnapshot, markDirty(), clear journal
                    Push to recents, statusFlash('Saved'), toast('Saved'), blip()
                  Ctrl+S → saveActive(), Ctrl+Shift+S → saveActive(true)
```

### SECTION 17: Keyboard Shortcuts (lines 1934–2055)

```
Line 1934–1969: Global keyboard handler:
                  Ctrl+S → save (shift for save-as)
                  Ctrl+W → close tab
                  Ctrl+F → open find bar
                  Ctrl+H → open find+replace
                  Ctrl+Z → undo (if not shift)
                  Ctrl+Y / Ctrl+Shift+Z → redo

Line 1971–1986: Textarea event handlers:
                  input → hist.push(src, 'type'), update src, render, markDirty
                  scroll → sync world.y with textarea scroll fraction (split mode)
                  blur → canonicalize() (format on blur)

Line 1988–2055: Text editor key handling:
                  Tab (no selection): insert 2 spaces, or outdent 2 on Shift+Tab
                  Tab (with selection): indent/outdent every touched line
                  Enter: auto-indent matching previous line's indent
                  If line ends with { or : → add 4 more spaces
                  If next char is } → brace expansion: {\n<indent+4>\n<indent>}
                  trimmedEndsWithOpener(line): checks for { or : at end
```

### SECTION 18: Pan & Zoom (lines 2057–2095)

```
Line 2057–2095: Canvas interaction:
                  Pan: pointerdown on empty canvas → track delta → update world.x/y
                  Zoom: wheel event → scale around mouse position
                  app.stage.eventMode='static', hitArea=app.screen
                  pan starts only if pointerdown didn't hit a block header
```

### SECTION 19: Palette Rendering (lines 2097–2531)

```
Line 2097–2122: Variable state:
                  knownVars: string[] — user-created variable names (from localStorage)
                  knownLists: string[] — user-created list names
                  varTypesMap: Record<string, string> — type per variable
                  harvestedVars: string[] — variables declared in current file
                  paletteSignature: string — hash of kinds+includes+vars (detects palette changes)

Line 2124–2152: makeReporterChip(item): creates oval/hex reporter chip element
                  Sets up pointerdown → startHtmlDrag with slotValue payload

Line 2154–2240: Variable chips and menus:
                  makeVarChip(item, list): creates variable chip
                  Right-click → openVarMenu(): rename/delete menu
                  rename: window.prompt → validate → update knownVars/knownLists
                  delete: window.confirm → splice from array

Line 2245–2424: renderPalette():
                  Clears paletteEl
                  Creates category rail (#pal-rail) with colored dots
                  For each PALETTE_GROUPS group:
                    Add colored group header
                    Add rail dot (click scrolls to section)
                    For each item: addChip(item)
                      Filter by active language
                      Check dependency gates (requires.kind, requires.include)
                      Create .pal element with category color
                      pointerdown → startHtmlDrag (or show dependency error)
                  Variables section (C/C++ only):
                    "Make a Variable" button → window.prompt name + type
                    "Make a List" button → window.prompt name
                    varChips for each known + harvested variable
                    listChips for each list
                  Scroll tracking: active rail dot follows scroll position
                  applyPalFilter(), preserve scroll position
                  renderPaletteLocks()

Line 2426–2531: Keyboard palette navigation:
                  palFilter input → applyPalFilter(): hides non-matching chips
                  ArrowDown/ArrowUp → navigate visible chips
                  Enter → keyboardActivateChip(el): splice snippet at caret
                  Escape → clear filter, focus textarea
```

### SECTION 20: Academy System (lines 2533–2730)

```
Line 2533–2561: Academy state:
                  ProfileOut, LevelInfo interfaces
                  xpBadge, levelSelect, hintBtn elements
                  profile, hints, hintTier
                  levelSols: Record<id, solution> — ownership chaining
                  mastery: Record<id, MasteryState> — spaced repetition

Line 2563–2573: Mode system (sandbox | academy):
                  appMode persisted in localStorage
                  setMode(): sets data-mode attribute, renders palette locks
                  sandbox: everything unlocked
                  academy: categories gated by profile.unlocked

Line 2575–2593: renderPaletteLocks():
                  For each palette chip: lock if academy mode AND category not unlocked

Line 2586–2611: refreshProfile/refreshLevels:
                  invoke('profile_get') → XP + completed levels
                  invoke('academy_levels') → level list for dropdown

Line 2613–2684: Academy actions:
                  Level Load: invoke('academy_load', { levelId }) → starter + hints
                    Ownership chaining: seed from previous level's solution
                    masteryDue() check → spaced review reminder
                  Hint button: reveal next hint tier
                  Check button: invoke('academy_check', { levelId, src })
                    If passed: record solution, promote mastery, refresh profile
                    If failed: show which tests failed
```

### SECTION 21: View Modes (lines 2732–2800)

```
Line 2732–2765: Semantic caret system:
                  caretAnchor: anchors caret to a parse node (id + edge + kind + text)
                  captureCaret(): stores anchor from current selection
                  restoreCaret(): resolves anchor against current parse tree
                  anchorToBlock(b): sets anchor to a block the user interacted with

Line 2767–2796: View modes:
                  ViewMode = 'split' | 'blocks' | 'text'
                  setView(v): captures caret, sets appEl.dataset.view, restores caret
                  Per-tab view preference in tabViews map
                  Graduate button: setView('text') — off-ramp to real code
```

### SECTION 22: Theme, Splash, Window Controls (lines 2798–3250)

```
Line 2798–2812: Theme:
                  setTheme(t): sets data-theme, updates button, saves to localStorage
                  Toggle button switches light/dark

Line 2814–3104: Splash screen:
                  wireSplash():
                    renderRecentProjects() — reads localStorage, creates .recent-item elements
                    initSplashSettings() — wires all setting controls to localStorage
                    initSplashSidebar() — sidebar nav, language card selection, start buttons
                    initAcademyCarousel() — auto-advancing 3-slide carousel
                    showSplashPanel('splash-sandbox')
                  beginSession(lang, mode): hides splash, initializes editor
                  beginFromRecent(entry): opens recent project

Line 3106–3250: Window controls + About + Find/Replace + Drag/Drop files
                  splash-quit → getCurrentWindow().close()
                  tb-minimize → minimize
                  tb-maximize → toggleMaximize
                  tb-close → close
                  Window state: save/restore position, size, maximized
                  About dialog: brand logo click → show, overlay click → hide
                  Shortcuts dialog: show-shortcuts → show, close-shortcuts → hide
                  Find/Replace: full implementation (computeHits, showHit, replaceOne, replaceAll)
                  Drag-drop files: onDragDropEvent → open each as tab
```

### SECTION 23: Keybindings & Final Wiring (lines 3250–3491)

```
Line 3250–3340: Global keybindings:
                  F5 / Ctrl+Enter → run
                  Ctrl+B → toggle sidebar
                  Ctrl+1/2/3 → view modes
                  / → focus palette filter
                  Ctrl+/ → toggle shortcuts dialog

Line 3342–3390: Onboarding tour:
                  TOUR_STEPS array: Welcome → Drag → Run → Academy
                  Each step has optional 'until' event
                  tourHooks.advance(ev): auto-advance when user performs the action

Line 3391–3491: Final wiring:
                  Accent color persistence
                  Debug hooks (window.__hitAt, __blocksShape, __slots, etc.)
                  refreshProfile(), refreshLevels(), setMode(), renderPalette()
```

---

## FILE: `app/src/blocks.ts` (533 lines)

### Data Structures

```
Line   1–19:   CNodeJSON: { id, kind, field, named, missing, start, end, pre, text, children }
               CTreeJSON: { root: CNodeJSON, tail: string, lang: string }

Line  21–55:   Block types:
               Cat = 'function' | 'control' | 'statement' | 'variables' | 'comment' | 'error' | 'structs'
               BlockPart = { type: PartType, text, start, end }
               PartType = 'text' | 'ident' | 'number' | 'string' | 'bool'
               BBlock = { id, nodeKind, label, parts, cat, sticky, container, children,
                         start, end, headerEnd, x, y, w, h }
```

### Language Shape Maps

```
Line  57–129:  LANG_SHAPES: per-language config
               c:     body='compound_statement', controls=if/for/while/do/switch, fns=function_definition
               cpp:   body='compound_statement', controls=same as C, fns+classes(class/struct)
               python: body='block', controls=if/for/while/try/with, fns=function_definition, classes=class_definition
               js:    body='statement_block', controls=if/for/for_in/while/do/switch/try, fns=function_declaration
               rust:  body='block', controls=if/if_let/match/loop/while/while_let/for, fns=function_item, classes=struct/enum
```

### Core Functions

```
Line 137–148:  isBrace(n): true if unnamed node with text '{' or '}'
               leafText(n): recursive concatenation of pre+text for all leaves
               collapse(s): whitespace → single space, trim

Line 150–157:  findCompound(n): depth-first find first child with kind === SHAPE.body

Line 159–189:  fieldedBodies(n): children where field is 'body'/'consequence'/'alternative'
               headerLeaves(n, skip): collect leaf tokens in HEADER region only
                 Skips: bodies, comments, braces, stray whitespace
                 Slot kinds: identifier→'ident', number_literal→'number', string_literal→'string'

Line 191–214:  conditionSlot(n): extract control condition as hex socket
                 if/while/switch: parenthesized_expression → inner spans between parens
                 for/do: bare expression node

Line 216–246:  buildHeader(n, skip, barrier?): convert header leaves → BlockPart[]
                 Merge adjacent text parts (unless crossing barrier)
                 Return { parts, label }

Line 248–261:  categorize(kind): map tree-sitter node kind → Cat
                 ERROR/MISSING→error, functions→function, controls→control, classes→structs
                 comments→comment, *_statement/declaration/expression_statement→statement

Line 263–328:  toBlock(n: CNodeJSON): BBlock — the core conversion
                 Determine cat, bodies, compound, container
                 Container = control statement OR has compound body (not comment)
                 Build children from bodies (recurse)
                 Build header parts from headerLeaves
                 If control: add conditionSlot as hex socket
                 Return BBlock with all fields

Line 330–337:  stackFrom(parent): iterate children, skip braces, toBlock each

Line 339–342:  buildBlocks(tree): set SHAPE, call stackFrom(tree.root)

Line 344–371:  harvestVars(root): walk tree, collect identifiers under declaration nodes
                 Only init_declarator, array_declarator, pointer_declarator children

Line 373–438:  Layout:
               CHAR_W=8.4, PAD=14, ROW_H=34, GAP_Y=10, INDENT=30
               measure(label): cached width = max(90, label.length * CHAR_W + PAD * 2)
               glyphWidth(s): raw width = max(6, s.length * CHAR_W)
               partWidth(p): text→glyphWidth+6, bool→48-260, round→36-240
               headerWidth(b): sum of partWidths + gaps + PAD
               layoutStack(blocks, x, y):
                 For each block: set x, y
                 If container: recurse children at (x+INDENT, y+ROW_H+GAP_Y)
                 Width = max(headerWidth, innerW + INDENT)
                 Height = ROW_H + GAP_Y + innerBottom - (y+ROW_H+GAP_Y) + GAP_Y
                 Flat blocks: w=headerWidth+PAD, h=ROW_H

Line 440–497:  flatten(blocks): recursive flatten tree → flat array
               findDropTarget(roots, wx, wy):
                 Visit all containers, find smallest containing the point
                 Compute insertion index by child midpoints
                 Compute byte offset for the insertion point
               hitTestHeader(roots, wx, wy):
                 Find deepest block whose header row contains the point

Line 511–533:  Color palettes:
               COLORS: function=0x7c5ce0, control=0xffab19, statement=0x0891b2,
                       variables=0xff8c1a, comment=0xffe9a8, error=0x94a3b8, structs=0xec4899
               BORDER: darker shades of each
```

---

## FILE: `app/src/palette.ts` (379 lines)

```
Line   1–22:   PaletteItem interface:
               name, cat, snippet, reporter?, toplevel?, top?, langs?, requires?

Line  35–270:  PALETTE_GROUPS: 7 category groups
               Control: if/else/case/try (per language)
               Loops: for/while/do-while (per language)
               Operators: round reporters (+−×÷%), hex reporters (==!=<>≤≥&&||!)
               Code: #include, printf/scanf/cout/cin (C/C++), print/input (Python),
                     console.log/let (JS), println!/let mut (Rust), assign, return
               Functions: call/define (per language)
               Structs: field access, define class/struct
               Notes: // comment or # comment

Line 272–292:  Variable validation:
               IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
               RESERVED = set of C keywords (int, char, return, if, etc.)
               validateVarName(raw): checks IDENT + not reserved

Line 294–337:  varChips(name, type): per-variable palette chips
               declaration chip, oval reporter, set chip, change chip
               listChips(name): element reporter, array declaration, set element

Line 339–379:  Slot validation:
               validateSlotValue(type, raw):
                 ident: indexed identifier or arithmetic expression
                 number: numeric literal, identifier, or arithmetic
                 bool: any non-empty text (let parser catch real errors)
                 string: auto-quote if not already quoted
               reporterFits(kind, socket): bool→bool socket, round→ident/number socket
```

---

## FILE: `app/src/ops.ts` (77 lines)

```
Line   6–14:   cutRange(text, range): remove range, return { text, snippet }

Line  16–23:   adjustOffset(offset, cut): shift offset if after cut
               overlaps(offset, range): check if offset is inside range

Line  25–49:   spliceInsert(text, offset, snippet, autoIndent):
               If pre doesn't end with newline: add newline prefix
               If autoIndent (Python): copy indent from current line
               If post doesn't start with newline: add newline suffix

Line  51–61:   spliceMove(text, move, rawOffset):
               If overlaps: return null (can't move into self)
               Cut range, adjust offset, spliceInsert at new position

Line  63–65:   applyEdit(b, replacement): returns function that replaces block text
               text.slice(0, start) + replacement + text.slice(headerEnd)

Line  67–77:   insertTopLevel(src, rootEnds, snippet):
               Append after last top-level block (or EOF if empty)
```

---

## FILE: `app/src/caret.ts` (92 lines)

```
Line   9–18:   CaretAnchor: { id, edge, offset, kind?, text? }
               Anchors caret to a parse node, not a byte offset

Line  22–52:   resolve(blocks, anchor):
               1. Match by kind + normalized text (survives re-parses)
               2. Match by exact node id (valid within one parse)
               3. Nearest surviving block by distance

Line  57–75:   pickAnchor(blocks, off):
               Find deepest block containing offset
               Return { id, edge, offset, kind, text }

Line  81–92:   caretOffset(blocks, len, anchor):
               Resolve anchor against current parse
               Return clamped byte position
```

---

## FILE: `app/src/history.ts` (38 lines)

```
Line   1–38:   History class:
               past: string[] (undo stack, 200 cap)
               future: string[] (redo stack)
               push(prev, kind): coalesces typing bursts within 900ms
               undo(current): pop past, push future, return previous
               redo(current): pop future, push past, return next
               reset(): clear both stacks (on tab switch)
```

---

## FILE: `app/src/academy-extras.ts` (44 lines)

```
Line   8–33:   MasteryState: { box: 1..5, last: unix seconds }
               MASTERY_INTERVALS_DAYS = [1, 3, 7, 14, 30]
               nextMastery(m, now): promote box, stamp time
               masteryDue(m, now): true if interval elapsed (box 5 never due)
               masteryNextIn(m): human-readable "3 days" or "mastered"

Line  35–44:   previousLevel(levels, id): find level before this one in authored order
               Used for ownership chaining (level N seeds from N-1 solution)
```

---

## FILE: `app/src/style.css` (1737 lines)

### Token System (lines 1–88)

```
Line   6–23:   @font-face: Baloo 2 (400-800) + Comic Neue (400, 700)
Line  25–28:   *, margin:0, box-sizing:border-box
Line  30–67:   :root CSS custom properties — light theme:
                 --sea-100 through --sea-900 (sea palette)
                 --bg, --bg-panel, --bg-deep, --bg-editor, --border, --fg, --fg-dim
                 --accent, --accent-deep, --accent-soft, --ok, --warn, --yellow, --teal
                 --radius-sm/md/lg, --clay-border, --shadow-clay, --press
Line  69–88:   :root[data-theme='dark'] overrides for dark mode
```

### Layout (lines 90–215)

```
Line  90–96:   body: Comic Neue font, bg color, 100vh, overflow hidden
Line 102–107:  #app: CSS Grid — 3 columns (216px 420px 1fr) × 3 rows (48px 1fr 196px)
Line 109–163:  #toolbar: flex, brand logo + nav + actions
Line 165–196:  button global styles: claymorphism (shadow, radius, hover/active)
Line 198–215:  #status.ok/.warn, #sidebar
```

### Palette (lines 239–540)

```
Line 245–330:  .pal: Scratch puzzle clip-path, hover lift, category colors
Line 338–408:  .pal-group: colored category headers
Line 410–496:  .pal-hex, .pal-reporter, .pal-operators: reporter shapes
Line 497–540:  #academy sidebar section
```

### Editor (lines 540–630)

```
Line 540–545:  #main-col: flex column, border
Line 547–600:  .tab: border-top rounding, active/dirty states
Line 602–613:  #src: textarea styling (font, padding, caret color)
Line 615–628:  #canvas-host: background, grab cursor
```

### Console & Stage (lines 630–784)

```
Line 630–710:  #console-wrap, #diag-bar, .diag-row, #console: dark console styling
Line 712–784:  #stage-wrap, #stage-head, #stage, #mem-list: stage panel
```

### Overlays (lines 814–884)

```
Line 814–836:  #ghost, #dropbar: drag helpers
Line 838–884:  #tour, #tour-card: onboarding overlay
```

### Splash Screen (lines 889–1370)

```
Line 889–910:  #splash: fixed full-screen overlay, backdrop blur
               #splash-window: 720×460 modal, border-radius, shadow
Line 918–957:  #splash-titlebar: drag region, win-controls (CLOSE ONLY)
Line 960–1032: #splash-body, #splash-sidebar, .sidebar-row
Line 1034–1079: #splash-content, .splash-panel, .panel-inner
Line 1083–1160: .lang-grid, .lang-card, .hero-btn
Line 1161–1280: .carousel, .recent-item, .splash-recent-empty
Line 1292–1370: .settings-scroll, .settings-group, .settings-toggle, .color-dot
```

### View Modes (lines 1475–1582)

```
Line 1475–1509: #view-modes: split/blocks/text buttons, sandbox mode hides academy
Line 1511–1539: #slot-editor: inline editing overlay
Line 1541–1576: #app[data-view='blocks'] and #app[data-view='text'] grid overrides
```

### Scrollbar, Selection, Run (lines 1586–1679)

```
Line 1586–1628: ::-webkit-scrollbar, ::selection, #src focus, canvas grab
Line 1630–1648: #run (green), #theme-toggle, #xp-badge
Line 1658–1679: #ctx-menu: right-click context menu
```

### Toast Notifications (lines 1700+)

```
Line 1700+: .toast, .toast-success/error/info, toast-in/toast-out animations
```

---

## FILE: `app/index.html` (428 lines)

```
Line  1–9:     <!doctype html>, <head> with charset, favicon, viewport, title
Line 10–321:   #splash overlay:
                 #splash-window → #splash-titlebar (text + close button)
                                 → #splash-body → #splash-sidebar (4 nav buttons)
                                                → #splash-content (4 panels: sandbox/academy/recent/settings)
Line 322–398:  #app main layout:
                 #toolbar (brand + nav + actions + win controls)
                 #sidebar (#files + #pal-filter + #palette + #academy)
                 #main-col (#tabs + #src textarea + #findbar)
                 #canvas-host (PixiJS)
                 #console-wrap (#diag-bar + #diag-list + #console)
                 #console-input-row
                 #stage-wrap (#stage-head + canvas#stage + #mem-list)
Line 399–425:  Dialogs: #exit-confirm, #tour, #about (with shortcuts button)
Line 426:      <script type="module" src="/src/main.ts">
```

---

## DATA FLOW SUMMARY

```
User types in textarea
  → srcEl 'input' event
  → hist.push(src, 'type')
  → src = srcEl.value
  → render(src)
    → invoke('parse_c', { src, lang }) → Rust core-parser
    → CTreeJSON returned
    → buildBlocks(tree) → BBlock[]
    → layoutStack(roots, 40, 40) → x,y,w,h computed
    → drawBlock() for each → PixiJS Graphics
    → harvestVars → renderPalette() if signature changed
    → refreshDiags() → drawDiagOverlay() + renderDiagList()
  → markDirty()
  → updateTitle()

User drags palette chip onto canvas
  → pointerdown on .pal → startHtmlDrag(e, payload)
  → ghost shown, snapLayer preview created
  → pointermove → onDragMove → findDropTarget, draw dropbar + snap ghost
  → pointerup → onDragEnd
    → spliceInsert/spliceMove/spliceMove → new source text
    → setSrc(next) → hist.push + render + markDirty
    → canonicalize() → invoke('canonicalize_c') → format code
    → refreshDiags()

User clicks Run
  → startRun()
    → invoke('run_start', { src, traceMem, lang })
    → stage_attach → paintStage loop (rAF)
    → pollTimer (120ms) → invoke('run_poll')
    → finishRun() → display output
```

---

## BUGS FIXED (ALL 10)

| # | Bug | Fix |
|---|-----|-----|
| 1 | Splash controls scoped globally, minimize/maximize nonsensical on overlay | Scoped CSS to `#splash-window`, removed min/max, added toolbar controls |
| 2 | Scratch buffer discard not guarded | confirmDiscard() now checks scratch changes |
| 3 | Redundant `=== true` | Removed |
| 4 | Missing `data-view` on #app | Added `data-view="split"` |
| 5 | Memory timer cleanup inconsistent | Defensive cleanup |
| 6 | Triple clearInterval | Consolidated |
| 7 | Missing `data-mode` on #app | Added `data-mode="sandbox"` |
| 8 | About dialog closes on card click | Added stopPropagation |
| 9 | Splash inline display | Documented |
| 10 | Settings not applied on startup | Expanded applySettings() |

## NEW FEATURES ADDED

1. **Toast Notification System** — Non-intrusive success/error/info toasts
2. **Keyboard Shortcuts Help** — Full reference grid (Ctrl+/ or via About)
3. **Window State Persistence** — Save/restore position, size, maximized
4. **Accessibility (ARIA)** — role, aria-label, aria-live on key elements
5. **Main App Window Controls** — Proper minimize/maximize/close in toolbar
