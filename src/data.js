// 寒烬北行 · 静态数据（资源、建筑、专家、余烬强化、地标）
// 速率单位：每分钟；模拟内部换算为每秒。

export const RES = {
  wood:      { n: '목재',     t: 1, c: '#a0703c', raw: true },
  stone:     { n: '석재',     t: 1, c: '#9aa3ad', raw: true },
  game:      { n: '생고기',     t: 1, c: '#b5524a', raw: true },
  plank:     { n: '목판',     t: 1, c: '#d8a868' },
  food:      { n: '요리',     t: 1, c: '#e8b04a' },
  coal:      { n: '석탄',       t: 2, c: '#3a3a40', raw: true },
  ore:       { n: '철광석',   t: 2, c: '#9a5a3a', raw: true },
  iron:      { n: '철괴',     t: 2, c: '#8a96a3' },
  coke:      { n: '코크스 덩어리',   t: 2, c: '#55505a' },
  lime:      { n: '석회석',   t: 3, c: '#e6e0cc', raw: true },
  steel:     { n: '강재',     t: 3, c: '#7f9fc0' },
  gear:      { n: '톱니바퀴',     t: 3, c: '#c0a060' },
  engine:    { n: '증기기관',   t: 3, c: '#b07a40' },
  shale:     { n: '오일셰일',   t: 4, c: '#40363a', raw: true },
  tar:       { n: '타르',     t: 4, c: '#2a2224' },
  seal:      { n: '밀봉 부품',   t: 4, c: '#6a5a8a' },
  crystal:   { n: '서리수정',     t: 5, c: '#7fe8ff', raw: true },
  battery:   { n: '수정 배터리', t: 5, c: '#40c8f0' },
  alloy:     { n: '항온 합금', t: 5, c: '#a8f0e0' },
  star:      { n: '성철',     t: 6, c: '#b080ff', raw: true },
  part:      { n: '고대 부품', t: 6, c: '#c8a0ff' },
  core:      { n: '오토마톤 코어', t: 6, c: '#ff80d0' },
  shard:     { n: '노심 조각', t: 7, c: '#ff9a40', raw: true },
  heart:     { n: '영원의 용광로 부품', t: 7, c: '#ffd060' },
  starcore:  { n: '별핵',     t: 7, c: '#e070ff', raw: true, stage: 11 }, // 星落之坑的坑底才有；熔炉 35 级以后升级要用
};
export const RES_KEYS = Object.keys(RES);

// 燃料热值（熔炉按此计算“燃料单位”）
export const FUEL = { wood: 1, coal: 3, coke: 10, battery: 32 };
export const FUEL_ORDER = ['battery', 'coke', 'coal', 'wood'];

// 每一层的“门槛材料”：建筑升到一定等级后，继续升级需要更高层的这种材料
export const GATE = [null, 'plank', 'iron', 'steel', 'seal', 'alloy', 'part', 'heart'];
export const GATE_EVERY = 5; // 每 5 级跨一层

export const TIER_NAMES = ['', '모닥불', '석탄과 철', '강철과 증기', '석유와 철도', '서리수정', '유적 금속', '노심'];

// 资源点：地图上的有限储量点
export const SPOTS = {
  tree:    { n: '침엽수림',   res: 'wood',    reserve: 380, from: 0,   dens: 0.10 },
  rock:    { n: '잔돌 더미',   res: 'stone',   reserve: 700, from: 0,   dens: 0.04 },
  herd:    { n: '짐승 출몰지', res: 'game',    reserve: 300, from: 0,   dens: 0.028 },
  coal:    { n: '석탄층',     res: 'coal',    reserve: 1500, from: 45,  dens: 0.03 },
  ore:     { n: '철광맥',   res: 'ore',     reserve: 1200, from: 45,  dens: 0.026 },
  lime:    { n: '석회암층', res: 'lime',    reserve: 1200, from: 95,  dens: 0.026 },
  shale:   { n: '얼어붙은 오일셰일', res: 'shale',   reserve: 1400, from: 145, dens: 0.024 },
  crystal: { n: '서리수정 군락',   res: 'crystal', reserve: 1800, from: 200, dens: 0.02 },
  star:    { n: '고대 잔해', res: 'star',    reserve: 1400, from: 255, dens: 0.016 },
  shard:   { n: '노심 파편', res: 'shard',   reserve: 1500, from: 312, dens: 0.02 },
  starfall:{ n: '별핵석',   res: 'starcore', reserve: 1600, from: 9999, dens: 0 }, // 不随纬度撒，只放在星落之坑周围（worldgen 单独放）
  // 北境地貌才有的（nw）：只在对应规则的站里由 worldgen 单独放，老地图里没有
  dead:    { n: '고목 더미',   res: 'wood',    reserve: 260,  from: 9999, dens: 0, nw: 1 }, // 冻土无林：伐木场砍得动，砍完过一阵风雪又刮出来一堆
  fish:    { n: '얼음낚시터',   res: 'food',    reserve: 400,  from: 9999, dens: 0, nw: 1 }, // 冰湖群：冰面上的鱼窝，冰钓屋来钓
  ruin:    { n: '고성 폐허', res: 'part',    reserve: 1,    from: 9999, dens: 0, nw: 1 }, // 古城遗址：占着地，拆了得古代构件和钢材
};
export const SPOT_KEYS = Object.keys(SPOTS);

// 地标：剧情固定位置（行号 = 向北的纬度）
export const LANDMARKS = [
  { n: '잿빛 야영지', row: 10,  x: 24, desc: '여행의 출발점. 이전 야영지가 남긴 잔불은 여전히 뜨겁습니다.' },
  { n: '철령',     row: 55,  x: 17, desc: '석탄층과 철광석은 북행자가 철을 제련하는 법을 처음 배운 검은 능선 아래에 묻혀 있습니다.' },
  { n: '증기 협곡', row: 105, x: 31, desc: '협곡에 있는 오래된 증기 배관은 여전히 쉭쉭 소리를 내고 있고 석회암층은 계곡 바닥 전체에 있습니다.' },
  { n: '검은 기름 동토', row: 155, x: 20, desc: '동토 밑에서 검은 기름이 새어 나왔고, 구형 철길은 여기에서 북쪽으로 쭉 뻗어 나갔습니다.' },
  { n: '서리수정 폐허', row: 210, x: 29, desc: '고성 폐허에서 빛나는 수정이 자라났고, 차가운 공기가 매서웠다.' },
  { n: '성철 잔해', row: 265, x: 22, desc: '출처를 알 수 없는 거대한 잔해인 성철과 오토마톤이 땅바닥에 흩어져 있었습니다.' },
  { n: '영원의 용광로', row: 325, x: 24, desc: '결코 타지 않는 전설적인 용광로. 다시 불붙기를 기다리는 유물입니다.' },
];
// 地标模型的半径（格）：不能在上面建造，渲染时也按它避让
export const LM_R = [0, 2.5, 2.7, 2.6, 2.4, 3.1, 4.5];
// 永恒之炉以北的远方地标：侦察到就有余烬；在旁边点起熔炉能带回一件遗物（永久生效，北迁后也保留）
export const FAR_MARKS = [
  { n: '얼어붙은 등대', row: 382, r: 2.6, desc: '얼음으로 둘러싸인 등대, 탑 꼭대기에 있는 렌즈는 낮은 빛을 멀리 있는 곳까지 보낼 수도 있습니다.',
    relic: { k: 'sight', v: 0.2, n: '등대 렌즈', d: '정찰대는 +20% 더 나아갈 수 있습니다.' } },
  { n: '잠들어 있는 쇄빙선', row: 446, r: 3.2, desc: '빙원 위에는 거대한 쇄빙선이 누워 있었고, 보일러는 오랫동안 차가웠으며, 선실에는 여전히 구시대의 화물이 쌓여 있었다.',
    relic: { k: 'haul', v: 0.12, n: '쇄빙선의 보일러 밸브', d: '모든 야영지 처리 속도 +12%' } },
  { n: '오로라 관측소', row: 518, r: 2.8, desc: '돔에 균열이 있었고 망원경은 여전히 북쪽을 가리키고 있었습니다. 벽은 눈보라의 레코드로 덮여 있습니다.',
    relic: { k: 'shield', v: 0.15, n: '관측소의 기상도', d: '눈보라 냉각 -15%' } },
  { n: '얼어붙은 거상', row: 598, r: 3.0, desc: '반쯤 무릎을 꿇고 땅을 짚은 채 무언가를 지키고 있는 듯한 석상. 어깨에는 얼음이 걸려 있었다.',
    relic: { k: 'def', v: 0.15, n: '거상의 심장', d: '모두야영지방어 +15%' } },
  { n: '별이 떨어진 구덩이', row: 690, r: 3.4, desc: '오래전 하늘에서 무언가가 떨어져 커다란 분화구를 만들었습니다. 구덩이 바닥의 돌들은 여전히 ​​보라색으로 빛나고 있었습니다.',
    relic: { k: 'prod', v: 0.1, n: '별핵 파편', d: '모두야영지 생산량 +10%' } },
  { n: '세계의 척추', row: 800, r: 3.6, desc: '고대 짐승의 척추처럼 거대한 뼈 능선이 빙상 끝에서 솟아올랐습니다. 뒤집어 보면 더 이상 아무도 가본 적이 없는 길이 없습니다.',
    relic: { k: 'ember', v: 0.25, n: '등뼈 불씨', d: '북상 +25%일 때 잔불 제거' } },
];
// 北境：世界之脊以北，一站接一站没有尽头。每站约 80 行，带一条地貌规则和一个地标
export const SPINE_ROW = 800;
export const NORTH_GAP = 80;
// 地貌规则：一好一坏，只管当前这一站（效果在 sim / worldgen 里按 id 生效）
export const NORTH_RULES = {
  flat:   { n: '평탄한 설원', ic: '🏔', good: '난방권에는 더 많은 열린 공간이 있습니다.', bad: '미네랄 포인트가 거의 없음',
    tip: '이곳의 땅은 평평하고 열린 공간이 많지만 광물 포인트가 적습니다. 먼저 각 지뢰 유형 옆에 있는 채집 슬롯을 차지한 다음 열어서 다른 지뢰를 덮으세요.' },
  geo:    { n: '지열 골짜기',   ic: '♨', good: '난방권 +3 블록, 연료는 −30% 소모', bad: '탄광 및 오일셰일이 절반으로 줄었습니다.',
    tip: '지하는 뜨겁습니다. 난방권에는 3개의 그리드가 있고, 용광로에는 3개의 그리드가 있으며, 연료에는 3개의 그리드가 있습니다. 석탄 및 오일셰일은 보통 크기의 절반에 불과하므로 파는 데 드는 시간을 절약할 수 있습니다. 지열정을 칠 수 있습니다.' },
  rich:   { n: '부광대',   ic: '💎', good: '광산 매장량 ×3', bad: '난방권 -2 그리드(역 도착 후 처음 2일은 평소와 같습니다)',
    tip: '이 지역에는 보통의 3배에 달하는 광물 매장량이 있지만 난방권은 2블록 더 작습니다. 용광로는 처음 이틀 동안 여전히 강세를 보이고 있으며 난방권은 평소와 같습니다. 그 이후에는 줄어들기 때문에 집을 지을 때 공간을 고려해야 합니다.' },
  night:  { n: '영야',     ic: '🌌', good: '오로라는 더 많고, 희망은 상승하기 더 쉽습니다.', bad: '연료 +20%, 야외 작업 시 10% 느려짐',
    tip: '여기서는 태양이 나오지 않습니다. 용광로는 연료보다 20% 느리게 연소되고 실외 채집은 10% 더 느리게 연소됩니다. 다행히 매일 밤 오로라가 있어 모두가 행복감을 느낍니다.' },
  wolf:   { n: '늑대 무리 영역', ic: '🐺', good: '습격을 쓰러뜨려 얻은 전리품 ×2', bad: '습격은 ×1.5가 됩니다.',
    tip: '이것은 늑대 무리의 영역이며 습격은 크기가 절반입니다. 먼저 화살탑을 건설하세요. 쓰러뜨리면 전리품이 보통의 2배가 됩니다.' },
  lakes:  { n: '얼음호수 지대',   ic: '🎣', good: '얼음낚시 오두막을 제작하고 식용 물고기를 생산할 수 있습니다.', bad: '얼음 위에 집을 지을 수 없으며 얼음호수 균열이 더 흔합니다.',
    tip: '얼음호수는 어디에나 있고 얼음 위에 집을 지을 수 없으며 얼음호수는 깨지기 쉽습니다. 얼음낚시 오두막은 호수 옆에 건설할 수 있으며, 잡은 물고기를 직접 먹을 수 있습니다.' },
  ruins:  { n: '고성 유적지', ic: '🏛', good: '폐허를 제거하여 고대 부품 및 강재를 얻으세요', bad: '폐허는 한 지역을 차지하고, 철거된 후에야 열린 공간이 생길 수 있다.',
    tip: '난방권은 고성의 부서진 벽과 함께 흩어져 있습니다. 폐허를 클릭하면 일손 배치를 분해할 수 있습니다. 해체될 제품은 고대 부품 및 강재며 공간도 확보됩니다.' },
  storm:  { n: '폭풍 회랑', ic: '🌪', good: '눈보라 예측이 사전에 두 배로 늘어났습니다.', bad: '눈보라×2',
    tip: '이 복도에서 바람과 눈이 불어왔고, 눈보라는 보통보다 두 배나 강했다. 다행스럽게도 예측은 두 배나 빨랐습니다. 연료, 요리를 더 준비해주세요.' },
  meteor: { n: '운석비',   ic: '☄', good: '유성 구덩이가 더 많고 별핵이 발굴하기 더 쉽습니다.', bad: '가끔 건물에 부딪혀 잠시 작업을 중단',
    tip: '유성은 종종 하늘에서 떨어집니다. 유성 분화구가 많고 별핵석도 많습니다. 가끔 집이 타격을 받아 수리를 위해 공사가 잠시 중단되기도 하지만 무너지지는 않습니다.' },
  tundra: { n: '나무 없는 동토', ic: '🪵', good: '더 많은 돌과 광물 포인트', bad: '라이브 트리가 없고 고목 더미만 있습니다.',
    tip: '동토에는 살아있는 나무가 없고 고목 더미만 있었는데 얼마 후 다시 긁어냈습니다. 목판은 후면 야영지에서 배송되는 것이 가장 좋습니다.' },
};
// 富矿带：哪一种矿储量 ×3（按种子抽）
export const RICH_KINDS = ['coal', 'ore', 'lime', 'shale', 'crystal', 'star', 'shard', 'starfall'];
// 地貌规则的数值
export const RULE_FX = { geoWarm: 3, geoFuel: 0.7, richWarm: -2, nightFuel: 1.2, nightOut: 0.9, nightHope: 4, wolfRaid: 1.5, wolfLoot: 2, metHit: 120 };
export const NORTH_RULE_KEYS = Object.keys(NORTH_RULES);

