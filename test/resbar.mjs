// 顶部资源条：常驻几种 + 「全部」抽屉；PC 打开侧面板时资源条不钻到面板底下
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(2500);
  const phone = await page.evaluate(() => !document.getElementById('resbar').offsetHeight);
  const info = () => page.evaluate(() => {
    const t = document.getElementById('top').getBoundingClientRect(), rb = document.getElementById('resbar').getBoundingClientRect();
    const chips = [...document.querySelectorAll('#reschips .res')].map(e => e.className.replace('res', '').trim() + ':' + e.textContent);
    const d = document.getElementById('resdrawer'), dr = d.getBoundingClientRect();
    const sh = document.getElementById('sheet'), sr = sh.getBoundingClientRect();
    return { topR: Math.round(t.right), rbR: Math.round(rb.right), chips, all: document.getElementById('resAll').className + ' ' + document.getElementById('resAll').textContent, drawer: d.classList.contains('show') ? { x: Math.round(dr.x), y: Math.round(dr.y), w: Math.round(dr.width), h: Math.round(dr.height), cells: d.querySelectorAll('.rdc').length, tiers: d.querySelectorAll('.rdt').length } : null, sheetL: sh.classList.contains('show') ? Math.round(sr.left) : null };
  });
  console.log('closed', JSON.stringify(await info()));
  await page.screenshot({ path: `${OUT}/rb_closed_${TAG}.png`, timeout: 120000 });
  const tgt = phone ? '#stats .pill.more' : '#resAll';
  const b = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, tgt);
  if (phone) await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1200);
  console.log('open', JSON.stringify(await info()));
  await page.screenshot({ path: `${OUT}/rb_open_${TAG}.png`, timeout: 120000 });
  // 点抽屉里的一格 → 打开物资总览，抽屉收起
  const c = await page.evaluate(() => { const e = document.querySelector('#resdrawer .rdc'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (phone) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(1500);
  const p = await page.evaluate(() => document.getElementById('ui') ? '' : (window.game && window.game.ui.panel ? window.game.ui.panel.kind : (document.getElementById('sheet').classList.contains('show') ? 'shown' : 'none')));
  console.log('panel', p, JSON.stringify(await info()));
  await page.screenshot({ path: `${OUT}/rb_panel_${TAG}.png`, timeout: 120000 });
}
