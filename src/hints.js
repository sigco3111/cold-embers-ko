// 新玩法提示：新手引导走完以后，某个玩法第一次用得上时，弹一张小卡片说一句怎么用（每样只说一次）
import { BLD, FOCUS_LVL } from './data.js';
import * as Sim from './sim.js';
import { iconize } from './icons.js';
import { CHANGELOG, VERSION_NAME } from './changelog.js';
import { THEMES } from './theme.js';

const GAP = 75, FIRST = 25; // 两张提示至少隔 75 秒；打开游戏 25 秒后才开始
const make = S => c => S.buildings.filter(b => b.camp === c.id && BLD[b.type].cat === 'make');

// when(S, c, cr, g) 返回 false 表示还用不上；返回 { act, arg } 表示「去看看」按钮要做什么（没有按钮就返回 true）
export const HINTS = [
  { id: 'gang', ic: '🏴', n: '약탈자가 공물을 요구하러 왔습니다', d: '하단에 있는 늙은 길잡이의 작은 막대 또는 오른쪽 상단에 있는 알림 벨을 클릭하여 답장하세요. 경의를 표하고 사업을 수행하거나 화살탑에 의지하여 뒤로 물러서세요. 때가 되면 아무도 대답하지 않을 것이다. 방어할 수 있으면 공격하겠습니다. 우리가 그것을 방어할 수 없다면, 우리는 조공을 바칠 것입니다.',
    when: S => { const d = Sim.gangDemands(S)[0]; return d ? { act: 'gang', arg: d.g.id } : false; } },
  { id: 'net', ic: '🛷', n: '도로가 복구되었습니다', d: '새로운 야영지가 점화되자마자 가장 가까운 야영지에 연결된 썰매 경로가 생깁니다. 여기에 건물을 배치하면 됩니다. 누락된 목재, 목판, 석재, 물류망은 잉여 야영지에서 스스로 운송됩니다. "생산 → 물류"에서는 도로에 무엇이 운반되고 있는지 확인할 수 있습니다.',
    when: (S, c) => { const m = Sim.mainCamp(S); return c && m && c.id !== m.id && !c.depot && Sim.roadsAt(S, c.id).length ? { act: 'netview', arg: c.id } : false; } },
  { id: 'wxe', ic: '❄', n: '이상한 날씨가 오고 있어요', d: '얼음 폭풍, 극도로 추운 밤, 얼음호수 균열은 모두 사전에 예측됩니다. 오른쪽 상단의 알림 벨을 켜고 재료를 사용하여 미리 준비하면 많은 수고를 덜 수 있습니다.',
    when: (S, c) => { const e = Sim.wxeAt(S, S.t); return e.ev && !e.on && e.inSec <= Sim.forecastOf(S) && Sim.wxeMatters(S, c, e.ev) && !Sim.wxePrepped(S, c, e.ev) ? { act: 'wx' } : false; } },
  { id: 'ward', ic: '🩺', n: '누군가 아프다', d: '진료소를 만들고 두 사람을 보내서 관리하게 하세요. 그 안에 살고 있는 환자는 추운 날씨에 점차 나아질 것이고, 야영지에서는 아픈 사람이 줄어들 것입니다.',
    when: (S, c, cr) => (cr.sick || 0) >= 1 && Sim.unlocked(S, 'infirmary') && !Sim.countType(S, c.id, 'infirmary') ? { act: 'tb', arg: 'build' } : false },
  { id: 'deep', ic: '⛏', n: '광산은 거의 비어있습니다', d: '광산 패널에서 "깊은 우물을 파낼" 수 있습니다. 표면이 채굴된 후에는 천천히 더 깊게 파낼 수 있습니다. 정찰 막사는 일손 배치를 사용하여 새로운 광물맥을 탐색할 수도 있습니다.',
    when: (S, c) => { const gs = Sim.rt(S).gatherSpots; const b = S.buildings.find(b => b.camp === c.id && !b.deep && Sim.deepable(b.type) && gs && (gs.get(b.id) || []).length && Sim.gatherLeftFrac(S, b) <= 0.25); return b ? { act: 'reqgo', arg: b.id } : false; } },
  { id: 'chain', ic: '🔗', n: '생산 체인 개요', d: 'C(또는 "생산 → 생산 라인"의 생산 체인 다이어그램)를 누르면 전체 생산 체인을 볼 수 있습니다. 어떤 링크에 인력, 자재가 부족하거나 꽉 차 있는지 한 눈에 볼 수 있습니다.',
    when: (S, c) => make(S)(c).length >= 2 && S.buildings.filter(b => b.camp === c.id).length >= 10 ? { act: 'chainmap' } : false },
  { id: 'bulk', ic: '⬆', n: '한 번에 여러 채', d: '같은 종류 건물이 많아지면 패널에서 "모두 한 단계 업그레이드"와 "일손 모두 배치"를 쓸 수 있습니다. 건설할 때 한 번에 한 줄로 놓을 수도 있습니다.',
    pc: '건설할 때 왼쪽 버튼을 누른 채 드래그하면 한 번에 한 줄로 놓습니다.', touch: '건설할 때 먼저 "한 줄"을 누른 뒤 미리보기를 드래그하면 한 번에 한 줄로 놓습니다.',
    when: (S, c) => { const n = {}; for (const b of S.buildings) if (b.camp === c.id && b.type !== 'tent' && BLD[b.type].cat !== 'deco' && b.type !== 'furnace') if ((n[b.type] = (n[b.type] || 0) + 1) >= 3) return { act: 'reqgo', arg: b.id }; return false; } },
  { id: 'fest', ic: '🎉', n: '지금부터 모닥불 축하를 할 수 있습니다', d: '용광로 패널에서 축하 행사를 열 수 있습니다. 일부 요리 및 목재를 사용하고 모두 잠시 쉬게 하면 희망이 갑자기 상승하고 이후에는 더욱 활발하게 작업할 수 있습니다.',
    when: (S, c) => !Sim.festBlock(S, c) && (c.hope ?? 50) < 60 ? { act: 'reqgo', arg: c.furnace } : false },
  { id: 'focus', ic: '🧭', n: '야영지는 이제 전문화를 선택할 수 있습니다.', d: '용광로가 도착했습니다' + FOCUS_LVL + '레벨: "야영지 → 개요"에서 광업, 농경, 공방 또는 요새를 선택합니다. 강점은 동일하고 약점은 동일합니다.',
    when: (S, c) => !c.focus && !c.trade && (Sim.getB(S, c.furnace) || {}).lvl >= FOCUS_LVL ? { act: 'tb', arg: 'camp' } : false },
  { id: 'belt', ic: '⛓', n: '컨베이어 벨트', d: '가공 건물의 패널은 컨베이어 벨트에 연결될 수 있습니다. 상류와 하류가 서로 가깝고 자재를 직접 공급할 수 있습니다. 운반꾼을 적게 사용하면 다운스트림이 더 빨라집니다.',
    slow: true,
    when: (S, c) => { if (S.known < Sim.BELT[1].tier || (S.belts || []).length) return false; for (const b of make(S)(c)) if (Sim.beltOptions(S, b.id).some(o => o.ck.ok)) return { act: 'reqgo', arg: b.id }; return false; } },
  { id: 'kennel', ic: '🐕', n: '썰매견 사육장', d: '썰매 개를 키우기 위해 개집을 건설하세요. 정찰대는 더 빨리 달리고, 이 야영지를 연결하는 도로에도 더 많은 교통량이 있습니다. 개는 생고기를 먹고 싶어합니다.',
    when: (S, c) => Sim.countType(S, c.id, 'scout') && !S.buildings.some(b => b.type === 'kennel') && S.buildings.filter(b => b.camp === c.id).length >= 14 ? { act: 'tb', arg: 'build' } : false },
  { id: 'deco', ic: '🏮', n: '장식 건물', d: '가로등, 깃대, 조각상 및 꽃 저장고는 아무것도 생성하지 않지만 민심을 조금 더 밝게 만들 수 있습니다(+ 희망). 모두가 자주 다니는 길가, 용광로 옆에 놓아두세요.',
    when: (S, c) => (c.hope ?? 50) < 50 && S.buildings.filter(b => b.camp === c.id).length >= 16 && !S.buildings.some(b => BLD[b.type].cat === 'deco') ? { act: 'tb', arg: 'build' } : false },
  { id: 'curve', ic: '📈', n: '데이터 곡선', d: 'G(또는 "메뉴 → 컬렉션")를 눌러 곡선을 확인하세요. 지난 몇 시간 동안 인구, 온도 및 재료 매장량이 어떻게 변했는지, 어디에서 천천히 감소하고 있는지를 확인하세요.',
    when: (S, c) => (c.hist && c.hist.f && c.hist.f.n >= 40) ? { act: 'curve' } : false },
  { id: 'depart', ic: '🛷', n: '알았어 북상', d: '출발 전 4가지 준비물이 준비되어 있습니다. "북행 → 북상"를 열고 탑승할 인원과 물품 수, 뒤에 있는 야영지가 뒤에 남을 것인지 꺼질 것인지를 선택한 후 이동을 누르세요. 행렬이 이동 중인 동안에는 야영지가 평소처럼 작동합니다.',
    when: S => { const g = Sim.departGate(S); return g && g.ok && !Sim.journeyOf(S).trip ? { act: 'tb', arg: 'migrate' } : false; } },
  { id: 'trip', ic: '🚩', n: '행렬이 이동 중입니다.', d: '"북행 → 북상"에서는 행렬이 어디로 가는지, 얼마나 걸리는지 확인할 수 있습니다. 카메라를 따라가려면 "행렬 따라가기"를 클릭하세요. 도착 후 평평한 땅을 골라 새 용광로를 내려놓으세요. 새로운 본영이 있을 것입니다.',
    when: S => { const T = Sim.journeyOf(S).trip; return T && T.phase !== 'arrive' && !Sim.roadView(S) ? { act: 'tb', arg: 'migrate' } : false; } },
  { id: 'photo', ic: '📷', n: '사진 모드', d: 'H(또는 "메뉴 → 컬렉션")를 눌러 사진 모드로 들어갑니다. 인터페이스를 숨기고, 시간, 필터 및 렌즈 각도를 변경하고, 야영지 사진을 찍습니다.',
    when: S => S.camps.length >= 2 || S.buildings.length >= 40 ? { act: 'photo' } : false },
];

