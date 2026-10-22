'use strict';
const {Game,stats,W,H,dist,resources,soldierCost}=RTS;
const $=s=>document.querySelector(s),canvas=$('#game'),ctx=canvas.getContext('2d'),T=24;
let VW=42,VH=26,commandMode=null,helpOpen=false,hoveredCommand=null,buildUIKey='',orderUIKey='';
ctx.imageSmoothingEnabled=false;
const minimap=$('#minimap'),mini=minimap.getContext('2d'),camera={x:0,y:H/2-VH/2},keys=new Set(),cursor={x:0,y:0};
const worldCanvas=$('#worldmap'),worldContext=worldCanvas.getContext('2d');
let gameSpeed=.6,inMenu=true,started=false,worldOpen=false,selectedRegion=0,pings=[],visualTime=0;
const names={worker:'Рабочий',soldier:'Солдат',base:'Ратуша',house:'Дом',warehouse:'Склад',sawmill:'Лесопилка',quarry:'Каменоломня',farm:'Ферма',ironmine:'Железная шахта',goldmine:'Золотая шахта',barracks:'Казарма',tower:'Башня',outpost:'Башня владений'};
const resourceNames={wood:'Дерево',stone:'Камень',food:'Еда',iron:'Железо',gold:'Золото'},colors={wood:'#8fba64',stone:'#aaaeb8',food:'#dfce71',iron:'#aac7cf',gold:'#f1bf49'};
const labels={base:'Р',house:'Д',warehouse:'С',sawmill:'Л',quarry:'К',farm:'Ф',ironmine:'Ж',goldmine:'З',barracks:'Б',tower:'Т',outpost:'Ф'};
let game=new Game(),selected=[],placing=null,paused=false,mouse={x:0,y:0},drag=null,last=null,uiTimer=0;
const costText=c=>Object.entries(c).map(([r,n])=>`${n} ${resourceNames[r].toLowerCase()}`).join(', ');
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function action(parent,text,fn,disabled=false){const b=document.createElement('button');b.textContent=text;b.disabled=disabled;b.onclick=()=>{fn();updateUI();};parent.append(b);return b;}
function commandButton(parent,label,type,fn,disabled,detail){
 const b=action(parent,label,fn,disabled);b.className='command-button'+(commandMode===type?' active':'');b.title=detail;b.ariaLabel=detail;
 b.replaceChildren();const icon=document.createElement('canvas');icon.width=32;icon.height=32;icon.className='command-icon';drawCommandIcon(icon,type);const name=document.createElement('span');name.className='command-name';name.textContent=label;b.append(icon);b.append(name);
 b.onmouseenter=b.onfocus=()=>{hoveredCommand=detail;$('#command-hint').textContent=detail;};b.onmouseleave=b.onblur=()=>{hoveredCommand=null;};return b;
}
function drawCommandIcon(canvas,type){
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;const r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 if(type==='move'){r(5,14,22,5,'#b9cc91');r(20,9,5,15,'#b9cc91');r(25,13,4,7,'#e0e6ad');return;}
 if(type==='attack'||type==='soldier'){r(15,3,3,22,'#d9e0ce');r(12,23,9,3,'#cfad68');r(15,26,3,5,'#8d6842');if(type==='soldier'){r(3,13,8,13,'#779eaa');r(4,14,6,3,'#b0c3b8');}else{r(3,15,26,2,'#b67d64');r(15,5,2,24,'#b67d64');}return;}
 if(type==='stop'){r(7,7,19,19,'#c9b68a');r(10,10,13,13,'#6b5b3a');return;}
 if(type==='map'){r(3,5,26,22,'#709377');r(12,5,2,22,'#a9bc8e');r(21,5,2,22,'#a9bc8e');r(4,15,24,2,'#b9c79c');r(23,7,3,3,'#d6c38d');return;}
 if(type==='worker'||type==='assign'){r(11,5,10,9,'#d9ba8e');r(9,3,14,4,'#c3a56a');r(8,15,16,12,'#7ca9ac');r(10,26,4,5,'#879786');r(19,26,4,5,'#879786');if(type==='assign'){r(24,7,3,11,'#cadc9d');r(20,11,11,3,'#cadc9d');}return;}
 if(type==='farm'){r(3,7,26,22,'#806443');for(let x=6;x<29;x+=6)for(let y=9;y<28;y+=7){r(x,y,2,5,'#d7ca7e');r(x-1,y,4,2,'#e3d799');}return;}
 if(['quarry','ironmine','goldmine'].includes(type)){r(4,12,24,17,'#7f8e8c');r(9,6,15,10,'#a2aba0');r(11,15,12,14,'#17261e');r(9,14,3,15,'#c3a16e');r(22,14,3,15,'#c3a16e');const color=type==='goldmine'?colors.gold:type==='ironmine'?colors.iron:colors.stone;r(3,25,5,4,color);r(26,24,4,5,color);return;}
 if(type==='tower'){r(8,7,17,22,'#a6ad98');r(4,7,25,6,'#bac0a5');for(let x=4;x<29;x+=9)r(x,3,6,7,'#bac0a5');r(13,16,7,10,'#354e43');return;}
 r(5,13,22,16,'#b0a77e');r(2,8,28,6,'#6f9eab');r(6,4,20,5,'#a3c7c7');r(13,20,7,9,'#324b3b');r(7,17,4,5,'#d5cf9a');r(22,17,4,5,'#d5cf9a');
 if(type==='house')r(23,2,4,9,'#9a8c70');
 if(type==='warehouse'||type==='sawmill'){r(2,24,8,6,'#b18e5a');r(21,24,9,6,'#b18e5a');}
 if(type==='barracks'){r(15,11,2,12,'#e3e4cd');r(11,20,10,2,'#d3bb7b');}
}
function canCommandSelection(){return selected.some(id=>{const u=game.get(id);return u&&stats[u.type]?.speed&&!u.training&&!u.inside;});}
function setCommandMode(mode){if(paused||inMenu||game.result||helpOpen||!canCommandSelection())return;commandMode=mode;placing=null;hoveredCommand=null;updateUI();}
function stopSelected(){if(paused||inMenu||game.result)return;for(const id of selected){const u=game.get(id);if(u&&stats[u.type]?.speed&&!u.inside)game.release(u);}commandMode=null;placing=null;game.message='Приказ прекращён. Свободные рабочие вернутся к перевозке.';updateUI();}
function resizeViewport(){const r=$('#battlefield').getBoundingClientRect();if(!r.width||!r.height)return;VW=Math.min(W,Math.max(12,r.width/T));VH=Math.min(H,Math.max(8,r.height/T));canvas.width=Math.round(VW*T);canvas.height=Math.round(VH*T);ctx.imageSmoothingEnabled=false;clampCamera();}
function toggleHelp(show){helpOpen=show;$('#help').hidden=!show;keys.clear();drag=null;}
$('#help-open').onclick=()=>toggleHelp(true);$('#help-close').onclick=()=>toggleHelp(false);
window.addEventListener('resize',resizeViewport);

