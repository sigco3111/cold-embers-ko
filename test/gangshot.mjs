// 掠夺者营地：模型（白天）、索贡面板、顶栏小标签、大地图标记
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    window.__noEvents = true; c.people = 40; // 太小的营地掠夺者看不上
    const DL = 720; S.t = Math.floor(S.t / DL + 1) * DL + 0.3 * DL;
    const gg = Sim.gangsOf(S)[0];
    // 揭开它周围一片
    for (let y = gg.y - 6; y <= gg.y + 6; y++) for (let x = gg.x - 6; x <= gg.x + 6; x++) if (x >= 0 && x < 48) S.reveal[y * 48 + x] = 1;
    Sim.rt(S).revealDirty = true;
    Sim.step(S, 1); Sim.step(S, 1);
    g.view.focus(gg.x + 0.5, gg.y + 0.5, true); g.view.cam.tdist = g.view.cam.dist = 9;
    window.__gg = gg.id;
    return { gg, st: S.gangs && S.gangs[gg.id] };
  });
  console.log('gang', JSON.stringify(r));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/gang_model_${TAG}.png`, timeout: 120000 });
  // 索贡
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, st = S.gangs[window.__gg]; S.t = st.next + 1; Sim.step(S, 1); Sim.step(S, 1); for (const k of ['food', 'wood']) g.ui.camp().stock[k] = 300; g.ui.hud(); g.ui.open('gang', window.__gg); });
  await page.waitForTimeout(1200);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 600)));
  console.log('pill', await page.evaluate(() => [...document.querySelectorAll('.pill.gang')].map(e => e.textContent).join(';')));
  await page.screenshot({ path: `${OUT}/gang_panel_${TAG}.png`, timeout: 120000 });
  // 大地图
  await page.evaluate(() => { const g = window.game; g.ui.close(); g.bigmap.show(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const m = document.querySelector('.bmk.gang'); if (m) m.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(600);
  console.log('bigmap', await page.evaluate(() => [...document.querySelectorAll('.bmk.gang')].map(e => e.className + ':' + e.textContent).join(';')));
  await page.screenshot({ path: `${OUT}/gang_map_${TAG}.png`, timeout: 120000 });
}
