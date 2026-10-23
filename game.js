'use strict';
const {Game,stats,W,H,dist,resources,unitCosts,isMilitary}=RTS;
const $=s=>document.querySelector(s),canvas=$('#game'),initialContext=canvas.getContext('2d'),T=24;
let ctx=initialContext;
let VW=42,VH=26,commandMode=null,helpOpen=false,hoveredCommand=null,buildUIKey='',orderUIKey='';
ctx.imageSmoothingEnabled=false;
const minimap=$('#minimap'),mini=minimap.getContext('2d'),camera={x:0,y:H/2-VH/2},keys=new Set(),cursor={x:0,y:0};
const worldCanvas=$('#worldmap'),worldContext=worldCanvas.getContext('2d');
let gameSpeed=.6,inMenu=true,started=false,worldOpen=false,selectedRegion=0,pings=[],visualTime=0;
let visualGame=null,lastVisualUnits=new Map(),fallen=[];
const sectorNames=['Док «Гелиос»','Заводской периметр','Сухие верфи','Сектор печей','Ржавые карьеры','Грузовой узел','Остывший реактор','Разбитая магистраль','Северные цеха','Пепельный терминал','Последний рубеж','Цитадель легиона'];
const sectorTitle=r=>r?sectorNames[r.id]:'';
const names={worker:'Автономный дрон',soldier:'Десантник',assault:'Штурмовик',medic:'Медик',grenadier:'Гранатомётчик',base:'Командное ядро',house:'Станция сборки',warehouse:'Грузовой терминал',sawmill:'Переработчик',quarry:'Экстрактор реголита',farm:'Биореактор',ironmine:'Титановый бур',goldmine:'Кристальный резонатор',barracks:'Десантный комплекс',tower:'Рельсовая турель',outpost:'Ретранслятор'};
const resourceNames={wood:'Композит',stone:'Реголит',food:'Биогель',iron:'Титан',gold:'Ксенокристаллы'},colors=RTSArt.resources;
const artIconCache=new Map();
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
 if(type==='assign'){drawAssetIcon(c,'worker',32);r(24,3,3,11,'#d4dfad');r(20,7,11,3,'#d4dfad');return;}
 if(type==='move'){r(4,14,22,4,'#c7d891');r(20,8,4,16,'#c7d891');r(25,12,4,8,'#efe3b3');return;}
 if(type==='attack'){r(5,5,7,2,'#dfa07b');r(5,5,2,7,'#dfa07b');r(21,5,7,2,'#dfa07b');r(26,5,2,7,'#dfa07b');r(5,26,7,2,'#dfa07b');r(5,21,2,7,'#dfa07b');r(21,26,7,2,'#dfa07b');r(26,21,2,7,'#dfa07b');r(13,13,7,7,'#efc8a1');return;}
 if(type==='stop'){r(6,6,21,21,'#c8caa1');r(9,9,15,15,'#34452f');r(14,12,5,9,'#eee5c2');return;}
 if(type==='map'){r(3,4,26,24,'#2b4230');for(let i=7;i<29;i+=7){r(i,5,1,22,'#6b8050');r(4,i,24,1,'#6b8050');}r(8,17,4,4,'#d0e69a');r(22,8,4,4,'#e5a676');return;}
}
function spriteIcon(type,team=0,resource){
 const key=[type,team,resource].join(':');if(artIconCache.has(key))return artIconCache.get(key);
 const sprite=document.createElement('canvas'),unit=!!stats[type]?.speed;
 sprite.width=unit?40:type==='base'?80:resource?32:56;sprite.height=unit?40:type==='base'?96:resource?40:64;
 const c=sprite.getContext('2d');c.imageSmoothingEnabled=false;
 if(resource)RTSArt.deposit(c,{resource,amount:1},16,24);
 else if(unit)RTSArt.unit(c,{type,team,id:0,facingX:1},16,28,0);
 else RTSArt.building(c,{type,team,size:stats[type].size},sprite.width/2,sprite.height*.6,0);
 artIconCache.set(key,sprite);return sprite;
}
function fitIcon(c,sprite,size){c.imageSmoothingEnabled=false;const scale=Math.min(size/sprite.width,size/sprite.height),w=Math.round(sprite.width*scale),h=Math.round(sprite.height*scale);c.drawImage(sprite,Math.floor((size-w)/2),Math.floor((size-h)/2),w,h);}
function drawResourceIcon(canvas,resource){fitIcon(canvas.getContext('2d'),spriteIcon('deposit',0,resource),32);}
function drawAssetIcon(context,type,size,team=0){fitIcon(context,spriteIcon(type,team),size);}
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
 $('#population').textContent=`Лимит: ${p.total}/${p.capacity}`;
 $('#population').title=`Дроны: ${p.workers} · Бойцы: ${p.soldiers} · Перевозчики: ${carriers}. За 5 с: ${p.total} биогеля, ${p.soldiers*.5} ксенокристаллов.`;
 $('#economy-info').textContent=`Дроны ${p.workers} · Бойцы ${p.soldiers} · Перевозчики ${carriers}`;
 $('#clock').textContent=clock(game.time);
 const message=commandMode?(commandMode==='move'?'Идти: укажите место левой кнопкой. Esc — отмена.':'Атака: укажите противника левой кнопкой. Esc — отмена.'):placing?`Строительство: ${names[placing]}. ЛКМ по зелёному месту; Esc — отмена.`:game.teams[0].hungry?'Не хватает биогеля! Назначьте дронов на биореактор и оставьте перевозчиков.':game.teams[0].unpaid?'Не хватает ксенокристаллов! Боевые модули теряют здоровье.':game.message;
 const displayMessage=game.regions.reduce((m,r)=>m.replaceAll(r.name,sectorTitle(r)),message);$('#message').textContent=displayMessage;$('#message').title=displayMessage;
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
  if(e.type==='house')details+='\n+4 места · дрон каждые 20 с за 8 биогеля';
  if(e.type==='deposit')details=`${resourceNames[e.resource]}: ${Math.floor(e.amount)}`;
  if(e.type==='outpost'){const r=game.regions[e.region];details=sectorTitle(r)+'\n'+(r.owner===0?'Ваша территория':r.owner===1?'Вражеская территория':'Нейтральная территория')+'\nЗахват: '+Math.floor(r.progress/12*100)+'% · 12 с у ретранслятора';}
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
 $('#territory-score').textContent=`Секторы: ${owned} / 12 · Враг: ${enemy}`;$('#territory-label').textContent=sectorTitle(game.regionAt(camera.x+VW/2,camera.y+VH/2))||'Рубежи';if(worldOpen)updateRegionPanel();
 $('#overlay').hidden=!paused&&!game.result;$('#endtitle').textContent=game.result==='victory'?'Победа! Командное ядро демонов уничтожено':game.result==='defeat'?'Поражение: командное ядро уничтожено':'Пауза';$('#pause').className='speed-button'+(paused?' active':'');$('#pause').ariaPressed=String(paused);$('#pause').title=paused?'Продолжить · пробел':'Пауза · пробел';for(const [id,speed]of [['speed-slow',.4],['speed-normal',.6],['speed-fast',1]]){$('#'+id).className='speed-button'+(!paused&&gameSpeed===speed?' active':'');$('#'+id).ariaPressed=String(!paused&&gameSpeed===speed);}
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
function line(x1,y1,x2,y2,color,width=1){RTSArt.painter(ctx,0,0).line(x1,y1,x2,y2,color,width);}
function drawDeposit(e,x,y){RTSArt.deposit(ctx,e,x,y);}
function drawUnit(e,x,y){const site=game.get(e.building);RTSArt.unit(ctx,e,x,y,game.time,{working:site&&game.adjacent(e,site)});}
function drawBuilding(e,x,y){
 const builder=game.get(e.builder),occupants=game.workers(e).filter(u=>u.inside===e.id).length,working=builder&&game.adjacent(builder,e),resource=stats[e.type].resource;
 RTSArt.building(ctx,e,x,y,game.time,{working,progress:e.construction>0?1-e.construction/stats[e.type].buildTime:1,occupants,operating:occupants>0&&e.buffer<60&&(!e.node||(game.get(e.node)?.amount||0)>0)});
 const w=e.size*T,l=x-w/2,bottom=y+w/2;
 if(e.construction>0){rect(l,bottom+3,w,4,'#22291f');rect(l,bottom+3,Math.round(w*(1-e.construction/stats[e.type].buildTime)),4,working?'#c8ce87':'#8c8d6f');ctx.font='9px monospace';ctx.fillStyle='#eee2bc';ctx.fillText(builder?(working?Math.ceil(e.construction)+'с':'в пути'):'ждёт',x-12,y-w/2-6);}
 else if(resource){rect(l,bottom+3,w,3,'#282c26');rect(l,bottom+3,Math.floor(w*e.buffer/60),3,colors[resource]);ctx.font='9px monospace';ctx.fillStyle='#d0d4af';ctx.fillText(`${game.workers(e).length}/2`,x-8,bottom+14);}
}
function surfaceHash(x,y){let n=Math.imul(x+113,374761393)^Math.imul(y+71,668265263)^game.seed;n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;}
function drawSurface(){
 for(let y=Math.floor(camera.y);y<Math.min(H,Math.ceil(camera.y+VH));y++)for(let x=Math.floor(camera.x);x<Math.min(W,Math.ceil(camera.x+VW));x++){
  const px=x*T,py=y*T,n=surfaceHash(x,y),block=surfaceHash(Math.floor(x/5),Math.floor(y/5)),palette=[['#4c4f47','#4e5048'],['#504e45','#514f46'],['#484e48','#4a504a']][block%3];
  rect(px,py,T,T,game.terrain[y][x]?'#2c3431':palette[n%2]);
  if(n%7===0)rect(px+4+n%12,py+5+(n>>>8)%11,3,2,'#75756655');
  if(n%23===0){rect(px+6,py+15,7,2,'#333b35');rect(px+12,py+10,2,6,'#333b35');}
  // Abandoned paved corridors and old inset rails are traversable scenery.
  if(block%7===0){rect(px,py,T,T,'#414943');if(x%5===0)rect(px,py,1,T,'#333c36');if(y%5===0)rect(px,py,T,1,'#333c36');if(y%5===2&&x%2===0)rect(px+4,py+9,8,2,'#88816a44');}
 }
 for(let gy=Math.floor(camera.y/12)-1;gy<=Math.ceil((camera.y+VH)/12);gy++)for(let gx=Math.floor(camera.x/12)-1;gx<=Math.ceil((camera.x+VW)/12);gx++){
  if(gx<0||gy<0)continue;const n=surfaceHash(gx+500,gy+500),x=(gx*12+3+n%6)*T,y=(gy*12+3+(n>>>6)%6)*T,p=RTSArt.painter(ctx,Math.round(x),Math.round(y),2),{r,poly,line,plate}=p;
  if(n%4===0){
   // Collapsed wall segments, exposed rebar, rusted support beams.
   plate(-19,-7,33,12,'#626355','#343d35');r(-18,-6,30,2,'#82836c');r(-15,-3,5,5,'#414d40');r(-5,-3,8,5,'#414d40');r(7,-3,4,5,'#414d40');r(-7,-7,5,8,'#4d5448');line(15,-1,20,-6,'#7d6951');line(17,1,22,-1,'#7d6951');r(-19,6,8,3,'#5f6253');r(10,7,7,2,'#656759');
  }else if(n%4===1){
   poly([[-16,-5],[-9,-11],[10,-9],[17,-3],[13,6],[2,10],[-13,6]],'#676b5b');poly([[-14,-4],[-8,-9],[9,-7],[14,-2],[11,5],[1,7],[-11,5]],'#303a33');r(-7,-2,6,2,'#424d40');r(4,3,4,1,'#60644f');r(-13,6,10,1,'#82816a');
  }else if(n%4===2){
   r(-18,-10,3,25,'#313b34');r(-14,-10,1,25,'#697063');r(-19,-5,12,2,'#6c6251');r(-19,6,12,2,'#6c6251');r(-19,13,12,2,'#6c6251');plate(2,-4,13,9,'#505a4c');r(3,-3,11,2,'#787665');r(4,1,2,2,'#333f36');r(9,1,2,2,'#333f36');
  }else{
   poly([[-11,8],[-7,-8],[-1,-12],[3,4],[12,10]],'#333e35');line(-7,-8,3,4,'#777b69',2);line(-7,-8,-10,6,'#989179');r(-3,6,9,2,'#72725e');r(13,9,5,2,'#636650');
  }
 }
 // Ownership remains a thin tactical boundary; it never recolors the ground.
 for(let y=Math.floor(camera.y);y<Math.min(H,Math.ceil(camera.y+VH));y++)for(let x=Math.floor(camera.x);x<Math.min(W,Math.ceil(camera.x+VW));x++){
  const r=game.regionAt(x,y),px=x*T,py=y*T,color=r.owner===0?'#bfce8b77':r.owner===1?'#c3795977':'#a8a17b55';
  if(game.regionGrid[y]?.[x+1]!==r.id)rect(px+T-1,py+2,1,T-4,color);if(game.regionGrid[y+1]?.[x]!==r.id)rect(px+2,py+T-1,T-4,1,color);
 }
}
function visualDeaths(){
 if(visualGame!==game){visualGame=game;lastVisualUnits.clear();fallen=[];}
 for(const [id,u]of lastVisualUnits)if(!game.get(id))fallen.push({...u,born:game.time});
 lastVisualUnits=new Map(game.visible().filter(e=>stats[e.type]?.speed).map(e=>[e.id,{id:e.id,type:e.type,team:e.team,x:e.x,y:e.y,facingX:e.facingX}]));
 fallen=fallen.filter(e=>game.time-e.born<8).slice(-48);
 for(const e of fallen)RTSArt.fallen(ctx,e,Math.round(e.x*T),Math.round(e.y*T),game.time-e.born);
}
function selectionMark(e,x,y){
 const color=e.team===1?'#ecb28a':'#d0de9d';
 if(stats[e.type]?.speed){const points=[[x-13,y+6],[x,y+11],[x+13,y+6],[x,y+2],[x-13,y+6]];for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],color);}
 else{const r=e.size*T/2+3;for(const sx of [-1,1])for(const sy of [-1,1]){line(x+sx*r,y+sy*r,x+sx*(r-8),y+sy*r,color,2);line(x+sx*r,y+sy*r,x+sx*r,y+sy*(r-8),color,2);}}
}
function render(){
 ctx.save();ctx.translate(-camera.x*T,-camera.y*T);
 drawSurface();visualDeaths();
 for(const e of game.visible().sort((a,b)=>a.y-b.y)){
  if(e.x<camera.x-3||e.y<camera.y-3||e.x>camera.x+VW+3||e.y>camera.y+VH+3)continue;
  const x=Math.round(e.x*T),y=Math.round(e.y*T),s=e.size*T;
  if(e.type==='deposit'){drawDeposit(e,x,y);continue;}
  if(stats[e.type]?.speed)drawUnit(e,x,y);else drawBuilding(e,x,y);
  if(selected.includes(e.id))selectionMark(e,x,y);
  if(e.type==='outpost'){const r=game.regions[e.region];if(r.progress){rect(x-24,y-35,48,4,'#26372f');rect(x-24,y-35,48*r.progress/12,4,'#e2d295');}}
  if(Number.isFinite(e.maxHp)&&(e.hp<e.maxHp||selected.includes(e.id))){const hy=stats[e.type]?.speed?y-31:y-s/2-14;rect(x-s/2,hy,s,3,'#232b20');rect(x-s/2,hy,Math.ceil(s*e.hp/e.maxHp),3,e.team===1?'#d38d65':'#b9d37c');}
 }
 if(drag){const a=drag.start,b=drag.end;ctx.strokeStyle='#fff2a3';ctx.strokeRect(Math.min(a.x,b.x)*T,Math.min(a.y,b.y)*T,Math.abs(a.x-b.x)*T,Math.abs(a.y-b.y)*T);}
 if(placing){const x=Math.round(mouse.x),y=Math.round(mouse.y);rect((x-1)*T,(y-1)*T,48,48,game.canBuild(placing,x,y)?'#b4ff8b99':'#ff685b99');}
 for(const f of game.effects){const x=Math.round(f.x*T),y=Math.round(f.y*T),tx=Math.round(f.tx*T),ty=Math.round(f.ty*T),p=RTSArt.painter(ctx,0,0);
  if(f.kind==='heal'){line(x,y-6,tx,ty-7,'#b5de7377');rect(tx-1,ty-18,3,9,'#b9f175');rect(tx-4,ty-15,9,3,'#b9f175');}
  else if(f.kind==='slash'){line(tx-8,ty+4,tx+9,ty-16,'#e0deac',2);rect(tx+6,ty-16,2,3,'#f3efce');}
  else if(f.kind==='grenade'){const r=Math.round(3+(1-f.left/.3)*11);p.poly([[tx-r,ty],[tx-3,ty-3],[tx,ty-r],[tx+3,ty-3],[tx+r,ty],[tx+3,ty+3],[tx,ty+r],[tx-3,ty+3]],'#c58646');rect(tx-3,ty-3,7,7,'#f0c476');rect(tx-1,ty-2,3,5,'#f6e8b0');}
  else{const face=tx>=x?1:-1;line(x+12*face,y-7,tx,ty-5,'#dfc67a88');rect(x+15*face-2,y-9,4,5,'#f5d58a');rect(tx-1,ty-6,3,3,'#dec98f');}
 }
 for(const p of pings){const x=Math.round(p.x*T),y=Math.round(p.y*T),r=Math.round(5+p.age*18),color=p.kind==='attack'?'#efb28b':p.kind==='capture'?'#e4cc8e':'#c6df99';ctx.globalAlpha=1-p.age/.6;for(const sx of [-1,1])for(const sy of [-1,1]){line(x+sx*r,y+sy*Math.round(r*.55),x+sx*(r-4),y+sy*Math.round(r*.55),color);line(x+sx*r,y+sy*Math.round(r*.55),x+sx*r,y+sy*Math.round(r*.55)-sy*3,color);}if(p.kind!=='select'){line(x-3,y,x+3,y,color);line(x,y-3,x,y+3,color);}ctx.globalAlpha=1;}
 ctx.restore();
 drawRegionMap(mini,288,192);
 for(const e of game.visible()){if(e.type==='deposit'||e.type==='outpost')continue;mini.fillStyle=e.team===0?'#c5df85':'#ec9263';const size=stats[e.type]?.speed?2:e.size*2;mini.fillRect(e.x*2-size/2,e.y*2-size/2,size,size);}
 mini.strokeStyle='#fff2bb';mini.lineWidth=1;mini.strokeRect(camera.x*2,camera.y*2,VW*2,VH*2);
 if(worldOpen)drawRegionMap(worldContext,864,576,true);
}

