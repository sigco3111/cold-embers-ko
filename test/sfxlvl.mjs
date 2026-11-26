// 1.0.0 新音效：离线渲染每个提示音，量响度和长度。新的（点塔、天火、拍照、挪建筑）不能哑、不能比号角响太多
let bad = 0;
const check = (n, ok, extra = '') => { console.log('CHECK', n, ok ? 'ok' : 'FAIL', extra); if (!ok) bad++; };
export default async function (page) {
  const names = ['build', 'win', 'horn', 'tap', 'tower', 'pillar', 'sky', 'skyend', 'shutter', 'move'];
  const R = await page.evaluate(async names => {
    const Sound = window.game.audio.constructor, out = {};
    for (const n of names) {
      const ctx = new OfflineAudioContext(2, 44100 * 8, 44100);
      Object.defineProperty(ctx, 'state', { get: () => 'running' });
      const s = new Sound(); s.ctx = ctx; s.sfxOn = true; s.setup();
      s.windG.gain.value = 0; s.rumbleG.gain.value = 0; s.whistleG.gain.value = 0;
      s.play(n, 3);
      const d = (await ctx.startRendering()).getChannelData(0);
      let pk = 0, ss = 0, last = 0, nan = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (!isFinite(a)) { nan++; continue; } if (a > pk) pk = a; ss += a * a; if (a > 0.003) last = i; }
      out[n] = { pk, rms: Math.sqrt(ss / d.length), len: last / 44100, nan };
    }
    return out;
  }, names);
  for (const n of names) console.log(n.padEnd(8), 'peak', R[n].pk.toFixed(3), 'rms', R[n].rms.toFixed(4), 'len', R[n].len.toFixed(2) + 's');
  for (const n of ['tower', 'pillar', 'sky', 'skyend', 'shutter', 'move']) {
    check(n + ' audible', R[n].pk > 0.03 && R[n].nan === 0);
    check(n + ' not too loud', R[n].pk < R.horn.pk * 2 && R[n].rms < R.horn.rms * 2, `${R[n].pk.toFixed(3)} vs horn ${R.horn.pk.toFixed(3)}`);
  }
  check('shutter short', R.shutter.len < 0.3, R.shutter.len);
  check('move short', R.move.len < 0.8, R.move.len);
  check('sky long', R.sky.len > 3 && R.skyend.len > 3);
  // 关了音效就不响
  const off = await page.evaluate(async () => {
    const Sound = window.game.audio.constructor, ctx = new OfflineAudioContext(1, 44100, 44100);
    Object.defineProperty(ctx, 'state', { get: () => 'running' });
    const s = new Sound(); s.ctx = ctx; s.setup(); s.sfxOn = false; s.play('tower');
    const d = (await ctx.startRendering()).getChannelData(0); let pk = 0; for (const v of d) pk = Math.max(pk, Math.abs(v)); return pk;
  });
  check('sfx off is silent', off < 0.001, off);
  console.log('RESULT', bad ? `${bad} FAIL` : 'all ok');
}
