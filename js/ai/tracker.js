import {deck,power,wild,beats} from '../rules.js';
// Public-information card counting: what can still be out there, and what passes reveal.
const team=i=>i%2;
const SEQS={};
for(const [type,width,rep] of [['顺子',5,1],['三连对',3,2],['钢板',2,3]]){
  SEQS[type]={rep,list:[{ranks:[14,...Array.from({length:width-1},(_,i)=>i+2)],top:width}]};
  for(let s=2;s<=15-width;s++)SEQS[type].list.push({ranks:Array.from({length:width},(_,i)=>s+i),top:s+width-1});
}
const keyOf=p=>p.type+p.size;
export function makeTracker(obs,{useSeen=true,useInference=true}={}){
  const {level,player:me,counts}=obs;
  const known=new Set(obs.hand.map(c=>c.id));
  if(useSeen)for(const c of obs.seen||[])known.add(c.id);
  const unknown=deck().filter(c=>!known.has(c.id));
  const out=new Array(17).fill(0);let outWild=0;
  for(const c of unknown)wild(c,level)?outWild++:out[c.rank]++;
  // A player who passed on an opponent's ordinary play is assumed to hold nothing of that shape above it.
  const noBeat=[{},{},{},{}];
  if(useInference)for(const a of obs.history||[])
    if(a.pass&&a.vs&&!a.vs.tier&&team(a.p)!==team(a.vs.p)){const k=keyOf(a.vs);noBeat[a.p][k]=Math.min(noBeat[a.p][k]??99,a.vs.value);}
  const pw=r=>power(r,level);
  function shapeOut(play){
    const v=play.value;
    switch(play.type){
      case '单张':for(let r=2;r<=16;r++)if(out[r]&&pw(r)>v)return true;return outWild>0&&pw(level)>v;
      case '对子':for(let r=2;r<=16;r++)if(pw(r)>v&&out[r]+(r<=14?outWild:0)>=2)return true;return false;
      case '三张':case '三带二':for(let r=2;r<=14;r++)if(pw(r)>v&&out[r]+outWild>=3)return true;return false;
      case '顺子':case '三连对':case '钢板':{
        const {rep,list}=SEQS[play.type];
        return list.some(s=>s.top>v&&s.ranks.reduce((d,x)=>d+Math.max(0,rep-out[x]),0)<=outWild);
      }
    }
    return false;
  }
  function bombOut(play){
    if(out[15]===2&&out[16]===2)return true;
    for(let r=2;r<=14;r++){const n=Math.min(10,out[r]+outWild);if(n>=4&&beats({tier:n>=6?n+2:n,value:pw(r)},play))return true;}
    if(play.tier<7){
      // Straight flush needs five suited, consecutive unknown cards (wilds may fill gaps).
      const has=new Set(unknown.filter(c=>!wild(c,level)).map(c=>c.suit*100+c.rank));
      for(let s=0;s<4;s++)for(const q of SEQS['顺子'].list){
        const miss=q.ranks.filter(x=>!has.has(s*100+x)).length;
        if(miss<=outWild&&beats({tier:7,value:q.top},play))return true;
      }
    }
    return false;
  }
  const opps=[(me+1)%4,(me+3)%4].filter(i=>counts[i]>0);
  // Can an active opponent answer this play without a bomb (or, for bombs, with a bigger bomb)?
  function opponentMayBeat(play){
    if(play.tier)return bombOut(play);
    if(!shapeOut(play))return false;
    if(!useInference)return true;
    return opps.some(o=>!(noBeat[o][keyOf(play)]<=play.value));
  }
  return {out,outWild,unknown,noBeat,opps,isControl:p=>!opponentMayBeat(p),opponentMayBeat,bombOut};
}
