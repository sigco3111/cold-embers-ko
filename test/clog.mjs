// 1.0.0：菜单里的「更新日志」，标题和菜单底部的版本号；v13 存档打开时弹「v1.0.0 正式版」（KEEPVER=1 + VER13=1 时）
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  const txt = sel => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ') : null; }, sel);
  if (process.env.VER13) {
    await page.waitForFunction(() => document.getElementById('modal').classList.contains('show'), null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(800);
    const m = await txt('#modal');
    console.log('modal', m.slice(0, 800));
    console.log('CHECK v1 popup', /v1\.0\.0 正式版/.test(m) && !/极北篇/.test(m) ? 'ok' : 'FAIL');
    await page.screenshot({ path: `${OUT}/wn14_${TAG}.png`, timeout: 120000 });
    await page.evaluate(() => document.querySelector('#modal [data-act="close-modal"]').click());
    await page.waitForTimeout(400);
    console.log('ver', await page.evaluate(() => window.game.S.meta.ver));
  }
  await page.evaluate(() => document.getElementById('menuBtn').click());
  await page.waitForTimeout(900);
  const foot = await txt('.mfoot');
  console.log('CHECK mfoot', foot, /v1\.0\.0/.test(foot) ? 'ok' : 'FAIL');
  await page.evaluate(() => { const b = document.querySelector('[data-act="changelog"]'); b.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/clog_menu_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => document.querySelector('[data-act="changelog"]').click());
  await page.waitForTimeout(700);
  const m = await txt('#modal .mbox');
  console.log('changelog', m.slice(0, 400));
  const n = await page.evaluate(() => [document.querySelectorAll('#modal .clv').length, document.querySelectorAll('#modal .clv[open]').length]);
  console.log('CHECK blocks', n, n[0] >= 10 && n[1] === 2 ? 'ok' : 'FAIL');
  const fit = await page.evaluate(() => { const b = document.querySelector('#modal .mbox').getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height), innerWidth, innerHeight]; });
  console.log('box', fit);
  await page.screenshot({ path: `${OUT}/clog_${TAG}.png`, timeout: 120000 });
  // 展开最老的一版，滚到底
  await page.evaluate(() => { const d = [...document.querySelectorAll('#modal .clv')]; d[d.length - 1].querySelector('summary').click(); const b = document.querySelector('#modal .mbox'); b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/clog_end_${TAG}.png`, timeout: 120000 });
}
