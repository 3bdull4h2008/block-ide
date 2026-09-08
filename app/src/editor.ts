import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap, defaultHighlightStyle, HighlightStyle } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'
import { tags } from '@lezer/highlight'

// Language imports
import { cpp } from '@codemirror/lang-cpp'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { go } from '@codemirror/lang-go'

// ---- Light theme (Cade custom) ----
const cadeLightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#1e293b',
    fontSize: '13px',
    fontFamily: "'Consolas', 'Fira Code', monospace",
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#3b82f6',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#3b82f6',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#dbeafe',
  },
  '.cm-activeLine': {
    backgroundColor: '#f1f5f9',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#e2e8f0',
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    color: '#94a3b8',
    border: 'none',
    borderRight: '1px solid #e2e8f0',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 12px',
    fontSize: '12px',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    cursor: 'pointer',
    color: '#94a3b8',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#fef3c7',
    outline: '1px solid #f59e0b',
  },
  '.cm-selectionMatch': {
    backgroundColor: '#dbeafe40',
  },
  '.cm-searchMatch': {
    backgroundColor: '#fef08a',
    outline: '1px solid #eab308',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: '#fde68a',
  },
  '.cm-tooltip': {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li': {
      padding: '4px 8px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: '#3b82f6',
      color: '#ffffff',
    },
  },
}, { dark: false })

// ---- Syntax highlighting for light theme ----
const cadeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#8b5cf6' },
  { tag: tags.controlKeyword, color: '#8b5cf6' },
  { tag: tags.moduleKeyword, color: '#8b5cf6' },
  { tag: tags.operatorKeyword, color: '#8b5cf6' },
  { tag: tags.definitionKeyword, color: '#8b5cf6' },
  { tag: tags.typeName, color: '#0ea5e9' },
  { tag: tags.className, color: '#0ea5e9' },
  { tag: tags.number, color: '#059669' },
  { tag: tags.string, color: '#059669' },
  { tag: tags.regexp, color: '#059669' },
  { tag: tags.atom, color: '#059669' },
  { tag: tags.bool, color: '#059669' },
  { tag: tags.null, color: '#059669' },
  { tag: tags.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#1e293b' },
  { tag: tags.definition(tags.variableName), color: '#2563eb' },
  { tag: tags.function(tags.variableName), color: '#2563eb' },
  { tag: tags.propertyName, color: '#2563eb' },
  { tag: tags.definition(tags.propertyName), color: '#2563eb' },
  { tag: tags.function(tags.propertyName), color: '#2563eb' },
  { tag: tags.operator, color: '#d946ef' },
  { tag: tags.punctuation, color: '#64748b' },
  { tag: tags.bracket, color: '#64748b' },
  { tag: tags.angleBracket, color: '#64748b' },
  { tag: tags.paren, color: '#64748b' },
  { tag: tags.squareBracket, color: '#64748b' },
  { tag: tags.brace, color: '#64748b' },
  { tag: tags.meta, color: '#94a3b8' },
  { tag: tags.processingInstruction, color: '#8b5cf6' },
  { tag: tags.labelName, color: '#d946ef' },
  { tag: tags.namespace, color: '#0ea5e9' },
  { tag: tags.special(tags.string), color: '#059669' },
])

// ---- Cade dark theme override ----
const cadeDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
  },
  '.cm-content': {
    caretColor: '#60a5fa',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#60a5fa',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#1e3a5f',
  },
  '.cm-activeLine': {
    backgroundColor: '#1e293b',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1e293b',
  },
  '.cm-gutters': {
    backgroundColor: '#0f172a',
    color: '#475569',
    borderRight: '1px solid #1e293b',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#422006',
    outline: '1px solid #ca8a04',
  },
}, { dark: true })

const cadeDarkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#a78bfa' },
  { tag: tags.controlKeyword, color: '#a78bfa' },
  { tag: tags.moduleKeyword, color: '#a78bfa' },
  { tag: tags.operatorKeyword, color: '#a78bfa' },
  { tag: tags.definitionKeyword, color: '#a78bfa' },
  { tag: tags.typeName, color: '#38bdf8' },
  { tag: tags.className, color: '#38bdf8' },
  { tag: tags.number, color: '#34d399' },
  { tag: tags.string, color: '#34d399' },
  { tag: tags.regexp, color: '#34d399' },
  { tag: tags.atom, color: '#34d399' },
  { tag: tags.bool, color: '#34d399' },
  { tag: tags.null, color: '#34d399' },
  { tag: tags.comment, color: '#475569', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#475569', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#475569', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#e2e8f0' },
  { tag: tags.definition(tags.variableName), color: '#60a5fa' },
  { tag: tags.function(tags.variableName), color: '#60a5fa' },
  { tag: tags.propertyName, color: '#60a5fa' },
  { tag: tags.definition(tags.propertyName), color: '#60a5fa' },
  { tag: tags.function(tags.propertyName), color: '#60a5fa' },
  { tag: tags.operator, color: '#f472b6' },
  { tag: tags.punctuation, color: '#94a3b8' },
  { tag: tags.bracket, color: '#94a3b8' },
  { tag: tags.angleBracket, color: '#94a3b8' },
  { tag: tags.paren, color: '#94a3b8' },
  { tag: tags.squareBracket, color: '#94a3b8' },
  { tag: tags.brace, color: '#94a3b8' },
  { tag: tags.meta, color: '#475569' },
  { tag: tags.processingInstruction, color: '#a78bfa' },
  { tag: tags.labelName, color: '#f472b6' },
  { tag: tags.namespace, color: '#38bdf8' },
  { tag: tags.special(tags.string), color: '#34d399' },
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
      return javascript()
    case 'python':
      return python()
    case 'go':
      return go()
    case 'rust':
      // Rust not in @codemirror — fall back to C-like highlighting
      return cpp()
    default:
      return cpp()
  }
}

function getThemeExtensions(dark: boolean) {
  return dark
    ? [oneDark, cadeDarkTheme, syntaxHighlighting(cadeDarkHighlightStyle)]
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