// 1.1 营地特产：建营地那一刻定下，之后不变；这几种建筑在这座营地里产量 +50%（研究「特产精工」后 +75%）
// 北境的站按地貌定（富矿带按那一种矿）；其余营地和前哨按暖圈里最多的矿点定（多少按平常的密度折算）
export const CAMP_SPEC = {
  flat:    { n: '삼림', b: ['lumber', 'nursery', 'sawmill'] },
  geo:     { n: '지열', b: ['greenhouse', 'batteryworks'] },
  night:   { n: '별 관측', b: ['workshop'] },
  wolf:    { n: '사냥터', b: ['hunter', 'kitchen', 'tower'] },
  lakes:   { n: '얼음호수', b: ['icefish', 'crystalmine'] },
  ruins:   { n: '고성', b: ['salvage', 'partworks'] },
  storm:   { n: '바람길목', b: ['coker', 'heater'] },
  meteor:  { n: '유성 낙하', b: ['starpit', 'forge'] },
  tundra:  { n: '동토', b: ['quarry', 'limequarry', 'steelworks'] },
  coal:    { n: '석탄', b: ['coalmine', 'coker'] },
  ore:     { n: '철', b: ['ironmine', 'smelter'] },
  lime:    { n: '석회석', b: ['limequarry', 'steelworks'] },
  shale:   { n: '오일셰일', b: ['shalepit', 'refinery'] },
  crystal: { n: '서리수정', b: ['crystalmine', 'batteryworks'] },
  star:    { n: '성철', b: ['salvage', 'partworks'] },
  shard:   { n: '노심 조각', b: ['excavator', 'forge'] },
  starfall:{ n: '별핵', b: ['starpit', 'forge'] },
  tree:    { n: '목재', b: ['lumber', 'sawmill'] },
  rock:    { n: '석재', b: ['quarry'] },
  herd:    { n: '사냥감', b: ['hunter', 'kitchen'] },
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
// 1.1 北方商会：按物资的纬度带定底价（银币），每天上下浮动四成；同一天卖得越多越便宜，第二天恢复
// 1.1 自动机：一台顶 1.5 个人（研究「自动机校准」后顶 2 个）；自动机仓每级装 8 台（「仓位扩容」后 12 台）
// 三种型号：劳工型什么活都干；搬运型只当搬运工、一台顶两个；采掘型只干采集，产量 +30%
export const BOT = { pow: 1.5, powCal: 2, haul: 2, mine: 0.3, bay: 8, bayPro: 12 };
export const BOT_MODELS = {
  labor: { n: '노동형', ic: '🤖', d: '모든 종류의 작업을 수행할 수 있으며, 한 대의 기계로 1.5명을 지원할 수 있습니다.' },
  haul: { n: '운반형', ic: '🛷', d: '움직이는 것만: 두 개의 운반꾼을 들고 작은 썰매를 끌고 다닐 수 있습니다.', tech: 'bothaul' },
  mine: { n: '채굴형', ic: '⛏️', d: '채집만 수행(벌목, 채석, 채광, 사냥): 생산량 +30%', tech: 'botmine' },
};
// 1.1 熔炉号令：只对当前营地（紧急调度管整个物流网）；离线时不会自己发
export const CMDS = {
  blaze: { n: '용광로 격연', ic: '🔥', d: '이 야영지 전체 생산 ×2, 용광로연료 ×3', len: 60, cd: 600, tech: 'cmd1' },
  rush: { n: '긴급 수송', ic: '📯', d: '전체 물류망 전송 용량 ×3, 썰매 2배 빠른 속도', len: 90, cd: 480, tech: 'cmd1', net: true },
  unity: { n: '전원 일심', ic: '🤝', d: '봉화탑 본체와 불가사의의 구성은 3배 빠릅니다. 불만은 클리어되어 주문 기간 동안 더 이상 증가하지 않습니다.', len: 120, cd: 900, tech: 'cmd2' },
  shelter: { n: '용광로의 가호', ic: '🛡️', d: '용광로연료 −50%, 난방권 +2 그리드', len: 180, cd: 1200, tech: 'cmd2' },
};
// 1.1 分岔北境：路的难度（目标 ×0.9 / ×1.0 / ×1.15）和对应的奖励倍数；好处三选一
export const FORK = { diff: [0.9, 1, 1.15], rew: [0.75, 1, 1.5], dn: ['수월한 길', '보통', '험난한 길'], embers: 40, hardEmbers: 20 };
export const FORK_BONUS = { embers: { n: '잔불', ic: '🔥' }, bp: { n: '불가사의 도면 한 장', ic: '📜' }, spec: { n: '전문가 한 명', ic: '🧑' } };
// 1.1 奇观：4×4，三期施工，每期几种材料一起喂（像烽火塔身，喂满一期进下一期）。建成以后这一程一直有效，所有营地都算；
// 每种一程只能建一座，一座营地最多一座。图纸从研究（奇观图纸·一/二）和北境的奇遇、分岔里拿
export const WONDER_PH = [{ n: '기초 공사', dur: 720 }, { n: '골조 공사', dur: 1080 }, { n: '상량', dur: 1200 }];
export const WONDER_FX = { prod: 0.15, cap: 2, warm: 2, fuel: 0.85, res: 0.5, hope: 5, road: 1.5, trip: 1.3, star: 0.3 };
export const WONDERS = {
  wcolossus: { n: '증기 거상', ic: '🗿', tech: 'wonder1', d: '모든 야영지 생산량 +15%; 하루에 한 번 방어할 수 없는 습격을 겁주어 쫓아내세요.', ph: [{ steel: 1200, gear: 800, stone: 1500 }, { engine: 500, alloy: 500, seal: 300 }, { part: 240, core: 120, heart: 40 }] },
  wvault: { n: '만년 얼음창고', ic: '🧊', tech: 'wonder1', d: '전체 야영지저장량 상한 ×2', ph: [{ stone: 2500, steel: 800, lime: 1000 }, { crystal: 1200, alloy: 500, seal: 400 }, { part: 200, battery: 400, core: 100 }] },
  wbeacon: { n: '꺼지지 않는 등대', ic: '🗼', tech: 'wonder1', d: '모든 야영지난방권 +2 블록, 용광로연료 −15%', ph: [{ stone: 2000, steel: 1000, gear: 500 }, { battery: 600, alloy: 400, engine: 300 }, { part: 200, core: 100, heart: 60 }] },
  waurora: { n: '오로라 탑', ic: '🌌', tech: 'wonder2', d: '연구 속도 +50%, 모든 야영지희망 +5', ph: [{ steel: 1200, seal: 600, lime: 1000 }, { crystal: 1500, battery: 600, alloy: 500 }, { part: 300, core: 150, starcore: 40 }] },
  wterminal: { n: '철도 중앙역', ic: '🚉', tech: 'wonder2', d: '물류망은 50% 더 빠르고, 북상행렬은 30% 더 빠릅니다.', ph: [{ steel: 2000, plank: 1500, gear: 800 }, { engine: 700, alloy: 500, seal: 500 }, { part: 300, core: 150, heart: 60 }] },
  wstarforge: { n: '별의 용광로', ic: '✨', tech: 'wonder2', d: '생산량 영원의 용광로 부품 및 별핵의 경우 +30%', ph: [{ steel: 1500, stone: 2000, coke: 1000 }, { alloy: 700, battery: 700, engine: 400 }, { part: 300, heart: 80, starcore: 60 }] },
};
// 1.1 城镇：研究「城镇规划」后，营地人够多、希望够高就能升级（一级一级升，升了不会降）
export const TOWN = [
  { n: '야영지' },
  { n: '도시', pop: 60, need: 50, d: '침대 +20%, 희망 +3', beds: 0.2, hope: 3 },
  { n: '도시', pop: 120, need: 50, d: '봉화탑, 불가사의 건설 속도가 25% 빨라지고 생산량 +5%', feed: 1.25, prod: 0.05 },
  { n: '대도시', pop: 180, need: 50, d: '특산품 25% 추가 보너스, 매일 시립선물팩 증정', spec: 1.25, gift: 1 },
];
export const TOWN_FEST = 30; // 升级典礼：大家放下活看烟花
export const WONDER_KEYS = Object.keys(WONDERS);
// 1.1 站点奇遇：北境每站一件（事情本身写在 north.js）
export const QY = {
  wolfking: { n: '늑대왕', ic: '🐺', d: '말보다 키가 큰 흰늑대는 오늘 밤 난방권 밖에서 식사할 곳을 고르고 있습니다.' },
  undercity: { n: '얼음 아래 고성', ic: '🏛', d: '얼음호수 그 아래에는 도시 전체가 얼어붙어 있고 지붕, 거리, 종탑도 그대로 남아 있습니다.' },
  geyser: { n: '지열 분출', ic: '♨', d: '야영지 옆의 눈이 갈라지고 하얀 증기의 온천이 뿜어져 나왔습니다.' },
  whale: { n: '얼어붙은 거대 고래', ic: '🐋', d: '빙상에서 솟아오른 회색 언덕은 얼음 속에 얼어붙은 거대한 고래이다.' },
  aurora: { n: '오로라 폭풍', ic: '🌌', d: '오로라는 커튼처럼 땅에 매달려 있고, 공학 작업장의 악기는 놀라울 정도로 밝습니다.' },
  caravan: { n: '길을 잃은 상단', ic: '🔔', d: '바람과 눈 속에서 울리는 종소리는 길을 잃은 캐러밴이다.' },
  sleepers: { n: '얼음 동굴의 동면자', ic: '🧊', d: '얼음동굴 깊은 곳에서 펠트에 싸여 동면 중인 사람의 가슴이 아직도 부풀어 오른다.' },
  starfall: { n: '추락한 별핵', ic: '☄', d: '불은 한밤중에 하늘을 가로질러 번쩍이며 야영지 북쪽에 커다란 분화구를 만들었습니다.' },
  wreck: { n: '얼어붙은 쇄빙선', ic: '🚢', d: '얼음호수 한가운데에 쇄빙선이 얼어붙고 보일러에 붉은 녹이 슨다.' },
  hermit: { n: '설원의 은둔자', ic: '🧓', d: '40년 동안 눈 둥지에서 기다려온 노인.' },
  stormeye: { n: '폭풍의 눈', ic: '🌀', d: '다가오는 폭풍은 눈조차 내리지 않을 정도로 고요했습니다.' },
  altar: { n: '오래된 불의 제단', ic: '🔥', d: '눈 아래에서 파낸 돌제단, 제단 바닥의 숯불은 여전히 ​​따뜻합니다.' },
};
export const QY_KEYS = Object.keys(QY);
export const GUILD = { price: [0, 1, 3, 8, 15, 30, 60, 120], float: 0.4, depth: 300, orders: 3, ordersPro: 5, buyMul: 3, buyLim: [0, 300, 150, 80, 40, 20, 10, 5], emberDay: 20, emberCost: 40 };
// 北境每站一章：两条产能目标从六种高级材料里轮着抽，加一条地貌任务，前十站各一座烽火塔
export const NORTH_HI = ['part', 'battery', 'alloy', 'core', 'starcore', 'heart'];
// 烽火塔：第 1–3 座 2 种材料 4–5/分钟喂 10 分钟；4–6 座 3 种 5–6/分钟 12 分钟；7–9 座 4 种 6–7/分钟 15 分钟；天火塔 6 种 6/分钟 20 分钟
export const TOWER_STEPS = [[3, 2, 4, 600], [6, 3, 5, 720], [9, 4, 6, 900], [10, 6, 6, 1200]];
export const TOWER_FX = { hope: 5, warm: 1 };
export const NORTH_TASK = {
  geo:    { t: '빌드 2 지열정', k: 'bldm', b: 'geowell', n: 2 },
  lakes:  { t: '빌드 2 얼음낚시 오두막', k: 'bldm', b: 'icefish', n: 2 },
  wolf:   { t: '습격을 3번 격파하세요', k: 'ns', f: 'raidW', n: 3 },
  ruins:  { t: '4 고성 폐허 제거', k: 'ns', f: 'ruin', n: 4 },
  storm:  { t: '눈보라의 2게임에서 살아남았으나 동상은 한 명도 살아남지 못했습니다.', k: 'ns', f: 'blizOk', n: 2 },
  meteor: { t: '유성 분화구 3개 파기', k: 'ns', f: 'crater', n: 3 },
  tundra: { t: '목판 300개를 이 스테이션으로 운반하세요.', k: 'ns', f: 'plank', n: 300 },
  night:  { t: '본영희망이 70 이상이면 10분간 안정하게 유지하세요', k: 'hhold', n: 10 },
};
export const NORTH_STORY = [
  '북방 도로는 없고 선인들이 심어놓은 얼음 자국만 있을 뿐이다. 행렬은 "{n}"에서 멈췄고, 새로운 용광로의 불꽃은 눈의 원을 반사했습니다.',
  '바람이 조금 잠잠해졌습니다. 누군가 눈 아래에서 오래된 철길을 파냈는데 그것이 어디로 가는지 아무도 몰랐습니다.',
  '세계의 척추에서 점점 멀어질수록 밤에는 얼음 깊은 곳에서 메아리를 들을 수 있습니다. 먼저 "{n}"의 화재를 안정시켜야 합니다.',
  '늙은 길잡이가 지도 옆에 이름을 추가했습니다: "{n}". 그는 북쪽으로 정차할 때마다 무언가를 남겨 두어야 한다고 말했습니다.',
  '"{n}" 아까 정차했던 곳보다 날씨가 추웠지만 모두의 발걸음은 느려지지 않았습니다. 내 뒤에 있는 모닥불이 차례로 빛났다.',
  '눈 덮인 들판에 글자가 적힌 돌판이 서 있다. 그 위에 "{n}"을 새기고 불을 피웠어요.',
  '아이는 북쪽에 또 무엇이 있는지 물었습니다. 아무도 대답하지 못해서 모두 가 보기로 결정했습니다. 이 정류장은 "{n}"이라고 합니다.',
  '바람결에 녹슨 냄새가 난다. 마치 오래전 이곳에서 누군가가 쇠를 만든 듯하다. "{n}", 또 다른 새 집입니다.',
];
export const NORTH_END = [
  '"{n}"의 화재가 안정되었습니다. 북쪽을 보면 바람과 눈 뒤에는 아직 길이 남아 있습니다.',
  '누군가 "{n}"의 용광로 곁에 날짜를 새겼습니다. 내일 행렬은 계속해서 북쪽으로 향할 것입니다.',
  '북방에 박힌 못처럼 "{n}"이 켜졌습니다.',
  '마지막 배송에는 썰매가 탑재되었습니다. "{n}"은(는) 계속해서 불타면서 다음 사람을 기다립니다.',
];
// ---------- 第十三版：成就换来的装扮（只是好看：称号、炉火颜色、旗子、相框、北境装饰）----------
export const TITLES = { tale: '기연을 들은 사람', tales: '열두 기연', wonder: '불가사의 건설자', wonders: '세 불가사의', mayor: '대도시의 주인', tide5: '영동의 불지킴이', tide10: '열 번의 물결에도 꺼지지 않는 자', peak: '전성기의 불꽃', ice: '얼음을 깨는 자', walker: '북방의 나그네', far: '극북에 닿은 자', lamp: '불을 켜는 사람', sky: '천화에 불을 붙인 사람', wolf: '늑대 앞의 밤지킴이', storm: '폭풍 속의 사람', keeper: '불지킴이' };
// 炉火颜色：c = [火心, 火身, 火尖]；aurora 会慢慢变色
export const FLAMES = {
  def: { n: '기본' },
  gold: { n: '금색', c: ['#fff4c8', '#ffc83a', '#ff9418'] },
  blue: { n: '얼음 파랑', c: ['#ecfdff', '#7fd8ff', '#2f86ff'] },
  purple: { n: '별 보라', c: ['#f8eaff', '#c58cff', '#7a3cff'] },
  green: { n: '오로라 초록', c: ['#efffef', '#6dffae', '#16c48a'] },
  aurora: { n: '오로라', c: ['#effffa', '#7cf0ff', '#b07cff'], shift: 1 },
  frost: { n: '서리 하양', c: ['#ffffff', '#d8ecff', '#8fb8e8'] },
  eternal: { n: '영원한 겨울', c: ['#f4fbff', '#9fe6ff', '#4a5cff'], shift: 1 },
};
export const FLAGS = { def: { n: '기본' }, star: { n: '북극성' }, flame: { n: '불꽃' }, wolf: { n: '늑대 머리' }, compass: { n: '나침반' } };
export const FRAMES = { none: { n: '테두리 없음' }, copper: { n: '구리 테두리' }, film: { n: '필름' }, map: { n: '낡은 지도' }, ruin: { n: '고성 돌테두리' } };
// 八种北境装饰（建筑表里 gift: 1，成就解锁以后才能建）
export const NDECO = ['icesculpt', 'windchime', 'snowman', 'lanterns', 'deerstatue', 'bonearch', 'pyremem', 'skymem'];
// 北境每站的地标，四种轮着用（r：模型半径，不能在上面建造）
export const NORTH_MARKS = [
  { n: '얼어붙은 석비', r: 2.2, desc: '설원 위에 사람 키보다 훨씬 큰 돌판이 서 있었는데, 그 돌판에는 누구도 알아볼 수 없는 글자가 새겨져 있었습니다. 얼음이 태블릿 상단에서 땅에 매달려 있었습니다.' },
  { n: '얼어붙은 오래된 문', r: 2.6, desc: '두 개의 돌기둥이 아치를 지탱하고 있습니다. 문 안에는 아무것도 없고, 저 멀리 눈만 남아 있습니다. 상인방에 두꺼운 얼음이 있습니다.' },
  { n: '거수 골격', r: 3.0, desc: '얼음 속에 반쯤 묻혀 있는 또 다른 거대한 짐승의 뼈 세트입니다. 세계의 척추에 비해 크기는 작지만, 갈비뼈는 마치 숨을 ​​쉬고 있는 것처럼 더욱 구부러져 있습니다.' },
  { n: '부러진 얼음탑', r: 2.4, desc: '얼음탑은 반으로 부서졌고, 윗부분은 눈 속에 대각선으로 박혀 있었습니다. 골절은 여전히 ​​하늘색 빛으로 빛나고 있었습니다.' },
];
// 北境站名：两半拼起来（同一局里不重复）
export const NORTH_NAME_A = ['적풍', '백경', '단등', '상랑', '정수', '회성', '고성', '냉철', '장야', '쇄빙', '설효', '회범', '동령', '침종', '창각', '무성', '은척', '모화', '현빙', '원범'];
export const NORTH_NAME_B = ['산등성이', '만', '입', '원래의', '골짜기', '경사', '탑', '십자가', '호수', '...곶', '낭떠러지', '닫다'];
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
  furnace:   { n: '용광로', t: 1, size: 3, cat: 'core', w: 0, desc: '야영지의 핵심: 열 및 가열 반경을 제공하며 저장량 지점이기도 합니다. 업그레이드는 난방권을 확장하고 온도를 향상시킬 수 있습니다.', cost: { wood: 260, stone: 160, plank: 60 } },
  tent:      { n: '천막', t: 1, size: 2, cat: 'live', w: 0, housing: 5, insul: 6, desc: '거주. 침대와 단열재가 제공되어 업그레이드 이후 더욱 따뜻하게 생활하실 수 있습니다.', cost: { wood: 25 }, syn: ['tent'] },
  lumber:    { n: '벌목장', t: 1, size: 2, cat: 'gather', w: 2, gather: ['tree', 'dead'], out: { wood: 7 }, reach: 3, desc: '근처의 침엽수림을 자르십시오(고목 더미는 동토에서도자를 수 있습니다).', cost: { wood: 15 }, syn: ['sawmill'] },
  nursery:   { n: '조림장', t: 1, size: 2, cat: 'gather', w: 2, out: { wood: 4 }, desc: '묘목을 키우고 울타리에 나무 심기: 목재는 근처에 숲이 없어도 사용할 수 있지만 속도가 느립니다. 근처의 나무가 다 베어졌을 때에도 의지했어요.', cost: { wood: 40, stone: 15 }, syn: ['lumber', 'sawmill'] },
  quarry:    { n: '채석장', t: 1, size: 2, cat: 'gather', w: 2, gather: ['rock'], out: { stone: 5 }, reach: 3, desc: '근처의 잔돌 더미를 채굴하세요.', cost: { wood: 30 }, syn: ['warehouse'] },
  hunter:    { n: '사냥꾼 오두막', t: 1, size: 2, cat: 'gather', w: 2, gather: ['herd'], out: { game: 5 }, reach: 4, desc: '근처 사냥터에서 사냥을 합니다.', cost: { wood: 25 }, syn: ['kitchen'] },
  sawmill:   { n: '제재소', t: 1, size: 2, cat: 'make', w: 2, in: { wood: 6 }, out: { plank: 3 }, desc: '목재를 목판으로 보았습니다.', cost: { wood: 50, stone: 20 }, syn: ['lumber'] },
  kitchen:   { n: '부엌', t: 1, size: 2, cat: 'make', w: 2, in: { game: 4 }, out: { food: 8 }, desc: '생고기를 요리로 바꾸면 모두가 이에 의존합니다.', cost: { wood: 40, stone: 15 }, syn: ['hunter', 'tent'] },
  warehouse: { n: '창고', t: 1, size: 2, cat: 'core', w: 3, store: 500, haul: true, desc: '소모품을 보관하십시오. 일자리에 탑승한 사람은 운반꾼이며, 여기에서 출발하여 물품을 배달하고 픽업합니다. 생산 영역 중앙에 배치하면 대부분의 단계가 절약됩니다.', cost: { wood: 60, stone: 30 } },
  tower:     { n: '화살탑', t: 1, size: 1, cat: 'defense', w: 1, power: 10, desc: '들어오는 눈늑대 및 약탈자를 자동으로 촬영합니다. 업그레이드가 더 강력합니다.', cost: { wood: 30, stone: 30 }, syn: ['tower'] },
  workshop:  { n: '공학 작업장', t: 1, size: 2, cat: 'core', w: 3, research: 1, desc: '기술자 여기 연구 신기술이 있습니다. 일자리의 레벨이 높을수록 사람이 많을수록 연구의 속도가 빨라집니다.', cost: { wood: 80, stone: 40, plank: 30 } },
  kennel:    { n: '썰매견 사육장', t: 1, size: 2, cat: 'core', w: 2, dogs: 4, feed: 0.5, desc: '썰매 개 키우기: 개 주인은 매일 생고기에게 먹이를 주고 훈련시킵니다. 개가 많을수록 이 야영지가 보낸 정찰대가 더 빨리 달릴수록 연결된 도로에 더 많은 운송 수단이 운반되고 야영지에서 뛰어다니는 개들도 있을 것입니다.', cost: { wood: 60, plank: 20 }, syn: ['hunter'] },
  scout:     { n: '정찰 막사', t: 1, size: 2, cat: 'core', w: 0, desc: '정찰대를 안개로 보내고 자원, 생존자, 폐허 및 랜드마크를 발견하세요. 레벨이 높을수록 더 많은 팀과 동시에 보낼 수 있는 내한성이 늘어납니다.', cost: { wood: 80, plank: 30 } },
  sledshed:  { n: '썰매 헛간', t: 1, size: 2, cat: 'core', w: 2, desc: '북상을 만드는 데 사용된 썰매는 증기 협곡의 경우 증기 트레일러를 만드는 데에도 사용할 수 있습니다. 더 많은 사람을 보내고 레벨이 높을수록 더 빨리 건설할 수 있습니다. 완성차는 행렬에 속하며 본영을 따릅니다.', cost: { wood: 80, plank: 30 } },
  guildpost: { n: '상회 역참', t: 2, size: 2, cat: 'core', w: 1, desc: '북방 상회의 스테이션: 상회의 행렬이 매일 와서 새로운 가격과 주문을 가져옵니다. 은화와 교환하여 상품을 판매하고, 주문을 받고, 은화를 사용하여 상회의 장식 및 잔불을 구매할 수 있습니다. 건축 자재가 부족할 때 비상용품을 높은 가격에 구입할 수도 있습니다.', cost: { plank: 120, iron: 40 } },

  coalmine:  { n: '탄광', t: 2, size: 2, cat: 'gather', w: 3, gather: ['coal'], out: { coal: 5 }, reach: 3, desc: '채굴용 석탄층, 석탄은 연료로 목재보다 연소에 대한 저항력이 3배 더 높습니다.', cost: { wood: 120, plank: 40, stone: 60 }, syn: ['smelter', 'coker'] },
  ironmine:  { n: '철광산', t: 2, size: 2, cat: 'gather', w: 3, gather: ['ore'], out: { ore: 5 }, reach: 3, desc: '채굴 철광맥.', cost: { wood: 120, plank: 40, stone: 60 }, syn: ['smelter'] },
  smelter:   { n: '제련로', t: 2, size: 2, cat: 'make', w: 3, in: { ore: 3, coal: 1 }, out: { iron: 2 }, desc: '석탄에 철광석을 추가하여 철괴를 만듭니다.', cost: { stone: 120, plank: 60 }, syn: ['ironmine', 'coalmine', 'steelworks'] },
  infirmary: { n: '진료소', t: 2, size: 2, cat: 'live', w: 2, beds: 4, desc: '병원 진료를 중앙 집중화합니다. 밖이 춥고 병원이 빡빡하더라도 병상에 있는 사람들은 나아질 수 있으며 다행히도 더 빨리 회복될 것입니다. 사람들이 그들을 지켜보면 병원에 있는 사람들 중 병에 걸리는 사람이 줄어들 것입니다. 더 나은 결과를 얻으려면 의사를 보내십시오.', cost: { wood: 80, plank: 60, stone: 40, iron: 15 }, syn: ['tent'] },
  coker:     { n: '코크스 공방', t: 2, size: 2, cat: 'make', w: 2, in: { coal: 4 }, out: { coke: 1.5 }, desc: '석탄을 코크스 덩어리로 누르세요: 동일한 석탄, 더 많은 열을 태워보세요.', cost: { stone: 100, plank: 50, iron: 10 }, syn: ['coalmine'] },

  limequarry:{ n: '석회석 채석장', t: 3, size: 2, cat: 'gather', w: 3, gather: ['lime'], out: { lime: 5 }, reach: 3, desc: '채굴 석회암층.', cost: { plank: 120, iron: 40 }, syn: ['steelworks'] },
  steelworks:{ n: '제강소', t: 3, size: 2, cat: 'make', w: 4, in: { iron: 2, lime: 1, coal: 1 }, out: { steel: 2 }, desc: '철괴, 석회석 및 석탄은 강재로 정제됩니다.', cost: { stone: 200, iron: 80 }, syn: ['smelter', 'limequarry', 'gearworks'] },
  gearworks: { n: '톱니바퀴 공장', t: 3, size: 2, cat: 'make', w: 3, in: { steel: 1 }, out: { gear: 2 }, desc: '강재가공은 톱니바퀴가 됩니다.', cost: { iron: 100, steel: 20 }, syn: ['steelworks', 'engineworks'] },
  engineworks:{ n: '증기기관 공장', t: 3, size: 2, cat: 'make', w: 4, in: { gear: 2, steel: 1 }, out: { engine: 1 }, desc: '용광로, 철도 및 자동화업그레이드와 함께 사용하려면 증기기관을 조립하세요.', cost: { iron: 120, steel: 40, gear: 20 }, syn: ['gearworks'] },
  greenhouse:{ n: '증기 온실', t: 3, size: 2, cat: 'make', w: 3, in: { coal: 1.5 }, out: { food: 9 }, desc: '증기를 사용하면 따뜻함을 유지하고 야채를 재배할 수 있으므로 더 이상 먹이 사냥에만 의존할 필요가 없습니다.', cost: { steel: 40, iron: 80, plank: 100 }, syn: ['tent', 'kitchen'] },
  heater:    { n: '증기 난로', t: 3, size: 1, cat: 'live', w: 1, heat: 4, hreach: 4, burn: 1.5, desc: '석탄을 태워 야영지 전체를 가열하고 주변 4블록 내에서 건설 영역을 확장합니다.', cost: { iron: 60, steel: 20, gear: 10 } },

  shalepit:  { n: '오일셰일 광산', t: 4, size: 2, cat: 'gather', w: 4, gather: ['shale'], out: { shale: 5 }, reach: 3, desc: '동토에서 오일셰일 채굴.', cost: { steel: 100, gear: 40 }, syn: ['refinery'] },
  refinery:  { n: '정유소', t: 4, size: 2, cat: 'make', w: 4, in: { shale: 3, coal: 1 }, out: { tar: 3 }, desc: '오일셰일은 타르로 정제됩니다.', cost: { steel: 120, gear: 40, engine: 5 }, syn: ['shalepit', 'sealworks'] },
  sealworks: { n: '밀봉 부품 공장', t: 4, size: 2, cat: 'make', w: 3, in: { tar: 2, steel: 1 }, out: { seal: 2 }, desc: '타르, 강재는 밀봉 부품으로 제작됩니다.', cost: { steel: 150, engine: 8 }, syn: ['refinery'] },

  crystalmine:{ n: '서리수정 광산', t: 5, size: 2, cat: 'gather', w: 4, gather: ['crystal'], out: { crystal: 4 }, reach: 3, desc: '채집서리수정 군락, 깊고 추운 곳에서만 발견됩니다.', cost: { steel: 200, seal: 40 }, syn: ['batteryworks'] },
  batteryworks:{ n: '배터리 공방', t: 5, size: 2, cat: 'make', w: 4, in: { crystal: 2, iron: 1 }, out: { battery: 2 }, desc: '서리수정은 철제 껍질에 밀봉되어 수정 배터리로 만들어지며 발열량이 매우 높은 연료입니다.', cost: { steel: 200, seal: 50, engine: 10 }, syn: ['crystalmine', 'alloyworks'] },
  alloyworks:{ n: '합금 공장', t: 5, size: 2, cat: 'make', w: 4, in: { crystal: 1, steel: 1, battery: 1 }, out: { alloy: 1.5 }, desc: '항온 합금: Deep Cold Outpost 및 고급 업그레이드에 필요합니다.', cost: { steel: 250, seal: 60, battery: 20 }, syn: ['batteryworks'] },

  salvage:   { n: '잔해 해체장', t: 6, size: 2, cat: 'gather', w: 5, gather: ['star'], out: { star: 4 }, reach: 3, desc: '고대 잔해에서 성철을 제거합니다.', cost: { steel: 300, alloy: 40 }, syn: ['partworks'] },
  partworks: { n: '부품 공방', t: 6, size: 2, cat: 'make', w: 5, in: { star: 3, alloy: 1 }, out: { part: 1.5 }, desc: '성철 및 합금 회수 고대 부품.', cost: { seal: 120, alloy: 60 }, syn: ['salvage', 'coreworks'] },
  coreworks: { n: '오토마톤 공방', t: 6, size: 2, cat: 'make', w: 5, in: { part: 2, battery: 2 }, out: { core: 0.5 }, desc: '오토마톤 코어를 조립하세요.', cost: { alloy: 100, part: 30 }, syn: ['partworks', 'bay'] },
  bay:       { n: '오토마톤 격납고', t: 6, size: 2, cat: 'live', w: 0, bots: 8, desc: '먹지도 않고, 추위를 두려워하지 않고, 아프지도 않는 오토마톤을 깨우려면 오토마톤 코어를 설치하세요(핵심 각 2대, 1.5명 수용 가능). 창고에 어떤 모델을 만들 것인지 선택하세요.', cost: { alloy: 80, part: 40 } },

  excavator: { n: '노심 발굴장', t: 7, size: 2, cat: 'gather', w: 6, gather: ['shard'], out: { shard: 3 }, reach: 3, desc: '영원의 용광로 주변에서 노심 조각을 발견하세요.', cost: { alloy: 200, part: 80 }, syn: ['forge'] },
  // 永恒之炉以北：走到对应的那一程才能建
  beacon:    { n: '신호 등탑', t: 7, stage: 7, size: 2, cat: 'core', w: 2, reveal: 26, desc: '탑 꼭대기에 있는 큰 빛은 주변의 넓은 안개 지역을 비춘다(건축되자마자 빛나고, 레벨업하면 4블록 더 멀어진다). 빛을 유지하려면 두 사람이 필요합니다.', cost: { alloy: 120, part: 40, battery: 30 } },
  colossus:  { n: '거상 수호자', t: 7, stage: 10, size: 3, cat: 'defense', w: 4, power: 0, guardCd: 3600, desc: '얼어붙은 거상에 따라 제작된 스톤 가드입니다. 사람을 보내면 습격을 내내 차단할 수 있으며 그 후 한 시간 동안 휴식을 취해야 합니다(업그레이드는 더 짧게 휴식합니다).', cost: { alloy: 300, part: 120, core: 6 } },
  starpit:   { n: '별핵 광산', t: 7, stage: 11, size: 2, cat: 'gather', w: 6, gather: ['starfall'], out: { starcore: 2 }, reach: 3, desc: '보라색 빛을 방출하는 별핵은 별이 떨어진 구덩이의 피트 바닥에 깎여져 있습니다. 용광로는 레벨 35 이후 업그레이드에서 사용해야 합니다.', cost: { alloy: 260, part: 100, core: 4 } },
  // 北境地貌才能建的（rule：只有在这种地貌的站、主营地里才能建）
  pyre:      { n: '봉화탑', t: 7, tower: 1, size: 3, cat: 'core', w: 0, desc: '북방 각 스테이션에는 봉화탑이 있습니다. 모든 기초 재료가 공급된 후 세워 두십시오. 타워 본체에는 계속해서 고급 재료를 공급해야 합니다. 가득 차면 연료로 바꿔서 불을 붙입니다. 이 야영지희망 +5, 난방권 +1을 켜면 광선이 항상 켜져서 뒤에 있는 사람들을 안내합니다.', cost: { steel: 600, alloy: 200, part: 120 } },
  skyfire:   { n: '천화탑', t: 7, tower: 10, size: 4, cat: 'core', w: 0, desc: '북방 10번째 스테이션의 마지막 탑: 6가지 고급 재료를 함께 공급하세요. 가득 차면 별핵을 돌려 점화합니다. 불이 켜진 순간, 10개의 빛줄기가 남쪽을 향해 다시 영원의 용광로로 향했다. 점등 후 이 야영지희망 +5, 난방권 +1입니다.', cost: { steel: 1500, alloy: 500, part: 300, core: 20 } },
  geowell:   { n: '지열정', t: 5, rule: 'geo', size: 2, cat: 'live', w: 1, heat: 5, hreach: 5, desc: '지하에서 구동되는 온천: 태우지 않고 전체 지역을 가열할 수 있으며 주변 5블록 이내의 지역을 확장할 수 있습니다. 지열 골짜기만이 싸울 수 있습니다.', cost: { steel: 120, gear: 30, alloy: 20 } },
  icefish:   { n: '얼음낚시 오두막', t: 5, rule: 'lakes', size: 2, cat: 'gather', w: 2, gather: ['fish'], out: { food: 6 }, reach: 3, desc: '얼음에 구멍을 뚫어 낚시하면 생선을 구워서 먹을 수 있습니다. 요리는 부엌 없이 직접 생산됩니다. 얼음낚시터 옆에 건설하려면 얼음호수 지대에만 있습니다.', cost: { plank: 80, steel: 30 }, syn: ['tent', 'kitchen'] },
  forge:     { n: '노심 단조소', t: 7, size: 2, cat: 'make', w: 6, in: { shard: 3, part: 2, alloy: 2 }, out: { heart: 0.6 }, desc: '영원의 용광로 부품을 제작하고 이를 사용하여 영원의 용광로를 다시 점화하세요.', cost: { alloy: 250, part: 120, core: 5 }, syn: ['excavator'] },

  // 装饰：不产东西，让营地好看一点、大家心里亮一点（希望）。同一座营地的装饰合计最多 +16 希望
  lamp:      { n: '가로등', t: 1, size: 1, cat: 'deco', w: 0, hope: 1, desc: '밤에 야영지의 길을 밝히기 위해 철제 기둥에 기름등이 걸려 있습니다. 장식: 희망 +1, 업그레이드 이후 더 밝아집니다.', cost: { wood: 20, stone: 10 } },
  flagpole:  { n: '깃대', t: 1, size: 1, cat: 'deco', w: 0, hope: 1.5, desc: '야영지에 깃발을 꽂으면 멀리서도 집이 어디인지 알 수 있습니다. 장식: 희망 +1.5.', cost: { wood: 40, plank: 10 } },
  statue:    { n: '선구자 동상', t: 2, size: 1, cat: 'deco', w: 0, hope: 3, desc: '최초로 북쪽으로 걸어간 사람들을 기념하는 횃불을 들고 있는 인물. 장식: 희망 +3.', cost: { stone: 150, plank: 30, iron: 20 } },
  flowerhouse:{ n: '꽃 저장고', t: 3, size: 2, cat: 'deco', w: 1, hope: 4.5, desc: '꽃 지하실은 난방을 통해 자라며 얼음과 눈 속에서 약간의 색을 띠게 됩니다. 정원사에게 돌봐달라고 부탁하세요. 장식: 희망 +4.5.', cost: { wood: 120, stone: 60, steel: 20 } },
  // 第十三版：八种北境装饰，成就解锁（gift: 1），和别的装饰一起算在 +16 希望的上限里
  icesculpt: { n: '얼음 조각상', t: 1, size: 1, cat: 'deco', w: 0, hope: 2, gift: 1, desc: '얼음호수로 잘라낸 얼음은 날개를 펼친 백조의 형상을 하고 있으며, 그 위에 태양이 밝게 빛난다. 장식: 희망 +2.', cost: { stone: 60, plank: 20 } },
  windchime: { n: '오로라 풍경', t: 1, size: 1, cat: 'deco', w: 0, hope: 2, gift: 1, desc: '나무 프레임에는 형형색색의 파이프가 줄지어 매달려 있는데, 바람에 짤랑거리며 밤에는 오로라처럼 빛납니다. 장식: 희망 +2.', cost: { plank: 40, steel: 10 } },
  snowman: { n: '눈사람', t: 1, size: 1, cat: 'deco', w: 0, hope: 1.5, gift: 1, desc: '아이의 눈사람: 석탄은 공눈, 당근 코를 가지고 있으며 낡은 빨간색 스카프를 착용하고 있습니다. 장식: 희망 +1.5.', cost: { wood: 10 } },
  lanterns: { n: '등롱 줄', t: 1, size: 2, cat: 'deco', w: 0, hope: 2.5, gift: 1, desc: '축제와 마찬가지로 두 개의 나무 기둥 사이에 붉은 등불이 늘어져 있습니다. 장식: 희망 +2.5.', cost: { plank: 60, wood: 40 } },
  deerstatue: { n: '순록 동상', t: 1, size: 1, cat: 'deco', w: 0, hope: 3, gift: 1, desc: '머리를 높이 들고 있는 순록 동상은 길을 따라 수레를 끌었던 동료들을 기념합니다. 장식: 희망 +3.', cost: { stone: 120, iron: 40 } },
  wolfrug: { n: '늑대왕 가죽', t: 1, size: 1, cat: 'deco', w: 0, hope: 3, gift: 1, desc: '기연에서 패배한 늑대왕은 나무 프레임에 털을 늘어뜨려 용광로 곁에 매달아 두었습니다. 아이 사람들은 지나갈 때마다 만져보고 싶어합니다. 장식: 희망 +3.', cost: { plank: 40, stone: 30 } },
  // 1.1 奇观：只在「建造 › 奇观」里选址，不在普通建筑列表里
  wcolossus: { n: '증기 거상', t: 7, size: 4, cat: 'wonder', w: 0, wonder: 1, desc: '양철은 몇 층 높이의 거인으로, 가슴 부분에서 보일러가 타오르고 관절에서 하얀 증기가 뿜어져 나옵니다. 야영지 옆에 서 있던 늑대들은 멀리서 그것을 보고 뒤를 돌아보았다.', cost: { stone: 600, plank: 400, steel: 300 } },
  wvault: { n: '만년 얼음창고', t: 7, size: 4, cat: 'wonder', w: 0, wonder: 1, desc: '동토에 반쯤 묻혀 있는 돔형 얼음 저장고에는 철제 문과 끝없이 늘어선 선반이 있습니다. 이것저것 넣으면 만년이 지나도 깨지지 않습니다.', cost: { stone: 600, plank: 400, steel: 300 } },
  wbeacon: { n: '꺼지지 않는 등대', t: 7, size: 4, cat: 'wonder', w: 0, wonder: 1, desc: '돌로 만든 높은 탑, 꼭대기에 절대 꺼지지 않는 큰 등불이 있어 열과 빛을 주위로 보냅니다.', cost: { stone: 600, plank: 400, steel: 300 } },
  waurora: { n: '오로라 탑', t: 7, size: 4, cat: 'wonder', w: 0, wonder: 1, desc: '가느다란 첨탑은 여러 원을 그리며 탑 주위를 천천히 회전하며 하늘의 별들을 끌어당겨 내려옵니다.', cost: { stone: 600, plank: 400, steel: 300 } },
  wterminal: { n: '철도 중앙역', t: 7, size: 4, cat: 'wonder', w: 0, wonder: 1, desc: '아치형 지붕, 큰 시계, 여기에서 각 시계까지 뻗어 있는 여러 개의 시계가 있는 큰 역 건물이 있습니다.', cost: { stone: 600, plank: 400, steel: 300 } },
  wstarforge: { n: '별의 용광로', t: 7, size: 4, cat: 'wonder', w: 0, wonder: 1, desc: '거대한 용광로와 여러 개의 별핵이 용광로 입구를 중심으로 회전했고, 보라색 불빛이 하늘의 절반을 비췄습니다.', cost: { stone: 600, plank: 400, steel: 300 } },
  bonearch: { n: '거수 뼈 아치문', t: 1, size: 2, cat: 'deco', w: 0, hope: 4, gift: 1, desc: '동토에서 파낸 두 개의 거대한 짐승 엄니는 두개골이 위쪽에 있는 아치를 형성했습니다. 장식: 희망 +4.', cost: { stone: 200, plank: 60 } },
  pyremem: { n: '봉화 기념비', t: 1, size: 1, cat: 'deco', w: 0, hope: 3.5, gift: 1, desc: '긴 불이 켜진 철제 ​​화로가 꼭대기에 있는 작은 돌 기념물은 불이 켜진 모든 봉화탑을 기억합니다. 장식: 희망 +3.5.', cost: { stone: 300, steel: 60 } },
  skymem: { n: '천화 기념비', t: 1, size: 2, cat: 'deco', w: 0, hope: 5, gift: 1, desc: '높은 오벨리스크의 꼭대기에는 금색 불의 공과 별 수정이 있고, 네 모퉁이에 있는 화로는 항상 불타고 있습니다. 천화에 불을 붙인 사람만이 이를 감당할 수 있습니다. 장식: 희망 +5.', cost: { stone: 500, steel: 150, alloy: 30 } },
  // 1.1 北方商会的六种装饰：在商会用银币买下图纸（一直有效），再照常花材料盖；和别的装饰一起算在 +16 希望的上限里
  gbench:  { n: '철제 벤치', t: 1, size: 1, cat: 'deco', w: 0, hope: 1.5, shop: 300, desc: '검은 철제 꽃꽂이가 있는 벤치와 그 뒤에 작은 램프가 있습니다. 일을 마친 사람들은 자리에 앉아 휴식을 취했습니다. 장식: 희망 +1.5.', cost: { plank: 30, iron: 20 } },
  glamp:   { n: '유리 등주', t: 1, size: 1, cat: 'deco', w: 0, hope: 2, shop: 500, desc: '상회 남쪽에서 가져온 색유리 갓과 주철 가로등 기둥이 밤이면 따뜻한 빛의 원을 이룬다. 장식: 희망 +2.', cost: { iron: 30, stone: 20 } },
  gsled:   { n: '채색 썰매', t: 1, size: 2, cat: 'deco', w: 0, hope: 2.5, shop: 800, desc: '아이가 올라갈 수 있도록 선물 상자로 가득 찬 빨간색과 금색으로 칠해진 오래된 캐러밴이 길가에 배치되었습니다. 장식: 희망 +2.5.', cost: { plank: 60, wood: 40 } },
  gbell:   { n: '상회 청동 종', t: 1, size: 1, cat: 'deco', w: 0, hope: 3, shop: 1200, desc: '나무 틀에 상회 청동종이 걸려 있는데, 행렬이 야영지에 들어가면 세 번 친다. 장식: 희망 +3.', cost: { plank: 50, iron: 40 } },
  ggate:   { n: '상회 깃발문', t: 1, size: 2, cat: 'deco', w: 0, hope: 3.5, shop: 2000, desc: '다채로운 깃발로 덮인 두 개의 나무 기둥이 "북방 상회"라고 적힌 수평 명판을 지지합니다. 장식: 희망 +3.5.', cost: { plank: 80, iron: 30 } },
  gfount:  { n: '얼음수정 분수', t: 1, size: 2, cat: 'deco', w: 0, hope: 4, shop: 3200, desc: '돌로 만든 둥근 웅덩이, 중앙의 물이 공중으로 분사되면서 얼어붙어 얼음꽃이 되고, 그 아래에는 따뜻한 램프가 비춰준다. 장식: 희망 +4.', cost: { stone: 120, iron: 40, plank: 40 } },
};
export const BLD_KEYS = Object.keys(BLD);
export const CATS = { core: '핵심', live: '주거', gather: '채집', make: '가공', defense: '방어', deco: '장식', wonder: '불가사의' };

