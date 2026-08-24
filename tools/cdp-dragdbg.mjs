// Trusted-input drag: press, glide, dump debug + screenshot mid-drag.
// Usage: node cdp-dragdbg.mjs <port> <shotOut?>
const port = process.argv[2];
const shotOut = process.argv[3];
const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const p = l.find((t) => t.type === 'page');
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
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.value;
};
const mouse = async (type, x, y, buttons = 0) => {
  await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: type === 'mousePressed' ? 1 : 0 });
};

await ev("localStorage.setItem('tour-done','1'); localStorage.setItem('theme','light'); 'ok'");
await send('Page.reload');
await new Promise((r) => setTimeout(r, 1600));

await mouse('mousePressed', 770, 190, 1);
for (let i = 1; i <= 12; i++) {
  await mouse('mouseMoved', 770 + i * 14, 190 + i * 14, 1);
  await new Promise((r) => setTimeout(r, 35));
}
await new Promise((r) => setTimeout(r, 250));
console.log('dbg:', await ev('JSON.stringify(window.__bidbg ?? null)'));
if (shotOut) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(shotOut, Buffer.from(r.data, 'base64'));
  console.log('saved', shotOut);
}
await mouse('mouseReleased', 938, 358, 0);
process.exit(0);
