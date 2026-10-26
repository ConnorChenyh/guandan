export const SUITS = ['♠', '♥', '♣', '♦'];
export const label = r => ({11:'J',12:'Q',13:'K',14:'A',15:'小王',16:'大王'}[r] || String(r));
export const power = (r, level) => r > 14 ? r + 3 : r === level ? 17 : r;
export const wild = (c, level) => c.rank === level && c.suit === 1;
export function deck() {
  const cards = [];
  for (let d=0;d<2;d++) {
    for (let s=0;s<4;s++) for(let r=2;r<=14;r++) cards.push({id:`${d}-${s}-${r}`,rank:r,suit:s});
    for(let r=15;r<=16;r++) cards.push({id:`${d}-j-${r}`,rank:r,suit:4});
  }
  return cards;
}
export function shuffle(cards, random=Math.random) {
  const a=[...cards]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;
}
export function sortHand(cards, level) { return [...cards].sort((a,b)=>power(b.rank,level)-power(a.rank,level)||a.suit-b.suit||a.id.localeCompare(b.id)); }
const cache=new Map();
function templates(level) {
  if(cache.has(level)) return cache.get(level);
  const out=[];
  const add=(type,ranks,value,tier=0,suit=null)=>out.push({type,ranks,value,tier,suit,size:ranks.length});
  for(let r=2;r<=16;r++) {
    add('单张',[r],power(r,level)); add('对子',[r,r],power(r,level));
    if(r>14) continue;
    add('三张',[r,r,r],power(r,level));
    for(let p=2;p<=16;p++) if(p!==r) add('三带二',[r,r,r,p,p],power(r,level));
    for(let n=4;n<=10;n++) add('炸弹',Array(n).fill(r),power(r,level),n>=6?n+2:n);
  }
  const runs = (width,repeat,type) => {
    const sequences=[Array.from({length:width},(_,i)=>i===0?14:i+1)];
    for(let start=2;start<=15-width;start++) sequences.push(Array.from({length:width},(_,i)=>start+i));
    for(const seq of sequences) {
      const ranks=seq.flatMap(r=>Array(repeat).fill(r));
      add(type,ranks,seq[seq.length-1]);
      if(type==='顺子') for(let s=0;s<4;s++) add('同花顺',ranks,seq[seq.length-1],7,s);
    }
  };
  runs(5,1,'顺子'); runs(3,2,'三连对'); runs(2,3,'钢板');
  add('天王炸',[15,15,16,16],99,99);
  cache.set(level,out);return out;
}
function fill(hand,t,level) {
  if(t.size>hand.length) return null;
  const free=hand.filter(c=>wild(c,level));
  const normal=hand.filter(c=>!wild(c,level));
  const used=[];const substitutions=[];
  for(const rank of t.ranks) {
    let i=normal.findIndex(c=>c.rank===rank&&(t.suit===null||c.suit===t.suit));
    let card;
    if(i>=0) card=normal.splice(i,1)[0];
    else {
      // Jokers cannot be substituted; a single wild card keeps its face value.
      if(!free.length||rank>14||(t.size===1&&rank!==level)) return null;
      card=free.shift();
      if(rank!==card.rank||(t.suit!==null&&t.suit!==card.suit)) substitutions.push({id:card.id,rank,suit:t.suit});
    }
    used.push(card);
  }
  return {...t,cards:used,substitutions};
}
export function beats(a,b) {
  if(!b) return true;
  if(a.tier!==b.tier) return a.tier>b.tier;
  if(a.tier) return a.value>b.value;
  return a.type===b.type&&a.size===b.size&&a.value>b.value;
}
export function classify(cards,level) {
  if(!cards.length||new Set(cards.map(c=>c.id)).size!==cards.length) return [];
  return templates(level).filter(t=>t.size===cards.length).map(t=>fill(cards,t,level)).filter(Boolean)
    .sort((a,b)=>a.tier-b.tier||a.value-b.value);
}
export function resolvePlay(cards,level,previous=null) {
  const options=classify(cards,level).filter(p=>beats(p,previous));
  // Prefer a straight flush, natural or wild-filled, over interpreting it as an ordinary straight when leading.
  const base=(!previous&&options.find(p=>p.type==='同花顺'))||options[0];
  if(!base)return null;
  // When wild cards fit either end of the same pattern (e.g. 2-6 or 3-7), default to the larger reading.
  return options.filter(p=>p.type===base.type&&p.tier===base.tier).reduce((a,b)=>b.value>a.value?b:a);
}
export function legalPlays(hand,level,previous=null) {
  const seen=new Set();const out=[];
  for(const t of templates(level)) {
    if(!beats(t,previous))continue;
    const p=fill(hand,t,level);if(!p)continue;
    const key=p.cards.map(c=>c.id).sort().join(',')+'|'+p.type+'|'+p.value;
    if(!seen.has(key)){seen.add(key);out.push(p);}
  }
  return out;
}
