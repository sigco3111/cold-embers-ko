// 篝火庆典：熔炉面板里的卡片、点「办一场」后的场子（白天、夜里），庆典里的人说的话
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
const CAMP = +(process.env.CAMP || 0);
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(CAMP => {
    const g = window.game, S = g.S, Sim = window.__sim;
    window.__noEvents = true;
    if (CAMP) S.active = CAMP;
    const c = g.ui.camp();
    c.festAt = null; c.fest = null;
    for (const k in Sim.festCost(S, c)) c.stock[k] = Math.max(c.stock[k] || 0, Sim.festCost(S, c)[k] + 50);
    // 白天
    const DL = 720; S.t = Math.floor(S.t / DL + 1) * DL + 0.3 * DL;
    g.ui.open('bld', c.furnace);
  }, CAMP);
  await page.waitForTimeout(900);
  await page.evaluate(() => { const e = document.querySelector('.festcard'); e && e.scrollIntoView(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/fest_card_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => document.querySelector('[data-act="fest"]').click());
  await page.waitForTimeout(2500);
  console.log('fest', await page.evaluate(() => { const g = window.game, c = g.ui.camp(), L = g.view.lifeSpots(c); return JSON.stringify({ fest: c.fest, spot: L.fest, toasts: [...document.querySelectorAll('.toast .tm')].map(e => e.innerText).join(' | ') }); }));
  await page.screenshot({ path: `${OUT}/fest_day_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { const v = window.game.view; v.cam.tdist = v.cam.dist = 8; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/fest_close_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game, S = g.S, DL = 720; const c = g.ui.camp(); const keep = c.fest.until - S.t; S.t = Math.floor(S.t / DL) * DL + 0.8 * DL; c.fest.until = S.t + keep; c.fest.t0 = S.t; const v = g.view; v.cam.tdist = v.cam.dist = 13; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/fest_night_${TAG}.png`, timeout: 120000 });
  // 点一个跳舞的人
  const said = await page.evaluate(() => { const v = window.game.view, i = v.figInfo.findIndex(f => f && f.k === 'fd'); if (i < 0) return null; const p = v.project(v.figPts[i * 2], v.figPts[i * 2 + 1], 0.5); return p; });
  if (said) { await page.mouse.click(said.x, said.y); await page.waitForTimeout(700); console.log('person', await page.evaluate(() => (document.querySelector('#sheet') || {}).innerText?.slice(0, 160).replace(/\s+/g, ' '))); }
}
