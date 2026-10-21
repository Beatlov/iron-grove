'use strict';
const {Game,stats,W,H,dist,resources,soldierCost}=RTS;
const $=s=>document.querySelector(s),canvas=$('#game'),ctx=canvas.getContext('2d'),T=24,VW=42,VH=26;
ctx.imageSmoothingEnabled=false;
const minimap=$('#minimap'),mini=minimap.getContext('2d'),camera={x:0,y:H/2-VH/2},keys=new Set(),cursor={x:0,y:0};
let gameSpeed=.6;
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
 const builds=$('#buildings');builds.replaceChildren();for(const type of Object.keys(labels).filter(t=>t!=='base')){const b=action(builds,`${names[type]} (${labels[type]})`,()=>{if(!paused&&!game.result)placing=placing===type?null:type;},!game.affordable(stats[type].cost)||!!game.result);if(placing===type)b.className='active';const small=document.createElement('small');small.textContent=costText(stats[type].cost)+` · ${stats[type].buildTime} с`;b.append(small);}
 const units=selected.map(id=>game.get(id)),e=units[0],actions=$('#actions');actions.replaceChildren();$('#selection').textContent=units.length>1?`Выбрано: ${units.length}`:e?names[e.type]||resourceNames[e.resource]:'Ничего не выбрано';
 let details='ЛКМ — выбрать · ПКМ — приказ';if(e&&units.length===1){details=`Здоровье: ${Math.ceil(e.hp)}/${e.maxHp}`;if(stats[e.type]?.resource){details+=`\nРаботники: ${game.workers(e).length}/2 · продукция: ${Math.floor(e.buffer)}/60`;if(e.node)details+=`\nОстаток залежи: ${Math.floor(game.get(e.node)?.amount||0)}`;}if(e.type==='worker')details+=`\n${e.training?'Идёт обучение':e.job?'Работает: '+names[game.get(e.job)?.type]:'Перевозчик'}${e.carry?' · несёт '+e.carry.amount+' '+resourceNames[e.carry.resource]:''}`;if(e.type==='house')details+='\n+4 места · новый житель каждые 20 с за 8 еды';if(e.type==='deposit')details=`${resourceNames[e.resource]}: ${Math.floor(e.amount)}`;
 if(e.construction>0)details+=`\nСтроится: ${Math.round((1-e.construction/stats[e.type].buildTime)*100)}% · осталось ${Math.ceil(e.construction)} игровых с`;
 if(e.type==='barracks'){action(actions,`Обучить солдата · ${costText(soldierCost)}`,()=>{if(!game.train(e.id))game.message='Нужен доступный рабочий без груза, ресурсы и место в очереди (до 3).';},paused||!!game.result||!game.ready(e)||!game.affordable(soldierCost));details+=`\nОчередь: ${e.queue.length}/3${e.queue.length?' · обучение '+Math.ceil(e.queue[0].left)+' с после прибытия':''}`;}}
 $('#details').textContent=details;
 if(units.some(u=>u.type==='worker'))action(actions,'Освободить рабочих → перевозчики',()=>{for(const u of units)if(u.type==='worker')game.release(u);},paused||!!game.result);
 if(units.some(u=>u.type==='soldier'))action(actions,'Вернуть солдат в рабочие (без возврата цены)',()=>game.demobilize(selected),paused||!!game.result);
 if(e&&stats[e.type]?.slots)action(actions,'Назначить свободного рабочего',()=>{const u=game.alive().find(u=>u.team===0&&u.type==='worker'&&!u.job&&!u.training&&!u.carry);if(!u||!game.assign([u.id],e.id))game.message='Нет свободного рабочего или все места заняты.';},paused||!!game.result||!game.ready(e));
 $('#overlay').hidden=!paused&&!game.result;$('#endtitle').textContent=game.result==='victory'?'Победа! Вражеская ратуша разрушена':game.result==='defeat'?'Поражение: ратуша разрушена':'Пауза';$('#pause').textContent=paused?'Продолжить':'Пауза';
}
function point(ev){const r=canvas.getBoundingClientRect();cursor.x=(ev.clientX-r.left)*VW/r.width;cursor.y=(ev.clientY-r.top)*VH/r.height;return{x:camera.x+cursor.x,y:camera.y+cursor.y};}
function hit(p){return game.alive().filter(e=>Math.abs(e.x-p.x)<e.size/2+.15&&Math.abs(e.y-p.y)<e.size/2+.15).sort((a,b)=>a.size-b.size)[0];}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(paused||game.result)return;mouse=point(e);if(e.button===2){placing=null;game.command(selected,mouse.x,mouse.y,hit(mouse)?.id);updateUI();return;}if(e.button!==0)return;if(placing){if(game.build(placing,Math.round(mouse.x),Math.round(mouse.y)))placing=null;updateUI();return;}drag={start:mouse,end:mouse,shift:e.shiftKey};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{mouse=point(e);if(drag)drag.end=mouse;});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const a=drag.start,b=point(e);let ids=[];if(dist(a,b)<.3){const unit=hit(b);if(unit&&(unit.team===0||unit.type==='deposit'))ids=[unit.id];}else ids=game.alive().filter(u=>u.team===0&&stats[u.type]?.speed&&u.x>=Math.min(a.x,b.x)&&u.x<=Math.max(a.x,b.x)&&u.y>=Math.min(a.y,b.y)&&u.y<=Math.max(a.y,b.y)).map(u=>u.id);selected=drag.shift?[...new Set([...selected,...ids])]:ids;drag=null;updateUI();});
canvas.addEventListener('pointercancel',()=>drag=null);
function pause(){if(!game.result){paused=!paused;drag=null;updateUI();}}
function restart(fresh){game=new Game(fresh?undefined:game.seed);selected=[];placing=null;paused=false;drag=null;home();updateUI();}
$('#pause').onclick=pause;$('#restart').onclick=()=>restart(false);$('#new').onclick=()=>restart(true);
function clampCamera(){camera.x=Math.round(Math.max(0,Math.min(W-VW,camera.x))*T)/T;camera.y=Math.round(Math.max(0,Math.min(H-VH,camera.y))*T)/T;}
function home(){const b=game.alive().find(e=>e.team===0&&e.type==='base');camera.x=b?b.x-VW/2:0;camera.y=b?b.y-VH/2:0;clampCamera();}
$('#home').onclick=home;
$('#speed').onchange=e=>{gameSpeed=Number(e.target.value);};
minimap.addEventListener('pointerdown',e=>{const r=minimap.getBoundingClientRect();camera.x=(e.clientX-r.left)/r.width*W-VW/2;camera.y=(e.clientY-r.top)/r.height*H-VH/2;clampCamera();});
window.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);}
 if(e.code==='Home'){e.preventDefault();home();}
 if(e.code==='Escape'){placing=null;drag=null;updateUI();}
 if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();pause();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(!game.result){paused=true;drag=null;updateUI();}});
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function drawDeposit(e,x,y){
 rect(x-9,y+5,20,6,'#253a2b88');
 if(e.amount<=0){rect(x-5,y+2,10,4,'#71634b');return;}
 if(e.resource==='wood'){
  rect(x-2,y-1,5,13,'#705036');rect(x-1,y+1,2,9,'#ac8150');
  rect(x-9,y-8,19,12,'#234b35');rect(x-7,y-15,15,12,'#316244');rect(x-4,y-20,9,10,'#467c4d');
  rect(x-6,y-12,5,3,'#659354');rect(x+2,y-5,5,3,'#3f7a4c');
 }else{
  rect(x-10,y-2,20,10,'#59616a');rect(x-7,y-8,15,12,'#818b91');rect(x-3,y-12,8,5,'#a7b2b2');rect(x-8,y-2,6,4,'#b1b9b5');
  if(e.resource!=='stone'){const c=colors[e.resource];rect(x-5,y-5,4,4,c);rect(x+4,y,4,3,c);rect(x+1,y-9,3,3,c);}
 }
}
function drawUnit(e,x,y){
 const c=e.team===0?'#76b6cf':'#db8271',dark=e.team===0?'#365569':'#773e3c',walk=e.path.length?Math.sin(game.time*10+e.id)*2:0;
 rect(x-7,y+6,15,4,'#263f2b88');rect(x-4,y+2,3,5+walk,'#292e31');rect(x+2,y+2,3,5-walk,'#292e31');
 rect(x-5,y-5,11,9,dark);rect(x-4,y-5,9,4,c);rect(x-3,y-12,7,7,'#dab78d');rect(x+1,y-10,2,2,'#272f31');
 if(e.type==='soldier'){
  rect(x-4,y-15,9,5,'#9aaab0');rect(x-3,y-15,7,2,'#d8e2dc');rect(x-1,y-17,3,3,c);
  rect(x-9,y-3,5,8,dark);rect(x-8,y-2,3,5,c);rect(x+7,y-12,2,14,'#e1e5dc');rect(x+5,y+1,6,2,'#c2a064');
 }else{
  rect(x-4,y-14,9,3,'#c6a16b');rect(x-6,y-12,12,2,'#e0bc7b');rect(x+6,y-4,2,12,'#9c7947');rect(x+5,y-7,6,4,'#b9c5c3');
 }
 if(e.carry){rect(x-11,y-2,6,8,'#715138');rect(x-10,y-3,5,5,colors[e.carry.resource]);rect(x-10,y+4,5,1,'#d4b47c');}
 if(e.job&&!e.path.length){rect(x+9,y-9,2,2,'#f4d88b');}
}
function drawBuilding(e,x,y){
 const s=e.size*T,l=x-s/2,t=y-s/2,c=e.team===0?'#74b6d3':'#d98271',dark=e.team===0?'#335b72':'#794443';
 rect(l+3,t+7,s,s-2,'#243a2b88');
 if(e.construction>0){
  rect(l+2,t+4,s-4,s-8,'#81725b');
  for(let row=0;row<4;row++)for(let col=0;col<5;col++)rect(l+4+col*8+(row%2?2:0),t+8+row*8,6,4,'#a69a7b');
  for(const dx of [3,s-5])rect(l+dx,t,3,s,'#c9a36a');
  for(const dy of [6,s-8])rect(l,t+dy,s,3,'#d7b37a');
  line(l+4,t+s-9,l+s-4,t+8,'#97733f',3);
  const p=1-e.construction/stats[e.type].buildTime;rect(l,y+s/2+3,s,5,'#202c2e');rect(l,y+s/2+3,s*p,5,'#e6cb7c');
  ctx.font='10px monospace';ctx.fillStyle='#fff1ce';ctx.fillText(Math.ceil(e.construction)+'с',x-9,t-4);return;
 }
 if(e.type==='farm'){
  rect(l,t,s,s,'#69533a');for(let row=0;row<5;row++){rect(l+3,t+4+row*8,s-6,3,'#3d3829');for(let col=0;col<6;col++){rect(l+5+col*6,t+3+row*8,2,5,'#c6b85f');rect(l+4+col*6,t+3+row*8,4,2,'#e0d17d');}}
  rect(l,t+s-3,s,3,'#b59762');rect(l,t,2,s,'#b59762');
 }else if(e.type==='tower'){
  rect(x-15,t+5,30,s-5,'#656d71');rect(x-11,t+6,22,s-8,'#949a90');
  for(let row=0;row<5;row++)rect(x-11+(row%2)*9,t+10+row*7,9,2,'#606c6e');
  rect(x-18,t+3,36,9,'#b0b2a0');for(let col=0;col<4;col++)rect(x-18+col*10,t-3,6,8,'#b9baa5');
  rect(x-5,y-7,10,14,'#29353b');rect(x-4,y-6,8,3,c);
 }else if(['quarry','ironmine','goldmine'].includes(e.type)){
  rect(l+3,t+12,s-6,s-12,'#60676b');rect(l+9,t+5,s-18,s-8,'#8e9896');rect(l+14,t+14,s-28,s-15,'#202a2b');
  rect(l+10,t+12,5,s-10,'#a18659');rect(l+s-15,t+12,5,s-10,'#a18659');rect(l+10,t+10,s-20,5,'#d1ad71');
  const c2=e.type==='quarry'?colors.stone:colors[stats[e.type].resource];for(let i=0;i<3;i++)rect(l+4+i*7,t+s-8,5,5,c2);
  line(x+2,t+s-5,x+7,t+s+4,'#baa98a',2);line(x+12,t+s-5,x+17,t+s+4,'#baa98a',2);
 }else{
  rect(l+3,t+10,s-6,s-10,'#8b896f');rect(l+6,t+13,s-12,s-17,'#b5ab86');
  for(let row=0;row<3;row++)rect(l+5,t+20+row*9,s-10,1,'#96916e');
  rect(l,t+8,s,7,dark);rect(l+4,t+2,s-8,8,c);rect(l+9,t-3,s-18,7,c);rect(l+7,t+5,s-14,2,'#b5d2ca');
  rect(x-5,y+5,10,s/2-5,'#384039');rect(x-3,y+8,6,3,'#d4bf87');
  for(const dx of [-s/2+8,s/2-15]){rect(x+dx,y-1,7,8,'#3a555e');rect(x+dx+1,y,4,4,'#d3d1a3');}
  if(e.type==='base'){rect(x+s/2-10,t-19,2,23,'#cfb989');rect(x+s/2-8,t-19,14,9,c);}
  if(e.type==='warehouse'||e.type==='sawmill'){for(let i=0;i<3;i++){rect(l+3+i*9,t+s-9,8,7,'#745335');rect(l+4+i*9,t+s-8,5,5,'#bf9760');}}
  if(e.type==='sawmill'){rect(x-14,t+s-15,28,4,'#6a4a32');rect(x-12,t+s-15,3,4,'#dfbc7c');}
  if(e.type==='barracks'){line(x-10,t+16,x+9,t+31,'#e1ded0',2);line(x+10,t+16,x-9,t+31,'#e1ded0',2);rect(x-4,t+20,8,9,c);}
  if(e.type==='house'){rect(l+s-14,t-6,5,11,'#6f6558');rect(l+s-15,t-7,7,3,'#b2a284');}
 }
 // A small team pennant also identifies farms and mines.
 rect(l+s-4,t+14,2,14,'#cdb485');rect(l+s-2,t+14,7,5,c);
 if(stats[e.type].resource){rect(l,y+s/2+3,s,3,'#23352b');rect(l,y+s/2+3,s*e.buffer/60,3,'#e5ce83');ctx.font='9px monospace';ctx.fillStyle='#f4e8c7';ctx.fillText(`${game.workers(e).length}/2`,x-8,y+s/2+14);}
}
function render(){
 ctx.save();ctx.translate(-camera.x*T,-camera.y*T);
 for(let y=Math.floor(camera.y);y<Math.min(H,Math.ceil(camera.y+VH));y++)for(let x=Math.floor(camera.x);x<Math.min(W,Math.ceil(camera.x+VW));x++){
  const px=x*T,py=y*T,n=(x*31+y*17+x*y)%29;
  rect(px,py,T,T,game.terrain[y][x]?'#354334':n%3?'#536d46':'#58724a');
  if(!game.terrain[y][x]){rect(px+3+n%15,py+4+n%14,2,3,'#6c8552');if(n<5)rect(px+14,py+15,2,2,'#b3ab70');}
 }
 for(const e of game.alive().sort((a,b)=>a.y-b.y)){
  if(e.x<camera.x-3||e.y<camera.y-3||e.x>camera.x+VW+3||e.y>camera.y+VH+3)continue;
  const x=Math.round(e.x*T),y=Math.round(e.y*T),s=e.size*T;
  if(e.type==='deposit'){drawDeposit(e,x,y);continue;}
  if(stats[e.type]?.speed)drawUnit(e,x,y);else drawBuilding(e,x,y);
  if(selected.includes(e.id)){ctx.strokeStyle='#f8e9a1';ctx.lineWidth=1;ctx.strokeRect(x-s/2,y-s/2,s,s);}
  if(e.hp<e.maxHp||selected.includes(e.id)){rect(x-s/2,y-s/2-11,s,3,'#222c2a');rect(x-s/2,y-s/2-11,s*e.hp/e.maxHp,3,'#b0d78b');}
 }
 if(drag){const a=drag.start,b=drag.end;ctx.strokeStyle='#fff2a3';ctx.strokeRect(Math.min(a.x,b.x)*T,Math.min(a.y,b.y)*T,Math.abs(a.x-b.x)*T,Math.abs(a.y-b.y)*T);}
 if(placing){const x=Math.round(mouse.x),y=Math.round(mouse.y);rect((x-1)*T,(y-1)*T,48,48,game.canBuild(placing,x,y)?'#b4ff8b99':'#ff685b99');}
 ctx.restore();
 mini.fillStyle='#344b36';mini.fillRect(0,0,216,132);
 for(const e of game.alive()){mini.fillStyle=e.type==='deposit'?colors[e.resource]:e.team===0?'#80c7ef':'#ef8a79';const size=stats[e.type]?.speed?2:e.size*3;mini.fillRect(e.x*3-size/2,e.y*3-size/2,size,size);}
 mini.strokeStyle='#fff2bb';mini.lineWidth=1;mini.strokeRect(camera.x*3,camera.y*3,VW*3,VH*3);
}
function frame(now){
 const dt=last===null?0:Math.min((now-last)/1000,.1);last=now;
 if(!drag){const dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));camera.x+=dx*18*dt;camera.y+=dy*18*dt;clampCamera();}
 mouse={x:camera.x+cursor.x,y:camera.y+cursor.y};if(!paused)game.tick(dt*gameSpeed);render();uiTimer+=dt;if(uiTimer>.2){updateUI();uiTimer=0;}requestAnimationFrame(frame);
}
home();updateUI();requestAnimationFrame(frame);
