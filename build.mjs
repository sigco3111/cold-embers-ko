// 打包成一个自带全部代码的 index.html
import * as esbuild from 'esbuild';
import fs from 'fs';
import { themeize } from './themeize.mjs';

const r = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, minify: !process.env.NOMIN, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
let html = fs.readFileSync('src/index.template.html', 'utf8');
// 1.2：旧样式里写死的颜色换成可换的色板（见 themeize.mjs），再接上 1.2 的拟物层
const a = html.indexOf('<style>') + 7, b = html.indexOf('</style>');
const t = themeize(html.slice(a, b));
const ui12 = esbuild.transformSync(fs.readFileSync('src/ui12.css', 'utf8'), { loader: 'css', minify: !process.env.NOMIN }).code;
html = html.slice(0, a) + t.css + '\n' + ui12 + html.slice(b);
html = html.replace('/*BUNDLE*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB', '· 色板替换', t.n, '处');
