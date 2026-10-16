// 寒烬北行 · 静态数据（资源、建筑、专家、余烬强化、地标）
// 速率单位：每分钟；模拟内部换算为每秒。

export const RES = {
  wood:      { n: '木材',     t: 1, c: '#a0703c', raw: true },
  stone:     { n: '石料',     t: 1, c: '#9aa3ad', raw: true },
  game:      { n: '生肉',     t: 1, c: '#b5524a', raw: true },
  plank:     { n: '木板',     t: 1, c: '#d8a868' },
  food:      { n: '熟食',     t: 1, c: '#e8b04a' },
  coal:      { n: '煤',       t: 2, c: '#3a3a40', raw: true },
  ore:       { n: '铁矿石',   t: 2, c: '#9a5a3a', raw: true },
  iron:      { n: '铁锭',     t: 2, c: '#8a96a3' },
  coke:      { n: '焦煤块',   t: 2, c: '#55505a' },
  lime:      { n: '石灰石',   t: 3, c: '#e6e0cc', raw: true },
  steel:     { n: '钢材',     t: 3, c: '#7f9fc0' },
  gear:      { n: '齿轮',     t: 3, c: '#c0a060' },
  engine:    { n: '蒸汽机',   t: 3, c: '#b07a40' },
  shale:     { n: '油页岩',   t: 4, c: '#40363a', raw: true },
  tar:       { n: '焦油',     t: 4, c: '#2a2224' },
  seal:      { n: '密封件',   t: 4, c: '#6a5a8a' },
  crystal:   { n: '霜晶',     t: 5, c: '#7fe8ff', raw: true },
  battery:   { n: '晶体电池', t: 5, c: '#40c8f0' },
  alloy:     { n: '恒温合金', t: 5, c: '#a8f0e0' },
  star:      { n: '星铁',     t: 6, c: '#b080ff', raw: true },
  part:      { n: '古代构件', t: 6, c: '#c8a0ff' },
  core:      { n: '自动机核心', t: 6, c: '#ff80d0' },
  shard:     { n: '炉心碎片', t: 7, c: '#ff9a40', raw: true },
  heart:     { n: '永恒炉件', t: 7, c: '#ffd060' },
  starcore:  { n: '星核',     t: 7, c: '#e070ff', raw: true, stage: 11 }, // 星落之坑的坑底才有；熔炉 35 级以后升级要用
};
export const RES_KEYS = Object.keys(RES);

// 燃料热值（熔炉按此计算“燃料单位”）
export const FUEL = { wood: 1, coal: 3, coke: 10, battery: 32 };
export const FUEL_ORDER = ['battery', 'coke', 'coal', 'wood'];

// 每一层的“门槛材料”：建筑升到一定等级后，继续升级需要更高层的这种材料
export const GATE = [null, 'plank', 'iron', 'steel', 'seal', 'alloy', 'part', 'heart'];
export const GATE_EVERY = 5; // 每 5 级跨一层

export const TIER_NAMES = ['', '篝火', '煤与铁', '钢与蒸汽', '油与铁路', '霜晶', '遗迹金属', '炉心'];

// 资源点：地图上的有限储量点
export const SPOTS = {
  tree:    { n: '针叶林',   res: 'wood',    reserve: 380, from: 0,   dens: 0.10 },
  rock:    { n: '碎石堆',   res: 'stone',   reserve: 700, from: 0,   dens: 0.04 },
  herd:    { n: '猎物出没', res: 'game',    reserve: 300, from: 0,   dens: 0.028 },
  coal:    { n: '煤层',     res: 'coal',    reserve: 1500, from: 45,  dens: 0.03 },
  ore:     { n: '铁矿脉',   res: 'ore',     reserve: 1200, from: 45,  dens: 0.026 },
  lime:    { n: '石灰岩床', res: 'lime',    reserve: 1200, from: 95,  dens: 0.026 },
  shale:   { n: '冻油页岩', res: 'shale',   reserve: 1400, from: 145, dens: 0.024 },
  crystal: { n: '霜晶簇',   res: 'crystal', reserve: 1800, from: 200, dens: 0.02 },
  star:    { n: '古代残骸', res: 'star',    reserve: 1400, from: 255, dens: 0.016 },
  shard:   { n: '炉心碎块', res: 'shard',   reserve: 1500, from: 312, dens: 0.02 },
  starfall:{ n: '星核石',   res: 'starcore', reserve: 1600, from: 9999, dens: 0 }, // 不随纬度撒，只放在星落之坑周围（worldgen 单独放）
  // 北境地貌才有的（nw）：只在对应规则的站里由 worldgen 单独放，老地图里没有
  dead:    { n: '枯木堆',   res: 'wood',    reserve: 260,  from: 9999, dens: 0, nw: 1 }, // 冻土无林：伐木场砍得动，砍完过一阵风雪又刮出来一堆
  fish:    { n: '冰钓点',   res: 'food',    reserve: 400,  from: 9999, dens: 0, nw: 1 }, // 冰湖群：冰面上的鱼窝，冰钓屋来钓
  ruin:    { n: '古城废墟', res: 'part',    reserve: 1,    from: 9999, dens: 0, nw: 1 }, // 古城遗址：占着地，拆了得古代构件和钢材
};
export const SPOT_KEYS = Object.keys(SPOTS);

