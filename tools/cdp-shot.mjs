// CDP screenshot: captures the app window content to a PNG.
// Usage: node cdp-shot.mjs <port> <outfile>
import { writeFileSync } from 'node:fs';

const port = process.argv[2] ?? '9223';
const out = process.argv[3] ?? 'shot.png';
const theme = process.argv[4] ?? 'light';

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
if (!page) {
  console.log('SHOT FAIL: no page target');
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  const timer = setTimeout(() => rej(new Error('ws timeout')), 10000);
  ws.onopen = () => {
    // dismiss tour + pin theme before the shot
    ws.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression:
            `localStorage.setItem('tour-done','1'); localStorage.setItem('theme','${theme}'); 'ok'`,
        },
      }),
    );
    ws.send(JSON.stringify({ id: 2, method: 'Page.reload' }));
    setTimeout(() => {
      ws.send(
        JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: {
            expression:             `document.documentElement.dataset.theme = '${theme}'; 'ok'`,
          },
        }),
      );
      setTimeout(() => {
        ws.send(JSON.stringify({ id: 4, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      }, 900);
    }, 1400);
  };
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id === 4) {
      clearTimeout(timer);
      writeFileSync(out, Buffer.from(msg.result.data, 'base64'));
      console.log('saved', out);
      res();
    }
  };
  ws.onerror = () => rej(new Error('ws error'));
});
ws.close();
