'use strict';
const {Game,stats,W,H,dist,resources,soldierCost}=RTS;
const $=s=>document.querySelector(s),canvas=$('#game'),ctx=canvas.getContext('2d'),T=24;
const names={worker:'Рабочий',soldier:'Солдат',base:'Ратуша',house:'Дом',warehouse:'Склад',sawmill:'Лесопилка',quarry:'Каменоломня',farm:'Ферма',ironmine:'Железная шахта',goldmine:'Золотая шахта',barracks:'Казарма',tower:'Башня'};
const resourceNames={wood:'Дерево',stone:'Камень',food:'Еда',iron:'Железо',gold:'Золото'},colors={wood:'#8fba64',stone:'#aaaeb8',food:'#dfce71',iron:'#aac7cf',gold:'#f1bf49'};
const labels={base:'Р',house:'Д',warehouse:'С',sawmill:'Л',quarry:'К',farm:'Ф',ironmine:'Ж',goldmine:'З',barracks:'Б',tower:'Т'};
let game=new Game(),selected=[],placing=null,paused=false,mouse={x:0,y:0},drag=null,last=null,uiTimer=0;
const costText=c=>Object.entries(c).map(([r,n])=>`${n} ${resourceNames[r].toLowerCase()}`).join(', ');
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function action(parent,text,fn,disabled=false){const b=document.createElement('button');b.textContent=text;b.disabled=disabled;b.onclick=()=>{fn();updateUI();};parent.append(b);return b;}
function updateUI(){
 selected=selected.filter(id=>game.get(id));const p=game.population(),stock=game.stock();$('#resources').replaceChildren();for(const r of resources){const span=document.createElement('span');span.textContent=`${resourceNames[r]}: ${Math.floor(stock[r])}`;span.style.color=colors[r];$('#resources').append(span);}
 const carriers=game.alive().filter(e=>e.team===0&&e.type==='worker'&&!e.job&&!e.training).length;
 $('#population').textContent=`Население: ${p.total}/${p.capacity} · Рабочие: ${p.workers} · Солдаты: ${p.soldiers} · Перевозчики: ${carriers} · Расход за 5 с: ${p.total} еды, ${p.soldiers*.5} золота`;
 $('#clock').textContent=clock(game.time);$('#message').textContent=placing?`Строительство: ${names[placing]}. ЛКМ по зелёному месту; Esc — отмена.`:game.teams[0].hungry?'Не хватает еды! Население теряет здоровье. Назначьте рабочих на ферму и оставьте перевозчиков.':game.teams[0].unpaid?'Не хватает золота! Солдаты теряют здоровье.':game.message;
 const builds=$('#buildings');builds.replaceChildren();for(const type of Object.keys(labels).filter(t=>t!=='base')){const b=action(builds,`${names[type]} (${labels[type]})`,()=>{if(!paused&&!game.result)placing=placing===type?null:type;},!game.affordable(stats[type].cost)||!!game.result);if(placing===type)b.className='active';const small=document.createElement('small');small.textContent=costText(stats[type].cost);b.append(small);}
 const units=selected.map(id=>game.get(id)),e=units[0],actions=$('#actions');actions.replaceChildren();$('#selection').textContent=units.length>1?`Выбрано: ${units.length}`:e?names[e.type]||resourceNames[e.resource]:'Ничего не выбрано';
 let details='ЛКМ — выбрать · ПКМ — приказ';if(e&&units.length===1){details=`Здоровье: ${Math.ceil(e.hp)}/${e.maxHp}`;if(stats[e.type]?.resource){details+=`\nРаботники: ${game.workers(e).length}/2 · продукция: ${Math.floor(e.buffer)}/60`;if(e.node)details+=`\nОстаток залежи: ${Math.floor(game.get(e.node)?.amount||0)}`;}if(e.type==='worker')details+=`\n${e.training?'Идёт обучение':e.job?'Работает: '+names[game.get(e.job)?.type]:'Перевозчик'}${e.carry?' · несёт '+e.carry.amount+' '+resourceNames[e.carry.resource]:''}`;if(e.type==='house')details+='\n+4 места · новый житель каждые 20 с за 8 еды';if(e.type==='deposit')details=`${resourceNames[e.resource]}: ${Math.floor(e.amount)}`;
 if(e.type==='barracks'){action(actions,`Обучить солдата · ${costText(soldierCost)}`,()=>{if(!game.train(e.id))game.message='Нужен доступный рабочий без груза, ресурсы и место в очереди (до 3).';},paused||!!game.result||!game.affordable(soldierCost));details+=`\nОчередь: ${e.queue.length}/3${e.queue.length?' · обучение '+Math.ceil(e.queue[0].left)+' с после прибытия':''}`;}}
 $('#details').textContent=details;
 if(units.some(u=>u.type==='worker'))action(actions,'Освободить рабочих → перевозчики',()=>{for(const u of units)if(u.type==='worker')game.release(u);},paused||!!game.result);
 if(units.some(u=>u.type==='soldier'))action(actions,'Вернуть солдат в рабочие (без возврата цены)',()=>game.demobilize(selected),paused||!!game.result);
 if(e&&stats[e.type]?.slots)action(actions,'Назначить свободного рабочего',()=>{const u=game.alive().find(u=>u.team===0&&u.type==='worker'&&!u.job&&!u.training&&!u.carry);if(!u||!game.assign([u.id],e.id))game.message='Нет свободного рабочего или все места заняты.';},paused||!!game.result);
 $('#overlay').hidden=!paused&&!game.result;$('#endtitle').textContent=game.result==='victory'?'Победа! Вражеская ратуша разрушена':game.result==='defeat'?'Поражение: ратуша разрушена':'Пауза';$('#pause').textContent=paused?'Продолжить':'Пауза';
}
function point(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};}
function hit(p){return game.alive().filter(e=>Math.abs(e.x-p.x)<e.size/2+.15&&Math.abs(e.y-p.y)<e.size/2+.15).sort((a,b)=>a.size-b.size)[0];}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(paused||game.result)return;mouse=point(e);if(e.button===2){placing=null;game.command(selected,mouse.x,mouse.y,hit(mouse)?.id);updateUI();return;}if(e.button!==0)return;if(placing){if(game.build(placing,Math.round(mouse.x),Math.round(mouse.y)))placing=null;updateUI();return;}drag={start:mouse,end:mouse,shift:e.shiftKey};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{mouse=point(e);if(drag)drag.end=mouse;});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const a=drag.start,b=point(e);let ids=[];if(dist(a,b)<.3){const unit=hit(b);if(unit&&(unit.team===0||unit.type==='deposit'))ids=[unit.id];}else ids=game.alive().filter(u=>u.team===0&&stats[u.type]?.speed&&u.x>=Math.min(a.x,b.x)&&u.x<=Math.max(a.x,b.x)&&u.y>=Math.min(a.y,b.y)&&u.y<=Math.max(a.y,b.y)).map(u=>u.id);selected=drag.shift?[...new Set([...selected,...ids])]:ids;drag=null;updateUI();});
canvas.addEventListener('pointercancel',()=>drag=null);
function pause(){if(!game.result){paused=!paused;drag=null;updateUI();}}
function restart(fresh){game=new Game(fresh?undefined:game.seed);selected=[];placing=null;paused=false;drag=null;updateUI();}
$('#pause').onclick=pause;$('#restart').onclick=()=>restart(false);$('#new').onclick=()=>restart(true);
window.addEventListener('keydown',e=>{if(e.code==='Escape'){placing=null;drag=null;updateUI();}if(e.code==='Space'&&!['BUTTON','INPUT','SELECT'].includes(e.target.tagName)){e.preventDefault();pause();}});
window.addEventListener('blur',()=>{if(!game.result){paused=true;drag=null;updateUI();}});
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function render(){
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)rect(x*T,y*T,T,T,game.terrain[y][x]?'#38413b':(x+y)%2?'#526c47':'#4e6643');
 for(const e of game.alive().sort((a,b)=>a.y-b.y)){
  const x=e.x*T,y=e.y*T,s=e.size*T;
  if(e.type==='deposit'){rect(x-9,y-9,18,18,e.amount>0?colors[e.resource]:'#4b5046');ctx.fillStyle='#172020';ctx.font='12px monospace';ctx.fillText(resourceNames[e.resource][0],x-4,y+4);continue;}
  const unit=!!stats[e.type]?.speed;rect(x-s/2+2,y-s/2+2,s-4,s-4,e.team===0?'#448bc4':'#c95c55');
  if(unit){rect(x-4,y-7,8,7,'#e7d2a2');if(e.type==='soldier')rect(x+6,y-10,3,18,'#e2e5eb');if(e.carry)rect(x-11,y,6,8,colors[e.carry.resource]);}
  else{ctx.font='bold 18px monospace';ctx.fillStyle='#fff';ctx.fillText(labels[e.type],x-6,y+6);if(stats[e.type].resource){rect(x-s/2,y+s/2-5,s*e.buffer/60,3,'#f1d582');ctx.font='10px monospace';ctx.fillText(`${game.workers(e).length}/2`,x-10,y+18);}}
  if(selected.includes(e.id)){ctx.strokeStyle='#fff2a3';ctx.lineWidth=2;ctx.strokeRect(x-s/2,y-s/2,s,s);}
  if(e.hp<e.maxHp||selected.includes(e.id)){rect(x-s/2,y-s/2-6,s,3,'#222');rect(x-s/2,y-s/2-6,s*e.hp/e.maxHp,3,'#a5e477');}
 }
 if(drag){const a=drag.start,b=drag.end;ctx.strokeStyle='#fff2a3';ctx.strokeRect(Math.min(a.x,b.x)*T,Math.min(a.y,b.y)*T,Math.abs(a.x-b.x)*T,Math.abs(a.y-b.y)*T);}
 if(placing){const x=Math.round(mouse.x),y=Math.round(mouse.y);rect((x-1)*T,(y-1)*T,48,48,game.canBuild(placing,x,y)?'#b4ff8b99':'#ff685b99');}
}
function frame(now){const dt=last===null?0:Math.min((now-last)/1000,.1);last=now;if(!paused)game.tick(dt);render();uiTimer+=dt;if(uiTimer>.2){updateUI();uiTimer=0;}requestAnimationFrame(frame);}
updateUI();requestAnimationFrame(frame);
