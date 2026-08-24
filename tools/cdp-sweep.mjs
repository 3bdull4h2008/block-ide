// Sweep points through the app's own hit-test. Usage: node cdp-sweep.mjs <port>
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
const ev = async (expression) => {
  const r = await new Promise((res) => {
    const i = ++id;
    pend.set(i, res);
    ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  if (r.exceptionDetails) return 'EXC: ' + r.exceptionDetails.text;
  return r.result?.value;
};
await new Promise((r) => setTimeout(r, 500));
for (const [x, y] of [[700, 150], [770, 190], [820, 230], [700, 120], [900, 300], [750, 105], [680, 90]]) {
  console.log(`${x},${y} ->`, await ev(`window.__hitAt(${x}, ${y})`));
}
console.log('rect:', await ev(
  "(() => { const c = document.querySelector('#canvas-host canvas'); const r = c.getBoundingClientRect(); return JSON.stringify({ l: r.left, t: r.top, w: r.width, h: r.height, bw: c.width, bh: c.height }) })()",
));
process.exit(0);
