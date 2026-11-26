// 1.0.0 自动备份留哪几份（src/backup.js keepSet）：每 10 分钟一份连玩 3 天（每天睡 8 小时），手里一直有几分钟前、半小时前、几小时前和一天前的进度
import { keepSet } from '../src/backup.js';
let L = [], id = 0, now = 0, bad = 0;
const check = (n, ok, x = '') => { console.log('CHECK', n, ok ? 'ok' : 'FAIL', x); if (!ok) bad++; };
const add = why => { L.push({ id: ++id, at: now, why }); const k = keepSet(L, now); L = L.filter(r => k.has(r.id)); };
const ages = () => L.filter(r => r.why === 'auto').map(r => (now - r.at) / 60000).sort((a, b) => a - b);
let maxN = 0, worst = 0;
for (let day = 0; day < 3; day++) for (let m = 0; m < 16 * 60; m += 10) {
  now = (day * 1440 + m) * 60000; add('auto'); maxN = Math.max(maxN, L.length);
  const a = ages(), t = day * 1440 + m;
  // 已经玩了够久的话，应该有一份 ≥40 分钟前的、一份 ≥4 小时前的
  if (t >= 60 && !a.some(x => x >= 40)) worst++;
  if (t >= 6 * 60 && !a.some(x => x >= 240)) worst++;
}
check('at most 6 auto backups', maxN <= 6, maxN);
check('always an older backup once played long enough', worst === 0, worst);
check('newest kept', ages()[0] === 0);
check('one from yesterday or older', ages().some(x => x >= 1440), ages().map(Math.round).join(','));
for (const w of ['depart', 'import', 'wipe', 'restore', 'restore', 'del']) { now += 1000; add(w); }
const marks = L.filter(r => r.why !== 'auto').map(r => r.why);
check('newest 4 marks kept', marks.join(',') === 'wipe,restore,restore,del', marks.join(','));
check('marks do not push out autos', L.filter(r => r.why === 'auto').length >= 4);
console.log(bad ? `${bad} FAIL` : 'all ok');