// 熔炉参数
export function furnaceHeat(lvl) { return 10 + 5 * lvl; }
export function furnaceRadius(lvl) { return Math.min(15, 6 + Math.ceil(lvl / 2)); } // 供热圈：6 + 等级的一半，最大 15 格（地盘是要规划的）
// 燃料单位/分钟：每级多烧 17%，跟着换燃料每分钟烧的个数一直在 2 到 7 个；27 级以后改成每级 +8%，远方几程不用每分钟烧几十块电池
export function furnaceBurn(lvl) { return 2.2 * Math.pow(1.17, Math.min(lvl, 27) - 1) * Math.pow(1.08, Math.max(0, lvl - 27)); }

// 专家
export const SPECS = [
  { id: 'lin',   n: '림 영감',   role: '럼버 재킷',   aff: ['lumber', 'sawmill'], row: 22,  story: '잿빛 야영지 외곽의 숲에서 혼자 겨울을 보내는 늙은 나무꾼.' },
  { id: 'xue',   n: '아설',   role: '사냥꾼',     aff: ['hunter', 'kitchen'], row: 36,  story: '길 잃은 눈사슴을 쫓는 젊은 사냥꾼.' },
  { id: 'zhou',  n: '석장 주', role: '석공',     aff: ['quarry', 'limequarry'], row: 48, story: '그는 그 돌이 파야 할 곳을 알려줄 것이라고 말했습니다.' },
  { id: 'mei',   n: '매 아주머니',   role: '수석 요리사',   aff: ['kitchen', 'tent'], row: 70,  story: '그녀의 냄비는 결코 뜨거워지지 않습니다.' },
  { id: 'xiong', n: '큰곰',   role: '갱부',     aff: ['coalmine', 'ironmine'], row: 62, story: '철령 광산이 무너진 후 유일하게 기어나온 사람.' },
  { id: 'nova',  n: '노바',   role: '대장장이',     aff: ['smelter', 'coker', 'steelworks'], row: 88, story: '조상 철 망치북상을 운반합니다.' },
  { id: 'yan',   n: '제비',   role: '정찰 군인',   aff: ['scout'], row: 30,  story: '앞서 걷는 이들의 발자국은 언제나 바람과 눈에 가장 먼저 뒤덮인다.' },
  { id: 'erin',  n: '아이린',   role: '용광로 기술자', aff: ['furnace', 'heater'], row: 118, story: '증기 협곡 파이프라인 스테이션의 마지막 근무자입니다.' },
  { id: 'vic',   n: '빅',   role: '정비공',   aff: ['gearworks', 'engineworks', 'warehouse'], row: 132, story: '세 개의 톱니바퀴로 무엇이든 고칠 수 있습니다.' },
  { id: 'tieya', n: '쇠이빨',   role: '경비대장',   aff: ['tower'], row: 98,  story: '그는 혼자서 7일 동안 늑대들에게 둘러싸인 전초기지를 지켰습니다.' },
  { id: 'batu',  n: '바투',   role: '정제기',   aff: ['shalepit', 'refinery', 'sealworks'], row: 168, story: '그는 동토 아래에 기름이 있는지 냄새를 맡을 수 있었습니다.' },
  { id: 'liya',  n: '리아',   role: '크리스탈 학자', aff: ['crystalmine', 'batteryworks', 'alloyworks'], row: 222, story: '연구서리수정 20년 동안 손가락이 파랗게 변할 정도로 차가웠어요.' },
  { id: 'mo',    n: '묵 선생', role: '고생물학자', aff: ['salvage', 'partworks', 'coreworks'], row: 276, story: '그는 잔해에 적힌 글을 읽을 수 있었습니다.' },
  { id: 'he',    n: '허 의원', role: '의사',     aff: ['infirmary'], row: null, story: '나는 수십 년 동안 남쪽의 한 마을에서 의료 활동을 해왔습니다. 북쪽에서 누군가 난로를 피우고 있다는 소식을 듣고 약 상자를 등에 지고 여기까지 왔어요.' },
  { id: 'luyu',  n: '용광로 예언자', role: '용광로지기',   aff: ['excavator', 'forge', 'furnace'], row: 318, story: '영원의 용광로 사람들은 누군가가 불을 다시 가져오기를 기다리며 여러 세대에 걸쳐 지켜보고 있습니다.' },
];
export const SPEC_MAX = 6; // 对口专家 6 级 = +100%，到顶
export function specBonus(lvl, matched) { return Math.min(1, matched ? 0.5 + 0.12 * (lvl - 1) : 0.15 + 0.03 * (lvl - 1)); }
export function specTrainCost(lvl) {
  const g = GATE[Math.min(7, 1 + Math.floor(lvl / 2))];
  return { food: Math.round(60 * Math.pow(lvl, 1.6)), [g]: Math.round(15 * Math.pow(1.5, lvl - 1)) };
}

