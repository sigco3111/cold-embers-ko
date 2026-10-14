// 批量操作：拖出一排（电脑：按住左键拖；手机：开「一排」后拖），同类一起升级 / 派满人
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  const touch = TAG === 'phone';
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    window.__noEvents = true;
    const DL = 720; S.t = Math.floor(S.t / DL + 1) * DL + 0.3 * DL;
    const type = 'tent', s = window.__BLD[type].size;
    let row = null, best = 1e9;
    for (let y = Math.floor(c.y - 24); y <= c.y + 24; y++) for (let x = Math.floor(c.x - 24); x <= c.x + 24; x++) {
      const sl = Sim.rowSlots(type, x, y, x + 3 * s, y);
      if (sl.every(([a, b]) => Sim.checkPlace(S, type, a, b).ok)) { const d = Math.hypot(x + 4 - c.x, y - c.y) + (sl.some(([a, b]) => Sim.checkPlace(S, type, a, b).clears) ? 30 : 0); if (d < best) { best = d; row = sl; } }
    }
    if (!row) return null;
    // 材料只够建两栋：后两栋排队
    const c1 = Sim.buildCost(S, type, c.id, row[0][1]), c2 = Sim.buildCost(S, type, c.id, row[0][1], 1);
    for (const k in c1) c.stock[k] = c1[k] + c2[k] + 1;
    g.view.focus(row[1][0] + s, row[0][1] + 1, true); g.view.cam.tdist = g.view.cam.dist = 14;
    return { row, n0: Sim.countType(S, c.id, type), q0: (S.queue || []).length };
  });
  console.log('row', JSON.stringify(info));
  if (!info) return;
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.game.startPlace('tent'));
  await page.waitForTimeout(300);
  const pts = await page.evaluate(row => { const v = window.game.view; return row.map(([x, y]) => v.project(x + 1, y + 1, 0)); }, info.row);
  const a = pts[0], b = pts[3];
  if (!touch) {
    await page.mouse.move(a.x, a.y, { steps: 3 });
    await page.waitForTimeout(200);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.waitForTimeout(600);
    console.log('drag preview', await page.evaluate(() => { const P = window.game.place; return JSON.stringify({ end: P.end, plan: P.plan && P.plan.plan.map(e => e.st), cost: document.getElementById('placeCost').innerText }); }));
    await page.screenshot({ path: `${OUT}/row_drag_${TAG}.png`, timeout: 120000 });
    await page.mouse.up();
  } else {
    await page.click('#placeRow');
    await page.waitForTimeout(300);
    // 第一下点在起点：预览挪过去
    const ev = async (type, p) => page.evaluate(({ type, x, y }) => document.getElementById('c').dispatchEvent(new PointerEvent(type, { pointerId: 5, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, button: 0 })), { type, x: p.x, y: p.y });
    await ev('pointerdown', a); await page.waitForTimeout(60); await ev('pointerup', a); await page.waitForTimeout(300);
    console.log('anchor', await page.evaluate(() => JSON.stringify([window.game.place.x, window.game.place.y])), 'want', JSON.stringify(info.row[0]));
    await ev('pointerdown', { x: a.x, y: a.y + 50 });
    for (let i = 1; i <= 8; i++) { await ev('pointermove', { x: a.x + (b.x - a.x) * i / 8, y: a.y + 50 + (b.y - a.y) * i / 8 }); await page.waitForTimeout(40); }
    await ev('pointerup', { x: b.x, y: b.y + 50 });
    await page.waitForTimeout(600);
    console.log('drag preview', await page.evaluate(() => { const P = window.game.place; return JSON.stringify({ end: P.end, plan: P.plan && P.plan.plan.map(e => e.st), cost: document.getElementById('placeCost').innerText }); }));
    await page.screenshot({ path: `${OUT}/row_drag_${TAG}.png`, timeout: 120000 });
    await page.click('#placeOk');
  }
  await page.waitForTimeout(800);
  const after = await page.evaluate(({ n0, q0 }) => { const g = window.game, S = g.S, c = g.ui.camp(); return { built: window.__sim.countType(S, c.id, 'tent') - n0, queued: (S.queue || []).length - q0, toast: [...document.querySelectorAll('#toasts .toast')].map(t => t.innerText).slice(-2), placing: !!g.place, end: g.place && g.place.end }; }, info);
  console.log('after', JSON.stringify(after));
  await page.screenshot({ path: `${OUT}/row_done_${TAG}.png`, timeout: 120000 });
  // 同类面板
  await page.evaluate(() => { const g = window.game; g.cancelModes(); const S = g.S, c = g.ui.camp(); for (const k of ['wood', 'plank', 'stone']) c.stock[k] = 99999; const Sim = window.__sim; c.people = Math.max(c.people, 14);
    for (let i = 0, y = Math.floor(c.y - 9); y <= c.y + 9 && i < 3; y++) for (let x = Math.floor(c.x - 9); x <= c.x + 9 && i < 3; x++) if (Sim.checkPlace(S, 'kitchen', x, y).ok) { Sim.place(S, 'kitchen', x, y); i++; }
    const t = S.buildings.find(b => b.camp === c.id && b.type === 'kitchen'); window.__bt = t.id; for (const b of window.__sim.sameType(S, t)) if (b.workers) window.__sim.setWorkers(S, b.id, b.workers - 1); g.ui.open('bld', t.id); });
  await page.waitForTimeout(900);
  console.log('panel', await page.evaluate(() => [...document.querySelectorAll('#sheet .bulkr')].map(e => e.innerText.replace(/\s+/g, ' ')).join(' | ')));
  await page.evaluate(() => { const el = document.querySelector('#sheet .bulkr'); if (el) el.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/row_panel_${TAG}.png`, timeout: 120000 });
  await page.click('#sheet [data-act=bulkw]').catch(e => console.log('no bulkw', e.message.slice(0, 80)));
  await page.waitForTimeout(500);
  const lv = await page.evaluate(() => window.__sim.sameType(window.game.S, window.__sim.getB(window.game.S, window.__bt)).map(b => b.lvl).join(','));
  await page.click('#sheet [data-act=bulkup]').catch(e => console.log('no bulkup', e.message.slice(0, 80)));
  await page.waitForTimeout(700);
  console.log('bulk', lv, '->', await page.evaluate(() => window.__sim.sameType(window.game.S, window.__sim.getB(window.game.S, window.__bt)).map(b => b.lvl).join(',')), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.innerText).slice(-2))));
  await page.screenshot({ path: `${OUT}/row_bulk_${TAG}.png`, timeout: 120000 });
}