// 地标：剧情固定位置（行号 = 向北的纬度）
export const LANDMARKS = [
  { n: '灰烬营地', row: 10,  x: 24, desc: '旅程的起点。上一座营地留下的余烬还在发烫。' },
  { n: '铁岭',     row: 55,  x: 17, desc: '黑色山脊下埋着煤层与铁矿，北行者在这里第一次学会冶铁。' },
  { n: '蒸汽峡谷', row: 105, x: 31, desc: '峡谷里的旧蒸汽管道还在嘶嘶作响，石灰岩床遍布谷底。' },
  { n: '黑油冻原', row: 155, x: 20, desc: '冻土下渗出黑色的油，旧时代的铁轨从这里一路向北。' },
  { n: '霜晶废墟', row: 210, x: 29, desc: '发着冷光的晶体从古城废墟里长出来，寒气刺骨。' },
  { n: '星铁残骸', row: 265, x: 22, desc: '一艘不知来自何处的巨大残骸，星铁和自动机散落一地。' },
  { n: '永恒之炉', row: 325, x: 24, desc: '传说中永不熄灭的熔炉。它是一座遗迹，等待被重新点燃。' },
];
// 地标模型的半径（格）：不能在上面建造，渲染时也按它避让
export const LM_R = [0, 2.5, 2.7, 2.6, 2.4, 3.1, 4.5];
// 永恒之炉以北的远方地标：侦察到就有余烬；在旁边点起熔炉能带回一件遗物（永久生效，北迁后也保留）
export const FAR_MARKS = [
  { n: '冰封灯塔', row: 382, r: 2.6, desc: '一座被冰层裹住的灯塔，塔顶的透镜还能把微光送到很远的地方。',
    relic: { k: 'sight', v: 0.2, n: '灯塔透镜', d: '侦察队能走得更远 +20%' } },
  { n: '沉睡的破冰船', row: 446, r: 3.2, desc: '一艘巨大的破冰船斜卧在冰原上，锅炉早已冷透，船舱里还堆着旧时代的货物。',
    relic: { k: 'haul', v: 0.12, n: '破冰船的锅炉阀', d: '所有营地搬运速度 +12%' } },
  { n: '极光观测站', row: 518, r: 2.8, desc: '圆顶裂开了一道缝，望远镜还指着北方。墙上贴满了暴风雪的记录。',
    relic: { k: 'shield', v: 0.15, n: '观测站的天气图', d: '暴风雪降温 −15%' } },
  { n: '冻结的巨像', row: 598, r: 3.0, desc: '一尊半跪的石像，双手撑着地面，像在守着什么。冰从它的肩膀上垂下来。',
    relic: { k: 'def', v: 0.15, n: '巨像之心', d: '所有营地防御 +15%' } },
  { n: '星落之坑', row: 690, r: 3.4, desc: '很久以前有什么东西从天上落下，砸出一个大坑。坑底的石头还在发出紫色的光。',
    relic: { k: 'prod', v: 0.1, n: '星核碎块', d: '所有营地产量 +10%' } },
  { n: '世界之脊', row: 800, r: 3.6, desc: '冰原尽头隆起一道巨大的骨脊，像某种远古巨兽的脊梁。翻过去，就再也没有人走过的路了。',
    relic: { k: 'ember', v: 0.25, n: '脊骨火种', d: '北迁时带走的余烬 +25%' } },
];
// 北境：世界之脊以北，一站接一站没有尽头。每站约 80 行，带一条地貌规则和一个地标
export const SPINE_ROW = 800;
export const NORTH_GAP = 80;
// 地貌规则：一好一坏，只管当前这一站（效果在 sim / worldgen 里按 id 生效）
export const NORTH_RULES = {
  flat:   { n: '平坦雪原', ic: '🏔', good: '暖圈内空地更多', bad: '矿点偏少',
    tip: '这里地平、空地多，就是矿点少一些。先把每种矿旁边的采集位占好，再铺开盖别的。' },
  geo:    { n: '地热谷',   ic: '♨', good: '暖圈 +3 格，燃料消耗 −30%', bad: '煤矿和油页岩减半',
    tip: '地底下是热的：暖圈大三格、熔炉省三成燃料。煤和油页岩只有平常一半，省着挖；能打地热井。' },
  rich:   { n: '富矿带',   ic: '💎', good: '一种矿的储量 ×3', bad: '暖圈 −2 格（到站头两天照常）',
    tip: '这一带有一种矿储量是平常的三倍，可暖圈小两格。头两天熔炉还旺，暖圈照常；之后会缩，盖房要算着地方。' },
  night:  { n: '永夜',     ic: '🌌', good: '极光更多，希望更容易涨', bad: '燃料 +20%，户外工作慢 10%',
    tip: '这里太阳不出来：熔炉多烧两成燃料，户外采集慢一成。好在夜夜有极光，大家心里亮堂。' },
  wolf:   { n: '狼群领地', ic: '🐺', good: '击退袭营的战利品 ×2', bad: '袭营变多 ×1.5',
    tip: '这是狼群的地盘，袭营会多一半。先把箭塔建起来；打退了，战利品是平常的两倍。' },
  lakes:  { n: '冰湖群',   ic: '🎣', good: '能建冰钓屋，产鱼当食物', bad: '冰面不能盖房，冰湖开裂更常见',
    tip: '到处是冰湖，冰面上不能盖房，冰湖也容易开裂。湖边能建冰钓屋，钓上来的鱼直接当饭吃。' },
  ruins:  { n: '古城遗址', ic: '🏛', good: '拆废墟得古代构件和钢材', bad: '废墟占地，拆了才有空地',
    tip: '暖圈里散着古城的断墙。点一下废墟就能派人拆，拆出来的是古代构件和钢材，也腾出空地。' },
  storm:  { n: '风暴走廊', ic: '🌪', good: '暴风雪预报提前一倍', bad: '暴风雪 ×2',
    tip: '风雪从这条走廊里灌过来，暴风雪是平常的两倍，好在预报也早一倍。燃料和熟食要多备。' },
  meteor: { n: '陨石雨',   ic: '☄', good: '流星坑更多，星核更好挖', bad: '偶尔砸中一栋建筑，停工一会',
    tip: '天上常有流星落下：流星坑多、星核石也多。偶尔会砸中一栋房子，停工修一会儿，不会砸塌。' },
  tundra: { n: '冻土无林', ic: '🪵', good: '石头和矿点更多', bad: '没有活树，只有枯木堆',
    tip: '冻土上一棵活树都没有，只有枯木堆，砍完过一阵才又刮出来。木板最好从后面的营地运上来。' },
};
// 富矿带：哪一种矿储量 ×3（按种子抽）
export const RICH_KINDS = ['coal', 'ore', 'lime', 'shale', 'crystal', 'star', 'shard', 'starfall'];
// 地貌规则的数值
export const RULE_FX = { geoWarm: 3, geoFuel: 0.7, richWarm: -2, nightFuel: 1.2, nightOut: 0.9, nightHope: 4, wolfRaid: 1.5, wolfLoot: 2, metHit: 120 };
export const NORTH_RULE_KEYS = Object.keys(NORTH_RULES);

// 1.1 营地特产：建营地那一刻定下，之后不变；这几种建筑在这座营地里产量 +50%（研究「特产精工」后 +75%）
// 北境的站按地貌定（富矿带按那一种矿）；其余营地和前哨按暖圈里最多的矿点定（多少按平常的密度折算）
export const CAMP_SPEC = {
  flat:    { n: '林木', b: ['lumber', 'nursery', 'sawmill'] },
  geo:     { n: '地热', b: ['greenhouse', 'batteryworks'] },
  night:   { n: '观星', b: ['workshop'] },
  wolf:    { n: '猎场', b: ['hunter', 'kitchen', 'tower'] },
  lakes:   { n: '冰湖', b: ['icefish', 'crystalmine'] },
  ruins:   { n: '古城', b: ['salvage', 'partworks'] },
  storm:   { n: '风口', b: ['coker', 'heater'] },
  meteor:  { n: '星陨', b: ['starpit', 'forge'] },
  tundra:  { n: '冻土', b: ['quarry', 'limequarry', 'steelworks'] },
  coal:    { n: '煤', b: ['coalmine', 'coker'] },
  ore:     { n: '铁', b: ['ironmine', 'smelter'] },
  lime:    { n: '石灰石', b: ['limequarry', 'steelworks'] },
  shale:   { n: '油页岩', b: ['shalepit', 'refinery'] },
  crystal: { n: '霜晶', b: ['crystalmine', 'batteryworks'] },
  star:    { n: '星铁', b: ['salvage', 'partworks'] },
  shard:   { n: '炉心碎片', b: ['excavator', 'forge'] },
  starfall:{ n: '星核', b: ['starpit', 'forge'] },
  tree:    { n: '木材', b: ['lumber', 'sawmill'] },
  rock:    { n: '石料', b: ['quarry'] },
  herd:    { n: '猎物', b: ['hunter', 'kitchen'] },
};
export const CSPEC_FX = 0.5, CSPEC_FX2 = 0.75;
// 1.1 替代配方：在建筑面板上换，换一次停工 20 秒。研究「替代配方·一」开 1–3 级建筑的，「替代配方·二」开 4–7 级的
export const ALT = {
  sawmill:    { in: { wood: 3, tar: 1 }, out: { plank: 3 } },
  coker:      { in: { wood: 10 }, out: { coke: 1 } },
  smelter:    { in: { ore: 3, coke: 0.5 }, out: { iron: 2.5 } },
  steelworks: { in: { iron: 3, coal: 1 }, out: { steel: 1.5 } },
  gearworks:  { in: { iron: 2, coal: 1 }, out: { gear: 1.5 } },
  refinery:   { in: { wood: 6, coal: 1 }, out: { tar: 1.5 } },
  sealworks:  { in: { tar: 3, iron: 2 }, out: { seal: 1.5 } },
  alloyworks: { in: { crystal: 2, steel: 2 }, out: { alloy: 1 } },
  partworks:  { in: { star: 4, steel: 3 }, out: { part: 1 } },
  coreworks:  { in: { part: 3, engine: 2 }, out: { core: 0.5 } },
  forge:      { in: { shard: 5, starcore: 1 }, out: { heart: 0.6 } },
};
export const ALT_SWITCH = 20;
// 北境每站一章：两条产能目标从六种高级材料里轮着抽，加一条地貌任务，前十站各一座烽火塔
export const NORTH_HI = ['part', 'battery', 'alloy', 'core', 'starcore', 'heart'];
// 烽火塔：第 1–3 座 2 种材料 4–5/分钟喂 10 分钟；4–6 座 3 种 5–6/分钟 12 分钟；7–9 座 4 种 6–7/分钟 15 分钟；天火塔 6 种 6/分钟 20 分钟
export const TOWER_STEPS = [[3, 2, 4, 600], [6, 3, 5, 720], [9, 4, 6, 900], [10, 6, 6, 1200]];
export const TOWER_FX = { hope: 5, warm: 1 };
export const NORTH_TASK = {
  geo:    { t: '建 2 座地热井', k: 'bldm', b: 'geowell', n: 2 },
  lakes:  { t: '建 2 座冰钓屋', k: 'bldm', b: 'icefish', n: 2 },
  wolf:   { t: '击退 3 次袭营', k: 'ns', f: 'raidW', n: 3 },
  ruins:  { t: '拆掉 4 处古城废墟', k: 'ns', f: 'ruin', n: 4 },
  storm:  { t: '挺过 2 场暴风雪，而且没人冻伤', k: 'ns', f: 'blizOk', n: 2 },
  meteor: { t: '挖开 3 个流星坑', k: 'ns', f: 'crater', n: 3 },
  tundra: { t: '把 300 块木板运到这一站', k: 'ns', f: 'plank', n: 300 },
  night:  { t: '主营地希望在 70 以上，稳住 10 分钟', k: 'hhold', n: 10 },
};
export const NORTH_STORY = [
  '北境没有路，只有前人插下的冰标。车队在「{n}」停下，新熔炉的火苗映红了一圈雪。',
  '风小了一点。有人在「{n}」的雪下挖出一截旧铁轨，没人知道它通向哪里。',
  '离世界之脊越来越远，夜里能听见冰层深处的回响。「{n}」的火要先稳住。',
  '老向导在地图边上添了一个名字：「{n}」。他说，往北的每一站都该留下点什么。',
  '「{n}」比上一站更冷，可大家的脚步没有慢下来。身后的营火一盏接一盏。',
  '雪原上立着一块没有字的石碑。我们把「{n}」刻了上去，又点起了火。',
  '孩子们问北边还有什么。没有人答得上来，于是大家决定去看看。这一站叫「{n}」。',
  '风里有股铁锈味，像是很久以前有人在这里炼过钢。「{n}」，又一个新家。',
];
export const NORTH_END = [
  '「{n}」的火稳住了。往北看，风雪后面还有路。',
  '有人在「{n}」的熔炉边刻下了日期。明天，车队接着往北。',
  '「{n}」亮起来了，像一颗钉在北境上的钉子。',
  '最后一批货装上了雪橇。「{n}」会一直烧着，等后来的人。',
];
// ---------- 第十三版：成就换来的装扮（只是好看：称号、炉火颜色、旗子、相框、北境装饰）----------
export const TITLES = { ice: '破冰者', walker: '北境旅人', far: '极北之人', lamp: '点灯人', sky: '点燃天火的人', wolf: '狼口守夜人', storm: '风暴里的人', keeper: '守火人' };
// 炉火颜色：c = [火心, 火身, 火尖]；aurora 会慢慢变色
export const FLAMES = {
  def: { n: '本色' },
  gold: { n: '金色', c: ['#fff4c8', '#ffc83a', '#ff9418'] },
  blue: { n: '冰蓝', c: ['#ecfdff', '#7fd8ff', '#2f86ff'] },
  purple: { n: '星紫', c: ['#f8eaff', '#c58cff', '#7a3cff'] },
  green: { n: '极光绿', c: ['#efffef', '#6dffae', '#16c48a'] },
  aurora: { n: '极光', c: ['#effffa', '#7cf0ff', '#b07cff'], shift: 1 },
};
export const FLAGS = { def: { n: '本色' }, star: { n: '北极星' }, flame: { n: '火焰' }, wolf: { n: '狼头' }, compass: { n: '罗盘' } };
export const FRAMES = { none: { n: '不加框' }, copper: { n: '铜框' }, film: { n: '胶片' }, map: { n: '旧地图' }, ruin: { n: '古城石框' } };
// 八种北境装饰（建筑表里 gift: 1，成就解锁以后才能建）
export const NDECO = ['icesculpt', 'windchime', 'snowman', 'lanterns', 'deerstatue', 'bonearch', 'pyremem', 'skymem'];
// 北境每站的地标，四种轮着用（r：模型半径，不能在上面建造）
export const NORTH_MARKS = [
  { n: '冰封石碑', r: 2.2, desc: '一块比人高得多的石碑立在雪原上，刻着没人认得的字，冰从碑顶一直挂到地面。' },
  { n: '冻住的古门', r: 2.6, desc: '两根石柱撑着一道拱门，门里什么也没有，只有更远的雪。门楣上结着厚厚的冰。' },
  { n: '巨兽骨架', r: 3.0, desc: '又一副巨兽的骨头半埋在冰里。比世界之脊那副小，肋骨却更弯，像还在呼吸。' },
  { n: '断掉的冰塔', r: 2.4, desc: '一座冰塔从半腰折断，上半截斜插在雪里，断口还亮着淡蓝的光。' },
];
// 北境站名：两半拼起来（同一局里不重复）
export const NORTH_NAME_A = ['寂风', '白鲸', '断灯', '霜狼', '静水', '回声', '孤星', '冷铁', '长夜', '碎冰', '雪鸮', '灰帆', '冻铃', '沉钟', '苍角', '无声', '银脊', '暮火', '玄冰', '远帆'];
export const NORTH_NAME_B = ['岭', '湾', '口', '原', '谷', '坡', '台', '渡', '湖', '岬', '崖', '关'];
// 每个纬度带从哪一行开始（对应资源层级）
export const BAND_START = [0, 0, 45, 95, 145, 200, 255, 312];
export function tierOfRow(row) {
  let t = 1;
  for (let i = 2; i <= 7; i++) if (row >= BAND_START[i]) t = i;
  return t;
}
export function baseTempOfRow(row) { return Math.round(-6 - Math.min(row, SPINE_ROW) * 0.165); } // 世界之脊以北不再更冷

