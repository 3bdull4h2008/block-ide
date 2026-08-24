// Press several block interiors via trusted input; report which started drags.
const port = process.argv[2];
const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const p = l.find((t) => t.type === 'page' && t.url.includes('tauri'));
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
const mouse = async (type, x, y, buttons = 0) => {
  await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mousePressed' ? 1 : 0 });
};

await ev("localStorage.setItem('tour-done','1'); 'ok'");
await send('Page.reload');
await new Promise((r) => setTimeout(r, 1600));

const points = [
  ['include mid', 760, 105],
  ['printf mid', 800, 195],
  ['int total mid', 800, 240],
  ['for header mid', 800, 285],
  ['return mid', 790, 380],
];
for (const [name, x, y] of points) {
  await ev('window.__bidbg = undefined');
  await mouse('mousePressed', x, y, 1);
  await mouse('mouseMoved', x + 8, y + 6, 1);
  await new Promise((r) => setTimeout(r, 120));
  const dbg = await ev('JSON.stringify(window.__bidbg ?? null)');
  await mouse('mouseReleased', x + 8, y + 6, 0);
  await new Promise((r) => setTimeout(r, 120));
  console.log(`${name} (${x},${y}):`, dbg);
}
process.exit(0);
