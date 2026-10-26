import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,resolvePlay,legalPlays,beats} from '../js/rules.js';
import {choose} from '../js/ai.js';
import {decompose} from '../js/ai/decompose.js';
import {makeTracker} from '../js/ai/tracker.js';
// Hands are built from real deck cards so card counting sees consistent ids. Level is 2 throughout.
function table(){
  const D=deck(),used=new Set();
  const card=r=>{const c=D.find(c=>c.rank===r&&!used.has(c.id)&&!(r===2&&c.suit===1));used.add(c.id);return c;};
  const hand=(...ranks)=>ranks.map(card);
  return {hand,play:(...ranks)=>resolvePlay(hand(...ranks),2)};
}
const obs=(hand,counts,last=null,difficulty='normal',extra={})=>({hand,level:2,player:0,counts,last,difficulty,seen:[],history:[],pending:[],finished:[],...extra});
const ranks=p=>p?.cards.map(c=>c.rank).sort((a,b)=>a-b);
for(const difficulty of ['normal','hard']){
  test(`${difficulty}: takes control with the top single when an opponent is on one card`,()=>{
    const t=table();const p=choose(obs(t.hand(10,16,3,4,6),[5,10,10,1],{player:3,play:t.play(9)},difficulty));
    assert.deepEqual(ranks(p),[16]);
  });
  test(`${difficulty}: stays out of a partner's lead`,()=>{
    const t=table();assert.equal(choose(obs(t.hand(7,8,10,12,13,13),[6,15,15,15],{player:2,play:t.play(5)},difficulty)),null);
  });
  test(`${difficulty}: closes out by cashing the control before the last weak card`,()=>{
    const t=table();assert.deepEqual(ranks(choose(obs(t.hand(16,3),[2,10,10,10],{player:3,play:t.play(9)},difficulty))),[16]);
  });
  test(`${difficulty}: saves bombs early, bombs when an opponent is about to go out`,()=>{
    const t=table();const calm=choose(obs(t.hand(5,5,5,5,7,6,11,9,9,12,12),[11,20,20,20],{player:3,play:t.play(8)},difficulty));
    assert.equal(calm.tier,0);
    const u=table();const urgent=choose(obs(u.hand(5,5,5,5,7,6,11,9,9),[9,20,20,2],{player:3,play:u.play(13,13)},difficulty));
    assert.equal(urgent.type,'炸弹');
  });
  test(`${difficulty}: keeps a level-card pair for answering instead of leading it bare`,()=>{
    const t=table();const p=choose(obs(t.hand(16,16,15,2,2,7,6,6,5,4,3),[11,22,22,11],null,difficulty));
    assert.ok(!(p.type==='对子'&&p.cards.every(c=>c.rank===2)),`led ${p.type}`);
  });
  test(`${difficulty}: avoids leading singles into an opponent's last card, feeds a partner's last card`,()=>{
    const t=table();assert.notEqual(choose(obs(t.hand(3,4,9,9,13,6,6),[7,10,10,1],null,difficulty)).type,'单张');
    const u=table();assert.deepEqual(ranks(choose(obs(u.hand(3,7,9,9,13,13,12),[7,10,1,10],null,difficulty))),[3]);
  });
}
test('decomposition minimises hands and keeps bombs whole',()=>{
  const t=table();t.hand(7);const d=decompose(t.hand(3,4,5,6,7,9,9,13,13,13),2);
  assert.equal(d.hands,2);assert.deepEqual(d.plays.map(p=>p.type).sort(),['三带二','顺子']);
  const u=table();const e=decompose(u.hand(5,5,5,5,8),2);assert.deepEqual(e.plays.map(p=>p.type).sort(),['单张','炸弹']);
  const v=table();const wildCard=deck().find(c=>c.rank===2&&c.suit===1);
  // Suited 3 4 6 7 plus the heart level card fills the gap into a straight flush.
  const f=decompose([...v.hand(3,4,6,7),wildCard],2);assert.equal(f.plays.length,1);assert.equal(f.plays[0].type,'同花顺');
  for(let n=0;n<20;n++){const h=deck().sort(()=>Math.random()-0.5).slice(0,27);const g=decompose(h,7);
    assert.equal(g.plays.reduce((s,p)=>s+p.size,0),27);assert.equal(new Set(g.plays.flatMap(p=>p.cards.map(c=>c.id))).size,27);}
});
test('tracker uses seen cards and opponents\' passes',()=>{
  const t=table();const hand=t.hand(15,3);
  const bigJokers=deck().filter(c=>c.rank===16);const single=t.play(15);
  assert.equal(makeTracker(obs(hand,[2,10,10,10])).isControl(single),false);
  assert.equal(makeTracker(obs(hand,[2,10,10,10],null,'hard',{seen:bigJokers})).isControl(single),true);
  const history=[{p:1,pass:true,vs:{p:0,type:'单张',value:14,size:1,tier:0}},{p:3,pass:true,vs:{p:0,type:'单张',value:14,size:1,tier:0}}];
  assert.equal(makeTracker(obs(hand,[2,10,10,10],null,'hard',{history})).isControl(single),true);
  assert.equal(makeTracker(obs(hand,[2,10,10,10],null,'hard',{history}),{useInference:false}).isControl(single),false);
});
test('endgame search returns a legal move within its budget',()=>{
  const D=deck();const hand=[D[0],D[1],D[5],D[20]];const seen=D.slice(30,30+108-4-15);
  const o=obs(hand,[4,5,5,5],null,'hard',{seen});
  const t0=Date.now();const p=choose(o,Math.random,{searchMs:80});
  assert.ok(Date.now()-t0<1500);assert.ok(legalPlays(hand,2).some(q=>q.type===p.type&&q.value===p.value));assert.ok(beats(p,null));
});
