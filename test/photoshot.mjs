// 拍照模式：藏界面、调时辰/滤镜/镜头、拍照出预览
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  await page.evaluate(() => { window.__noEvents = true; const g = window.game, c = g.ui.camp(); g.view.focus(c.x, c.y, true); g.view.cam.tdist = g.view.cam.dist = 22; });
  await page.waitForTimeout(800);
  if (TAG === 'phone') await page.evaluate(() => window.game.photo.open()); else await page.keyboard.press('h');
  await page.waitForTimeout(900);
  console.log('ui hidden', await page.evaluate(() => ['top', 'toolbar', 'side', 'labels'].map(id => { const e = document.getElementById(id); return id + ':' + (e ? getComputedStyle(e).display : 'none'); }).join(' ')));
  await page.screenshot({ path: `${OUT}/photo_bar_${TAG}.png`, timeout: 120000 });
  await page.click('#photobar [data-ph=tod][data-v="2"]');
  await page.click('#photobar [data-ph=f][data-v=warm]');
  await page.evaluate(() => { const r = document.querySelector('#photobar input[type=range]'); r.value = 15; r.dispatchEvent(new Event('input', { bubbles: true })); window.game.view.cam.tdist = 12; });
  await page.waitForTimeout(2500);
  await page.click('#photobar [data-ph=hide]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/photo_low_${TAG}.png`, timeout: 120000 });
  await page.click('#photopeek');
  await page.waitForTimeout(200);
  const t0 = Date.now();
  await page.click('#photobar [data-ph=shot]');
  await page.waitForSelector('#photoview.show', { timeout: 60000 });
  console.log('preview after', Date.now() - t0, 'ms');
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const img = document.querySelector('#photoview img');
    if (!img.complete) await new Promise(r => img.onload = r);
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    return { w: img.naturalWidth, h: img.naturalHeight, lum: Math.round(s / (64 * 64 * 3)), shown: document.getElementById('photoview').classList.contains('show'), photos: window.game.S.meta.photos, dl: document.querySelector('#photoview a').download };
  });
  console.log('shot', JSON.stringify(r));
  await page.screenshot({ path: `${OUT}/photo_view_${TAG}.png`, timeout: 120000 });
  await page.click('#photoview [data-pv=done]');
  await page.waitForTimeout(600);
  console.log('after exit', await page.evaluate(() => ({ photo: document.body.classList.contains('photo'), pitch: window.game.view.photoPitch, filter: window.game.canvas.style.filter, top: getComputedStyle(document.getElementById('top')).display })));
  await page.waitForTimeout(3500);
  console.log('book', await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.innerText.replace(/\s+/g, ' ')).join(' | ')));
}
