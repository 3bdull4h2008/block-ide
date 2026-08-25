# LOG.md — Run Receipts (PLAN.md Loop Discipline)

```
RUN 39: trigger=user: apply ALL missing things from competitor research
expect: six gap-closers landed (off-ramp ladder, ownership chaining,
context-aware instructions, spaced mastery, keyboard-first palette, backup
rotation); gates green
obs: (1) BACKUP ROTATION: journal_write_at rotates journal-1..5.json before
each write; clear() keeps backups for salvage; FIRST TRY BUG caught by the
drill: std::fs::rename FAILS onto existing files on Windows - steady-state
rotation would have silently no-op'd; destinations now removed first.
recovery drill extended (7 writes -> exact chain asserted). (2) OWNERSHIP
CHAINING + SPACED MASTERY as pure module academy-extras.ts (nextMastery/
masteryDue/masteryNextIn/previousLevel) + 5 vitest cases; UI: pass stores
blockide-levelsol + promotes Leitner box (1/3/7/14d), load seeds from YOUR
prev solution with console note, level select shows (backslash-o)review
markers. (3) CONTEXT-AWARE TOUR: steps carry until-events fired ONLY by real
actions (drop/slot/keyboard edits -> 'edit', startRun -> 'run', Check ->
'check'); matching step self-closes w/ blip; Skip stays; e2e unaffected
(script presets tour-done). (4) OFF-RAMP LADDER: finishRun reveals split
from blocks-only ('that output came from THIS code'), graduate button ->
text view + note. (5) KEYBOARD-FIRST PALETTE: / focuses #pal-filter,
type-to-filter hides chips + collapses empty sections, arrows highlight,
Enter splices via existing seams (top/toplevel/caret-anchor spliceInsert);
reporter chips explain instead of splicing. tsc clean; vitest 40/40;
ALL FOURTEEN gates PASS exit 0.
state=SUCCESS | next: user eyes-on (/ then type 'cout', Enter in main);
research backlog now fully applied - next candidates: cloud-less backup
UI, hint-tier UX polish
```

```
RUN 38: trigger=user: resume plan - wire logos/ into the product, study ALL
competitors' wins/losses + reviews; inherited broken in-flight D11 front end
expect: logos on splash/toolbar/about/favicon/icons; D11 front end compiles
and passes gates; research doc expanded with per-competitor win/loss/reviews
obs: (1) IN-FLIGHT RESCUE: working tree did not COMPILE (8 TS errors -
SourceLang still c/cpp-only, Cat missing structs, dead CPP_RE ref, unused
NEW_TEMPLATES). Fixed: palette SourceLang widened to 5 langs (main.ts Lang
aliases it), blocks COLORS/BORDER gain structs pink, new-file uses
NEW_TEMPLATES[langOf(rel)], Variables section gated to C/C++ per D11,
python control snippets carry `pass` bodies (bare headers violate
compilable-snippet rule - python blocks are mandatory-body). STALE BINARY
FOUND: target/debug ctree_json.exe predates py/js/rs grammars - valid python
reported has_errors=true; cargo build fixes. vitest updated to per-lang
contexts (elif/else arms must FOLLOW their if as siblings in all langs;
comparisons untagged=universal, symbolic logic tagged non-python); tsc clean,
35/35. (2) LOGOS WIRED: splash ->1.png + toolbar ->brand.png (prior session)
verified; ADDED about dialog (toolbar logo click, brand.png lockup card);
favicon /logos/logo.png confirmed; src-tauri icons regenerated from logo.png
(prior session). (3) RESEARCH: docs/COMPETITOR-RESEARCH.md rewritten - 17
competitors each with WON/LOST/USERS-SAY incl review receipts (Tynker
Trustpilot billing horror corpus + CSM 'glitchy inferior lost progress';
mBlock silent-failure teardown; Ardublockly graveyard forensics; Kodu
shutdown; GameMaker GML Visual newbie-bait demotion; App Inventor 24M/100M;
Snap first-class CS; MakeCode mediated-transfer RCTs; EduBlocks INTERACT
2023 usability verdict; Code.org forum pain at the text seam) + failure
taxonomy (8 classes) + source ledger. Cade wedge re-derived: bidirectional
file-truth is THE unsolved quadrant the literature names.
(4) GATE FLAKE ROOT-CAUSED: suite G-UI-E2E failed twice ('ctrl+enter: no
[exit]') while standalone passed - killed prior runs left a DIRTY journal in
blockide-gate-data; next boot restored it over the sample and ctrl+enter
compiled garbage (no exit line). Fix: run_gates wipes journal.json before
UI-E2E launch + saves build/gates/ui-e2e-last.log for diagnosis. ALL
FOURTEEN gates PASS exit 0 (48 UI assertions).
state=SUCCESS | next: user eyes-on (logos + 5-language splash); gap-closers:
off-ramp ladder, own-solution chaining, keyboard-first palette
```

