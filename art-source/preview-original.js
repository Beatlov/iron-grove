'use strict';
const spriteData=globalThis.HELIOSOriginalSprites,actions=spriteData.animations;
const directions=spriteData.directions,captions=['вниз','вверх','влево','вправо','вниз-влево','вниз-вправо','вверх-влево','вверх-вправо'];
const $=id=>document.getElementById(id),images={},canvases=[];
let action='walk',frame=0,playing=true,clock=0,last=0,ready=false;
function load(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Не удалось загрузить '+src));image.src=src;});}
for(let row=0;row<8;row++){
 const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');
 canvas.width=spriteData.viewport.width;canvas.height=spriteData.viewport.height;
 caption.textContent=directions[row]+' · '+captions[row];figure.append(canvas,caption);$('grid').append(figure);canvases.push(canvas);
}
function selectedScale(){return $('scale').value==='compact'?actions[action].compactDisplayScale:Number($('scale').value);}
function drawOriginalFrame(context,image,record){
 const [x,y,w,h]=record.rect,[px,py]=record.pivot,[ax,ay]=spriteData.viewport.pivot;
 context.clearRect(0,0,spriteData.viewport.width,spriteData.viewport.height);
 context.imageSmoothingEnabled=false;
 // Same source/destination dimensions: copy original pixels. No filtering,
 // palette conversion, alpha thresholding, outline or per-pose stretching.
 context.drawImage(image,x,y,w,h,ax-px,ay-py,w,h);
}
function draw(){
 if(!ready)return;
 const a=actions[action],scale=selectedScale();
 canvases.forEach((canvas,row)=>{
  canvas.style.width=(spriteData.viewport.width*scale)+'px';canvas.parentElement.style.width=canvas.style.width;
  const p=canvas.getContext('2d'),record=a.frames[row*a.framesPerDirection+frame];drawOriginalFrame(p,images[action],record);
  if($('guides').checked){
   const [px,py]=spriteData.viewport.pivot,[x,y,w,h]=record.rect,[ax,ay]=record.pivot;
   p.strokeStyle='#a1b48a88';p.lineWidth=1;p.setLineDash([4,4]);p.strokeRect(px-ax+.5,py-ay+.5,w-1,h-1);p.setLineDash([]);
   p.fillStyle='#eb917d';p.fillRect(px-5,py,11,1);p.fillRect(px,py-5,1,11);
  }
 });
 $('source-link').href=a.file;
 $('stage').textContent=`Оригинал ${a.sourceSize.join('×')} · кадр ${frame+1}/${a.framesPerDirection} · ${a.fps} FPS · ${playing?'воспроизведение':'пауза'}`;
}
function reset(){frame=0;clock=0;draw();}
$('action').onchange=()=>{action=$('action').value;reset();};$('scale').onchange=draw;$('guides').onchange=draw;
$('pause').onclick=()=>{playing=!playing;$('pause').textContent=playing?'Пауза':'Продолжить';draw();};
$('step').onclick=()=>{playing=false;$('pause').textContent='Продолжить';frame=(frame+1)%actions[action].framesPerDirection;clock=0;draw();};$('restart').onclick=reset;
function tick(now){
 const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
 if(playing&&ready){clock+=dt;const a=actions[action];while(clock>=1/a.fps){clock-=1/a.fps;frame=a.loop?(frame+1)%a.framesPerDirection:Math.min(a.framesPerDirection-1,frame+1);}draw();}
 requestAnimationFrame(tick);
}
Promise.all(Object.keys(actions).map(async a=>{images[a]=await load(actions[a].file);})).then(async()=>{
 const base=await load(spriteData.base.file),canvas=$('core');canvas.width=base.naturalWidth;canvas.height=base.naturalHeight;
 canvas.getContext('2d').drawImage(base,0,0);ready=true;draw();
}).catch(e=>{$('error').textContent=e.message;});
requestAnimationFrame(tick);
