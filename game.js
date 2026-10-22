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
function drawResourceIcon(canvas,resource){const saved=ctx;ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.save();ctx.translate(16,21);ctx.scale(.7,.7);drawDeposit({resource,amount:1,id:0},0,0);ctx.restore();ctx=saved;}
function drawAssetIcon(context,type,size,team=0){
 const saved=ctx;ctx=context;ctx.save();ctx.scale(size/64,size/64);
 const e={type,team,size:stats[type].size,construction:0,walkDistance:0,facingX:1,moving:false,buffer:0,id:-1};
 if(stats[type].speed){ctx.translate(32,40);ctx.scale(1.6,1.6);drawUnit(e,0,0);}else{ctx.translate(32,34);ctx.scale(type==='base'?.65:.8,type==='base'?.65:.8);drawBuilding(e,0,0);}
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
 for(const r of resources){const item=document.createElement('span');item.className='resource';item.style.color=colors[r];const icon=document.createElement('canvas');icon.width=32;icon.height=32;icon.className='resource-icon';drawResourceIcon(icon,r);const data=document.createElement('span'),label=document.createElement('span'),value=document.createElement('strong');label.className='resource-label';label.textContent=resourceNames[r];value.className='resource-value';value.textContent=Math.floor(stock[r]);data.append(label);data.append(value);item.append(icon);item.append(data);resourceBar.append(item);}
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
function hit(p){return game.visible().filter(e=>stats[e.type]?.speed?Math.abs(e.x-p.x)<.7&&p.y>=e.y-1.2&&p.y<=e.y+.6:Math.abs(e.x-p.x)<e.size/2+.15&&Math.abs(e.y-p.y)<e.size/2+.15).sort((a,b)=>a.size-b.size)[0];}
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
function shape(points,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill();}
function octagon(x,y,w,h,color){const a=Math.min(7,w/4,h/4);shape([[x+a,y],[x+w-a,y],[x+w,y+a],[x+w,y+h-a],[x+w-a,y+h],[x+a,y+h],[x,y+h-a],[x,y+a]],color);}
function crystal(x,y,h,c){shape([[x,y-h],[x+5,y-h+7],[x+4,y],[x,y+3],[x-5,y],[x-4,y-h+7]],'#513061');shape([[x,y-h],[x+3,y-h+7],[x+2,y],[x,y+2]],c);line(x,y-h+4,x,y-2,'#ffe1ff');}
function drawDeposit(e,x,y){
 rect(x-13,y+6,27,5,'#05091677');if(e.amount<=0){rect(x-9,y+3,18,3,'#4e4e62');return;}
 if(e.resource==='wood'){
  shape([[x-13,y+4],[x-11,y-7],[x-1,y-12],[x+10,y-7],[x+13,y+7]],'#202e42');
  line(x-12,y+5,x+3,y-9,'#7a9daa',4);line(x-7,y-9,x+8,y+6,'#92bbc0',3);
  rect(x-6,y-5,10,8,'#334f60');rect(x-4,y-4,6,2,'#54e4e5');rect(x+7,y-2,5,6,'#797f91');rect(x-12,y+3,6,3,'#d9a95f');
  line(x+3,y-9,x+8,y-15,'#aeb8c9',2);rect(x+6,y-17,7,3,'#47526d');
 }else if(e.resource==='food'){octagon(x-8,y-17,16,25,'#689c97');rect(x-6,y-13,12,15,'#75db9f');rect(x-4,y-12,3,12,'#daffe0');rect(x-7,y-19,14,5,'#c4ddda');rect(x-7,y+3,14,4,'#4a7c83');}else if(e.resource==='gold'){
  octagon(x-14,y,28,10,'#403050');rect(x-10,y+7,20,2,'#a35aba');crystal(x-8,y+4,18,'#ce76f8');crystal(x+6,y+4,22,'#ba67ed');crystal(x,y,30,'#f1a6ff');
  if(Math.sin(game.time*2+e.id)>.7){rect(x+13,y-19,2,2,'#facaff');rect(x-12,y-27,2,2,'#d7b9ff');}
 }else if(e.resource==='iron'){
  octagon(x-13,y-3,26,13,'#343a51');shape([[x-9,y],[x-7,y-13],[x+1,y-20],[x+9,y-11],[x+10,y+3]],'#69869b');
  shape([[x+1,y-20],[x+4,y-9],[x+1,y+1],[x-3,y-3]],'#b8d8e9');line(x-5,y-9,x+3,y-6,'#57bcf7',2);line(x+5,y-12,x+8,y-5,'#cfebff',2);rect(x-11,y+4,8,3,'#7296ae');
 }else{
  octagon(x-14,y-3,28,13,'#6d6b80');octagon(x-8,y-12,18,18,'#9791a6');rect(x-5,y-12,9,3,'#c4bbce');rect(x-10,y+2,6,3,'#b1a4b9');rect(x+7,y+3,7,5,'#545268');line(x-3,y-7,x+5,y-4,'#6b647a',2);
 }
}
function drawUnit(e,x,y){
 const phase=e.walkDistance*7,step=e.moving?Math.sin(phase)*3:0,bob=e.moving?Math.round(Math.abs(Math.sin(phase))):0,face=e.facingX<-.15?-1:1,swarm=e.team===1;
 rect(x-10,y+7,21,5,'#05081599');
 if(e.type==='worker'){
  const hover=Math.round(Math.sin(game.time*3+e.id)*1.5);y-=hover+3;
  if(swarm){
   for(const side of [-1,1])for(let i=0;i<3;i++){const sy=y-6+i*5,j=Math.sin(phase+i)*Number(e.moving)*3;line(x+side*4,sy,x+side*(11+j),sy+3,'#b56c93',2);line(x+side*(11+j),sy+3,x+side*13,sy+7,'#542d50',2);}
   octagon(x-7,y-12,15,21,'#62344f');octagon(x-5,y-11,11,14,'#b5598a');line(x,y-10,x,y+5,'#351c39',2);rect(x-4,y-7,3,3,'#ff9a75');rect(x+2,y-7,3,3,'#ff9a75');line(x-4,y-11,x-8,y-17,'#e4a0a6',2);line(x+4,y-11,x+8,y-17,'#e4a0a6',2);
  }else{
   // No legs: a floating robotic core with two independent antigravity nacelles.
   rect(x-13,y-6,7,10,'#293e59');rect(x+7,y-6,7,10,'#293e59');rect(x-12,y-6,5,3,'#b5d8e0');rect(x+8,y-6,5,3,'#b5d8e0');
   for(const dx of [-11,10]){rect(x+dx,y+4,3,3,'#70f5ff');rect(x+dx,y+7,3,e.moving?7:4,'#5499f277');}
   octagon(x-7,y-12,15,17,'#c1d4df');octagon(x-5,y-9,11,11,'#345572');rect(x-4,y-7,9,4,'#57eaf9');rect(x-2,y-7,5,2,'#e6ffff');rect(x-3,y+3,7,3,'#678b9e');
   line(x-4,y+4,x-9,y+10,'#9db1c5',2);line(x+4,y+4,x+9,y+10,'#9db1c5',2);rect(x-10,y+9,4,2,'#4ceaff');rect(x+7,y+9,4,2,'#4ceaff');
  }
  const b=game.get(e.building);if(b&&game.adjacent(e,b)){line(x+9*face,y+5,x+17*face,y-5,'#b4d6df',2);line(x+17*face,y-5,x+22*face,y-10,'#86ffff',2);if(Math.sin(game.time*14)>.4)rect(x+21*face,y-13,3,3,'#f9ffd5');}
 }else if(swarm){
  const bulk=e.type==='grenadier'?10:e.type==='assault'?9:7;
  for(const side of [-1,1]){line(x+side*4,y+1,x+side*8,y+6+Math.max(0,side*step),'#cc7a91',4);line(x+side*8,y+6+Math.max(0,side*step),x+side*11,y+8+Math.max(0,side*step),'#6a365e',3);}
  octagon(x-bulk,y-15-bob,bulk*2+1,20,'#4b2646');octagon(x-bulk+2,y-16-bob,bulk*2-3,15,'#ae4b78');
  for(const side of [-1,1]){shape([[x+side*5,y-13-bob],[x+side*14,y-19-bob],[x+side*10,y-5-bob]],'#793858');line(x+side*5,y-21-bob,x+side*10,y-28-bob,'#e0aca7',3);}
  octagon(x-5,y-23-bob,11,12,'#c291ac');rect(x-5,y-19-bob,4,3,'#ff686a');rect(x+2,y-19-bob,4,3,'#ff686a');rect(x-2,y-13-bob,5,3,'#3f253c');
  if(e.type==='assault'){line(x+11*face,y+1,x+17*face,y-24-bob,'#ff65b4',5);line(x+11*face,y+1,x+17*face,y-24-bob,'#ffd4f0',2);}
  else if(e.type==='medic'){rect(x-2,y-8-bob,4,10,'#9bffb1');rect(x-5,y-5-bob,10,4,'#9bffb1');}
  else{ctx.save();ctx.translate(x,y-bob);ctx.scale(face,1);octagon(5,-10,e.type==='grenadier'?16:12,8,'#44354c');rect(17,-8,5,4,e.type==='grenadier'?'#ffb575':'#ff88cb');if(e.type==='grenadier')crystal(-6,-6,13,'#ff8a76');ctx.restore();}
 }else{
  const accent=e.type==='assault'?'#ae8bff':e.type==='medic'?'#85ffd1':e.type==='grenadier'?'#ffb56b':'#6ce9ff',heavy=['assault','grenadier'].includes(e.type),w=heavy?9:7,armor=e.type==='medic'?'#e6f1e9':'#a5bdcf';
  for(const side of [-1,1]){const legY=y+Math.max(0,side*step);rect(x+side*4-2,legY-1,5,8,'#34445e');rect(x+side*4-2,legY,4,4,armor);rect(x+side*4-3,legY+6,7,3,'#1c293f');}
  rect(x-w-2,y-15-bob,5,16,'#34465f');rect(x+w-2,y-15-bob,5,16,'#34465f');rect(x-w-1,y-13-bob,3,4,accent);
  octagon(x-w,y-17-bob,w*2+1,20,'#354c64');octagon(x-w+2,y-15-bob,w*2-3,12,armor);rect(x-4,y-13-bob,9,3,'#45627e');rect(x-2,y-12-bob,5,2,accent);rect(x-4,y-2-bob,9,3,'#e1c68a');
  for(const side of [-1,1]){octagon(x+side*(w+2)-3,y-17-bob,7,8,armor);rect(x+side*(w+2)-2,y-16-bob,5,2,accent);}
  octagon(x-6,y-26-bob,13,13,armor);rect(x-4,y-26-bob,9,2,'#e6f2ff');rect(x-5,y-21-bob,11,4,'#142c43');rect(x-4,y-21-bob,9,2,accent);rect(x-2,y-16-bob,5,3,'#6b879c');
  if(e.type==='medic'){rect(x-1,y-11-bob,3,9,'#21866d');rect(x-4,y-8-bob,9,3,'#21866d');rect(x+10*face-2,y-5-bob,5,7,'#dfedea');rect(x+10*face-1,y-4-bob,3,3,'#84ffcf');}
  else if(e.type==='assault'){const swing=e.cool>.7?5:0;line(x+12*face,y+1-bob,x+(17+swing)*face,y-28-bob,'#7956f2',7);line(x+12*face,y+1-bob,x+(17+swing)*face,y-28-bob,'#d4c4ff',3);line(x+12*face,y+1-bob,x+(17+swing)*face,y-28-bob,'#fff2ff');rect(x+8*face-2,y-1-bob,8,3,'#b8c9d7');}
  else{const grenade=e.type==='grenadier';ctx.save();ctx.translate(x,y-bob);ctx.scale(face,1);octagon(2,-10,grenade?20:17,grenade?10:6,'#1c293c');rect(7,-11,grenade?11:8,3,'#899db1');rect(18,-8,5,4,accent);rect(7,-7,5,2,grenade?'#eaaa6f':'#60ceeb');ctx.restore();if(grenade)for(let i=0;i<3;i++)rect(x-8+i*5,y-2-bob,3,5,'#ffc887');}
 }
 if(e.carry){rect(x-16,y-1,7,9,'#263c55');rect(x-15,y,5,5,colors[e.carry.resource]);rect(x-15,y+6,5,1,'#d0e0ea');}
}
function drawSwarmBuilding(e,x,y,s){
 const l=x-s/2,t=y-s/2,large=e.type==='base',resource=stats[e.type].resource,pulse=Math.sin(game.time*2+e.id);
 for(const side of [-1,1])for(let i=0;i<3;i++){line(x+side*9,y-4+i*7,x+side*(s/2+3),y-8+i*10,'#55334e',4);line(x+side*(s/2+3),y-8+i*10,x+side*(s/2+6),y-1+i*10,'#93506c',2);}
 octagon(l+4,t+6,s-8,s-6,'#3e283f');octagon(l+7,t+3,s-14,s-12,'#7f3c61');octagon(l+12,t+4,s-24,s-17,'#ac537d');
 for(const side of [-1,1]){shape([[x+side*7,t+16],[x+side*(s/2-4),t-11],[x+side*(s/2-8),t+19]],'#d39ba5');line(x+side*(s/2-7),t+20,x+side*(s/2-11),y+9,'#50304e',3);}
 for(let i=0;i<3;i++)line(l+12,t+17+i*8,l+s-12,t+17+i*8,'#63314f',3);
 if(e.type==='tower'){rect(x-6,t-15,12,27,'#4c2945');rect(x-4,t-18,8,8,'#ff8b9e');line(x-14,t-6,x+14,t-6,'#d4829e',4);}
 else if(e.type==='goldmine'){crystal(x,y-4,32,'#ff8fee');}
 else if(e.type==='farm'||e.type==='house'){for(const side of [-1,1])octagon(x+side*10-7,y-10,14,22,resource?'#92b684':'#e49da9');}
 else if(e.type==='barracks'){shape([[x-13,y+18],[x-12,y-6],[x,y-17],[x+12,y-6],[x+13,y+18]],'#201a32');for(const side of [-1,1])line(x+side*9,y+6,x+side*4,y-6,'#e2a8a1',3);}
 else{const w=large?24:15;octagon(x-w/2,y-13,w,large?26:19,'#4c263f');octagon(x-w/2+3,y-10,w-6,large?18:12,resource?colors[resource]:'#ff759e');rect(x-2,y-8,4,large?12:6,'#ffe2ce');}
 if(large){crystal(x,t-4,25,'#ff88b6');for(const side of [-1,1])octagon(x+side*23-7,y+9,14,15,'#c2798e');}
 rect(l+9,t+s-2,s-18,2,pulse>0?'#ed669d':'#a44276');
}
function drawBuilding(e,x,y){
 const s=e.size*T,l=x-s/2,t=y-s/2,c=e.team===1?'#fa78b5':e.team===0?'#63edfa':'#cbb1ff';
 rect(l-3,t+s-3,s+7,8,'#05081788');
 if(e.construction>0){
  const p=1-e.construction/stats[e.type].buildTime,b=game.get(e.builder),working=b&&game.adjacent(b,e),h=Math.round((s-10)*p);
  octagon(l,t+s-10,s,12,'#33485a');octagon(l+4,t+s-8-h,s-8,Math.max(1,h),'#50647e');
  for(const dx of [1,s-3]){rect(l+dx,t,2,s,c);for(let i=4;i<s;i+=10)rect(l+dx-2,t+i,6,2,'#8492b3');}
  line(l,t+s-3,l+s,t+3,'#455b78',2);rect(l,t+(game.time*10)%s,s,1,c);
  if(working){rect(l+s-9,t+s-10-Math.sin(game.time*12)*3,3,3,'#eaffff');line(l+s-8,t+s-9,l+s-3,t+s-17,c);}
  rect(l,t+s+3,s,4,'#10182a');rect(l,t+s+3,s*p,4,working?c:'#827a9d');ctx.font='9px monospace';ctx.fillStyle='#d5edff';ctx.fillText(b?(working?Math.ceil(e.construction)+'с':'в пути'):'ждёт',x-12,t-4);return;
 }
 // Each type has a distinct silhouette; no generic house sprite under the details.
 if(e.team===1&&e.type!=='outpost')drawSwarmBuilding(e,x,y,s);
 else if(e.type==='base'){
  octagon(l-2,t+23,s+4,s-21,'#27394e');octagon(l+4,t+17,s-8,s-23,'#526b82');octagon(l+9,t+12,s-18,s-23,'#9ab5c4');
  for(const side of [-1,1]){octagon(x+side*25-10,y+3,20,26,'#2b425a');octagon(x+side*25-8,y+2,16,17,'#aec6d0');rect(x+side*25-5,y+7,10,3,c);}
  octagon(x-17,t+12,34,33,'#263d57');octagon(x-13,t+15,26,24,'#61bcdb');octagon(x-8,t+17,16,18,'#a5f4ff');rect(x-3,t+18,6,15,'#efffff');
  octagon(x-20,t-3,40,18,'#d0dfe1');rect(x-15,t+3,30,4,'#46617d');rect(x-10,t+4,20,2,c);
  line(x+24,t+18,x+24,t-18,'#9db6c8',2);line(x+13,t-10,x+33,t-10,'#b3d3df',2);rect(x+21,t-21,6,4,'#6effee');rect(x-12,t+s-7,24,5,'#132940');rect(x-8,t+s-6,16,2,c);
 }else if(e.type==='house'){
  octagon(l,t+22,s,26,'#344e66');octagon(l+4,t+17,s-8,24,'#9bb2c7');
  for(let i=0;i<3;i++){octagon(l+4+i*14,t+4,12,28,'#587991');rect(l+6+i*14,t+8,8,17,'#223c59');rect(l+7+i*14,t+10,6,11,'#9befff');rect(l+9+i*14,t+10,2,11,'#e0ffff');rect(l+6+i*14,t+28,8,3,'#b3cbd7');}
  rect(l+5,t+40,s-10,3,'#57708b');rect(x-3,t-5,6,10,'#d1e1e8');rect(x-2,t-7,4,3,c);
 }else if(e.type==='warehouse'){
  octagon(l,t+20,s,28,'#293e53');for(const [dx,dy,col]of [[2,18,'#5087a0'],[25,16,'#596d98'],[12,0,'#bc8f5a']]){octagon(l+dx,t+dy,21,19,col);rect(l+dx+3,t+dy+3,15,2,'#d5d7cc');for(let j=0;j<3;j++)rect(l+dx+4+j*5,t+dy+7,2,9,'#1d354355');}
  line(l+2,t+5,l+2,t+38,'#a4bdcc',3);line(l+s-2,t+5,l+s-2,t+38,'#a4bdcc',3);rect(l,t+3,s,5,'#7894a8');rect(x-5,t+8,10,4,'#63d7ea');
 }else if(e.type==='sawmill'){
  octagon(l,t+20,s,28,'#40556b');rect(l+1,t+30,s-2,10,'#203449');for(let i=0;i<6;i++)rect(l+3+i*7,t+32,3,6,'#789196');
  octagon(l+4,t+4,27,29,'#8fa7b5');octagon(l+8,t+8,19,18,'#243f53');for(let i=0;i<4;i++){rect(l+10+i*4,t+11,2,13,'#96d5d1');rect(l+10+i*4,t+12,2,4,'#d2ffff');}
  rect(l+33,t+12,11,22,'#56768b');rect(l+35,t+13,7,4,'#75f5e0');line(x-9,y+9,x+11,y-3,'#c3dee2',3);rect(l+4,t+37,9,4,'#56c6c6');
 }else if(e.type==='farm'){
  octagon(l,t+19,s,29,'#344e5d');line(l+5,t+39,l+s-5,t+39,'#acd9bd',3);
  for(const [dx,dy]of [[0,5],[15,-3],[30,5]]){octagon(l+dx+1,t+dy+6,16,31,'#8bafb2');rect(l+dx+4,t+dy+11,10,19,'#2b6c62');rect(l+dx+5,t+dy+12,7,16,'#69d69a');rect(l+dx+6,t+dy+13,2,13,'#c0ffd0');rect(l+dx+3,t+dy+4,12,5,'#c6d7d1');rect(l+dx+3,t+dy+32,12,4,'#627e8b');}
 }else if(e.type==='quarry'){
  octagon(l,t+13,s,35,'#4c465a');octagon(l+4,t+18,s-8,25,'#1e2236');
  for(const side of [-1,1]){line(x+side*18,t+3,x+side*20,t+40,'#9cabc0',5);line(x+side*19,t+6,x,t+21,'#6f819a',3);}
  rect(l+3,t+1,s-6,7,'#c0b9bb');rect(x-3,t+7,6,27,'#c0d3e2');for(let i=0;i<4;i++)line(x-7,t+14+i*5,x+7,t+20+i*5,'#63829b',3);rect(l+5,t+35,9,5,'#afa6b7');
 }else if(e.type==='ironmine'){
  octagon(l,t+17,s,31,'#41536a');octagon(l+10,t+9,29,30,'#819ab1');rect(l+15,t+19,19,16,'#342b3c');rect(l+18,t+23,13,12,'#ff9e57');rect(l+21,t+26,7,9,'#ffdf9b');
  for(const [dx,dy]of [[3,-6],[32,-13]]){rect(l+dx,t+dy+3,10,29,'#4d677e');rect(l+dx-1,t+dy,12,5,'#bacad0');rect(l+dx+2,t+dy+6,2,14,'#9cbac6');}rect(l+2,t+38,15,5,'#93cde5');
 }else if(e.type==='goldmine'){
  octagon(l,t+27,s,20,'#3c375c');octagon(l+7,t+26,s-14,15,'#716296');
  for(const side of [-1,1]){line(x+side*17,t+32,x+side*13,t+6,'#a3b0cb',5);line(x+side*13,t+6,x+side*5,t+1,'#8d83c2',3);rect(x+side*13-2,t+7,4,8,'#de9dff');}
  crystal(x,y-1+Math.sin(game.time*2)*2,29,'#d397ff');line(x-12,t+34,x+12,t+34,'#e7b5ff',2);rect(x-3,t+39,6,3,'#ffcfff');
 }else if(e.type==='barracks'){
  octagon(l,t+12,s,35,'#243a51');octagon(l+4,t+8,s-8,25,'#718da2');rect(l+10,t+17,29,23,'#14283e');rect(l+13,t+19,23,16,'#374e68');
  for(let i=0;i<4;i++)rect(l+13,t+20+i*4,23,1,'#7b9eb2');rect(l+2,t+27,6,17,'#b1c7cb');rect(l+s-8,t+27,6,17,'#b1c7cb');
  shape([[x-19,t+12],[x-12,t-4],[x-5,t-4],[x,t-10],[x+5,t-4],[x+12,t-4],[x+19,t+12],[x+6,t+7],[x,t+12],[x-6,t+7]],'#d0dce2');rect(x-3,t-4,6,8,'#5ccee7');for(const side of [-1,1])rect(x+side*10-2,t+8,4,5,'#ffad70');rect(x-7,t+40,14,3,'#f7c987');
 }else if(e.type==='tower'){
  octagon(l+3,t+26,s-6,20,'#506b83');octagon(x-12,t+7,24,30,'#99b2c8');octagon(x-17,t+2,34,17,'#314b66');rect(x-12,t+5,24,4,'#c0d3df');
  for(const dx of [-10,6]){rect(x+dx,t-19,5,27,'#7e9db4');rect(x+dx+1,t-18,3,20,'#63dbff');rect(x+dx-2,t-22,9,6,'#d1e5e9');rect(x+dx,t-22,5,2,'#96ffff');}rect(x-3,t+13,6,5,'#64f8ef');
 }else if(e.type==='outpost'){
  octagon(l+4,t+33,s-8,14,'#4e526e');octagon(l+10,t+28,s-20,13,'#8b9bb6');rect(x-3,t-7,6,43,'#7184aa');rect(x-1,t-7,2,40,c);
  for(const side of [-1,1]){line(x+side*4,t+10,x+side*16,t-6,'#9baecc',3);line(x+side*16,t-6,x+side*8,t-19,c,2);}octagon(x-6,t-24,12,14,'#34375e');rect(x-3,t-21,6,8,c);line(x-10,t+1,x+10,t+1,c,2);
 }
 const occupants=game.workers(e).filter(u=>u.inside===e.id).length;
 for(let i=0;i<occupants;i++)rect(l+5+i*7,t+s-3,4,3,'#99ffcf');
 if(occupants&&e.buffer<60&&(!e.node||(game.get(e.node)?.amount||0)>0)){
  const phase=(game.time*.65)%1;rect(x+8,t-4-phase*12,3,2,'#a5c5ef66');rect(l+s-8,t+17+Math.floor(game.time*3)%3*3,2,2,'#b7ffde');
  if(e.type==='farm')rect(l+7+Math.floor(game.time*2)%3*15,t+23,4,2,'#dbffcf');
  if(['quarry','ironmine','sawmill'].includes(e.type))rect(x-5+Math.sin(game.time*8)*3,t+10,8,2,'#d8f1ff');
 }
 if(stats[e.type].resource){rect(l,t+s+3,s,3,'#141d32');rect(l,t+s+3,s*e.buffer/60,3,colors[stats[e.type].resource]);ctx.font='9px monospace';ctx.fillStyle='#c8e6f5';ctx.fillText(`${game.workers(e).length}/2`,x-8,t+s+14);}
}
function surfaceHash(x,y){let n=Math.imul(x+113,374761393)^Math.imul(y+71,668265263)^game.seed;n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;}
function drawSurface(){
 for(let y=Math.floor(camera.y);y<Math.min(H,Math.ceil(camera.y+VH));y++)for(let x=Math.floor(camera.x);x<Math.min(W,Math.ceil(camera.x+VW));x++){
  const px=x*T,py=y*T,n=surfaceHash(x,y),region=game.regionAt(x,y),biome=region.id%3;
  rect(px,py,T,T,game.terrain[y][x]?'#151d30':[['#35364c','#37394f'],['#3b354c','#3c374e'],['#343e50','#364052']][biome][n%2]);
  if(n%5===0)rect(px+3+n%13,py+4+(n>>>8)%13,3,2,'#66637a66');
  if(n%11===0){line(px+2,py+18,px+11,py+11,'#22283b',2);line(px+11,py+11,px+19,py+13,'#22283b');}
  if(n%41===0){rect(px+10,py+9,6,2,'#77b7b744');rect(px+12,py+8,2,2,'#a1ebdb66');}
 }
 // Large seeded geological features are cosmetic; they never change pathfinding.
 for(let gy=Math.floor(camera.y/12)-1;gy<=Math.ceil((camera.y+VH)/12);gy++)for(let gx=Math.floor(camera.x/12)-1;gx<=Math.ceil((camera.x+VW)/12);gx++){
  if(gx<0||gy<0)continue;const n=surfaceHash(gx+500,gy+500),x=(gx*12+3+n%6)*T,y=(gy*12+3+(n>>>6)%6)*T;
  if(n%3===0){
   const w=45+n%35,h=w*.55;octagon(x-w/2-4,y-h/2-3,w+8,h+8,'#74718644');octagon(x-w/2,y-h/2,w,h,'#24283c');octagon(x-w/2+5,y-h/2+5,w-10,h-9,'#2c3043');line(x-w/3,y+h/2-1,x+w/4,y+h/2-1,'#9290a155');
   for(let i=0;i<3;i++)rect(x-10+i*9,y-3+i%2*5,4,2,'#4f5069');
  }else if(n%3===1){
   const tint=game.regionAt(x/T,y/T)?.owner===1?'#d956a2':'#9979e0';
   const points=[[x-28,y+19],[x-17,y+7],[x-7,y+10],[x+1,y-8],[x+17,y-12],[x+28,y-25]];for(let i=1;i<points.length;i++){line(...points[i-1],...points[i],'#161f35',7);line(...points[i-1],...points[i],tint+'55',3);line(...points[i-1],...points[i],tint+'88');}
  }else if(n%5===0){
   shape([[x-20,y+7],[x-12,y-18],[x-3,y-23],[x+2,y-1],[x+20,y+13]],'#263147');line(x-12,y-18,x+2,y-1,'#758197',3);line(x-12,y-18,x-17,y+5,'#a0abbd',2);rect(x-5,y+1,9,3,'#529096');
  }
 }
 for(let y=Math.floor(camera.y);y<Math.min(H,Math.ceil(camera.y+VH));y++)for(let x=Math.floor(camera.x);x<Math.min(W,Math.ceil(camera.x+VW));x++){
  const r=game.regionAt(x,y),px=x*T,py=y*T;if(r.owner>=0)rect(px,py,T,T,r.owner===0?'#3ad4ef05':'#f94c9c0b');
  if(game.regionGrid[y]?.[x+1]!==r.id)line(px+T,py+2,px+T,py+T-2,'#ac98df66');if(game.regionGrid[y+1]?.[x]!==r.id)line(px+2,py+T,px+T-2,py+T,'#ac98df66');
 }
}
function render(){
 ctx.save();ctx.translate(-camera.x*T,-camera.y*T);
 drawSurface();
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
