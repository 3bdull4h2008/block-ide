# Cade (Block-IDE) — Complete Logic Map (Line-by-Line)

> Every function, variable, event handler, CSS rule, and HTML element.
> Line numbers refer to the CURRENT file state after all fixes.

---

## FILE: `app/src/main.ts` (3493 lines)

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

### SECTION 4: Sound Effects & Toast (lines 172–219)

```
Line 172–193:  blip(freq, dur, type, gain) — Web Audio oscillator blip:
                 - Lazily creates AudioContext on first call
                 - Creates OscillatorNode + GainNode
                 - Sets frequency, type, gain envelope (exponential ramp to 0)
                 - Connects: oscillator → gain → destination
                 - Starts and stops oscillator
                 - Wrapped in try/catch (audio is best-effort)

Line 195–198:  Named sound preset constants:
                 blipError   → blip(200, 0.08, 'square', 0.04) — low error tone
                 blipSuccess → blip(740, 0.07, 'sine', 0.08) — bright success tone
                 blipDrop    → blip(740) + setTimeout(() => blip(980), 60) — double-blip drop
                 blipSlot    → blip(660, 0.05, 'sine', 0.06) — slot click tone

Line 200–206:  Shared text style constants:
                 WHITE_LABEL: { fontFamily: "'Baloo 2', sans-serif", fontSize: 13, fontWeight: '600' as const, fill: 0xffffff }
                 DARK_LABEL: clone of WHITE_LABEL with fill: 0x0c3543
                 Used in drawBlock(), startHtmlDrag(), drawSnapGhost() instead of inline literals

Line 208–219:  Toast notification system:
                 toastsEl = #toasts (div)
                 toast(msg, kind, durationMs):
                   Creates div.toast.toast-{kind}
                   Appends to #toasts container
                   After durationMs: adds .toast-exit class, removes on animationend
```

### SECTION 5: Global State Variables (lines 221–385)

```
Line 221–228:  Workspace state:
                 workspace: string | null — root folder path (null = standalone file)
                 savedSnapshot: string — last saved/loaded content (dirty baseline)
                 activePath: string | null — current file path
                 savedCache: Map<path, content> — loaded content per file (64-entry cap)
                 fileCache: Map<path, content> — open document content cache
                 files: string[] — workspace file list

Line 230–285:  Exit/close interception:
                 hasUnsavedChanges():
                   Returns true if: (file open AND content differs from snapshot)
                   OR (scratch buffer AND non-empty AND differs from language sample)
                 showExitDialog(): Promise<boolean>
                   Shows #exit-confirm overlay
                   Returns true if user clicks Quit, false if Cancel or overlay click
                 getCurrentWindow().onCloseRequested():
                   If exitHandled flag → return (prevent double-fire)
                   If hasUnsavedChanges(): preventDefault(), show dialog
                   If confirmed: saveWindowState(), destroy window
                   Else: reset flag
                   If no unsaved changes: saveWindowState() (CRITICAL-05 fix: both paths save)
                 beforeunload listener: preventDefault() if unsaved (web/dev mode)

Line 287–296:  langOf(path): maps file extension → SourceLang
                 .cpp/.cc/.cxx/.hpp/.hh → 'cpp'
                 .py/.pyw → 'python'
                 .js/.mjs/.cjs → 'javascript'
                 .rs → 'rust'
                 default → 'c'

Line 298–315:  Settings helpers:
                 readSetting<T>(key, fallback): delegates to readJsonStore(`blockide-set-${key}`, fallback)
                 writeSetting(key, val): writes localStorage
                 applySettings(): applies fontSize, fontFamily, lineHeight, whiteSpace, tabSize to srcEl

Line 316:      activeLang: Lang = 'c' — current language

Line 318–370:  Sample code per language:
                 SAMPLES[lang] — full sample programs (shown on new session)
                 NEW_TEMPLATES[lang] — minimal starter templates

Line 372–385:  Core editor state:
                 src: string = SAMPLE — current buffer content
                 roots: BBlock[] = [] — parsed block tree (rebuilt on each render)
                 hist: History — undo/redo stack
                 SlotHit interface + slotHits array:
                   { block, part, x, y, w, h } — editable socket hit boxes in world coords
                   Rebuilt on every render() call
```

### SECTION 6: Dirty Tracking, Tour Hooks, setSrc (lines 387–417)

```
Line 387–395:  markDirty():
                 Compares src vs savedCache.get(activePath)
                 Toggles .dirty class on the matching tab element
                 Toggles .active class on all tabs
                 Calls updateTitle()
                 Calls updateTabsHeight()

Line 397–400:  updateTabsHeight():
                 Sets --tabs-h CSS variable on #main-col from tabsEl.offsetHeight

Line 402–405:  tourHooks: { advance?: (ev) => void }
                 Context-aware tour: hooks fire on real user actions, not timers

Line 407:      srcSetting = false — guard flag: prevents input listener from double-counting undo

Line 408–417:  setSrc(next, kind='op'): Promise<void>
                 hist.push(src, kind) — push current src onto undo history
                 src = next
                 srcSetting = true     — CRITICAL-01 FIX: set guard BEFORE updating srcEl.value
                 srcEl.value = next
                 srcSetting = false    — clear guard AFTER update
                 Calls render(next) and markDirty()
                 Returns the render promise
```

### SECTION 7: Render Pipeline (lines 419–484)

```
Line 419–423:  renderGen counter — latest-wins rendering:
                 Each render() call increments gen
                 If a newer render completes, the stale one returns early

Line 425–484:  async render(source):
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

### SECTION 8: Canonicalization (lines 486–512)

```
Line 486–512:  canonicalize():
                 Snapshots buf = src, lang = activeLang
                 Invoke: invoke('canonicalize_c', { src: buf, lang })
                   → Returns clean: string (formatted code)
                 If clean differs AND buffer hasn't moved on:
                   Capture caret anchor from current position
                   Call setSrc(clean) — reformats code
                   On next frame: restore caret position via caretOffset()
                 After canonicalize: calls refreshDiags()
```

### SECTION 9: Diagnostics Overlay & Panel (lines 514–588)

```
Line 514–537:  drawDiagOverlay(ds: Diag[]):
                 Clears overlay container
                 For each diagnostic:
                   Find blocks whose byte range contains the diagnostic offset
                   Pick the smallest block (fewest pixels)
                   Draw a roundRect stroke (red for error, yellow for warning)

Line 540–563:  renderDiagList(ds: Diag[]):
                 Stores in lastDiags
                 Updates #diag-count text
                 If panel is hidden: skip rendering rows
                 For each diagnostic: create button.diag-row with severity icon + location + message
                 Click on row → jumpToOffset(d.offset)

Line 565–576:  jumpToOffset(offset):
                 Switch to split view
                 Focus srcEl, select the line at offset
                 Scroll to center the line

Line 578–588:  refreshDiags():
                 Invoke: invoke('diag_c', { src, lang: activeLang })
                 Calls drawDiagOverlay() and renderDiagList()
```

### SECTION 10: Block Rendering Geometry (lines 590–770)

```
Line 590–596:  mixWhite(c, f): blends color c toward white by fraction f