```
RUN 37: trigger=user: typed variable definitions missing, cin can't receive
input, variable blocks won't drop into cout + competitor/review research
expect: typed declarations, interactive stdin, forgiving reporter drops,
research doc; gates green (multi-language runner dispatch completed en route)
obs: (1) MULTI-LANG RUNNER FINISHED (was in flight): prepare_lang dispatches
python/node interpreters + rustc two-phase compile, all PATH-probed with
exit-status check (Windows Store python alias spawns but exits nonzero);
missing toolchain = friendly install hint via [launch] stderr. (2) STDIN:
InspectableRun now carries the LIVE child stdin pipe (run_job_opts
stdin_slot); run_stdin command + console input row (visible while running,
echoes '> line') - cin/scanf/input() finally receive typing; academy
write-and-close path unchanged. (3) TYPED VARIABLES: Make a Variable is now
TWO prompts (name, then type int/double/bool[/string for C++]); per-var
chips gain a TYPED DECLARATION chip (new int score = 0;) - fixes 'variable
type definition missing'; types persist (blockide-vartypes). (4) FORGIVING
DROPS: variable reporters dropped anywhere ON a statement block fill its
nearest compatible socket (no pixel-perfect aiming) - cout/cin operands now
take variable blocks naturally. (5) RESEARCH: docs/COMPETITOR-RESEARCH.md
(Scratch/Blockly/MakeCode/Tynker/Snap/hybrids/dead Arduino block tools +
Weintrop transition studies + Blockly's Ten Things): success = no syntax
errors, category discipline, live feedback, off-ramps, ownership; failures
= unsolved blocks->text transition (read-only JS buttons, one-way
generation), authenticity gap, abandoned C-family block tools, paywall
trust, no mastery mechanics; Cade's wedge = TRUE bidirectional blocks<->real
files + real sandboxed toolchains + multi-language + memory viz; six
prioritized gap-closers recorded. GATE FINDS: var chip count 3->4 (typed
declaration) - assertions updated. vitest 35/35; ALL FOURTEEN gates PASS
exit 0 (48 UI assertions).
state=SUCCESS | next: user eyes-on (cin flow!); gap-closers from research doc
```

```
RUN 36: trigger=user: rename project to "Cade"
expect: user-visible branding renamed everywhere; nothing breaks
obs: renamed window title, tab title, splash h1, toolbar wordmark, tour
welcome, style header, docs, branding README; tauri productName block-ide
-> Cade (installer becomes Cade_0.1.0_x64-setup.exe). IDENTIFIERS KEPT:
com.blockide.dev app-id (renaming orphans the user's profile/journal data
dir), BLOCKIDE_* env vars, blockide-* storage keys + temp dirs, crate
names, repo folder — invisible to users, renaming = pure risk. PLAN title
Rev 2 + D12 decision row records the rename + the kept-identifiers rule.
Historical receipts keep the old name (history, not branding).
state=SUCCESS | next: multi-language packs (D11, in flight) + stdin/var-type fixes
```

