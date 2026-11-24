# 寒烬北行 · 开发说明

写给接手这个项目的 AI agent 和开发者。先读完这一页再动代码。

寒烬北行是一款 2.5D 低多边形的放置 + 模拟经营游戏：纯 JavaScript（ES 模块）+ Three.js，没有前端框架，没有外部美术和音频文件。整个游戏用 esbuild 打成**一个自带全部代码的 html 文件**，双击就能玩，不需要服务器。

## 常用命令

```bash
npm ci              # 装依赖（three 0.160.1、esbuild 0.20.2，版本锁在 package-lock.json）
npm run build       # 打包 → dist/index.html（dist/ 不进仓库）
npm run release     # 打包，并把结果复制成根目录的 寒烬北行.html（发版时用）
```

需要 Node.js 18 以上。打包出来的 `dist/index.html` 直接用浏览器打开就能玩（file:// 也行）。

推到 `main` 以后，`.github/workflows/pages.yml` 会自动打包并发布到 GitHub Pages（在线试玩），不用手动上传。

## 目录

| 路径 | 是什么 |
| --- | --- |
| `src/main.js` | 入口：主循环、输入（鼠标、触屏、快捷键）、存档读写、离线结算 |
| `src/sim.js` | **模拟内核**，纯逻辑，不碰 DOM 和 three，能在 Node 里直接跑 |
| `src/data.js` | 静态数据：资源、建筑、研究、专家、地标、章节。速率单位是「每分钟」，模拟内部换算成每秒 |
| `src/journey.js` | 一路往北：每一程的状态、北迁门槛、车队、新营地范围 |
| `src/north.js` | 北境分岔和站点奇遇 |
| `src/lines.js` | 产线、升星、里程碑、规划器配比、老向导的建议 |
| `src/net.js` | 物流网：营地之间自动调货，雪橇道 / 主干道 / 铁路 |
| `src/guild.js` `src/wonder.js` `src/tide.js` | 北方商会；奇观和城镇；炉火鼎盛和永冬潮 |
| `src/worldgen.js` | 地图生成：地标和资源纬度固定，地形和细节按种子随机 |
| `src/render.js` | 2.5D 画面：斜俯视镜头、地形、建筑、小人、迷雾、雪、烟 |
| `src/models.js` | 所有低多边形模型，全部由代码生成，合并成带顶点色的几何体 |
| `src/ui.js` | 界面主体：顶栏、底栏、面板、弹窗、提示 |
| `src/pc.js` | 电脑版布局（横屏且宽度 ≥ 1000 像素时 `body.pc`） |
| `src/theme.js` | 冷 / 暖 / 跟着天气 三种界面配色的切换 |
| `src/index.template.html` | 页面骨架和旧样式；打包时 `/*BUNDLE*/` 换成全部 JS |
| `src/ui12.css` | 1.2 的拟物皮肤，变量都以 `--u-` 开头，接在旧样式后面 |
| `src/icons.js` `src/lineicons.js` | 图标系统；代码里照旧写 emoji，渲染前由 `iconize()` 换成 `<svg><use>` |
| `src/icons12.js` | **自动生成，别手改**。由 `packicons.py` 从 `icons-src/` 打包 |
| `src/audio.js` | 全部声音用 WebAudio 现场合成 |
| 其他 `src/*.js` | 相册、拍照、备份、存档文件、数据曲线、生产链总览、北行大地图、小人、装扮、提示、更新日志 |
| `icons-src/` | 307 个 SVG 图标原稿（m 材料、g1/g2 小图标、b1/b2 建筑、r 研究、c 其他、x 向导头像） |
| `build.mjs` | 打包脚本 |
| `themeize.mjs` | 打包时把旧样式里写死的颜色换成可切换的色板变量（暖色主题靠它） |
| `packicons.py` | 图标打包：`python3 packicons.py` 重新生成 `src/icons12.js` |
| `寒烬北行.html` | 当前版本打包好的单文件游戏，给想下载离线玩的人 |

## 架构要点