function updateUI(){
 selected=selected.filter(id=>game.get(id)&&!game.get(id).inside);
 const p=game.population(),stock=game.stock(),units=selected.map(id=>game.get(id)),e=units[0];
 const resourceBar=$('#resources');resourceBar.replaceChildren();
 for(const r of resources){const item=document.createElement('span');item.className='resource';item.style.color=colors[r];const icon=document.createElement('i');icon.className='resource-icon';icon.style.backgroundColor=colors[r];const data=document.createElement('span'),label=document.createElement('span'),value=document.createElement('strong');label.className='resource-label';label.textContent=resourceNames[r];value.className='resource-value';value.textContent=Math.floor(stock[r]);data.append(label);data.append(value);item.append(icon);item.append(data);resourceBar.append(item);}
 const carriers=game.alive().filter(u=>u.team===0&&u.type==='worker'&&!u.job&&!u.training&&!u.building).length;
 $('#population').textContent=`Население: ${p.total}/${p.capacity}`;
 $('#population').title=`Рабочие: ${p.workers} · Солдаты: ${p.soldiers} · Перевозчики: ${carriers}. За 5 с: ${p.total} еды, ${p.soldiers*.5} золота.`;
 $('#economy-info').textContent=`Рабочие ${p.workers} · Бойцы ${p.soldiers} · Перевозчики ${carriers}`;
 $('#clock').textContent=clock(game.time);
 const message=commandMode?(commandMode==='move'?'Идти: укажите место левой кнопкой. Esc — отмена.':'Атака: укажите противника левой кнопкой. Esc — отмена.'):placing?`Строительство: ${names[placing]}. ЛКМ по зелёному месту; Esc — отмена.`:game.teams[0].hungry?'Не хватает еды! Назначьте рабочих на ферму и оставьте перевозчиков.':game.teams[0].unpaid?'Не хватает золота! Солдаты теряют здоровье.':game.message;
 $('#message').textContent=message;$('#message').title=message;
 const types=Object.keys(labels).filter(t=>t!=='base'&&t!=='outpost');
 const buildKey=JSON.stringify([placing,paused,!!game.result,types.map(t=>game.affordable(stats[t].cost))]);
 if(buildKey!==buildUIKey){buildUIKey=buildKey;const builds=$('#buildings');builds.replaceChildren();
  for(const type of types){const detail=`${names[type]} — ${costText(stats[type].cost)} · ${stats[type].buildTime} игровых с`;
   const b=commandButton(builds,names[type],type,()=>{if(!paused&&!game.result&&!inMenu){commandMode=null;placing=placing===type?null:type;}},paused||!game.affordable(stats[type].cost)||!!game.result,detail);if(placing===type)b.className+=' active';}
 }
 $('#selection').textContent=units.length>1?`Отряд · ${units.length}`:e?names[e.type]||resourceNames[e.resource]:'Нет выбранного объекта';
 let details='Выберите юнита или здание на карте.\nПриказы — справа, постройки — в ряду над панелью.';
 if(e&&units.length===1){details=`Здоровье: ${Math.ceil(e.hp)} / ${e.maxHp}`;
  if(stats[e.type]?.resource){details+=`\nРаботники: ${game.workers(e).length}/2 · продукция: ${Math.floor(e.buffer)}/60`;if(e.node)details+=`\nОстаток залежи: ${Math.floor(game.get(e.node)?.amount||0)}`;}
  if(e.type==='worker')details+=`\n${e.training?'Обучение в казарме':e.building?'Строитель':e.job?'Работает: '+names[game.get(e.job)?.type]:'Перевозчик'}${e.carry?' · несёт '+e.carry.amount+' '+resourceNames[e.carry.resource]:''}`;
  if(e.type==='soldier')details+='\nБоевая пехота · содержание: 1 еда и 0,5 золота / 5 с';
  if(e.type==='house')details+='\n+4 места · житель каждые 20 с за 8 еды';
  if(e.type==='deposit')details=`${resourceNames[e.resource]}: ${Math.floor(e.amount)}`;
  if(e.type==='outpost'){const r=game.regions[e.region];details=r.name+'\n'+(r.owner===0?'Ваша территория':r.owner===1?'Вражеская территория':'Нейтральная территория')+'\nЗахват: '+Math.floor(r.progress/12*100)+'% · 12 с у башни';}
  if(e.construction>0){const builder=game.get(e.builder);details+=`\nГотовность: ${Math.round((1-e.construction/stats[e.type].buildTime)*100)}% · ${Math.ceil(e.construction)} с работы\n${builder?(game.adjacent(builder,e)?'Рабочий строит':'Строитель в пути'):'Ожидает свободного рабочего'}`;}
  if(e.type==='barracks')details+=`\nОчередь: ${e.queue.length}/3${e.queue.length?' · '+Math.ceil(e.queue[0].left)+' с после прибытия':''}`;
 }else if(units.length>1){const workers=units.filter(u=>u.type==='worker').length,soldiers=units.filter(u=>u.type==='soldier').length;details=`Рабочие: ${workers} · Солдаты: ${soldiers}\nКлик по карточке — выбрать одного. Shift — добавить к выбору.`;}
 selectionCards(units);$('#details').textContent=details;const health=$('#portrait-health');health.hidden=units.length!==1||!Number.isFinite(e?.maxHp);if(!health.hidden){$('#health-fill').style.width=Math.max(0,e.hp/e.maxHp*100)+'%';health.ariaValueNow=String(Math.ceil(e.hp));health.ariaValueMin='0';health.ariaValueMax=String(e.maxHp);}
 const orderKey=JSON.stringify([selected,paused,!!game.result,commandMode,game.ready(e),game.affordable(soldierCost),units.map(u=>[u.training,u.building]),e?game.workers(e).length:0]);
 if(orderKey!==orderUIKey){orderUIKey=orderKey;const actions=$('#actions');actions.replaceChildren();const canAct=units.some(u=>stats[u.type]?.speed&&!u.training),blocked=paused||!!game.result;
  if(canAct){commandButton(actions,'Идти','move',()=>setCommandMode('move'),blocked,'Идти · G. Укажите место левой кнопкой.');commandButton(actions,'Атака','attack',()=>setCommandMode('attack'),blocked,'Атаковать · F. Укажите противника левой кнопкой.');commandButton(actions,'Стоп','stop',stopSelected,blocked,'Прекратить приказ · X. Рабочие вернутся к перевозке.');}
  if(e?.type==='barracks')commandButton(actions,'Солдат','soldier',()=>{if(!game.train(e.id))game.message='Нужен рабочий без груза, ресурсы и место в очереди (до 3).';},blocked||!game.ready(e)||!game.affordable(soldierCost),'Обучить солдата — '+costText(soldierCost));
  if(e?.type==='outpost')commandButton(actions,'Владения','map',()=>{selectedRegion=e.region;toggleWorld(true);},false,'Открыть башню на глобальной карте.');
  if(units.some(u=>u.type==='worker'))commandButton(actions,'Перевозка','worker',()=>{for(const u of units)if(u.type==='worker')game.release(u);},blocked,'Освободить рабочих → перевозчики');
  if(units.some(u=>u.type==='soldier'))commandButton(actions,'В рабочие','worker',()=>game.demobilize(selected),blocked,'Вернуть солдат в рабочие без возврата цены.');
  if(e&&stats[e.type]?.slots)commandButton(actions,'Назначить','assign',()=>{const u=game.alive().find(u=>u.team===0&&u.type==='worker'&&!u.job&&!u.training&&!u.building&&!u.carry);if(!u||!game.assign([u.id],e.id))game.message='Нет свободного рабочего или все места заняты.';},blocked||!game.ready(e),'Назначить свободного рабочего');
  if(e&&stats[e.type]?.slots&&game.workers(e).length)commandButton(actions,'Снять рабочих','worker',()=>{for(const u of game.workers(e))game.release(u);},blocked,'Освободить рабочих из здания');
  while(actions.children.length<9){const slot=document.createElement('span');slot.className='empty-slot';actions.append(slot);}
 }
 $('#command-hint').textContent=hoveredCommand||(canCommandSelection()?'G — идти · F — атака · X — стоп':'Постройки — в ряду слева. Наведите на иконку, чтобы узнать цену.');
 const owned=game.regions.filter(r=>r.owner===0).length,enemy=game.regions.filter(r=>r.owner===1).length;
 $('#territory-score').textContent=`Владения: ${owned} / 12 · Враг: ${enemy}`;$('#territory-label').textContent=game.regionAt(camera.x+VW/2,camera.y+VH/2)?.name||'Рубежи';if(worldOpen)updateRegionPanel();
 $('#overlay').hidden=!paused&&!game.result;$('#endtitle').textContent=game.result==='victory'?'Победа! Вражеская ратуша разрушена':game.result==='defeat'?'Поражение: ратуша разрушена':'Пауза';$('#pause').className='speed-button'+(paused?' active':'');$('#pause').ariaPressed=String(paused);$('#pause').title=paused?'Продолжить · пробел':'Пауза · пробел';for(const [id,speed]of [['speed-slow',.4],['speed-normal',.6],['speed-fast',1]]){$('#'+id).className='speed-button'+(!paused&&gameSpeed===speed?' active':'');$('#'+id).ariaPressed=String(!paused&&gameSpeed===speed);}
}

