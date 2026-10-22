'use strict';
const {Game,stats,W,H,dist,resources,unitCosts,isMilitary}=RTS;
const $=s=>document.querySelector(s),canvas=$('#game'),initialContext=canvas.getContext('2d'),T=24;
let ctx=initialContext;
let VW=42,VH=26,commandMode=null,helpOpen=false,hoveredCommand=null,buildUIKey='',orderUIKey='';
ctx.imageSmoothingEnabled=false;
const minimap=$('#minimap'),mini=minimap.getContext('2d'),camera={x:0,y:H/2-VH/2},keys=new Set(),cursor={x:0,y:0};
const worldCanvas=$('#worldmap'),worldContext=worldCanvas.getContext('2d');
let gameSpeed=.6,inMenu=true,started=false,worldOpen=false,selectedRegion=0,pings=[],visualTime=0;
const names={worker:'Автономный дрон',soldier:'Десантник',assault:'Штурмовик',medic:'Медик',grenadier:'Гранатомётчик',base:'Командное ядро',house:'Станция сборки',warehouse:'Грузовой терминал',sawmill:'Переработчик',quarry:'Экстрактор реголита',farm:'Биореактор',ironmine:'Титановый бур',goldmine:'Кристальный резонатор',barracks:'Десантный комплекс',tower:'Рельсовая турель',outpost:'Ретранслятор'};
const resourceNames={wood:'Композит',stone:'Реголит',food:'Биогель',iron:'Титан',gold:'Ксенокристаллы'},colors={wood:'#58d5d1',stone:'#a2a7cb',food:'#a3ed86',iron:'#76b8fb',gold:'#e78bff'};
const roles={soldier:'Бронепехота · винтовка · дальность 5',assault:'Тяжёлая броня · космо-меч · ближний бой',medic:'Поддержка · лечение 16 HP/с в радиусе 5 · не атакует',grenadier:'Осадный боец · 90 урона зданиям / 2 с · дальность 6,5'};
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
 if(stats[type]){drawAssetIcon(c,type,32);return;}
 if(type==='assign'){drawAssetIcon(c,'worker',32);r(24,3,3,11,'#b8ffce');r(20,7,11,3,'#b8ffce');return;}
 if(type==='move'){r(4,14,22,4,'#7be7f4');r(20,8,4,16,'#7be7f4');r(25,12,4,8,'#c5fbff');return;}
 if(type==='attack'){r(5,5,7,2,'#ff8cba');r(5,5,2,7,'#ff8cba');r(21,5,7,2,'#ff8cba');r(26,5,2,7,'#ff8cba');r(5,26,7,2,'#ff8cba');r(5,21,2,7,'#ff8cba');r(21,26,7,2,'#ff8cba');r(26,21,2,7,'#ff8cba');r(13,13,7,7,'#ffb5d2');return;}
 if(type==='stop'){r(6,6,21,21,'#abc1e2');r(9,9,15,15,'#263854');r(14,12,5,9,'#dfedff');return;}
 if(type==='map'){r(3,4,26,24,'#1c354e');for(let i=7;i<29;i+=7){r(i,5,1,22,'#406881');r(4,i,24,1,'#406881');}r(8,17,4,4,'#6fedff');r(22,8,4,4,'#ff83b6');return;}
}
function drawAssetIcon(context,type,size,team=0){
 const saved=ctx;ctx=context;ctx.save();ctx.scale(size/64,size/64);
 const e={type,team,size:stats[type].size,construction:0,walkDistance:0,facingX:1,moving:false,buffer:0,id:-1};
 if(stats[type].speed){ctx.translate(32,40);ctx.scale(1.6,1.6);drawUnit(e,0,0);}else{ctx.translate(32,34);ctx.scale(.8,.8);drawBuilding(e,0,0);}
 ctx.restore();ctx=saved;
}
function canCommandSelection(){return selected.some(id=>{const u=game.get(id);return u&&stats[u.type]?.speed&&!u.training&&!u.inside;});}
function setCommandMode(mode){if(paused||inMenu||game.result||helpOpen||!canCommandSelection())return;commandMode=mode;placing=null;hoveredCommand=null;updateUI();}
function stopSelected(){if(paused||inMenu||game.result)return;for(const id of selected){const u=game.get(id);if(u&&stats[u.type]?.speed&&!u.inside)game.release(u);}commandMode=null;placing=null;game.message='Приказ прекращён. Свободные дроны вернутся к перевозке.';updateUI();}
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
 $('#population').textContent=`Ядра: ${p.total}/${p.capacity}`;
 $('#population').title=`Дроны: ${p.workers} · Бойцы: ${p.soldiers} · Перевозчики: ${carriers}. За 5 с: ${p.total} биогеля, ${p.soldiers*.5} ксенокристаллов.`;
 $('#economy-info').textContent=`Дроны ${p.workers} · Бойцы ${p.soldiers} · Перевозчики ${carriers}`;
 $('#clock').textContent=clock(game.time);
 const message=commandMode?(commandMode==='move'?'Идти: укажите место левой кнопкой. Esc — отмена.':'Атака: укажите противника левой кнопкой. Esc — отмена.'):placing?`Строительство: ${names[placing]}. ЛКМ по зелёному месту; Esc — отмена.`:game.teams[0].hungry?'Не хватает биогеля! Назначьте дронов на биореактор и оставьте перевозчиков.':game.teams[0].unpaid?'Не хватает ксенокристаллов! Боевые модули теряют здоровье.':game.message;
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
  if(stats[e.type]?.resource){details+=`\nДроны: ${game.workers(e).length}/2 · продукция: ${Math.floor(e.buffer)}/60`;if(e.node)details+=`\nОстаток залежи: ${Math.floor(game.get(e.node)?.amount||0)}`;}
  if(e.type==='worker')details+=`\n${e.training?'Переоборудование в комплексе':e.building?'Строитель':e.job?'Работает: '+names[game.get(e.job)?.type]:'Перевозчик'}${e.carry?' · несёт '+e.carry.amount+' '+resourceNames[e.carry.resource]:''}`;
  if(isMilitary(e))details+='\n'+roles[e.type]+(stats[e.type].armor?' · броня '+stats[e.type].armor:'')+'\nСодержание: 1 биогель и 0,5 ксенокристалла / 5 с';
  if(e.type==='house')details+='\n+4 ядра · дрон каждые 20 с за 8 биогеля';
  if(e.type==='deposit')details=`${resourceNames[e.resource]}: ${Math.floor(e.amount)}`;
  if(e.type==='outpost'){const r=game.regions[e.region];details=r.name+'\n'+(r.owner===0?'Ваша территория':r.owner===1?'Вражеская территория':'Нейтральная территория')+'\nЗахват: '+Math.floor(r.progress/12*100)+'% · 12 с у ретранслятора';}
  if(e.construction>0){const builder=game.get(e.builder);details+=`\nГотовность: ${Math.round((1-e.construction/stats[e.type].buildTime)*100)}% · ${Math.ceil(e.construction)} с работы\n${builder?(game.adjacent(builder,e)?'Дрон строит':'Строитель в пути'):'Ожидает свободного дрона'}`;}
  if(e.type==='barracks')details+=`\nОчередь: ${e.queue.length}/3${e.queue.length?' · '+names[e.queue[0].type||'soldier']+' · '+Math.ceil(e.queue[0].left)+' с после прибытия':''}`;
 }else if(units.length>1){const workers=units.filter(u=>u.type==='worker').length,soldiers=units.filter(u=>isMilitary(u)).length;details=`Дроны: ${workers} · Бойцы: ${soldiers}\nКлик по карточке — выбрать одного. Shift — добавить к выбору.`;}
 selectionCards(units);$('#details').textContent=details;const health=$('#portrait-health');health.hidden=units.length!==1||!Number.isFinite(e?.maxHp);if(!health.hidden){$('#health-fill').style.width=Math.max(0,e.hp/e.maxHp*100)+'%';health.ariaValueNow=String(Math.ceil(e.hp));health.ariaValueMin='0';health.ariaValueMax=String(e.maxHp);}
 const orderKey=JSON.stringify([selected,paused,!!game.result,commandMode,game.ready(e),Object.values(unitCosts).map(c=>game.affordable(c)),e?.queue.map(q=>q.type),units.map(u=>[u.training,u.building]),e?game.workers(e).length:0]);
 if(orderKey!==orderUIKey){orderUIKey=orderKey;const actions=$('#actions');actions.replaceChildren();const canAct=units.some(u=>stats[u.type]?.speed&&!u.training),blocked=paused||!!game.result;
  if(canAct){commandButton(actions,'Идти','move',()=>setCommandMode('move'),blocked,'Идти · G. Укажите место левой кнопкой.');commandButton(actions,'Атака','attack',()=>setCommandMode('attack'),blocked,'Атаковать · F. Укажите противника левой кнопкой.');commandButton(actions,'Стоп','stop',stopSelected,blocked,'Прекратить приказ · X. Дроны вернутся к перевозке.');}
  if(e?.type==='barracks')for(const type of Object.keys(unitCosts))commandButton(actions,names[type],type,()=>{if(!game.train(e.id,0,type))game.message='Нужен дрон без груза, ресурсы и место в очереди (до 3).';},blocked||!game.ready(e)||e.queue.length>=3||!game.affordable(unitCosts[type]),names[type]+' — '+costText(unitCosts[type])+' · '+stats[type].trainTime+' с · '+roles[type]);
  if(e?.type==='outpost')commandButton(actions,'Секторы','map',()=>{selectedRegion=e.region;toggleWorld(true);},false,'Открыть ретранслятор на глобальной карте.');
  if(units.some(u=>u.type==='worker'))commandButton(actions,'Перевозка','worker',()=>{for(const u of units)if(u.type==='worker')game.release(u);},blocked,'Освободить дронов → перевозчики');
  if(units.some(u=>isMilitary(u)))commandButton(actions,'В дроны','worker',()=>game.demobilize(selected),blocked,'Вернуть бойцов в дроны без возврата цены.');
  if(e&&stats[e.type]?.slots)commandButton(actions,'Назначить','assign',()=>{const u=game.alive().find(u=>u.team===0&&u.type==='worker'&&!u.job&&!u.training&&!u.building&&!u.carry);if(!u||!game.assign([u.id],e.id))game.message='Нет свободного дрона или все места заняты.';},blocked||!game.ready(e),'Назначить свободного дрона');
  if(e&&stats[e.type]?.slots&&game.workers(e).length)commandButton(actions,'Снять дронов','worker',()=>{for(const u of game.workers(e))game.release(u);},blocked,'Освободить дронов из здания');
  while(actions.children.length<9){const slot=document.createElement('span');slot.className='empty-slot';actions.append(slot);}
 }
 $('#command-hint').textContent=hoveredCommand||(canCommandSelection()?'G — идти · F — атака · X — стоп':'Постройки — в ряду слева. Наведите на иконку, чтобы узнать цену.');
 const owned=game.regions.filter(r=>r.owner===0).length,enemy=game.regions.filter(r=>r.owner===1).length;
 $('#territory-score').textContent=`Секторы: ${owned} / 12 · Враг: ${enemy}`;$('#territory-label').textContent=game.regionAt(camera.x+VW/2,camera.y+VH/2)?.name||'Рубежи';if(worldOpen)updateRegionPanel();
 $('#overlay').hidden=!paused&&!game.result;$('#endtitle').textContent=game.result==='victory'?'Победа! Командное ядро роя уничтожено':game.result==='defeat'?'Поражение: командное ядро уничтожено':'Пауза';$('#pause').className='speed-button'+(paused?' active':'');$('#pause').ariaPressed=String(paused);$('#pause').title=paused?'Продолжить · пробел':'Пауза · пробел';for(const [id,speed]of [['speed-slow',.4],['speed-normal',.6],['speed-fast',1]]){$('#'+id).className='speed-button'+(!paused&&gameSpeed===speed?' active':'');$('#'+id).ariaPressed=String(!paused&&gameSpeed===speed);}
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
 rect(x-12,y+7,25,5,'#070a1988');if(e.amount<=0){rect(x-7,y+3,14,3,'#404458');return;}
 const color=colors[e.resource];
 if(e.resource==='wood'){
  rect(x-11,y-5,20,13,'#303d51');rect(x-8,y-9,13,5,'#657a8b');rect(x-10,y-4,17,2,color);rect(x-6,y-2,5,8,'#526477');rect(x+1,y,10,7,'#242d42');
  line(x-7,y+7,x+2,y-8,'#a0b9c5',2);rect(x+4,y+1,5,2,color);rect(x-12,y+3,3,3,'#d7a667');
 }else if(e.resource==='gold'){
  for(const [dx,dy,h]of [[-9,2,14],[0,0,24],[8,5,17]]){rect(x+dx-3,y+dy-h+4,7,h-4,'#6e388c');rect(x+dx-1,y+dy-h,3,h,'#e78bff');rect(x+dx-2,y+dy-h+3,2,h-5,'#ffe1ff');}
  rect(x-12,y+8,25,2,'#753a8f');rect(x+13,y-12,2,2,'#efabff');
 }else{
  rect(x-12,y-1,24,10,'#30364c');rect(x-8,y-8,18,12,'#555d79');rect(x-3,y-13,9,6,'#79849f');
  for(let i=0;i<3;i++){rect(x-8+i*6,y-3-i*3,4,3,color);rect(x-7+i*6,y-3-i*3,2,1,'#e5e9ff');}line(x-11,y+7,x+10,y+7,'#7a839c');
 }
}
function drawUnit(e,x,y){
 const ally=e.team===0,c=ally?'#56cfec':'#e85d9c',dark=ally?'#254d70':'#653351',light=ally?'#c1f8ff':'#ffb4d2',phase=e.walkDistance*7,step=e.moving?Math.sin(phase)*3:0,bob=e.moving?Math.round(Math.abs(Math.sin(phase))):0,face=e.facingX<-.15?-1:1;
 rect(x-9,y+8,19,4,'#05091688');
 if(e.type==='worker'){
  // Six-legged autonomous salvage drone; corrupted enemies have an insect silhouette.
  for(const side of [-1,1])for(let i=0;i<3;i++){const sy=y-5+i*5;line(x+side*4,sy,x+side*(10+Math.sin(phase+i)*Number(e.moving)*2),sy+4,dark,2);rect(x+side*11-1,sy+3,3,2,light);}
  rect(x-6,y-9-bob,13,15,dark);rect(x-4,y-11-bob,9,4,c);rect(x-4,y-5-bob,9,7,'#8c9db3');rect(x-2,y-4-bob,5,3,ally?'#8cffe3':'#ff7c74');rect(x-5,y+2-bob,11,2,c);
  line(x,y-11-bob,x+3,y-16-bob,'#718ba5');rect(x+2,y-17-bob,3,2,light);
  const b=game.get(e.building);if(b&&game.adjacent(e,b)){const swing=Math.sin(game.time*12);line(x+7*face,y,x+14*face,y-7+swing*3,c,2);rect(x+14*face-2,y-10+swing*3,5,3,'#fff3a3');if(swing>.6)line(x+15*face,y-8,x+19*face,y-14,'#81ffff');}
 }else{
  const heavy=e.type==='assault',w=heavy?8:6;
  for(const side of [-1,1]){rect(x+side*4-2,y+1+Math.max(0,side*step),5,7,'#1c233b');rect(x+side*4-2,y+2+Math.max(0,side*step),4,3,'#7f8aab');rect(x+side*(w+1)-2,y-9-bob,5,7,c);rect(x+side*(w+1)-2,y-9-bob,5,2,light);}
  rect(x-w,y-9-bob,w*2+1,13,dark);rect(x-w+2,y-8-bob,w*2-3,5,c);rect(x-2,y-3-bob,5,5,'#8a9eb1');rect(x-3,y-7-bob,7,2,light);
  rect(x-5,y-18-bob,11,10,'#54647d');rect(x-4,y-19-bob,9,3,'#a5b3c8');rect(x-4,y-14-bob,9,3,ally?'#6efaff':'#ff705d');rect(x-3,y-14-bob,5,1,'#e0ffff');
  rect(x-6*face-2,y-5-bob,3,8,'#283047');rect(x-6*face-1,y+1-bob,2,3,'#ba79ff');
  if(!ally){line(x-5,y-17-bob,x-9,y-22-bob,'#f4b6c4',2);line(x+5,y-17-bob,x+9,y-22-bob,'#f4b6c4',2);}
  if(e.type==='medic'){rect(x-2,y-8-bob,3,8,'#b7ffca');rect(x-4,y-6-bob,7,3,'#b7ffca');rect(x+9*face-2,y-6-bob,5,8,'#dde8f0');rect(x+9*face-1,y-5-bob,3,3,'#7effbd');}
  else if(e.type==='assault'){const swing=e.cool>.7?5:0;line(x+10*face,y+1-bob,x+(14+swing)*face,y-21-bob,'#71fff0',4);line(x+10*face,y+1-bob,x+(14+swing)*face,y-21-bob,'#e1ffff',1);rect(x+7*face-2,y-1-bob,7,3,'#9b80c9');}
  else{const gun=e.type==='grenadier';ctx.save();ctx.translate(x,y-bob);ctx.scale(face,1);rect(1,-6,gun?15:14,gun?7:4,'#172038');rect(5,-7,gun?10:7,2,'#9eafc7');rect(13,-5,4,2,gun?'#ffbd79':'#86edff');ctx.restore();if(gun){for(let i=0;i<3;i++)rect(x-6+i*4,y+3-bob,2,3,'#ffad6e');}}
 }
 if(e.carry){rect(x-14,y-1-bob,7,9,'#273750');rect(x-13,y-bob,5,5,colors[e.carry.resource]);rect(x-13,y+6-bob,5,1,'#d0e0ea');}
 if(e.moving&&Math.sin(phase)>.85)rect(x-3*face,y+11,3,1,'#9d91ca66');
}
function drawBuilding(e,x,y){
 const s=e.size*T,l=x-s/2,t=y-s/2,ally=e.team===0,c=ally?'#4ad3f2':e.team===1?'#fa689c':'#b39be4',dark=ally?'#28415d':'#5c304b';
 rect(l-3,t+s-3,s+7,8,'#05081788');
 if(e.construction>0){
  const p=1-e.construction/stats[e.type].buildTime,b=game.get(e.builder),working=b&&game.adjacent(b,e),h=Math.round((s-10)*p);
  rect(l,t+s-8,s,8,'#323b54');rect(l+4,t+s-8-h,s-8,h,'#56647a');
  for(const dx of [1,s-3]){rect(l+dx,t,2,s,c);for(let i=4;i<s;i+=10)rect(l+dx-2,t+i,6,2,'#8492b3');}
  line(l,t+s-3,l+s,t+3,'#455b78',2);const scan=(game.time*10)%s;rect(l,t+scan,s,1,c);
  if(working){rect(l+s-9,t+s-10-Math.sin(game.time*12)*3,3,3,'#eaffff');line(l+s-8,t+s-9,l+s-3,t+s-17,c);}
  rect(l,t+s+3,s,4,'#10182a');rect(l,t+s+3,s*p,4,working?c:'#827a9d');ctx.font='9px monospace';ctx.fillStyle='#d5edff';ctx.fillText(b?(working?Math.ceil(e.construction)+'с':'в пути'):'ждёт',x-12,t-4);return;
 }
 // Armored industrial foundation, beveled plating, conduits and perimeter lights.
 rect(l,t+s-9,s,10,'#20293f');rect(l+3,t+10,s-6,s-13,'#39465d');rect(l+5,t+11,s-10,s-18,'#65738a');rect(l+5,t+11,s-10,3,'#a0afc1');
 for(const dx of [2,s-5]){rect(l+dx,t+14,3,s-17,dark);rect(l+dx,t+s-5,3,2,c);}
 for(let i=0;i<3;i++){rect(l+7+i*7,t+s-6,4,2,'#d9b37a');rect(l+8+i*7,t+s-6,2,2,'#323a4c');}
 if(e.type==='farm'){
  for(let i=0;i<3;i++){rect(l+6+i*13,t+4,10,s-17,'#192a3a');rect(l+8+i*13,t+7,6,s-23,'#55aa85');rect(l+8+i*13,t+9,2,s-28,'#a1ffbe');rect(l+7+i*13,t+3,8,4,'#b0c4d2');}
  rect(l+5,t+s-14,s-10,3,'#8ce5c0');
 }else if(['tower','outpost'].includes(e.type)){
  rect(x-9,t+4,18,s-10,'#74839b');rect(x-6,t+6,12,s-17,dark);rect(x-3,t+8,6,s-22,c);
  if(e.type==='tower'){rect(x-16,t-3,32,14,'#8290aa');rect(x-13,t,26,5,dark);rect(x-3,t-14,6,16,'#293a52');rect(x-2,t-15,4,4,c);rect(x-13,t+2,5,2,c);}else{line(x-13,t-6,x+13,t-6,c,3);rect(x-2,t-17,4,19,'#bdc8dc');rect(x-6,t-20,12,5,c);line(x-13,t-6,x-4,t-15,c,2);line(x+13,t-6,x+4,t-15,c,2);}
 }else if(['quarry','ironmine','goldmine'].includes(e.type)){
  rect(l+8,t+5,s-16,s-15,'#20283e');rect(l+12,t+8,s-24,s-22,'#0f1629');for(let i=0;i<3;i++)rect(l+13+i*7,t+8,3,s-22,'#475974');
  rect(x-3,t-5,6,s-9,'#a2aec3');rect(x-7,t+7,14,5,'#c1cddd');rect(x-4,t+s-15,8,5,colors[stats[e.type].resource]);
  if(e.type==='goldmine'){rect(x-2,t-12,4,10,colors.gold);rect(x-5,t-8,10,3,'#f0b3ff');}
 }else{
  rect(l+1,t+5,s-2,10,dark);rect(l+6,t,s-12,8,'#8895ad');rect(l+9,t+1,s-18,2,c);
  for(const dx of [8,s-16]){rect(l+dx,t+21,8,8,'#17233b');rect(l+dx+1,t+22,6,2,c);}
  rect(x-7,t+s-19,14,17,'#172239');rect(x-5,t+s-17,10,12,dark);rect(x-4,t+s-16,8,2,c);
  for(let i=0;i<3;i++)rect(l+7+i*4,t+17,2,2,'#b1bed2');
  if(e.type==='base'){rect(x-13,t-4,26,14,'#334963');rect(x-10,t-7,20,9,'#8c9fb5');rect(x-7,t-6,14,4,c);line(x+19,t+7,x+19,t-17,'#b7c4dc',2);rect(x+16,t-19,6,4,c);rect(x-19,t+15,4,13,c);}
  if(e.type==='house'){rect(l+7,t-7,s-14,8,'#344059');for(let i=0;i<4;i++)rect(l+10+i*7,t-5,4,3,'#96dbff');}
  if(e.type==='warehouse'||e.type==='sawmill'){for(let i=0;i<2;i++){rect(l+5+i*25,t+s-13,13,10,'#384f66');rect(l+6+i*25,t+s-12,11,2,colors.wood);rect(l+9+i*25,t+s-9,3,5,'#95a9c0');}if(e.type==='sawmill'){rect(x-7,t-7,14,9,'#28354b');rect(x-5,t-5,10,3,'#83e3e7');}}
  if(e.type==='barracks'){rect(x-11,t-6,22,14,'#344563');rect(x-8,t-3,16,3,c);line(x-6,t+5,x+6,t+17,'#ffba83',2);line(x+6,t+5,x-6,t+17,'#ffba83',2);}
 }
 if(e.team===1){line(l+5,t+10,l-2,t-3,'#d393b4',3);line(l+s-5,t+10,l+s+2,t-3,'#d393b4',3);rect(l+8,t+s-3,s-16,2,'#c94886');}
 const occupants=game.workers(e).filter(u=>u.inside===e.id).length;
 for(let i=0;i<occupants;i++)rect(l+7+i*7,t+s-11,4,3,'#99ffcf');
 if(occupants&&e.buffer<60&&(!e.node||(game.get(e.node)?.amount||0)>0)){
  const phase=(game.time*.65)%1;rect(x+8,t-4-phase*12,3,2,'#a5c5ef66');rect(l+s-8,t+17+Math.floor(game.time*3)%3*3,2,2,'#b7ffde');
  if(e.type==='farm')rect(l+8+Math.floor(game.time*2)%3*13,t+13,5,2,'#dbffcf');
  if(['quarry','ironmine','sawmill'].includes(e.type))rect(x-5+Math.sin(game.time*8)*3,t+10,8,2,'#d8f1ff');
 }
 if(stats[e.type].resource){rect(l,t+s+3,s,3,'#141d32');rect(l,t+s+3,s*e.buffer/60,3,colors[stats[e.type].resource]);ctx.font='9px monospace';ctx.fillStyle='#c8e6f5';ctx.fillText(`${game.workers(e).length}/2`,x-8,t+s+14);}
}
function render(){
 ctx.save();ctx.translate(-camera.x*T,-camera.y*T);
 for(let y=Math.floor(camera.y);y<Math.min(H,Math.ceil(camera.y+VH));y++)for(let x=Math.floor(camera.x);x<Math.min(W,Math.ceil(camera.x+VW));x++){
  const px=x*T,py=y*T,n=(x*31+y*17+x*y)%29;
  rect(px,py,T,T,game.terrain[y][x]?'#101529':n%3?'#25263d':'#282940');
  const region=game.regionAt(x,y);if(region?.owner>=0)rect(px,py,T,T,region.owner===0?'#489cbe0c':'#d477590c');
  if(game.regionGrid[y]?.[x+1]!==region?.id)line(px+T,py,px+T,py+T,'#807cba66');if(game.regionGrid[y+1]?.[x]!==region?.id)line(px,py+T,px+T,py+T,'#807cba66');
  if(!game.terrain[y][x]){rect(px+3+n%15,py+4+n%14,2,3,'#45425d');if(n<5)rect(px+14,py+15,2,2,'#69617e');if(n===1){line(px+3,py+18,px+12,py+13,'#191c31',2);line(px+12,py+13,px+18,py+15,'#191c31');}if(n===4){rect(px+11,py+14,4,2,'#604e7e');rect(px+12,py+13,2,1,'#b58bd255');}}
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
 for(const f of game.effects){const x=f.x*T,y=f.y*T,tx=f.tx*T,ty=f.ty*T;
  if(f.kind==='heal'){line(x,y-5,tx,ty-6,'#79ffbe99',2);rect(tx-1,ty-14,3,9,'#abffcb');rect(tx-4,ty-11,9,3,'#abffcb');}
  else if(f.kind==='slash'){line(tx-9,ty+5,tx+10,ty-15,'#bafffa',3);}
  else if(f.kind==='grenade'){line(x,y-7,tx,ty,'#faba7977',2);ctx.strokeStyle='#ffbc79';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(tx,ty,6+(1-f.left/.3)*14,4+(1-f.left/.3)*9,0,0,Math.PI*2);ctx.stroke();}
  else{line(x,y-5,tx,ty-4,'#b4f5ffbb');rect(x-2,y-8,5,5,'#fff2c3');rect(tx-2,ty-6,4,4,'#f9b6cd');}
 }
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
 const sx=width/W,sy=height/H;context.fillStyle='#101629';context.fillRect(0,0,width,height);
 for(const r of game.regions){const p=r.displayOutline;if(!p.length)continue;context.beginPath();context.moveTo(p[0].x*sx,p[0].y*sy);for(const a of p.slice(1))context.lineTo(a.x*sx,a.y*sy);
  context.closePath();context.fillStyle=r.owner===0?'#20465e':r.owner===1?'#613047':['#303147','#34344d','#39334e'][r.id%3];context.fill();
  context.fillStyle=r.owner===0?'#a0dbf1':r.owner===1?'#f1b09a':'#e2d6ad';context.fillRect(r.x*sx-3,r.y*sy-3,6,6);
  if(full){context.font='12px Arial';context.textAlign='center';context.fillText(r.name,r.x*sx,r.y*sy+23);if(game.homeRegions.includes(r.id)){context.font='10px Arial';context.fillText(r.id===game.homeRegions[0]?'Ваш плацдарм':'Плацдарм роя',r.x*sx,r.y*sy+37);}if(r.progress){context.fillStyle='#182a22';context.fillRect(r.x*sx-30,r.y*sy+3,60,4);context.fillStyle='#e3d49c';context.fillRect(r.x*sx-30,r.y*sy+3,60*r.progress/12,4);}}
 }
 for(const r of game.regions)for(const run of r.borderRuns){if(run.neighbor<0||run.neighbor<r.id)continue;const p=run.points;context.beginPath();context.moveTo(p[0].x*sx,p[0].y*sy);
  for(let i=1;i<p.length-1;i++){const a=p[i],before=p[i-1],after=p[i+1],r1=Math.min(.25,1/dist(a,before)),r2=Math.min(.25,1/dist(a,after));context.lineTo((a.x+(before.x-a.x)*r1)*sx,(a.y+(before.y-a.y)*r1)*sy);context.quadraticCurveTo(a.x*sx,a.y*sy,(a.x+(after.x-a.x)*r2)*sx,(a.y+(after.y-a.y)*r2)*sy);}
  context.lineTo(p.at(-1).x*sx,p.at(-1).y*sy);const active=full&&(r.id===selectedRegion||run.neighbor===selectedRegion);context.strokeStyle=active?'#fae6aa':'#7775a1';context.lineWidth=active?2.5:full?1.3:.6;context.stroke();
 }
 context.strokeStyle='#7775a1';context.lineWidth=1;context.strokeRect(0,0,width,height);context.textAlign='start';
}
function updateRegionPanel(){
 const r=game.regions[selectedRegion];if(!r)return;
 $('#region-name').textContent=r.name;const owner=r.owner===0?'Ваши секторы':r.owner===1?'Секторы противника':'Нейтральный сектор';
 $('#region-details').textContent=owner+' · '+r.cells.length+' клеток\n'+(r.owner===0?'Здесь можно строить.':game.canCapture(r.id)?'Соседняя территория: доступна для захвата.':'Сначала захватите соседние с ней земли.')+(r.progress?'\nЗахват: '+Math.floor(r.progress/12*100)+'%':'');
 const actions=$('#region-actions');actions.replaceChildren();
 action(actions,'Отправить выбранных бойцов',()=>{game.capture(selected,r.id);},paused||!!game.result||!game.canCapture(r.id)||!selected.some(id=>isMilitary(game.get(id))&&game.get(id)?.team===0));
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
function portrait(e){const c=$('#portrait').getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#10182c';c.fillRect(0,0,64,64);for(let y=0;y<64;y+=8){c.fillStyle='#283650';c.fillRect(0,y,64,1);}if(e&&stats[e.type])drawAssetIcon(c,e.type,64,e.team);else if(e?.type==='deposit'){const saved=ctx;ctx=c;c.save();c.translate(32,40);c.scale(1.6,1.6);drawDeposit(e,0,0);c.restore();ctx=saved;}}
function selectionCards(units){
 const cards=$('#selection-cards');cards.replaceChildren();cards.hidden=units.length<2;portrait(units[0]);
 for(const e of units){const b=action(cards,'',()=>{selected=[e.id];commandMode=null;});b.className='unit-card';const title=document.createElement('strong');title.textContent=names[e.type]||resourceNames[e.resource];b.append(title);const status=document.createElement('small');status.textContent=e.type==='outpost'?'Контроль территории':Math.ceil(e.hp)+' / '+e.maxHp;b.append(status);
  if(Number.isFinite(e.maxHp)){const bar=document.createElement('span');bar.className='hp-track';const fill=document.createElement('span');fill.style.width=Math.max(0,e.hp/e.maxHp*100)+'%';bar.append(fill);b.append(bar);}
 }
}

home();updateUI();showMenu();requestAnimationFrame(frame);