// 1.2：新玩法不再弹卡片，交给老向导的小条（ui.guideAdd）；小条里最多攒 2 条没看完的，两条之间至少隔 75 秒
export class Hints {
  constructor(g) { this.g = g; this.t = 0; this.since = -FIRST; this.slowT = 0; }
  seen(S) { return (S.meta.hints ||= {}); }
  // 每帧调；内部每 2 秒查一次
  tick(dt) {
    const g = this.g, S = g.S, ui = g.ui;
    this.t += dt; this.since += dt; this.slowT += dt;
    if (this.t < 2) return; this.t = 0;
    const blocked = !S.meta.tut || S.meta.hintOff || g.titleOn || (g.photo && g.photo.on) || g.place || document.getElementById('modal').classList.contains('show');
    if (blocked || this.since < GAP || ui.guideHints().length >= 2) return;
    const slow = this.slowT > 10; if (slow) this.slowT = 0;
    const c = Sim.getCamp(S, S.active) || S.camps[0], cr = Sim.rt(S).c[c.id] || {}, seen = this.seen(S);
    for (const h of HINTS) {
      if (seen[h.id] || (h.slow && !slow)) continue;
      let r = false; try { r = h.when(S, c, cr, g); } catch (e) { r = false; }
      if (!r) continue;
      this.show(S, h, r === true ? null : r);
      break;
    }
  }
  show(S, h, a) {
    this.seen(S)[h.id] = 1; // 贴出来就算看过：刷新页面不会再贴
    const extra = this.g.isTouch() ? h.touch : h.pc;
    this.g.ui.guideAdd({ id: h.id, ic: h.ic, n: h.n, d: h.d + (extra ? ' ' + extra : ''), a });
    this.since = 0;
  }
  hide() { this.g.ui.guideHints().length = 0; }
}