Line 598–603:  Geometry constants:
                 NX=10 (mouth/tab x offset), TW=18 (tab width), TD=4.5 (tab depth), BR=8 (corner radius)

Line 605–623:  statementPath(g, ox, oy, w, h): draws a Scratch-style statement block shape
                 Top edge: rounded corners → tab mouth recess → straight → tab recess → rounded
                 Bottom edge: straight → tab protrusion → straight → rounded corners

Line 625–637:  cHeaderPath(g, ox, oy, w, h): draws a C-block header (top half only, no bottom mouth)

Line 639–653:  cBodyPath(g, ox, oy, w, top, h, close): draws the C-block body (below header)
                 Right wall → bottom tab → left wall → optional close

Line 655–770:  drawBlock(b: BBlock): renders one block onto the PixiJS canvas
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
                   IF no parts: single Text with label or nodeKind (using WHITE_LABEL style)
                   IF has parts: iterate parts, lay out left-to-right:
                     'text': white Text at cx (using WHITE_LABEL)
                     'bool': hexagonal box (6-point polygon) with DARK_LABEL text → register in slotHits
                     'round'/'ident'/'number'/'string': rounded rect box with DARK_LABEL text → register in slotHits
                     Advance cx by partWidth + 7px gap

                 Draw category notch: small dark rect at (x+5, y+5, 5, min(ROW_H-10, h-10))

                 Add all Graphics + Text children to world
                 Set eventMode='static', attach header drag events
                 Recursively drawBlock() for all children
```

### SECTION 11: Coordinate Transform & Drag System (lines 772–1104)

```
Line 772–774:  screenToWorld(ox, oy): converts screen coords → world coords
                 x = (ox - world.x) / world.scale.x
                 y = (oy - world.y) / world.scale.y

Line 776:      drag: DragPayload | null = null

Line 778–817:  startHtmlDrag(e, payload):
                 Stores payload in global `drag`
                 Creates a PixiJS Container with block shape + text in snapLayer
                 Uses WHITE_LABEL style for the text
                 Shows HTML ghost div (floating preview)
                 Registers pointermove → onDragMove, pointerup → onDragEnd (once)
                 Plays blip(520) sound

Line 819–837:  catColor(cat): maps category string → hex color number

Line 839–841:  clearSnapGhost(): removes all children from snapLayer

Line 843–874:  drawSnapGhost / clearSnapGhost: translucent block preview at drop position
                 Uses WHITE_LABEL style for the text

Line 876–903:  slotUnderWorldPoint / nearestCompatibleSlot:
                 Hit-tests editable sockets by world coordinates
                 nearestCompatibleSlot: finds matching-shape socket on the block under point

Line 905–996:  onDragMove(e): pointermove handler during drag
                 Updates ghost position
                 Converts to world coords
                 IF dragging a reporter chip (slotValue):
                   Find compatible socket → highlight it with orange outline
                   Ghost opacity = 1 (snapped) or 0.5 (not snapped)
                 ELSE (statement/toplevel drag):
                   findDropTarget → find insertion point
                   Draw yellow dropbar at insertion position
                   Draw translucent snap ghost preview

Line 998–1000: isInsideRange(inner, outer): checks if block range is inside another range

Line 1002–1084: onDragEnd(e): pointerup handler — commit the drag
                 Remove event listeners, hide ghost/dropbar/snapLayer
                 If dropped outside canvas: return (cancel)

                 CASE 1: Reporter chip → commitSlotValue(socket, value)
                 CASE 2: Toplevel (function def) → insertTopLevel(src, roots, snippet)
                 CASE 3: Include chip → prepend to file
                 CASE 4: Statement/variable → findDropTarget → spliceInsert or spliceMove
                 After each: setSrc(), canonicalize(), tourHooks.advance('edit'), blip()
                 Sound presets used: blipError (wrong shape), blipSuccess (top-level/include),
                 blipDrop (statement splice)

Line 1086–1104: attachHeaderEvents(obj, b):
                 pointerdown on block header → startHtmlDrag with move payload
                 Filters right-click (button !== 0)
                 Converts PixiJS global coords → client coords for the drag
```

### SECTION 12: Inline Slot Editor (lines 1106–1185)

```
Line 1110–1121: commitSlotValue(s, raw):
                  Validates raw value against slot type via validateSlotValue()
                  If invalid: returns error string
                  If valid and changed: splice into src at slot's byte range
                  Calls canonicalize()
                  Plays blipSlot() on success

Line 1123–1127: slotEditor = document.createElement('input') — inline editing element
                  slotEditor.id = 'slot-editor'
                  editingSlot: SlotHit | null = null

Line 1129–1143: closeSlotEditor(commit):
                  If commit, calls commitSlotValue()
                  If invalid (and not string): reopen with .bad class (shake animation)
                  Plays blipError() on invalid input

Line 1145–1157: openSlotEditor(s): positions input over the socket in screen coords

Line 1159–1170: slotEditor keydown/blur listeners:
                  Enter → commit, Escape → cancel, blur → commit

Line 1172–1185: slotAt(b, wx, wy): finds the editable slot on block b at world coords
```

### SECTION 13: Double-Click Edit (lines 1187–1206)

```
Line 1187–1202: hostEl dblclick handler:
                  Convert to world coords, hit-test header
                  Skip sticky (comments)
                  anchorToBlock(hit)
                  If clicked on a slot: openSlotEditor(slot) — inline edit
                  Else: window.prompt('Edit statement:', label) — full replacement
                  applyEdit(block, replacement)(src) → setSrc() + canonicalize()

Line 1204–1206: Run button click → startRun()
```

### SECTION 14: Run/Stage System (lines 1208–1517)

```
Line 1208–1212: Stage state:
                  stageCanvas, stageCtx (2d context)
                  stopBtn, fpsEl
                  running, lastFrame, pollTimer, fpsFrames, fpsT0
                  u32max = 4294967295 (sentinel for "no frame yet")
                  downKeys: Set<number> — currently pressed keys

Line 1229–1245: keyToCode(e): maps KeyboardEvent → numeric key code
                  Arrow keys → 1-4, printable ASCII → char code

Line 1247–1272: Keyboard forwarding to running program:
                  isTextEntryTarget(e): returns true if target is textarea/input/findbar/filter
                  stageKeyDown(e): if running AND not text entry → invoke('stage_keys', { down })
                  stageKeyUp(e): delete from downKeys, invoke('stage_keys', { down })

Line 1274–1298: paintStage():
                  invoke('stage_frame', { last: lastFrame })
                  Returns { frame, w, h, b64 } or null
                  Decode base64 → ImageData → OffscreenCanvas → drawImage to stage canvas
                  Track FPS every 500ms

Line 1300–1318: finishRun(r):
                  Display stdout + stderr + exit code in console
                  If in blocks view: switch to split (off-ramp — show generated code)

Line 1320–1330: stopRun(msg?) — CRITICAL-02 FIX: extracted centralized cleanup function
                  running = false
                  Remove keydown/keyup listeners
                  Clear pollTimer, memTimer
                  Hide stopBtn, consoleInputRow
                  Clear fpsEl
                  If msg provided: set consoleEl.textContent = msg

