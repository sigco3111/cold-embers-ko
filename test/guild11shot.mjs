// 1.1 北方商会：没有驿站时的说明、卖货、订单、买（装饰图纸 / 余烬 / 救急物资）、地图上的驿站和装饰
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/guild_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  await page.evaluate(() => { window.__noEvents = true; const g = window.game, S = g.S; S.meta.tut = true; S.meta.hintOff = true; g.ui.tutorial(); g.ui.close(); });
  const open = async (n, pg) => { await page.evaluate(pg => { const u = window.game.ui; u.gPg = pg; u.open('guild'); }, pg); await page.waitForTimeout(900); await shot(page, n); };
  await open('none', 'sell');
  // 在主营地盖一座驿站和几样装饰
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); S.active = m.id;
    const put = type => {
      for (let r = 2; r < 14; r++) for (let y = Math.floor(m.y) - r; y <= m.y + r; y++) for (let x = Math.floor(m.x) - r; x <= m.x + r; x++) {
        if (Math.max(Math.abs(x - m.x), Math.abs(y - m.y)) < r - 1) continue;
        const c = Sim.checkPlace(S, type, x, y); if (c.ok) { const res = Sim.place(S, type, x, y); if (res.ok) return Sim.getB(S, res.id); }
      }
      return null;
    };
    for (const k of ['plank', 'iron', 'stone', 'wood']) m.stock[k] = Math.max(m.stock[k] || 0, 3000);
    const p = put('guildpost'); if (p) { p.done = true; delete p.prog; }
    for (let i = 0; i < 3; i++) Sim.step(S, 1);
    const G = Sim.guildOf(S); G.silver = 2600;
    S.meta.shop = { gbench: 1, glamp: 1, gfount: 1 };
    const decos = ['gbench', 'glamp', 'gfount'].map(t => { const b = put(t); return b && [t, b.x, b.y]; });
    window.__gp = p && [p.x, p.y];
    return { post: !!p, decos, orders: G.orders.length };
  });
  console.log('GUILD', JSON.stringify(info));
  await open('sell', 'sell');
  await page.evaluate(() => { window.game.ui.actDo('gsell', 'wood:200'); }).catch(() => {});
  await page.evaluate(() => window.game.ui.renderPanel(true)); await page.waitForTimeout(500); await shot(page, 'sold');
  await open('order', 'order');
  await open('buy', 'buy');
  await page.evaluate(() => { window.game.ui.sheet.scrollTop = 99999; }); await page.waitForTimeout(400); await shot(page, 'buy2');
  // 地图上的驿站
  await page.evaluate(() => {
    const g = window.game; g.ui.close(); const [x, y] = window.__gp || [0, 0];
    g.view.focus(x + 1, y + 1, true); g.view.cam.tdist = g.view.cam.dist = 13; for (let i = 0; i < 20; i++) g.view.frame(0.05);
  });
  await page.waitForTimeout(1200); await shot(page, 'map');
}
