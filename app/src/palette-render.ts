import { blip, blipError } from './utils/audio'
import {
  PALETTE_GROUPS,
  VARIABLES_COLOR,
  validateVarName,
  type SourceLang,
  type PaletteItem,
  varChips,
  varTypes,
  listChips,
} from './palette'
import type { ProfileOut } from './academy'

export interface PaletteRenderDeps {
  paletteEl: HTMLDivElement
  consoleEl: HTMLPreElement
  activeLang: () => SourceLang
  knownVars: string[]
  knownLists: string[]
  harvestedVars: string[]
  varTypesMap: Record<string, string>
  src: () => string
  startHtmlDrag: (e: PointerEvent, payload: {
    label: string; snippet?: string; cat?: string;
    slotValue?: string; slotKind?: 'round' | 'bool';
    toplevel?: boolean; insertTop?: boolean;
  }) => void
  openVarMenu: (e: MouseEvent, varName: string) => void
  programKinds: Set<string>
  programIncludes: Set<string>
  renderPaletteLocks: (el: HTMLDivElement, mode: 'sandbox' | 'academy', profile: ProfileOut | null) => void
  getAppMode: () => 'sandbox' | 'academy'
  getProfile: () => ProfileOut | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyPalFilter: (deps?: any) => void
  kbdPaletteDeps: any
}

function makeReporterChip(
  item: PaletteItem,
  deps: PaletteRenderDeps,
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `pal pal-${item.cat} pal-reporter`
  el.dataset.cat = item.cat
  el.textContent = item.name
  ;(el as unknown as { __item?: PaletteItem }).__item = item
  el.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('locked')) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    deps.startHtmlDrag(e, {
      label: item.name,
      slotValue: item.name,
      slotKind: 'round',
      cat: 'variables',
    })
  })
  return el
}

function makeVarChip(
  item: PaletteItem,
  deps: PaletteRenderDeps,
  isList?: boolean,
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `pal pal-${item.cat}${isList ? ' pal-list' : ''}`
  el.dataset.cat = item.cat
  el.textContent = item.name
  ;(el as unknown as { __item?: PaletteItem }).__item = item
  el.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('locked')) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    if (item.reporter !== undefined) {
      deps.startHtmlDrag(e, {
        label: item.name,
        slotValue: item.name,
        slotKind: 'round',
        cat: 'variables',
      })
    } else {
      deps.startHtmlDrag(e, { label: item.name, snippet: item.snippet, cat: 'variables' })
    }
  })
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const varName = (item as { varName?: string }).varName ?? item.name
    if (!deps.knownVars.includes(varName) && !deps.knownLists.includes(varName)) {
      deps.consoleEl.textContent = `"${varName}" is declared in the file — rename or delete it in the code`
      return
    }
    deps.openVarMenu(e, varName)
  })
  return el
}