Line 1332–1385: startRun():
                  Set console to "running..."
                  Clear keys, set running=true, show stop button + stdin row
                  Check memTrace checkbox → set lastMemState
                  Invoke 'run_start' with { src, traceMem, lang }
                    On error: stopRun(`[launch] ${e}`), blip(200), return
                  If tracing: invoke 'mem_attach' → startMemPoll()
                  Invoke 'stage_attach'
                  Start paintStage loop (requestAnimationFrame)
                  Start pollTimer (120ms interval):
                    invoke('run_poll')
                    If result: stopRun(), finishRun(), reportLeaks()
                    On error: stopRun(`[poll] ${e}`)

Line 1387–1409: Console stdin:
                  sendConsoleLine(): read input → invoke('run_stdin', { line })
                  Enter key or send button → sendConsoleLine()

Line 1411–1517: Memory view:
                  MemBox/MemEdge/MemState interfaces
                  memTraceEl, memListEl, lastMemState, memTimer
                  renderMemView(): builds HTML heap boxes + SVG pointer arrows
                  startMemPoll(): 150ms interval → invoke('mem_state') → renderMemView()
                  reportLeaks(): after run ends, report live allocations

Line 1515–1517: Stop button → invoke('stage_stop')
```

### SECTION 15: Context Menu (lines 1519–1575)

```
Line 1519–1529: Context menu state:
                  ctxMenu = div#ctx-menu, appended to body
                  ctxBlock: BBlock | null = null
                  hideCtxMenu(): hides menu, clears ctxBlock

Line 1531–1548: hostEl contextmenu:
                  Hit-test block, show menu with "Duplicate" / "Delete"
                  anchorToBlock(hit)
                  Plays blip(420) sound

Line 1550–1568: ctxMenu click handler:
                  Duplicate: slice block code, insert after it, blipSuccess()
                  Delete: remove entire line from source, blip(170)

Line 1570–1575: pointerdown/Escape: hide context menu
```

### SECTION 16: Workspace & Tab System (lines 1578–1948)

```
Line 1582–1607: Path utilities:
                  isWinPath(p): checks for Windows absolute path (C:\ or /)
                  baseName(p): last path component
                  dirName(p): parent directory
                  normSlashes(p): backslash → forward slash
                  asRelInWorkspace(abs): converts absolute to workspace-relative
                  fsRead(p): routes to read_file (relative) or read_abs (absolute)
                  fsWrite(p, c): routes to write_file or write_abs

Line 1609–1646: refreshFiles():
                  invoke('list_c_files', { root: workspace }) → string[]
                  Group files by directory, sort dirs (root first)
                  Create .file-dir headers + .file items
                  Click on file → guardedOpenTab(f)

Line 1648–1687: createTab(path, content):
                  Remove duplicate tab if path already open
                  Cache content in fileCache + savedCache
                  Evict oldest entries if cache > 64
                  Create .tab element with .tab-label + .tab-x (close button)
                  Click → guardedOpenTab, middle-click → closeTab
                  Append to tabsEl, call activateTab()

Line 1691–1714: closeTab(path):
                  If active: confirmDiscard()
                  Remove tab element, delete from caches + tabViews
                  If was active: activate next tab, or reset to scratch buffer

Line 1719–1726: confirmDiscard():
                  If empty or matches sample: return true (no discard needed)
                  If file open and matches snapshot: return true
                  Otherwise: ask() dialog, return boolean

Line 1728–1742: guardedOpenTab(path): confirmDiscard() → openTab()
                  openTab(rel): if already open → activateTab()
                  Otherwise: fsRead() → createTab(), push to recents

Line 1744–1757: activateTab(rel):
                  Reset history, clear caret anchor
                  Set activePath, activeLang (from langOf)
                  Load src from fileCache, set as savedSnapshot
                  Set srcEl.value, renderPalette(), render(), markDirty()
                  Restore per-tab view mode

Line 1759–1869: Toolbar button handlers:
                  open-folder: openDialog({ directory: true }) → set workspace, refreshFiles()
                  open-file: openDialog with file filters → openTab(abs path)
                  new-file: language selector modal → name prompt → write file → openTab()

Line 1871–1948: Save system:
                  saveActive(saveAs=false):
                    If no file open and not save-as: show message
                    If save-as: saveDialog() → write to new path
                    Else: write to current path
                    On success: update caches, savedSnapshot, markDirty(), clear journal
                    Push to recents, statusFlash('Saved'), toast('Saved'), blip()
                  Ctrl+S → saveActive(), Ctrl+Shift+S → saveActive(true)
```

### SECTION 17: Keyboard Shortcuts (lines 1950–2081)

```
Line 1950–1994: Global keyboard handler:
                  Ctrl+S → save (shift for save-as)
                  Ctrl+W → close tab
                  Ctrl+F → open find bar
                  Ctrl+H → open find+replace
                  Ctrl+/ → toggle shortcuts dialog
                  Ctrl+Z → undo (if not shift)
                  Ctrl+Y / Ctrl+Shift+Z → redo

Line 1996–2002: Textarea input handler (CRITICAL-01 fix):
                  if (srcSetting) return — setSrc already pushed to history, don't double-count
                  hist.push(src, 'type'), update src, render, markDirty

Line 2003–2012: Textarea event handlers:
                  scroll → sync world.y with textarea scroll fraction (split mode)
                  blur → canonicalize() (format on blur)

