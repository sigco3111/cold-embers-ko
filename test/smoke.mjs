import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
const S = G.newRun(G.defaultMeta(), 0, 12345);
const c = S.camps[0];
console.log('camp', c.name, c.x, c.y, 'people', c.people, 'stock', c.stock);
// try placing a lumber camp near the furnace
function tryPlace(type){
  for (let r=2;r<14;r++) for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++){
    const x=Math.floor(c.x)+dx, y=Math.floor(c.y)+dy; const ck=G.checkPlace(S,type,x,y);
    if (ck.ok && (!BLD[type].gather || ck.spots>0)) { G.place(S,type,x,y); return [x,y,ck]; }
  }
  return null;
}
console.log(tryPlace('lumber')); console.log(tryPlace('hunter')); console.log(tryPlace('tent'));console.log(tryPlace('kitchen'));
for (let i=0;i<600;i++) G.step(S,1);
console.log('after 10 min', c.people, Object.fromEntries(Object.entries(c.stock).map(([k,v])=>[k,Math.round(v)])), G.rt(S).c[c.id]);
console.log(S.log.map(l=>l.msg));
