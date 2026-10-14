// 营地生活：等床位的窝棚 + 围着火的人；白天孩子绕着雪人玩；夜里守夜人打火把巡逻
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const at = async (p, setup) => page.evaluate(([p, setup]) => {
    const g = window.game, S = g.S, c = g.ui.camp();
    S.t = Math.ceil(S.t / 720) * 720 + p * 720;
    const md = document.getElementById('modal'); if (md) md.classList.remove('show');
    window.__noEvents = true;
    if (setup === 'wait') c.wait = 6;
    const L = g.view.lifeSpots(c);
    const pt = setup === 'wait' ? L.shanty : setup === 'kids' ? L.play : [c.x, c.y];
    if (pt) { g.view.focus(pt[0], pt[1], true); g.view.cam.tdist = g.view.cam.dist = setup === 'night' ? 16 : 7; }
    return { shanty: L.shanty && L.shanty.map(v => +v.toFixed(1)), play: L.play && L.play.map(v => +v.toFixed(1)), patrolOk: L.patrol ? L.patrol.len.toFixed(0) : 'none', people: c.people, wait: c.wait };
  }, [p, setup]);
  console.log('wait', JSON.stringify(await at(0.42, 'wait')));
  await page.waitForTimeout(3000);
  console.log('figs', await page.evaluate(() => { const I = window.game.view.figInfo || []; const n = {}; for (const f of I) if (f) n[f.k] = (n[f.k] || 0) + 1; return JSON.stringify(n); }));
  await page.screenshot({ path: `${OUT}/life_wait_${TAG}.png`, timeout: 120000 });
  console.log('kids', JSON.stringify(await at(0.42, 'kids')));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/life_kids_${TAG}.png`, timeout: 120000 });
  // 点一个孩子看看
  const kid = await page.evaluate(() => { const v = window.game.view, I = v.figInfo, P = v.figPts; const i = I.findIndex(f => f && f.k === 'kid'); if (i < 0) return null; const p = v.project(P[i * 2], P[i * 2 + 1], 0.3); return p; });
  if (kid && kid.on) { await page.mouse.click(kid.x, kid.y); await page.waitForTimeout(900); console.log('kidpanel', await page.evaluate(() => (document.querySelector('#sheet') || {}).innerText?.slice(0, 160).replace(/\s+/g, ' '))); await page.screenshot({ path: `${OUT}/life_kidpanel_${TAG}.png`, timeout: 120000 }); await page.evaluate(() => window.game.ui.close()); }
  console.log('night', JSON.stringify(await at(0.76, 'night')));
  await page.waitForTimeout(3500);
  console.log('figs', await page.evaluate(() => { const I = window.game.view.figInfo || []; const n = {}; for (const f of I) if (f) n[f.k] = (n[f.k] || 0) + 1; return JSON.stringify(n); }));
  await page.evaluate(() => { const md = document.getElementById('modal'); if (md) md.classList.remove('show'); });
  await page.screenshot({ path: `${OUT}/life_night_${TAG}.png`, timeout: 120000 });
  // 镜头拉近一个守夜人
  const gd = await page.evaluate(() => { const v = window.game.view, I = v.figInfo, P = v.figPts; const i = I.findIndex(f => f && f.k === 'g'); if (i < 0) return null; v.focus(P[i * 2], P[i * 2 + 1], true); v.cam.tdist = v.cam.dist = 6; return [P[i * 2], P[i * 2 + 1]]; });
  console.log('guard', JSON.stringify(gd));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/life_guard_${TAG}.png`, timeout: 120000 });
}
