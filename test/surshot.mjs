// 在线小惊喜：走失驯鹿、流星坠落、极光夜「一起看」
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const force = kind => page.evaluate(kind => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    window.__noEvents = true;
    // 测试存档是脚本造的，营地周围只探开了一小圈：先把供热圈外几格探开，惊喜才有地方出
    if (!S.__rev) { S.__rev = 1; Sim.revealCircle(S, c.x, c.y, Sim.heatRadius(S, c) + 4); Sim.dirty(S); }
    for (let k = 0; k < 30; k++) { S.sur = null; S.surNext = 0; S.t += 13; const u = Sim.rollSurprise(S); if (u && u.kind === kind) break; }
    S.sur && (S.sur.kind = kind);
    g.drainFx();
    const u = S.sur;
    g.view.focus(u.x + 0.5, u.y + 0.5, true); g.view.cam.tdist = g.view.cam.dist = 9;
    return u;
  }, kind);
  const d = await force('deer');
  console.log('deer', JSON.stringify(d));
  await page.waitForTimeout(2500);
  console.log('tags', await page.evaluate(() => [...document.querySelectorAll('.surtag')].map(e => e.innerText.replace(/\s+/g, ' ')).join(' | ')));
  await page.screenshot({ path: `${OUT}/sur_deer_${TAG}.png`, timeout: 120000 });
  const box = await page.evaluate(() => { const e = document.querySelector('.surtag.deer'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  if (box) await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(600);
  console.log('after deer', await page.evaluate(() => JSON.stringify({ sur: window.game.S.sur, toast: [...document.querySelectorAll('.toast .tm')].map(e => e.innerText).slice(-3) })));
  await page.evaluate(() => { const S = window.game.S, u = S.sur; });
  const m = await force('meteor');
  console.log('meteor', JSON.stringify(m));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/sur_fall_${TAG}.png`, timeout: 120000 });
  await page.waitForTimeout(2500);
  console.log('tags', await page.evaluate(() => [...document.querySelectorAll('.surtag')].map(e => e.innerText.replace(/\s+/g, ' ')).join(' | ')));
  await page.screenshot({ path: `${OUT}/sur_meteor_${TAG}.png`, timeout: 120000 });
  // 极光夜
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    const DL = 720; let d = Math.floor(S.t / DL);
    for (let k = 0; k < 40; k++) { const t = (d + k) * DL + 0.75 * DL; if (Sim.skyAt(S, t).aurora > 0.9) { S.t = t; break; } }
    S.sur = null; Sim.rollSurprise(S); g.drainFx();
    g.view.focus(c.x, c.y - 2, true); g.view.cam.tdist = g.view.cam.dist = 16;
  });
  await page.waitForTimeout(2500);
  console.log('aur', await page.evaluate(() => window.game.S.aurOpen + ' pill:' + !!document.querySelector('.pill.aurgo')));
  await page.screenshot({ path: `${OUT}/sur_aurora_${TAG}.png`, timeout: 120000 });
  const pb = await page.evaluate(() => { for (const e of document.querySelectorAll('.pill.aurgo, #aurBtn')) { const b = e.getBoundingClientRect(); if (b.width > 0) return { x: b.x + b.width / 2, y: b.y + b.height / 2, id: e.id || e.className }; } return null; });
  console.log('aur btn', JSON.stringify(pb));
  if (pb) await page.mouse.click(pb.x, pb.y);
  await page.waitForTimeout(700);
  console.log('after aur', await page.evaluate(() => window.game.S.aurOpen + ' pill:' + !!document.querySelector('.pill.aurgo') + ' ' + [...document.querySelectorAll('.toast .tm')].map(e => e.innerText).slice(-2).join(' | ')));
}
