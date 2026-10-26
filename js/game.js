import {deck,shuffle,sortHand,power,wild,resolvePlay,beats} from './rules.js';
export const team = i => i % 2;
export function newGame(difficulty='normal') {
  const state={version:1,difficulty,levels:[2,2],aFailures:[0,0],level:2,dealer:0,round:0,history:[],log:[],phase:'playing',stats:{rounds:0,wins:0}};
  return deal(state);
}
function note(s,text){s.log.unshift(text);s.log=s.log.slice(0,12);}
export function deal(s) {
  s.level=s.levels[s.dealer];
  const cards=shuffle(deck());
  s.hands=Array.from({length:4},(_,i)=>sortHand(cards.slice(i*27,(i+1)*27),s.level));
  s.round++;s.lastPlays=[null,null,null,null];s.seen=[];s.actions=[];s.finished=[];s.last=null;s.pending=[];s.table=[null,null,null,null];s.turn=s.round===1?Math.floor(Math.random()*4):s.previousOrder[0];s.phase='playing';s.returns=[];
  note(s,`第 ${s.round} 局 · 打 ${s.level===14?'A':s.level}`);
  if(s.previousOrder)tribute(s);
  return s;
}
export function playerName(i){return ['你','右家 · 阿岚','对家 · 小北','左家 · 老周'][i];}
function tribute(s) {
  const order=s.previousOrder, head=order[0];const double=team(order[1])===team(head);
  const losers=double?[order[2],order[3]]:[order[3]];
  const kings=losers.reduce((n,i)=>n+s.hands[i].filter(c=>c.rank===16).length,0);
  if(kings===2){s.turn=head;note(s,'两张大王抗贡，头游先出');return;}
  const transfers=losers.map(from=>({from,card:[...s.hands[from]].filter(c=>!wild(c,s.level)).sort((a,b)=>power(b.rank,s.level)-power(a.rank,s.level))[0]}));
  transfers.sort((a,b)=>power(b.card.rank,s.level)-power(a.card.rank,s.level)||a.from-b.from);
  s.turn=transfers[0].from;
  transfers.forEach((t,index)=>{
    const to=double?order[index]:head;
    s.hands[t.from]=s.hands[t.from].filter(c=>c.id!==t.card.id);s.hands[to].push(t.card);
    s.returns.push({from:to,to:t.from});
    note(s,`${playerName(t.from)}向${playerName(to)}进贡`);
  });
  s.phase='tribute';
}
export function returnChoices(s,from) {
  const h=s.hands[from];const small=h.filter(c=>c.rank<=10&&c.rank!==s.level);
  if(small.length)return small;
  const eligible=h.filter(c=>!wild(c,s.level));const min=Math.min(...eligible.map(c=>power(c.rank,s.level)));
  return eligible.filter(c=>power(c.rank,s.level)===min);
}
export function giveBack(s,id) {
  if(s.phase!=='tribute'||!s.returns.length)throw Error('当前无需还贡');
  const {from,to}=s.returns[0];const card=returnChoices(s,from).find(c=>c.id===id);
  if(!card)throw Error('请选择一张可还贡的牌');
  s.hands[from]=s.hands[from].filter(c=>c.id!==id);s.hands[to].push(card);s.returns.shift();
  note(s,`${playerName(from)}已还贡`);
  if(!s.returns.length){s.phase='playing';s.hands=s.hands.map(h=>sortHand(h,s.level));}
}
// A finished player's last cards leave the table once they are beaten or the trick ends.
function clearFinished(s,except=null){for(const i of s.finished||[])if(i!==except){s.lastPlays[i]=null;s.table[i]=null;}}
function nextActive(s,from){for(let n=1;n<=4;n++){const i=(from+n)%4;if(s.hands[i].length)return i;}return from;}
function conclude(s) {
  const f=s.finished;const ended=f.length>=3||(f.length>=2&&team(f[0])===team(f[1]));
  if(!ended)return false;
  const order=[...f,...[0,1,2,3].filter(i=>!f.includes(i))];
  const win=team(order[0]);const partnerPosition=order.findIndex((i,n)=>n>0&&team(i)===win);
  const gain=partnerPosition===1?3:partnerPosition===2?2:1;
  const levelBefore=s.levels[win];let matchWinner=null;
  // Passing A requires winning a round played at our own A, i.e. as dealer.
  if(levelBefore===14&&partnerPosition<=2&&win===s.dealer) matchWinner=win;
  if(s.levels[s.dealer]===14&&matchWinner!==s.dealer){
    s.aFailures[s.dealer]++;
    if(s.aFailures[s.dealer]>=3){s.levels[s.dealer]=2;s.aFailures[s.dealer]=0;}
  }
  if(matchWinner===null&&levelBefore!==14)s.levels[win]=Math.min(14,s.levels[win]+gain);
  s.result={order,win,gain,matchWinner,double:partnerPosition===1};
  s.previousOrder=order;s.dealer=win;
  s.stats.rounds++;if(win===0)s.stats.wins++;
  s.phase=matchWinner===null?'roundOver':'matchOver';
  s.history.unshift({round:s.round,...s.result});s.history=s.history.slice(0,20);
  note(s,`${win===0?'我方':'对方'}获胜 · ${matchWinner!==null?'成功过 A':`升 ${gain} 级`}`);
  return true;
}
export function act(s,player,ids=null,chosen=null) {
  if(s.phase!=='playing'||s.turn!==player)throw Error('还没轮到你');
  if(!ids||!ids.length){
    if(!s.last)throw Error('你领出时不能不出');
    s.lastPlays??=[null,null,null,null];s.lastPlays[player]=null;
    (s.actions??=[]).push({p:player,pass:true,vs:{p:s.last.player,type:s.last.play.type,value:s.last.play.value,size:s.last.play.size,tier:s.last.play.tier}});
    s.table[player]={pass:true};s.pending=s.pending.filter(i=>i!==player);
    note(s,`${playerName(player)}不出`);
    if(!s.pending.length){
      const lead=s.last.player;const partner=(lead+2)%4;
      s.turn=s.hands[lead].length?lead:s.hands[partner].length?partner:nextActive(s,lead);
      s.last=null;s.table=s.table.map(action=>action?.pass?action:null);clearFinished(s);note(s,`${playerName(s.turn)}${s.hands[lead].length?'领出':'接风领出'}`);
    }else s.turn=nextActive(s,player);
    return;
  }
  const cards=ids.map(id=>s.hands[player].find(c=>c.id===id));
  if(cards.some(c=>!c)||new Set(ids).size!==ids.length)throw Error('手牌无效');
  const options=resolvePlay(cards,s.level,s.last?.play);
  const play=chosen&&chosen.cards?.map(c=>c.id).sort().join()===ids.slice().sort().join()
    ? resolveChosen(cards,s.level,s.last?.play,chosen):options;
  if(!play)throw Error('牌型不合法，或没有压过上一手');
  s.hands[player]=s.hands[player].filter(c=>!ids.includes(c.id));
  s.lastPlays??=[null,null,null,null];s.lastPlays[player]=play;
  (s.actions??=[]).push({p:player,type:play.type,value:play.value,size:play.size,tier:play.tier});
  s.seen.push(...cards);s.last={player,play};s.table[player]={play};clearFinished(s,player);s.pending=[0,1,2,3].filter(i=>i!==player&&s.hands[i].length);
  note(s,`${playerName(player)} · ${play.type}${play.substitutions.length?'（配牌）':''}`);
  if(!s.hands[player].length){s.finished.push(player);note(s,`${playerName(player)}第 ${s.finished.length} 名出完`);if(conclude(s))return;}
  s.turn=nextActive(s,player);
}
import {classify} from './rules.js';
function resolveChosen(cards,level,previous,chosen){return classify(cards,level).find(p=>p.type===chosen.type&&p.value===chosen.value&&p.tier===chosen.tier&&beats(p,previous))||null;}
// Only public information plus the acting player's hand reaches the AI worker.
export function observation(s,player=s.turn){return {hand:s.hands[player],level:s.level,player,counts:s.hands.map(h=>h.length),last:s.last,difficulty:s.difficulty,seen:s.seen||[],history:s.actions||[],pending:s.pending||[],finished:s.finished||[]};}