// 余烬永久强化
export const EMBER_UPS = {
  heat:    { n: '잔열',   d: '모두용광로온도 +3°C',           base: 3,  grow: 1.55, max: 20 },
  prod:    { n: '손재주',   d: '전체생산 +4%',                base: 4,  grow: 1.6,  max: 15 },
  haul:    { n: '쾌보',   d: '운반꾼 및 정찰대 속도 +12%',     base: 3,  grow: 1.55, max: 20 },
  thrift:  { n: '검약',   d: '건설 및 업그레이드 비용 -4%',          base: 5,  grow: 1.7,  max: 12 },
  people:  { n: '인망',   d: '시작시와 정류장마다 3명이 추가되며, 탈주속도 +15%',  base: 3,  grow: 1.5,  max: 20 },
  supply:  { n: '보따리',   d: '공급을 +50% 시작하고 각 정류장에서 추가 목재, 요리, 석재를 받으세요.',               base: 2,  grow: 1.5,  max: 20 },
  reserve: { n: '풍요',   d: '자원 포인트 보유량 +15%',             base: 4,  grow: 1.6,  max: 20 },
  sight:   { n: '먼눈',   d: '정찰의 비전 +1 그리드, 정찰은 내한성에 가깝습니다.',   base: 4,  grow: 1.7,  max: 10 },
  guard:   { n: '견벽',   d: '화살탑 전력 +15%',               base: 3,  grow: 1.55, max: 20 },
  hardy:   { n: '내한성',   d: '주민내한성 +2°C',               base: 4,  grow: 1.6,  max: 15 },
};
export function emberCost(key, lvl) { const u = EMBER_UPS[key]; return Math.round(u.base * Math.pow(u.grow, lvl)); }

