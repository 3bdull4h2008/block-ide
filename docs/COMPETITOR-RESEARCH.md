# Competitor & Landscape Research (2026-08-25)

Why this exists: position Cade against the tools that own "kids + blocks",
understand what made them win, what users say they failed at, and what gap
Cade's architecture (real files + real toolchains + bidirectional blocks)
actually fills. Sources: Scratch Wiki/CACM, Blockly team's "Ten Things
We've Learned from Blockly", Weintrop et al. transition studies (AERA 2017,
IDC 2022 CodeStruct, CACM 2021), Common Sense Media reviews, The Learning
Standard MakeCode review, Arduino block-tool surveys + maintainer threads.

## The field

| Product | Model | Status | Core strength |
|---|---|---|---|
| Scratch (MIT) | blocks only, community | 35M+ accounts, 40M projects | low threshold / high ceiling / wide walls; zero syntax errors; sharing culture |
| Blockly (Google) | block LIBRARY + generators | powers thousands of tools | the off-ramp playbook (see below) |
| MakeCode (Microsoft) | blocks ⇄ JS/Python dual-modality + simulator + hardware | active, big in classrooms | instant blocks⇄text toggle in ONE interface; live simulator feedback |
| Tynker | commercial courses (blocks → text) | active, subscription | huge content library, brand tie-ins (Minecraft) |
| Code.org | curated blocks courses | active, school-standard | curriculum + teacher tooling |
| Snap! | Scratch-for-CS (deep abstractions) | active | first-class functions/lists — "real CS" in blocks |
| Pencil Code / CodeStruct / Stride | hybrid blocks⇄text research | research | the transition problem made visible |
| Ardublockly / BlocklyDuino / ArduBlock | blocks → Arduino C/C++ | **ABANDONED (2016–2018)** | proof C-family block tools are wanted — and die |

## What makes them successful (patterns)

1. **No syntax errors at entry.** Drag-drop + shape matching remove the #1
   frustration. Blockly: "block-based programming prevents syntax errors
   while retaining statement-by-statement authoring."
2. **Color/category discipline.** Blockly moved conditionals out of the
   loops group, changed the color, "and the problem went away." Categories
   are pedagogy, not decoration.
3. **Immediate, visible feedback.** MakeCode's live simulator is repeatedly
   cited as its biggest strength — see the result the instant code changes.
4. **An off-ramp.** Blockly Games' graduated exit: lowercase keywords →
   show the JS after every level → blocks BECOME JavaScript → final level is
   a text editor. "Block environments must have a concrete plan for
   graduating their students. A solid exit strategy placates those who argue
   blocks aren't real programming."
5. **Community/ownership.** Scratch's sharing; Blockly found kids HATE
   fill-in-the-blank exercises ("no sense of ownership") — free-form work
   using the student's OWN previous solution as the next start works better.

## What they failed to deliver (evidence)

1. **The transition is unsolved.** Weintrop's classroom studies: block
   gains did NOT persist to Java; "one modality is not inherently better";
   hybrid/bidirectional editing is named THE open design direction. Tynker's
   "JavaScript button" on block exercises is READ-ONLY — a fake bridge.
2. **Authenticity gap.** Kids: "if we actually want to program something, we
   wouldn't have blocks." Blocks that generate real, compilable, RUNNABLE
   code in a REAL language directly answer this; almost nobody does it.
3. **One-way generation everywhere.** Tinkercad shows Arduino C++ from
   blocks but "you can't edit the text and change blocks." MakeCode's text
   edits don't round-trip back to blocks. Blockly generates — it never parses
   back. **Bidirectional blocks⇄text on a real file is effectively unheard of.**
4. **C-family block tools are graveyard.** Ardublockly last meaningful
   update 2017; users report "waiting for IDE output" breakage, no setup(),
   no realtime code view, Blockly version lock-in ("a real struggle to keep
   it updated" — maintainers). The demand exists; nothing maintained serves it.
5. **Robustness + trust.** Tynker's reviews: glitchy, lost progress,
   paywall-heavy, "inferior to free alternatives." Trust = free, offline,
   never lose work.
6. **No mastery mechanics.** MakeCode critique: no spaced retrieval, no
   adaptive path, no mastery gates — exploration without retention design.
7. **Instructions don't work.** Blockly: kids don't read instructions in any
   form until popups VERIFY the action before closing.

## Cade's wedge (what we already do that they don't)

- **True bidirectional**: the .c/.cpp/.py file on disk is the truth; blocks
  are a live projection and edits land in BOTH directions. Nobody in the
  field ships this on real toolchains.
- **Real toolchains, sandboxed**: tcc/clang/rustc/python/node compile and
  RUN in a job-object jail — not a simulator, not paste-it-into-another-IDE.
- **Multi-language from one editor** with per-language palettes and a
  language-riding file format — the off-ramp is built-in (switch views, not
  products).
- **Free, offline, no accounts** (Scratch-like trust, Tynker's weakness).
- **Memory visualizer** (pointers as arrows) — nothing in the field makes
  C memory tangible for learners.

## Gaps to close (prioritized next-work candidates)

1. **Blocks⇄text side-by-side editing parity** (Split mode is close; make
   text edits flow into blocks at keystroke granularity — P0.5 incremental
   sync) — directly answers the field's #1 open problem.
2. **Off-ramp ladder** (Blockly playbook): show the real code after every
   run; a "blocks→text" graduation mode where block text becomes the code.
3. **Context-aware instructions** for the Academy (popup closes when the
   action is performed) — Blockly's proven pattern.
4. **Own-solution chaining** in Academy levels (level N+1 starts from the
   student's level N solution) — ownership beats fill-in-the-blank.
5. **Mastery/spaced-repetition mechanics** in the Academy — MakeCode's
   criticized gap; cheap to add to the existing level runner.
6. **Never-lose-work hardening** (journal + autosave already exist; add
   cloud-less backup rotation) — Tynker's most-hated failure is free trust.
