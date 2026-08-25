# Scratch 3.0 Block System — Precise Reference (for Cade fidelity)

Sources: Scratch Wiki (Block Categories, Variable), scratch-blocks source
colours (via scratch-modding docs + scratchblocks color threads), CS50
Scratch notes. Hexes below are the scratch-blocks `colourPrimary` values.

## 1. Palette layout

- LEFT: a vertical category rail — one button per category, each with a
  colored dot/icon. Clicking scrolls the palette to that section.
- RIGHT: a scrolling palette divided into sections, one per category, in
  fixed order: Motion, Looks, Sound, Events, Control, Sensing, Operators,
  Variables, My Blocks (+ optional extensions below).
- Each section's blocks share ONE color. The category color IS the
  classification — kids navigate by color first, text second.

## 2. The 9 core categories (scratch-blocks primaries)

| Category   | Hex       | Contents (shape mix)                    |
|------------|-----------|-----------------------------------------|
| Motion     | `#4C97FF` | 15 stack + 3 reporters                  |
| Looks      | `#9966FF` | 17 stack + 3 reporters                  |
| Sound      | `#CF63CF` | 8 stack + 1 reporter                    |
| Events     | `#FFBF00` | 6 hats + 2 stack                        |
| Control    | `#FFAB19` | 1 hat, 5 C-blocks (if/else, repeat, forever…), 3 stack, 2 cap |
| Sensing    | `#5CB1D6` | 3 stack, 5 booleans, 10 reporters       |
| Operators  | `#59C059` | 11 reporters + 7 booleans (arithmetic, comparison, logic) |
| Variables  | `#FF8C1A` | 4 stack + 1 reporter (+ Lists `#FF6680` subcategory) |
| My Blocks  | `#FF6680` | user-defined procedure hats/calls       |

Note: Control (#FFAB19, light amber) and Variables (#FF8C1A, deeper orange)
are deliberately close — both "data/flow" warm tones; they are still
distinguishable by shade.

## 3. Block shapes (the type system kids SEE)

| Shape       | Meaning                          | Geometry                        |
|-------------|----------------------------------|---------------------------------|
| Hat         | script start (event trigger)     | domed top, tabbed bottom        |
| Stack       | statement; snaps above/below     | notch on top, tab on bottom     |
| C-block     | contains sub-stacks (loop/if body)| mouth recess + inner rows      |
| Cap         | terminates a stack               | flat bottom, no tab             |
| Reporter    | produces a value                 | fully-rounded (oval) ends       |
| Boolean     | produces true/false              | hexagonal pointed ends          |

Reporters/booleans are NOT stackable — they only fit into matching inputs.
A boolean input socket is hexagonal; a number/text socket is a rounded
rectangle; a variable-reporter fits any round socket.

## 4. Input (slot) types

`text`/`number` → white rounded rect, dark text, editable inline.
`boolean` → hexagonal socket (empty shows hexagon hole).
`dropdown` → colored field with `v` arrow (e.g. variable picker).
`color` → swatch. `angle` → dial. Reporters dragged in REPLACE the slot's
content; dragging a value OUT of a slot reverts it to its default.

## 5. Variables — the exact lifecycle (Scratch-faithful)

1. **Creation**: "Make a Variable" button sits at the TOP of the Variables
   palette section. Clicking opens a dialog: name field + scope choice
   ("For all sprites" = global / "For this sprite only" = local) + OK/Cancel.
   Variables can NOT be created by scripts at runtime — only via this button.
2. **After OK**, three things appear in the Variables section:
   - an orange oval **reporter** `(variableName)` at the top of the section,
   - a **checkbox** next to it (toggles the on-stage monitor/watcher),
   - the stack blocks now target it via their variable dropdown:
     `set [variable v] to (0)` · `change [variable v] by (1)` ·
     `show variable [v]` · `hide variable [v]`.
3. **Use**: the reporter drags into any round input (number/text sockets,
   other blocks' dropdowns are separate). Clicking an isolated reporter on
   the canvas pops a value bubble.
4. **Monitors** (watchers): default = name: value row; double-click (or
   right-click) cycles normal → large readout → slider (slider range is
   configurable). Orange = user variables; other monitor colors are
   system-owned (blue position, violet size, …).
5. **Rename/Delete**: right-click the variable reporter (or its dropdown
   entries) → "Rename variable" / "Delete variable". Deleting removes every
   block that referenced it (they turn into empty references).
6. **Scope**: local variables belong to one sprite (clones get copies);
   globals are visible everywhere. Cloud variables (server-stored) exist
   for published projects only.

## 6. Cade mapping decisions (C semantics, Scratch UX)

| Scratch concept            | Cade equivalent                              |
|----------------------------|---------------------------------------------------|
| category rail + sections   | sticky rail dots (click = jump, active follows scroll) + colored section headers |
| stack block                | statement row (notch/tab geometry, already shipped)|
| C-block                    | control mouth (1.7)                                |
| reporter oval              | variable chip + arithmetic reporters (`a + b` … `a % b`) — drop into ident/number sockets |
| boolean hex                | hexagonal CONDITION sockets on control headers (1.12) + hex comparison/logic reporters (`a == b` … `a || b`, `not`) that drop into them (1.13) |
| "Make a Variable" dialog   | name prompt; scope N/A (C scoping is the code's job)|
| `set (v) to (0)`           | `v = 0;`                                           |
| `change (v) by (1)`        | `v = v + 1;`                                       |
| reporter into slot         | replaces the slot's byte-range via the text splice seam |
| rename/delete variable     | right-click menu; code untouched (file is truth — Rule 1)|
| variables "for this sprite"| palette also HARVESTS variables declared in the open file (declaration nodes) |
| Lists subcategory          | Make a List -> C arrays: `int name[10];`, `name[0] = 0;`, element reporter `name[0]` (fits any round socket) |
| monitor/checkbox           | out of scope v1 (no interpreter; memory viz covers "watching" in P3) |
