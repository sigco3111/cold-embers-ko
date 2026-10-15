// 第十三版小毛病：拍照保存、存档码存成文件/从文件读回、老存档营地周围迷雾
export default async function (page) {
  // 1. 迷雾：每个营地暖圈外 2 格内都探开了
  console.log('fog', await page.evaluate(() => {
    const S = window.game.S, Sim = window.__sim, out = [];
    for (const c of S.camps) {
      if (!Sim.getB(S, c.furnace)) continue;
      const r = Sim.heatRadius(S, c) + 2; let n = 0, miss = 0;
      for (let y = Math.floor(c.y - r); y <= c.y + r; y++) for (let x = Math.floor(c.x - r); x <= c.x + r; x++) {
        if (x < 0 || x >= 48 || y < 0) continue;
        if ((x + 0.5 - c.x) ** 2 + (y + 0.5 - c.y) ** 2 > r * r) continue;
        n++; if (!S.reveal[y * 48 + x]) miss++;
      }
      out.push(`${c.name}:${miss}/${n}`);
    }
    return out.join(' ');
  }));
  // 2. 存档码存成文件（无头浏览器里没有 claude.ai 的下载权限，走普通下载）
  await page.evaluate(() => window.game.exportCode()); await page.waitForTimeout(800);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#modal [data-act="savecode"]')]);
  const path = '/tmp/code-dl.txt'; await dl.saveAs(path);
  const fs = await import('fs'); const txt = fs.readFileSync(path, 'utf8');
  console.log('code file', dl.suggestedFilename(), txt.slice(0, 5), txt.length);
  // 3. 从文件读回来
  await page.click('#modal [data-act="close-modal"]'); await page.waitForTimeout(300);
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'import'; document.body.appendChild(b); b.click(); b.remove(); });
  await page.waitForTimeout(300);
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.click('#modal [data-act="importfile"]')]);
  await fc.setFiles(path); await page.waitForTimeout(600);
  console.log('import box', await page.evaluate(() => { const v = document.getElementById('importBox').value; return v.slice(0, 5) + ' ' + v.length; }));
  await page.click('#modal [data-act="import-yes"]'); await page.waitForTimeout(1500);
  console.log('after import', await page.evaluate(() => [document.getElementById('modal').className, window.game.S.camps.length, document.querySelector('#toasts') ? document.querySelector('#toasts').textContent.slice(-40) : ''].join(' | ')));
  // 4. 拍照保存
  await page.evaluate(() => window.game.photo.open()); await page.waitForTimeout(800);
  await page.evaluate(() => { const b = document.querySelector('#photobar [data-ph="shot"]'); if (b) b.click(); });
  await page.waitForSelector('#photoview.show', { timeout: 60000 });
  const [pd] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#photoview [data-pv="save"]')]);
  console.log('photo file', pd.suggestedFilename(), 'preview still open', await page.evaluate(() => document.getElementById('photoview').classList.contains('show')));
}
