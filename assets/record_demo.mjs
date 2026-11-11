// Records assets/demo.mp4 + demo.gif: the unpacked build running on a real Terms of Service page.
// Usage (repo root): npm ci && npm run build && npm i --no-save playwright && node assets/record_demo.mjs
// No API key is used or entered. Shows detection, shield badges, the "Analyze All" prompt and the
// side panel's no-key state + settings. The LLM summary / score / red-flag results need a Gemini key
// and are not shown.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const URL_ = 'https://policies.google.com/terms';
const dist = path.resolve('dist');
const out = path.resolve('assets');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-demo-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Page on the left (880 px), the extension's side panel on the right (400 px) = 1280x720.
// chrome.sidePanel can't be captured by recordVideo, so the same panel UI runs in its own page.
const ctx = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
  headless: false, // extensions need headed or new headless
  viewport: { width: 880, height: 720 },
  recordVideo: { dir: path.join(tmp, 'vid'), size: { width: 880, height: 720 } },
  args: ['--headless=new', `--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;

const panel = await ctx.newPage(); const panelAt = Date.now();
await panel.setViewportSize({ width: 400, height: 720 });
await panel.goto(`chrome-extension://${extId}/src/ui/sidepanel/index.html`);
const page = await ctx.newPage(); const pageAt = Date.now();
await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await page.locator('fineprint-overlay').waitFor({ state: 'attached', timeout: 20000 });
await page.locator('fineprint-badge').first().waitFor({ state: 'attached' });

const t0 = Date.now(); // timeline starts here
await sleep(3000);                                           // detected: shields + prompt
const badge = page.locator('fineprint-badge:visible').first();
await badge.scrollIntoViewIfNeeded();
await badge.hover();
await sleep(3500);                                           // badge next to a legal link
await page.locator('fineprint-overlay').getByRole('button', { name: /Analyze/ }).click();
await sleep(5000);                                           // side panel: no key configured
if (process.env.DBG) { await panel.screenshot({path:'/private/tmp/claude-501/panel.png'}); console.log(await panel.locator('body').innerText()); }
await panel.locator('[aria-label="Settings"]').click();
await sleep(6000);                                           // settings: empty Gemini access code field
await sleep(5000);
await panel.locator('[aria-label="Settings"]').click();
await sleep(3000);

const vids = [await panel.video().path(), await page.video().path()];
await ctx.close();
const [pv, gv] = [vids[0], vids[1]].map((p) => p);
const ss = (created) => ((t0 - created) / 1000).toFixed(2);
const mp4 = path.join(out, 'demo.mp4'), gif = path.join(out, 'demo.gif');
const run = (a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
run(['-ss', ss(pageAt), '-i', gv, '-ss', ss(panelAt), '-i', pv, '-t', '30',
  '-filter_complex', '[0:v]crop=880:720:0:0[a];[1:v]crop=400:720:0:0[b];[a][b]hstack,fps=24,format=yuv420p',
  '-c:v', 'libx264', '-crf', '23', '-an', '-movflags', '+faststart', mp4]);
run(['-i', mp4, '-vf', 'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', gif]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', mp4, gif);
