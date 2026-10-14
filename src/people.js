// 小人：名字、来历、性格都由编号算出来（同一个人每次看都一样）；冷暖、饥饱、病痛和说的话取决于营地的状况
import { hash3 } from './worldgen.js';
import { BLD, RES } from './data.js';
import { skyAt } from './sim.js';

const SUR = ['林', '陈', '周', '吴', '郑', '王', '李', '赵', '孙', '何', '许', '沈', '韩', '杨', '朱', '秦', '苏', '魏', '蒋', '顾', '陆', '叶', '程', '白', '高', '罗', '冯', '邓', '萧', '季'];
const GIV = ['秋生', '小满', '阿禾', '冬青', '石头', '雪松', '远山', '春妮', '海生', '铁柱', '阿梅', '长庚', '新月', '念北', '守炉', '明川', '向晨', '木兰', '栓子', '小雀', '南星', '寒生', '望舒', '知秋', '炭儿', '阿苗', '北辰', '安平', '晓风', '银杏'];
const FROM = ['南方的渔村', '废弃的矿镇', '断了的铁路站', '山谷里的农庄', '海边的灯塔', '被雪埋掉的老城', '一艘搁浅的破冰船', '南边的修道院'];
const TRAIT = ['手巧', '能吃苦', '爱唱歌', '话少', '怕冷', '乐天', '细心', '力气大', '爱讲故事', '睡得少'];

// info：{ k: 'w' 工人 | 'h' 搬运工 | 'f' 拾柴的 | 's' 侦察队员, b?, i, camp, sid? }
export function personOf(info) {
  const OFF = { s: 5, f: 3, q: 1, kid: 2, g: 4, r: 6, fd: 8, fm: 9 };
  const a = OFF[info.k] != null ? (info.sid ?? info.camp) * 7 + OFF[info.k] : info.b, b = info.i + (info.k === 'h' ? 20 : 0);
  const h = n => hash3(a, b, n);
  return {
    name: SUR[Math.floor(h(1) * SUR.length)] + GIV[Math.floor(h(2) * GIV.length)],
    age: info.k === 'kid' ? 6 + Math.floor(h(3) * 7) : 16 + Math.floor(h(3) * 50), from: FROM[Math.floor(h(4) * FROM.length)], trait: TRAIT[Math.floor(h(5) * TRAIT.length)],
    rh: h(6), rs: h(7), rq: h(8),
  };
}

const Q = {
  hungry: ['今天又只分到半块肉。', '肚子饿得咕咕叫。', '厨房什么时候开饭？', '再这么饿下去，谁也扛不住。'],
  cold: ['帐篷里也冷得睡不着。', '手指冻得没知觉了。', '熔炉能不能烧旺一点？'],
  out: ['我还睡在外面……', '能不能再搭个帐篷？', '昨晚在雪地里缩了一夜。'],
  sick: ['咳咳……没事，还能干。', '头有点烫。', '浑身没力气。'],
  full: ['东西堆满了，干了也白干。', '仓库塞不下了。'],
  wait: ['等原料等半天了。', '没东西可干，只能干站着。'],
  feast: ['昨晚的篝火会真热闹！', '好久没唱歌了。'],
  night: ['夜里的风声真吓人。', '星星真亮。'],
  angry: ['凭什么我们天天干到半夜？', '再这样下去，我就往南走了。', '管事的人根本不管我们死活。', '这日子没法过了。'],
  hopeless: ['北方真的有那座炉子吗？', '我们会死在这片雪原上的。', '干这些有什么用呢……'],
  hopeful: ['听说下一个地标不远了！', '只要熔炉不灭，就有盼头。'],
  aurora: ['快看天上，极光！', '老人说极光是炉火映在天上的影子。', '这么好看的夜，都忘了冷了。', '要是家里人也能看见就好了。'],
  icefog: ['雾大得看不见路。', '空气里全是亮晶晶的冰渣。', '睫毛都结霜了。', '跟着熔炉的光走，迷不了路。'],
  shanty: ['挤在窝棚里，总比睡雪地强。', '听说再搭几顶帐篷就能住进去了。', '一路走过来，就想有张床。', '他们说等有空床就叫我们。'],
  kid: ['雪人是我堆的！', '接住——雪球！', '我长大了也要往北走！', '天黑前要回帐篷，不然会挨骂。', '雪人的鼻子是厨房偷的胡萝卜。'],
  fest: ['再来一曲！', '好久没这么痛快了。', '鼓再敲快一点！', '跳得腿都软了。', '明天干活的劲儿都有了。', '火烧得真旺！', '拉琴的那个是谁？拉得真好。'],
  guard: ['夜里有狼嚎，得盯紧点。', '火把别灭，野兽就不敢过来。', '换班了就能睡一会儿。', '雪地上的脚印……是狼的。'],
  good: ['熔炉烧得真旺。', '听说北边有座永远不灭的炉子。', '今天的汤不错。', '再往北走一程吧。', '孩子们在火堆边睡着了。', '雪小了，好干活。'],
};