// 永恒之炉点燃的三个阶段：永恒炉件的产能目标
export const ETERNAL_STAGES = [3, 5, 7]; // 每层要永恒炉件每分钟产多少，稳住 3 分钟就亮一层

// 建筑
// size: 占地边长；w: 基础岗位；out/in: 每分钟；gather: 采集的资源点类型；reach: 采集半径
// syn: 相邻（贴边）时互相加成的建筑
export const BLD = {
  furnace:   { n: '熔炉', t: 1, size: 3, cat: 'core', w: 0, desc: '营地的心脏：提供热量与供热半径，也是仓储点。升级可扩大供热圈、提高温度。', cost: { wood: 260, stone: 160, plank: 60 } },
  tent:      { n: '帐篷', t: 1, size: 2, cat: 'live', w: 0, housing: 5, insul: 6, desc: '住处。提供床位与保温，升级后住得更多、更暖。', cost: { wood: 25 }, syn: ['tent'] },
  lumber:    { n: '伐木场', t: 1, size: 2, cat: 'gather', w: 2, gather: ['tree', 'dead'], out: { wood: 7 }, reach: 3, desc: '砍伐附近的针叶林（冻土上也能砍枯木堆）。', cost: { wood: 15 }, syn: ['sawmill'] },
  nursery:   { n: '育林场', t: 1, size: 2, cat: 'gather', w: 2, out: { wood: 4 }, desc: '在围栏里育苗种树：不靠附近的树林也有木材，只是慢一些。附近的树砍光了就靠它。', cost: { wood: 40, stone: 15 }, syn: ['lumber', 'sawmill'] },
  quarry:    { n: '采石场', t: 1, size: 2, cat: 'gather', w: 2, gather: ['rock'], out: { stone: 5 }, reach: 3, desc: '开采附近的碎石堆。', cost: { wood: 30 }, syn: ['warehouse'] },
  hunter:    { n: '猎人小屋', t: 1, size: 2, cat: 'gather', w: 2, gather: ['herd'], out: { game: 5 }, reach: 4, desc: '在附近的猎场打猎。', cost: { wood: 25 }, syn: ['kitchen'] },
  sawmill:   { n: '锯木厂', t: 1, size: 2, cat: 'make', w: 2, in: { wood: 6 }, out: { plank: 3 }, desc: '把木材锯成木板。', cost: { wood: 50, stone: 20 }, syn: ['lumber'] },
  kitchen:   { n: '厨房', t: 1, size: 2, cat: 'make', w: 2, in: { game: 4 }, out: { food: 8 }, desc: '把生肉做成熟食，大家靠它活着。', cost: { wood: 40, stone: 15 }, syn: ['hunter', 'tent'] },
  warehouse: { n: '仓库', t: 1, size: 2, cat: 'core', w: 3, store: 500, haul: true, desc: '储存物资；岗位上的人是搬运工，从这里出发去送货取货。放在生产区中间最省脚程。', cost: { wood: 60, stone: 30 } },
  tower:     { n: '箭塔', t: 1, size: 1, cat: 'defense', w: 1, power: 10, desc: '自动射击来袭的雪狼和掠夺者。升级后威力更大。', cost: { wood: 30, stone: 30 }, syn: ['tower'] },
  workshop:  { n: '工程站', t: 1, size: 2, cat: 'core', w: 3, research: 1, desc: '工程师在这里研究新技术。岗位上的人越多、等级越高，研究越快。', cost: { wood: 80, stone: 40, plank: 30 } },
  kennel:    { n: '雪橇犬舍', t: 1, size: 2, cat: 'core', w: 2, dogs: 4, feed: 0.5, desc: '养雪橇犬：犬夫每天喂生肉、训狗。狗越多，这座营地派出的侦察队跑得越快、连着它的路运得越多，营地里也会有狗跑来跑去。', cost: { wood: 60, plank: 20 }, syn: ['hunter'] },
  scout:     { n: '侦察营', t: 1, size: 2, cat: 'core', w: 0, desc: '派出侦察队走进迷雾，发现资源、幸存者、遗迹和地标。等级越高可同时派出的队伍越多、越耐寒。', cost: { wood: 80, plank: 30 } },
  sledshed:  { n: '雪橇棚', t: 1, size: 2, cat: 'core', w: 2, desc: '造北迁用的雪橇，到了蒸汽峡谷还能造蒸汽拖车。派的人越多、等级越高造得越快；造好的车归车队，跟着主营地走。', cost: { wood: 80, plank: 30 } },

  coalmine:  { n: '煤矿', t: 2, size: 2, cat: 'gather', w: 3, gather: ['coal'], out: { coal: 5 }, reach: 3, desc: '开采煤层，煤是比木材耐烧三倍的燃料。', cost: { wood: 120, plank: 40, stone: 60 }, syn: ['smelter', 'coker'] },
  ironmine:  { n: '铁矿场', t: 2, size: 2, cat: 'gather', w: 3, gather: ['ore'], out: { ore: 5 }, reach: 3, desc: '开采铁矿脉。', cost: { wood: 120, plank: 40, stone: 60 }, syn: ['smelter'] },
  smelter:   { n: '冶炼炉', t: 2, size: 2, cat: 'make', w: 3, in: { ore: 3, coal: 1 }, out: { iron: 2 }, desc: '铁矿石加煤炼成铁锭。', cost: { stone: 120, plank: 60 }, syn: ['ironmine', 'coalmine', 'steelworks'] },
  infirmary: { n: '医务所', t: 2, size: 2, cat: 'live', w: 2, beds: 4, desc: '把病人集中起来照顾：病床上的人就算外面冷、口粮紧也能好起来，还好得更快；有人守着，营地里也少有人病倒。派医生来效果更好。', cost: { wood: 80, plank: 60, stone: 40, iron: 15 }, syn: ['tent'] },
  coker:     { n: '焦煤坊', t: 2, size: 2, cat: 'make', w: 2, in: { coal: 4 }, out: { coke: 1.5 }, desc: '把煤压制成焦煤块：同样的煤，烧出更多热量。', cost: { stone: 100, plank: 50, iron: 10 }, syn: ['coalmine'] },

  limequarry:{ n: '石灰石场', t: 3, size: 2, cat: 'gather', w: 3, gather: ['lime'], out: { lime: 5 }, reach: 3, desc: '开采石灰岩床。', cost: { plank: 120, iron: 40 }, syn: ['steelworks'] },
  steelworks:{ n: '炼钢厂', t: 3, size: 2, cat: 'make', w: 4, in: { iron: 2, lime: 1, coal: 1 }, out: { steel: 2 }, desc: '铁锭、石灰石和煤炼成钢材。', cost: { stone: 200, iron: 80 }, syn: ['smelter', 'limequarry', 'gearworks'] },
  gearworks: { n: '齿轮厂', t: 3, size: 2, cat: 'make', w: 3, in: { steel: 1 }, out: { gear: 2 }, desc: '钢材加工成齿轮。', cost: { iron: 100, steel: 20 }, syn: ['steelworks', 'engineworks'] },
  engineworks:{ n: '蒸汽机厂', t: 3, size: 2, cat: 'make', w: 4, in: { gear: 2, steel: 1 }, out: { engine: 1 }, desc: '组装蒸汽机，用于熔炉、铁路与自动化升级。', cost: { iron: 120, steel: 40, gear: 20 }, syn: ['gearworks'] },
  greenhouse:{ n: '蒸汽温室', t: 3, size: 2, cat: 'make', w: 3, in: { coal: 1.5 }, out: { food: 9 }, desc: '用蒸汽保温种菜，不再完全靠打猎吃饭。', cost: { steel: 40, iron: 80, plank: 100 }, syn: ['tent', 'kitchen'] },
  heater:    { n: '蒸汽暖炉', t: 3, size: 1, cat: 'live', w: 1, heat: 4, hreach: 4, burn: 1.5, desc: '烧煤给全营地加温，并在周围 4 格内扩展可建造区。', cost: { iron: 60, steel: 20, gear: 10 } },

  shalepit:  { n: '油页岩矿', t: 4, size: 2, cat: 'gather', w: 4, gather: ['shale'], out: { shale: 5 }, reach: 3, desc: '开采冻土里的油页岩。', cost: { steel: 100, gear: 40 }, syn: ['refinery'] },
  refinery:  { n: '炼油厂', t: 4, size: 2, cat: 'make', w: 4, in: { shale: 3, coal: 1 }, out: { tar: 3 }, desc: '油页岩炼成焦油。', cost: { steel: 120, gear: 40, engine: 5 }, syn: ['shalepit', 'sealworks'] },
  sealworks: { n: '密封件厂', t: 4, size: 2, cat: 'make', w: 3, in: { tar: 2, steel: 1 }, out: { seal: 2 }, desc: '焦油与钢材做成密封件。', cost: { steel: 150, engine: 8 }, syn: ['refinery'] },

  crystalmine:{ n: '霜晶矿', t: 5, size: 2, cat: 'gather', w: 4, gather: ['crystal'], out: { crystal: 4 }, reach: 3, desc: '采集霜晶簇，深寒之地才有。', cost: { steel: 200, seal: 40 }, syn: ['batteryworks'] },
  batteryworks:{ n: '电池工坊', t: 5, size: 2, cat: 'make', w: 4, in: { crystal: 2, iron: 1 }, out: { battery: 2 }, desc: '霜晶封进铁壳做成晶体电池，是极高热值的燃料。', cost: { steel: 200, seal: 50, engine: 10 }, syn: ['crystalmine', 'alloyworks'] },
  alloyworks:{ n: '合金厂', t: 5, size: 2, cat: 'make', w: 4, in: { crystal: 1, steel: 1, battery: 1 }, out: { alloy: 1.5 }, desc: '恒温合金：深寒前哨与高级升级必需。', cost: { steel: 250, seal: 60, battery: 20 }, syn: ['batteryworks'] },

  salvage:   { n: '残骸拆解站', t: 6, size: 2, cat: 'gather', w: 5, gather: ['star'], out: { star: 4 }, reach: 3, desc: '从古代残骸上拆下星铁。', cost: { steel: 300, alloy: 40 }, syn: ['partworks'] },
  partworks: { n: '构件工坊', t: 6, size: 2, cat: 'make', w: 5, in: { star: 3, alloy: 1 }, out: { part: 1.5 }, desc: '星铁与合金复原出古代构件。', cost: { seal: 120, alloy: 60 }, syn: ['salvage', 'coreworks'] },
  coreworks: { n: '自动机工坊', t: 6, size: 2, cat: 'make', w: 5, in: { part: 2, battery: 2 }, out: { core: 0.5 }, desc: '组装自动机核心。', cost: { alloy: 100, part: 30 }, syn: ['partworks', 'bay'] },
  bay:       { n: '自动机仓', t: 6, size: 2, cat: 'live', w: 0, bots: 8, desc: '装入自动机核心，唤醒不吃饭、不怕冷的自动机工人（每个核心 2 台）。', cost: { alloy: 80, part: 40 } },

  excavator: { n: '炉心发掘场', t: 7, size: 2, cat: 'gather', w: 6, gather: ['shard'], out: { shard: 3 }, reach: 3, desc: '在永恒之炉周围发掘炉心碎片。', cost: { alloy: 200, part: 80 }, syn: ['forge'] },
  // 永恒之炉以北：走到对应的那一程才能建
  beacon:    { n: '信号灯塔', t: 7, stage: 7, size: 2, cat: 'core', w: 2, reveal: 26, desc: '塔顶的大灯把四周一大片的雾都照开（建好就照，升一级再远 4 格）。要两个人守灯。', cost: { alloy: 120, part: 40, battery: 30 } },
  colossus:  { n: '巨像守卫', t: 7, stage: 10, size: 3, cat: 'defense', w: 4, power: 0, guardCd: 3600, desc: '照着冻结的巨像造的石头守卫。派了人就能挡住一整次袭营，之后要歇一小时（升级歇得更短）。', cost: { alloy: 300, part: 120, core: 6 } },
  starpit:   { n: '星核矿', t: 7, stage: 11, size: 2, cat: 'gather', w: 6, gather: ['starfall'], out: { starcore: 2 }, reach: 3, desc: '在星落之坑的坑底凿出发紫光的星核。熔炉 35 级以后升级要用。', cost: { alloy: 260, part: 100, core: 4 } },
  // 北境地貌才能建的（rule：只有在这种地貌的站、主营地里才能建）
  pyre:      { n: '烽火塔', t: 7, tower: 1, size: 3, cat: 'core', w: 0, desc: '北境每站一座的烽火塔：交齐地基材料就立起来，塔身要持续喂高级材料，喂满了交燃料点火。点亮后这座营地希望 +5、暖圈 +1，光柱一直亮着，给身后的人指路。', cost: { steel: 600, alloy: 200, part: 120 } },
  skyfire:   { n: '天火塔', t: 7, tower: 10, size: 4, cat: 'core', w: 0, desc: '北境第 10 站的最后一座塔：六种高级材料一起喂，喂满了交星核点火。点着的那一刻，十道光柱一路往南连回永恒之炉。点亮后这座营地希望 +5、暖圈 +1。', cost: { steel: 1500, alloy: 500, part: 300, core: 20 } },
  geowell:   { n: '地热井', t: 5, rule: 'geo', size: 2, cat: 'live', w: 1, heat: 5, hreach: 5, desc: '打到地下的热泉：不烧燃料就能给全营地加温，并在周围 5 格内扩展可建造区。只有地热谷能打。', cost: { steel: 120, gear: 30, alloy: 20 } },
  icefish:   { n: '冰钓屋', t: 5, rule: 'lakes', size: 2, cat: 'gather', w: 2, gather: ['fish'], out: { food: 6 }, reach: 3, desc: '在冰面上凿洞钓鱼，鱼烤一烤就能吃：直接产熟食，不用厨房。要建在冰钓点旁边，只有冰湖群才有。', cost: { plank: 80, steel: 30 }, syn: ['tent', 'kitchen'] },
  forge:     { n: '炉心锻造所', t: 7, size: 2, cat: 'make', w: 6, in: { shard: 3, part: 2, alloy: 2 }, out: { heart: 0.6 }, desc: '锻造永恒炉件，用来重新点燃永恒之炉。', cost: { alloy: 250, part: 120, core: 5 }, syn: ['excavator'] },

  // 装饰：不产东西，让营地好看一点、大家心里亮一点（希望）。同一座营地的装饰合计最多 +16 希望
  lamp:      { n: '路灯', t: 1, size: 1, cat: 'deco', w: 0, hope: 1, desc: '铁杆上挂一盏油灯，夜里照亮营地的路。装饰：希望 +1，升级后更亮。', cost: { wood: 20, stone: 10 } },
  flagpole:  { n: '旗杆', t: 1, size: 1, cat: 'deco', w: 0, hope: 1.5, desc: '在营地里竖一面旗，远远就能看见家在哪儿。装饰：希望 +1.5。', cost: { wood: 40, plank: 10 } },
  statue:    { n: '先行者雕像', t: 2, size: 1, cat: 'deco', w: 0, hope: 3, desc: '纪念第一批往北走的人：一个举着火把的身影。装饰：希望 +3。', cost: { stone: 150, plank: 30, iron: 20 } },
  flowerhouse:{ n: '花窖', t: 3, size: 2, cat: 'deco', w: 1, hope: 4.5, desc: '用暖气养着一窖花，冰天雪地里的一点颜色。要一个花匠照料。装饰：希望 +4.5。', cost: { wood: 120, stone: 60, steel: 20 } },
  // 第十三版：八种北境装饰，成就解锁（gift: 1），和别的装饰一起算在 +16 希望的上限里
  icesculpt: { n: '冰雕', t: 1, size: 1, cat: 'deco', w: 0, hope: 2, gift: 1, desc: '冰湖里切出来的冰块，雕成一只展翅的天鹅，太阳一照透亮。装饰：希望 +2。', cost: { stone: 60, plank: 20 } },
  windchime: { n: '极光风铃', t: 1, size: 1, cat: 'deco', w: 0, hope: 2, gift: 1, desc: '木架上挂一排彩色的管子，风一吹叮叮当当，夜里像极光一样发着光。装饰：希望 +2。', cost: { plank: 40, steel: 10 } },
  snowman: { n: '雪人', t: 1, size: 1, cat: 'deco', w: 0, hope: 1.5, gift: 1, desc: '孩子们堆的雪人：煤球眼睛、胡萝卜鼻子，围着一条旧红围巾。装饰：希望 +1.5。', cost: { wood: 10 } },
  lanterns: { n: '灯笼串', t: 1, size: 2, cat: 'deco', w: 0, hope: 2.5, gift: 1, desc: '两根木杆之间拉一串红灯笼，节日一样。装饰：希望 +2.5。', cost: { plank: 60, wood: 40 } },
  deerstatue: { n: '驯鹿雕像', t: 1, size: 1, cat: 'deco', w: 0, hope: 3, gift: 1, desc: '一头昂着头的驯鹿铜像，纪念一路拉车的伙伴。装饰：希望 +3。', cost: { stone: 120, iron: 40 } },
  bonearch: { n: '巨兽骨拱门', t: 1, size: 2, cat: 'deco', w: 0, hope: 4, gift: 1, desc: '冻土里挖出来的两根巨兽长牙，搭成一道拱门，顶上架着它的头骨。装饰：希望 +4。', cost: { stone: 200, plank: 60 } },
  pyremem: { n: '烽火纪念碑', t: 1, size: 1, cat: 'deco', w: 0, hope: 3.5, gift: 1, desc: '一座小石碑，碑顶一盏长明的铁火盆，记着点亮过的每一座烽火塔。装饰：希望 +3.5。', cost: { stone: 300, steel: 60 } },
  skymem: { n: '天火纪念碑', t: 1, size: 2, cat: 'deco', w: 0, hope: 5, gift: 1, desc: '高高的方尖碑，顶上一团金色的火和一颗星晶，四角的火盆一直烧着。点燃天火的人才建得起。装饰：希望 +5。', cost: { stone: 500, steel: 150, alloy: 30 } },
};
export const BLD_KEYS = Object.keys(BLD);
export const CATS = { core: '核心', live: '居住', gather: '采集', make: '加工', defense: '防御', deco: '装饰' };