export function renderPaletteFull(deps: PaletteRenderDeps): void {
  const { paletteEl, consoleEl } = deps
  const st = paletteEl.scrollTop
  paletteEl.innerHTML = ''

  const rail = document.createElement('div')
  rail.id = 'pal-rail'
  const dots: { dot: HTMLSpanElement; name: string }[] = []
  paletteEl.appendChild(rail)

  const addGroupHeader = (name: string, color: string): HTMLDivElement => {
    const head = document.createElement('div')
    head.className = 'pal-group'
    head.dataset.g = name.toLowerCase()
    head.textContent = name
    head.style.background = color
    if (name === 'Notes') head.style.color = '#6b4d00'
    paletteEl.appendChild(head)
    return head
  }
  const addChip = (item: PaletteItem): void => {
    if (item.langs !== undefined && !item.langs.includes(deps.activeLang())) return
    if (item.reporter !== undefined) {
      paletteEl.appendChild(makeReporterChip(item, deps))
      return
    }
    const depOk =
      item.requires === undefined ||
      ((item.requires.kind === undefined || deps.programKinds.has(item.requires.kind)) &&
        (item.requires.include === undefined ||
          [...deps.programIncludes].some((inc) => inc.includes(item.requires!.include!))))
    const el = document.createElement('div')
    el.className = `pal pal-${item.cat}${depOk ? '' : ' pal-dep'}`
    el.dataset.cat = item.cat
    el.textContent = item.name
    ;(el as unknown as { __item?: PaletteItem }).__item = item
    if (!depOk) {
      const need = item.requires!.kind ?? item.requires!.include!
      el.title = `Needs ${need} in the program first`
    }
    el.addEventListener('pointerdown', (e) => {
      if (el.classList.contains('locked')) {
        e.preventDefault()
        return
      }
      if (!depOk) {
        e.preventDefault()
        blipError()
        consoleEl.textContent = `"${item.name}" needs ${item.requires!.kind ?? item.requires!.include!} in the program first`
        return
      }
      e.preventDefault()
      deps.startHtmlDrag(e, {
        label: item.name,
        snippet: item.snippet,
        cat: item.cat,
        toplevel: item.toplevel,
        insertTop: item.top,
      })
    })
    paletteEl.appendChild(el)
  }

  for (const g of PALETTE_GROUPS) {
    const visibleItems = g.items.filter((i) => i.langs === undefined || i.langs.includes(deps.activeLang()))
    if (visibleItems.length === 0) continue
    const head = addGroupHeader(g.name, g.color)
    const dot = document.createElement('span')
    dot.className = 'rail-dot'
    dot.title = g.name
    dot.style.background = g.color
    dot.addEventListener('click', () =>
      paletteEl.scrollTo({ top: head.offsetTop - 26, behavior: 'smooth' }),
    )
    rail.appendChild(dot)
    dots.push({ dot, name: g.name })
    for (const item of visibleItems) addChip(item)
  }

  if (deps.activeLang() === 'c' || deps.activeLang() === 'cpp') {
    const vhead = addGroupHeader('Variables', VARIABLES_COLOR)
    const vdot = document.createElement('span')
    vdot.className = 'rail-dot'
    vdot.title = 'Variables'
    vdot.style.background = VARIABLES_COLOR
    vdot.addEventListener('click', () =>
      paletteEl.scrollTo({ top: vhead.offsetTop - 26, behavior: 'smooth' }),
    )
    rail.appendChild(vdot)
    dots.push({ dot: vdot, name: 'Variables' })

    const mk = document.createElement('button')
    mk.id = 'make-var'
    mk.dataset.cat = 'variables'
    mk.textContent = 'Make a Variable'
    mk.addEventListener('click', () => {
      if (mk.classList.contains('locked')) return
      const raw = window.prompt('Variable name:', 'score')
      if (raw === null) return
      const name = validateVarName(raw)
      if (name === null) {
        consoleEl.textContent = `"${raw}" is not a valid C variable name`
        blipError()
        return
      }
      const types = varTypes(deps.activeLang())
      const traw = window.prompt(`Type for "${name}" (${types.join('/')}):`, deps.varTypesMap[name] ?? 'int')
      if (traw === null) return
      const type = traw.trim().toLowerCase()
      if (!types.includes(type)) {
        consoleEl.textContent = `"${type}" is not a type I know — use ${types.join('/')}`
        blipError()
        return
      }
      if (!deps.knownVars.includes(name)) deps.knownVars.push(name)
      deps.varTypesMap[name] = type
      blip(740, 0.07, 'sine', 0.06)
    })
    paletteEl.appendChild(mk)

    const allVars = [...new Set([...deps.knownVars, ...deps.harvestedVars])]
    for (const v of allVars) {
      for (const chip of varChips(v, deps.varTypesMap[v] ?? 'int')) {
        paletteEl.appendChild(makeVarChip(chip, deps))
      }
    }

    const mkList = document.createElement('button')
    mkList.id = 'make-list'
    mkList.dataset.cat = 'variables'
    mkList.textContent = 'Make a List'
    mkList.addEventListener('click', () => {
      if (mkList.classList.contains('locked')) return
      const raw = window.prompt('List name (C array):', 'grid')
      if (raw === null) return
      const name = validateVarName(raw)
      if (name === null) {
        consoleEl.textContent = `"${raw}" is not a valid C array name`
        blipError()
        return
      }
      if (!deps.knownLists.includes(name)) deps.knownLists.push(name)
      blip(740, 0.07, 'sine', 0.06)
    })
    paletteEl.appendChild(mkList)

    const listVars = new Set<string>(deps.knownLists)
    for (const v of allVars) {
      if (deps.src().includes(`${v}[`)) listVars.add(v)
    }
    for (const v of listVars) {
      for (const chip of listChips(v)) paletteEl.appendChild(makeVarChip(chip, deps, true))
    }
  }

  paletteEl.onscroll = () => {
    let active = dots[0]?.name
    for (const d of dots) {
      const head = paletteEl.querySelector(`.pal-group[data-g="${d.name.toLowerCase()}"]`) as HTMLElement | null
      if (head && head.offsetTop - 30 <= paletteEl.scrollTop) active = d.name
    }
    for (const d of dots) d.dot.classList.toggle('active', d.name === active)
  }

  deps.applyPalFilter(deps.kbdPaletteDeps)
  paletteEl.scrollTop = st
  deps.renderPaletteLocks(paletteEl, deps.getAppMode(), deps.getProfile())
}
