// 寒烬北行 · 把文件交给玩家：照片、存档码
// 放在 claude.ai 里时网页是被保护起来的，普通的下载链接会被拦住，要走页面的下载权限；
// 单独打开（自己的浏览器、存成文件的网页）时没有这个权限，就用普通的下载链接
let dlP = null;
export function downloadsApi() {
  if (!dlP) {
    const c = typeof window !== 'undefined' && window.claude;
    dlP = c && typeof c.use === 'function' ? Promise.resolve(c.use('downloads')).catch(() => null) : Promise.resolve(null);
  }
  return dlP;
}
// 返回 'saved'（玩家点了保存）、'declined'（玩家不要）、'busy'（已经有一个保存在问了）、'link'（交给浏览器的下载链接）
// plain：普通下载链接用的英文文件名（有的浏览器给中文文件名的下载链接只会存成 download）
export async function saveFile(name, data, plain) {
  const dl = await downloadsApi();
  if (dl) {
    try { await dl.save({ filename: name, data }); return 'saved'; }
    catch (e) {
      const code = e && e.code;
      if (code === 'declined') return 'declined';
      if (code === 'rate_limited') return 'busy';
      // 其他情况（这个页面用不了）退回普通下载链接
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = plain || name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'link';
}
// 让玩家挑一个文本文件，读出里面的字
export function pickTextFile(accept) {
  return new Promise((ok, bad) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept || '.txt,text/plain'; inp.style.display = 'none';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0]; inp.remove();
      if (!f) return ok(null);
      f.text().then(ok, bad);
    });
    document.body.appendChild(inp); inp.click();
  });
}
export const stamp = (d = new Date()) => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
