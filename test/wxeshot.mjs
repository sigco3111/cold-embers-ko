// 其他天气：冰风暴、极寒夜、冰湖开裂的画面；预报时的天气面板（准备按钮）
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__noEvents = true; const g = window.game, c = g.ui.camp(); for (const k of ['wood', 'plank', 'stone']) c.stock[k] = Math.max(c.stock[k] || 0, 900); document.querySelector('[data-act=skiptut]')?.click(); });
  const go = async (kind, off, name, focusIce) => {
    const r = await page.evaluate(([kind, off, focusIce]) => {
      const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
      let z = null; for (let k = 0; k < 40 && !z; k++) { const s = Sim.wxeSlot(S, k); if (s.kind === kind) z = s; }
      S.t = z.start + off; if (off < 0) { for (let o = 0; o < z.end - z.start; o += 10) { const ph = ((z.start + o) / 720) % 1; if (ph > 0.15 && ph < 0.4) { S.t = z.start + o; break; } } } g.ui.close(); g.view.wxk = { ice: 0, cold: 0, crack: 0, [kind]: 1 }; // 无头浏览器帧率太低，直接拉满
      if (focusIce) {
        g.view.focus(c.x, c.y, true); g.view.cam.tdist = g.view.cam.dist = 26;
      } else { g.view.focus(c.x, c.y, true); g.view.cam.tdist = g.view.cam.dist = 16; }
      return { kind, start: z.start, t: S.t, on: Sim.wxeAt(S, S.t).on };
    }, [kind, off, focusIce]);
    console.log(name, JSON.stringify(r), await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--cold') + '/' + getComputedStyle(document.body).getPropertyValue('--sleet')));
    await page.waitForTimeout(6000);
    console.log('  css', await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--cold') + '/' + getComputedStyle(document.body).getPropertyValue('--sleet')));
    await page.screenshot({ path: `${OUT}/wxe_${name}_${TAG}.png`, timeout: 120000 });
  };
  await go('ice', 120, 'ice');
  await go('cold', 120, 'cold');
  await go('crack', 120, 'crack', true);
  await go('crack', -1, 'crackday', true);
  await page.evaluate(() => { const g = window.game; g.view.cam.tdist = g.view.cam.dist = 12; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/wxe_crackzoom_${TAG}.png`, timeout: 120000 });
  // 预报：天气面板
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim; let z = null; for (let k = 0; k < 40 && !z; k++) { const s = Sim.wxeSlot(S, k); if (s.kind === 'cold') z = s; } for (const o of [1500, 1200, 900, 700, 400]) { S.t = z.start - o; if (!Sim.weatherAt(S, S.t).blizzard) break; } g.ui.hud(); g.ui.open('weather'); });
  await page.waitForTimeout(1500);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 500)));
  console.log('pill', await page.evaluate(() => [...document.querySelectorAll('.pill.wx')].map(e => e.textContent + '|' + e.className).join(' ; ')));
  await page.screenshot({ path: `${OUT}/wxe_panel_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => document.querySelector('[data-act=wxprep]')?.click());
  await page.waitForTimeout(800);
  console.log('after', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 300)));
}
