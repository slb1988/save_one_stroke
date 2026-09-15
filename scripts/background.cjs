'use strict';
// Detached + ignored terminal streams: the game server is not tied to a worker PTY.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const URL = `http://127.0.0.1:${PORT}`;
async function healthy() {
  try { const response = await fetch(`${URL}/health`, { signal: AbortSignal.timeout(700) }); const data = await response.json(); return data.app === 'save-one-stroke' ? data : null; } catch { return null; }
}
(async () => {
  const current = await healthy();
  if (current) { console.log(`Already running: ${URL}/ (PID ${current.pid})`); return; }
  const child = spawn(process.execPath, [path.join(__dirname, 'serve.cjs')], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, PORT: String(PORT) } });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 150));
    const data = await healthy();
    if (data) {
      fs.mkdirSync(path.join(ROOT, '.local'), { recursive: true });
      fs.writeFileSync(path.join(ROOT, '.local', 'server.json'), JSON.stringify({ ...data, url: `${URL}/`, startedAt: new Date().toISOString(), detached: true }, null, 2));
      console.log(`Detached server ready: ${URL}/ (PID ${data.pid})`);
      console.log('No terminal is required. Start again with npm start if your IDE cleans up all descendant processes.');
      return;
    }
  }
  console.error('Server did not become ready. Run npm start to see the error (or choose another PORT).'); process.exitCode = 1;
})();
