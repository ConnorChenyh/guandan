import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,classify,resolvePlay,legalPlays,beats,power} from '../js/rules.js';
import {newGame,deal,act,observation,giveBack,returnChoices} from '../js/game.js';
import {choose} from '../js/ai.js';
let serial=0;
const c=(rank,suit=0)=>({rank,suit,id:`test-${serial++}`});
const cards=(ranks,suits=[])=>ranks.map((r,i)=>c(r,suits[i]??i%4));
function seeded(seed=42){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('108 unique cards and 27-card hands',()=>{const d=deck();assert.equal(d.length,108);assert.equal(new Set(d.map(c=>c.id)).size,108);const s=newGame();assert.deepEqual(s.hands.map(h=>h.length),[27,27,27,27]);});
test('ordinary patterns, exact lengths and invalid shapes',()=>{
  for(const [ranks,type] of [[[3],'单张'],[[3,3],'对子'],[[3,3,3],'三张'],[[3,3,3,8,8],'三带二'],[[3,4,5,6,7],'顺子'],[[3,3,4,4,5,5],'三连对'],[[3,3,3,4,4,4],'钢板']])assert.ok(classify(cards(ranks),2).some(p=>p.type===type),type);
  assert.equal(classify(cards([3,4,5,6]),2).length,0);assert.equal(classify(cards([3,3,4]),2).length,0);
  assert.equal(classify(cards([15,15,15]),2).length,0);
});
test('A-low and A-high sequences without wrapping; level remains natural in sequences',()=>{
  assert.ok(classify(cards([14,2,3,4,5]),7).some(p=>p.type==='顺子'&&p.value===5));
  assert.ok(classify(cards([10,11,12,13,14]),7).some(p=>p.type==='顺子'&&p.value===14));
  assert.equal(classify(cards([12,13,14,2,3]),7).length,0);
  assert.ok(classify(cards([5,6,7,8,9],[0,0,0,2,3]),7).some(p=>p.type==='顺子'));
  assert.ok(classify(cards([14,14,2,2,3,3]),7).some(p=>p.type==='三连对'));
});
test('wild substitutions include flushes, exclude jokers, preserve single-card face value',()=>{
  const w=c(7,1);assert.ok(classify([c(3),w],7).some(p=>p.type==='对子'&&p.value===3));
  assert.equal(classify([c(15),w],7).length,0);
  assert.ok(classify([c(3,2),c(4,2),c(5,2),c(6,2),w],7).some(p=>p.type==='同花顺'));
  assert.deepEqual(classify([w],7).map(p=>p.value),[17]);
  const wildFlush=[c(9,2),c(10,2),c(12,2),c(13,2),w];
  assert.equal(resolvePlay(wildFlush,7)?.type,'同花顺');assert.equal(resolvePlay(wildFlush,7).substitutions.length,1);
  const lowStraight=resolvePlay(cards([3,4,5,6,7],[0,1,2,3,0]),2);assert.equal(resolvePlay(wildFlush,7,lowStraight)?.type,'顺子');
  assert.equal(resolvePlay([...cards([8,9,10,11],[0,1,2,3]),c(2,1)],2)?.substitutions[0].rank,12);
  const ends=[...cards([3,4,5,6],[0,1,2,3]),c(9,1)];
  assert.equal(resolvePlay(ends,9)?.value,7);assert.equal(resolvePlay(ends,9,resolvePlay(cards([2,3,4,5,6],[0,1,2,3,0]),9))?.value,7);
  const selected=[c(3),c(3),c(3),c(4),c(7,1)];assert.ok(resolvePlay(selected,7)?.type==='三带二');
});
test('bomb ladder and level card comparison',()=>{
  const bomb=n=>resolvePlay(Array.from({length:n},()=>c(5)),2);
  const sf=resolvePlay([3,4,5,6,7].map(r=>c(r,0)),2);
  const kings=resolvePlay(cards([15,15,16,16]),2);
  assert.ok(beats(bomb(4),resolvePlay(cards([14]),2)));assert.ok(beats(bomb(5),bomb(4)));
  assert.ok(beats(sf,bomb(5)));assert.ok(beats(bomb(6),sf));assert.ok(beats(bomb(8),bomb(7)));assert.ok(beats(kings,bomb(10)));
  assert.ok(power(2,2)>power(14,2));assert.ok(power(15,2)>power(2,2));
});
test('passing on lead is rejected and passing resets to last player',()=>{
  const s=newGame();s.turn=0;assert.throws(()=>act(s,0),/不能/);act(s,0,[s.hands[0][0].id]);act(s,1);act(s,2);act(s,3);assert.equal(s.turn,0);assert.equal(s.last,null);
});
test('finished player partner receives lead only after everyone passes',()=>{
  const s=newGame();s.turn=0;s.hands=[cards([3]),cards([4,5]),cards([6,7]),cards([8,9])];
  act(s,0,[s.hands[0][0].id]);assert.equal(s.turn,1);act(s,1);act(s,2);act(s,3);assert.equal(s.turn,2);assert.equal(s.last,null);
});
test('double-down ends round and grants three levels',()=>{
  const s=newGame();s.turn=0;s.hands=[cards([3]),cards([4,5]),cards([6]),cards([8,9])];act(s,0,[s.hands[0][0].id]);act(s,1);act(s,2,[s.hands[2][0].id]);assert.equal(s.phase,'roundOver');assert.equal(s.levels[0],5);assert.equal(s.result.gain,3);
});
test('A requires teammate not last and three failed A attempts reset to 2',()=>{
  const s=newGame();s.levels=[14,2];s.level=14;s.dealer=0;s.aFailures=[2,0];s.finished=[0,1];s.turn=3;s.hands=[[],[],cards([8,9]),cards([3])];act(s,3,[s.hands[3][0].id]);assert.equal(s.phase,'roundOver');assert.equal(s.levels[0],2);
  const t=newGame();t.levels=[14,2];t.level=14;t.turn=0;t.hands=[cards([3]),cards([4,5]),cards([6]),cards([8,9])];act(t,0,[t.hands[0][0].id]);act(t,1);act(t,2,[t.hands[2][0].id]);assert.equal(t.phase,'matchOver');assert.equal(t.result.matchWinner,0);
});
test('A team winning at the opponents level only takes the deal, then must win its own A',()=>{
  const s=newGame();s.levels=[14,8];s.dealer=1;s.level=8;s.turn=0;s.hands=[cards([3]),cards([4,5]),cards([6]),cards([8,9])];
  act(s,0,[s.hands[0][0].id]);act(s,1);act(s,2,[s.hands[2][0].id]);
  assert.equal(s.phase,'roundOver');assert.equal(s.result.matchWinner,null);assert.deepEqual(s.levels,[14,8]);assert.equal(s.dealer,0);assert.deepEqual(s.aFailures,[0,0]);
  deal(s);assert.equal(s.level,14);
});
test('AI observation excludes opponents hands and deck',()=>{
  const s=newGame();const o=observation(s,0);assert.equal(o.hand,s.hands[0]);assert.equal(o.hands,undefined);assert.equal(o.deck,undefined);assert.deepEqual(o.counts,[27,27,27,27]);
});
test('seeded full-game simulations at all difficulties conserve cards and terminate',()=>{
  const original=Math.random;Math.random=seeded(20261026);
  try{
    for(const difficulty of ['easy','normal','hard']){
      const s=newGame(difficulty);let actions=0;
      for(let round=0;round<8;round++){
        while(s.phase==='tribute'){const from=s.returns[0].from;giveBack(s,returnChoices(s,from)[0].id);}
        assert.equal(s.hands.flat().length,108);assert.equal(new Set(s.hands.flat().map(c=>c.id)).size,108);
        while(s.phase==='playing'){
          assert.ok(actions++<6000,'game must terminate');const p=choose(observation(s));
          if(p){assert.ok(classify(p.cards,s.level).some(x=>x.type===p.type&&x.value===p.value));assert.ok(beats(p,s.last?.play));}
          act(s,s.turn,p?.cards.map(c=>c.id),p);
          const all=[...s.hands.flat(),...s.seen];assert.equal(all.length,108);assert.equal(new Set(all.map(c=>c.id)).size,108);
        }
        assert.ok(['roundOver','matchOver'].includes(s.phase));
        if(s.phase==='matchOver')break;deal(s);
      }
    }
  }finally{Math.random=original;}
});
test('tributes conserve cards, anti-tribute needs two kings, and returns restore all hands to 27',()=>{
  const original=Math.random;Math.random=seeded(73);let anti=0,normal=0,double=0,human=0;
  try{for(let n=0;n<100;n++){
    const s=newGame();s.previousOrder=n%2?[0,2,1,3]:[0,1,2,3];deal(s);
    assert.equal(new Set(s.hands.flat().map(c=>c.id)).size,108);
    if(s.phase==='playing'){anti++;const losers=n%2?[1,3]:[3];assert.equal(losers.flatMap(i=>s.hands[i]).filter(c=>c.rank===16).length,2);assert.equal(s.turn,0);}
    else{normal++;if(s.returns.length===2)double++;assert.equal(s.returns[0].from,0);human++;
      const before=JSON.stringify(s);assert.throws(()=>giveBack(s,'missing'));assert.equal(JSON.stringify(s),before);
      while(s.phase==='tribute'){const {from}=s.returns[0];giveBack(s,returnChoices(s,from)[0].id);}
    }
    assert.deepEqual(s.hands.map(h=>h.length),[27,27,27,27]);assert.equal(new Set(s.hands.flat().map(c=>c.id)).size,108);
  }assert.ok(anti&&normal&&double&&human);}finally{Math.random=original;}
});
test('JSON save restores a playable state through entire match',()=>{
  const original=Math.random;Math.random=seeded(751);
  let s=newGame('hard');let steps=0;
  try{
  while(s.phase!=='matchOver'&&s.round<150){
    s=JSON.parse(JSON.stringify(s));
    if(s.phase==='roundOver'){deal(s);continue;}
    if(s.phase==='tribute'){giveBack(s,returnChoices(s,s.returns[0].from)[0].id);continue;}
    const p=choose(observation(s));act(s,s.turn,p?.cards.map(c=>c.id),p);assert.ok(++steps<20000);
  }
  assert.equal(s.phase,'matchOver');assert.ok(s.result.matchWinner===0||s.result.matchWinner===1);
  }finally{Math.random=original;}
});
test('passing clears only that seat while keeping the target and other seats visible',()=>{
  const s=newGame();s.turn=0;s.hands=[cards([3,8]),cards([4,9]),cards([5,6,10]),cards([6,11])];
  act(s,0,[s.hands[0][0].id]);act(s,1,[s.hands[1][0].id]);act(s,2,[s.hands[2][0].id]);act(s,3);
  const target=s.last,seen=s.seen.length,other=s.lastPlays[1];act(s,0);
  assert.equal(s.lastPlays[0],null);assert.equal(s.last,target);assert.equal(s.seen.length,seen);
  assert.equal(s.lastPlays[1],other);assert.equal(s.lastPlays[2],target.play);assert.equal(s.table[0].pass,true);
  act(s,1);assert.equal(s.last,null);assert.equal(s.lastPlays[1],null);
  assert.equal(s.lastPlays[2],target.play);assert.equal(s.table[1].pass,true);assert.equal(s.turn,2);
  const restored=JSON.parse(JSON.stringify(s));assert.equal(restored.lastPlays[0],null);assert.equal(restored.lastPlays[1],null);
  act(s,2,[s.hands[2][0].id]);act(s,3);act(s,0);act(s,1,[s.hands[1][0].id]);
  assert.equal(s.table[1].pass,undefined);assert.equal(s.lastPlays[1].cards[0].rank,9);
  s.previousOrder=[0,1,2,3];deal(s);assert.deepEqual(s.lastPlays,[null,null,null,null]);
});
test('a finished player\'s last cards stay until beaten or the trick ends',()=>{
  const s=newGame();s.turn=0;s.hands=[cards([3]),cards([4,9,9]),cards([5,6]),cards([8,8,10])];
  act(s,0,[s.hands[0][0].id]);assert.ok(s.lastPlays[0]);assert.deepEqual(s.finished,[0]);
  act(s,1,[s.hands[1][0].id]);assert.equal(s.lastPlays[0],null);
  const t=newGame();t.turn=0;t.hands=[cards([14]),cards([4,9]),cards([5,6]),cards([8,10])];
  act(t,0,[t.hands[0][0].id]);act(t,1);assert.ok(t.lastPlays[0]);act(t,2);act(t,3);
  assert.equal(t.lastPlays[0],null);assert.equal(t.turn,2);
});
