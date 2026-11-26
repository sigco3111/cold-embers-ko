// 「怎么玩」里第十三版的几段：北境、烽火塔、矿点与挪位置、成就与装扮
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.game.ui.actDo('help'); });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => { const m = document.querySelector('#modal .mbox'), t = m.innerText; const el = [...m.querySelectorAll('p')].find(p => p.innerText.startsWith('北境')); if (el) el.scrollIntoView({ block: 'start' }); return { has: ['北境：', '烽火塔：', '矿点与挪位置：', '成就与装扮：'].map(k => t.includes(k)), len: t.length, scroll: m.scrollHeight > m.clientHeight }; });
  console.log('help', JSON.stringify(r));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/help13_${TAG}.png`, timeout: 120000 });
}