function frame(now){
 const dt=last===null?0:Math.min((now-last)/1000,.1);last=now;
 if(started&&!inMenu&&!worldOpen&&!helpOpen&&!drag){const dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));camera.x+=dx*18*dt;camera.y+=dy*18*dt;clampCamera();}
 mouse={x:camera.x+cursor.x,y:camera.y+cursor.y};visualTime+=dt;pings=pings.filter(p=>(p.age+=dt)<.6);if(started&&!inMenu&&!paused&&!helpOpen)game.tick(dt*gameSpeed);if(started&&!inMenu)render();uiTimer+=dt;if(uiTimer>.2){updateUI();uiTimer=0;}requestAnimationFrame(frame);
}
function drawRegionMap(context,width,height,full=false){
 const sx=width/W,sy=height/H;context.fillStyle='#252e25';context.fillRect(0,0,width,height);
 for(const r of game.regions){const p=r.displayOutline;if(!p.length)continue;context.beginPath();context.moveTo(p[0].x*sx,p[0].y*sy);for(const a of p.slice(1))context.lineTo(a.x*sx,a.y*sy);
  context.closePath();context.fillStyle=r.owner===0?'#465438':r.owner===1?'#644238':['#424a3c','#484c40','#4d4e3f'][r.id%3];context.fill();
  context.fillStyle=r.owner===0?'#d5e6a2':r.owner===1?'#efac7b':'#e2d6ad';context.fillRect(r.x*sx-3,r.y*sy-3,6,6);
  if(full){context.font='12px Arial';context.textAlign='center';context.fillText(sectorTitle(r),r.x*sx,r.y*sy+23);if(game.homeRegions.includes(r.id)){context.font='10px Arial';context.fillText(r.id===game.homeRegions[0]?'Ваш плацдарм':'Плацдарм демонов',r.x*sx,r.y*sy+37);}if(r.progress){context.fillStyle='#182a22';context.fillRect(r.x*sx-30,r.y*sy+3,60,4);context.fillStyle='#e3d49c';context.fillRect(r.x*sx-30,r.y*sy+3,60*r.progress/12,4);}}
 }
 for(const r of game.regions)for(const run of r.borderRuns){if(run.neighbor<0||run.neighbor<r.id)continue;const p=run.points;context.beginPath();context.moveTo(p[0].x*sx,p[0].y*sy);
  for(let i=1;i<p.length-1;i++){const a=p[i],before=p[i-1],after=p[i+1],r1=Math.min(.25,1/dist(a,before)),r2=Math.min(.25,1/dist(a,after));context.lineTo((a.x+(before.x-a.x)*r1)*sx,(a.y+(before.y-a.y)*r1)*sy);context.quadraticCurveTo(a.x*sx,a.y*sy,(a.x+(after.x-a.x)*r2)*sx,(a.y+(after.y-a.y)*r2)*sy);}
  context.lineTo(p.at(-1).x*sx,p.at(-1).y*sy);const active=full&&(r.id===selectedRegion||run.neighbor===selectedRegion);context.strokeStyle=active?'#fae6aa':'#9b9b78';context.lineWidth=active?2.5:full?1.3:.6;context.stroke();
 }
 context.strokeStyle='#9b9b78';context.lineWidth=1;context.strokeRect(0,0,width,height);context.textAlign='start';
}
function updateRegionPanel(){
 const r=game.regions[selectedRegion];if(!r)return;
 $('#region-name').textContent=sectorTitle(r);const owner=r.owner===0?'Ваши секторы':r.owner===1?'Секторы противника':'Нейтральный сектор';
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
function portrait(e){const c=$('#portrait').getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#202a22';c.fillRect(0,0,64,64);for(let y=0;y<64;y+=8){c.fillStyle='#2c372a';c.fillRect(0,y,64,1);}if(e&&stats[e.type])drawAssetIcon(c,e.type,64,e.team);else if(e?.type==='deposit')fitIcon(c,spriteIcon('deposit',0,e.resource),64);}
function selectionCards(units){
 const cards=$('#selection-cards');cards.replaceChildren();cards.hidden=units.length<2;portrait(units[0]);
 for(const e of units){const b=action(cards,'',()=>{selected=[e.id];commandMode=null;});b.className='unit-card';const title=document.createElement('strong');title.textContent=names[e.type]||resourceNames[e.resource];b.append(title);const status=document.createElement('small');status.textContent=e.type==='outpost'?'Контроль территории':Math.ceil(e.hp)+' / '+e.maxHp;b.append(status);
  if(Number.isFinite(e.maxHp)){const bar=document.createElement('span');bar.className='hp-track';const fill=document.createElement('span');fill.style.width=Math.max(0,e.hp/e.maxHp*100)+'%';bar.append(fill);b.append(bar);}
 }
}

RTSArt.menuScene($('#menu-art').getContext('2d'),640,320);
home();updateUI();showMenu();requestAnimationFrame(frame);