// 熔炉参数
export function furnaceHeat(lvl) { return 10 + 5 * lvl; }
export function furnaceRadius(lvl) { return Math.min(15, 6 + Math.ceil(lvl / 2)); } // 供热圈：6 + 等级的一半，最大 15 格（地盘是要规划的）
// 燃料单位/分钟：每级多烧 17%，跟着换燃料每分钟烧的个数一直在 2 到 7 个；27 级以后改成每级 +8%，远方几程不用每分钟烧几十块电池
export function furnaceBurn(lvl) { return 2.2 * Math.pow(1.17, Math.min(lvl, 27) - 1) * Math.pow(1.08, Math.max(0, lvl - 27)); }

// 专家
export const SPECS = [
  { id: 'lin',   n: '老林',   role: '伐木师',   aff: ['lumber', 'sawmill'], row: 22,  story: '在灰烬营地外的林子里独自过冬的老伐木工。' },
  { id: 'xue',   n: '阿雪',   role: '猎手',     aff: ['hunter', 'kitchen'], row: 36,  story: '追着一头雪鹿走散的年轻猎手。' },
  { id: 'zhou',  n: '石匠周', role: '石匠',     aff: ['quarry', 'limequarry'], row: 48, story: '他说石头会告诉他哪里能挖。' },
  { id: 'mei',   n: '梅姨',   role: '炊事长',   aff: ['kitchen', 'tent'], row: 70,  story: '她的锅从不熄火。' },
  { id: 'xiong', n: '大熊',   role: '矿工',     aff: ['coalmine', 'ironmine'], row: 62, story: '铁岭矿井塌方后唯一爬出来的人。' },
  { id: 'nova',  n: '诺娃',   role: '铁匠',     aff: ['smelter', 'coker', 'steelworks'], row: 88, story: '背着一把祖传的铁锤北上。' },
  { id: 'yan',   n: '燕子',   role: '侦察兵',   aff: ['scout'], row: 30,  story: '走在最前面的人，脚印总是第一个被风雪盖住。' },
  { id: 'erin',  n: '艾琳',   role: '熔炉工程师', aff: ['furnace', 'heater'], row: 118, story: '蒸汽峡谷管道站的最后一名值守。' },
  { id: 'vic',   n: '维克',   role: '机械师',   aff: ['gearworks', 'engineworks', 'warehouse'], row: 132, story: '能用三个齿轮修好任何东西。' },
  { id: 'tieya', n: '铁牙',   role: '守卫长',   aff: ['tower'], row: 98,  story: '独自守过一座被狼群围了七天的哨站。' },
  { id: 'batu',  n: '巴图',   role: '炼油师',   aff: ['shalepit', 'refinery', 'sealworks'], row: 168, story: '他闻得出冻土下有没有油。' },
  { id: 'liya',  n: '莉娅',   role: '晶石学者', aff: ['crystalmine', 'batteryworks', 'alloyworks'], row: 222, story: '研究霜晶二十年，手指被冻得发蓝。' },
  { id: 'mo',    n: '墨先生', role: '古文学者', aff: ['salvage', 'partworks', 'coreworks'], row: 276, story: '他能读懂残骸上的文字。' },
  { id: 'he',    n: '何大夫', role: '医生',     aff: ['infirmary'], row: null, story: '在南边的村子行医几十年，听说北边有人在点炉子，背着药箱一路找了过来。' },
  { id: 'luyu',  n: '炉语者', role: '守炉人',   aff: ['excavator', 'forge', 'furnace'], row: 318, story: '永恒之炉旁世代守望的人，等着有人把火带回来。' },
];
export const SPEC_MAX = 6; // 对口专家 6 级 = +100%，到顶
export function specBonus(lvl, matched) { return Math.min(1, matched ? 0.5 + 0.12 * (lvl - 1) : 0.15 + 0.03 * (lvl - 1)); }
export function specTrainCost(lvl) {
  const g = GATE[Math.min(7, 1 + Math.floor(lvl / 2))];
  return { food: Math.round(60 * Math.pow(lvl, 1.6)), [g]: Math.round(15 * Math.pow(1.5, lvl - 1)) };
}

