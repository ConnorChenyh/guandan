// Self-play benchmark (not part of npm test): node tests/bench.mjs [deals] [policyA] [policyB]
// Each deal is played twice with the teams swapped, so card luck cancels out.
import {newGame,act,observation} from '../js/game.js';
import {choose} from '../js/ai.js';
import {choose as legacy} from './legacy-ai.js';
function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const policies={
  easy:(o,r)=>choose({...o,difficulty:'easy'},r),
  'old-normal':(o,r)=>legacy({...o,difficulty:'normal'},r),
  'old-hard':(o,r)=>legacy({...o,difficulty:'hard'},r),
  normal:(o,r)=>choose({...o,difficulty:'normal'},r),
  hard:(o,r)=>choose({...o,difficulty:'hard'},r),
  'hard+search':(o,r)=>choose({...o,difficulty:'hard'},r,{searchMs:150}),
};
const [deals=200,a='normal',b='old-normal']=process.argv.slice(2);
function play(start,seats,random){
  const s=JSON.parse(JSON.stringify(start));let steps=0,slowest=0;
  while(s.phase==='playing'&&steps++<3000){
    const t0=performance.now();const p=policies[seats[s.turn%2]](observation(s),random);slowest=Math.max(slowest,performance.now()-t0);
    act(s,s.turn,p?.cards.map(c=>c.id),p);
  }
  return {score:s.result.win===0?s.result.gain:-s.result.gain,slowest};
}
let total=0,wins=0,games=0,slowest=0;
for(let d=0;d<+deals;d++){
  const original=Math.random;Math.random=seeded(1000+d);const start=newGame();Math.random=original;
  for(const [seats,sign] of [[[a,b],1],[[b,a],-1]]){
    const r=play(start,seats,seeded(9000+d));total+=r.score*sign;if(r.score*sign>0)wins++;games++;slowest=Math.max(slowest,r.slowest);
  }
}
console.log(`${a} vs ${b}: ${games} games, ${a} won ${(wins/games*100).toFixed(1)}%, avg level swing ${(total/games).toFixed(3)} per game, slowest move ${slowest.toFixed(0)}ms`);
