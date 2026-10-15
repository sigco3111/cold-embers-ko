// 存档位窗口：标题画面上打开，「关闭」要能关上；删别的存档位、删正在玩的存档位都要生效
const KEY = 'hanjin-beixing-v1';
export default async function (page) {
  const st = () => page.evaluate(() => ({ modal: document.getElementById('modal').className, slots: !!document.querySelector('#modal .slots') }));
  const clickReal = async sel => {
    const b = await page.$(sel); if (!b) return 'missing ' + sel;
    const box = await b.boundingBox();
    const hit = await page.evaluate(([x, y, sel]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest(sel)); }, [box.x + box.width / 2, box.y + box.height / 2, sel]);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    return hit ? 'hit' : 'BLOCKED';
  };
  // 第 2 个存档位放一份同样的存档
  await page.evaluate(k => { localStorage.setItem(k + '-s2', localStorage.getItem(k)); }, KEY);
  console.log('open slots', await clickReal('#title [data-act="slots"]'), JSON.stringify(await st()));
  console.log('close', await clickReal('#modal .mbtns [data-act="close-modal"]'), JSON.stringify(await st()));
  await clickReal('#title [data-act="slots"]');
  console.log('del slot 2', await clickReal('#modal [data-act="slotdel"][data-arg="2"]'), await page.evaluate(() => document.querySelector('#modal .mbox p').textContent));
  console.log('cancel', await clickReal('#modal [data-act="slots"]'), JSON.stringify(await st()));
  await clickReal('#modal [data-act="slotdel"][data-arg="2"]');
  console.log('confirm', await clickReal('#modal [data-act="slotdel-yes"]'), 'slot2 gone:', await page.waitForFunction(k => localStorage.getItem(k + '-s2') === null, KEY, { timeout: 15000 }).then(() => true, () => false)); // 删之前先存备份，异步
  console.log('row 2 now', await page.evaluate(() => document.querySelectorAll('#modal .slotrow')[1].textContent));
  // 再放回去，删正在玩的 1 号：应该换到 2 号
  await page.evaluate(k => { localStorage.setItem(k + '-s2', localStorage.getItem(k)); }, KEY);
  await clickReal('#modal .mbtns [data-act="close-modal"]');
  await clickReal('#title [data-act="slots"]');
  console.log('del cur', await clickReal('#modal [data-act="slotdel"][data-arg="1"]'), await page.evaluate(() => document.querySelector('#modal .mbox').textContent.slice(0, 160)));
  await page.evaluate(() => sessionStorage.setItem('shot-nosave', '1')); // 刷新后别再把测试存档写回 1 号
  await Promise.all([page.waitForEvent('load', { timeout: 180000 }), clickReal('#modal [data-act="slotdel-yes"]')]);
  await page.waitForTimeout(2500);
  console.log('keys', await page.evaluate(() => Object.keys(localStorage).join(',')), 'url', page.url());
  console.log('after reload: slot1 gone', await page.evaluate(k => localStorage.getItem(k) === null, KEY), 'cur slot', await page.evaluate(k => localStorage.getItem(k + '-slot'), KEY));
}