// 余烬永久强化
export const EMBER_UPS = {
  heat:    { n: '余温',   d: '所有熔炉温度 +3°C',           base: 3,  grow: 1.55, max: 20 },
  prod:    { n: '巧手',   d: '所有生产 +4%',                base: 4,  grow: 1.6,  max: 15 },
  haul:    { n: '健步',   d: '搬运工与侦察队速度 +12%',     base: 3,  grow: 1.55, max: 20 },
  thrift:  { n: '节俭',   d: '建造与升级花费 -4%',          base: 5,  grow: 1.7,  max: 12 },
  people:  { n: '人望',   d: '开局和每到一站多 3 人，投奔速度 +15%',  base: 3,  grow: 1.5,  max: 20 },
  supply:  { n: '行囊',   d: '开局物资 +50%，每到一站也多送一笔木材、熟食、石料',               base: 2,  grow: 1.5,  max: 20 },
  reserve: { n: '丰饶',   d: '资源点储量 +15%',             base: 4,  grow: 1.6,  max: 20 },
  sight:   { n: '远眺',   d: '侦察视野 +1 格，侦察更耐寒',   base: 4,  grow: 1.7,  max: 10 },
  guard:   { n: '坚壁',   d: '箭塔威力 +15%',               base: 3,  grow: 1.55, max: 20 },
  hardy:   { n: '耐寒',   d: '居民耐寒 +2°C',               base: 4,  grow: 1.6,  max: 15 },
};
export function emberCost(key, lvl) { const u = EMBER_UPS[key]; return Math.round(u.base * Math.pow(u.grow, lvl)); }