// 袭营敌人（按纬度带）
export const RAIDERS = [null, '눈늑대 무리', '눈늑대 무리', '약탈자', '약탈자', '서리 짐승', '유적 수호자', '유적 수호자'];

export const STORY = {
  intro: '겨울을 맞아 세상이 꽁꽁 얼었습니다. 전설에 따르면 북쪽 끝에는 영원히 꺼지지 않는 용광로, 「영원의 용광로」가 있다고 합니다. 각 세대에는 북상 여정이 있으며, 그 과정에서 모닥불을 시작하고 잔불을 남겨두고 뒤따르는 사람들이 더 멀리 갈 수 있도록 합니다.',
  migrate: '모닥불은 꺼지지만 잔불은 여전히 남아 있습니다. 그들과 동료들을 데리고 북쪽의 다음 야영지로 가세요.',
  trueEnd: '행렬이 세계의 척추에 오르던 날, 바람이 멈췄습니다. 뒤를 돌아보면 길을 따라 모닥불이 가는 빛의 선을 이루며 잿빛 야영지부터 발끝까지 쭉 빛나고 있었다. 북쪽으로 가는 길은 사람이 다니지 않습니다. 하지만 우리는 이미 그 길을 알고 있습니다.',
  ending: '영원의 용광로가 다시 불붙었습니다. 불은 당신이 남긴 야영지를 따라 남쪽으로 번졌고, 빙원에서는 처음으로 물이 녹는 소리가 들렸습니다. 여행은 끝났지만 이 용광로는 계속 타오를 것입니다.',
  skyEnd: '천화탑에 불이 붙은 순간, 빛의 광선이 구름 속으로 돌진했습니다. 남쪽으로는 영원의 용광로까지 9개의 등불이 차례로 켜졌다. 그것이 우리가 택한 길이었다. 나중에 누군가 북쪽으로 걸어가면 위를 올려다보면 방향을 알 수 있다.',
};

