import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../..', import.meta.url));
function offlineCache() {
  return { name: 'offline-cache', closeBundle() {
    const directory = resolve(root, 'dist');
    const files = readdirSync(directory, { recursive: true, withFileTypes: true }).filter(f => f.isFile() && f.name !== 'sw.js' && f.name !== '_headers').map(f => resolve(f.parentPath, f.name));
    const version = createHash('sha256'); files.forEach(f => version.update(readFileSync(f)));
    const urls = files.map(f => '/' + relative(directory, f).replaceAll('\\', '/'));
    const cache = 'real-mines-' + version.digest('hex').slice(0, 12);
    writeFileSync(resolve(directory, 'sw.js'), `const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(urls)};
      self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
      self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('real-mines-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
      self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;e.respondWith(caches.open(CACHE).then(async c=>{if(e.request.mode==='navigate')return c.match('/index.html');return await c.match(e.request,{ignoreVary:true})||fetch(e.request)}))});`);
  } };
}
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), offlineCache()],
  build: { outDir: '../../dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { port: 5173, strictPort: true, watch: { usePolling: process.platform === 'win32', interval: 300 } },
});
