// CDP probe: confirms the release app's webview actually renders our DOM
// and has the Tauri IPC bridge alive. Usage: node cdp-probe.mjs <port>
const port = process.argv[2] ?? '9223';

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
if (!page) {
  console.log('PROBE FAIL: no page target');
  process.exit(1);
}
console.log('page url:', page.url);
console.log('page title:', JSON.stringify(page.title));

const ws = new WebSocket(page.webSocketDebuggerUrl);
const result = await new Promise((res, rej) => {
  const timer = setTimeout(() => rej(new Error('ws timeout')), 8000);
  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `JSON.stringify({
            runBtn: !!document.getElementById('run'),
            paletteChips: document.querySelectorAll('.pal').length,
            academyOptions: document.querySelectorAll('#level-select option').length,
            tauriBridge: !!window.__TAURI_INTERNALS__,
            bodyChildren: document.body.children.length,
          })`,
          returnByValue: true,
        },
      }),
    );
  };
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id === 1) {
      clearTimeout(timer);
      res(msg.result?.result?.value ?? 'no value');
    }
  };
  ws.onerror = () => rej(new Error('ws error'));
});
console.log('dom:', result);
const ok = result.includes('"runBtn":true') && result.includes('"tauriBridge":true');
console.log(ok ? 'PROBE PASS' : 'PROBE FAIL');
process.exit(ok ? 0 : 1);
