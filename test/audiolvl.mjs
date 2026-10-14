export default async function (page) {
  const r = await page.evaluate(async () => {
    const S = window.game.audio.constructor;
    const out = {};
    for (const mode of ['music', 'amb', 'all']) {
      const a = new S(); a.ctx = new OfflineAudioContext(2, 44100 * 24, 44100); a.setup();
      if (mode !== 'music') { a.windG.gain.value = 0.13; a.rumbleG.gain.value = 0.11; a.whistleG.gain.value = 0.01; }
      if (mode !== 'amb') for (let t = 0; t < 24; t += 0.25) a.music(t, { nf: 0 });
      if (mode !== 'music') { for (let t = 1; t < 24; t += 0.7) a.chop(t, 1); for (let t = 1.3; t < 24; t += 0.9) a.clank(t, 1); for (let t = 0.5; t < 24; t += 0.6) a.pick(t, 1); for (let t = 0; t < 24; t += 0.07) a.noiseHit(t, 0.03, 'highpass', 2000, 0.7, 0.08); }
      const buf = await a.ctx.startRendering();
      const d = buf.getChannelData(0); let pk = 0, ss = 0;
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; ss += d[i] * d[i]; }
      out[mode] = { peak: +pk.toFixed(3), rmsDb: +(10 * Math.log10(ss / d.length)).toFixed(1) };
    }
    return out;
  });
  console.log(JSON.stringify(r));
}
