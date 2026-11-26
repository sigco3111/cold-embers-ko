// 手机性能：用 CPU 采样看一帧里时间都花在哪（按函数自身耗时排序）
const N = +process.env.PROF_SEC || 15;
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.game; window.__noEvents = true; g.ui.closeModal && g.ui.closeModal(); const c = g.S.camps[0]; g.view.focus(c.x, c.y, true); g.view.cam.tdist = g.view.cam.dist = +(window.__dist || 30); });
  await page.waitForTimeout(1500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  const f0 = await page.evaluate(() => { window.__fc = 0; const tick = () => { window.__fc++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); return performance.now(); });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(N * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const fr = await page.evaluate(t0 => ({ frames: window.__fc, sec: (performance.now() - t0) / 1000 }), f0);
  // 自身耗时：样本数 × 间隔
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = (profile.endTime - profile.startTime) / profile.samples.length / 1000;
  for (const id of profile.samples) { const n = byId.get(id), cf = n.callFrame; const k = `${cf.functionName || '(anon)'} @${cf.lineNumber + 1}:${cf.columnNumber}`; self.set(k, (self.get(k) || 0) + dt); }
  // 含子调用：按我们自己的几个入口函数汇总
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const roots = (process.env.ROOTS || 'loop,frame,step,hud,renderPanel,badges,render,labels,syncLife,syncFigures,syncCracks,tick,floats,juice,drainFx,watchPerf,update,audioInfo,animPeople,animDeer,animParticles,refreshSpots,tutorial,getBoundingClientRect').split(',');
  const incl = {}; const cnt = new Map(); for (const id of profile.samples) cnt.set(id, (cnt.get(id) || 0) + 1);
  for (const [id, k] of cnt) { const seen = new Set(); let cur = id; while (cur != null) { const fnm = byId.get(cur).callFrame.functionName; if (roots.includes(fnm) && !seen.has(fnm)) { seen.add(fnm); incl[fnm] = (incl[fnm] || 0) + k * dt; } cur = parent.get(cur); } }
  const callers = {};
  for (const [id, k] of cnt) { const n = byId.get(id), fnm = n.callFrame.functionName; if (!/getBoundingClientRect|clientWidth|clientHeight|offset|Layout|garbage/.test(fnm)) continue; let p = byId.get(parent.get(id)), chain = []; for (let i = 0; i < 3 && p; i++) { chain.push(`${p.callFrame.functionName || 'anon'}@${p.callFrame.lineNumber + 1}`); p = byId.get(parent.get(p.id)); } const key = fnm + ' <- ' + chain.join(' <- '); callers[key] = (callers[key] || 0) + k * dt; }
  const tot = profile.samples.length * dt;
  console.log(`frames ${fr.frames} in ${fr.sec.toFixed(1)}s = ${(fr.frames / fr.sec).toFixed(1)} fps; sampled ${(tot / 1000).toFixed(2)}s`);
  console.log('INCL ' + Object.entries(incl).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / fr.frames).toFixed(2)}ms/f`).join(' | '));
  console.log('CALLERS\n' + Object.entries(callers).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `  ${(v / fr.frames).toFixed(2)}ms/f ${k}`).join('\n'));
  console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${(v / fr.frames).toFixed(2)}ms/f ${(v / tot * 100).toFixed(1)}% ${k}`).join('\n'));
}
