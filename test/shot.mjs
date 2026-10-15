import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const [w, h, out, script] = [+process.argv[2] || 1280, +process.argv[3] || 800, process.argv[4] || '/tmp/shot.png', process.argv[5] || ''];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < h });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
await page.addInitScript(t => { try { localStorage.setItem('hanjin-beixing-v1-noauto', '1'); if (!t) localStorage.setItem('hanjin-beixing-v1-notitle', '1'); } catch (e) {} }, !!process.env.TITLE);
if (process.env.SAVEFILE) { const fs = await import('fs'); const data = fs.readFileSync(process.env.SAVEFILE, 'utf8'); await page.addInitScript(([d, keep]) => { if (sessionStorage.getItem('shot-nosave')) return; const o = JSON.parse(d); o.savedAt = Date.now() - 5000; if (!keep && o.meta) o.meta.ver = Math.max(o.meta.ver || 0, 14); localStorage.setItem('hanjin-beixing-v1', JSON.stringify(o)); }, [data, !!process.env.KEEPVER]); }
if (process.env.MOCKDL) await page.addInitScript(() => { window.claude = { use: n => new Promise(r => setTimeout(() => r(n === 'downloads' ? { save: async ({ filename, data }) => { window.__saved = (window.__saved || []).concat([filename + ' ' + (data.size || data.length)]); return { status: 'saved' }; } } : null), 50)) }; });
await page.goto(process.env.PAGE_URL || new URL('../dist/index.html', import.meta.url).href, { timeout: 180000 });
// 无头浏览器帧率极低，CSS 动画会停在半路：截图时让它们直接到终态
if (!process.env.ANIM) await page.addStyleTag({ content: '*,*::before,*::after{animation-delay:-30s!important}' }).catch(() => {});
await page.waitForTimeout(2500);
if (script) { const fn = (await import(script)).default; await fn(page); }
await page.screenshot({ path: out, timeout: 120000 });
console.log(errs.slice(0, 20).join('\n') || 'no errors');
await browser.close();