// ---------- 昼夜（只影响画面，不影响产出） ----------
export const DAY_LEN = 720; // 一昼夜 12 分钟
const ss = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
export function dayCycle(t) {
  const p = ((t / DAY_LEN) % 1 + 1) % 1;
  const nf = ss(0.5, 0.62, p) - ss(0.9, 1, p); // 0 白天 → 1 深夜
  const dw = Math.max(0, 1 - Math.abs(p - 0.56) / 0.08) + Math.max(0, 1 - Math.abs(p - 0.95) / 0.07) * 0.7; // 黄昏/黎明的暖色
  const ph = p < 0.5 ? ['☀️', '낮', 0.5] : p < 0.62 ? ['🌇', '해질녘', 0.62] : p < 0.9 ? ['🌙', '밤', 0.9] : ['🌅', '새벽', 1];
  return { p, nf, dw, icon: ph[0], name: ph[1], left: (ph[2] - p) * DAY_LEN };
}

// 难度：开新的一局时选，北迁也保留；游戏里随时能在菜单里改
export const DIFF = {
  easy: { n: '쉬움', ic: '🌤', d: '덜 먹고, 덜 태우고, 눈보라와 Wolf Pack은 약하고, 건설은 10% 저렴하고, 모두가 기분이 좋아집니다. 느린 작동에 적합합니다.', eat: 0.8, fuel: 0.8, cold: 0.7, raid: 0.6, cost: 0.9, hope: 6, ember: 0.8 },
  std: { n: '표준', ic: '🔥', d: '원래 추운 겨울.', eat: 1, fuel: 1, cold: 1, raid: 1, cost: 1, hope: 0, ember: 1 },
  hard: { n: '혹독', ic: '❄', d: '더 많이 먹고 더 많이 태우십시오. 눈보라는 더 차갑고 늑대는 더 사나우며, 건설은 10% 더 비싸고, 민심은 안정화하기가 더 어렵습니다. 북상은 잔불을 30% 더 많이 가져올 것입니다.', eat: 1.2, fuel: 1.15, cold: 1.25, raid: 1.4, cost: 1.1, hope: -6, ember: 1.3 },
};
export const DIFF_KEYS = ['easy', 'std', 'hard'];
export const SLOTS = 3; // 存档位

// 营地专精：熔炉 5 级后每座营地选一个方向，强一样、弱一样；换专精要等 30 分钟
const MINES = ['quarry', 'coalmine', 'ironmine', 'limequarry', 'shalepit', 'crystalmine', 'salvage', 'excavator', 'starpit'];
const FOODS = ['hunter', 'kitchen', 'greenhouse'];
export const FOCUS = {
  mine: { n: '광업', ch: '내 거', col: '#7f93ab', d: '채석장, 탄광, 철광석 채굴 건물 생산량 +30%.', bad: '사냥, 부엌, 온실 생산량 −10%', up: MINES, upV: 0.3, down: FOODS, downV: -0.1 },
  farm: { n: '농경', ch: '기르다', col: '#7fa84f', d: '사냥, 부엌, 온실, 벌목, 조림 생산량 +30%, 신규 이민자가 30% 더 빠르게 옵니다, 희망 +4.', bad: '광산 건물 생산량 −10%', up: [...FOODS, 'lumber', 'nursery'], upV: 0.3, down: MINES, downV: -0.1, arrive: 0.3, hope: 4 },
  craft: { n: '공방', ch: '일하다', col: '#d08a3a', d: '제재소, 제강소, 이 가공 공장 생산량 +25%, 연구가 20% 더 빠릅니다.', bad: '채집건물 생산량 −10%', up: 'make', upV: 0.25, down: 'gather', downV: -0.1, rp: 0.2 },
  fort: { n: '요새', ch: '플러그', col: '#b0574a', d: '화살탑의 전력은 50%, 야영지방어는 20%, 눈보라는 냉각 성능이 25%, 불만 −4입니다.', bad: '전체 생산량 −5%', all: -0.05, tower: 0.5, def: 0.2, cold: 0.25, disc: -4 },
};
export const FOCUS_KEYS = ['mine', 'farm', 'craft', 'fort'];
export const FOCUS_LVL = 5, FOCUS_CD = 1800;

// 营地律令：每条都有好处也有代价，对所有营地生效；改过之后 3 分钟内不能再改
export const LAWS = [
  { id: 'overtime', n: '초과근무령', ic: '⏱️', d: '매일 2시간 더 일하세요.', good: '전체 생산량 +15%', bad: '불만 +14 · 병에 걸릴 확률이 높아짐', prod: 0.15, disc: 14, sickIn: 0.004 },
  { id: 'sawdust', n: '톱밥 수프', ic: '🥣', d: '수프에 톱밥을 추가하고 한 냄비를 더 많은 사람들과 공유하세요.', good: '부엌 식사 +25%', bad: '불만 +9 · 희망 −4', kitchen: 0.25, disc: 9, hope: -4 },
  { id: 'ration', n: '배급 절반', ic: '⚖️', d: '각 사람은 하루에 한 끼씩 덜 먹습니다.', good: '요리를 먹음 −30%', bad: '희망 −8 · 불만 +10 · 병에 걸릴 확률이 높아짐', food: -0.3, hope: -8, disc: 10, sickIn: 0.004 },
  { id: 'care', n: '환자식', ic: '🩹', d: '환자는 혼자 작은 난로를 열고 누워서 요양을 한다.', good: '환자는 2.5배 더 좋습니다 · 희망 +5 · 불만 −4', bad: '먹다 요리 +8%', sickRec: 1.5, food: 0.08, hope: 5, disc: -4 },
  { id: 'fires', n: '모닥불의 밤', ic: '🔥', d: '매일 밤 용광로 곁에서 모닥불을 시작하면 모두가 모입니다.', good: '희망 +8 · 불만 −6', bad: '용광로연료 +12%', fuel: 0.12, hope: 8, disc: -6 },
  { id: 'patrol', n: '야간 순찰대', ic: '🛡️', d: '교대로 밤을 순찰하여 질서를 유지하세요.', good: '방어 +25% · 불만 −10', bad: '희망 −3', def: 0.25, disc: -10, hope: -3 },
];
export const LAW_CD = 180;