```
RUN 35: trigger=user: per-language bricks/panel, namespace blocks instead of
std blocks, blocks depending on other blocks, NO splash timer, Blender-like
recent files
expect: C and C++ palettes differ; dep-gated chips; splash stays until
choice; recents two-line + Open Folder footer; gates green
obs: (1) PER-LANGUAGE PALETTE: PaletteItem.langs - Code group now splits:
C keeps stdio family (printf/printf %d/scanf, each requiring the stdio.h
include), C++ gets #include <iostream>, cout text/value, cin >> value,
using namespace std (namespace chip in Functions, toplevel), define class
(Structs, toplevel), try/catch (Control). (2) DEPENDENCY RULE (Scratch
grammar-gating from PLAN 1.3): PaletteItem.requires {kind,include} -
chips render .pal-dep (dashed + link icon + tooltip) until the program
contains the prerequisite; clicks explain instead of splicing broken code.
else needs if_statement, case+break needs switch_statement, stdio/iostream
chips need their #include (include chips themselves splice at TOP via
insertTop payload). Palette rebuilds on a program SIGNATURE (node kinds +
includes + harvested vars) so deps re-evaluate live. (3) SPLASH: countdown
removed entirely - stays until C or C++ clicked; Open Folder footer button
(loads session then fires the folder dialog). (4) RECENTS Blender-style:
bold filename + dim path two-line entries, hover highlight, empty-state
hint. GATE FINDS: (a) execFileSync args is a POSITIONAL param, not an
option key - every 'cpp' vitest parse had silently run as C; fixed in all
helpers (cpp tests now genuinely exercise tree-sitter-cpp); (b) ev() cannot
return DOM elements (unserializable) - class assertions moved inside page
expressions; (c) splash markup exists before module eval completes (pixi
top-level await) - added window.__bootDone flag, gate polls it before
clicking; reload section polls splash-interactive then session-ready
instead of fixed sleeps. vitest 35/35; ALL FOURTEEN gates PASS exit 0
(46 UI assertions); screenshot verified timerless splash + Open Folder.
state=SUCCESS | next: user eyes-on; vanilla install drill (manual, Gate 5)
```

```
RUN 34: trigger=user: Blender-style launch splash - language choice + recent
files at startup, C auto-starts if untouched
expect: splash at every launch (C preselected + countdown, C++ card, recent
list); choice loads that language's sample/blocks/backend; gates green
obs: #splash overlay (fixed, blurred backdrop) with C/C++ cards, recent
list (localStorage blockide-recent, top 6, recorded on open+save), 8.2s
countdown bar -> beginSession('c') unless engaged (any pointerdown cancels
the timer so readers are not rushed). beginSession: journal restore FIRST
(unsaved work overrides sample; language rides the journaled path),
CPP_SAMPLE mirrors SAMPLE's statement shape (total/for i<5/return 0) so
ALL existing gate assertions hold for either launch language, then render +
tour. Recent click: opens folder + tab, language from the file extension;
missing files report instead of crashing. BOOT RESTRUCTURED: no render
before the splash - textarea/palette fill only after choice (or timeout);
tour now fires post-splash, not on a module timer. GATE: splash section
added (shown/C-preselected/default-c/recents/choose-cpp->cpp-session+
iostream sample/dismissed) - fixed-position overlay needed computed-display
visibility check (offsetParent is null for fixed elements); stale
'default buffer is C' assertion moved BEFORE the C++ choice. Screenshot:
splash card verified visually; auto-start verified (post-timeout capture
shows C session, status 'parsed clean (C)'). vitest 35/35; ALL FOURTEEN
gates PASS exit 0 (42 UI assertions).
state=SUCCESS | next: user eyes-on; vanilla install drill (manual, Gate 5)
```