// 袭营敌人（按纬度带）
export const RAIDERS = [null, '雪狼群', '雪狼群', '掠夺者', '掠夺者', '霜兽', '遗迹守卫', '遗迹守卫'];

export const STORY = {
  intro: '世界在一个冬天里冻住了。传说北方尽头有一座永不熄灭的熔炉——永恒之炉。每一代人北上一程，在途中点起营火，留下余烬，让后来的人走得更远。',
  migrate: '营火将熄，但余烬还在。带上它们和同伴，向北，去下一个营地。',
  trueEnd: '车队翻上世界之脊的那天，风停了。回头望去，一路上的营火连成一条细细的光，从灰烬营地一直亮到脚下。往北再没有人走过的路——可我们已经知道怎么走了。',
  ending: '永恒之炉重新燃起。火光沿着你们一路留下的营地向南蔓延，冰原第一次听见了融水的声音。旅程结束了——但这座炉子，会一直烧下去。',
  skyEnd: '天火塔点着的那一刻，光柱冲进了云里。往南，九道光一道接一道亮起来，一路连回永恒之炉——那就是我们走过的路。往后再有人往北走，抬头就能看见方向。',
};

// ---------- 昼夜（只影响画面，不影响产出） ----------
export const DAY_LEN = 720; // 一昼夜 12 分钟
const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
export function dayCycle(t) {
  const p = ((t / DAY_LEN) % 1 + 1) % 1;
  const nf = ss(0.5, 0.62, p) - ss(0.9, 1, p); // 0 白天 → 1 深夜
  const dw = Math.max(0, 1 - Math.abs(p - 0.56) / 0.08) + Math.max(0, 1 - Math.abs(p - 0.95) / 0.07) * 0.7; // 黄昏/黎明的暖色
  const ph = p < 0.5 ? ['☀️', '白天', 0.5] : p < 0.62 ? ['🌇', '黄昏', 0.62] : p < 0.9 ? ['🌙', '夜晚', 0.9] : ['🌅', '黎明', 1];
  return { p, nf, dw, icon: ph[0], name: ph[1], left: (ph[2] - p) * DAY_LEN };
}

// 难度：开新的一局时选，北迁也保留；游戏里随时能在菜单里改
export const DIFF = {
  easy: { n: '轻松', ic: '🌤', d: '吃得少、烧得少，暴风雪和狼群弱一些，建造便宜一成，大家心情更好。适合慢慢经营。', eat: 0.8, fuel: 0.8, cold: 0.7, raid: 0.6, cost: 0.9, hope: 6, ember: 0.8 },
  std: { n: '标准', ic: '🔥', d: '原本的寒冬。', eat: 1, fuel: 1, cold: 1, raid: 1, cost: 1, hope: 0, ember: 1 },
  hard: { n: '严酷', ic: '❄', d: '吃得多、烧得多，暴风雪更冷、狼群更凶，建造贵一成，人心更难稳住；北迁带回的余烬多三成。', eat: 1.2, fuel: 1.15, cold: 1.25, raid: 1.4, cost: 1.1, hope: -6, ember: 1.3 },
};
export const DIFF_KEYS = ['easy', 'std', 'hard'];
export const SLOTS = 3; // 存档位

// 营地专精：熔炉 5 级后每座营地选一个方向，强一样、弱一样；换专精要等 30 分钟
const MINES = ['quarry', 'coalmine', 'ironmine', 'limequarry', 'shalepit', 'crystalmine', 'salvage', 'excavator', 'starpit'];
const FOODS = ['hunter', 'kitchen', 'greenhouse'];
export const FOCUS = {
  mine: { n: '矿业', ch: '矿', col: '#7f93ab', d: '采石场、煤矿、铁矿这些挖矿的建筑产量 +30%。', bad: '打猎、厨房、温室产量 −10%', up: MINES, upV: 0.3, down: FOODS, downV: -0.1 },
  farm: { n: '农垦', ch: '垦', col: '#7fa84f', d: '打猎、厨房、温室、伐木、育林产量 +30%，新人来得快 30%，希望 +4。', bad: '挖矿的建筑产量 −10%', up: [...FOODS, 'lumber', 'nursery'], upV: 0.3, down: MINES, downV: -0.1, arrive: 0.3, hope: 4 },
  craft: { n: '工坊', ch: '工', col: '#d08a3a', d: '锯木厂、炼钢厂这些加工厂产量 +25%，研究快 20%。', bad: '采集建筑产量 −10%', up: 'make', upV: 0.25, down: 'gather', downV: -0.1, rp: 0.2 },
  fort: { n: '要塞', ch: '塞', col: '#b0574a', d: '箭塔威力 +50%，营地防御再 +20%，暴风雪少降温 25%，不满 −4。', bad: '所有产量 −5%', all: -0.05, tower: 0.5, def: 0.2, cold: 0.25, disc: -4 },
};
export const FOCUS_KEYS = ['mine', 'farm', 'craft', 'fort'];
export const FOCUS_LVL = 5, FOCUS_CD = 1800;

// 营地律令：每条都有好处也有代价，对所有营地生效；改过之后 3 分钟内不能再改
export const LAWS = [
  { id: 'overtime', n: '加班令', ic: '⏱️', d: '每天多干两个钟头。', good: '所有产量 +15%', bad: '不满 +14 · 更容易生病', prod: 0.15, disc: 14, sickIn: 0.004 },
  { id: 'sawdust', n: '锯末汤', ic: '🥣', d: '往汤里掺锯末，一锅分给更多人。', good: '厨房出餐 +25%', bad: '不满 +9 · 希望 −4', kitchen: 0.25, disc: 9, hope: -4 },
  { id: 'ration', n: '口粮减半', ic: '⚖️', d: '每人每天少吃一顿。', good: '吃掉的熟食 −30%', bad: '希望 −8 · 不满 +10 · 更容易生病', food: -0.3, hope: -8, disc: 10, sickIn: 0.004 },
  { id: 'care', n: '病号饭', ic: '🩹', d: '病人单独开小灶，躺着养病。', good: '病人好得快 2.5 倍 · 希望 +5 · 不满 −4', bad: '吃掉的熟食 +8%', sickRec: 1.5, food: 0.08, hope: 5, disc: -4 },
  { id: 'fires', n: '篝火夜', ic: '🔥', d: '每晚在熔炉边点起篝火，大家聚在一起。', good: '希望 +8 · 不满 −6', bad: '熔炉燃料 +12%', fuel: 0.12, hope: 8, disc: -6 },
  { id: 'patrol', n: '巡夜队', ic: '🛡️', d: '轮流巡夜，维持秩序。', good: '防御 +25% · 不满 −10', bad: '希望 −3', def: 0.25, disc: -10, hope: -3 },
];
export const LAW_CD = 180;

