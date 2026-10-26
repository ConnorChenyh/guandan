import {label,SUITS,wild,sortHand,classify,resolvePlay,legalPlays} from './rules.js';
import {newGame,deal,act,giveBack,returnChoices,playerName,observation} from './game.js';
import {choose} from './ai.js';
const $=id=>document.getElementById(id);
const SAVE='qingzhuo-guandan-v1';let state,selected=new Set(),paused=false,timer=null,epoch=0,worker=null,workerTimeout=null,hintIndex=0;
try{const parsed=JSON.parse(localStorage.getItem(SAVE));if(parsed?.version===1&&parsed.hands?.length===4&&['playing','tribute','roundOver','matchOver'].includes(parsed.phase)&&parsed.hands.flat().every(c=>c.id&&c.rank>=2&&c.rank<=16))state=parsed;}catch{}
if(!state)state=newGame();
state.lastPlays??=state.table.map(a=>a?.play||null);
state.table.forEach((action,i)=>{if(action?.pass)state.lastPlays[i]=null;});
const difficultyText={easy:'轻松上手，慢慢熟悉',normal:'懂配合，也懂留一手',hard:'多想一步，认真过招'};
function save(){try{localStorage.setItem(SAVE,JSON.stringify(state));}catch{$('saveStatus').textContent='存档不可用 · 请勿关闭此页面';}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2800);}
function cancelAI(){epoch++;clearTimeout(timer);clearTimeout(workerTimeout);if(worker){worker.terminate();worker=null;}}
function cardElement(card,interactive=false){
  const el=document.createElement(interactive?'button':'div');el.className=`card ${card.suit===1||card.suit===3||card.rank===16?'red':''} ${card.rank>14?'joker':''} ${wild(card,state.level)?'wild':''}`;
  const name=card.rank>14?label(card.rank):SUITS[card.suit]+label(card.rank);
  el.innerHTML=`<span class="rank">${label(card.rank)}</span><span class="suit">${card.rank>14?'★':SUITS[card.suit]}</span><span class="large-suit">${card.rank>14?'★':SUITS[card.suit]}</span>${wild(card,state.level)?'<span class="wild-tag">配</span>':''}`;
  el.setAttribute('aria-label',name+(wild(card,state.level)?'，红心配牌':''));
  if(interactive){
    el.dataset.id=card.id;el.setAttribute('aria-pressed',selected.has(card.id));el.classList.toggle('selected',selected.has(card.id));
    const returning=state.phase==='tribute'&&state.returns[0]?.from===0;
    const enabled=!paused&&((state.phase==='playing'&&state.turn===0)||returning);
    el.disabled=!enabled;
    if(returning)el.classList.toggle('eligible',returnChoices(state,0).some(c=>c.id===card.id));
    // Pointer taps and swipes are handled on #hand; this keeps keyboard activation (detail 0) working.
    el.onclick=e=>{if(e.detail)return;if(returning){selected.clear();selected.add(card.id);}else if(selected.has(card.id))selected.delete(card.id);else selected.add(card.id);renderHand(card.id);};
    el.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const cards=[...$('hand').children];cards[(cards.indexOf(el)+(e.key==='ArrowRight'?1:cards.length-1))%cards.length].focus();}};
  }
  return el;
}
function renderSeat(i,id){
  const isActive=!paused&&(state.phase==='playing'?state.turn===i:state.phase==='tribute'&&state.returns[0]?.from===i);
  const rank=state.finished.indexOf(i);const seat=$(id);seat.className=`seat ${id} ${i%2?'enemy':''} ${isActive?'active':''}`;
  const action=state.table[i];
  seat.innerHTML=`<div class="avatar">${['我','岚','北','周'][i]}</div><div class="seat-info"><span>${['你','阿岚','小北','老周'][i]}${i===2?' · 队友':''}</span><small>${rank>=0?`第 ${rank+1} 名` : isActive?(state.phase==='tribute'?'正在还贡':i===0?'轮到你了':'思考中…'):i%2?'对方':'我方'}</small></div><span class="count">${state.hands[i].length} 张</span>${action?`<span class="last-action">${action.pass?'不出':action.play.type}</span>`:''}`;
}
function renderHand(focusId){
  $('hand').classList.toggle('short-hand',state.hands[0].length<=14);
  const n=state.hands[0].length;$('hand').style.setProperty('--count',Math.max(2,n));$('hand').style.setProperty('--cols2',n<=8?Math.max(1,n):Math.ceil(n/2));$('hand').style.setProperty('--cols3',n<=8?Math.max(1,n):Math.ceil(n/(n<=16?2:3)));$('hand').replaceChildren(...state.hands[0].map(c=>cardElement(c,true)));
  $('handCount').textContent=`${state.hands[0].length} 张`;
  renderSelection();
  if(focusId)[...$('hand').children].find(el=>el.dataset.id===focusId)?.focus({preventScroll:true});
}
function renderSelection(){
  const cards=state.hands[0].filter(c=>selected.has(c.id));const types=classify(cards,state.level);
  const valid=resolvePlay(cards,state.level,state.last?.play);
  const returning=state.phase==='tribute'&&state.returns[0]?.from===0;
  $('selectionLabel').textContent=cards.length?(returning?'选择一张还贡':valid?`${valid.type}${valid.substitutions.length?' · 含配牌':''} / ${cards.length} 张`:types.length?`${types[0].type} · 压不过上一手`:'尚未组成合法牌型'):'点击牌面选择';
  const myTurn=state.phase==='playing'&&state.turn===0&&!paused;
  $('playBtn').disabled=returning?paused||cards.length!==1||!returnChoices(state,0).some(c=>c.id===cards[0]?.id):!myTurn||!valid;
  $('playBtn').innerHTML=returning?'确认还贡 →':'出牌 <span>→</span>';
  $('passBtn').disabled=!myTurn||!state.last;$('hintBtn').disabled=!myTurn;$('clearBtn').disabled=!selected.size||paused;
  $('sortBtn').disabled=paused;
}
function render(){
  document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===state.difficulty));
  $('compactDifficulty').value=state.difficulty;
  $('difficultyNote').textContent=difficultyText[state.difficulty];$('roundLabel').textContent=`第 ${String(state.round).padStart(2,'0')} 局`;
  $('mobileScore').textContent=`我方 ${label(state.levels[0])} · 对方 ${label(state.levels[1])}`;
  $('levelLabel').textContent=label(state.level);$('ourLevel').textContent=label(state.levels[0]);$('theirLevel').textContent=label(state.levels[1]);$('record').textContent=`${state.stats.wins} / ${state.stats.rounds}`;
  [[0,'south'],[1,'east'],[2,'north'],[3,'west']].forEach(([i,id])=>renderSeat(i,id));
  const status=paused?'暂停中，点击继续回到牌桌':state.phase==='tribute'?`${playerName(state.returns[0].from)}还贡`:state.phase==='playing'?`${playerName(state.turn)}${state.last?'跟牌':'领出'}`:state.phase==='matchOver'?'本场结束':'本局结束';
  $('turnText').textContent=status;
  [[0,'playSouth'],[1,'playEast'],[2,'playNorth'],[3,'playWest']].forEach(([i,id])=>{
    const panel=$(id),play=state.lastPlays[i],action=state.table[i];
    const caption=document.createElement('div');caption.className='seat-play-caption';
    caption.textContent=`${['你','阿岚','小北 · 队友','老周'][i]} · ${action?.pass?'不出':action?.play?'本轮出牌':play?'之前出牌':'尚未出牌'}`;
    panel.replaceChildren(caption);
    panel.setAttribute('aria-label',caption.textContent);
    if(play){
      const row=document.createElement('div');row.className='seat-play-cards';row.append(...play.cards.map(c=>cardElement(c)));
      const type=document.createElement('small');type.textContent=play.type+(play.substitutions.length?' · 含配牌':'');
      panel.append(row,type);
    }else{const empty=document.createElement('span');empty.className='no-play';empty.textContent=action?.pass?'不出':'—';panel.append(empty);}
  });
  $('trick').replaceChildren();
  $('log').replaceChildren(...state.log.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  $('hintText').textContent=state.phase==='tribute'?'还一张 ≤10 的非级牌，高亮为可选牌。':state.phase==='playing'?'Enter 出牌 · H 提示 · P 不出':'本局已结束，点击“下一局”继续。';
  if(['roundOver','matchOver'].includes(state.phase)){$('pauseBtn').textContent=state.phase==='matchOver'?'↗ 查看结算':'下一局 →';}
  else $('pauseBtn').textContent=paused?'▶ 继续':'Ⅱ 暂停';
  document.body.classList.toggle('paused',paused);renderHand();
}
function showResult(){
  const r=state.result;if(!r)return;
  $('resultTitle').textContent=r.matchWinner!==null?`${r.matchWinner===0?'我方':'对方'}成功过 A` : r.win===0?'这一局，配合得漂亮':'好牌还在下一局';
  $('resultText').textContent=`${r.win===0?'我方':'对方'}${r.double?'双下，':''}${r.matchWinner!==null?'赢得本场比赛':`升 ${r.gain} 级 · 下局打 ${label(state.levels[r.win])}`}`;
  $('ranking').innerHTML=r.order.map((i,n)=>`<div><strong>${n+1}</strong>${['你','阿岚','小北','老周'][i]}</div>`).join('');
  $('nextBtn').textContent=state.phase==='matchOver'?'开始新一场 →':'下一局 →';if(!$('resultDialog').open)$('resultDialog').showModal();
}
function changed(){selected.clear();hintIndex=0;save();render();if(['roundOver','matchOver'].includes(state.phase))showResult();else schedule();}
function applyAI(play,token){if(token!==epoch||paused)return;clearTimeout(workerTimeout);worker?.terminate();worker=null;try{act(state,state.turn,play?.cards.map(c=>c.id),play);changed();}catch(error){toast(`电脑出牌恢复：${error.message}`);const fallback=legalPlays(state.hands[state.turn],state.level,state.last?.play)[0];act(state,state.turn,fallback?.cards.map(c=>c.id),fallback);changed();}}
function schedule(){
  cancelAI();if(paused)return;const token=epoch;
  if(state.phase==='tribute'){
    if(state.returns[0].from===0)return;
    timer=setTimeout(()=>{if(token!==epoch)return;const c=returnChoices(state,state.returns[0].from).sort((a,b)=>a.rank-b.rank)[0];giveBack(state,c.id);changed();},1800);return;
  }
  if(state.phase!=='playing'||state.turn===0)return;
  timer=setTimeout(()=>{
    if(token!==epoch)return;
    const obs=observation(state);
    try{
      worker=new Worker(new URL('./ai-worker.js',import.meta.url),{type:'module'});
      const fallback=()=>applyAI(choose({...obs,difficulty:'normal'}),token);
      worker.onmessage=({data})=>data.error?fallback():applyAI(data.play,token);
      worker.onerror=e=>{e.preventDefault();fallback();};workerTimeout=setTimeout(fallback,2500);
      worker.postMessage({id:token,observation:obs});
    }catch{applyAI(choose(obs),token);}
  },2200);
}
// Tap or slide across cards: the first card decides whether the swipe selects or deselects.
let drag=null;
function cardAt(x,y){const el=document.elementFromPoint(x,y)?.closest('#hand .card');return el&&!el.disabled?el:null;}
function dragOver(el){
  if(!el)return;const id=el.dataset.id;
  if(drag.single){if(selected.has(id))return;selected.clear();for(const c of $('hand').children){c.classList.remove('selected');c.setAttribute('aria-pressed',false);}}
  else if(drag.seen.has(id))return;
  drag.last=el;drag.seen.add(id);drag.add?selected.add(id):selected.delete(id);
  el.classList.toggle('selected',drag.add);el.setAttribute('aria-pressed',drag.add);renderSelection();
}
$('hand').addEventListener('pointerdown',e=>{
  if(e.button>0)return;const el=cardAt(e.clientX,e.clientY);if(!el)return;e.preventDefault();
  const single=state.phase==='tribute';drag={single,add:single||!selected.has(el.dataset.id),seen:new Set()};dragOver(el);
});
window.addEventListener('pointermove',e=>{
  if(!drag)return;const el=cardAt(e.clientX,e.clientY);if(!el)return;
  // Fast swipes skip cards between move events; fill the gap within the same row.
  const cards=[...$('hand').children],from=drag.last?cards.indexOf(drag.last):-1,to=cards.indexOf(el);
  if(!drag.single&&from>=0&&drag.last.offsetTop===el.offsetTop)for(let i=from;i!==to;i+=Math.sign(to-from))dragOver(cards[i]);
  dragOver(el);
});
for(const type of ['pointerup','pointercancel'])window.addEventListener(type,()=>{drag=null;});
$('playBtn').onclick=()=>{try{if(state.phase==='tribute')giveBack(state,[...selected][0]);else act(state,0,[...selected]);changed();}catch(e){toast(e.message);}};
$('passBtn').onclick=()=>{try{act(state,0);changed();}catch(e){toast(e.message);}};
$('clearBtn').onclick=()=>{selected.clear();renderHand();};
$('hintBtn').onclick=()=>{
  const options=legalPlays(state.hands[0],state.level,state.last?.play);
  if(!options.length){toast('没有能压过的牌，可以选择“不出”');return;}
  const suggested=choose({...observation(state,0),difficulty:'normal'});
  if(suggested){const key=suggested.cards.map(c=>c.id).join();options.sort((a,b)=>(b.cards.map(c=>c.id).join()===key)-(a.cards.map(c=>c.id).join()===key));}
  const play=options[hintIndex++%options.length];selected=new Set(play.cards.map(c=>c.id));renderHand();toast(`建议：${play.type}${state.last?.player===2?'；也可以让队友继续领先':''}。再次提示可换一手。`);
};
$('sortBtn').onclick=()=>{state.hands[0]=sortHand(state.hands[0],state.level);save();renderHand();};
$('pauseBtn').onclick=()=>{if(['roundOver','matchOver'].includes(state.phase)){showResult();return;}paused=!paused;cancelAI();render();if(!paused)schedule();};
$('rulesBtn').onclick=()=>{if(!paused&&['playing','tribute'].includes(state.phase)){$('rulesDialog').dataset.resume='yes';paused=true;cancelAI();render();}$('rulesDialog').showModal();};
$('rulesDialog').addEventListener('close',()=>{if($('rulesDialog').dataset.resume){delete $('rulesDialog').dataset.resume;paused=false;render();schedule();}});
$('newBtn').onclick=()=>{cancelAI();$('confirmDialog').showModal();};
$('confirmDialog').addEventListener('close',()=>schedule());
$('confirmNew').onclick=()=>{cancelAI();state=newGame(state.difficulty);paused=false;$('confirmDialog').close();changed();};
$('nextBtn').onclick=()=>{cancelAI();$('resultDialog').close();if(state.phase==='matchOver')state=newGame(state.difficulty);else deal(state);paused=false;changed();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
$('compactDifficulty').onchange=()=>{state.difficulty=$('compactDifficulty').value;save();render();schedule();};
for(const b of document.querySelectorAll('[data-difficulty]'))b.onclick=()=>{state.difficulty=b.dataset.difficulty;save();render();schedule();};
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||e.target.closest('button')&&e.key==='Enter')return;if(e.key==='Enter'&&!$('playBtn').disabled){e.preventDefault();$('playBtn').click();}if(e.key.toLowerCase()==='h'&&!$('hintBtn').disabled)$('hintBtn').click();if(e.key.toLowerCase()==='p'&&!$('passBtn').disabled)$('passBtn').click();if(e.key==='Escape')$('clearBtn').click();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAI();save();}else if(!document.querySelector('dialog[open]'))schedule();});
window.addEventListener('pagehide',save);
save();render();if(['roundOver','matchOver'].includes(state.phase))showResult();else schedule();
