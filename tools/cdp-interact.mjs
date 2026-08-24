// CDP interaction shots: right-click menu + mid-drag snap ghost.
// Usage: node cdp-interact.mjs <port> <menuOut> <dragOut>
import { writeFileSync } from 'node:fs';

const [port, menuOut, dragOut] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params) {
  return new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result ?? {});
    pending.delete(msg.id);
  }
};
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true });
  return r.result?.result?.value;
}
async function shot(out) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(r.result?.data ?? r.data, 'base64'));
  console.log('saved', out);
}
ws.onopen = async () => {
  setTimeout(() => { console.log('hard exit'); process.exit(2) }, 25000).unref?.();
  await evalJs("localStorage.setItem('tour-done','1'); localStorage.setItem('theme','light');'ok'");
  await send('Page.reload');
  await new Promise((r) => setTimeout(r, 1800));
  console.log('reloaded');

  // right-click over the printf block header
  await evalJs(`(() => {
    const c = document.querySelector('#canvas-host canvas');
    c.dispatchEvent(new MouseEvent('contextmenu', { clientX: 760, clientY: 150, bubbles: true, cancelable: true }));
    return 'ctx';
  })()`);
  await new Promise((r) => setTimeout(r, 350));
  await shot(menuOut);
  await evalJs(`(() => { window.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); 'closed' })()`);
  await new Promise((r) => setTimeout(r, 150));

  // mid-drag: press on the printf block header, glide into the loop body, hold
  await evalJs(`(() => {
    const c = document.querySelector('#canvas-host canvas');
    const opts = { bubbles: true, pointerId: 7, isPrimary: true, button: 0, buttons: 1 };
    c.dispatchEvent(new PointerEvent('pointerdown', { clientX: 770, clientY: 190, ...opts }));
    return 'down';
  })()`);
  for (let i = 1; i <= 10; i++) {
    await evalJs(`(() => {
      const e = new PointerEvent('pointermove', { clientX: ${770 + i * 14}, clientY: ${190 + i * 14}, bubbles: true, pointerId: 7, isPrimary: true, buttons: 1 });
      window.dispatchEvent(e);
      document.querySelector('#canvas-host canvas').dispatchEvent(e);
      return 'move';
    })()`);
    await new Promise((r) => setTimeout(r, 40));
  }
  await new Promise((r) => setTimeout(r, 250));
  await shot(dragOut);
  console.log('done');
  process.exit(0);
};
