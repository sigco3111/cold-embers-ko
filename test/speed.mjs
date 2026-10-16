// 暂停（长按速度键）/ 2 倍速 / 说话气泡 / 菜单键
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
const tap = async (page, sel) => { const b = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel); if (TAG === 'phone') await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y); };
export default async function (page) {
  await page.waitForTimeout(1500);
  const t0 = await page.evaluate(() => window.game.S.t);
  { const r = await page.evaluate(() => { const b = document.getElementById('speedBtn').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }); await page.mouse.move(r[0], r[1]); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up(); } // 1.1：长按速度键暂停
  await page.waitForTimeout(1500);
  const p1 = await page.evaluate(() => ({ paused: window.game.paused, body: document.body.classList.contains('paused'), t: window.game.S.t, ts: window.game.view.timeScale }));
  await page.waitForTimeout(1500);
  const p2 = await page.evaluate(() => window.game.S.t);
  console.log('pause', JSON.stringify(p1), 'frozen', p1.t === p2);
  await page.screenshot({ path: `${OUT}/speed_paused_${TAG}.png`, timeout: 120000 });
  await tap(page, '#speedBtn');
  await page.waitForTimeout(800);
  console.log('speed', JSON.stringify(await page.evaluate(() => ({ paused: window.game.paused, speed: window.game.speed, lbl: document.querySelector('#speedBtn i').textContent, on: document.getElementById('speedBtn').classList.contains('on'), ts: window.game.view.timeScale, ls: localStorage.getItem('hanjin-beixing-v1-spd') }))));
  // 2 倍速下袭击 1 分钟内 → 自动回 1 倍速
  const rs = await page.evaluate(() => { const g = window.game, S = g.S, nr = window.__sim.nextRaid(S); if (!nr) return 'no raid'; const t = S.t; S.t += nr.in - 30; g.raidSlow(); const r = { speed: g.speed, toast: document.querySelector('#toasts .toast')?.textContent }; S.t = t; return r; });
  console.log('raidSlow', JSON.stringify(rs));
  // 菜单齿轮
  await tap(page, '#menuBtn');
  await page.waitForTimeout(800);
  console.log('menu', await page.evaluate(() => window.game.ui.panel && window.game.ui.panel.kind));
  await page.evaluate(() => window.game.ui.close());
  // 说话气泡
  await page.evaluate(() => { const g = window.game, c = g.S.camps[0]; g.view.focus(c.x + 2, c.y - 3, true); g.view.cam.tdist = g.view.cam.dist = 14; });
  let got = null;
  for (let i = 0; i < 20 && !got; i++) { await page.waitForTimeout(700); got = await page.evaluate(() => { const e = document.querySelector('#talkl .talk'); if (!e || e.parentElement.style.display === 'none') return null; const r = e.getBoundingClientRect(); return { txt: e.textContent, x: Math.round(r.x), y: Math.round(r.y) }; }); }
  const same = await page.evaluate(async () => { const a = document.querySelector('#talkl .talk'); await new Promise(r => setTimeout(r, 400)); return a === document.querySelector('#talkl .talk'); });
  console.log('talk', JSON.stringify(got), 'stable', same);
  await page.screenshot({ path: `${OUT}/speed_talk_${TAG}.png`, timeout: 120000 });
}