// 这个人现在怎么样：冷暖、饥饱、病、心情和一句话
export function personState(S, info, p, R, extra = {}) {
  const camp = S.camps.find(c => c.id === info.camp) || S.camps[0], cr = R.c[camp.id] || {};
  const housed = info.k === 's' ? false : p.rh < (cr.housed || 0) / Math.max(1, camp.people);
  const t = info.k === 's' ? (extra.scoutTemp ?? cr.tU) : housed ? cr.tH : cr.tU;
  const sick = info.k !== 's' && p.rs < (cr.sick || 0) / Math.max(1, camp.people);
  const hungry = (cr.hunger || 0) > 0.05;
  const br = info.b != null ? R.b[info.b] || {} : {};
  const st = br.status || '';
  const hope = camp.hope ?? 50, disc = camp.disc ?? 10;
  let score = (t >= 10 ? 1 : t >= 0 ? 0 : -1) + (hungry ? -1 : 1) + (sick ? -1 : 0) + (extra.feast || extra.aurora ? 1 : 0) + (hope >= 70 ? 1 : hope < 30 ? -1 : 0) + (disc >= 60 ? -1 : 0);
  const mood = score >= 2 ? '心情不错' : score >= 0 ? '还行' : '很低落';
  let pool = Q.good;
  if (hungry) pool = Q.hungry; else if (sick) pool = Q.sick; else if (!housed && info.k !== 's' && t < 5) pool = Q.out; else if (t < 0) pool = Q.cold;
  else if (disc >= 60 && p.rq < 0.6) pool = Q.angry; else if (hope < 30 && p.rq < 0.6) pool = Q.hopeless;
  else if (info.k === 'q') pool = Q.shanty; else if (info.k === 'kid') pool = Q.kid; else if (info.k === 'g') pool = Q.guard; else if (info.k === 'fd' || info.k === 'fm') pool = Q.fest;
  else if (st === '仓库满了') pool = Q.full; else if (st.startsWith('缺')) pool = Q.wait; else if (extra.feast) pool = Q.feast; else if (extra.aurora && p.rq < 0.75) pool = Q.aurora; else if (extra.icefog && p.rq < 0.6) pool = Q.icefog; else if (extra.night && p.rq < 0.4) pool = Q.night; else if (hope >= 70 && p.rq < 0.35) pool = Q.hopeful;
  const slot = Math.floor((S.t + p.rq * 40) / 40);
  const quote = pool[Math.floor(hash3(slot, Math.floor(p.rq * 1000), 9) * pool.length)];
  let role = '';
  const bd = info.b != null ? S.buildings.find(x => x.id === info.b) : null, bn = bd ? BLD[bd.type].n : '';
  if (info.k === 'w') role = `在${bn}干活${st && st !== '运转中' ? `（${st}）` : ''}`;
  else if (info.k === 'h') role = info.res ? (info.go ? `搬运工：把${RES[info.res].n}送去${bn}` : `搬运工：把${RES[info.res].n}从${bn}运回仓库`) : `搬运工：在${bn}和仓库之间来回`;
  else if (info.k === 'f') role = '没有岗位，在营地附近拾柴、设陷阱';
  else if (info.k === 'q') role = '刚到营地，在窝棚里等空床位';
  else if (info.k === 'kid') role = '孩子，在雪地里玩';
  else if (info.k === 'g') role = '守夜人，打着火把绕营地巡逻';
  else if (info.k === 'r') role = '有件事想请你帮忙';
  else if (info.k === 'fd') role = '在篝火庆典上跳舞';
  else if (info.k === 'fm') role = info.i === 0 ? '庆典上的鼓手' : info.i === 1 ? '庆典上拉琴的' : '在庆典上看热闹';
  else role = info.rescue ? '救援队员，正在雪原上赶路' : '侦察队员，正在雪原上赶路';
  return { housed, t: Math.round(t ?? 0), sick, hungry, mood, quote, role, camp };
}

// 营地里大家在说什么：按营地状况挑几句
export function campVoices(S, camp, R, n = 3) {
  const cr = R.c[camp.id] || {}, out = [];
  const add = (pool, k) => out.push(pool[Math.floor(hash3(Math.floor(S.t / 30), k, camp.id) * pool.length)]);
  if ((cr.hunger || 0) > 0.05) add(Q.hungry, 1);
  if ((cr.sick || 0) > 0) add(Q.sick, 2);
  if (camp.people > (cr.housing || 0)) add(Q.out, 3);
  if ((cr.tH ?? 10) < 0) add(Q.cold, 4);
  if ((camp.disc ?? 0) >= 60) add(Q.angry, 9); else if ((camp.hope ?? 50) < 30) add(Q.hopeless, 10);
  const sky = skyAt(S, S.t);
  if (sky.aurora > 0.4) add(Q.aurora, 11); else if (sky.icefog > 0.4) add(Q.icefog, 12);
  let k = 5; while (out.length < n) add(Q.good, k++);
  return [...new Set(out)].slice(0, n);
}