// 研究：工程站产出研究点数，攒够就完成；开始研究时先付材料
export const TECH_BR = ['생산', '생존', '물류', '자동화', '북방'];
// 自动化、北境两条分支要走到那里才开放；★ 的是解锁新东西的研究
export const TECH_GATE = { 3: { known: 6, why: '정찰이 \"유적 금속\"의 위도에 도달한 후 열림' }, 4: { north: true, why: '북방 지역에 도착하면 개방' } };
// 无尽研究：五条分支全部研究完以后，每一级所有生产 +2%，代价每级 ×1.25，没有上限
export const ENDLESS = { pts: 800, cost: { alloy: 240, part: 120, core: 24 }, mul: 1.25, prod: 0.02 };
export const TECHS = [
  { id: 'axe', br: 0, n: '강철날 도끼', ic: '🪓', t: 1, pts: 12, cost: { wood: 120, stone: 40 }, d: '벌목장, 채석장 생산량 +20%', fx: { bp: { lumber: 0.2, quarry: 0.2 } } },
  { id: 'smoke', br: 0, n: '훈제 건조대', ic: '🍖', t: 1, pts: 15, cost: { wood: 150, plank: 40 }, d: '사냥꾼 오두막、부엌 생산량 +20%', fx: { bp: { hunter: 0.2, kitchen: 0.2 } } },
  { id: 'drill', br: 0, n: '증기 드릴', ic: '⛏️', t: 2, pts: 40, cost: { plank: 150, iron: 60 }, d: '모든 지뢰 생산량 +20%', req: ['axe'], fx: { bp: { coalmine: 0.2, ironmine: 0.2, limequarry: 0.2, shalepit: 0.2, crystalmine: 0.2, salvage: 0.2, excavator: 0.2, starpit: 0.2 } } },
  { id: 'blast', br: 0, n: '송풍로', ic: '🏭', t: 2, pts: 50, cost: { stone: 300, iron: 80 }, d: '제련로, 코크스 공방, 제강소 생산량 +20%', req: ['drill'], fx: { bp: { smelter: 0.2, coker: 0.2, steelworks: 0.2 } } },
  { id: 'lathe', br: 0, n: '정밀 선반', ic: '⚙️', t: 3, pts: 90, cost: { steel: 120, gear: 40 }, d: '톱니바퀴 공장、증기기관 공장、정유소、밀봉 부품 공장 생산량 +20%', req: ['blast'], fx: { bp: { gearworks: 0.2, engineworks: 0.2, refinery: 0.2, sealworks: 0.2 } } },
  { id: 'cryst', br: 0, n: '수정 절단', ic: '💎', t: 5, pts: 220, cost: { seal: 120, crystal: 120 }, d: '배터리, 합금, 부품, 오토마톤 코어, 용광로 부품 생산량 +20%', req: ['lathe'], fx: { bp: { batteryworks: 0.2, alloyworks: 0.2, partworks: 0.2, coreworks: 0.2, forge: 0.2 } } },
  { id: 'felt', br: 1, n: '두꺼운 펠트', ic: '🧶', t: 1, pts: 12, cost: { wood: 100, game: 60 }, d: '천막 따뜻함 +3°', fx: { insul: 3 } },
  { id: 'grate', br: 1, n: '화실 개량', ic: '🔥', t: 1, pts: 20, cost: { stone: 150, plank: 50 }, d: '용광로연료 소모량 -10%', req: ['felt'], fx: { fuel: -0.1 } },
  { id: 'clinic', br: 1, n: '간호학', ic: '🩺', t: 2, pts: 35, cost: { plank: 150, iron: 40 }, d: '환자는 속도가 두 배 더 빠릅니다 · 희망 +3', req: ['felt'], fx: { sickRec: 1, hope: 3 } },
  { id: 'pipes', br: 1, n: '난방 관망', ic: '♨️', t: 3, pts: 70, cost: { steel: 80, gear: 30 }, d: '증기 난로열 +40%', req: ['grate'], fx: { heater: 0.4 } },
  { id: 'glass', br: 1, n: '온실 조명', ic: '🌱', t: 3, pts: 80, cost: { steel: 100, engine: 6 }, d: '증기 온실 생산량 +25%', req: ['pipes'], fx: { bp: { greenhouse: 0.25 } } },
  { id: 'steamheat', br: 1, n: '증기 난방', ic: '🏠', t: 4, pts: 140, cost: { steel: 200, seal: 60 }, d: '천막은 +5°로 따뜻하게 유지됩니다.', req: ['glass'], fx: { insul: 5 } },
  { id: 'sled', br: 2, n: '경량 썰매', ic: '🛷', t: 1, pts: 15, cost: { wood: 150, plank: 40 }, d: '운반꾼이 15% 더 빨라집니다.', fx: { haul: 0.15 } },
  { id: 'shelf', br: 2, n: '선반', ic: '📦', t: 1, pts: 18, cost: { wood: 200, plank: 60 }, d: '저장량 상한 +20%', req: ['sled'], fx: { cap: 0.2 } },
  { id: 'scope', br: 2, n: '망원경', ic: '🔭', t: 2, pts: 30, cost: { plank: 120, iron: 40 }, d: '정찰대가 25% 더 빨라집니다.', req: ['sled'], fx: { scout: 0.25 } },
  { id: 'xbow', br: 2, n: '연노', ic: '🏹', t: 2, pts: 40, cost: { plank: 100, iron: 80 }, d: '방어 +25%', req: ['shelf'], fx: { def: 0.25 } },
  { id: 'rail', br: 2, n: '철길 전환', ic: '🛤️', t: 4, pts: 120, cost: { steel: 200, engine: 10 }, d: '물류망 모든 도로 운송 능력 +30%', req: ['xbow'], fx: { line: 0.3 } },
  // ---- 1.1 新增 ----
  { id: 'apprentice', br: 0, n: '견습 제도', ic: '🎓', t: 2, pts: 40, cost: { plank: 140, iron: 50 }, d: '숙련공은 경험치를 50% 더 빠르게 축적합니다. 일손은 제거되면 절반만 손실됩니다.', req: ['smoke'], fx: {} },
  { id: 'alt1', br: 0, n: '대체 레시피 1', ic: '📜', t: 2, pts: 45, cost: { plank: 160, iron: 70 }, d: '레벨 1~3 공장을 대체 제조법으로 전환할 수 있습니다(건물 패널에서 전환).', req: ['apprentice'], fx: {}, star: 1 },
  { id: 'specpro', br: 0, n: '특산품 정공', ic: '🏅', t: 3, pts: 85, cost: { steel: 110, gear: 40 }, d: '야영지 특별상품 보너스 +50% → +75%', req: ['alt1'], fx: {} },
  { id: 'alt2', br: 0, n: '대체 레시피 2', ic: '📜', t: 4, pts: 150, cost: { steel: 220, seal: 60 }, d: '레벨 4~7 공장도 대체 제조법으로 전환 가능', req: ['specpro'], fx: {}, star: 1 },
  { id: 'coldcast', br: 1, n: '한파 예보', ic: '📡', t: 2, pts: 40, cost: { plank: 150, iron: 50 }, d: '한파는 2일 전에 예보되었습니다. 한파 in 용광로연료 ×2 → ×1.7', req: ['clinic'], fx: {} },
  { id: 'canteen', br: 1, n: '공동 식당', ic: '🍲', t: 2, pts: 45, cost: { plank: 180, iron: 60 }, d: '모든 야영지배급은 −10%를 소비합니다.', req: ['coldcast'], fx: { eat: -0.1 } },
  { id: 'thermal', br: 1, n: '보온 작업복', ic: '🧥', t: 3, pts: 80, cost: { steel: 100, gear: 30 }, d: '채집은 한파보다 30%만 느립니다(원래 절반 느림).', req: ['canteen'], fx: {} },
  { id: 'townplan', br: 1, n: '도시 계획', ic: '🏘️', t: 4, pts: 160, cost: { steel: 220, seal: 70 }, d: '야영지 60명, 희망 50명 이상은 업그레이드로 "타운"을 만들 수 있으며, 그 이상은 "도시" 또는 "대도시"로 만들 수 있습니다.', req: ['thermal'], fx: {}, star: 1 },
  { id: 'wideroad', br: 2, n: '넓은 썰매길', ic: '🛣️', t: 2, pts: 40, cost: { plank: 160, iron: 50 }, d: '도로 건설, 업그레이드 도로로 자재 30% 절약', req: ['scope'], fx: {} },
  { id: 'guild', br: 2, n: '상회 계약', ic: '🤝', t: 3, pts: 80, cost: { steel: 100, gear: 40 }, d: '북방 상회 일일주문량 3개 → 5개', req: ['wideroad'], fx: {}, star: 1 },
  { id: 'dispatch', br: 2, n: '배차소', ic: '🗂️', t: 3, pts: 85, cost: { steel: 110, gear: 40 }, d: '물류망은 5초(원래 10초)마다 출차 예정이며, 최소 5개 이상 차량이 발송됩니다.', req: ['guild'], fx: {} },
  { id: 'railsched', br: 2, n: '철도 배차', ic: '🚦', t: 4, pts: 140, cost: { steel: 220, engine: 12 }, d: '철도의 썰매 초당 8 → 12 프레임', req: ['rail'], fx: {} },
  { id: 'postnet', br: 2, n: '역참망', ic: '📮', t: 5, pts: 230, cost: { seal: 140, battery: 60 }, d: '물류망 모든 도로 운송 능력 +25%', req: ['railsched'], fx: { line: 0.25 } },
  { id: 'botcal', br: 3, n: '오토마톤 조정', ic: '🔧', t: 6, pts: 340, cost: { alloy: 150, part: 60 }, d: '각 오토마톤은 2명을 지원합니다(원래 1.5).', fx: {} },
  { id: 'bothaul', br: 3, n: '운반형 오토마톤', ic: '🛷', t: 6, pts: 360, cost: { part: 100, core: 20 }, d: '오토마톤 격납고는 운반형을 만들 수 있습니다. 사물을 두 배 빠르게 움직일 수 있습니다.', req: ['botcal'], fx: {}, star: 1 },
  { id: 'botmine', br: 3, n: '채굴형 오토마톤', ic: '⛏️', t: 6, pts: 380, cost: { part: 110, core: 24 }, d: '오토마톤 격납고는 채굴형을 만들 수 있습니다: 채집, 생산량을 +30%만 만듭니다.', req: ['bothaul'], fx: {}, star: 1 },
  { id: 'botshell', br: 3, n: '내한 외장', ic: '🛡️', t: 6, pts: 400, cost: { alloy: 200, core: 20 }, d: '오토마톤은 한파 및 영동조에서 속도가 느려지지 않습니다.', req: ['botcal'], fx: {} },
  { id: 'botbay', br: 3, n: '격납 공간 확장', ic: '📦', t: 6, pts: 420, cost: { part: 140, battery: 120 }, d: '오토마톤 격납고는 레벨당 4개 추가 설치 가능(8 → 12)', req: ['botshell'], fx: {} },
  { id: 'corerec', br: 3, n: '코어 회수', ic: '♻️', t: 7, pts: 520, cost: { part: 180, core: 40 }, d: '오토마톤 분해시 핵심 반납', req: ['botmine'], fx: {}, star: 1 },
  { id: 'autofac', br: 3, n: '무인 공방', ic: '🏭', t: 7, pts: 560, cost: { part: 200, core: 50 }, d: '가공 공장 생산량 +10%; 일자리는 모두 오토마톤 +10%', req: ['botbay'], fx: {} },
  { id: 'afterglow', br: 4, n: '봉화의 여운', ic: '🗼', t: 7, pts: 480, cost: { alloy: 240, part: 80 }, d: '봉화탑이 켜질 때마다 모든 생산 +3%', fx: {} },
  { id: 'fork3', br: 4, n: '세 갈래 정찰', ic: '🧭', t: 7, pts: 500, cost: { part: 120, core: 24 }, d: '봉화탑을 점등한 후 정찰대는 3개의 갈림길(원래 2개)을 다시 가져옵니다.', fx: {}, star: 1 },
  { id: 'cmd1', br: 4, n: '용광로 지령 1', ic: '📯', t: 7, pts: 520, cost: { part: 150, core: 30 }, d: '잠금 해제 명령 "용광로 격연" "긴급 수송"', req: ['afterglow'], fx: {}, star: 1 },
  { id: 'guide', br: 4, n: '', ic: '🗺️', t: 7, pts: 540, cost: { alloy: 260, battery: 160 }, d: '사이트 기연의 각 단계마다 옵션이 하나 더 추가됩니다.', req: ['fork3'], fx: {} },
  { id: 'wonder1', br: 4, n: '', ic: '🏛️', t: 7, pts: 600, cost: { alloy: 300, part: 120 }, d: '불가사의 구축 가능: 증기 거상, 만년 얼음창고, 꺼지지 않는 등대', req: ['cmd1'], fx: {}, star: 1 },
  { id: 'wintprep', br: 4, n: '', ic: '❄️', t: 7, pts: 600, cost: { alloy: 300, battery: 200 }, d: '영동조 4일 사전 예보(원래는 2일); 프로스트 베히모스 −20%', req: ['guide'], fx: {} },
  { id: 'cmd2', br: 4, n: '', ic: '📯', t: 7, pts: 640, cost: { part: 200, core: 40 }, d: '잠금 해제 명령 "전원 일심" "용광로의 가호"', req: ['wonder1'], fx: {}, star: 1 },
  { id: 'wonder2', br: 4, n: '', ic: '🏛️', t: 7, pts: 720, cost: { alloy: 400, core: 50 }, d: '불가사의 구축 가능: 오로라 탑, 철도 중앙역, 별의 용광로', req: ['wintprep'], fx: {}, star: 1 },
];

// 雾里的地点：侦察队揭开后，可以派探险队去，到了再决定怎么做
export const SITES = {
  depot:  { n: '', ic: '🏚️', desc: '구형 창고와 양철은 지붕이 절반쯤 무너진 채 눈 속에 반쯤 묻혀 있었습니다.' },
  camp:   { n: '', ic: '🔥', desc: '작은 불 주변에는 망가진 여러 사람이 모여 있었고, 십여 명 정도는 침입자들을 경계하는 눈빛으로 바라보고 있었다.' },
  train:  { n: '', ic: '🚂', desc: '얼음에 얼어붙은 낡은 화물열차, 객차 문이 얼어 죽었습니다.' },
  shrine: { n: '', ic: '🗿', desc: '북행자라는 이름이 새겨진 얼음 속에 얼어붙은 고대 신사가 있습니다.' },
  lab:    { n: '구시대 관측소', ic: '🔭', desc: '능선에 있는 돔 전망대, 내부에 있던 악기들이 그대로 남아있습니다.' },
  wreck:  { n: '', ic: '🎈', desc: '거대한 비행선이 눈 속에 대각선으로 갇혀 있었고, 그 뼈대는 얼음으로 덮여 있었습니다.' },
};

