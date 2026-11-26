export default async function (page) {
  await page.click('text=点起篝火');
  const r = await page.evaluate(() => {
    const v = window.game.view, S = window.game.S;
    const cv = v.fogBig, ctx = cv.getContext('2d');
    const out = [];
    for (const y of [5, 15, 22, 26, 30, 40]) { const py = Math.round((345 + 4 - y - 0.5) * cv.height / 353); const d = ctx.getImageData(Math.round((24 + 4) * cv.width / 56), py, 1, 1).data; out.push(y + ':' + d.join(',') + ' rev=' + S.reveal[y * 48 + 24]); }
    return out.join('\n') + '\nfogmesh vis ' + v.fogMesh.visible + ' y ' + v.fogMesh.position.y;
  });
  console.log(r);
  await page.evaluate(() => { const v = window.game.view; v.focus(24, 30, true); });
  await page.waitForTimeout(800);
}
