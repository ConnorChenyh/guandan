import {legalPlays} from '../rules.js';
import {decompose,straightFlushes} from './decompose.js';
import {makeTracker} from './tracker.js';
// Plan-based move ranking: every option is judged by how good the remaining hand is, plus what the trick is worth.
const CLOSING=12,CONTROL=3;
function danger(count){return count<=0?0:count<=1?40:count<=2?28:count<=4?14:count<=7?6:2;}
export function rankMoves(obs,{tracking=true}={}){
  const {hand,level,player:me,counts,last}=obs;
  const mate=(me+2)%4;
  const tr=makeTracker(obs,{useSeen:tracking,useInference:tracking});
  const legal=legalPlays(hand,level,last?.play);
  if(!legal.length)return [{play:null,value:0}];
  const finish=legal.find(p=>p.size===hand.length);
  if(finish)return [{play:finish,value:1e9}];
  const sfs=straightFlushes(hand,level);
  const evaluate=cards=>{
    const d=decompose(cards,level,sfs);
    const controls=d.plays.filter(p=>!p.tier&&tr.isControl(p)).length;
    const weak=d.hands-controls;
    // With at most one weak group left (bombs win the lead back), the rest of the hand can be run out.
    const closing=weak-d.bombs<=1;
    return {...d,controls,weak,closing,value:d.score+CONTROL*controls+(closing?CLOSING:0)};
  };
  const without=p=>{const ids=new Set(p.cards.map(c=>c.id));return hand.filter(c=>!ids.has(c.id));};
  const plan=evaluate(hand);
  const leadValue=6+Math.max(0,6-plan.hands);
  const opps=tr.opps;
  const ranked=[];
  if(!last){
    const nonBombs=plan.plays.filter(p=>!p.tier);
    const pool=nonBombs.length?nonBombs:plan.plays;
    const mateSmall=counts[mate]>0&&counts[mate]<=4&&!opps.some(o=>counts[o]<=2);
    const candidates=[...pool];
    // When an opponent is about to go out on singles, the biggest single may be the only safe lead.
    const singles=legal.filter(p=>p.type==='单张');
    if(singles.length)candidates.push(singles.reduce((a,b)=>b.value>a.value?b:a));
    for(const g of candidates){
      const rest=evaluate(without(g));const control=tr.isControl(g);
      // Controls are kept to answer opponents; they are cashed first only in the final run of a closable hand.
      const finalRun=plan.closing&&plan.hands<=3;
      let value=rest.value+g.size*0.6+(control?(finalRun?leadValue*0.5+15:-4):0);
      for(const o of opps){
        const c=counts[o];
        if(c<=5&&g.size===c&&!control)value-=c===1?30:20;
        if(c===1&&g.type==='单张')value+=g.value;
      }
      if(mateSmall&&(g.type==='单张'||g.type==='对子')&&g.size===Math.min(2,counts[mate]))value+=10-g.value*0.5;
      ranked.push({play:g,value});
    }
  }else if(last.player===mate){
    // Partner leads the trick: pass unless taking over lets us run out, or saves a weak lead under pressure.
    const passValue=plan.value+(tr.isControl(last.play)?2:0);
    ranked.push({play:null,value:passValue});
    const pressure=counts[mate]>5&&opps.some(o=>counts[o]<=3)&&tr.opponentMayBeat(last.play);
    for(const p of legal){
      if(p.tier&&!plan.closing)continue;
      const rest=evaluate(without(p));const control=tr.isControl(p);
      const runOut=control&&rest.weak-rest.bombs<=0;
      const rescue=pressure&&control&&!p.tier&&rest.value>=plan.value+7;
      if(runOut||rescue)ranked.push({play:p,value:passValue+5+rest.value-plan.value});
    }
  }else{
    // An opponent leads the trick.
    const lastCount=counts[last.player];
    let risk=danger(lastCount)+Math.max(...opps.map(o=>danger(counts[o])))*0.5;
    if((last.player-me+4)%4===3&&counts[mate]>0)risk*=0.6;
    ranked.push({play:null,value:plan.value-risk});
    for(const p of legal){
      const rest=evaluate(without(p));
      if(p.tier){
        const urgent=opps.some(o=>counts[o]<=6);
        if(!(urgent||rest.closing||(hand.length<=10&&rest.hands<=3)))continue;
      }
      const hold=tr.isControl(p)?1:p.tier?0.8:0.4;
      ranked.push({play:p,value:rest.value+hold*leadValue-(1-hold)*risk*0.7});
    }
  }
  return ranked.sort((a,b)=>b.value-a.value);
}
