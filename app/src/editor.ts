import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap, defaultHighlightStyle, HighlightStyle } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
// oneDark intentionally unused — Cade ships standalone sea themes only.
import { tags } from '@lezer/highlight'

// Language imports
import { cpp } from '@codemirror/lang-cpp'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { go } from '@codemirror/lang-go'
import { java } from '@codemirror/lang-java'

// ---- Light theme (Cade custom — sea paper) ----
const cadeLightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#123b4c',
    fontSize: '13px',
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#0891b2',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#0891b2',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#dff3fa',
  },
  '.cm-activeLine': {
    backgroundColor: '#f0f7fa',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#e7f2f7',
  },
  '.cm-gutters': {
    backgroundColor: '#f0f7fa',
    color: '#6b8fa0',
    border: 'none',
    borderRight: '1px solid #d6eaf3',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    fontSize: '12px',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    cursor: 'pointer',
    color: '#6b8fa0',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#dff3fa',
    outline: '1px solid #0891b2',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#dff3fa80',
  },
  '.cm-searchMatch': {
    backgroundColor: '#fff4e6',
    outline: '1px solid #ff8c1a',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: '#ffe9c8',
  },
  '.cm-tooltip': {
    backgroundColor: '#ffffff',
    border: '1px solid #bde3f0',
    boxShadow: '0 10px 15px rgba(12,37,48,0.08)',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li': {
      padding: '4px 8px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: '#0891b2',
      color: '#ffffff',
    },
  },
}, { dark: false })

// ---- Syntax highlighting for light theme (sea-tinted) ----
const cadeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#7c5ce0' },
  { tag: tags.controlKeyword, color: '#7c5ce0' },
  { tag: tags.moduleKeyword, color: '#7c5ce0' },
  { tag: tags.operatorKeyword, color: '#7c5ce0' },
  { tag: tags.definitionKeyword, color: '#7c5ce0' },
  { tag: tags.typeName, color: '#0891b2' },
  { tag: tags.className, color: '#ec4899' },
  { tag: tags.number, color: '#2fbf71' },
  { tag: tags.string, color: '#e07000' },
  { tag: tags.regexp, color: '#e07000' },
  { tag: tags.atom, color: '#2fbf71' },
  { tag: tags.bool, color: '#2fbf71' },
  { tag: tags.null, color: '#2fbf71' },
  { tag: tags.comment, color: '#6b8fa0', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#6b8fa0', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#6b8fa0', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#123b4c' },
  { tag: tags.definition(tags.variableName), color: '#066a85' },
  { tag: tags.function(tags.variableName), color: '#7c5ce0' },
  { tag: tags.propertyName, color: '#066a85' },
  { tag: tags.definition(tags.propertyName), color: '#066a85' },
  { tag: tags.function(tags.propertyName), color: '#7c5ce0' },
  { tag: tags.operator, color: '#ec4899' },
  { tag: tags.punctuation, color: '#6b8fa0' },
  { tag: tags.bracket, color: '#6b8fa0' },
  { tag: tags.angleBracket, color: '#6b8fa0' },
  { tag: tags.paren, color: '#6b8fa0' },
  { tag: tags.squareBracket, color: '#6b8fa0' },
  { tag: tags.brace, color: '#6b8fa0' },
  { tag: tags.meta, color: '#94b3c2' },
  { tag: tags.processingInstruction, color: '#7c5ce0' },
  { tag: tags.labelName, color: '#ff8c1a' },
  { tag: tags.namespace, color: '#0891b2' },
  { tag: tags.special(tags.string), color: '#e07000' },
])

// ---- Cade dark theme — sea palette (matches tokens.css [data-theme=dark]) ----
const cadeDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0c2530',
    color: '#d9f1fa',
  },
  '.cm-content': {
    caretColor: '#38cfe8',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#38cfe8',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#0f3d4f',
  },
  '.cm-activeLine': {
    backgroundColor: '#0f2d3a',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#0f2d3a',
  },
  '.cm-gutters': {
    backgroundColor: '#091c25',
    color: '#3d6a7c',
    borderRight: '1px solid #153545',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    color: '#3d6a7c',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#1a3d4e',
    outline: '1px solid #38cfe8',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#153545',
  },
  '.cm-tooltip': {
    backgroundColor: '#122f3d',
    border: '1px solid #1a3d4e',
    boxShadow: '0 10px 15px rgba(0,0,0,0.35)',
    color: '#d9f1fa',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: '#38cfe8',
    color: '#0c2530',
  },
}, { dark: true })

const cadeDarkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#38cfe8' },
  { tag: tags.controlKeyword, color: '#38cfe8' },
  { tag: tags.moduleKeyword, color: '#38cfe8' },
  { tag: tags.operatorKeyword, color: '#38cfe8' },
  { tag: tags.definitionKeyword, color: '#38cfe8' },
  { tag: tags.typeName, color: '#7ccde3' },
  { tag: tags.className, color: '#f472b6' },
  { tag: tags.number, color: '#3ddb85' },
  { tag: tags.string, color: '#ffab40' },
  { tag: tags.regexp, color: '#ffab40' },
  { tag: tags.atom, color: '#3ddb85' },
  { tag: tags.bool, color: '#3ddb85' },
  { tag: tags.null, color: '#3ddb85' },
  { tag: tags.comment, color: '#8fb4c4', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#8fb4c4', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#8fb4c4', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#d9f1fa' },
  { tag: tags.definition(tags.variableName), color: '#38cfe8' },
  { tag: tags.function(tags.variableName), color: '#a78bfa' },
  { tag: tags.propertyName, color: '#7ccde3' },
  { tag: tags.definition(tags.propertyName), color: '#7ccde3' },
  { tag: tags.function(tags.propertyName), color: '#a78bfa' },
  { tag: tags.operator, color: '#a3d4e6' },
  { tag: tags.punctuation, color: '#6b8fa0' },
  { tag: tags.bracket, color: '#6b8fa0' },
  { tag: tags.angleBracket, color: '#6b8fa0' },
  { tag: tags.paren, color: '#6b8fa0' },
  { tag: tags.squareBracket, color: '#6b8fa0' },
  { tag: tags.brace, color: '#6b8fa0' },
  { tag: tags.meta, color: '#6b8fa0' },
  { tag: tags.processingInstruction, color: '#38cfe8' },
  { tag: tags.labelName, color: '#ffab40' },
  { tag: tags.namespace, color: '#38cfe8' },
  { tag: tags.special(tags.string), color: '#ffab40' },
])

// ---- Language compartment (swappable at runtime) ----
const languageCompartment = new Compartment()
const themeCompartment = new Compartment()

function getLanguageExtension(lang: string) {
  switch (lang) {
    case 'c':
    case 'cpp':
      return cpp()
    case 'javascript':
    case 'typescript':
      return javascript()
    case 'python':
      return python()
    case 'go':
      return go()
    case 'java':
      return java()
    case 'rust':
      // Rust not in @codemirror — fall back to C-like highlighting
      return cpp()
    default:
      return cpp()
  }
}

function getThemeExtensions(dark: boolean) {
  // Standalone Cade themes only — never compose oneDark (slate leaks into sea).
  return dark
    ? [cadeDarkTheme, syntaxHighlighting(cadeDarkHighlightStyle)]
    : [cadeLightTheme, syntaxHighlighting(cadeHighlightStyle)]
}

// ---- Public API ----

export interface CadeEditor {
  view: EditorView
  setSource(src: string): void
  getSource(): string
  setLang(lang: string): void
  setTheme(dark: boolean): void
  focus(): void
  destroy(): void
  /** Subscribe to document changes */
  onUpdate: ((src: string) => void) | null
}

export function createCodeMirrorEditor(
  parent: HTMLElement,
  initialSrc: string,
  initialLang: string,
  dark: boolean,
): CadeEditor {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && editor.onUpdate) {
      editor.onUpdate(update.state.doc.toString())
    }
  })

  const state = EditorState.create({
    doc: initialSrc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),
      languageCompartment.of(getLanguageExtension(initialLang)),
      themeCompartment.of(getThemeExtensions(dark)),
      updateListener,
      EditorView.lineWrapping,
    ],
  })

  const view = new EditorView({ state, parent })

  const editor: CadeEditor = {
    view,
    setSource(src: string) {
      const current = view.state.doc.toString()
      if (current !== src) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: src },
        })
      }
    },
    getSource() {
      return view.state.doc.toString()
    },
    setLang(lang: string) {
      view.dispatch({
        effects: languageCompartment.reconfigure(getLanguageExtension(lang)),
      })
    },
    setTheme(dark: boolean) {
      view.dispatch({
        effects: themeCompartment.reconfigure(getThemeExtensions(dark)),
      })
    },
    focus() {
      view.focus()
    },
    destroy() {
      view.destroy()
    },
    onUpdate: null,
  }

  return editor
}
