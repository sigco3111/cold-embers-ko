// 收集册：老存档第一次补记的提示、各栏的样子、点格子看详情
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(4000);
  console.log('toasts', await page.evaluate(() => [...document.querySelectorAll('.toast .tm')].map(e => e.innerText).join(' | ')));
  console.log('book', await page.evaluate(() => { const N = window.__sim.bookCount(window.game.S); return JSON.stringify({ got: N.got, all: N.all, ach: N.cats.a, emb: window.game.S.meta.embers, dot: document.getElementById('menuBtn').classList.contains('dot') }); }));
  await page.screenshot({ path: `${OUT}/book_toast_${TAG}.png`, timeout: 120000 });
  // 从菜单进
  await page.evaluate(() => window.game.ui.open('menu'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/book_menu_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => document.querySelector('.mlink.book').click());
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/book_a_${TAG}.png`, timeout: 120000 });
  for (const t of ['b', 'r', 'l', 's', 'p']) {
    await page.evaluate(t => document.querySelector(`[data-act="booktab"][data-arg="${t}"]`).click(), t);
    await page.waitForTimeout(t === 'b' ? 2500 : 700);
    if (t === 'b' || t === 'r') { await page.evaluate(() => { const e = document.querySelector('.bkc:not(.off)'); e && e.click(); }); await page.waitForTimeout(500); }
    await page.screenshot({ path: `${OUT}/book_${t}_${TAG}.png`, timeout: 120000 });
  }
  console.log('fresh left', await page.evaluate(() => window.game.S.meta.book.fresh.length));
}
