// 第十三版装扮的画面：MODE=dress（装扮页）| flame（炉火换色，夜里）| flag（旗杆上的狼头旗）| frame（拍照的相框预览和成片）| album（相册页和大图）
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
const MODE = process.env.MODE || 'dress';
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; window.__noEvents = true;
    const bk = Sim.bookOf(S); for (const a of Sim.ACH) if (a.cat) bk.a[a.id] = bk.a[a.id] || S.t;
    Sim.bookSeen && Sim.bookSeen(S, 'a'); bk.fresh = [];
  });
  const shot = async n => { await page.screenshot({ path: `${OUT}/${n}_${TAG}.png`, timeout: 120000 }); console.log('shot', n); };
  if (MODE === 'dress') {
    await page.evaluate(() => { const g = window.game, Sim = window.__sim; Sim.setFlame(g.S, null, 'gold'); Sim.setFlag(g.S, 'star'); Sim.setFrame(g.S, 'copper'); g.ui.open('dress'); });
    await page.waitForTimeout(1500); await shot('dress_top');
    await page.evaluate(() => { const s = document.querySelector('#sheet'); s.scrollTop = 520; });
    await page.waitForTimeout(800); await shot('dress_mid');
    await page.evaluate(() => { const s = document.querySelector('#sheet'); s.scrollTop = 99999; });
    await page.waitForTimeout(800); await shot('dress_end');
    console.log('text', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 900)));
    // 点一下「冰蓝」（全部营地）
    await page.evaluate(() => { const b = document.querySelector('[data-act=setflame][data-arg="all:blue"]'); b && b.click(); });
    await page.waitForTimeout(500);
    console.log('after', await page.evaluate(() => { const g = window.game, Sim = window.__sim; return [Sim.flameOf(g.S, Sim.mainCamp(g.S)), !!document.querySelector('.dpick.on [style*="7fd8ff"]')]; }));
  }
  if (MODE === 'flame') {
    const ids = (process.env.FLAMES || 'gold,blue,purple,green,aurora').split(',');
    await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, c = Sim.mainCamp(S), DL = 720; S.t = Math.floor(S.t / DL) * DL + 0.8 * DL; g.ui.close(); g.view.focus(c.x, c.y, true); g.view.cam.tdist = g.view.cam.dist = 15; });
    for (const id of ids) {
      await page.evaluate(id => { const g = window.game, Sim = window.__sim; Sim.setFlame(g.S, null, id); }, id);
      await page.waitForTimeout(2500); await shot('flame_' + id);
    }
  }
  if (MODE === 'flag') {
    const r = await page.evaluate(id => {
      const g = window.game, S = g.S, Sim = window.__sim, c = Sim.mainCamp(S);
      for (const k of ['wood', 'plank', 'stone', 'iron', 'steel']) c.stock[k] = 99999;
      let at = null, best = 1e9;
      for (let y = Math.floor(c.y - 10); y <= c.y + 10; y++) for (let x = Math.floor(c.x - 10); x <= c.x + 10; x++) if (Sim.checkPlace(S, 'flagpole', x, y).ok) { const d = Math.hypot(x - c.x - 3, y - c.y + 4); if (d < best) { best = d; at = [x, y]; } }
      const q = Sim.place(S, 'flagpole', at[0], at[1]); Sim.setFlag(S, id); g.view.syncBuildings(true);
      g.view.focus(at[0] + 0.5, at[1] + 0.5, true); g.view.cam.tdist = g.view.cam.dist = 7; g.ui.close();
      return { at, ok: q.ok };
    }, process.env.FLAG || 'wolf');
    console.log('flag', JSON.stringify(r));
    await page.waitForTimeout(3000); await shot('flag_' + (process.env.FLAG || 'wolf'));
  }
  if (MODE === 'frame') {
    const fr = process.env.FRAME || 'copper';
    await page.evaluate(fr => { const g = window.game, Sim = window.__sim; Sim.setFrame(g.S, fr); g.ui.close(); g.photo.open(); }, fr);
    await page.waitForTimeout(2500); await shot('frame_view_' + fr);
    await page.evaluate(() => window.game.photo.shoot());
    await page.waitForFunction(() => document.getElementById('photoview').classList.contains('show'), null, { timeout: 120000 });
    await page.waitForTimeout(1500); await shot('frame_photo_' + fr);
    await page.evaluate(() => document.querySelector('[data-pv=album]').click());
    await page.waitForTimeout(2500);
    console.log('album btn', await page.evaluate(() => document.querySelector('[data-pv=album]').textContent));
  }
  if (MODE === 'ach') {
    await page.evaluate(() => { const g = window.game; g.ui.open('ach'); });
    await page.waitForTimeout(1500); await shot('ach_top');
    await page.evaluate(() => { const s = document.querySelector('#sheet'); s.scrollTop = 700; });
    await page.waitForTimeout(800); await shot('ach_mid');
    console.log('ach', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 300)));
  }
  if (MODE === 'car') {
    // 出发：车队领头那辆车插着旗
    const r = await page.evaluate(id => {
      const g = window.game, S = g.S, Sim = window.__sim, J = Sim.journeyOf(S), m = Sim.mainCamp(S);
      m.people = Math.max(m.people, 90); for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) m.stock[k] = Math.max(m.stock[k] || 0, 20000);
      for (let s = 0; s <= J.stage; s++) for (let k = 0; k < 4; k++) Sim.chapState(S).ok[s + ':' + k] = 1;
      S.reveal.fill(1); Sim.rt(S).revealN = (Sim.rt(S).revealN || 0) + 1; Sim.dirty(S);
      const P = J.plan || (J.plan = {}); P.mode = {}; for (const c of S.camps) P.mode[c.id] = 'douse';
      Sim.setFlag(S, id);
      const d = Sim.depart(S); if (!d.ok) return { err: d.reason };
      let t = 0; while (J.trip && J.trip.d < 14 && t < 600) { if (J.trip.road) Sim.resolveRoad(S, 0); Sim.step(S, 0.5); t++; }
      g.ui.close(); return { d: J.trip && J.trip.d, phase: J.trip && J.trip.phase };
    }, process.env.FLAG || 'compass');
    console.log('car', JSON.stringify(r));
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const g = window.game, v = g.view, T = window.__sim.journeyOf(g.S).trip; const p = window.__sim.tripPos({ path: T.path, d: T.d }); v.focus(p.x, p.y, true); v.cam.tdist = v.cam.dist = 9; g.togglePause(true); });
    await page.waitForTimeout(3000); await shot('car_' + (process.env.FLAG || 'compass'));
  }
  if (MODE === 'album') {
    // 自动拍三张，再打开相册
    for (const cap of ['抵达北境第 1 站·灰帆原', '第 1 座烽火塔点亮', '星核产线三星']) {
      await page.evaluate(cap => window.game.albumShot(cap, 0), cap);
      await page.waitForTimeout(2500);
    }
    await page.waitForTimeout(1500);
    console.log('toast', await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.innerText).join(' | ')));
    await page.evaluate(() => { const g = window.game; g.ui.open('menu'); });
    await page.waitForTimeout(1500);
    console.log('menu', await page.evaluate(() => [...document.querySelectorAll('.mrow2 .mlink')].map(b => b.innerText.replace(/\s+/g, ' ')).join(' | ')));
    await page.evaluate(() => window.game.ui.open('album'));
    await page.waitForTimeout(2000); await shot('album_page');
    await page.evaluate(() => document.querySelector('.alcell').click());
    await page.waitForTimeout(1500); await shot('album_big');
    // 删除：点两下
    await page.evaluate(() => { const b = document.querySelector('[data-av=del]'); b.click(); b.click(); });
    await page.waitForTimeout(1500);
    console.log('after del', await page.evaluate(() => document.querySelectorAll('.alcell').length));
  }
}