```
RUN 33: trigger=user: add C++ language
expect: C++ subset pack per D3 amendment - parse/render/diag/run .cpp files;
tcc never selected for C++; gates green
obs: D3 AMENDED (user request supersedes the v1 deferral). core-parser:
Lang enum (from_path: .cpp/.cc/.cxx/.hpp/.hh) + tree-sitter-cpp 0.23.4
(vendored via Cargo.lock); parse_c_lang/parse_canonical_lang/
canonical_source_lang/syntax_check_stderr_lang - C++ stages as main.cpp so
the clang driver infers C++ and diags reference the right stem; clang-format
already language-agnostic (style-file). runner: prepare_lang routes C++ to
the clang exe backend ALWAYS (tcc is C-only, D4 untouched); memtrace stays
C-only v1 (C header). commands: lang param on parse_c/canonicalize_c/
diag_c/run_start; list_c_files includes cpp family. frontend: activeLang
rides with activeTab (CPP_RE), cpp new-file template (iostream), status
shows (C)/(CPP), namespace_definition -> function cat. TEST FINDS:
(1) C grammar quietly accepts `class X {};` w/o error nodes - the
language MUST ride with the file (asserted grammar-selection instead of
C-rejection); (2) class renders as a DECLARATION-mouth (wraps
class_specifier, same rule as C structs) - test matched reality. VERIFIED
END-TO-END: cpp_runs_via_clang_backend (--ignored, real clang+MSVC):
iostream program compiled, ran, printed cpp-hello, exit 0. rust 21/21 +
2 cpp, vitest 35/35, ALL FOURTEEN gates PASS exit 0 (35 UI assertions).
state=SUCCESS | next: user eyes-on cpp in app (open folder w/ .cpp);
vanilla install drill (manual, Gate 5)
```

```
RUN 32: trigger=user: add all functions + math operations (comparison, + - * / etc)
expect: Scratch Operators category (round arithmetic + hex comparison/logic
reporters), expanded Functions group, shape-checked reporter drops; gates green
obs: NEW Operators group (Scratch green #59C059, unlock tier 5): 5 round
arithmetic reporters (a+b .. a%b) + 9 hex comparison/logic reporters
(== != < > <= >= && || not) - reporters carry their EXPRESSION as
slotValue and drop ONLY into matching-shape sockets (reporterFits: round
-> ident/number, hex -> bool), wrong-shape drops get feedback blip+hint.
Validator: arithmetic charset (operands + - * / % parens indexing) accepted
in round sockets; boolean operators (= < > ! &) deliberately EXCLUDED from
round sockets (Scratch shape split); bare token pairs ('a b') rejected -
must be single operand or operator-bearing. Functions group: call proc +
define fn (toplevel flag -> insertTopLevel splices at FILE SCOPE after last
top-level block; C never nests definitions - unit-tested incl. parse-clean).
I/O: printf %d + scanf %d chips. TWO GATE FINDS: (1) chip class was
pal-operators but CSS/gate expected pal-operator - synced; (2) CSS cascade:
.pal-reporter (variables orange) sat AFTER .pal-operators (equal
specificity) painting arithmetic ovals orange - operators rule moved below
with comment. vitest 33/33; ALL FOURTEEN gates PASS exit 0 (33 UI
assertions); screenshot verified green ovals + hexes in Operators section.
state=SUCCESS | next: user eyes-on; vanilla install drill (manual, Gate 5)
```

