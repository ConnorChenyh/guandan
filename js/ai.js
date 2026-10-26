import {chooseBasic} from './ai/basic.js';
import {rankMoves} from './ai/strategy.js';
import {search} from './ai/search.js';
// easy: the original lightweight heuristic. normal: hand planning. hard: planning + card counting + endgame search.
export function choose(obs,random=Math.random,{searchMs=0}={}){
  if(obs.difficulty==='easy')return chooseBasic(obs,random);
  const hard=obs.difficulty==='hard';
  const ranked=rankMoves(obs,{tracking:hard});
  const remaining=obs.counts.reduce((a,b)=>a+b,0);
  if(hard&&searchMs>0&&ranked.length>1&&ranked[0].value<1e9&&remaining<=40)
    return search(obs,ranked.slice(0,6),random,searchMs);
  return ranked[0].play;
}