function point(ev){const r=canvas.getBoundingClientRect();cursor.x=(ev.clientX-r.left)*VW/r.width;cursor.y=(ev.clientY-r.top)*VH/r.height;return{x:camera.x+cursor.x,y:camera.y+cursor.y};}
function hit(p){return game.visible().filter(e=>Math.abs(e.x-p.x)<e.size/2+.15&&Math.abs(e.y-p.y)<e.size/2+.15).sort((a,b)=>a.size-b.size)[0];}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(paused||game.result||inMenu||worldOpen||helpOpen)return;mouse=point(e);const target=hit(mouse);pings.push({...mouse,age:0,kind:commandMode==='move'?'move':(e.button===2||commandMode==='attack')?(target?.type==='outpost'?'capture':target?.team===1?'attack':'move'):'select'});if(e.button===2){commandMode=null;placing=null;game.command(selected,mouse.x,mouse.y,hit(mouse)?.id);updateUI();return;}if(e.button!==0)return;if(commandMode){if(commandMode==='attack'&&target?.team!==1&&target?.type!=='outpost'){game.message='Укажите противника для атаки.';updateUI();return;}game.command(selected,mouse.x,mouse.y,commandMode==='attack'?target?.id:undefined);commandMode=null;updateUI();return;}if(placing){if(game.build(placing,Math.round(mouse.x),Math.round(mouse.y))){placing=null;}updateUI();return;}drag={start:mouse,end:mouse,shift:e.shiftKey};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{mouse=point(e);if(drag)drag.end=mouse;});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const a=drag.start,b=point(e);let ids=[];if(dist(a,b)<.3){const unit=hit(b);if(unit&&(unit.team===0||unit.type==='deposit'||unit.type==='outpost'))ids=[unit.id];}else ids=game.visible().filter(u=>u.team===0&&stats[u.type]?.speed&&u.x>=Math.min(a.x,b.x)&&u.x<=Math.max(a.x,b.x)&&u.y>=Math.min(a.y,b.y)&&u.y<=Math.max(a.y,b.y)).map(u=>u.id);selected=drag.shift?[...new Set([...selected,...ids])]:ids;drag=null;commandMode=null;hoveredCommand=null;updateUI();});
canvas.addEventListener('pointercancel',()=>drag=null);
function pause(){if(!game.result&&!inMenu){paused=!paused;drag=null;commandMode=null;updateUI();}}
function restart(fresh){game=new Game(fresh?undefined:game.seed,{ai:game.aiEnabled});commandMode=null;buildUIKey='';orderUIKey='';pings=[];selectedRegion=game.homeRegions[0];selected=[];placing=null;paused=false;drag=null;home();updateUI();}
$('#pause').onclick=pause;$('#restart').onclick=()=>restart(false);
function clampCamera(){camera.x=Math.round(Math.max(0,Math.min(W-VW,camera.x))*T)/T;camera.y=Math.round(Math.max(0,Math.min(H-VH,camera.y))*T)/T;}
function home(){const b=game.alive().find(e=>e.team===0&&e.type==='base');camera.x=b?b.x-VW/2:0;camera.y=b?b.y-VH/2:0;clampCamera();}
$('#home').onclick=home;
function setSpeed(speed){gameSpeed=speed;paused=false;$('#menu-speed').value=String(speed);updateUI();}
$('#speed-slow').onclick=()=>setSpeed(.4);$('#speed-normal').onclick=()=>setSpeed(.6);$('#speed-fast').onclick=()=>setSpeed(1);
minimap.addEventListener('pointerdown',e=>{const r=minimap.getBoundingClientRect();camera.x=(e.clientX-r.left)/r.width*W-VW/2;camera.y=(e.clientY-r.top)/r.height*H-VH/2;clampCamera();});
window.addEventListener('keydown',e=>{
 if(inMenu)return;
 if(helpOpen){if(e.code==='Escape')toggleHelp(false);return;}
 if(e.code==='KeyM'){toggleWorld();return;}
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);}
 if(!worldOpen&&e.code==='KeyG')setCommandMode('move');
 if(!worldOpen&&e.code==='KeyF')setCommandMode('attack');
 if(!worldOpen&&e.code==='KeyX')stopSelected();
 if(e.code==='Home'){e.preventDefault();home();}
 if(e.code==='Escape'){if(worldOpen)toggleWorld(false);else if(commandMode){commandMode=null;}else if(placing){placing=null;drag=null;}else showMenu();updateUI();}
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
 const c=e.team===0?'#76b6cf':'#db8271',dark=e.team===0?'#365569':'#773e3c',phase=e.walkDistance*7,step=e.moving?Math.sin(phase)*2.5:0,bob=e.moving?Math.round(Math.abs(Math.sin(phase))*1.4):0,face=e.facingX<-.15?-1:1;
 rect(x-7,y+6,15,4,'#263f2b66');
 rect(x-4,y+2+Math.max(0,step),3,5,'#292e31');rect(x+2,y+2+Math.max(0,-step),3,5,'#292e31');
 rect(x-5,y-5-bob,11,9,dark);rect(x-4,y-5-bob,9,4,c);rect(x-3,y-12-bob,7,7,'#dab78d');rect(x+(face>0?1:-2),y-10-bob,2,2,'#272f31');
 rect(x-7,y-3-bob-step*.4,3,6,'#c5a47e');rect(x+5,y-3-bob+step*.4,3,6,'#c5a47e');
 if(e.type==='soldier'){
  rect(x-4,y-15-bob,9,5,'#9aaab0');rect(x-3,y-15-bob,7,2,'#d8e2dc');rect(x-1,y-17-bob,3,3,c);
  rect(x-9*face,y-3-bob-step*.3,5,8,dark);rect(x-8*face,y-2-bob-step*.3,3,5,c);rect(x+7*face,y-12-bob+step*.3,2,14,'#e1e5dc');rect(x+7*face-2,y+1-bob+step*.3,6,2,'#c2a064');
 }else{
  rect(x-4,y-14-bob,9,3,'#c6a16b');rect(x-6,y-12-bob,12,2,'#e0bc7b');
  const b=game.get(e.building),working=b&&game.adjacent(e,b),swing=working?Math.sin(game.time*11):0;
  const hx=x+7*face,hy=y-6-bob+step*.3-(working?(swing+1)*4:0);
  line(hx,y+3-bob,hx+face*(working?swing*4:0),hy,'#ad8850',2);rect(hx-2+face*(working?swing*4:0),hy-3,7,4,'#c3ccc4');
  if(working&&swing<-.7){rect(hx+face*4,y-3,2,2,'#e8cc8b');rect(hx+face*7,y-6,1,2,'#c1b78b');}
 }
 if(e.carry){const sway=e.moving?Math.round(step*.35):0;rect(x-11,y-2-bob+sway,6,8,'#715138');rect(x-10,y-3-bob+sway,5,5,colors[e.carry.resource]);rect(x-10,y+4-bob+sway,5,1,'#d4b47c');}
 if(e.moving&&Math.sin(phase)>.85)rect(x-5*face,y+10,2,1,'#a8b38b55');
}
function drawBuilding(e,x,y){
 const s=e.size*T,l=x-s/2,t=y-s/2,c=e.team===0?'#74b6d3':e.team===1?'#d98271':'#c9bb87',dark=e.team===0?'#335b72':e.team===1?'#794443':'#646248';
 rect(l+3,t+7,s,s-2,'#243a2b88');
 if(e.construction>0){
  const p=1-e.construction/stats[e.type].buildTime,builder=game.get(e.builder),working=builder&&game.adjacent(builder,e),wallHeight=Math.round(5+p*(s-12));
  rect(l+2,t+s-8,s-4,7,'#6b614c');rect(l+3,t+s-wallHeight,s-6,wallHeight-3,'#90876b');
  for(let row=0;row<Math.ceil(wallHeight/8);row++)for(let col=0;col<5;col++){const by=t+s-7-row*8;if(by>=t+s-wallHeight)rect(l+4+col*8+(row%2?2:0),by,6,3,'#b1a281');}
  for(const dx of [3,s-5])rect(l+dx,t,3,s,'#c9a36a');for(const dy of [6,s-8])rect(l,t+dy,s,3,'#d7b37a');line(l+4,t+s-9,l+s-4,t+8,'#97733f',3);
  if(working){const phase=(game.time*1.7)%1;rect(l+8+Math.sin(game.time*3)*3,t+s-4-phase*10,3,2,'#d3c89988');rect(l+s-12,t+s-7-phase*6,2,2,'#b4b08c66');}
  rect(l,y+s/2+3,s,4,'#202c2e');rect(l,y+s/2+3,s*p,4,working?'#e6cb7c':'#a8b08c');
  ctx.font='9px monospace';ctx.fillStyle='#fff1ce';ctx.fillText(builder?(working?Math.ceil(e.construction)+'с':'в пути'):'ждёт',x-12,t-4);return;
 }
 if(e.type==='farm'){
  rect(l,t,s,s,'#69533a');for(let row=0;row<5;row++){rect(l+3,t+4+row*8,s-6,3,'#3d3829');for(let col=0;col<6;col++){rect(l+5+col*6,t+3+row*8,2,5,'#c6b85f');rect(l+4+col*6,t+3+row*8,4,2,'#e0d17d');}}
  rect(l,t+s-3,s,3,'#b59762');rect(l,t,2,s,'#b59762');
 }else if(['tower','outpost'].includes(e.type)){
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
 const occupants=game.workers(e).filter(u=>u.inside===e.id).length;
 if(occupants){
  // Warm activity lights make occupied buildings readable even when workers are hidden.
  for(let i=0;i<occupants;i++)rect(x-7+i*8,y+s/2-7,4,4,'#efd89b');
  const operating=e.buffer<60&&(!e.node||(game.get(e.node)?.amount||0)>0);
  if(operating&&e.type==='farm'){const offset=Math.floor(game.time*1.5+e.id)%5;rect(l+6+offset*7,t+11,2,4,'#f4e1a1');rect(l+8+offset*7,t+10,2,2,'#dce6a0');}
  else if(operating){for(let i=0;i<2;i++){const phase=(game.time*.45+i*.5)%1;rect(x+8+Math.sin(phase*5+e.id)*3,t-4-phase*13,3+phase*2,2,'#c6cbb04d');}if(e.type==='sawmill'){const saw=Math.round(Math.sin(game.time*7)*3);rect(x-10+saw,y+s/2-14,15,2,'#d2d7bf');}}
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
  const region=game.regionAt(x,y);if(region?.owner>=0)rect(px,py,T,T,region.owner===0?'#489cbe0c':'#d477590c');
  if(game.regionGrid[y]?.[x+1]!==region?.id)line(px+T,py,px+T,py+T,'#ddcc8d88');if(game.regionGrid[y+1]?.[x]!==region?.id)line(px,py+T,px+T,py+T,'#ddcc8d88');
  if(!game.terrain[y][x]){rect(px+3+n%15,py+4+n%14,2,3,'#6c8552');if(n<5)rect(px+14,py+15,2,2,'#b3ab70');}
 }
 for(const e of game.visible().sort((a,b)=>a.y-b.y)){
  if(e.x<camera.x-3||e.y<camera.y-3||e.x>camera.x+VW+3||e.y>camera.y+VH+3)continue;
  const x=Math.round(e.x*T),y=Math.round(e.y*T),s=e.size*T;
  if(e.type==='deposit'){drawDeposit(e,x,y);continue;}
  if(stats[e.type]?.speed)drawUnit(e,x,y);else drawBuilding(e,x,y);
  if(selected.includes(e.id)){ctx.strokeStyle='#f8e9a1';ctx.lineWidth=2;ctx.beginPath();if(stats[e.type]?.speed)ctx.ellipse(x,y+7,12+Math.sin(visualTime*4),6,0,0,Math.PI*2);else ctx.rect(x-s/2-3,y-s/2-3,s+6,s+6);ctx.stroke();}
  if(e.type==='outpost'){const r=game.regions[e.region];if(r.progress){rect(x-24,y-35,48,4,'#26372f');rect(x-24,y-35,48*r.progress/12,4,'#e2d295');}}
  if(Number.isFinite(e.maxHp)&&(e.hp<e.maxHp||selected.includes(e.id))){rect(x-s/2,y-s/2-11,s,3,'#222c2a');rect(x-s/2,y-s/2-11,s*e.hp/e.maxHp,3,'#b0d78b');}
 }
 if(drag){const a=drag.start,b=drag.end;ctx.strokeStyle='#fff2a3';ctx.strokeRect(Math.min(a.x,b.x)*T,Math.min(a.y,b.y)*T,Math.abs(a.x-b.x)*T,Math.abs(a.y-b.y)*T);}
 if(placing){const x=Math.round(mouse.x),y=Math.round(mouse.y);rect((x-1)*T,(y-1)*T,48,48,game.canBuild(placing,x,y)?'#b4ff8b99':'#ff685b99');}
 for(const p of pings){const x=p.x*T,y=p.y*T,r=5+p.age*22;ctx.globalAlpha=1-p.age/.6;ctx.strokeStyle=p.kind==='attack'?'#f49f8b':p.kind==='capture'?'#f1db87':'#c7edb1';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,r,r*.55,0,0,Math.PI*2);ctx.stroke();if(p.kind!=='select'){line(x-5,y,x+5,y,ctx.strokeStyle);line(x,y-5,x,y+5,ctx.strokeStyle);}ctx.globalAlpha=1;}
 ctx.restore();
 drawRegionMap(mini,288,192);
 for(const e of game.visible()){if(e.type==='deposit'||e.type==='outpost')continue;mini.fillStyle=e.team===0?'#a5dbee':'#f2a28b';const size=stats[e.type]?.speed?2:e.size*2;mini.fillRect(e.x*2-size/2,e.y*2-size/2,size,size);}
 mini.strokeStyle='#fff2bb';mini.lineWidth=1;mini.strokeRect(camera.x*2,camera.y*2,VW*2,VH*2);
 if(worldOpen)drawRegionMap(worldContext,864,576,true);
}