- **模拟和画面分开。** 所有玩法规则都在 `sim.js`（加上 journey / lines / net 等），入口是 `step(S, dt)`。画面和界面只读状态、发指令，不自己改规则。
- **模拟是确定的。** 天气、袭击这些随机事件按 `runSeed` 哈希出来，所以离线结算和一直在线玩的结果一样。新加的随机内容也要这样做，别用 `Math.random()` 决定玩法结果。
- **在 Node 里跑模拟：**
  ```js
  import * as G from './src/sim.js';
  const S = G.newRun(G.defaultMeta(), 0, 12345);
  for (let i = 0; i < 600; i++) G.step(S, 1);   // 跑 10 分钟游戏时间
  ```
- **界面配色：** `<html data-theme="cold|warm">`。旧样式里的颜色由 `themeize.mjs` 在打包时换成 `--w*` 变量，1.2 皮肤在 `ui12.css`。改界面时两套配色都要看。
- **两种布局：** 电脑（`body.pc`，端游式布局，居中大窗口、底部建造横条、快捷键）和手机竖屏（底部五个大页）。改界面时两种都要看。
- **文字：** 玩家看到的文字全是中文，口语、短句，不用术语。

## 存档

- 存在浏览器 `localStorage` 的 `hanjin-beixing-v1`（三个存档位和设置用它加后缀的键）。照片存在 IndexedDB。
- **不要改这个键名**，改了所有玩家的进度都会丢。
- 存档格式改动要在 `sim.js` 的 `deserialize()` 里补上旧存档的升级逻辑（那里已经有 1.1 物流网、熟练工、自动机这些升级的例子）。到 1.2 为止，老存档都能直接接着玩，以后也要保住这一点。
- `src/changelog.js` 的 `VERSION` / `CHANGELOG` 是给玩家看的版本号和更新日志；`src/hints.js` 的 `WHATS_NEW` 是内部数字，老存档的 `meta.ver` 比它小时会弹一次「这版有什么新东西」。

## 发一个新版本

1. 改代码。
2. 在 `src/changelog.js` 里升 `VERSION`、`VERSION_NAME`，在 `CHANGELOG` 最前面加一条（一句一条，写给玩家看）；要给老玩家弹新内容就把 `WHATS_NEW` 加一并更新 `whatsNewHtml`；`package.json` 的版本号一起改。
3. `npm run release`。
4. 打开 `dist/index.html` 实际玩一下：电脑横屏和手机竖屏、冷暖两套配色、新开一局和读老存档都要看。
5. 连同 `寒烬北行.html` 一起提交，推到 `main`。在线试玩会自动更新。

## 调试和测试

- 仓库里没有放测试。开发时用过的脚本还在历史提交里，需要时取回来：`git checkout f0138d1 -- test`。其中 `test/jbot.mjs` 是按老向导思路玩的自动玩家（`node test/jbot.mjs <天数> <几秒想一次>`，能看整局节奏和数值），`test/rules.mjs` 是规则检查，`test/shot.mjs` 是无头浏览器截图。
- 浏览器控制台里能用：`window.game`（整个游戏）、`window.__sim`（模拟模块）、`window.__simstep(n)`（快进 n 秒）。
- `localStorage` 里设 `hanjin-beixing-v1-notitle` 跳过标题画面，设 `hanjin-beixing-v1-noauto` 关掉「帧率低就自动降画质」（无头浏览器截图时要用）；`window.__noEvents = true` 关掉随机事件弹窗。
- 无头浏览器（swiftshader）帧率很低，CSS 动画会停在半路；截图前加一段样式 `*{animation-delay:-30s!important}` 让它们直接到终态。

## 设计原则（作者定下的，改玩法时守住）

- **不能卡死。** 任何时候都要留一条拿到建材的路，比如树砍光了还能种树、加工建筑会给盖房留料。
- **在线为主。** 离线收益打折入库，短时间挂机不能把仓库塞满。
- **数值别膨胀太快。** 资源曲线是一条平的曲线，离线收益也在里面。
- **规划有回报。** 核心是「每分钟产多少」的产能主线，规划器给方向，产线稳住会升星，挂机也要有满足感。
- **画面不能出戏。** 模型之间不穿插，地图边缘是自然的山谷不是直墙，摆建筑要宽松，远景不能空。
- **改动先商量。** 作者习惯先一步步讨论计划、确认了再动手。加新玩法或者大改之前，先把计划列给作者看。