```
RUN 31: trigger=continue: boolean hex sockets (last applicable research item)
expect: control-statement conditions render as Scratch-style hexagonal
editable sockets; for keeps init/update granular; gates green
obs: conditionSlot() extracts the condition FIELD per control kind -
if/while/switch wrap it in parenthesized_expression so the slot spans the
INNER expression (parens render as text around the hex); for/do expose bare
expression nodes (slot = node span). Slot splices into the token stream at
byte order; buildHeader gained a MERGE BARRIER across the condition span
(the two for-`;` tokens otherwise merge into "; ;" before the slot lands -
vitest caught it). Rendering: hexagon path w/ 9px points, min width 48.
Validation: any non-empty condition accepted (C expressions too varied for
lexical checks; Rule 5 keeps broken code editable - parser+diags surface
real errors). vitest 28/28 (new bool-sockets suite incl. byte-exact splice
edit); ALL FOURTEEN gates PASS exit 0 (30 UI assertions incl. hex
commit/reject); screenshot verified hex socket in for header.
state=SUCCESS | next: user eyes-on; vanilla install drill (manual, Gate 5)
```

```
RUN 30: trigger=user: apply ALL remaining research to the project
expect: category rail, variable harvesting, rename action, Lists->arrays,
reporters fit any round socket; gates green
obs: (1) STICKY RAIL: colored dots above palette, click smooth-scrolls to
section, active dot follows scroll (Scratch's category rail, horizontal
for our 216px sidebar). (2) HARVESTING: harvestVars() walks declaration
nodes (init/array/pointer declarator identifiers) - locals+globals+arrays
appear as chips automatically; function names/params/struct fields excluded
(unit-tested); palette rebuilds only when the harvested set CHANGES (join
compare) and preserves scrollTop. (3) RENAME+DELETE via right-click menu
(Scratch parity); file-declared vars refuse menu with a hint (file is
truth). (4) LISTS: Make a List -> C arrays; chips = element reporter
`name[0]` + `int name[10];` + `name[0] = 0;` (all parse-tested); known
lists persist (blockide-lists), file-indexed vars auto-sprout list chips.
(5) SOCKET RULES: validateSlotValue moved to palette.ts - number sockets
now accept literals AND reporters (`total`, `grid[0]`) per Scratch's
round-socket taxonomy; ident sockets accept indexed idents. GATE FIX: old
"number refuses identifier" assertion contradicted the research - replaced
with junk-rejection + reporter-acceptance checks (re-fetch slot index after
each mutating commit - commits re-render). Screenshot race fixed in shot
script: wait for REAL readiness (src filled + blocksShape + palette) not
fixed sleep - top-level pixi await made 2.2s captures race cold boots.
vitest 25/25; ALL FOURTEEN gates PASS exit 0 (27 UI assertions).
state=SUCCESS | next: user eyes-on; boolean hex sockets (conditions v2)
```

```
RUN 29: trigger=user: categorize palette by type + Scratch-style variable
creation; asked for precise Scratch research first
expect: research doc; palette as category sections; Make-a-Variable spawns
reporter + set/change chips; reporters drop INTO slots
obs: RESEARCH committed as docs/SCRATCH-BLOCKS-REFERENCE.md - scratch-blocks
primaries (Motion #4C97FF ... Control #FFAB19, Variables/data #FF8C1A, My
Blocks #FF6680), shape taxonomy (hat/stack/C/cap/reporter-oval/boolean-hex),
input socket types, and the exact variable lifecycle (button -> name+scope
dialog -> oval reporter + checkbox monitor + dropdown stack blocks; reporters
replace slot contents; right-click rename/delete; runtime creation
impossible). Mapped to C: reporter=var chip dropping into ident/number
slots, set-to -> `v = 0;`, change-by -> `v = v + 1;`, delete leaves code
untouched (file is truth). NEW palette.ts: PALETTE_GROUPS (Control/Loops/
Code/Functions/Structs/Notes) + validateVarName (ident regex + C reserved
words) + varChips. Variables recolored to Scratch orange (was green).
Slot-drop: DragPayload.slotValue -> drag highlights target slot orange,
drop splices via commitSlotValue seam. E2E caught REAL BUG: data-var was
chip LABEL not variable name -> only reporter matched [data-var=score];
added VarChip.varName. vitest 21/21; ALL FOURTEEN gates PASS exit 0 (24 UI
assertions); screenshot verified grouped palette + headers.
state=SUCCESS | next: user eyes-on; var-name harvesting from parsed file
(follow-up); boolean hex sockets for conditions (v2)
```

