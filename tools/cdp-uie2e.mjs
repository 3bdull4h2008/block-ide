// G-UI-E2E: scripted end-to-end checks against a running app (Gate 5).
// Usage: node cdp-uie2e.mjs <port>
// Asserts: default split view; view toggles hide/show panes; Ctrl+1/2/3;
// cursor-semantic map across view switches; Ctrl+Enter runs through the
// real backend; academy populated.
import { writeFileSync } from 'node:fs';

const port = process.argv[2];
const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const p = l.find((t) => t.type === 'page' && t.url.includes('tauri'));
if (!p) {
  console.log('E2E FAIL: tauri page not found');
  process.exit(1);
}
const ws = new WebSocket(p.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
ws.onmessage = (m) => {
  const x = JSON.parse(m.data);
  if (x.id && pend.has(x.id)) {
    pend.get(x.id)(x.result);
    pend.delete(x.id);
  }
};
const send = (method, params) =>
  new Promise((res) => {
    const i = ++id;
    pend.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) return 'EXC: ' + r.exceptionDetails.text;
  return r.result?.value;
};
const shot = async (out) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(r.data, 'base64'));
};

let failures = 0;
const check = (name, ok) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failures++;
};
const visible = (sel) =>
  ev(`(() => { const el = document.querySelector('${sel}'); return !!el && el.offsetParent !== null })()`);

await ev("localStorage.setItem('tour-done','1'); localStorage.setItem('theme','light'); localStorage.setItem('mode','sandbox'); 'ok'");
await send('Page.reload');
await new Promise((r) => setTimeout(r, 1600));

// 1. default split: editor + canvas both visible
check('split default: editor visible', await visible('#src'));
check('split default: canvas visible', await visible('#canvas-host'));

// 2. Text view hides canvas, keeps editor
await ev(`document.querySelector('.vm[data-view=\"text\"]').click()`);
await new Promise((r) => setTimeout(r, 250));
check('text: editor visible', await visible('#src'));
check('text: canvas hidden', !(await visible('#canvas-host')));
check('text: data-view attr', (await ev(`document.getElementById('app').dataset.view`)) === 'text');

// 3. Blocks view hides editor, keeps canvas
await ev(`document.querySelector('.vm[data-view=\"blocks\"]').click()`);
await new Promise((r) => setTimeout(r, 250));
check('blocks: canvas visible', await visible('#canvas-host'));
check('blocks: editor hidden', !(await visible('#src')));

// 4. Ctrl+3 keybinding returns to text, then Ctrl+2 to split
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51, modifiers: 2 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51, modifiers: 2 });
await new Promise((r) => setTimeout(r, 200));
check('ctrl+3 -> text', (await ev(`document.getElementById('app').dataset.view`)) === 'text');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '2', code: 'Digit2', windowsVirtualKeyCode: 50, modifiers: 2 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '2', code: 'Digit2', windowsVirtualKeyCode: 50, modifiers: 2 });
await new Promise((r) => setTimeout(r, 200));
check('ctrl+2 -> split', (await ev(`document.getElementById('app').dataset.view`)) === 'split');

// 5. cursor-semantic map: caret anchored to a statement survives blocks round-trip
await ev(`document.querySelector('.vm[data-view=\"text\"]').click()`);
await new Promise((r) => setTimeout(r, 250));
await ev(`
  (() => {
    const s = document.getElementById('src');
    const idx = s.value.indexOf('return 0;');
    s.focus();
    s.setSelectionRange(idx + 4, idx + 4);
    return idx;
  })()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49, modifiers: 2 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49, modifiers: 2 });
await new Promise((r) => setTimeout(r, 250));
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51, modifiers: 2 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51, modifiers: 2 });
await new Promise((r) => setTimeout(r, 350));
check(
  'cursor map: caret returns to its statement after blocks round-trip',
  await ev(`
    (() => {
      const s = document.getElementById('src');
      if (document.activeElement !== s) return false;
      const rs = s.value.indexOf('return 0;');
      const p = s.selectionStart;
      return p >= rs && p <= rs + 'return 0;'.length;
    })()`),
);

// 6. Ctrl+Enter runs hello through the real backend
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 2 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 2 });
let ran = false;
let lastConsole = '';
// 30 s budget: this gate runs right after G-PERF's 5000-file churn, and tcc
// cold-compiles under whatever disk load that leaves behind.
for (let i = 0; i < 120 && !ran; i++) {
  await new Promise((r) => setTimeout(r, 250));
  lastConsole = String((await ev(`document.getElementById('console').textContent`)) ?? '');
  ran = lastConsole.includes('[exit');
}
check('ctrl+enter: program ran (exit line in console)', ran);
if (!ran) console.log(`  console was: ${lastConsole.trim().slice(0, 200)}`);

// 7. academy levels populated
check('academy: 30 levels', (await ev(`document.querySelectorAll('#level-select option').length`)) === 30);

// 8. D7 mode split: sandbox default = no academy chrome + palette unlocked
check('sandbox default: level select hidden', !(await visible('#academy')));
check(
  'sandbox default: functions chip unlocked',
  (await ev(`!document.querySelector('.pal-functions').classList.contains('locked')`)) === true,
);
await ev(`document.querySelector('.mm[data-mode=\"academy\"]').click()`);
await new Promise((r) => setTimeout(r, 200));
check('academy mode: level panel visible', await visible('#academy'));
check(
  'academy mode: functions chip locked (fresh profile)',
  (await ev(`document.querySelector('.pal-functions').classList.contains('locked')`)) === true,
);
await ev(`document.querySelector('.mm[data-mode=\"sandbox\"]').click()`);
await new Promise((r) => setTimeout(r, 200));

// 9. loop C-mouths: for_statement is a container holding its body row
const shape = await ev(`window.__blocksShape().filter(b => b.kind === 'for_statement')[0]`);
check('loop mouth: for is container with body inside', shape && shape.container === true && shape.kids >= 1);

// 10. inline typed slots exist and validate
const slots = await ev(`window.__slots()`);
check('slots: number slot present in sample', Array.isArray(slots) && slots.some((s) => s.type === 'number'));
const numIdx = await ev(`window.__slots().findIndex(s => s.type === 'number')`);
check(
  'slot reject: number field refuses identifier',
  (await ev(`window.__commitSlot(${numIdx}, 'abc')`)) !== null,
);
check(
  'slot commit: number field accepts 42',
  (await ev(`window.__commitSlot(${numIdx}, '42')`)) === null &&
    String(await ev(`document.getElementById('src').value`)).includes('42'),
);

// 11. Scratch palette: category groups + Make-a-Variable lifecycle
check(
  'palette: category group headers rendered',
  (await ev(`document.querySelectorAll('.pal-group').length`)) >= 6,
);
check(
  'palette: Make a Variable button present',
  (await ev(`!!document.getElementById('make-var')`)) === true,
);
check(
  'make var: rejects invalid names',
  (await ev(`window.__makeVar('2bad name')`)) === 'invalid',
);
check(
  'make var: creates reporter + set/change chips',
  (await ev(`window.__makeVar('score')`)) === null &&
    (await ev(`!!document.querySelector('.pal-reporter[data-var=\"score\"]')`)) === true &&
    (await ev(`document.querySelectorAll('.pal[data-var=\"score\"]').length`)) === 3,
);

await shot(process.env.TEMP + '\\ui-e2e.png');
console.log(failures === 0 ? '[G-UI-E2E] PASS' : `[G-UI-E2E] FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