// 老存档第一次打开新版：说一下这版加了什么，老存档是怎么接上的（from：存档原来是第几版）
export const WHATS_NEW = 16; // 14 = 1.0.0 正式版，15 = 1.1.0 炉火连城，16 = 1.2.0 霜铁点灯
export function whatsNewHtml(S, from = 13, pref = 'auto') {
  const J = Sim.journeyOf(S), main = Sim.mainCamp(S), depots = S.camps.filter(c => c.depot);
  Sim.bookTick(S); // 先把老存档早就做到的新成就补发了，下面好说个数
  const B = Sim.bookOf(S), got = Sim.ACH.filter(a => a.cat && B.a[a.id]).length;
  const atSpine = J.stage === Sim.SPINE && !J.trip, north = Sim.northN(J.stage);
  const notes = [];
  if (from < 12) {
    const back = S.meta.refund12 || 0;
    notes.push(`12판의 변경 사항도 함께 적용되었습니다. 북상는 더 이상 라운드를 다시 시작하지 않습니다.${main.name}"이제는 본영다.${depots.length ? `，${depots.map(c => '「' + c.name + '」').join('、')}공급 창고가 되어보세요` : ''};각 장의 첫 번째 목표는 "분당 얼마나 생산되는지"로 변경됩니다. 4배 빠른 속도로 오프라인는 온라인보다 느리게 리소스를 축적합니다.${back ? `손재주 향상의 추가 수준이 반환됩니다 🔥${back}잔불.` : ''}`);
  }
  if (atSpine) notes.push('행렬은 세계의 척추에 정차했으며 북쪽으로 가는 길이 열려 있습니다. 북상 패널의 다음 정류장은 "북방 스테이션 1"입니다.');
  else if (north) notes.push(`이미 북방의 ${north} 역에 있습니다. 북쪽으로 가세요.`);
  if (got && from < 13) notes.push(`이전에 수행한 작업이 계산되었습니다. ${got}개의 새 업적이 재발행되었으며 "메뉴 → 컬렉션 → 드레스업"에서 보상이 교체되었습니다.`);
  if (from < 15) {
    const nr = (S.meta.netNew || []).length, sp = S.camps.filter(c => c.spec).length, bots = S.buildings.reduce((a, b) => a + (b.bots || 0), 0);
    notes.push(`1.1 연결됨:${nr ? `원래 운송 라인과 보급 창고는 물류망로 교체되고 새로 수리되었습니다.${nr}도로; 도로` : S.camps.length > 1 ? '원래 운송 노선은 물류망로 대체되었습니다.' : ''}${sp ? `각 야영지에는 지형에 따라 특수 제품이 할당됩니다.` : ''}근무 중인 건물은 숙련도 1부터 계산됩니다. 이전 연구는 여전히 존재합니다.${bots ? `야영지에서${bots}대만 오토마톤는 노동형로 창고에 다시 적재되었습니다.` : ''}${S.cold ? '한파는 하루 안에 보고를 시작합니다.' : ''}${north >= 4 ? '북방의 네 번째 관측소가 통과되었으며 영동조의 첫 번째 물결은 약 이틀 후에 보고될 예정입니다.' : ''}불러오기 이전에 복사본이 자동으로 백업되었으며, "메뉴 → 저장 → 자동 백업"에서 되돌릴 수 있습니다.`);
  }
  if (from >= 15) notes.unshift('이번 버전에서는 인터페이스만 변경되었을 뿐 게임 플레이와 가치관은 그대로 유지되었습니다.');
  notes.push('저장에서는 아무것도 손실되지 않았습니다.');
  const CL = v => CHANGELOG.find(c => c.v === v);
  const W12 = [['🎨', '스큐어모피즘과 따뜻함과 차가움', 0], ['✨', '새로운 아이콘', 1], ['⚙', 'PC 버전', 2], ['🔔', '프롬프트가 작아짐', 3], ['📖', '남은 창', 4]];
  const v12 = W12.map(([ic, n, i]) => `<div class="wn"><b>${ic} ${n}</b><span>${CL('v1.2.0').items[i]}</span></div>`).join('');
  // 当场选配色：点了就换，再点别的也行，「知道了」才关
  const pick = `<div class="wnpick"><b>색 구성표를 먼저 선택하세요</b><small>"메뉴 → 설정 → 인터페이스 색상 색상"에서 언제든지 변경할 수 있습니다.</small><div class="seg">${THEMES.map(([k, n, d]) => `<button class="btn ${pref === k ? 'on' : ''}" data-act="wn-theme" data-arg="${k}">${n}<small>${k === 'auto' ? '눈오면 추워지는데' : d}</small></button>`).join('')}</div></div>`;
  const W11 = [['🧭', '새로운 인터페이스', 0], ['🛷', '물류망', 1], ['⚗', '조리법 및 특산품', 2], ['🌨', '숙련공 및 한파', 3], ['🏪', '북방 상회', 4], ['🔬', '45개 항목연구', 5], ['🤖', '오토마톤 및 명령', 6], ['🗺', '분기점 및 기연', 7], ['🏛', '불가사의 및 마을', 8], ['🔥', '딩성허 영동조', 9]];
  const v11 = W11.map(([ic, n, i]) => `<div class="wn"><b>${ic} ${n}</b><span>${CL('v1.1.0').items[i]}</span></div>`).join('');
  const more = `<p class="hint">"메뉴 → 도움말 → 업데이트 로그"에서 각 버전에 추가된 내용을 확인할 수 있습니다. </p>`;
  const head = `<h2>${VERSION_NAME}</h2>${pick}${v12}`;
  if (from >= 15) return `${head}<div class="wn"><b>📜 귀하의 저장</b><span>${notes.join('')}</span></div>${more}`;
  if (from >= 14) return `${head}<p class="hint wnfirst">1.1.0의 변경 사항도 여기에 있습니다:</p>${v11}<div class="wn"><b>📜 저장</b><span>${notes.join('')}</span></div>${more}`;
  const v1 = `<div class="wn"><b>🎉 1.0.0 공식 버전</b><span>${CL('v1.0.0').items.map(t => '· ' + t).join('<br>')}</span></div>`;
  if (from >= 13) return `${head}<p class="hint wnfirst">1.1.0 Fire City 및 1.0.0 공식 버전 변경 사항도 여기에 있습니다:</p>${v11}${v1}<div class="wn"><b>📜 귀하의 저장</b><span>${notes.join('')}</span></div>${more}`;
  return `${head}<p class="hint wnfirst">1.1.0 The Great Fire, 1.0.0 공식 버전 및 13판 "Ultra North"의 콘텐츠도 여기에 있습니다:</p>${v11}${v1}
<div class="wn"><b>🧭 Endless 북방</b><span>세계의 척추를 넘어도 북쪽으로 갈 수 있습니다. 북방의 각 스테이션에는 지열 골짜기, 부광대, 영야, 늑대 무리 영역, 얼음호수 지대, 고성 유적지, 폭풍 회랑, 운석비, 나무 없는 동토... 각각 고유한 장점과 문제점이 있으며 독점적인 지형도 있습니다. 과제. 이동한 가장 먼 정거장이 메뉴와 지도에 기록됩니다. </span></div>
<div class="wn"><b>🗼 봉화탑</b><span>북방 처음 10개 스테이션 각각에서 봉화탑을 켜세요: 기초 공사, 고급 재료를 공급하고 점화하면 빛의 광선이 다시 남쪽으로 연결됩니다. 열 번째 정류장은 천화탑입니다. 클릭하시면 최종 결과를 보실 수 있습니다. </span></div>
<div class="wn"><b>🏆 업적 및 드레스업</b><span>20개의 새로운 업적, 보상칭호, 불꽃 색상, 캠프 깃발 패턴, 사진 프레임 및 8개의 북방장식. 사진 앨범은 도착 순간과 타워 클릭 순간을 자동으로 기록하며 사진 모드에도 포함될 수 있습니다. </span></div>
<div class="wn"><b>⛏ 광산 지점 계획</b><span> 광산이 곧 파헤쳐지면 미리 알려주고, 언제든지 저렴한 탐사를 보충할 수 있습니다. 건물을 배치하면 광산 지점이 차단되고 미리보기가 노란색으로 변합니다. 건물은 자재를 사용하지 않고도 "이동"할 수 있습니다. 지상의 금성이 권장되는 위치입니다. 플래너는 건물이 몇 개 남았는지 알려줄 것입니다. </span></div>
<div class="wn"><b>💾 저장</b><span>저장은 파일로 저장하고 파일에서 다시 읽을 수 있습니다. 저장 비트는 삭제될 수 있습니다. 찍은 사진은 직접 저장할 수 있습니다. </span></div>
<div class="wn"><b>📜 귀하의 저장</b><span>${notes.join('')}</span></div>`;
}