```
RUN 28: trigger=user screenshot: block rows stretch into giant ribbons
expect: diagnose + fix width blowup; kill phantom recovery banner
obs: ROOT CAUSE: measure()'s 90px whole-block MIN-WIDTH floor was applied
PER HEADER PART - every `=`, `+`, `;`, `(` token rendered ~90px and short
slots ~106px, so rows bloated 3-5x (return row spanned half the canvas).
Fix: glyphWidth() raw text runs for parts (text = len*8.4+6, slots clamped
36..240); measure() floor kept only where a whole block needs it. ALSO:
(1) phantom "[recovery] unsaved work" banner every launch = journal entries
left by force-killed gate/test app instances; recoverJournal now silently
clears template-identical buffers (SAMPLE/NEW_TEMPLATE carry no user work);
stale entry deleted from user app-data. (2) NEW BLOCKIDE_DATA_DIR override
(commands::data_root + profile::path) so gate runs isolate journal+profile
from real user data; run_gates sets it for UI-E2E. Width test rewritten to
the real invariant (slots >=36px, text tokens <30px, header <220). CDP
screenshot verified compact rows + snug for-mouth. vitest 16/16, ALL
FOURTEEN gates PASS exit 0.
state=SUCCESS | next: user eyes-on; vanilla install drill (manual, Gate 5)
```

```
RUN 27: trigger=user: loops as mouths + sandbox/campaign split + Scratch-style
typed inline inputs + more block types (variables palette)
expect: 1.7 control statements always C-mouths (braced or not, else rows
inside); 1.8 Sandbox vs Academy modes; 1.9 ident/number/string slots with
per-type validation + Variables category
obs: THREE root-cause finds while building. (1) old labelWithoutCompounds
pushed leafText of the WHOLE node - braced loops/functions rendered as one
fat block with the entire body inside the LABEL (user's "loops look like
normal blocks"). Rebuilt header pipeline: field-based bodies (body/
consequence/alternative) skipped from header; else_clause unwrapped; braced
AND braceless loops now mouths with kids inside. (2) string_literal has
text=null (content in children) -> parts came out empty; buildHeader now
uses leafText. (3) canonical ids are dense pre-order per parse (RUN 24
lesson) - unchanged here but shaped slot splice design (byte ranges from
same parse as render). Slots: click field -> overlay input -> Enter/blur
commits via text splice; idents/numbers regex-validated w/ shake-reject,
strings auto-quote. Palette: variables cat (new int/set var/change var/
copy var) + UNLOCK_RULES tier 2. Mode split: toolbar Sandbox|Academy
(persisted); sandbox hides academy chrome + bypasses palette locks.
GATE FLAKES fixed: G-PERF now warm-up walk before the timed one (cold-cache
penalty after 12 validators is not the metric); UI-E2E run budget 30s;
gate report now records WHICH ui check failed. vitest 16/16; ALL FOURTEEN
gates PASS exit 0; CDP screenshot verified mouths+slots+palette+modes
visually.
state=SUCCESS | next: user eyes-on; vanilla install drill (manual, Gate 5)
```

```
RUN 26: trigger=v0.1.0 tag milestone (next action from RUN 24/25)
expect: versions synced at 0.1.0, NSIS installer builds, tag pushed
obs: FOUND REAL BUG in release path: copytcc used ../../third_party/...
which from app/ resolves to E:\third_party - installer could not have
rebuilt since that typo landed; fixed to ../third_party. package.json
bumped 0.0.0 -> 0.1.0 (workspace + src-tauri already 0.1.0). Installer
builds clean: block-ide_0.1.0_x64-setup.exe, 2.8 MB, tcc embedded
(resources staged + hash verified earlier). Gates: full suite green at
e446772 (RUN 25); delta since = metadata only + beforeBuildCommand re-ran
tsc/vite/cargo release inside installer build. Committed 21bcea6, pushed
with annotated tag v0.1.0.
state=SUCCESS | next: vanilla-Windows install drill (manual, Gate 5 last item)
```

```
RUN 25: trigger=user report: [error 2147942632 (0x800700e8)] launching tcc.exe
expect: diagnose 0x800700e8 (ERROR_NO_DATA, Win32 232) at spawn; make failures
visible + survivable; no regression in run path
obs: tcc.exe verified intact (hash match vs third_party; 23 KB is true size).
Could NOT reproduce (fresh launches + 3x consecutive runs all green) - but
audit exposed TWO REAL DEFECTS in the launch seam. (1) run_job spawned tcc
(console subsystem) from a GUI process WITHOUT CREATE_NO_WINDOW: Windows
allocates a fresh console per run (flicker) and child CRT init can transiently
fail with ERROR_NO_DATA against a dying parent console - matches the reported
HRESULT exactly. Fix: CREATE_NO_WINDOW + one transparent 60 ms retry.
(2) spawn_inspectable did outcome.ok(), DISCARDING launch errors -> UI spins
"running..." forever on any launch failure. Fix: InspectableRun.poll() now
returns Option<Result<RunOutcome,String>>; run_poll maps Err to
[launch] stderr + exit -1; memview_validator updated to Result shape.
Workspace tests + ALL FOURTEEN gates PASS exit 0.
state=SUCCESS | next: v0.1.0 tag (1.2 residual closed in RUN 24)
```

```
RUN 24: trigger=P1.2 residual: cursor-semantic map for Blocks/Split/Text
expect: caret survives view switches anchored to a node, not a byte offset;
scripted G-UI-E2E coverage; unit tests for the mapping
obs: NEW caret.ts pure module: pickAnchor/caretOffset. KEY FINDING mid-build:
canonical node ids are DENSE PRE-ORDER PER PARSE (canonical.rs), so any edit
recycles ids and id-first resolution FALSELY lands on unrelated nodes
(vitest caught it: pos 54 vs expected 72). Tier order fixed to kind+text
twins -> exact id (single-parse case only) -> nearest surviving edge;
deletion test forces tier-3 via impossible id (id-gone is unassertable).
main.ts: capture on keyup/mouseup/input/focus + inside setView; restore via
rAF after switching to text/split incl. scroll-to-line; anchors reset on tab/
level/journal buffer swaps; block dblclick/contextmenu anchor back into text.
blocks.ts carries node id now. G-UI-E2E gained cursor round-trip assertion
(ctrl+1 then ctrl+3, caret must land back inside its statement); also bumped
ctrl+enter poll 10s->20s: gate runs right after G-PERF disk churn and tcc
cold compile can exceed 10 s (first full-suite failure reproduced standalone,
passed in isolation -> load-timing). vitest 10/10, ALL FOURTEEN gates PASS.
state=SUCCESS | next: user eyes-on; tcc launch error triage (user report)
```

```
RUN 23: trigger=resume: finish G-SYNC-FUZZ validator (P0.5 gate, was untracked+red)
expect: 7 corpus programs x 500 ops x 2 drivers converge byte-identical;
intermediates parse clean; canonicalization idempotent; gate enforced in runner
observed: TWO REAL DESIGN BUGS found by red run. (1) whole-line Delete/Move
cuts removed extra statements from raw-text driver when a line held several
statements (canonical driver is one-per-line) -> switched to exact node spans
(statements never own parent braces). (2) Insert/Move anchored at line_start:
raw text shares a statement's line with `int main(void) {`, so insert-before
landed at TU scope on driver A (invisible to the compound-statement collector,
count unchanged) but inside the body on driver B (+1) - explains the uniform
A=n/B=n+1 divergence signature. Fix: anchor every splice/move at exact node
offsets. After fix: PASS on seeds 0x5EED..0001, ..0002, 31337 (~93 s release).
Wired into run_gates.ps1 as ENFORCED (release-only: debug would be ~10x).
ALL FOURTEEN gates PASS exit 0; PLAN Gate 0.5 marked MET for G-SYNC-FUZZ
(0.5.1/0.5.2/0.5.4 incremental-sync work remains open).
state=SUCCESS | next: cursor-semantic map (1.2 residual), then v0.1.0 tag
```

```
RUN 22: trigger=D6 view modes + Gate 5 scripted-E2E closeout
expect: per-tab Blocks/Split/Text with ctrl+1/2/3; split sync-scroll;
scripted UI gate enforced against release build
obs: segmented toolbar control + per-tab view memory + grid re-layout per
view (blocks: canvas wide; text: editor wide, stage hidden). Sync-scroll
maps text fraction to world.y. G-UI-E2E NEW ENFORCED GATE: gates script
launches RELEASE exe w/ CDP, 11 trusted assertions (view toggles, ctrl
keybindings via Input.dispatchKeyEvent, REAL Ctrl+Enter run through tcc
backend asserting [exit] in console, academy=30). First run caught stale
release exe risk - gates now test whatever binary exists; rebuilt release
before enforcing. ALL THIRTEEN gates PASS exit 0. PLAN 1.2 ✅, 5.2 ✅
(enforced), Gate 5 fully MET (vanilla install drill = only manual left).
Pushed 3d6a14c.
state=SUCCESS | next: cursor-semantic map (1.2 residual), then v0.1.0 tag
```

```
RUN 21: trigger=user: snap ghosts + drop sounds + block context menu
expect: translucent preview at insertion slot; synth blips on pick/drop/
delete; right-click Duplicate/Delete without pan hijack
obs: ghost drawn from real subtree dims (move) or measured chip (palette)
at slot; sounds = Web Audio oscillator blips (no assets, gesture-gated
context). FOUND PRE-EXISTING BUG: stage pan handler double-subtracted
hostEl rect from Pixi-global coords - header presses panned instead of
suppressed; fixed. Verification saga: synthetic dispatchEvent never
reaches Pixi v8 federated pipeline; CDP Input.dispatchMouseEvent (trusted)
does - but fresh profiles open the TOUR which covers the canvas (first
null results were #tour intercepting). Trusted-input press sweep proved
dragStarted+ghostDrawn+slotY on movable blocks; self-drops correctly
rejected (isInsideRange). Context menu verified visually (clay card,
Duplicate/Delete). Debug instrumentation removed; __hitAt kept. ALL
TWELVE gates PASS; pushed 4deb324.
state=SUCCESS | next: user eyes-on; optional notch tab on palette chips
```

```
RUN 20: trigger=user report: drop indicator misplaced + extend theme coverage
expect: dropbar lands exactly at insertion slot; puzzle-notch Scratch blocks;
theme reaches every remaining surface
obs: TWO REAL BUGS. (1) dropbar was canvas-relative inside a viewport-fixed
div - appeared offset by host rect for every drag since RUN 6; fix adds
hostEl rect + slot-top alignment incl tab depth (TD) + 4px container inset.
(2) container body fill drew in absolute space while stroke went local
(post-translate) - outlines offset from fills; unified to origin-parameterized
path builders (Pixi v8 has no Graphics.translate - tsc caught it).
Puzzle geometry shipped: mouth recess top / tab bottom / C-block floor tab /
clay drop shadows. Theme coverage: sea scrollbars, ::selection, caret,
grab cursor, green Run (Scratch flag), diag palette, editor focus ring.
CDP shot verified geometry; ALL TWELVE gates PASS; pushed 645068a.
state=SUCCESS | next: drag-drop snap ghosts + sound? (user eyes first)
```

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
