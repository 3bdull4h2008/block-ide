# Competitor & Landscape Research (2026-08-25, expanded)

Why this exists: position Cade against the tools that own "kids + blocks",
understand what made them win, what made them lose, and what their USERS say
(reviews, forums, classroom studies) — then verify Cade's architecture (real
files + real toolchains + bidirectional blocks) actually fills the gaps.
Sources: Scratch Wiki/CACM (Weintrop), Blockly team's "Ten Things We've
Learned from Blockly", Weintrop et al. transition studies (AERA 2017, IDC
2022 CodeStruct, CACM 2021, SIGCSE 2015), Mladenović et al. mediated-transfer
studies (J. Comput. Educ. 2022, SciDirect 2021), frame-based editing papers
(Kent AU'15/Bloomsbury), Common Sense Media parent+kid reviews, Trustpilot,
Code.org teacher forums, CSTA teacher blogs, i-programmer micro:bit editor
review, edukits.co Arduino-block survey, flashgamer mBlock teardown,
PCMag Stencyl review, GamesIndustry.biz GameMaker retrospective, glis-glis
GML Visual analysis, MIT App Inventor FAQ/about + MIT thesis logs, Snap!
Berkeley about/research pages, maintainer threads on GitHub.

## The field

| Product | Model | Status | Core strength |
|---|---|---|---|
| Scratch (MIT) | blocks only, community | 35M+ accounts, 40M projects | low threshold / high ceiling / wide walls; zero syntax errors; sharing culture |
| Blockly (Google) | block LIBRARY + generators | powers thousands of tools | the off-ramp playbook (see below) |
| MakeCode (Microsoft) | blocks ⇄ JS/Python dual-modality + simulator + hardware | active, big in classrooms | instant blocks⇄text toggle in ONE interface; live simulator feedback |
| Tynker | commercial courses (blocks → text) | active, subscription | huge content library, brand tie-ins (Minecraft) |
| Code.org | curated blocks courses | active, school-standard | curriculum + teacher tooling |
| Snap! (Berkeley) | Scratch-for-CS (deep abstractions) | active | first-class functions/lists/continuations — "real CS" in blocks |
| MIT App Inventor | blocks → real phone apps | 24M users, 100M apps | REAL runnable artifacts on real devices, live testing |
| Alice (CMU) | 3D storytelling blocks | legacy | narrative engagement for intro courses |
| Pencil Code / CodeStruct / Stride | hybrid blocks⇄text research | research | the transition problem made visible |
| EduBlocks (Anaconda) | blocks shaped like Python lines | active, free | each block = one line of Python; realtime text mirror |
| MicroBlocks | live blocks ON microcontrollers | active | true live coding — click a block, board reacts instantly |
| Ardublockly / BlocklyDuino / ArduBlock / S4A | blocks → Arduino C/C++ | **ABANDONED (2015–2018)** | proof C-family block tools are wanted — and die |
| mBlock (Makeblock) | Scratch 3 + Python + robot hardware | active, schools | hardware distribution machine |
| Tinkercad Circuits (Autodesk) | blocks → Arduino C++ view | active | shows real code… read-only |
| Kodu (Microsoft Research) | tile-based 3D game programming | **SHUT DOWN** (no new purchases) | controller-first creativity |
| GameMaker GML Visual (ex Drag'n'Drop) | visual scripting beside GML code | demoted to "newbie bait" | shipped the off-ramp as a first-class editor feature |
| Construct 3 / Stencyl | event-sheet / Scratch-derived game blocks | active (niche) | game feedback loops |

---

## PER-COMPETITOR: how they won, how they lost, what users say

### Scratch (MIT)

- **WON:** Low threshold, high ceiling, wide walls (Resnick's design line);
  zero syntax errors while keeping statement-by-statement authoring; a
  sharing culture where 40M+ projects remix each other; welcoming to
  populations underrepresented in CS (CACM 2021). 92% of students rate
  blocks easier than text (Weintrop SIGCSE 2015).
- **LOST:** Perception, not capability. Older kids flee it: *"I did that in
  2nd grade. It's not real coding."* (freeCodeCamp teardown of Scratch's
  "marketing problem"). Authenticity gap in Weintrop's interviews: *"if we
  actually want to program something, we wouldn't have blocks"*; *"blocks
  are limiting… there is not a block for everything."* Deliberate language
  limits (no procedures-with-return for decades, weak data structures —
  documented by the Snap! team) cap the ceiling. Classroom gains do NOT
  persist: after the block cohort moved to Java, the significant advantage
  evaporated by week 10 (AERA 2017 follow-up).
- **USERS SAY:** Beloved by parents of 5–11s; "babyish" by 12+. The
  community is the moat — nobody leaves because of features, they age out.

### Blockly (Google) + Blockly Games

- **WON:** As a LIBRARY it quietly powers thousands of tools. Its team's
  published lessons are gold: category/color discipline fixes real confusion
  ("moved conditionals out of Loops, changed the color, and the problem went
  away"); graduated off-ramps work (Blockly Games shows the JS after every
  level, final level IS a text editor); kids hate fill-in-the-blank —
  ownership of their own solutions beats puzzle grids; instructions must
  verify the action before closing or nobody reads them.
- **LOST:** Generation is one-way — blocks emit code, nothing parses back.
  Every Blockly-based product inherits the same ceiling: the moment you need
  the text, you leave the blocks behind forever. Also inherited: mouse-only
  manipulation scales terribly (frame-based editing papers: assembling √(x²+y²)
  costs eight drags vs 13 keystrokes).
- **USERS SAY:** Developers love the library; end-kids never see "Blockly" —
  they see whichever wrapper they're in. The library's success IS the
  symptom: everyone needs blocks, nobody has solved them.

### MakeCode (Microsoft)

- **WON:** Dual-modality done most seriously: one click toggles blocks⇄JS⇄Python
  over the SAME program, plus a live simulator and $15 hardware (micro:bit)
  for tangible feedback. Mediated-transfer RCTs (Croatia, 49–163 sixth-graders,
  2021/2022): starting in MakeCode then bridging to Python SIGNIFICANTLY
  reduced variables/sequencing/selection/loops misconceptions vs text-only
  teaching. Teachers report students "hooked," struggling kids lighting up
  (CSTA 2025 classroom write-up).
- **LOST:** The bridge only carries you TO text. Text edits don't become
  blocks (the mapping is one-directional in practice); the early micro:bit
  editors shipped "nothing like adequate debugging… no breakpoints, no
  variable inspector" (i-programmer); the compile→flash→run loop is slow
  whenever the simulator can't fake the real thing. Mastery mechanics
  (spaced retrieval, adaptive paths) simply aren't there.
- **USERS SAY:** Educators: best-in-class free tier, hardware magic. The
  recurring critique from researchers: great WELCOME, weak EXIT — the same
  wall as everyone else, just further away.

### Tynker

- **WON:** Distribution: Minecraft/Barbie/drone/LEGO branding, Apple Education
  featuring, claims of 60M kids and thousands of schools, a real course
  ladder from blocks to JavaScript/Python/Swift. Parents like the inviting,
  colorful entry (Common Sense Media).
- **LOST:** Trust and quality. This is the field's cautionary tale of
  paywall-first monetization on a children's product.
- **USERS SAY (the receipts):**
  - Common Sense Media kid consensus: *"glitchy, poorly designed, and
    inferior to free alternatives like Scratch… lost progress… heavy
    reliance on paid subscriptions."*
  - Trustpilot is a wall of billing horror: *"charging $240… no way to
    cancel"*, *"tried for 3 years to cancel my subscription"*, *"charged
    during my free trial… rude agents"*, *"fraudulent billing practices"*,
    *"autosave doesn't work… sometimes doesn't even save your progress."*
  - App Store: freezes on remix, purchases denied refunds against their own
    30-day guarantee.
  - Product: the "JavaScript button" on block exercises is READ-ONLY — a
    fake bridge. Basic blocks missing; buggy execution.
- **LESSON:** For kids' software, trust = free + offline + never lose work +
  honest billing. One bad renewal story becomes a lifetime "stay away."

### Code.org

- **WON:** School-standard curriculum + teacher tooling + Hour of Code;
  integrated IDE; blocks AND text toggles in App Lab/Game Lab; Google
  Classroom integration; free. New teachers call it "the best curriculum to
  start with" (AP CSP teacher write-ups).
- **LOST:** Curriculum revisions broke hard-won momentum: teacher forum
  (2020): *"Coding has gone from being my students' favorite part of the
  course to being their least favorite"* — even top students derailed by
  parentheses/quotes friction once text arrived. Forum verdicts on the text
  side: *"It isn't really Javascript"* / *"obviously written for blocks…
  awkward to use for text"* / interpreter "many versions out of date."
  Activity-only pedagogy frustrates teachers wanting guided notes.
- **USERS SAY:** Grateful teachers, frustrated students at exactly the
  blocks→text seam. Nobody praises App Lab's text mode.

### Snap! (Berkeley)

- **WON:** Proved blocks can carry REAL computer science: first-class lists,
  procedures, continuations — recursion, higher-order functions, user-BUILT
  control structures — in a Scratch skin. Backbone of Berkeley's BJC + AP CS
  Principles pilots; explicitly designed so 14–20 year olds keep the
  Scratch superpower past puberty.
- **LOST:** Still blocks-only (no text twin), still perceived as
  Scratch-plus rather than professional-track; adoption concentrated in the
  BJC community. The deeper lesson they prove: shape-as-semantics teaches
  (their words: the three block shapes "teach that some procedures return
  values") — Cade's hex/oval split is the same trick.
- **USERS SAY:** CS teachers revere it; kids outside BJC rarely meet it.

### MIT App Inventor

- **WON:** 24M+ users, 100M+ apps, ~1M monthly actives across 200 countries
  (MIT FAQ 2025): the largest proof that BLOCKS SHIP REAL ARTIFACTS — apps
  running on actual phones, live-tested over USB/WiFi. MIT thesis logs show
  learners broaden skills for ~10 projects then deepen them.
- **LOST:** Event-driven app model ≠ general programming; the jump to
  Java/Kotlin text remains an unmaintained leap; Android-first history.
- **USERS SAY:** Empowerment stories everywhere (social-impact apps by
  teens); complaints center on the live-test connection and webview limits,
  not the model.

### Alice (CMU)

- **WON:** Storytelling-as-programming for intro courses; a generation of
  research on novice 3D environments.
- **LOST:** Heavy runtime, 3D art overhead distracting from code concepts,
  slow release cadence; Java-transition studies around it fed the same
  Weintrop literature: initial engagement ≠ durable transfer.

### Pencil Code / CodeStruct / Stride (research hybrids)

- **WON (as knowledge):** They mapped the transition design space —
  Lin & Weintrop's taxonomy: ONE-WAY export (Blockly, VEX VR) vs DUAL-MODALITY
  (Pencil Code, BlockPy, MakeCode, Tiled Grace) vs HYBRID (frame-based
  editing, Stride; only ~3 fully hybrid environments ever counted).
  CodeStruct (IDC 2022) showed an intermediary that keeps Scratch's toolbox/
  holes while typing real Python REDUCED syntax mental demand and type
  errors. Frame-based work (Kent) showed keyboard support is the missing
  ingredient for scaling blocks beyond beginners.
- **LOST:** None escaped the lab into a maintained mass product. The gap is
  open BY THE RESEARCHERS' OWN CONCLUSION: "fertile grounds yet to be
  tilled."
- **CADE NOTE:** Cade is a production-grade DUAL-MODALITY environment with a
  true bidirectional file-truth model — the exact quadrant the literature
  begs for and industry never shipped.

### EduBlocks (Anaconda)

- **WON:** Blocks that LOOK like the target text (one block = one line of
  Python/HTML), realtime text mirror, free curriculum, Anaconda stewardship,
  micro:bit/rPi reach. Right idea: make blocks and text visibly identical.
- **LOST:** Peer-reviewed usability evaluation (INTERACT 2023) found the
  interface itself hinders the transition it exists for, deriving seven
  design guidelines for hybrids; generation remains one-way (text mirror is
  read-only); Python-flavored subset only.
- **USERS SAY:** Teachers adopt it as a stepping stone; the literature
  documents the stumble.

### MicroBlocks

- **WON:** TRUE live coding on hardware: click a block, the board responds
  instantly — no compile/download cycle; code keeps running standalone.
  The strongest live-feedback loop in the entire field.
- **LOST:** Scope: microcontrollers only, no path to desktop/general code,
  no text twin.
- **LESSON FOR CADE:** Our ≤150 ms run loop and instant stage replay chase
  the same dopamine; MicroBlocks proves latency IS the product.

### The Arduino C-family graveyard (Ardublockly, ArduBlock, BlocklyDuino, S4A)

- **WON:** Demonstrated durable DEMAND for blocks-that-become-C: hobbyists
  and teachers kept building/forking them for a decade.
- **LOST (all of them, same way):**
  - ArduBlock: "no longer maintained" (maintainer repos archived; pinned to
    Arduino IDE 1.6.x era).
  - Ardublockly: no meaningful updates since ~2017/2018; 100+ open GitHub
    issues; macOS security-warning install; requires a separate Arduino IDE
    configured by hand; fragmented incompatible forks (edukits.co survey).
  - S4A (Scratch for Arduino): frozen fork of ancient Scratch offline.
  - Root causes: version-lock-in to a moving host IDE, volunteer burnout,
    and one-way generation with no reason to stay once text was needed.
- **WHY THIS MATTERS TO CADE:** We are building the thing they tried to
  build (real C from blocks) — their graves mark the mines: bundle the
  toolchain (we do: vendored tcc/clang), own the whole pipeline (we do),
  keep the text editable in place (file-is-truth), and ship as a product
  with gates, not a weekend generator.

### mBlock (Makeblock)

- **WON:** Hardware Trojan horse: ships inside every Makeblock robot kit;
  Scratch 3 base plus a Python mode and AI/IoT modules; clean three-panel UI
  (educators' Erasmus assessment: "quite simple and clear… with just one
  click, you can view the Python codes behind the blocks").
- **LOST:** Software craft. The definitive teardown (flashgamer, veteran
  maker educator): unsupported Scratch blocks sit visible and "FAIL
  SILENTLY — you have a kid sitting there thinking that both the robot and
  programming is stupid"; stray clicks CORRUPT programs into red Undefined;
  the Arduino code preview "nobody ever cared how it looked — very limited
  educational value"; official examples don't run; support forum abandoned
  by staff; vendored third-party libraries with stripped licenses.
- **USERS SAY:** Schools buy the robots and tolerate the software; the
  maker community routes around it.
- **LESSON:** Showing generated code is only educational if the code is
  CLEAN and HONEST. Cade's clang-format-canonical emission + mystery-block
  rendering of ERROR nodes is the direct counter-design.

### Tinkercad Circuits (Autodesk)

- **WON:** Zero-install browser simulation of Arduino; blocks that display
  their C++ — millions of classroom hours.
- **LOST:** The C++ pane is a MIRROR, not an editor: "you can't edit the
  text and change blocks" — one-way again, plus toy-scale components.
- **LESSON:** Even a READ-ONLY glimpse of real code is valued enough to be a
  headline feature. Bidirectionality is strictly better.

### Kodu (Microsoft Research)

- **WON:** Genuinely novel controller-first tile language; research +
  book + NCWIT partnerships; taught sequencing to kids too young to type.
- **LOST:** Closed platform (Xbox 360/XNA lineage), then shutdown — no new
  purchases supported (official FAQ). Platform-dependent visual languages
  die with their platforms. Cade: local files + open toolchains survive.

### GameMaker GML Visual / Construct / Stencyl (game-engine wing)

- **GameMaker:** Drag'n'Drop existed for 20+ years, got renamed GML Visual,
  and is treated BY ITS OWN MANUAL AND COMMUNITY as newbie bait: "you'll
  waste time learning GML Visual… drop it within weeks and never come back"
  (glis-glis analysis); GamesIndustry.biz: a strength for novices, a shadow
  for professionals. The company itself demoted it. Lesson: a visual mode
  with no dignity dies of churn even when the host engine thrives.
- **Stencyl:** Scratch-derived Design Mode; PCMag 2024: accessible, BUT
  "my overall game development education suffered slightly… Construct and
  GameMaker better incorporate optional advanced coding into their visual
  workflows"; marketplace ghost town, barely top-30 on itch.io. Visual-only
  ceilings again.
- **Construct 3:** event sheets scale further than blocks precisely BECAUSE
  they read like structured text — the closest commercial cousin of hybrid
  editing; still no real bidirectional source-code truth.

---

## What makes them successful (cross-cutting patterns)

1. **No syntax errors at entry.** Drag-drop + shape matching remove the #1
   frustration (92% of novices rate blocks easier — SIGCSE 2015). Blocks
   prevent ~70% of novice errors before they exist (freeCodeCamp analysis).
2. **Color/category discipline.** Blockly: moving conditionals out of Loops
   "and the problem went away." Categories ARE pedagogy. (Cade: palette
   sections + rail dots + Scratch primaries.)
3. **Immediate, visible feedback.** MakeCode's simulator, MicroBlocks'
   live board, App Inventor's live test — every beloved tool collapses the
   edit→run gap to near zero. (Cade: 18.5 ms hello-world, stage panel.)
4. **An OFF-RAMP with dignity.** Blockly Games' graduation ladder; MakeCode's
   one-click toggle; the research consensus that dual-modality reduces
   misconceptions (Mladenović 2021/2022). Tools whose text mode is a
   read-only mirror or "newbie bait" (Tynker button, Tinkercad pane, GML
   Visual) strand their graduates.
5. **Real artifacts create real pride.** App Inventor's 100M apps; MakeCode's
   physical micro:bit; Scratch's shared projects. Kids can tell the
   difference between a sandbox and the real world — the authenticity gap
   quote again: "if we actually want to program something, we wouldn't have
   blocks."
6. **Ownership beats puzzles.** Blockly's data: kids hate fill-in-the-blank;
   chaining FROM THEIR OWN solution works. Instructions only get read when
   popups verify the action before closing.
7. **Community/sharing as retention moat.** Scratch's remix culture ages
   kids IN; absence of it ages them OUT elsewhere.

## How they lose (failure taxonomy, with evidence)

1. **The unsolved transition.** Block-condition advantages vanish in Java
   within 10 weeks (AERA 2017); hybrid/bidirectional named THE open design
   direction (CACM 2021); only ~3 fully hybrid environments ever catalogued
   (Lin & Weintrop 2021).
2. **Authenticity gap.** "Not real coding" exodus at 12+ (Scratch marketing
   problem); blocks perceived as limiting (Weintrop interviews).
3. **One-way generation.** Blockly, Tinkercad, EduBlocks mirror, Tynker's
   read-only JS — none parse text back into blocks. Bidirectional on a real
   file is effectively unheard of in shipped products.
4. **The C-family graveyard.** Ardublockly/ArduBlock/BlocklyDuino/S4A died
   of version-lock-in, IDE dependency, maintainer burnout — while demand
   persisted (forks, issue trackers, 2025 comparison posts shopping for a
   successor).
5. **Robustness + trust.** Tynker: lost progress + billing traps =
   lifetime brand damage (Trustpilot/CSM corpus). mBlock: silent failures
   teach kids "programming is stupid." Replit-in-classroom complaint:
   "inexcusable to use a language with bugs in K-12… no auto-save."
6. **No mastery mechanics.** Spaced retrieval/adaptive paths absent across
   the field (MakeCode critique; Code.org activity-fatigue thread).
7. **Platform decay.** Kodu buried by Xbox sunset; S4A frozen by Scratch
   offline EOL; micro:bit v1 editors stranded by browser API churn. Tools
   tied to dying hosts die with them.
8. **Scaling walls.** Mouse-drag expression assembly loses to keyboards
   (frame-based papers); blocks don't navigate/refactor large programs;
   nobody over ~14 chooses drag-drop for big code voluntarily.

## Cade's wedge (what we already do that NOBODY ships)

- **True bidirectional**: the .c/.cpp/.py/.js/.rs file on disk is the single
  truth; blocks are a live projection; edits land in BOTH directions
  (G-SYNC-FUZZ differential proves convergence byte-identically). The field's
  #1 open problem, answered architecturally.
- **Real toolchains, sandboxed**: tcc/clang/python/node/rustc compile and RUN
  in a job-object jail — not a simulator, not paste-it-elsewhere. Diagnostics
  map onto the exact offending block (clang stderr → nodeId outlines).
- **Multi-language from one editor**, per-language palettes, language rides
  the file extension — the off-ramp is built-in (switch views, not products),
  and the palettes TEACH each dialect's operators (python and/or/not vs &&).
- **Free, offline, no accounts, no telemetry** — Scratch-grade trust aimed at
  Tynker's corpse; crash journal means work is never lost (their #1 rage
  trigger).
- **Memory visualizer** (stack boxes, pointer arrows from ReadProcessMemory):
  nothing in the field makes C memory tangible for learners.
- **Clean canonical emission** — every block edit lands clang-formatted;
  mBlock's red-Undefined corruption and unreadable previews cannot happen
  here by construction.
- **Mystery-block ERROR editing** — broken code stays editable (Rule 5),
  killing the silent-failure class mBlock embodies.

## Gap-closers this research mandates (prioritized next-work candidates)

1. **Off-ramp ladder** (Blockly playbook, now research-backed): show the real
   formatted code after every run; a graduation mode where block headers
   become typed text. — answers patterns #4/#8.
2. **Own-solution chaining** in Academy levels (level N+1 starts from the
   student's level N solution). — pattern #6, cheap on our runner.
3. **Context-aware Academy instructions** (popup closes when the action is
   performed). — Blockly's proven instruction rule.
4. **Mastery/spaced-repetition scheduling** over the 30-level suite. — the
   field-wide hole (#6).
5. **Keyboard-first block manipulation** (type to filter palette, arrow-key
   slot cycling) — frame-based research says this decides whether anyone
   past 14 stays. — failure #8.
6. **Never-lose-work hardening**: journal exists; add rotating backups.
   — Tynker/mBlock rage-proofing (#5).

## Source ledger (primary evidence per claim)

- Scratch numbers/perception: CACM 2021 Weintrop column; Scratch stats via
  same; freeCodeCamp "Scratch Has a Marketing Problem" (2016).
- Transition studies: Weintrop AERA 2017 (Java persistence); Weintrop CACM
  2021 (authenticity quotes, hybrid direction); Kazemitabaar et al. IDC 2022
  (CodeStruct); Lin & Weintrop J. Comput. Lang. 2021 taxonomy; Kent
  frame-based position papers (keyboard scaling); SIGCSE 2015 SRC (92%).
- Mediated transfer: Mladenović et al., J. Comput. Educ. 2022 + Computers &
  Education 2021 (MakeCode→Python misconception reduction, n=49/163).
- Blockly lessons: Google Blockly team, "Ten Things We've Learned from
  Blockly" (category discipline, off-ramps, ownership, verified popups).
- Tynker reviews: Common Sense Media parent/kid pages; Trustpilot tynker.com;
  Apple App Store reviews; Tynker refund policy page.
- Code.org: code.org teacher forum (Unit 3/4 struggles 2020; App Lab "not
  real Javascript" 2023); AP CSP teacher resource write-ups.
- MakeCode/micro:bit: CSTA blog 2025 classroom report; i-programmer BBC
  micro:bit editor review (debugging gaps).
- App Inventor: MIT App Inventor FAQ/About (24M users, 100M apps, survey
  demographics); MIT thesis on CT progression logs.
- Snap!: snap.berkeley.edu about/research (first-class semantics, BJC/AP).
- Arduino graveyard: letsgoING ArduBlock repo notice; carlosperate/ardublockly
  tracker state; edukits.co Code Kit vs Ardublockly (2025); emalliab 2016
  field notes (Nano hack, IDE dependency).
- mBlock: flashgamer mBot teardown (silent failures, corrupted blocks, code
  preview neglect, forum abandonment); Greek Erasmus educators' assessment
  (UI praise, Python toggle).
- Kodu: kodugamelab.com FAQ (shutdown/no purchases).
- Game wing: PCMag Stencyl review (2024); GamesIndustry.biz GameMaker
  retrospective; glis-glis "Why you shouldn't use GML Visual" (2023).
- EduBlocks/MicroBlocks: edublocks.org; opensource.com hands-ons; INTERACT
  2023 EduBlocks usability study (seven guidelines).
