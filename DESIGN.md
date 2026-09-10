# Cade — Design Language Spec

Brand-side design system for the Cade block IDE. The UI rebuild must execute against this spec, not invent a second visual language.

## 1. Objective

Ship a distinctive, kid-and-beginner-friendly desktop coding tool that feels like Scratch learned real languages — playful shell, serious editor. Rebuild chrome from zero without breaking the TypeScript DOM contract or the existing token names.

## 2. Product context

- **Product**: Tauri desktop IDE; blocks ↔ text are bidirectional projections of real source.
- **Audience**: learners, teachers, hobbyists transitioning from visual blocks to C/C++/Python/JS/Rust.
- **Personality**: warm, buoyant, sea-clear, slightly comic — never corporate-slate, never neon-hacker.
- **Primary surfaces**: splash (new/academy/recent/settings), workspace shell (sidebar + toolbar + editor + canvas + console), dialogs.

## 3. Visual foundations

### Palette — Sea

| Role | Token | Light | Dark |
|------|-------|-------|------|
| Brand scale | `--brand-50…900` | `#f0f9ff → #0c2530` | same ramp |
| Canvas | `--c-bg` | `#f0f7fa` | `#0c2530` |
| Alt canvas | `--c-bg-alt` | `#e7f2f7` | `#0f2d3a` |
| Surface | `--c-bg-surface` | `#ffffff` | `#122f3d` |
| Sunken | `--c-bg-sunken` | `#e1eef5` | `#091c25` |
| Ink | `--c-fg` | `#123b4c` | `#d9f1fa` |
| Accent | `--c-accent` | `#0891b2` | `#38cfe8` |
| Border | `--c-border` | `#bde3f0` | `#1a3d4e` |

Accents (user-selectable): teal `#0891b2`, purple `#7c5ce0`, pink `#ec4899`, green `#2fbf71`, orange `#ff8c1a`, red `#e5484d`.

Scratch category palette (block identity — do not retint):
control/loops `#ffab19`, statement `#0891b2`, variables `#ff8c1a`, events `#ff6680`, sensing `#4cbfe6`, operators `#40bf4a`, look `#855cd6`, sound `#cc66ff`, motion `#4c97ff`, comment `#ffe9a8`.

### Type

- Display / headings: **Baloo 2** (fallback `Segoe UI`, system-ui)
- Body / UI: **Comic Neue** (fallback `Segoe UI`, system-ui)
- Code / data: **Cascadia Code / Fira Code / Consolas**
- Scale: 10 · 12 · 13 · 14 · 16 · 18 · 20 · 24 · 32
- Weights: 400 / 500 / 600 / 700

### Shape, space, elevation

- Radius: 4 · 6 · 10 · 14 · 20 · 28 · full
- Space: 4px base (4…80)
- Soft cool shadows; dark theme deepens blacks, not blur.
- Focus: 2px outline + offset, accent-colored.

### Signature elements (preserve)

1. **Scratch puzzle silhouette** on palette blocks (`clip-path` tab/mouth) + white top highlight + hard drop shadow.
2. **Sea-cyan chrome** — light paper-blue workbench, not gray IDE.
3. **Comic + Baloo** pairing — educational warmth without sacrificing code mono.

## 4. Accessibility

- WCAG AA body text contrast; large display ≥ 3:1.
- Visible focus rings on all interactive controls.
- Color never sole signal (diagnostics pair color with text/label).
- `prefers-reduced-motion` disables animation/transition.
- Skip link to editor; ARIA roles on dialogs, tabs, trees, radiogroups.

## 5. Voice & tone

- Short verbs: Open, Save, Run, Load, Hint, Check.
- Empty states invite action (“Filter blocks…”, “No recent projects yet”).
- Errors state what failed and what to try next — no blame, no vagueness.
- Sentence case; no marketing fluff in chrome.

## 6. Implementation practices

- CSS layers, in order: `tokens.css` → `components.css` → `layout.css` → `style.css`.
- All visual values go through tokens — no ad-hoc hex in feature CSS except Scratch category colors.
- DOM IDs and class hooks are a **contract** with TypeScript; rebuild markup freely, never rename hooks the app queries.
- Attributes that drive behavior: `data-theme`, `data-accent`, `data-view`, `data-mode`, `data-panel`, `data-lang`, `data-slide`, `data-path`, `data-g`.
- Prefer classes over inline styles; keep inline only for dynamic JS-driven values.

## 7. Anti-patterns

- Purple-blue gradient heroes, glassmorphism, generic card-grid marketing.
- Replacing Comic Neue/Baloo with Inter-only “AI default” UI type.
- Graying out the sea palette into slate-IDE neutrals.
- Emoji as the *only* iconography for primary file/run actions when a clear label or SVG exists.
- Borders + shadows + fills stacked on the same surface.
- Breaking `getElementById` contracts or token names.

## 8. Decision-making

When a new surface appears: sea surface on sunken canvas → accent for selection/primary → category colors only for blocks → mono for data. Prefer familiarity (tabs, sidebars, toolbars) over novelty; spend personality on splash, blocks, and academy.

## 9. Workflow

1. Token change only via `tokens.css`.
2. Component styles in `components.css`; shell layout in `layout.css`; features in `style.css`.
3. After HTML/CSS rebuild, run `npm run typecheck` and smoke-check IDs against `src/*.ts`.
4. Visual QA: light + dark, narrow window, empty console, splash panels.
