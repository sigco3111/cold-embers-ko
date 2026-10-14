// 小人固定站位：空闲人数、岗位人数变了，原来的人不跳位置；空闲的人不站进建筑；等床位的人在界面上看得到
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const setup = await page.evaluate(() => {
    const g = window.game, S = g.S, c = S.camps[0];
    g.view.focus(c.x, c.y - 1, true); g.view.cam.tdist = g.view.cam.dist = 16;
    const b = S.buildings.filter(b => b.camp === c.id && b.workers >= 3 && b.type !== 'warehouse').sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    c.auto = false;
    return { camp: c.id, b: b && b.id, bw: b && b.workers, people: c.people };
  });
  await page.waitForTimeout(1500);
  const snap = () => page.evaluate(({ camp, b }) => {
    const v = window.game.view, I = v.figInfo, P = v.figPts, f = {}, w = {};
    I.forEach((inf, k) => { if (!inf) return; if (inf.k === 'f' && inf.camp === camp) f[inf.i] = [P[k * 2], P[k * 2 + 1]]; if (inf.k === 'w' && inf.b === b) w[inf.i] = [P[k * 2], P[k * 2 + 1]]; });
    return { f, w, nf: Object.keys(f).length };
  }, setup);
  const a = await snap();
  // 从一栋建筑抽两个人出来，再来三个闲人
  await page.evaluate(({ b, camp }) => { const S = window.game.S, B = S.buildings.find(x => x.id === b); B.workers -= 2; S.camps.find(c => c.id === camp).people += 3; }, setup);
  await page.waitForTimeout(2500);
  const bb = await snap();
  const moved = (A, B, tol) => Object.keys(A).filter(i => B[i] && Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1]) > tol).length;
  const wMoved = Object.keys(bb.w).filter(i => a.w[i] && Math.abs(a.w[i][0] - bb.w[i][0]) > 0.55).length; // 干活时会左右晃 0.25
  console.log('idle', a.nf, '->', bb.nf, 'idleMoved', moved(a.f, bb.f, 0.01), 'workersLeft', Object.keys(bb.w).length, 'workerJumped', wMoved);
  const clip = await page.evaluate(({ camp }) => {
    const v = window.game.view, S = window.game.S, c = S.camps.find(x => x.id === camp), I = v.figInfo, P = v.figPts, rects = v.bldRects();
    let inB = 0, nearF = 0;
    I.forEach((inf, k) => { if (!inf || inf.k !== 'f' || inf.camp !== camp) return; const x = P[k * 2], y = P[k * 2 + 1]; if (Math.hypot(x - c.x, y - c.y) < 2.2) nearF++; if (rects.some(q => x > q[0] && x < q[2] && y > q[1] + 0.3 && y < q[3])) inB++; });
    return { inB, nearF, slots: v.idleSlots(c).length };
  }, setup);
  console.log('clip', JSON.stringify(clip));
  // 等床位
  const wt = await page.evaluate(async () => {
    const g = window.game, S = g.S, c = S.camps.find(x => x.id === S.active) || S.camps[0], Sim = window.__sim;
    c.people = Sim.bedsOf(S, c) - Sim.awayOf(S, c); c.wait = 5;
    await new Promise(r => setTimeout(r, 1200));
    const pill = [...document.querySelectorAll('#stats .pill')].find(e => (e.title || '').startsWith('人口'));
    g.ui.open('stock');
    await new Promise(r => setTimeout(r, 600));
    const iss = [...document.querySelectorAll('#sheet .issue b')].map(e => e.textContent).find(t => t.includes('等床位'));
    return { pill: pill && pill.textContent.trim(), wt: pill && !!pill.querySelector('.wt'), iss, wait: c.wait };
  });
  console.log('wait', JSON.stringify(wt));
  await page.screenshot({ path: `${OUT}/figs_${TAG}.png`, timeout: 120000 });
}