Line 2018–2081: Text editor key handling:
                  editTextArea(next, caret): helper to set value + selection + dispatch input
                  Tab (no selection): insert 2 spaces, or outdent 2 on Shift+Tab
                  Tab (with selection): indent/outdent every touched line
                  Enter: auto-indent matching previous line's indent
                  If line ends with { or : → add 4 more spaces
                  If next char is } → brace expansion: {\n<indent+4>\n<indent>}
                  trimmedEndsWithOpener(line): checks for { or : at end
```

### SECTION 18: Pan & Zoom (lines 2083–2121)

```
Line 2083–2121: Canvas interaction:
                  panning, lastX, lastY state variables
                  app.stage.eventMode='static', hitArea=app.screen
                  Pan: pointerdown on empty canvas → track delta → update world.x/y
                  Zoom: wheel event → scale around mouse position
                  pan starts only if pointerdown didn't hit a block header
```

### SECTION 19: Palette System (lines 2123–2557)

```
Line 2127–2134: readJsonStore<T>(key, fallback):
                  Safely parses localStorage JSON, returns fallback on any error

Line 2135–2148: Variable state:
                  knownVars: string[] — user-created variable names (from localStorage)
                  knownLists: string[] — user-created list names
                  varTypesMap: Record<string, string> — type per variable
                  harvestedVars: string[] — variables declared in current file
                  paletteSignature: string — hash of kinds+includes+vars (detects palette changes)
                  programKinds: Set<string>, programIncludes: Set<string>
                  saveVars(): persists knownVars, knownLists, varTypesMap to localStorage

Line 2150–2152: isReporterChip(item): returns true if item.reporter !== undefined

Line 2156–2178: makeReporterChip(item): creates oval/hex reporter chip element
                  Sets up pointerdown → startHtmlDrag with slotValue payload

Line 2180–2216: makeVarChip(item, list): creates variable chip
                  Reporters → startHtmlDrag with slotValue/slotKind:'round'
                  Non-reporters → startHtmlDrag with snippet
                  Right-click → openVarMenu(): rename/delete menu

Line 2218–2266: Variable rename/delete menu:
                  varMenu = div#var-menu, appended to body
                  openVarMenu(e, varName): shows Rename/Delete options
                  rename: window.prompt → validate → update knownVars/knownLists
                  delete: window.confirm → splice from array
                  Plays blip sounds for success/error
                  hideVarMenu(), pointerdown listener to close

Line 2271–2450: renderPalette():
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

Line 2452–2557: Keyboard palette navigation:
                  palFilter input → applyPalFilter(): hides non-matching chips
                  ArrowDown/ArrowUp → navigate visible chips
                  Enter → keyboardActivateChip(el): splice snippet at caret
                  Escape → clear filter, focus textarea
                  visibleChips(): returns non-hidden palette elements
                  applyPalFilter(): toggles pal-hide and pal-kbd classes
                  keyboardActivateChip(el): handles locked/dep-gated/reporter guards,
                    then splices at top/toplevel/caret position
```

### SECTION 20: Academy System (lines 2559–2710)

```
Line 2560–2571: Academy state:
                  ProfileOut, LevelInfo interfaces
                  xpBadge, levelSelect, hintBtn elements
                  profile, hints, hintTier
                  levelSols: Record<id, solution> — ownership chaining
                  mastery: Record<id, MasteryState> — spaced repetition
                  nowSec(): unix seconds helper

Line 2589–2599: Mode system (sandbox | academy):
                  AppMode = 'sandbox' | 'academy'
                  appMode persisted in localStorage
                  setMode(): sets data-mode attribute, renders palette locks
                  sandbox: everything unlocked
                  academy: categories gated by profile.unlocked

Line 2601–2610: renderPaletteLocks():
                  For each palette chip: lock if academy mode AND category not unlocked

Line 2612–2637: refreshProfile/refreshLevels:
                  invoke('profile_get') → XP + completed levels
                  invoke('academy_levels') → level list for dropdown
                  masteryDue() check → spaced review reminder in dropdown

Line 2639–2710: Academy actions:
                  Level Load: invoke('academy_load', { levelId }) → starter + hints
                    Ownership chaining: seed from previous level's solution
                    masteryDue() check → spaced review reminder
                  Hint button: reveal next hint tier
                  Check button: invoke('academy_check', { levelId, src })
                    If passed: record solution, promote mastery, refresh profile
                    If failed: show which tests failed
```

### SECTION 21: Debug Hooks & Final Wiring (lines 2712–2756)

```
Line 2712–2751: Debug hooks (harmless in production):
                  window.__hitAt(cx, cy): hit-test helper
                  window.__blocksShape(): list all block kinds
                  window.__slots(): list all slot types/texts
                  window.__commitSlot(i, v): commit a slot value by index
                  window.__makeVar(raw): create variable via JS
                  window.__makeList(raw): create list via JS
                  window.__langOf(path): language detection helper
                  window.__activeLang(): current language getter
                  window.__labels(): all block labels
                  window.__runState(): { running, polls }

Line 2753–2756: Final wiring:
                  refreshProfile(), refreshLevels(), setMode(), renderPalette()
```

### SECTION 22: Semantic Caret System (lines 2758–2791)

```
Line 2762:      caretAnchor: CaretAnchor | null = null

Line 2764–2767: captureCaret():
                  If viewMode is not text/split: return
                  pickAnchor(roots, srcEl.selectionStart) → store in caretAnchor

Line 2769–2779: restoreCaret():
                  Resolve anchor against current parse via caretOffset()
                  Focus srcEl, set selection range
                  Scroll caret line to center of viewport

Line 2781–2784: Caret capture events on srcEl: keyup, mouseup, input, focus

Line 2788–2791: anchorToBlock(b):
                  Sets caretAnchor to block's start id/edge/offset
                  If split view: highlights block's span in text
```

### SECTION 23: View Modes (lines 2793–2822)

```
Line 2794–2808: View mode system:
                  ViewMode = 'split' | 'blocks' | 'text'
                  viewBtns: all .vm buttons
                  viewMode: current mode
                  tabViews: Map<path, ViewMode> — per-tab view preference
                  setView(v): captures caret, sets appEl.dataset.view, restores caret
                  Resize event dispatched on view change
                  Per-tab view preference stored in tabViews map

Line 2817–2822: Graduate button: setView('text') — off-ramp to real code
                  Plays blip(880) sound
```

### SECTION 24: Theme & Window Controls (lines 2824–3207)

```
Line 2824–2838: Theme:
                  setTheme(t): sets data-theme, updates button text, saves to localStorage
                  Updates PixiJS background color
                  Toggle button switches light/dark

Line 2840–2860: Splash screen state:
                  RecentEntry interface
                  recentList(): reads localStorage 'blockide-recent'
                  pushRecent(root, rel): adds entry, caps at 8

Line 2862–2895: beginSession(lang, mode): hides splash, initializes editor
                  beginFromRecent(entry): opens recent project

Line 2897–2913: showSplashPanel(id): switches splash content panels

Line 2916–2944: renderRecentProjects(): builds recent project list in splash

Line 2947–3051: initSplashSettings():
                  Wires all splash setting controls to localStorage:
                  Theme (auto/light/dark), fontSize, fontFamily, tabSize, lineHeight
                  Toggles: wordWrap, minimap, lineNumbers, bracketMatch, autoBrackets,
                  highlightLine, formatSave, confirmExit, restoreSession, sounds,
                  animations, clearRun, memTrace, showXp, spacedRep, ctrlView,
                  slashFilter, tabIndent
                  Selects: autosave, runShortcut, hintLimit, ghostOpacity, sidebarStyle
                  Accent color dots: 6 colors

Line 3054–3078: initAcademyCarousel(): auto-advancing 3-slide carousel

Line 3081–3120: initSplashSidebar():
                  Sidebar nav: click → showSplashPanel
                  Language cards: click → set selectedLang
                  hero-start → beginSession(selectedLang, 'sandbox')
                  hero-open → beginSession then click open-folder
                  academy-start → beginSession(selectedLang, 'academy')

Line 3122–3135: wireSplash() → renderRecentProjects, initSplashSettings, initSplashSidebar, initAcademyCarousel
                  splash-quit → getCurrentWindow().close()

Line 3137–3146: Toolbar window controls:
                  tb-minimize → minimize
                  tb-maximize → toggleMaximize
                  tb-close → close

Line 3148–3207: Window state persistence:
                  saveWindowState(): saves x, y, w, h, maximized to localStorage
                  restoreWindowState(): restores with bounds checking (100px min visible)
                  debouncedSaveState(): 500ms debounce on resize events
                  Startup restore: setTimeout 100ms
                  __bootDone flag for headless drivers
```

### SECTION 25: About, Shortcuts, Find/Replace, Drag/Drop (lines 3209–3394)

```
Line 3211–3218: About dialog:
                  brand-logo click → show #about overlay
                  Overlay click → hide

Line 3220–3232: Keyboard shortcuts dialog:
                  show-shortcuts button → hide about, show #shortcuts-dialog
                  close-shortcuts button → hide
                  Overlay click → hide

Line 3234–3363: Find & Replace:
                  findbar, findInput, replInput, findCount elements
                  findHits, findIdx state
                  computeHits(): case-insensitive substring search
                  showHit(i): navigate to hit, update count, scroll
                  refreshFind(): recompute while preserving approximate position
                  nearestHitIndex(at): find closest hit ≥ at
                  openFind(replaceMode): show bar, focus input
                  closeFind(): hide bar, canonicalize
                  findInput input → recompute and show first hit
                  findInput Enter → next/prev hit
                  find-next/find-prev buttons → navigate
                  repl-one: splice one occurrence, play blipSlot()
                  repl-all: splice all occurrences, play blip(), show count

Line 3365–3394: Drag & Drop files:
                  onDragDropEvent → filter source extensions → openTab each
                  diag-toggle button → show/hide #diag-list, update button text
```

### SECTION 26: Global Keybindings & Tour (lines 3396–3493)

```
Line 3396–3427: Global keybindings:
                  F5 / Ctrl+Enter → run
                  Ctrl+B → toggle sidebar
                  Ctrl+1/2/3 → view modes (blocks/split/text)
                  / → focus palette filter (from non-input elements)

Line 3429–3493: Onboarding tour:
                  TOUR_STEPS array: Welcome → Drag → Run → Academy
                  Each step has optional 'until' event
                  startTour(): shows overlay, wires Next button and tourHooks
                  tourHooks.advance(ev): auto-advance when user performs the action
                  finish(): hides overlay, sets localStorage 'tour-done'
```

---

## FILE: `app/src/blocks.ts` (534 lines)

### Data Structures (lines 1–55)

```
Line   1–12:   CNodeJSON: { id, kind, field, named, missing, start, end, pre, text, children }
Line  14–19:   CTreeJSON: { root: CNodeJSON, tail: string, lang: string }
Line  21:      Cat = 'function' | 'control' | 'statement' | 'variables' | 'comment' | 'error' | 'structs'
Line  26:      PartType = 'text' | 'ident' | 'number' | 'string' | 'bool'
Line  27–33:   BlockPart: { type: PartType, text, start, end }
Line  35–55:   BBlock: { id, nodeKind, label, parts, cat, sticky, container, children,
               start, end, headerEnd, x, y, w, h }
```

### Language Shape Maps (lines 57–132)

```
Line  57–66:   LangShape interface: { body, controls: Set, fns: Set, classes: Set }
Line  68–74:   C_CONTROLS = new Set([...]) — shared C/C++ control node kinds
Line  76–129:  LANG_SHAPES: per-language config
               c:     body='compound_statement', controls=C_CONTROLS, fns=function_definition
               cpp:   body='compound_statement', controls=C_CONTROLS, fns=function_definition, classes=class/struct
               python: body='block', controls=if/for/while/try/with, fns=function_definition, classes=class_definition
               js:    body='statement_block', controls=if/for/for_in/while/do/switch/try, fns=function_declaration
               rust:  body='block', controls=if/if_let/match/loop/while/while_let/for, fns=function_item, classes=struct/enum
Line 132:      SHAPE: LangShape = LANG_SHAPES.c — active shape, set per buildBlocks call
```

### Core Functions (lines 134–342)

```
Line 135:      BODY_FIELDS = new Set(['body', 'consequence', 'alternative'])

Line 137–148:  isBrace(n): true if unnamed node with text '{' or '}'
               leafText(n): recursive concatenation of pre+text for all leaves
               collapse(s): whitespace → single space, trim

Line 150–157:  findCompound(n): depth-first find first child with kind === SHAPE.body

Line 159–163:  fieldedBodies(n): children where field is 'body'/'consequence'/'alternative'

Line 169–173:  SLOT_KINDS: Record<string, PartType> — maps identifier→'ident', number_literal→'number', string_literal→'string'

Line 175–189:  headerLeaves(n, skip): collect leaf tokens in HEADER region only
                 Skips: bodies, comments, braces, stray whitespace
                 Slot kinds checked via SLOT_KINDS

Line 191–193:  partTypeOf(kind): returns SLOT_KINDS[kind] ?? 'text'

Line 199–214:  conditionSlot(n): extract control condition as hex socket
                 if/while/switch: parenthesized_expression → inner spans between parens
                 for/do: bare expression node

Line 216–246:  buildHeader(n, skip, barrier?): convert header leaves → BlockPart[]
                 Merge adjacent text parts (unless crossing barrier)
                 Return { parts, label }

Line 248–261:  categorize(kind): map tree-sitter node kind → Cat
                 ERROR/MISSING→error, functions→function, controls→control, classes→structs
                 comments→comment, *_statement/declaration/expression_statement→statement
                 Default: statement

Line 263–328:  toBlock(n: CNodeJSON): BBlock — the core conversion
                 Determine cat, bodies, compound, container
                 Container = control statement OR has compound body (not comment)
                 Build children from bodies (recurse)
                 Build header parts from headerLeaves
                 If control: add conditionSlot as hex socket
                 Return BBlock with all fields

Line 330–337:  stackFrom(parent): iterate children, skip braces, toBlock each

Line 339–342:  buildBlocks(tree): set SHAPE, call stackFrom(tree.root)
```

### Variable Harvesting (lines 344–371)

```
Line 344–371:  harvestVars(root): walk tree, collect identifiers under declaration nodes
               Only init_declarator, array_declarator, pointer_declarator children
               Returns string[] of variable names
```

### Layout & Geometry (lines 373–448)

```
Line 373–378:  CHAR_W=8.4, PAD=14, ROW_H=34, GAP_Y=10, INDENT=30

Line 379–389:  widthCache: Map<string, number> — cached block widths
               measure(label): cached width = max(90, label.length * CHAR_W + PAD * 2)
               Clears cache when size > 200

Line 394–396:  glyphWidth(s): raw width = max(6, s.length * CHAR_W) — NO minimum

Line 401–405:  partWidth(p): text→glyphWidth+6, bool→48-260, round→36-240

Line 408–413:  headerWidth(b, gap=7): sum of partWidths + gaps + PAD

Line 415–439:  layoutStack(blocks, x, y):
                 For each block: set x, y
                 If container: recurse children at (x+INDENT, y+ROW_H+GAP_Y)
                 Width = max(headerWidth, innerW + INDENT)
                 Height = ROW_H + GAP_Y + innerBottom - cursor + GAP_Y
                 Flat blocks: w=headerWidth+PAD, h=ROW_H

Line 441–448:  flatten(blocks): recursive flatten tree → flat array
```

### Hit Testing & Drop Targets (lines 450–510)

```
Line 450–454:  DropTarget: { container: BBlock, index: number, offset: number }

Line 457–498:  findDropTarget(roots, wx, wy):
                 Visit all containers, find smallest containing the point
                 Compute insertion index by child midpoints
                 Compute byte offset for the insertion point

Line 501–510:  hitTestHeader(roots, wx, wy):
                 Find deepest block whose header row contains the point
```

### Color Palettes (lines 512–534)

```
Line 516–524:  COLORS: Record<Cat, number>
                 function=0x7c5ce0, control=0xffab19, statement=0x0891b2,
                 variables=0xff8c1a, comment=0xffe9a8, error=0x94a3b8, structs=0xec4899

Line 526–534:  BORDER: Record<Cat, number>
                 function=0x5a3fc0, control=0xd97e06, statement=0x066a85,
                 variables=0xcc6d10, comment=0xd9b25a, error=0x64748b, structs=0xbe2e6f
```

---

## FILE: `app/src/palette.ts` (379 lines)

### Types & Constants (lines 1–34)

```
Line   5:      SourceLang = 'c' | 'cpp' | 'python' | 'javascript' | 'rust'
Line   7–22:   PaletteItem interface:
                 name, cat, snippet, reporter?, toplevel?, top?, langs?, requires?
Line  24–30:   PaletteGroup interface: { name, color, items }
Line  33:      OPERATORS_COLOR = '#59C059'
```

### Palette Groups (lines 35–270)

```
Line  35–270:  PALETTE_GROUPS: 7 category groups
               Control (line 36–101): if/else/case/try per language, dependency-gated
               Loops (line 102–116): for/while/do-while per language
               Operators (line 117–142): round reporters (+−×÷%), hex reporters (==!=<>≤≥&&||!)
                 Python uses 'and'/'or'/'not' instead of &&/||/!
               Code (line 143–230): #include, printf/scanf/cout/cin (C/C++),
                 print/input (Python), console.log/let (JS), println!/let mut (Rust),
                 assign, return
               Functions (line 231–250): call/define per language, toplevel
               Structs (line 251–261): field access, define class/struct per language
               Notes (line 262–270): // comment or # comment
```

### Variable Validation (lines 272–292)

```
Line 273:      VARIABLES_COLOR = '#FF8C1A'
Line 275:      IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
Line 280–285:  RESERVED = set of C keywords (int, char, return, if, etc.)
Line 287–292:  validateVarName(raw): checks IDENT + not reserved
```

### Variable Chips (lines 294–337)

```
Line 297–299:  VarChip interface extends PaletteItem: { varName }
Line 304–308:  varTypes(lang): returns available types per language
Line 310–327:  varChips(name, type): per-variable palette chips
                 declaration chip, oval reporter, set chip, change chip
Line 331–337:  listChips(name): element reporter, array declaration, set element
```

### Slot Validation (lines 339–379)

```
Line 341:      INDEXED_IDENT = /^[A-Za-z_][A-Za-z0-9_]*(\[\d+\])?$/
Line 342:      NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)$/
Line 346:      EXPR = /^[A-Za-z0-9_+*%/().[\]\- ]+$/
Line 348:      BARE = /^[A-Za-z0-9_]+(\[\d+\])?$/
Line 350–354:  isArithmetic(v): validates expression structure
Line 361–373:  validateSlotValue(type, raw):
                 ident: indexed identifier or arithmetic expression
                 number: numeric literal, identifier, or arithmetic
                 bool: any non-empty text
                 string: auto-quote if not already quoted
