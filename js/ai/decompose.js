import {power,wild,classify,legalPlays} from '../rules.js';
// Splits a hand into playable groups, maximising a static score that mostly rewards fewer hands.
export const HAND=10;
const BOMB_TIER=n=>n>=6?n+2:n;
const SEQS=[];
for(const [type,width,rep] of [['顺子',5,1],['三连对',3,2],['钢板',2,3]]){
  SEQS.push({type,rep,ranks:[14,...Array.from({length:width-1},(_,i)=>i+2)],top:width});
  for(let s=2;s<=15-width;s++)SEQS.push({type,rep,ranks:Array.from({length:width},(_,i)=>s+i),top:s+width-1});
}
export function bonus(type,value,size){
  switch(type){
    case '单张':return (value-10)*0.5;
    case '对子':return (value-10)*0.6;
    case '三张':return (value-9)*0.6;
    case '三带二':return (value-9)*0.6+0.5;
    case '顺子':return (value-9)*0.4+1;
    case '三连对':case '钢板':return (value-9)*0.4+1.5;
    case '同花顺':return HAND+9+(value-9)*0.1;
    case '天王炸':return HAND+20;
    case '炸弹':return HAND+2+BOMB_TIER(size)+(value-9)*0.1;
  }
  return 0;
}
export const groupScore=p=>-HAND+bonus(p.type,p.value,p.size)-(p.substitutions?.length||0)*(p.tier?1:2);
let memo=new Map(),memoLevel=null;
function solve(counts,w,level){
  const key=w+counts.join('');
  const hit=memo.get(key);if(hit)return hit;
  let r=2;while(r<=16&&!counts[r])r++;
  let best;
  if(r>16){
    // Leftover wild cards act as natural level cards.
    best=w?{score:-HAND+bonus(w===2?'对子':'单张',power(level,level),w),move:{type:w===2?'对子':'单张',value:power(level,level),take:[],wilds:w}}:{score:0,move:null};
    memo.set(key,best);return best;
  }
  best={score:-Infinity,move:null};
  const pw=power(r,level);
  const tryMove=(type,value,size,take,wilds,penalty)=>{
    for(const [x,n] of take)counts[x]-=n;
    const rest=solve(counts,w-wilds,level);
    for(const [x,n] of take)counts[x]+=n;
    const score=-HAND+bonus(type,value,size)-penalty+rest.score;
    if(score>best.score)best={score,move:{type,value,take,wilds}};
  };
  const wildCost=(n,rank,bomb)=>rank===level?0:n*(bomb?1:2);
  if(r>14){
    tryMove('单张',pw,1,[[r,1]],0,0);
    if(counts[r]>=2)tryMove('对子',pw,2,[[r,2]],0,0);
    if(r===15&&counts[15]===2&&counts[16]===2)tryMove('天王炸',99,4,[[15,2],[16,2]],0,0);
  }else{
    for(let k=1;k<=counts[r];k++)for(let j=0;j<=w;j++){
      const n=k+j;
      if(n<=3)tryMove(['单张','对子','三张'][n-1],pw,n,[[r,k]],j,wildCost(j,r,false));
      else if(n<=10&&k===counts[r])tryMove('炸弹',pw,n,[[r,k]],j,wildCost(j,r,true));
    }
    // Three with a pair: triple at r with a natural pair elsewhere, or pair at r under a natural triple.
    const j3=Math.max(0,3-counts[r]);
    if(j3<=w)for(let p=2;p<=16;p++)if(p!==r&&counts[p]>=2)tryMove('三带二',pw,5,[[r,3-j3],[p,2]],j3,wildCost(j3,r,false));
    if(counts[r]>=2)for(let p=r+1;p<=14;p++)if(counts[p]>=3)tryMove('三带二',power(p,level),5,[[p,3],[r,2]],0,0);
    for(const seq of SEQS){
      if(!seq.ranks.includes(r))continue;
      let deficit=0,penalty=0;const take=[];
      for(const x of seq.ranks){const have=Math.min(seq.rep,counts[x]);if(have)take.push([x,have]);const miss=seq.rep-have;deficit+=miss;penalty+=wildCost(miss,x,false);}
      if(deficit<=w)tryMove(seq.type,seq.top,seq.ranks.length*seq.rep,take,deficit,penalty);
    }
  }
  memo.set(key,best);return best;
}
function countsOf(cards,level){const counts=new Array(17).fill(0);let w=0;for(const c of cards)wild(c,level)?w++:counts[c.rank]++;return {counts,w};}
function materialize(cards,level,moves){
  const pool=new Map(),wilds=[];
  for(const c of cards){if(wild(c,level))wilds.push(c);else{if(!pool.has(c.rank))pool.set(c.rank,[]);pool.get(c.rank).push(c);}}
  return moves.map(m=>{
    const used=[...m.take.flatMap(([x,n])=>pool.get(x).splice(0,n)),...wilds.splice(0,m.wilds)];
    const options=classify(used,level);
    return options.find(p=>p.type===m.type&&p.value===m.value)||options.find(p=>p.type===m.type)||options[0];
  });
}
export function straightFlushes(cards,level){return legalPlays(cards,level).filter(p=>p.type==='同花顺').slice(0,8);}
// sfs: straight-flush candidates computed once for the full hand; those still intact in `cards` are tried.
export function decompose(cards,level,sfs=straightFlushes(cards,level)){
  if(memoLevel!==level||memo.size>400000){memo=new Map();memoLevel=level;}
  const ids=new Set(cards.map(c=>c.id));
  const run=(subset,lead)=>{
    const {counts,w}=countsOf(subset,level);const top=solve(counts,w,level);
    const moves=[];const c=[...counts];let ww=w;let m=top.move;
    while(m){moves.push(m);for(const [x,n] of m.take)c[x]-=n;ww-=m.wilds;m=solve(c,ww,level).move;}
    return {score:top.score+(lead?groupScore(lead):0),lead,moves,subset};
  };
  let best=run(cards,null);
  for(const sf of sfs){
    if(!sf.cards.every(c=>ids.has(c.id)))continue;
    const used=new Set(sf.cards.map(c=>c.id));
    const option=run(cards.filter(c=>!used.has(c.id)),sf);
    if(option.score>best.score)best=option;
  }
  const plays=[...(best.lead?[best.lead]:[]),...materialize(best.subset,level,best.moves)];
  return {score:best.score,plays,hands:plays.filter(p=>!p.tier).length,bombs:plays.filter(p=>p.tier).length};
}