function frame(now){
 const dt=last===null?0:Math.min((now-last)/1000,.1);last=now;
 if(started&&!inMenu&&!worldOpen&&!helpOpen&&!drag){const dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));camera.x+=dx*18*dt;camera.y+=dy*18*dt;clampCamera();}
 mouse={x:camera.x+cursor.x,y:camera.y+cursor.y};visualTime+=dt;pings=pings.filter(p=>(p.age+=dt)<.6);if(started&&!inMenu&&!paused&&!helpOpen)game.tick(dt*gameSpeed);if(started&&!inMenu)render();uiTimer+=dt;if(uiTimer>.2){updateUI();uiTimer=0;}requestAnimationFrame(frame);
}
function drawRegionMap(context,width,height,full=false){
 const sx=width/W,sy=height/H;context.fillStyle='#2d3e32';context.fillRect(0,0,width,height);
 for(const r of game.regions){const p=r.displayOutline;if(!p.length)continue;context.beginPath();context.moveTo(p[0].x*sx,p[0].y*sy);for(const a of p.slice(1))context.lineTo(a.x*sx,a.y*sy);
  context.closePath();context.fillStyle=r.owner===0?'#365e65':r.owner===1?'#754c43':['#586347','#4c5c43','#606448'][r.id%3];context.fill();
  context.fillStyle=r.owner===0?'#a0dbf1':r.owner===1?'#f1b09a':'#e2d6ad';context.fillRect(r.x*sx-3,r.y*sy-3,6,6);
  if(full){context.font='12px Arial';context.textAlign='center';context.fillText(r.name,r.x*sx,r.y*sy+23);if(game.homeRegions.includes(r.id)){context.font='10px Arial';context.fillText(r.id===game.homeRegions[0]?'Ваш родной край':'Родной край противника',r.x*sx,r.y*sy+37);}if(r.progress){context.fillStyle='#182a22';context.fillRect(r.x*sx-30,r.y*sy+3,60,4);context.fillStyle='#e3d49c';context.fillRect(r.x*sx-30,r.y*sy+3,60*r.progress/12,4);}}
 }
 for(const r of game.regions)for(const run of r.borderRuns){if(run.neighbor<0||run.neighbor<r.id)continue;const p=run.points;context.beginPath();context.moveTo(p[0].x*sx,p[0].y*sy);
  for(let i=1;i<p.length-1;i++){const a=p[i],before=p[i-1],after=p[i+1],r1=Math.min(.25,1/dist(a,before)),r2=Math.min(.25,1/dist(a,after));context.lineTo((a.x+(before.x-a.x)*r1)*sx,(a.y+(before.y-a.y)*r1)*sy);context.quadraticCurveTo(a.x*sx,a.y*sy,(a.x+(after.x-a.x)*r2)*sx,(a.y+(after.y-a.y)*r2)*sy);}
  context.lineTo(p.at(-1).x*sx,p.at(-1).y*sy);const active=full&&(r.id===selectedRegion||run.neighbor===selectedRegion);context.strokeStyle=active?'#fae6aa':'#a0ab7c';context.lineWidth=active?2.5:full?1.3:.6;context.stroke();
 }
 context.strokeStyle='#a0ab7c';context.lineWidth=1;context.strokeRect(0,0,width,height);context.textAlign='start';
}
function updateRegionPanel(){
 const r=game.regions[selectedRegion];if(!r)return;
 $('#region-name').textContent=r.name;const owner=r.owner===0?'Ваши владения':r.owner===1?'Владения противника':'Нейтральная земля';
 $('#region-details').textContent=owner+' · '+r.cells.length+' клеток\n'+(r.owner===0?'Здесь можно строить.':game.canCapture(r.id)?'Соседняя территория: доступна для захвата.':'Сначала захватите соседние с ней земли.')+(r.progress?'\nЗахват: '+Math.floor(r.progress/12*100)+'%':'');
 const actions=$('#region-actions');actions.replaceChildren();
 action(actions,'Отправить выбранных солдат',()=>{game.capture(selected,r.id);},paused||!!game.result||!game.canCapture(r.id)||!selected.some(id=>game.get(id)?.type==='soldier'&&game.get(id)?.team===0));
 action(actions,'Показать территорию',()=>{camera.x=r.x-VW/2;camera.y=r.y-VH/2;clampCamera();toggleWorld(false);});
}
function toggleWorld(show=!worldOpen){if(inMenu||!started)return;worldOpen=show;$('#world').hidden=!worldOpen;drag=null;keys.clear();updateRegionPanel();}
function showMenu(){inMenu=true;toggleHelp(false);commandMode=null;worldOpen=false;keys.clear();drag=null;$('#world').hidden=true;$('#menu').hidden=false;$('#app').hidden=true;$('#resume').hidden=!started;$('#menu-speed').value=String(gameSpeed);$('#start').textContent=started?'Начать новую игру':'Начать игру';}
function resume(){if(!started)return;inMenu=false;$('#menu').hidden=true;$('#app').hidden=false;resizeViewport();last=null;updateUI();}
function startMatch(){const value=($('#seed').value||'').trim(),seed=value===''?undefined:Number(value)>>>0;gameSpeed=Number($('#menu-speed').value)||.6;game=new Game(seed,{ai:$('#ai').checked});commandMode=null;buildUIKey='';orderUIKey='';selected=[];placing=null;paused=false;drag=null;pings=[];selectedRegion=game.homeRegions[0];started=true;resume();home();}
$('#start').onclick=startMatch;$('#resume').onclick=resume;$('#menu-open').onclick=showMenu;
$('#menu-speed').onchange=e=>{gameSpeed=Number(e.target.value);};
$('#world-bottom').onclick=()=>toggleWorld();$('#world-close').onclick=()=>toggleWorld(false);
worldCanvas.addEventListener('pointerdown',e=>{const b=worldCanvas.getBoundingClientRect(),r=game.regionAt((e.clientX-b.left)/b.width*W,(e.clientY-b.top)/b.height*H);if(r){selectedRegion=r.id;updateRegionPanel();}});
function portrait(e){
 const c=$('#portrait').getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#23382f';c.fillRect(0,0,64,64);if(!e)return;
 const color=e.team===0?'#8dc8de':e.team===1?'#df9c89':'#d4c18a';c.fillStyle='#142820';c.fillRect(8,48,48,7);
 if(stats[e.type]?.speed){c.fillStyle='#263538';c.fillRect(23,43,7,12);c.fillRect(35,43,7,12);c.fillStyle=color;c.fillRect(20,28,24,19);c.fillStyle='#dfbf94';c.fillRect(25,15,16,15);c.fillStyle=e.type==='soldier'?'#becac7':'#cba66d';c.fillRect(23,11,20,8);if(e.type==='soldier'){c.fillStyle='#e3e3d2';c.fillRect(49,18,3,33);}}
 else{c.fillStyle='#b1aa86';c.fillRect(12,25,40,29);c.fillStyle=color;c.fillRect(9,20,46,8);c.fillRect(15,13,34,9);c.fillStyle='#273c36';c.fillRect(27,36,10,18);c.fillRect(17,31,6,7);c.fillRect(42,31,6,7);}
}
function selectionCards(units){
 const cards=$('#selection-cards');cards.replaceChildren();cards.hidden=units.length<2;portrait(units[0]);
 for(const e of units){const b=action(cards,'',()=>{selected=[e.id];commandMode=null;});b.className='unit-card';const title=document.createElement('strong');title.textContent=names[e.type]||resourceNames[e.resource];b.append(title);const status=document.createElement('small');status.textContent=e.type==='outpost'?'Контроль территории':Math.ceil(e.hp)+' / '+e.maxHp;b.append(status);
  if(Number.isFinite(e.maxHp)){const bar=document.createElement('span');bar.className='hp-track';const fill=document.createElement('span');fill.style.width=Math.max(0,e.hp/e.maxHp*100)+'%';bar.append(fill);b.append(bar);}
 }
}

home();updateUI();showMenu();requestAnimationFrame(frame);
