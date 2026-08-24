// Robust CDP probe: pick the tauri page, log evaluate errors, test input path.
const port = process.argv[2];
const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
console.log('targets:', l.map((t) => `${t.type}:${t.url.slice(0, 40)}`).join(' | '));
const p = l.find((t) => t.type === 'page' && t.url.includes('tauri')) ?? l.find((t) => t.type === 'page');
if (!p) process.exit(1);
const ws = new WebSocket(p.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
ws.onmessage = (m) => {
  if (process.env.CDP_VERBOSE) console.log('raw <<', String(m.data).slice(0, 120));
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
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.value;
};
const evFull = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.result?.value;
};
await new Promise((r) => setTimeout(r, 500));
console.log('sanity:', await ev('1 + 1'));
await ev("localStorage.setItem('tour-done','1'); 'ok'");
await send('Page.reload');
await new Promise((r) => setTimeout(r, 1500));
console.log('hook:', await ev(
  "window.addEventListener('pointerdown', e => { window.__pd = { x: e.clientX, y: e.clientY, target: e.target.tagName, id: e.target.id } }, { capture: true, once: true }); 'ok'",
));
console.log('at point:', await ev(
  "(() => { const el = document.elementFromPoint(770, 190); if (!el) return 'none'; const chain = []; let c = el; while (c && chain.length < 4) { chain.push((c.tagName || '?') + (c.id ? '#' + c.id : '')); c = c.parentElement } return el.tagName + '|' + el.id + ' <- ' + chain.join(' < ') })()",
));
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 770, y: 190, button: 'left', buttons: 1, clickCount: 1 });
await new Promise((r) => setTimeout(r, 300));
console.log('received:', await ev('JSON.stringify(window.__pd ?? null)'));
console.log('pixi hit:', await ev(
  "(() => { const c = document.querySelector('#canvas-host canvas'); return c ? 'canvas-found' : 'no-canvas' })()",
));
process.exit(0);
