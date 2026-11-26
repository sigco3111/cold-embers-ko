// 小人：名字、来历、性格都由编号算出来（同一个人每次看都一样）；冷暖、饥饱、病痛和说的话取决于营地的状况
import { hash3 } from './worldgen.js';
import { BLD, RES } from './data.js';
import { skyAt } from './sim.js';

const SUR = ['숲', '목록', '주', '우', '정', '왕', '자두', '자오', '해', '무엇', '5월', '싱크대', '한국', '양', '주', '진', '수', '웨이', '지앙', '구', '땅', '잎', '절차', '하얀색', '높은', '루오', '펑', '덩', '샤오', '계절'];
const GIV = ['치우 셩', '샤오만', '아헤', '홀리', '결석', '삼나무', '먼 산', '춘니', '해양 생물', '철 기둥', '아메이', '장 겡', '초승달', '니안베이', '용광로를 유지', '명천', '샹첸', '뮬란', '색전증', '소조', '남부 별', '한성', '왕슈', '지추', '탄에르', '아미아오', '베이첸', '안핑', '샤오펑', '은행'];
const FROM = ['남쪽의 어촌 마을', '버려진 광산 마을', '고장난 철도 스테이션', '계곡의 농장', '바다 옆 등대', '눈 속에 묻힌 옛 도시', '좌초된 쇄빙선', '남쪽에 있는 수도원'];
const TRAIT = ['재치', '고난을 견딜 수 있는', '노래하는 걸 좋아해요', '덜 말하다', '추위가 두렵다', '낙천', '주의 깊은', '강한', '사랑 이야기', '잠을 덜 자다'];

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
  hungry: ['오늘은 고기 반조각만 가져왔습니다.', '배가 고파서 으르렁거렸다.', '부엌저녁은 언제 제공되나요?', '계속 배가 고프면 누구도 참을 수 없습니다.'],
  cold: ['천막에서는 잠을 자기에는 너무 추웠습니다.', '손가락이 너무 차가워서 감각이 마비되었습니다.', '용광로가 더 활발하게 연소될 수 있나요?'],
  out: ['아직 밖에서 자는데..', '다른 천막을 얻을 수 있나요?', '어젯밤에는 눈 속에 웅크리고 밤새도록 지냈어요.'],
  sick: ['에헴...괜찮아 아직 할 수 있어.', '머리가 좀 뜨거운 것 같아요.', '나는 힘이 없습니다.'],
  full: ['일이 쌓이고, 모든 일이 헛수고가 된다.', '창고를 더 이상 연결할 수 없습니다.'],
  wait: ['나는 오랫동안 원자재를 기다리고있었습니다.', '서 있는 것 외에는 할 일이 없었다.'],
  feast: ['어젯밤 모닥불 회의는 정말 활발했습니다!', '나는 오랫동안 노래를 부르지 않았습니다.'],
  night: ['밤에 바람소리가 정말 무섭네요.', '별이 너무 밝아요.'],
  angry: ['우리는 왜 매일 자정까지 일합니까?', '계속 이러면 남쪽으로 가겠습니다.', '책임자들은 우리가 살든 죽든 상관하지 않습니다.', '나는 오늘을 살 수 없습니다.'],
  hopeless: ['정말 북쪽에 그 난로가 있나요?', '우리는 이 눈밭에서 죽을 것이다.', '이런 짓을 해서 무슨 소용이 있겠는가...'],
  hopeful: ['다음 랜드마크가 멀지 않다고 들었어요!', '용광로가 살아 있는 한 희망은 있습니다.'],
  aurora: ['하늘을 봐, 오로라!', '노인은 오로라가 하늘에 있는 불의 그림자라고 말했습니다.', '추운 것도 잊어버릴 정도로 아름다운 밤이었습니다.', '우리 가족도 볼 수 있으면 좋을 것 같아요.'],
  icefog: ['안개가 너무 짙어 길도 잘 보이지 않았다.', '공기는 반짝이는 얼음 잔여물로 가득 차 있었습니다.', '속눈썹이 젖어 있습니다.', '용광로의 빛을 따라가면 결코 길을 잃지 않을 것입니다.'],
  shanty: ['눈 속에서 자는 것보다 오두막에 빽빽이 들어차 있는 것이 낫습니다.', '천막 몇 개만 더 있으면 그 안에서 살 수 있다고 들었습니다.', '여기까지는 그냥 침대가 필요했어요.', '침대가 생기면 우리에게 전화하겠다고 하더군요.'],
  kid: ['눈사람은 내가 쌓아올렸어!', '잡아라 - 눈덩이!', '나는 커서 북쪽으로 가고 싶다!', '어두워지기 전에 천막으로 돌아가야 합니다. 그렇지 않으면 혼날 것입니다.', '눈사람의 코는 부엌이 훔친 당근입니다.'],
  fest: ['한 곡 더!', '이렇게 행복한 건 오랜만이에요.', '드럼을 더 빠르게 쳐보세요!', '춤을 추느라 다리가 약했어요.', '나는 내일 일할 에너지를 갖게 될 것이다.', '불이 너무 밝게 타오르고 있었어요!', '피아노를 치는 사람은 누구입니까? 정말 잘 당깁니다.'],
  guard: ['밤에는 늑대가 울부짖으니 조심하세요.', '횃불을 끄지 마십시오. 그러면 들짐승들이 감히 다가오지 못할 것입니다.', '근무가 끝나면 잠을 좀 잘 수 있어요.', '눈 위의 발자국은...늑대의 발자국이다.'],
  good: ['용광로는 정말 뜨겁습니다.', '북쪽에는 영원한 용광로가 있다는 말을 들었습니다.', '오늘의 수프는 맛있습니다.', '조금 더 북쪽으로 가보겠습니다.', '아이는 불 옆에서 잠들었습니다.', '눈이 가벼워서 작업하기가 더 쉽습니다.'],
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
  const mood = score >= 2 ? '기분이 좋다' : score >= 0 ? '좋은' : '매우 낮음';
  let pool = Q.good;
  if (hungry) pool = Q.hungry; else if (sick) pool = Q.sick; else if (!housed && info.k !== 's' && t < 5) pool = Q.out; else if (t < 0) pool = Q.cold;
  else if (disc >= 60 && p.rq < 0.6) pool = Q.angry; else if (hope < 30 && p.rq < 0.6) pool = Q.hopeless;
  else if (info.k === 'q') pool = Q.shanty; else if (info.k === 'kid') pool = Q.kid; else if (info.k === 'g') pool = Q.guard; else if (info.k === 'fd' || info.k === 'fm') pool = Q.fest;
  else if (st === '창고가 가득 참') pool = Q.full; else if (st.startsWith('부족')) pool = Q.wait; else if (extra.feast) pool = Q.feast; else if (extra.aurora && p.rq < 0.75) pool = Q.aurora; else if (extra.icefog && p.rq < 0.6) pool = Q.icefog; else if (extra.night && p.rq < 0.4) pool = Q.night; else if (hope >= 70 && p.rq < 0.35) pool = Q.hopeful;
  const slot = Math.floor((S.t + p.rq * 40) / 40);
  const quote = pool[Math.floor(hash3(slot, Math.floor(p.rq * 1000), 9) * pool.length)];
  let role = '';
  const bd = info.b != null ? S.buildings.find(x => x.id === info.b) : null, bn = bd ? BLD[bd.type].n : '';
  if (info.k === 'w') role = `존재하다${bn}일하다${st && st !== '가동 중' ? `（${st}）` : ''}`;
  else if (info.k === 'h') role = info.res ? (info.go ? `운반꾼: ${RES[info.res].n}을(를) ${bn}(으)로 보내기` : `운반꾼: ${bn}에서 ${RES[info.res].n}을(를) 다시 창고로 배송합니다.`) : `운반꾼: ${bn}과 창고 사이를 왔다 갔다 합니다.`;
  else if (info.k === 'f') role = '일자리가 없습니다. 장작을 모으고 야영지 근처에 함정을 설치하세요.';
  else if (info.k === 'q') role = '방금 야영지에 도착했고, 오두막집에서 빈 침대를 기다리고 있습니다.';
  else if (info.k === 'kid') role = '아이, 눈 속에서 놀고 있어';
  else if (info.k === 'g') role = '횃불을 들고 야영지 주변을 순찰하는 야간 경비원';
  else if (info.k === 'r') role = '당신에게 도움을 청할 것이 있습니다';
  else if (info.k === 'fd') role = '모닥불 축하 행사에서 춤추기';
  else if (info.k === 'fm') role = info.i === 0 ? '축하하는 드러머' : info.i === 1 ? '축하연에서 피아노 연주하기' : '축하 행사의 흥분을 지켜보세요';
  else role = info.rescue ? '구조대원들이 설원을 향해 가고 있다' : '회원 정찰대가 설원을 달리고 있습니다';
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
