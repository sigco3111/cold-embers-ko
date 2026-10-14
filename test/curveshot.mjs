// 数据曲线：营地页（人口 / 心情 / 温度）、物资页（库存 / 产量），悬停提示，手机布局
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  const t = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim;
    window.__noEvents = true;
    const t0 = performance.now();
    window.__simstep(600);
    Sim.catchUp(S, 2400, 0.25);
    window.__simstep(900);
    const c = g.ui.camp(), H = c.hist;
    return { ms: Math.round(performance.now() - t0), f: H.f.n, c: H.c.n, off: H.off, keys: Object.keys(H.f.v).length };
  });
  console.log('hist', JSON.stringify(t));
  await page.keyboard.press('g');
  await page.waitForTimeout(900);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 300)));
  await page.screenshot({ path: `${OUT}/curve_camp_${TAG}.png`, timeout: 120000 });
  // 悬停 / 按住
  const box = await page.evaluate(() => { const sv = document.querySelector('.cv[data-cv=mood] svg'); sv.scrollIntoView({ block: 'center' }); const r = sv.getBoundingClientRect(); return { x: r.left + r.width * 0.55, y: r.top + r.height * 0.5 }; });
  if (TAG === 'phone') await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerType: 'touch' })); }, box);
  else await page.mouse.move(box.x, box.y, { steps: 3 });
  await page.waitForTimeout(400);
  console.log('tip', await page.evaluate(() => { const t = document.querySelector('.cv[data-cv=mood] .cvtip'); return t && t.style.display + ' ' + t.innerText.replace(/\s+/g, ' '); }));
  await page.screenshot({ path: `${OUT}/curve_hover_${TAG}.png`, timeout: 120000 });
  await page.click('[data-act=cvtab][data-arg=res]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/curve_res_${TAG}.png`, timeout: 120000 });
  console.log('res', await page.evaluate(() => [...document.querySelectorAll('.cvleg')].map(e => e.innerText.replace(/\s+/g, ' ')).join(' | ')));
  await page.click('[data-act=cvrange][data-arg=all]');
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.getElementById('sheet').scrollTop = 9999; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/curve_all_${TAG}.png`, timeout: 120000 });
}