// 研究：工程站产出研究点数，攒够就完成；开始研究时先付材料
export const TECH_BR = ['生产', '生存', '后勤'];
export const TECHS = [
  { id: 'axe', br: 0, n: '钢口斧头', ic: '🪓', t: 1, pts: 12, cost: { wood: 120, stone: 40 }, d: '伐木场、采石场产量 +20%', fx: { bp: { lumber: 0.2, quarry: 0.2 } } },
  { id: 'smoke', br: 0, n: '熏肉架', ic: '🍖', t: 1, pts: 15, cost: { wood: 150, plank: 40 }, d: '猎人小屋、厨房产量 +20%', fx: { bp: { hunter: 0.2, kitchen: 0.2 } } },
  { id: 'drill', br: 0, n: '蒸汽钻头', ic: '⛏️', t: 2, pts: 40, cost: { plank: 150, iron: 60 }, d: '所有矿场产量 +20%', req: ['axe'], fx: { bp: { coalmine: 0.2, ironmine: 0.2, limequarry: 0.2, shalepit: 0.2, crystalmine: 0.2, salvage: 0.2, excavator: 0.2, starpit: 0.2 } } },
  { id: 'blast', br: 0, n: '鼓风炉', ic: '🏭', t: 2, pts: 50, cost: { stone: 300, iron: 80 }, d: '冶炼炉、焦煤坊、炼钢厂产量 +20%', req: ['drill'], fx: { bp: { smelter: 0.2, coker: 0.2, steelworks: 0.2 } } },
  { id: 'lathe', br: 0, n: '精密车床', ic: '⚙️', t: 3, pts: 90, cost: { steel: 120, gear: 40 }, d: '齿轮厂、蒸汽机厂、炼油厂、密封件厂产量 +20%', req: ['blast'], fx: { bp: { gearworks: 0.2, engineworks: 0.2, refinery: 0.2, sealworks: 0.2 } } },
  { id: 'cryst', br: 0, n: '晶体切割', ic: '💎', t: 5, pts: 220, cost: { seal: 120, crystal: 120 }, d: '电池、合金、构件、自动机核心、炉件产量 +20%', req: ['lathe'], fx: { bp: { batteryworks: 0.2, alloyworks: 0.2, partworks: 0.2, coreworks: 0.2, forge: 0.2 } } },
  { id: 'felt', br: 1, n: '加厚毛毡', ic: '🧶', t: 1, pts: 12, cost: { wood: 100, game: 60 }, d: '帐篷保暖 +3°', fx: { insul: 3 } },
  { id: 'grate', br: 1, n: '炉膛改良', ic: '🔥', t: 1, pts: 20, cost: { stone: 150, plank: 50 }, d: '熔炉燃料消耗 −10%', req: ['felt'], fx: { fuel: -0.1 } },
  { id: 'clinic', br: 1, n: '护理学', ic: '🩺', t: 2, pts: 35, cost: { plank: 150, iron: 40 }, d: '病人好得快一倍 · 希望 +3', req: ['felt'], fx: { sickRec: 1, hope: 3 } },
  { id: 'pipes', br: 1, n: '暖气管网', ic: '♨️', t: 3, pts: 70, cost: { steel: 80, gear: 30 }, d: '蒸汽暖炉热量 +40%', req: ['grate'], fx: { heater: 0.4 } },
  { id: 'glass', br: 1, n: '温室灯', ic: '🌱', t: 3, pts: 80, cost: { steel: 100, engine: 6 }, d: '蒸汽温室产量 +25%', req: ['pipes'], fx: { bp: { greenhouse: 0.25 } } },
  { id: 'steamheat', br: 1, n: '蒸汽供暖', ic: '🏠', t: 4, pts: 140, cost: { steel: 200, seal: 60 }, d: '帐篷保暖再 +5°', req: ['pipes'], fx: { insul: 5 } },
  { id: 'sled', br: 2, n: '轻便雪橇', ic: '🛷', t: 1, pts: 15, cost: { wood: 150, plank: 40 }, d: '搬运工走得快 15%', fx: { haul: 0.15 } },
  { id: 'shelf', br: 2, n: '货架', ic: '📦', t: 1, pts: 18, cost: { wood: 200, plank: 60 }, d: '仓储上限 +20%', req: ['sled'], fx: { cap: 0.2 } },
  { id: 'scope', br: 2, n: '望远镜', ic: '🔭', t: 2, pts: 30, cost: { plank: 120, iron: 40 }, d: '侦察队走得快 25%', req: ['sled'], fx: { scout: 0.25 } },
  { id: 'xbow', br: 2, n: '连弩', ic: '🏹', t: 2, pts: 40, cost: { plank: 100, iron: 80 }, d: '防御 +25%', req: ['shelf'], fx: { def: 0.25 } },
  { id: 'rail', br: 2, n: '铁轨扳道', ic: '🛤️', t: 4, pts: 120, cost: { steel: 200, engine: 10 }, d: '物流网所有路运力 +30%', req: ['xbow'], fx: { line: 0.3 } },
];

// 雾里的地点：侦察队揭开后，可以派探险队去，到了再决定怎么做
export const SITES = {
  depot:  { n: '废弃仓库', ic: '🏚️', desc: '半埋在雪里的旧仓库，铁皮屋顶塌了一半。' },
  camp:   { n: '幸存者营地', ic: '🔥', desc: '几顶破帐篷围着一堆小火，十来个人警惕地看着来人。' },
  train:  { n: '冻住的列车', ic: '🚂', desc: '一列被冰封的旧货运列车，车厢门冻得死死的。' },
  shrine: { n: '冰中神龛', ic: '🗿', desc: '冰层里冻着一座古老的神龛，上面刻满了北行者的名字。' },
  lab:    { n: '旧时代观测站', ic: '🔭', desc: '山脊上一座圆顶观测站，里面的仪器还在。' },
  wreck:  { n: '坠毁的飞艇', ic: '🎈', desc: '一艘巨大的飞艇斜插在雪里，骨架上结满了冰。' },
};

