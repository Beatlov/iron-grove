'use strict';
const {Game,stats,W,H,dist}=RTS;
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),T=24;
ctx.imageSmoothingEnabled=false;
let game=new Game(),selected=[],placing=false,paused=false,drag=null,mouse={x:0,y:0},last=0,uiTimer=0,marker=null;
const $=s=>document.querySelector(s),names={base:'Штаб',barracks:'Казарма',worker:'Рабочий',soldier:'Боец'};
const clock=t=>`${Math.floor(Math.max(0,t)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,t)%60).toString().padStart(2,'0')}`;
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function outline(x,y,w,h,c){ctx.strokeStyle=c;ctx.lineWidth=1;ctx.strokeRect(Math.round(x)+.5,Math.round(y)+.5,w,h);}
function point(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)/r.width*W,y:(ev.clientY-r.top)/r.height*H};}
function hit(p){return game.alive().filter(e=>Math.abs(e.x-p.x)<e.size/2+.15&&Math.abs(e.y-p.y)<e.size/2+.15).sort((a,b)=>a.size-b.size)[0];}
function updateUI(){
  selected=selected.filter(id=>game.get(id));$('#wood').textContent=game.wood;$('#army').textContent=game.alive().filter(e=>e.team===0&&stats[e.type]?.speed).length;$('#clock').textContent=clock(game.time);$('#wave').textContent=clock(game.nextWave-game.time);$('#message').textContent=placing?'Выберите место для казармы. Зелёный — можно строить, красный — нельзя. Esc — отмена.':game.message;
  const units=selected.map(id=>game.get(id));const e=units[0];
  $('#selection').textContent=units.length>1?`Отряд · ${units.length} юнитов`:e?names[e.type]:'Отряд не выбран';
  $('#details').textContent=units.length===1?`Здоровье: ${Math.ceil(e.hp)} / ${e.maxHp}`+(e.type==='worker'?` · несёт ${e.carry} дерева`:''):'ЛКМ — выбрать · рамка — отряд';
  const actions=$('#actions');actions.replaceChildren();
  if(units.length===1&&(e.type==='base'||e.type==='barracks')){const type=e.type==='base'?'worker':'soldier';const b=document.createElement('button');b.className='action';b.textContent=`Нанять: ${names[type]} · ${stats[type].cost} дерева`;b.disabled=game.wood<stats[type].cost||e.queue.length>=5||!!game.result;b.onclick=()=>{game.train(e.id,type);updateUI();};actions.append(b);if(e.queue.length){const p=document.createElement('p');p.textContent=`В очереди: ${e.queue.length} · готов через ${Math.ceil(e.queue[0].left)} с`;actions.append(p);}}
  $('#build').disabled=game.wood<120||!!game.result;$('#build').style.borderColor=placing?'#cfdd8e':'';
  $('#overlay').hidden=!paused&&!game.result;$('#pause').textContent=paused?'Продолжить':'Пауза';
  $('#endtitle').textContent=game.result==='victory'?'Победа':game.result==='defeat'?'База потеряна':'Пауза';$('#endtag').textContent=game.result?'БОЙ ЗАВЕРШЁН':'СИМУЛЯЦИЯ ОСТАНОВЛЕНА';$('#endtext').textContent=game.result==='victory'?'Вражеская база уничтожена. Перевал ваш.':game.result==='defeat'?'Рабочие и подкрепления помогут удержать следующую оборону.':'Пробел — продолжить';
}
canvas.addEventListener('contextmenu',ev=>ev.preventDefault());
canvas.addEventListener('pointerdown',ev=>{if(paused||game.result)return;mouse=point(ev);if(ev.button===2){placing=false;const target=hit(mouse);game.command(selected,mouse.x,mouse.y,target?.id);marker={...mouse,time:game.time};updateUI();return;}if(ev.button!==0)return;if(placing){if(game.build(Math.round(mouse.x),Math.round(mouse.y)))placing=false;updateUI();return;}drag={start:mouse,end:mouse,shift:ev.shiftKey};canvas.setPointerCapture(ev.pointerId);});
canvas.addEventListener('pointermove',ev=>{mouse=point(ev);if(drag)drag.end=mouse;});
canvas.addEventListener('pointerup',ev=>{if(!drag)return;const a=drag.start,b=point(ev);let ids=[];if(dist(a,b)<.3){const e=hit(b);if(e?.team===0)ids=[e.id];}else ids=game.alive().filter(e=>e.team===0&&stats[e.type]?.speed&&e.x>=Math.min(a.x,b.x)&&e.x<=Math.max(a.x,b.x)&&e.y>=Math.min(a.y,b.y)&&e.y<=Math.max(a.y,b.y)).map(e=>e.id);selected=drag.shift?[...new Set([...selected,...ids])]:ids;drag=null;updateUI();});
canvas.addEventListener('pointercancel',()=>{drag=null;});
function pause(){if(game.result)return;paused=!paused;drag=null;updateUI();}
$('#pause').onclick=pause;$('#build').onclick=()=>{if(!paused&&!game.result){placing=!placing;updateUI();}};
$('#restart').onclick=()=>{game=new Game();selected=[];placing=false;paused=false;drag=null;marker=null;updateUI();};
window.addEventListener('keydown',ev=>{if(ev.code==='Space'&&ev.target.tagName!=='BUTTON'){ev.preventDefault();pause();}if(ev.code==='Escape'){placing=false;drag=null;updateUI();}if(ev.code==='KeyB'&&!paused&&!game.result){placing=!placing;updateUI();}});
window.addEventListener('blur',()=>{if(!game.result){paused=true;drag=null;updateUI();}});
function terrain(){
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const n=((x*37+y*71+x*y*3)%29),px=x*T,py=y*T;
    if(game.terrain[y][x]){rect(px,py,T,T,'#26392e');rect(px+2,py+3,20,17,'#354b3a');rect(px+2,py+3,17,3,'#4c6350');rect(px+17,py+8,5,14,'#203126');rect(px+6,py+8,5,4,'#3f5741');}
    else{const road=y>=11&&y<=14;rect(px,py,T,T,road?(n%3?'#756c47':'#7e744c'):(n%3?'#456641':'#4b6b43'));if(road){rect(px+n%17,py+n%15,3,2,'#8c8054');}else{rect(px+n%19,py+4+n%14,2,3,'#607c49');if(n<8)rect(px+13,py+16,2,2,'#809358');}}
  }
  // Ruined border posts mark the crossing.
  for(const x of [18,23])for(const y of [10,15]){rect(x*T+7,y*T+9,12,13,'#24342b');rect(x*T+5,y*T+4,12,14,'#8c9274');rect(x*T+5,y*T+4,12,3,'#b3b292');}
}
function drawEntity(e){const x=Math.round(e.x*T),y=Math.round(e.y*T),blue=e.team===0,c=blue?'#75bddd':'#dd7c68',dark=blue?'#304d64':'#6e3634',light=blue?'#bee3e2':'#f4c3a0';
  if(e.type==='tree'){rect(x-8,y+7,18,5,'#344e33');rect(x-2,y-1,5,13,'#72573a');rect(x-9,y-9,18,13,'#244e35');rect(x-6,y-16,13,13,'#2f6340');rect(x-3,y-19,8,8,'#3e7950');rect(x-7,y-10,5,4,'#528653');return;}
  if(selected.includes(e.id)){ctx.strokeStyle='#d5e6a3';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y+7,e.size*T/2+3,e.size*T/4,0,0,Math.PI*2);ctx.stroke();}
  if(e.type==='base'||e.type==='barracks'){
    const s=e.size*T,left=x-s/2,top=y-s/2;rect(left+4,top+7,s,s,'#293d2e');rect(left,top+5,s,s-5,'#686c56');rect(left+4,top+9,s-8,s-13,'#95927a');rect(left,top+4,s,5,'#b5b18b');
    rect(left-3,top-4,s+6,17,dark);rect(left+1,top-8,s-2,6,c);rect(left+5,top-12,s-10,5,c);rect(left+6,top-5,s-12,2,light);
    rect(x-7,y+8,14,s/2-8,'#303d36');rect(x-5,y+11,10,4,'#bcb48a');for(const dx of [-s/2+8,s/2-16]){rect(x+dx,y-5,8,9,'#344b4a');rect(x+dx+2,y-3,4,5,'#c5b783');}
    rect(x+13,top-29,2,20,'#c4bb91');rect(x+15,top-29,14,9,c);rect(x+25,top-20,4,3,dark);
    if(e.queue.length){rect(left,y+s/2+9,s,3,'#20342b');rect(left,y+s/2+9,s*(1-e.queue[0].left/stats[e.queue[0].type].time),3,'#d2df8e');}
  }else{
    const walk=e.path.length?Math.sin(game.time*12+e.id)*2:0;rect(x-6,y+5,13,4,'#304c34');rect(x-4,y+2,3,5+walk,'#263b39');rect(x+2,y+2,3,5-walk,'#263b39');rect(x-5,y-6,11,9,dark);rect(x-4,y-6,9,4,c);rect(x-3,y-13,7,7,'#d9b488');rect(x-4,y-15,9,4,e.type==='worker'?'#c9ae68':c);rect(x,y-11,2,2,'#283c38');
    if(e.type==='soldier'){rect(x+7,y-10,2,13,'#d6ddd0');rect(x+5,y+1,6,2,'#c2ae76');rect(x-8,y-3,5,8,c);rect(x-7,y-1,3,2,light);}else{rect(x+6,y-5,2,12,'#9b8050');rect(x+5,y-8,6,5,'#b6bdae');if(e.carry)rect(x-8,y-2,4,7,'#e0c782');}
    if(e.cool>.55&&e.order?.type==='attack'){rect(x+10,y-6,7,2,'#f0db9c');rect(x+13,y-9,2,8,'#f0db9c');}
  }
  if(e.hp<e.maxHp||selected.includes(e.id)){const w=e.size>1?e.size*T:20,hy=y-e.size*T/2-18;rect(x-w/2-1,hy-1,w+2,5,'#182a23');rect(x-w/2,hy,w*e.hp/e.maxHp,3,e.team===0?'#bedf8b':'#e79770');}
}
function render(){terrain();game.alive().sort((a,b)=>a.y-b.y).forEach(drawEntity);
  if(marker&&game.time-marker.time<.65){const s=5+(game.time-marker.time)*8;outline(marker.x*T-s,marker.y*T-s,s*2,s*2,'#d9e7a6');}
  if(drag){const a=drag.start,b=drag.end;rect(Math.min(a.x,b.x)*T,Math.min(a.y,b.y)*T,Math.abs(b.x-a.x)*T,Math.abs(b.y-a.y)*T,'#cddd9820');outline(Math.min(a.x,b.x)*T,Math.min(a.y,b.y)*T,Math.abs(b.x-a.x)*T,Math.abs(b.y-a.y)*T,'#d1e39d');}
  if(placing){const x=Math.round(mouse.x),y=Math.round(mouse.y),ok=game.canBuild(x,y);rect((x-1)*T,(y-1)*T,T*2,T*2,ok?'#b9e98677':'#ec786b88');outline((x-1)*T,(y-1)*T,T*2,T*2,ok?'#d4efa3':'#ffab92');}
  ctx.font='9px monospace';ctx.fillStyle='#e1e7cd';ctx.fillText('ВАША БАЗА',3*T,17.5*T);ctx.fillStyle='#f3b79b';ctx.fillText('ВРАЖЕСКАЯ БАЗА',31*T,17.5*T);
}
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(!paused)game.tick(dt);render();uiTimer+=dt;if(uiTimer>.18){updateUI();uiTimer=0;}requestAnimationFrame(frame);}
updateUI();requestAnimationFrame(frame);
