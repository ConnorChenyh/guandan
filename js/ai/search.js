import {power,wild,shuffle} from '../rules.js';
import {act,observation} from '../game.js';
import {makeTracker} from './tracker.js';
import {rankMoves} from './strategy.js';
// Endgame: deal the unseen cards many plausible ways and play each candidate out; never reads real hidden hands.
const team=i=>i%2;
function consistent(cards,limits,level){
  const pw=c=>power(c.rank,level);
  if(limits['单张1']!==undefined&&cards.some(c=>pw(c)>limits['单张1']))return false;
  if(limits['对子2']!==undefined){
    const n={};let w=0;for(const c of cards)wild(c,level)?w++:n[c.rank]=(n[c.rank]||0)+1;
    for(const [r,k] of Object.entries(n))if(power(+r,level)>limits['对子2']&&k+(+r<=14?w:0)>=2)return false;
  }
  return true;
}
function sample(tr,obs,random){
  const others=[0,1,2,3].filter(i=>i!==obs.player&&obs.counts[i]>0);
  let hands;
  for(let attempt=0;attempt<8;attempt++){
    const pool=shuffle(tr.unknown,random);let at=0;hands=[];
    for(const i of others){hands[i]=pool.slice(at,at+obs.counts[i]);at+=obs.counts[i];}
    if(others.every(i=>consistent(hands[i],tr.noBeat[i],obs.level)))break;
  }
  return hands;
}
function rollout(obs,hands,play,deadline){
  const me=obs.player;
  const s={version:1,difficulty:'normal',level:obs.level,levels:[2,2],aFailures:[0,0],dealer:0,round:1,history:[],log:[],stats:{rounds:0,wins:0},
    hands:[0,1,2,3].map(i=>i===me?[...obs.hand]:hands[i]?[...hands[i]]:[]),last:obs.last,pending:[...obs.pending],finished:[...obs.finished],
    table:[null,null,null,null],lastPlays:[null,null,null,null],seen:[],actions:[...obs.history],phase:'playing',turn:me};
  act(s,me,play?.cards.map(c=>c.id),play);
  for(let steps=0;s.phase==='playing'&&steps<300;steps++){
    if(Date.now()>deadline)return null;
    const p=rankMoves(observation(s),{tracking:false})[0].play;
    act(s,s.turn,p?.cards.map(c=>c.id),p);
  }
  if(!s.result)return 0;
  return s.result.win===team(me)?s.result.gain:-s.result.gain;
}
export function search(obs,candidates,random,ms){
  const tr=makeTracker(obs);
  const others=obs.counts.reduce((n,c,i)=>i===obs.player?n:n+c,0);
  if(tr.unknown.length!==others)return candidates[0].play;
  const deadline=Date.now()+ms;const totals=candidates.map(()=>0);let samples=0;
  while(Date.now()<deadline&&samples<120){
    const hands=sample(tr,obs,random);const scores=[];
    for(const c of candidates){const v=rollout(obs,hands,c.play,deadline);if(v===null)break;scores.push(v);}
    if(scores.length<candidates.length)break;
    scores.forEach((v,i)=>totals[i]+=v);samples++;
  }
  if(samples<6)return candidates[0].play;
  let best=0;totals.forEach((t,i)=>{if(t>totals[best])best=i;});
  return candidates[best].play;
}
