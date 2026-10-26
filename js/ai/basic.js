import {legalPlays,wild,power} from '../rules.js';
export function chooseBasic(obs,random=Math.random) {
  const {hand,level,player,counts,last,difficulty}=obs;
  const plays=legalPlays(hand,level,last?.play);
  if(!plays.length)return null;
  const win=plays.find(p=>p.size===hand.length);if(win)return win;
  const mate=(player+2)%4;const ally=last&&last.player===mate;
  if(difficulty==='easy') {
    if(ally&&random()<0.75)return null;
    const ordinary=plays.filter(p=>!p.tier);const pool=ordinary.length?ordinary:plays;
    if(last&&!ally&&pool[0].tier&&random()<0.6)return null;
    return pool[Math.floor(random()*pool.length)];
  }
  if(ally&&counts[mate]<=6)return null;
  const danger=counts.some((n,i)=>i%2!==player%2&&n>0&&n<=2);
  const freq={};hand.forEach(c=>freq[c.rank]=(freq[c.rank]||0)+1);
  const score=p=>{
    let value=p.size*13-p.value*0.6-p.cards.filter(c=>wild(c,level)).length*15;
    if(p.tier)value-=last?(danger?10:65):24;
    for(const c of p.cards)if(freq[c.rank]>=4&&p.type!=='炸弹')value-=10;
    if(ally)value-=30;
    if(danger&&last)value+=p.value*1.5;
    if(counts[mate]>0&&counts[mate]<=2&&!last&&p.size===counts[mate])value+=20-p.value;
    return value;
  };
  let ranked=plays.map(p=>({p,score:score(p)})).sort((a,b)=>b.score-a.score);
  if(difficulty==='hard') {
    // Bounded look-ahead over our own remaining cards, never opponents' hidden hands.
    for(const entry of ranked.slice(0,14)) {
      const ids=new Set(entry.p.cards.map(c=>c.id));let rest=hand.filter(c=>!ids.has(c.id));let turns=0;
      while(rest.length&&turns<9){
        const future=legalPlays(rest,level).sort((a,b)=>b.size-a.size||a.value-b.value)[0];
        const used=new Set(future.cards.map(c=>c.id));rest=rest.filter(c=>!used.has(c.id));turns++;
      }
      entry.score-=turns*10+rest.length*3;
      // Publicly exposed top cards make remaining controls more valuable.
      const exposed=(obs.seen||[]).filter(c=>power(c.rank,level)>entry.p.value).length;
      if(danger)entry.score+=Math.min(8,exposed)*0.5;
    }
    ranked=ranked.slice(0,14).sort((a,b)=>b.score-a.score);
  }
  if(ally)return null;
  if(last&&ranked[0].p.tier&&!danger&&ranked[0].score<0)return null;
  return ranked[0].p;
}