// ---------- 章节：每个地标一章，各有开场故事、三个任务和奖励 ----------
export const CHAPTERS = [
  { n: '제1장 · 식지 않은 잔불', story: '모닥불 및 잔열은 이전 세대에서 남았습니다. 그들은 용광로 곁에 "불이 꺼지지 않도록 북쪽으로 가십시오"라는 선을 새겼습니다. 이곳이 먼저 집이 되게 해주세요.',
    tasks: [{ t: '목판 생산량 안정 6/분', k: 'rate', r: 'plank', n: 6 }, { t: '야영지에 20명이 있도록 하세요.', k: 'people', n: 20 }, { t: '첫 번째 야영지 법령에 서명했습니다.', k: 'law', n: 1 }],
    reward: { res: { plank: 80, food: 150 }, hope: 8 }, end: '모닥불은 안정적입니다. 누군가 밤에 노래를 부르기 시작했습니다.' },
  { n: '제2장 · 검은 산마루', story: '철령 및 석탄층은 여전히 김이 나고 있습니다. 늙은 광부는 첫 번째 철 조각이 녹던 날 북행자가 진정으로 굳건히 서 있었다고 말했습니다.',
    tasks: [{ t: '철괴 생산량 안정 8/분', k: 'rate', r: 'iron', n: 8 }, { t: '탄광 2개 건설', k: 'bld', b: 'coalmine', n: 2 }, { t: '연구 2개 완료', k: 'tech', n: 2 }],
    reward: { res: { iron: 120, coal: 150 }, bank: 60 }, end: '첫 번째 철괴는 선명한 사운드를 만들어냈습니다.' },
  { n: '제3장 · 쇳소리 나는 배관', story: '협곡은 구시대의 증기 배관으로 가득 차 있으며 일부는 여전히 쉿쉿거리고 있습니다. 안개 깊숙한 곳에는 다른 누군가가 있는 것 같습니다.',
    tasks: [{ t: '강재 생산량 안정 12/분', k: 'rate', r: 'steel', n: 12 }, { t: '안개 속 위치 2곳 탐색', k: 'site', n: 2 }, { t: '야영지 희망이 65에 도달하도록 하세요.', k: 'hope', n: 65 }],
    reward: { res: { gear: 80, steel: 80 }, people: 8 }, end: '협곡의 파이프가 잠에서 깨어난 용처럼 다시 따뜻해졌습니다.' },
  { n: '제4장 · 북으로 향하는 철길', story: '오래된 철길은 툰드라에서 북쪽까지 뻗어 있습니다. 야영지를 연결하면 철길을 따라 사람과 물질이 이동할 수 있습니다.',
    tasks: [{ t: '밀봉 부품 생산량 안정 16/분', k: 'rate', r: 'seal', n: 16 }, { t: '물류망에는 2개의 도로가 있습니다.', k: 'line', n: 2 }, { t: '모든 야영지는 최대 120명까지 추가됩니다.', k: 'people', n: 120 }],
    reward: { res: { tar: 150, seal: 60 }, hope: 6 }, end: '첫 번째 팀인 썰매가 철길을 따라 미끄러져 나갔고, 멀리서 휘파람 소리가 울렸다.' },
  { n: '제5장 · 차가운 빛의 도시', story: '폐허의 수정은 차갑게 빛나고, 도시 전체가 마지막 순간에 얼어붙은 것처럼 보였다. 오래된 청사진에는 북쪽으로 가는 길이 표시되어 있었습니다.',
    tasks: [{ t: '항온 합금 생산량 안정 12/분', k: 'rate', r: 'alloy', n: 12 }, { t: '연구 총 8개 완료', k: 'tech', n: 8 }, { t: '안개 속 위치 총 5곳 탐색', k: 'site', n: 5 }],
    reward: { res: { battery: 60, alloy: 60 }, bank: 200 }, end: '배터리의 빛은 폐허의 수정보다 따뜻합니다.' },
  { n: '제6장 · 하늘에서 온 손님', story: '이 거대한 난파선이 어디서 왔는지는 아무도 모릅니다. 오토마톤은 아직도 주인을 기다리는 듯 안에서 방황하고 있습니다.',
    tasks: [{ t: '고대 부품 생산량 안정 16/분', k: 'rate', r: 'part', n: 16 }, { t: '모든 야영지는 최대 250명까지 추가됩니다.', k: 'people', n: 250 }, { t: '각 야영지 및 불만을 30 미만으로 설정합니다.', k: 'calm', n: 30 }],
    reward: { res: { part: 60, star: 60 }, people: 15 }, end: '오토마톤은 처음으로 인간의 지시에 복종하여 썰매를 탑재했습니다.' },
  { n: '최종장 · 꺼지지 않는 불', story: '전설은 사실이다. 영원의 용광로는 차갑고 거대하며 조용하게 바로 당신 앞에 있습니다. 여행의 마지막 사람을 기다리고 있습니다.',
    tasks: [{ t: '용광로 부품은 3/분 동안 안정적이며 첫 번째 레이어를 점등합니다.', k: 'eternal', n: 1 }, { t: '용광로 부품은 5/분으로 안정적이며 두 번째 레이어를 밝힙니다.', k: 'eternal', n: 2 }, { t: '용광로 부품은 7/분으로 안정화되고 영원의 용광로를 다시 점화합니다.', k: 'eternal', n: 3 }],
    reward: { hope: 20 }, end: '화재는 남겨진 야영지를 따라 남쪽으로 퍼졌습니다.' },
  // 永恒之炉以北六程：每程两条线一起稳住，再加一件这一程的新东西
  { n: '제7장 · 등대의 희미한 빛', story: '얼음 속의 등대는 북상의 사람들을 인도하는 듯 아직도 살짝 빛나고 있다. 타워 아래의 오래된 창고 중에서 수정 배터리는 깔끔하게 번호가 매겨져 있습니다.',
    tasks: [{ t: '수정 배터리 생산량 안정 16/분', k: 'rate', r: 'battery', n: 16 }, { t: '항온 합금 생산량 안정 16/분', k: 'rate', r: 'alloy', n: 16 }, { t: '빌드 1 신호 등탑', k: 'bld', b: 'beacon', n: 1 }],
    reward: { res: { battery: 120, alloy: 80 }, people: 15 }, end: '등대는 다시 빛을 발했고 수십 마일 떨어진 곳에서도 볼 수 있었습니다.' },
  { n: '제8장 · 좌초된 거선', story: '쇄빙선의 뱃머리는 여전히 북쪽을 향하고 있었습니다. 보일러는 얼고 있지만 객실의 그림은 얼음이 도로의 끝이 아니라는 것을 알려줍니다.',
    tasks: [{ t: '고대 부품 생산량 안정 18/분', k: 'rate', r: 'part', n: 18 }, { t: '수정 배터리 생산량 안정 18/분', k: 'rate', r: 'battery', n: 18 }, { t: '유닛 쇄빙차 1대 건설', k: 'veh', v: 'icebreaker', n: 1 }],
    reward: { res: { part: 100, engine: 40 }, bank: 300 }, end: '쇄빙차의 궤도가 얼음을 가로질러 눌려졌고 그 앞에서 균열이 닫혔습니다.' },
  { n: '제9장 · 오로라 아래', story: '천문대의 벽은 수십 년의 눈보라 기록으로 덮여 있습니다. 그것을 따라가다 보면 바람과 눈이 오기 전에 알 수 있습니다.',
    tasks: [{ t: '고대 부품 생산량 안정 20/분', k: 'rate', r: 'part', n: 20 }, { t: '오토마톤 코어 생산량 지속 4/분', k: 'rate', r: 'core', n: 4 }, { t: '블록 2개 만들기 오토마톤 격납고', k: 'bld', b: 'bay', n: 2 }],
    reward: { res: { core: 12, part: 120 }, hope: 10 }, end: '오로라 아래, 오토마톤 등이 물품을 싣고 북쪽으로 향했습니다.' },
  { n: '제10장 · 무릎 꿇은 거인', story: '그 거인은 빙원 위에 무릎을 꿇고 땅에 손을 얹었습니다. 어떤 사람들은 무언가를 지키는 것이 아니라 누군가가 도와주기를 기다리는 것이라고 말합니다.',
    tasks: [{ t: '영원의 용광로 부품 생산량 지속 4/분', k: 'rate', r: 'heart', n: 4 }, { t: '오토마톤 코어 생산량 지속 3/분', k: 'rate', r: 'core', n: 3 }, { t: '빌드 1 거상 수호자', k: 'bld', b: 'colossus', n: 1 }],
    reward: { res: { heart: 30, core: 10 }, people: 20 }, end: '돌지기는 일어섰고, 약탈자는 멀리서 그것을 보고 뒤돌아서 떠났다.' },
  { n: '제11장 · 별이 떨어진 땅', story: '구덩이 바닥의 돌은 보라색으로 빛나고 만졌을 때 따뜻했습니다. 오래된 대장장이는 용광로가 더 활발하게 연소될 수 있다고 말했습니다.',
    tasks: [{ t: '별핵 생산량 지속 4/분', k: 'rate', r: 'starcore', n: 4 }, { t: '영원의 용광로 부품 생산량 안정 6/분', k: 'rate', r: 'heart', n: 6 }, { t: '빌드 2 별핵 광산', k: 'bld', b: 'starpit', n: 2 }],
    reward: { res: { starcore: 40, heart: 30 }, bank: 400 }, end: '용광로는 별핵의 첫 번째 조각을 먹었고, 불꽃은 라벤더로 변했습니다.' },
  { n: '종장 · 세계의 척추', story: '빙상 끝에서 거대한 뼈 능선이 솟아올랐다. 뒤집어 보면 더 이상 아무도 가본 적이 없는 길이 없습니다. 우리는 여기까지 왔습니다.',
    tasks: [{ t: '영원의 용광로 부품 생산량 안정 8/분', k: 'rate', r: 'heart', n: 8 }, { t: '모든 야영지는 최대 600명까지 추가할 수 있습니다.', k: 'people', n: 600 }, { t: '야영지 희망이 90에 도달하도록 하세요.', k: 'hope', n: 90 }],
    reward: { hope: 30 }, end: '도중에 모닥불은 잿빛 야영지부터 세계의 척추까지 일렬로 연결됩니다.' },
];

// 每到一个新地标，老向导的三句话简报：这一程要做什么、为什么、建议先做哪样
export const BRIEF = [
  ['이 과정에서 목판 라인은 분당 6비트로 실행되고 3분 동안 안정적으로 유지되어야 합니다.', '목판은 천막, 용광로 및 썰매에서 사용되는 재료입니다. 북쪽으로 갈 때 필수입니다.', '먼저 숲 옆에 두 개의 벌목장을 만들고 그 옆에 제재소를 배치한 다음 용광로를 레벨 3으로 업그레이드하세요.'],
  ['이 과정에서 철괴 라인은 분당 8회까지 실행되어야 합니다.', '여기에서 북쪽까지는 거의 모든 건물에 철이 필요합니다. 석탄은 또한 용광로를 더욱 강력하게 연소할 수 있습니다.', '먼저 일손 배치는 능선 밑으로 가서 석탄층과 철광맥을 찾습니다. 제련로는 두 광산 사이에 배치됩니다.'],
  ['이 과정에서 강재 라인은 분당 12회 실행되어야 합니다.', '강철은 증기 시대의 뼈대입니다. 톱니바퀴, 증기기관 및 트레일러는 모두 강철에 의존합니다.', '강철을 만들려면 철괴, 석회석, 석탄이 함께 도착해야 합니다. 먼저 협곡 바닥으로 가서 석회암층을 찾으세요.'],
  ['이 과정에서 밀봉 부품 라인은 분당 16회 실행되어야 합니다.', '밀봉 부품은 혹한 속에서도 파이프와 기계를 밀폐되게 유지하며 더 북쪽에서는 이 장치 없이는 살 수 없습니다.', '타르 및 강재 두 라인을 함께 병합해야 합니다. 오일셰일 광산 및 정유소가 먼저 건설되고 강철 와이어가 계속 공급됩니다.'],
  ['이 프로세스를 수행하려면 항온 합금 라인이 분당 16비트로 실행되어야 합니다.', '이 합금은 유적 북쪽의 혹한에도 견딜 수 있어 전면 건물과 용광로에 사용된다.', '합금에는 배터리가 필요하고 배터리에는 서리수정과 철이 필요합니다. 먼저 서리수정 광산과 배터리 공방을 건설하세요.'],
  ['이 과정에서 고대 부품 라인은 분당 20으로 실행되어야 합니다.', '이 부품은 오토마톤을 수리할 수 있으며 영원의 용광로 부품을 단조하는 데에도 핵심이 됩니다.', '성철이 잔해 근처에 있습니다. 합금 뒤에는 충분한 공급 스테이션이 있습니다. 물류망은 주요 도로를 따라 위로 운송됩니다.'],
  ['영원의 용광로는 용광로 부품 3단계, 5단계, 7단계로 나누어지며 각각 3분 동안 안정됩니다.', '세 층 모두 불이 들어오면 해당 레벨을 클리어한 것이며 계속해서 북쪽으로 갈 수 있습니다.', '먼저 용광로 옆에 노심 조각을 파고 대장간을 건설하세요. 먼저 부품과 합금 라인이 원활하게 작동해야 합니다.'],
];

// ---------- 营地基建：道路让搬运更快，蒸汽管道把热送得更远 ----------
export const INFRA = {
  road: { n: '길', ic: '🛤️', what: '운반꾼은 경로를 따라 물품을 앞뒤로 운반합니다. 도로가 좋을수록 속도는 빨라집니다.', lv: [
    { n: '다져진 눈길', d: '운송 속도는 변경되지 않습니다.' },
    { n: '자갈길', d: '운반꾼이 20% 더 빨라집니다.', cost: { stone: 120, wood: 80 } },
    { n: '돌판길', d: '운반꾼이 40% 더 빨라집니다.', cost: { stone: 320, plank: 120 } },
    { n: '온돌길', d: '운반꾼은 60% 더 빠르게 이동하며 눈보라는 속도를 늦추지 않습니다.', cost: { stone: 500, steel: 80, coal: 150 } },
  ] },
  pipe: { n: '증기 배관', ic: '♨️', what: '파이프라인은 경로를 따라 어디에서나 용광로의 증기를 야영지로 전달합니다.', lv: [
    { n: '배관 없음', d: '' },
    { n: '철판 관', d: '난방권 +1 그리드 · 야영지 +2°', cost: { iron: 80, plank: 120 } },
    { n: '보온 관', d: '난방권 +2 그리드 · 야영지 +4°', cost: { iron: 160, steel: 50 } },
    { n: '고압 관망', d: '난방권 +3 그리드 · 야영지 +6°', cost: { steel: 150, gear: 50, seal: 20 } },
  ] },
};
