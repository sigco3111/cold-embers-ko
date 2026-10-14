// 打包成一个自带全部代码的 index.html
import * as esbuild from 'esbuild';
import fs from 'fs';

const r = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, minify: !process.env.NOMIN, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('src/index.template.html', 'utf8').replace('/*BUNDLE*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