// ---------- 章节：每个地标一章，各有开场故事、三个任务和奖励 ----------
export const CHAPTERS = [
  { n: '第一章 · 余烬未冷', story: '上一代人留下的营火还有余温。他们在熔炉边刻了一行字：「别让火灭了，往北走。」先让这里变成一个家。',
    tasks: [{ t: '木板产量稳住 6/分钟', k: 'rate', r: 'plank', n: 6 }, { t: '让营地有 20 个人', k: 'people', n: 20 }, { t: '签署第一条营地律令', k: 'law', n: 1 }],
    reward: { res: { plank: 80, food: 150 }, hope: 8 }, end: '营火稳住了。夜里开始有人唱歌。' },
  { n: '第二章 · 黑色山脊', story: '铁岭的煤层还冒着热气。老矿工说，炼出第一块铁的那天，北行者才算真正站稳了脚。',
    tasks: [{ t: '铁锭产量稳住 8/分钟', k: 'rate', r: 'iron', n: 8 }, { t: '建 2 座煤矿', k: 'bld', b: 'coalmine', n: 2 }, { t: '完成 2 项研究', k: 'tech', n: 2 }],
    reward: { res: { iron: 120, coal: 150 }, bank: 60 }, end: '第一块铁锭敲出了清亮的声音。' },
  { n: '第三章 · 嘶鸣的管道', story: '峡谷里到处是旧时代的蒸汽管道，有的还在嘶嘶作响。迷雾深处，好像还有别的人。',
    tasks: [{ t: '钢材产量稳住 12/分钟', k: 'rate', r: 'steel', n: 12 }, { t: '探索 2 处雾里的地点', k: 'site', n: 2 }, { t: '让一个营地的希望达到 65', k: 'hope', n: 65 }],
    reward: { res: { gear: 80, steel: 80 }, people: 8 }, end: '峡谷里的管道重新热了起来，像一条醒过来的龙。' },
  { n: '第四章 · 北去的铁轨', story: '旧铁轨从冻原一路伸向北方。把营地连起来，人和物资就能顺着铁轨走。',
    tasks: [{ t: '密封件产量稳住 16/分钟', k: 'rate', r: 'seal', n: 16 }, { t: '物流网里有 2 条路', k: 'line', n: 2 }, { t: '所有营地加起来有 120 人', k: 'people', n: 120 }],
    reward: { res: { tar: 150, seal: 60 }, hope: 6 }, end: '第一队雪橇顺着铁轨滑了出去，汽笛声传得很远。' },
  { n: '第五章 · 冷光之城', story: '废墟里的晶体发着冷光，整座城像是冻在了最后一刻。旧图纸上标着一条往北的路。',
    tasks: [{ t: '恒温合金产量稳住 12/分钟', k: 'rate', r: 'alloy', n: 12 }, { t: '一共完成 8 项研究', k: 'tech', n: 8 }, { t: '一共探索 5 处雾里的地点', k: 'site', n: 5 }],
    reward: { res: { battery: 60, alloy: 60 }, bank: 200 }, end: '电池里的光，比废墟里的晶体暖一些。' },
  { n: '第六章 · 天外来客', story: '没人知道这艘巨大的残骸从哪里来。自动机还在里面游荡，像在等它们的主人。',
    tasks: [{ t: '古代构件产量稳住 16/分钟', k: 'rate', r: 'part', n: 16 }, { t: '所有营地加起来有 250 人', k: 'people', n: 250 }, { t: '让每个营地的不满都在 30 以下', k: 'calm', n: 30 }],
    reward: { res: { part: 60, star: 60 }, people: 15 }, end: '自动机第一次听从了人的指令，扛起了雪橇。' },
  { n: '终章 · 永不熄灭', story: '传说是真的。永恒之炉就在眼前，冰冷、巨大、沉默。它在等最后一程的人。',
    tasks: [{ t: '炉件稳住 3/分钟，点亮第一层', k: 'eternal', n: 1 }, { t: '炉件稳住 5/分钟，点亮第二层', k: 'eternal', n: 2 }, { t: '炉件稳住 7/分钟，重燃永恒之炉', k: 'eternal', n: 3 }],
    reward: { hope: 20 }, end: '火光沿着一路留下的营地向南蔓延。' },
  // 永恒之炉以北六程：每程两条线一起稳住，再加一件这一程的新东西
  { n: '第七章 · 灯塔的微光', story: '冰层里的灯塔还亮着一点微光，像在给北上的人指路。塔下的旧仓库里，晶体电池码得整整齐齐。',
    tasks: [{ t: '晶体电池产量稳住 16/分钟', k: 'rate', r: 'battery', n: 16 }, { t: '恒温合金产量稳住 16/分钟', k: 'rate', r: 'alloy', n: 16 }, { t: '建 1 座信号灯塔', k: 'bld', b: 'beacon', n: 1 }],
    reward: { res: { battery: 120, alloy: 80 }, people: 15 }, end: '灯塔重新亮了起来，几十里外都能看见。' },
  { n: '第八章 · 搁浅的巨船', story: '破冰船的船头还对着北方。它的锅炉冷透了，可船舱里的图纸告诉我们：冰面不是路的尽头。',
    tasks: [{ t: '古代构件产量稳住 18/分钟', k: 'rate', r: 'part', n: 18 }, { t: '晶体电池产量稳住 18/分钟', k: 'rate', r: 'battery', n: 18 }, { t: '造 1 台破冰车', k: 'veh', v: 'icebreaker', n: 1 }],
    reward: { res: { part: 100, engine: 40 }, bank: 300 }, end: '破冰车的履带压过冰面，裂缝在它面前合拢。' },
  { n: '第九章 · 极光之下', story: '观测站的墙上贴满了几十年的暴风雪记录。照着它，我们能比风雪先一步知道它要来。',
    tasks: [{ t: '古代构件产量稳住 20/分钟', k: 'rate', r: 'part', n: 20 }, { t: '自动机核心产量稳住 4/分钟', k: 'rate', r: 'core', n: 4 }, { t: '建 2 座自动机仓', k: 'bld', b: 'bay', n: 2 }],
    reward: { res: { core: 12, part: 120 }, hope: 10 }, end: '极光下，自动机和人一起扛着货往北走。' },
  { n: '第十章 · 跪着的巨人', story: '巨像跪在冰原上，双手撑着地。有人说它不是在守着什么，是在等着谁把它扶起来。',
    tasks: [{ t: '永恒炉件产量稳住 4/分钟', k: 'rate', r: 'heart', n: 4 }, { t: '自动机核心产量稳住 3/分钟', k: 'rate', r: 'core', n: 3 }, { t: '建 1 座巨像守卫', k: 'bld', b: 'colossus', n: 1 }],
    reward: { res: { heart: 30, core: 10 }, people: 20 }, end: '石头守卫站了起来，掠夺者远远看见就掉头走了。' },
  { n: '第十一章 · 星落之地', story: '坑底的石头发着紫光，摸上去是温的。老铁匠说，有了它，熔炉还能烧得更旺。',
    tasks: [{ t: '星核产量稳住 4/分钟', k: 'rate', r: 'starcore', n: 4 }, { t: '永恒炉件产量稳住 6/分钟', k: 'rate', r: 'heart', n: 6 }, { t: '建 2 座星核矿', k: 'bld', b: 'starpit', n: 2 }],
    reward: { res: { starcore: 40, heart: 30 }, bank: 400 }, end: '熔炉吃下第一块星核，火焰变成了淡紫色。' },
  { n: '尾声 · 世界之脊', story: '冰原尽头隆起一道巨大的骨脊。翻过去，就再也没有人走过的路了。我们走到了这里。',
    tasks: [{ t: '永恒炉件产量稳住 8/分钟', k: 'rate', r: 'heart', n: 8 }, { t: '所有营地加起来有 600 人', k: 'people', n: 600 }, { t: '让一个营地的希望达到 90', k: 'hope', n: 90 }],
    reward: { hope: 30 }, end: '一路上的营火连成一条线，从灰烬营地一直亮到世界之脊。' },
];

// 每到一个新地标，老向导的三句话简报：这一程要做什么、为什么、建议先做哪样
export const BRIEF = [
  ['这一程要把木板线跑到每分钟 6 个，稳住 3 分钟。', '木板是帐篷、熔炉和雪橇都要用的材料，往北走离不开它。', '先在树林边建两座伐木场，锯木厂挨着它们，再把熔炉升到 3 级。'],
  ['这一程要把铁锭线跑到每分钟 8 个。', '从这里往北，几乎每座建筑都要铁；煤还能把熔炉烧得更旺。', '先派人去山脊下找煤层和铁矿脉，冶炼炉放在两种矿中间。'],
  ['这一程要把钢材线跑到每分钟 12 个。', '钢是蒸汽时代的骨头：齿轮、蒸汽机、拖车都靠它。', '炼钢要铁锭、石灰石和煤一起到，先去峡谷底找石灰岩床。'],
  ['这一程要把密封件线跑到每分钟 16 个。', '密封件让管道和机器在深寒里不漏气，再往北就离不开它。', '焦油和钢材两条线要并到一起：先建油页岩矿和炼油厂，钢线照旧供上。'],
  ['这一程要把恒温合金线跑到每分钟 16 个。', '合金扛得住废墟以北的严寒，前面的建筑和熔炉都要用。', '合金要电池，电池又要霜晶和铁：先把霜晶矿和电池工坊建起来。'],
  ['这一程要把古代构件线跑到每分钟 20 个。', '构件能修好自动机，也是锻造永恒炉件的关键。', '星铁就在残骸附近，合金后面的补给站有余，物流网会沿着主干道运上来。'],
  ['永恒之炉分三层：炉件每分钟 3、5、7 个，各稳住 3 分钟。', '三层都亮起来就是通关，之后还能接着往北走。', '先在炉边挖炉心碎片，再建锻造所；构件和合金的线要先跑稳。'],
];

// ---------- 营地基建：道路让搬运更快，蒸汽管道把热送得更远 ----------
export const INFRA = {
  road: { n: '道路', ic: '🛤️', what: '搬运工沿着小路来回运货；路修得越好，走得越快。', lv: [
    { n: '踩出来的雪路', d: '搬运速度不变' },
    { n: '碎石路', d: '搬运工走得快 20%', cost: { stone: 120, wood: 80 } },
    { n: '石板路', d: '搬运工走得快 40%', cost: { stone: 320, plank: 120 } },
    { n: '暖石路', d: '搬运工走得快 60%，暴风雪里也不减速', cost: { stone: 500, steel: 80, coal: 150 } },
  ] },
  pipe: { n: '蒸汽管道', ic: '♨️', what: '管道沿着小路把熔炉的蒸汽送到营地各处。', lv: [
    { n: '没有管道', d: '' },
    { n: '铁皮管', d: '供热圈 +1 格 · 营地 +2°', cost: { iron: 80, plank: 120 } },
    { n: '保温管', d: '供热圈 +2 格 · 营地 +4°', cost: { iron: 160, steel: 50 } },
    { n: '高压管网', d: '供热圈 +3 格 · 营地 +6°', cost: { steel: 150, gear: 50, seal: 20 } },
  ] },
};