Line 376–379:  reporterFits(kind, socket): bool→bool socket, round→ident/number socket
```

---

## FILE: `app/src/ops.ts` (76 lines)

```
Line   1:      Import BBlock from ./blocks
Line   6–14:   cutRange(text, range): remove range, return { text, snippet }
Line  16–19:   adjustOffset(offset, cut): shift offset if after cut
Line  21–23:   overlaps(offset, cut): check if offset is inside range
Line  25–49:   spliceInsert(text, offset, snippet, autoIndent):
               If pre doesn't end with newline: add newline prefix
               If autoIndent (Python): copy indent from current line
               If post doesn't start with newline: add newline suffix
Line  51–60:   spliceMove(text, move, rawOffset):
               If overlaps: return null (can't move into self)
               Cut range, adjust offset, spliceInsert at new position
Line  62–64:   applyEdit(b, replacement): returns function that replaces block text
               text.slice(0, start) + replacement + text.slice(headerEnd)
Line  68–76:   insertTopLevel(src, rootEnds, snippet):
               Append after last top-level block (or EOF if empty)
```

---

## FILE: `app/src/caret.ts` (92 lines)

```
Line   1:      Import flatten, BBlock from ./blocks
Line   9–18:   CaretAnchor: { id, edge, offset, kind?, text? }
               Anchors caret to a parse node, not a byte offset
Line  20:      NO_ANCHOR = { id: -1, edge: 'start', offset: 0 }
Line  22–33:   nearestByDistance(blocks, off): find block closest to offset
Line  35–52:   resolve(blocks, anchor): 3-tier resolution:
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

## FILE: `app/src/history.ts` (39 lines)

```
Line   1–39:   History class:
               past: string[] (undo stack, 200 cap)
               future: string[] (redo stack)
               lastKind: string, lastAt: number — for coalescing
               push(prev, kind): coalesces typing bursts within 900ms
               undo(current): pop past, push future, return previous
               redo(current): pop future, push past, return next
               reset(): clear both stacks (on tab switch)
```

---

## FILE: `app/src/academy-extras.ts` (44 lines)

```
Line   8–13:   MasteryState: { box: 1..5, last: unix seconds }
Line  15:      MASTERY_INTERVALS_DAYS = [1, 3, 7, 14, 30]
Line  18–20:   nextMastery(m, now): promote box, stamp time
Line  24–27:   masteryDue(m, now): true if interval elapsed (box 5 never due)
Line  30–33:   masteryNextIn(m): human-readable "3 days" or "mastered"
Line  35–37:   ChainLevel interface: { id }
Line  41–44:   previousLevel(levels, id): find level before this one in authored order
               Used for ownership chaining (level N seeds from N-1 solution)
```

---

## FILE: `app/src/style.css` (1936 lines)

### Token System (lines 1–90)

```
Line   6–23:   @font-face: Baloo 2 (400-800) + Comic Neue (400, 700)
Line  25–28:   *, margin:0, box-sizing:border-box
Line  30–68:   :root CSS custom properties — light theme:
                 --sea-100 through --sea-900 (sea palette)
                 --ink-dim-light
                 --bg, --bg-panel, --bg-deep, --bg-editor, --border, --border-strong
                 --fg, --fg-dim, --accent, --accent-deep, --accent-soft
                 --ok, --warn, --yellow, --teal, --on-accent
                 --radius-sm/md/lg, --clay-border
                 --shadow-clay, --shadow-clay-sm, --press
Line  70–90:   :root[data-theme='dark'] overrides for dark mode
```

### Layout (lines 92–218)

```
Line  92–98:   body: Comic Neue font, bg color, 100vh, overflow hidden
Line 100–102:  h1,h2,h3,strong,button,.tab,.pal: Baloo 2 font
Line 104–109:  #app: CSS Grid — 3 columns (216px 420px 1fr) × 3 rows (48px 1fr 196px)
Line 111–160:  #toolbar: flex, brand logo + nav + actions
               .header-brand, .header-nav, .header-actions
               #toolbar strong, .sep, .hint
Line 167–198:  button global styles: claymorphism (shadow, radius, hover/active)
               button focus-visible: yellow outline
Line 200–208:  #status.ok (green), #status.warn (red)
Line 210–218:  #sidebar: grid-row 2/4, flex column, bg-panel
```

### File Explorer (lines 219–251)

```
Line 219–224:  #files: max-height 34%, overflow-y auto, border-bottom
Line 226–239:  .file: padding, monospace font, hover bg-accent-soft
Line 241–250:  .file-dir: uppercase, small font, border-bottom, letter-spacing
```

### Palette (lines 252–511)

```
Line 252–256:  #palette: overflow-y auto, padding, flex:1
Line 258–333:  .pal: Scratch puzzle clip-path, hover lift, category colors
               .pal::before: 3px border behind each block
               .pal::after: white highlight strip at top
Line 335–343:  .pal:hover/:active: transform, box-shadow
Line 345–349:  .pal-control/.pal-statement/.pal-comment/.pal-loops/.pal-variables: category bg colors
Line 352–366:  .pal-group: colored category section headers
Line 369–383:  #make-var/#make-list: Scratch-style variable creation buttons
Line 386–421:  #pal-rail: sticky category rail with dots
               .rail-dot: colored circle, hover/active states
Line 424–444:  .pal-list: list element reporters
               .pal-hex: hexagonal clip-path for boolean sockets
Line 446–471:  #var-menu: variable rename/delete popup
Line 474–491:  .pal-reporter: oval shape for variable reporters
               .pal-operators: Scratch Operators green
               .pal-functions, .pal-structs: category colors
Line 495–508:  .pal.locked: opacity 0.4, lock emoji overlay
Line 510–511:  .pal-hide: display none; .pal-kbd: yellow keyboard focus outline
```

### Academy (lines 513–555)

```
Line 513–555:  #academy: sidebar section, gap, padding, border-top
               #academy strong, #academy select, .row, button
```

### Main Column & Tabs (lines 556–618)

```
Line 556–562:  #main-col: flex column, border-right
Line 564–571:  #tabs: flex, gap, bg-panel
Line 573–617:  .tab: padding, border-top rounding, active/dirty states
               .tab.active: white bg, border-strong
               .tab.dirty::after: yellow dot
```

### Editor & Canvas (lines 619–647)

```
Line 619–630:  #src: textarea styling (font, padding, caret color)
Line 632–647:  #canvas-host: bg-sea-100, grab cursor, canvas block
```

### Diagnostics & Console (lines 648–728)

```
Line 648–653:  #console-wrap: grid-column 2/3, flex column
Line 656–714:  #diag-bar, #diag-toggle, #diag-count, #diag-list: diagnostics strip
               .diag-row: clickable diagnostic rows
Line 716–728:  #console: dark console styling (bg-deep, green text, monospace)
```

### Stage & Memory (lines 730–831)

```
Line 730–784:  #stage-wrap, #stage-head, #stage-fps, #stage-stop: stage panel
               #mem-toggle, #mem-trace: memory trace checkbox
               #stage: pixelated canvas, 320/240 aspect ratio
Line 786–831:  #mem-list, #mem-arrows, .heap-box: memory visualization
               .heap-box i: gradient bar, .heap-box span: label
```

### Drag Helpers (lines 832–847)

```
Line 832–837:  #ghost: fixed, z-1000, pointer-events none
Line 839–847:  #dropbar: fixed, z-999, yellow glow bar
```

### Tour & Splash (lines 849–1395)

```
Line 849–895:  #tour: fixed overlay, #tour-card: modal card
Line 896–1395: #splash: fixed full-screen overlay, backdrop blur
               #splash-window: 720x460 modal, border-radius, shadow
               #splash-titlebar: drag region, win-controls (CLOSE ONLY)
               #splash-body, #splash-sidebar: sidebar nav with rows
               #splash-content, .splash-panel: content panels
               .lang-grid, .lang-card: language selection grid
               .hero-btn: primary/secondary buttons
               .carousel-slides, .carousel-slide, .carousel-dots: academy carousel
               #recent-list, .recent-item: recent projects list
               .settings-scroll, .settings-group, .settings-row, .settings-toggle: settings panel
               .color-dot: accent color picker
```

### Console Input & Find Bar (lines 1396–1473)

```
Line 1396–1426: #console-input-row, #console-input, #console-send: stdin for running programs
Line 1428–1466: #findbar, #findbar input, #find-count: find & replace bar
Line 1468–1473: .pal-dep: dependency-gated chips (dashed border, link emoji)
```

### View Modes (lines 1484–1595)

```
Line 1484–1512: #view-modes: split/blocks/text buttons
                .vm: transparent bg, .vm.active: accent bg
Line 1514–1518: #app[data-mode='sandbox'] hides #academy and #xp-badge
Line 1520–1548: #slot-editor: inline editing overlay, .bad: shake animation
Line 1550–1589: #app[data-view='blocks'] grid overrides
                #app[data-view='text'] grid overrides (sidebar hidden)
Line 1590–1595: @media (prefers-reduced-motion): disable transitions
```

### Scrollbar, Selection, Run (lines 1597–1856)

```
Line 1597–1630: ::-webkit-scrollbar, ::selection, #src focus ring
Line 1632–1648: #run (green), #theme-toggle, #xp-badge
Line 1658–1679: Keyboard shortcuts dialog (#shortcuts-dialog, #shortcuts-card)
                .shortcuts-grid: 2-column grid, .shortcut-row kbd: styled key caps
Line 1681–1719: About dialog (#about, #about-card), .about-links
Line 1720–1764: Toast notifications (#toasts, .toast, .toast-success/error/info)
                toast-in/toast-out keyframe animations
Line 1766–1795: ::-webkit-scrollbar thumb/track, #src caret color, #canvas-host:active cursor
Line 1797–1810: #run button: green, min-width 74px
Line 1812–1845: .toolbar-win-controls, .twc-btn, .twc-close: window control buttons
Line 1847–1856: #theme-toggle, #xp-badge, #ctx-menu: context menu
```

### Exit Dialog (lines 1892–1936)

```
Line 1892–1936: #exit-confirm: fixed overlay, z-10000, backdrop blur
                #exit-card: modal card, h3, p, .exit-actions buttons
```

---

## FILE: `app/index.html` (476 lines)

```
Line   1–9:     <!DOCTYPE html>, <head> with charset, favicon, viewport, title "Cade"
Line  10–319:   #splash overlay:
                  #splash-window → #splash-titlebar (text + close button with aria-label)
                                  → #splash-body → #splash-sidebar (4 nav buttons: New/Academy/Recent/Settings)
                                                 → #splash-content (4 panels: sandbox/academy/recent/settings)
                                                    sandbox: lang-grid with 5 language cards (C/C++/Py/JS/Rs)
                                                    academy: carousel with 3 slides + dots
                                                    recent: #recent-list container
                                                    settings: scrollable groups (Appearance/Editor/Behavior/Audio/Run/Academy/Keyboard)
Line 320:       #app: data-view="split" data-mode="sandbox" role="application" aria-label="Cade Block Editor"
Line 321–348:   #toolbar (role="banner"):
                  .header-brand: logo + xp-badge (aria-live="polite")
                  .header-nav (role="navigation", aria-label="Main navigation"):
                    #open-folder, #open-file, #new-file, #save: all with aria-label
                    #view-modes: Split/Blocks/Text buttons + Graduate button
                  .header-actions: hint text, #theme-toggle, #run, #status (role="status" aria-live)
                  .toolbar-win-controls: #tb-minimize, #tb-maximize, #tb-close (all with aria-label)
Line 350–362:   #sidebar (role="complementary", aria-label="File explorer and palette"):
                  #files (role="tree", aria-label="Project files")
                  #pal-filter (input, aria-label="Filter palette blocks")
                  #palette (role="listbox", aria-label="Code blocks palette")
                  #academy: level-select + Load/Hint/Check buttons
Line 364–377:   #main-col:
                  #tabs
                  #src (textarea, aria-label="Code editor", placeholder)
                  #findbar: find-input, find-count, find-prev/next, repl-input, repl-one/all, find-close
Line 378:       #canvas-host (PixiJS container)
Line 379–390:   #console-wrap (role="log", aria-label="Program output"):
                  #diag-bar: toggle button (aria-expanded), #diag-count
                  #diag-list
                  #console (pre, aria-live="polite")
                  #console-input-row: #console-input + #console-send
Line 391–400:   #stage-wrap:
                  #stage-head: Stage label, mem-toggle (checkbox), #stage-fps, #stage-stop
                  #stage (canvas 320x240)
                  #mem-list
Line 402–411:   #exit-confirm (role="dialog" aria-modal="true" aria-labelledby="exit-title"):
                  #exit-card: title, message, Cancel + Quit buttons
Line 412–421:   #tour (role="dialog" aria-modal="true" aria-labelledby="tour-title"):
                  #tour-card: title, body, dots, Next button
Line 422–431:   #about (role="dialog" aria-modal="true"):
                  #about-card (onclick stopPropagation): logo, tags, Keyboard Shortcuts button
Line 432:       #toasts (role="alert" aria-live="assertive")
Line 433–473:   #shortcuts-dialog (role="dialog" aria-modal="true"):
                  #shortcuts-card (onclick stopPropagation):
                    4-column shortcuts grid (General/Navigation/View/Run/Editor)
                    Close button
Line 474:       <script type="module" src="/src/main.ts">
```

---

## DATA FLOW SUMMARY

```
User types in textarea
  → srcEl 'input' event
  → if srcSetting: return (CRITICAL-01: prevents double-counting undo)
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
    → spliceInsert/spliceMove → new source text
    → setSrc(next) → hist.push + render + markDirty
    → canonicalize() → invoke('canonicalize_c') → format code
    → refreshDiags()

User clicks Run
  → startRun()
    → invoke('run_start', { src, traceMem, lang })
    → stage_attach → paintStage loop (rAF)
    → pollTimer (120ms) → invoke('run_poll')
    → stopRun() (CRITICAL-02: centralized cleanup)
    → finishRun() → display output

Window close requested
  → onCloseRequested (CRITICAL-05: single handler)
    → if unsaved: showExitDialog → confirmed: saveWindowState + destroy
    → if no unsaved: saveWindowState (both paths save)
```

---

## ALL FIXES & FEATURES REFERENCE

### Critical Fixes

| # | Bug | Fix | Lines |
|---|-----|-----|-------|
| CRITICAL-01 | setSrc() pushed undo AND input listener also pushed | Added srcSetting guard: true before srcEl.value, false after; input handler early-returns if srcSetting | main.ts:407–417, 1996–1998 |
| CRITICAL-02 | 3 duplicated cleanup blocks in run/poll/error paths | Extracted stopRun(msg?) function that handles all cleanup; all 3 blocks replaced with stopRun() calls | main.ts:1320–1330 |
| CRITICAL-05 | Two onCloseRequested handlers — normal close didn't save state | Merged into single handler; saveWindowState() called on both destroy and normal close paths | main.ts:262–277 |

### Scaling Improvements

| # | Change | Lines |
|---|--------|-------|
| SCAL-01 | Named sound preset constants (blipError, blipSuccess, blipDrop, blipSlot) replace raw blip() calls | main.ts:195–198 |
| SCAL-02 | WHITE_LABEL and DARK_LABEL text style constants (with `as const` on fontWeight); used in drawBlock, startHtmlDrag, drawSnapGhost | main.ts:200–206 |
| SCAL-03 | readSetting() now delegates to readJsonStore() for safe JSON parsing | main.ts:299–301 |

### CSS Fixes

| # | Change | Lines |
|---|--------|-------|
| CSS-01 | Added --on-accent token | style.css:57, 86 |
| CSS-02 | Fixed .pal-hide (display: none !important) | style.css:510 |
| CSS-03 | Fixed .pal-kbd (yellow outline) | style.css:511 |
| CSS-04 | Fixed .file-dir (padding, font-size, color, weight, transform, border, margin) | style.css:241–250 |
| CSS-05 | Removed dead rules, fixed dangling refs, merged duplicate selectors | Throughout |

### HTML Fixes

| # | Change | Lines |
|---|--------|-------|
| HTML-01 | role="dialog" aria-modal="true" on #exit-confirm, #tour, #about, #shortcuts-dialog | index.html:402, 412, 422, 433 |
| HTML-02 | aria-label on icon-only buttons (win controls, find nav, etc.) | index.html:15, 344–346, 370–375, 389, 396 |
| HTML-03 | role="alert" aria-live="assertive" on #toasts | index.html:432 |
| HTML-04 | Fixed doctype (<!DOCTYPE html>) | index.html:1 |

### New Features

| # | Feature | Lines |
|---|---------|-------|
| 1 | Toast notification system — non-intrusive success/error/info toasts | main.ts:208–219, style.css:1720–1764 |
| 2 | Keyboard shortcuts help dialog (Ctrl+/ or via About) | main.ts:3220–3232, index.html:433–473 |
| 3 | Window state persistence — save/restore position, size, maximized | main.ts:3148–3203 |
| 4 | Main app window controls — minimize/maximize/close in toolbar | main.ts:3137–3146, index.html:343–347 |
| 5 | Named sound presets — blipError, blipSuccess, blipDrop, blipSlot | main.ts:195–198 |
| 6 | Shared text style constants — WHITE_LABEL, DARK_LABEL | main.ts:200–206 |
| 7 | centralized stopRun() cleanup function | main.ts:1320–1330 |
| 8 | readJsonStore() — safe JSON localStorage reader | main.ts:2127–2134 |
