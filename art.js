/* HELIOS H11: brutal industrial art on a unified native pixel grid, with the complete H9 renderer available for comparison. */
(function(root){
'use strict';
const legacy=typeof module!=='undefined'?require('./art-legacy.js'):root.RTSArtLegacy;
const {painter}=legacy,resources={...legacy.resources};
const palettes=[{ink:'#101416',dark:'#20282b',shade:'#303e31',armor:'#4c603d',light:'#7c8b62',sand:'#b9ac85',cream:'#ded2ab',steel:'#39464d',steelLight:'#87928f',pack:'#674c35',glow:'#a6d23e',hot:'#ca982b'},
{ink:'#151216',dark:'#292329',shade:'#422d34',armor:'#743a43',light:'#a46b64',sand:'#b5a282',cream:'#dac8a4',steel:'#403f49',steelLight:'#8a858b',pack:'#513832',glow:'#e8a936',hot:'#ba6138'}];
// Quantize geometry before painting: outlines and stair steps always use native pixels.
// Scaling coordinates changes silhouette size, never the size of the pixel grid.
function pixelPainter(ctx,ox,oy,scale=1){
 const p=painter(ctx,Math.round(ox),Math.round(oy)),at=v=>Math.round(v*scale),span=(a,n)=>Math.max(1,at(a+n)-at(a));
 return{r:(x,y,w,h,c)=>{if(w>0&&h>0)p.r(at(x),at(y),span(x,w),span(y,h),c);},
 plate:(x,y,w,h,c,edge)=>p.plate(at(x),at(y),span(x,w),span(y,h),c,edge),
 line:(x,y,tx,ty,c,width=1)=>p.line(at(x),at(y),at(tx),at(ty),c,Math.max(1,Math.round(width))),
 poly:(points,c)=>p.poly(points.map(([x,y])=>[at(x),at(y)]),c)};
}
const UNIT_SCALE=41/48;
let style='refined';
function setStyle(value){if(!['refined','classic'].includes(value))return false;style=value;return true;}
const getStyle=()=>style;
function unit(ctx,e,x,y,time=0,state={}){
 if(style==='classic')return legacy.unit(ctx,e,x,y,time,state);
 const c=palettes[e.team===1?1:0],demon=e.team===1,worker=e.type==='worker',medic=e.type==='medic',assault=e.type==='assault',grenadier=e.type==='grenadier';
 const phase=Math.floor((e.walkDistance||0)*5)%4,step=e.moving?[0,2,0,-2][phase]:0,face=e.facingX<-.15?-1:1,back=e.facingY<-.45;
 ctx.save();if(face<0){ctx.translate(Math.round(x)*2,0);ctx.scale(-1,1);}
 const {r,plate,poly,line}=pixelPainter(ctx,x-14*UNIT_SCALE,y-25*UNIT_SCALE,UNIT_SCALE);
 const suit=worker?(demon?'#936130':'#be912d'):medic?c.sand:c.armor,highlight=worker?'#d9b250':medic?c.cream:c.light;
 r(5,31,23,2,'#14171955');
 // Large, simple leg shapes; every phase shares the same foot anchor.
 for(const [lx,s]of [[7,step],[20,-step]]){plate(lx,20+Math.max(0,s),7,11-Math.abs(s),c.ink);r(lx+1,21+Math.max(0,s),5,6-Math.abs(s),suit);if(!worker)r(lx+1,23+Math.max(0,s),4,3,c.sand);r(lx-1,28+Math.max(0,s),9,4,c.ink);r(lx,28+Math.max(0,s),7,1,c.steel);}
 // Backpack, antenna and solid chest blocks, deliberately no fine surface noise.
 plate(3,7,9,15,c.pack);r(4,8,3,8,worker?'#b07825':c.pack);r(7,3,3,7,c.ink);r(8,3,1,3,worker?c.hot:c.glow);
 plate(8,10,18,14,c.ink);r(9,11,16,11,suit);r(12,19,10,5,c.dark);r(13,11,7,5,worker?c.sand:c.sand);r(9,12,3,6,highlight);
 plate(3,12,9,9,c.ink);r(4,13,7,6,suit);r(4,13,5,2,highlight);plate(24,13,6,9,c.ink);r(25,14,4,5,suit);
 // Reinforced pauldrons, collar, belt and scarred plates give weight without growing the unit.
 r(3,12,9,2,c.steel);r(4,15,2,3,c.steelLight);r(24,13,6,2,c.steel);r(13,16,10,2,c.dark);r(16,19,3,2,c.steelLight);r(7,26,2,2,c.steel);r(21,26,2,2,c.steel);r(10,12,2,1,c.cream);
 // Helmet and mask closely follow the supplied reference.
 poly([[12,1],[21,1],[21,3],[25,3],[25,12],[20,14],[11,12],[9,8],[9,4],[12,4]],c.ink);
 const helmet=worker||medic?c.sand:c.armor;
 r(12,2,9,3,worker||medic?c.cream:c.light);r(10,5,14,5,helmet);r(13,3,10,6,helmet);r(13,9,13,5,c.ink);r(14,10,11,3,c.dark);
 r(11,7,3,1,c.steelLight);r(21,5,2,1,c.dark);r(24,8,2,5,c.steel);
 if(worker){r(16,10,3,2,c.hot);r(22,10,2,2,c.hot);}else r(16,10,8,2,c.glow);
 if(demon){poly([[10,6],[7,0],[11,2],[14,6]],c.sand);poly([[21,5],[26,0],[25,6]],c.sand);r(5,14,2,3,c.sand);r(26,16,2,3,c.sand);r(16,15,4,2,c.sand);}
 if(medic){r(17,4,2,4,'#526c44');r(16,5,4,2,'#526c44');}
 const recoil=(e.cool||0)>(grenadier?1.83:.84)?1:0;
 if(worker){
  if(state.working){plate(23,16,8,4,c.steel);r(29,12,3,7,c.steelLight);r(29,11,5,3,c.steel);r(21,18,5,4,c.ink);if(Math.floor(time*7)%2){r(33,9,2,2,c.hot);r(32,14,2,1,c.cream);}}
  else if(e.carry){plate(9,17,22,10,c.steel);r(11,19,18,5,c.steelLight);r(13,20,3,3,resources[e.carry.resource]||c.sand);r(24,20,3,3,resources[e.carry.resource]||c.sand);r(8,18,5,4,c.ink);r(28,18,4,4,c.ink);}
  else{r(3,19+step,5,5,c.ink);r(25,20-step,5,4,c.ink);}
 }else if(medic){plate(3,22,10,8,c.sand);r(7,23,2,6,'#427640');r(5,25,6,2,'#427640');plate(20,17,12,5,c.steel);r(29,18,3,2,c.glow);r(22,21,5,3,c.sand);}
 else if(assault){const swing=recoil*3;line(25,22,31-swing,5,c.ink,4);line(26,20,31-swing,4,c.steelLight,2);line(27,18,31-swing,5,c.sand);r(22,21,7,3,c.ink);r(22,20,4,2,c.sand);r(5,19,5,4,c.sand);}
 else{const gx=12-recoil;plate(gx,17,23,7,c.ink);r(gx+2,18,18,3,c.steel);r(gx+4,18,11,1,c.steelLight);r(gx+8,20,5,5,c.dark);r(gx+20,19,4,3,c.dark);r(gx+10,19,2,2,c.glow);r(9,21,5,3,c.sand);r(25-recoil,23,4,2,c.sand);if(grenadier){plate(17,22,10,8,c.ink);r(19,23,6,5,c.steel);r(20,23,4,1,c.hot);r(20,26,4,1,c.hot);}}
 if(back){plate(11,9,12,11,c.pack);r(12,10,10,3,worker?'#ae7d29':c.sand);r(13,15,8,4,c.pack);}
 ctx.restore();
}
function road(ctx,x,y,size=24){if(style==='classic')return legacy.road(ctx,x,y,size);const {r}=painter(ctx,x,y,size/24);r(0,0,24,24,'#343c3d');for(const [x,y,w]of [[2,3,5],[13,12,7],[6,20,4]])r(x,y,w,2,'#3c4444');r(18,2,2,2,'#293336');}
function building(ctx,e,x,y,time=0,state={}){
 if(style==='classic')return legacy.building(ctx,e,x,y,time,state);
 const width=(e.width||e.size||2)*24,height=(e.height||e.size||2)*24,c=palettes[e.team===1?1:0],signal=c.glow,ox=Math.round(x-width/2),oy=Math.round(y-height/2);
 ctx.save();ctx.beginPath();ctx.rect(ox,oy,width,height);ctx.clip();
 const {r,plate,line,poly}=pixelPainter(ctx,ox,oy,2),w=width/2,h=height/2;
 const detail=painter(ctx,ox,oy);
 // Disconnected utility paving blends into the terrain rather than framing the lot.
 r(1,h-7,w-5,4,'#444943');r(w-9,4,7,5,'#414840');r(2,h-6,8,1,'#737565');r(w-8,5,6,1,'#6d7060');
 r(1,h-3,5,2,'#323b33');r(w-5,h-9,4,6,'#353e37');
 const block=(x,y,bw,bh,color=c.armor)=>{plate(x,y,bw,bh,c.ink);r(x+1,y+1,bw-2,bh-3,color);r(x+2,y+1,bw-4,2,c.light);r(x+1,y+bh-4,bw-2,3,c.shade);r(x+2,y+bh-3,bw-4,1,c.dark);detail.r(x*2+3,y*2+2,bw*2-6,1,c.steelLight);detail.r(x*2+2,(y+bh)*2-4,bw*2-4,1,c.ink);for(const px of [x*2+2,(x+bw)*2-3]){detail.r(px,y*2+3,1,1,c.sand);detail.r(px,(y+bh)*2-3,1,1,c.steelLight);}};
 const door=(x,y,bw,bh)=>{plate(x,y,bw,bh,c.dark);r(x+1,y+1,bw-2,bh-2,c.steel);r(x+2,y+1,bw-4,1,c.steelLight);for(let sy=y*2+5;sy<(y+bh)*2-3;sy+=4)detail.r(x*2+3,sy,bw*2-6,1,c.dark);};
 const vent=(x,y)=>{r(x,y,7,4,c.dark);r(x+1,y+1,5,1,c.steelLight);r(x+1,y+3,5,1,c.steel);};
 if(e.construction>0){const level=Math.max(2,Math.floor((h-8)*(state.progress||0)));r(4,h-6,w-8,2,c.steel);r(5,h-6-level,w-10,level,c.shade);for(let i=0;i<3;i++)r(4+i*Math.floor((w-9)/2),4,1,h-9,c.pack);line(4,5,w-4,h-8,c.sand);line(w-5,5,5,h-8,c.sand);if(state.working){r(w-6,h-10,2,2,c.hot);r(w-8,h-12,1,2,c.cream);}ctx.restore();return;}
 const type=e.type;
 if(type==='field'){r(2,3,w-4,h-7,'#403a28');for(let i=0;i<4;i++){r(3,5+i*4,w-6,2,'#67613b');if(e.fieldStage!=='sowing'&&(e.crop||0)>i){for(let j=0;j<4;j++)r(4+j*4,4+i*4,2,3,e.fieldStage==='growing'?'#73894b':'#c1be68');}}r(1,h-5,w-2,2,c.steel);}
 else if(type==='base'){block(6,12,w-12,h-18);block(10,5,w-20,14);r(13,8,w-26,5,c.dark);r(15,9,w-30,2,signal);block(2,h-19,11,13);block(w-13,h-19,11,13);door(w/2-5,h-19,10,13);r(5,h-16,5,3,signal);r(w-10,h-16,5,3,signal);vent(8,21);vent(w-15,21);r(w-12,1,1,6,c.steelLight);r(w-13,0,3,2,signal);}
 else if(type==='house'){block(4,7,w-8,h-14);block(7,4,w-14,6);for(let i=0;i<3;i++){door(7+i*7,11,5,10);r(8+i*7,12,3,5,c.sand);}r(7,25,w-14,2,c.steel);r(3,h-6,7,3,c.pack);}
 else if(type==='warehouse'){block(3,9,w-6,h-15,c.steel);r(4,10,w-8,3,c.steelLight);door(8,15,w-16,h-21);r(10,17,w-20,1,c.sand);r(10,21,w-20,1,c.steelLight);block(1,h-9,7,6,c.pack);block(w-9,h-9,7,6,c.pack);}
 else if(type==='farm'){block(3,7,w-6,h-14);for(let i=0;i<3;i++){plate(6+i*8,10,6,15,c.dark);r(7+i*8,12,4,10,'#9ba755');r(7+i*8,12,1,8,c.cream);}r(5,5,w-10,3,c.steel);r(w-8,h-8,5,3,c.pack);}
 else if(type==='ironmine'||type==='goldmine'){block(2,h-10,w-4,7,c.steel);poly([[4,h-11],[8,4],[w-8,4],[w-4,h-11]],c.ink);line(6,h-11,9,5,c.steelLight,2);line(w-6,h-11,w-9,5,c.steel,2);r(10,5,4,h-14,c.steel);r(10,h-11,4,4,type==='ironmine'?c.hot:resources.crystals);r(5,2,w-10,3,c.sand);}
 else if(['gasstation','sulfurstation'].includes(type)){for(const dx of [3,13]){block(dx,4,8,15,c.steel);r(dx+2,7,4,8,resources[type==='gasstation'?'gas':'sulfur']);r(dx+2,7,1,6,c.cream);}r(6,2,12,2,c.steelLight);r(9,18,6,4,c.dark);r(10,19,4,2,signal);}
 else if(type==='factory'||type==='chemical'){block(5,11,w-10,h-17);block(7,5,w-19,12,c.steel);vent(10,8);vent(20,8);block(12,16,13,5,c.steel);r(14,17,9,2,type==='chemical'?resources.gas:c.steelLight);door(12,h-22,w-25,15);r(14,h-19,w-29,3,type==='chemical'?resources.medicines:c.hot);block(w-12,3,6,h-12,c.steel);r(w-11,4,4,3,c.sand);r(w-16,h-13,3,7,signal);block(1,h-8,7,5,c.pack);if(type==='chemical'){r(8,16,5,9,resources.gas);r(9,17,1,6,c.cream);}}
 else if(['weaponshop','ammoshop','armorshop','explosiveshop','medicineshop'].includes(type)){block(3,7,w-6,h-13);block(4,3,7,6,c.steel);door(6,12,w-12,7);const resource={weaponshop:'weapons',ammoshop:'ammo',armorshop:'armor',explosiveshop:'explosives',medicineshop:'medicines'}[type];r(8,13,w-16,3,resources[resource]);r(w-8,8,3,2,signal);r(1,h-5,5,2,c.pack);}
 else if(type==='guild'){block(4,8,w-8,h-14);block(8,4,w-16,7);r(11,6,w-22,3,c.sand);door(w/2-4,15,8,h-20);r(6,13,5,6,c.sand);r(w-11,13,5,6,c.sand);r(3,h-7,5,3,c.pack);}
 else if(type==='barracks'){block(4,11,w-8,h-17);block(8,5,w-16,11);r(12,8,w-24,3,c.sand);door(9,20,12,h-25);door(w-21,20,12,h-25);r(w/2-1,20,2,7,signal);r(3,h-7,8,2,c.steel);r(w-11,h-7,8,2,c.steel);}
 else if(type==='tower'){block(5,12,w-10,h-16,c.steel);block(2,5,w-4,10);r(6,7,w-12,3,c.dark);r(w/2-2,1,4,9,c.ink);r(w/2-1,1,2,8,c.steelLight);r(5,16,3,2,signal);}
 // Native-grid industrial detail. Large structural forms remain legible at normal zoom.
 const d=detail.r,edge=detail.line;
 const grille=(x,y,gw,gh)=>{detail.plate(x,y,gw,gh,c.dark);for(let i=2;i<gh-1;i+=3)d(x+2,y+i,gw-4,1,c.steelLight);};
 const pipe=(x,y,tx,ty)=>{edge(x+1,y+1,tx+1,ty+1,c.ink,3);edge(x,y,tx,ty,c.steel,2);edge(x,y,tx,ty,c.steelLight);};
 const crate=(x,y)=>{detail.plate(x,y,10,8,c.pack);d(x+2,y+2,6,1,c.sand);d(x+4,y+1,1,6,c.dark);};
 const hazard=(x,y,hw)=>{d(x,y,hw,3,c.ink);for(let i=0;i<hw-2;i+=5)d(x+i,y,2,3,c.hot);};
 const roof=(x,y,rw,rh)=>{for(let i=8;i<rw-3;i+=10){d(x+i,y,1,rh,c.shade);d(x+i+1,y+1,1,rh-2,c.dark);}d(x+3,y+rh-2,rw-6,1,c.ink);};
 if(type!=='field'){
  // Local paving, edge chips and cable ends stay inside the exact building footprint.
  d(4,height-11,9,1,'#7b7b65');d(width-14,12,7,1,'#6b7364');d(width-9,height-15,4,2,c.dark);
  if(width>=72){crate(width-13,height-13);d(4,height-17,10,1,c.dark);}
 }
 if(type==='base'){
  roof(22,12,width-44,20);grille(16,37,13,8);grille(width-29,37,13,8);
  detail.plate(width/2-10,19,20,11,c.dark);d(width/2-7,21,14,2,c.glow);d(width/2-6,25,6,1,c.steelLight);
  pipe(12,30,12,48);pipe(width-13,28,width-13,48);hazard(width/2-11,height-12,22);
  for(let i=0;i<3;i++)d(width/2-9+i*7,height-8,5,1,c.steelLight);
  detail.plate(5,height-37,5,6,c.steel);d(6,height-36,2,1,c.hot);
 }else if(type==='house'){
  roof(12,10,width-24,10);grille(12,43,14,7);pipe(width-13,19,width-13,48);
  for(let i=0;i<3;i++){d(17+i*14,35,4,2,c.dark);d(17+i*14,28,1,5,c.cream);}d(18,height-15,width-36,1,c.steelLight);
 }else if(type==='warehouse'){
  roof(10,20,width-20,11);grille(9,31,9,9);pipe(width-10,29,width-10,48);hazard(18,height-13,width-36);
  crate(3,height-15);crate(width-14,height-13);d(21,height-9,width-42,1,c.steelLight);
 }else if(type==='farm'){
  pipe(7,16,7,48);pipe(width-8,16,width-8,48);grille(15,10,16,5);
  for(let i=0;i<3;i++){const px=14+i*16;d(px+1,25,6,1,c.cream);d(px+2,42,5,2,'#546d3e');d(px,49,8,2,c.steel);}
  detail.plate(4,height-18,6,8,c.steel);d(6,height-16,2,2,c.hot);
 }else if(type==='ironmine'||type==='goldmine'){
  grille(7,height-16,9,7);grille(width-16,height-16,9,7);hazard(12,5,width-24);
  pipe(9,12,9,height-22);d(21,16,6,3,c.dark);d(22,17,4,1,c.steelLight);
  for(let i=0;i<3;i++)d(21,23+i*4,6,1,c.ink);detail.plate(width-11,12,5,9,c.steel);d(width-10,14,2,2,c.hot);
 }else if(['gasstation','sulfurstation'].includes(type)){
  for(const px of [6,26]){d(px+3,14,10,1,c.cream);d(px+2,28,12,2,c.steel);d(px+5,7,7,2,c.dark);}
  pipe(18,22,26,22);pipe(16,34,16,42);grille(18,36,12,6);hazard(4,height-7,12);
 }else if(type==='factory'||type==='chemical'){
  roof(17,12,width-42,17);grille(18,16,12,8);grille(34,16,12,8);pipe(9,35,9,64);
  pipe(width-29,29,width-14,29);d(width-21,29,4,3,c.ink);d(width-20,29,2,1,c.hot);
  detail.plate(width-25,34,10,18,c.steel);d(width-23,37,6,9,type==='chemical'?resources.gas:c.shade);d(width-23,37,1,7,c.cream);
  grille(15,47,7,14);hazard(25,height-17,width-50);crate(4,height-17);
  for(let i=0;i<3;i++)d(28+i*10,height-12,6,1,c.steelLight);
  d(width-22,7,8,1,c.cream);d(width-21,14,6,1,c.ink);d(width-21,19,6,1,c.ink);
  if(type==='chemical'){pipe(21,28,21,53);d(27,43,5,8,resources.medicines);d(28,44,1,5,c.cream);}
  else{detail.plate(27,36,21,10,c.dark);d(30,39,14,2,c.steelLight);d(34,42,7,1,c.hot);}
 }else if(['weaponshop','ammoshop','armorshop','explosiveshop','medicineshop'].includes(type)){
  roof(9,15,width-18,8);grille(8,7,9,5);pipe(width-9,17,width-9,34);hazard(13,height-11,width-26);
  detail.plate(7,29,5,7,c.steel);d(8,30,2,2,c.hot);
  if(type==='weaponshop'){d(15,28,16,2,c.steelLight);d(23,30,3,4,c.ink);}
  if(type==='ammoshop'){for(let i=0;i<3;i++)d(16+i*5,27,2,6,c.hot);}
  if(type==='armorshop'){detail.poly([[19,26],[27,26],[29,31],[26,34],[20,34],[17,31]],resources.armor);d(21,27,1,5,c.cream);}
  if(type==='explosiveshop'){d(17,28,13,5,resources.explosives);d(22,28,2,5,c.ink);}
  if(type==='medicineshop'){d(21,26,3,8,resources.medicines);d(18,29,9,2,resources.medicines);}
 }else if(type==='guild'){
  roof(17,10,width-34,9);grille(10,44,10,6);pipe(width-12,26,width-12,47);detail.plate(width/2-4,14,8,6,c.dark);d(width/2-2,16,4,2,c.hot);
 }else if(type==='barracks'){
  roof(18,12,width-36,17);grille(19,17,13,7);grille(width-32,17,13,7);pipe(12,30,12,62);pipe(width-13,30,width-13,62);
  detail.poly([[width/2,15],[width/2+6,19],[width/2+4,27],[width/2,30],[width/2-4,27],[width/2-6,19]],c.sand);d(width/2-2,20,4,5,c.dark);
  hazard(19,height-14,20);hazard(width-39,height-14,20);crate(3,height-15);crate(width-14,height-15);
 }else if(type==='tower'){
  grille(13,24,width-26,6);pipe(8,22,8,36);d(width/2-2,4,4,3,c.ink);d(width/2-1,4,2,2,c.steelLight);hazard(14,height-10,width-28);
 }
 if(type!=='field'){
  // Sparse wear follows panel edges; no random noisy texture over the silhouette.
  d(9,height-19,3,1,c.steelLight);d(width-17,24,2,1,c.steelLight);d(width-8,height-9,2,1,c.pack);
 }
 if(e.team===1&&type!=='field'){poly([[3,11],[2,4],[5,7],[7,11]],c.sand);poly([[w-7,11],[w-2,4],[w-3,11]],c.sand);}
 if(state.operating){const pulse=Math.floor(time*4)%3;r(w-7,Math.min(h-10,14)+pulse,2,1,signal);if(type==='ironmine')r(10,1-Math.floor(time*2)%2,2,1,'#b1ac90');}
 ctx.restore();
}
function deposit(ctx,e,x,y,time=0){
 if(style==='classic')return legacy.deposit(ctx,e,x,y,time);
 const {r,plate,poly}=painter(ctx,Math.round(x)-12,Math.round(y)-14),color=resources[e.resource]||resources.crystals;
 if(e.amount<=0){r(4,17,17,3,'#626357');r(7,16,4,1,'#8d8e77');return;}
 if(e.resource==='metal'||e.resource==='crystals'||e.resource==='sulfur'){
  const crystal=e.resource==='crystals',dark=e.resource==='metal'?'#303e46':crystal?'#553954':'#6d602c';
  poly([[1,21],[3,12],[8,12],[10,3],[16,3],[18,13],[22,15],[23,21]],'#1c2528');
  poly([[3,19],[5,13],[10,13],[11,5],[15,5],[17,14],[21,16],[21,19]],dark);
  r(11,6,3,10,color);r(5,14,3,4,color);r(17,16,3,3,color);r(11,5,2,5,crystal?'#e5c4d8':e.resource==='sulfur'?'#f4df89':'#c3d2d2');
 }else if(e.resource==='gas'&&e.type==='deposit'){poly([[1,20],[4,13],[17,12],[23,18],[21,22]],'#2d3c39');r(6,16,12,4,'#172524');r(8,15,8,2,color);const shift=Math.floor(time*2)%3;r(9,7-shift,5,5,'#78b8a3');r(12,3-shift,4,4,'#a2d2b8');}
 else if(e.resource==='gas'){plate(6,4,13,19,'#394c49');r(8,7,9,11,color);r(8,7,2,8,'#c0ddd0');r(9,2,7,3,'#919e8d');}
 else if(e.resource==='weapons'){plate(2,12,21,6,'#24292e');r(4,13,16,2,'#6f737d');r(11,17,4,5,'#24292e');r(17,14,2,2,'#a7ee15');}
 else if(e.resource==='armor'){poly([[3,8],[8,5],[10,9],[15,9],[17,5],[22,8],[19,15],[19,22],[6,22],[6,15]],'#20292f');r(8,10,9,11,color);r(9,11,2,6,'#d1d9d7');}
 else if(e.resource==='ammo'){plate(3,8,19,14,'#3d443a');for(let i=0;i<3;i++){r(6+i*5,10,3,9,color);r(6+i*5,8,3,3,'#eed098');}}
 else if(e.resource==='medicines'){plate(3,8,19,14,color);r(10,10,4,10,'#467b45');r(7,13,10,4,'#467b45');r(9,5,7,3,'#5c6e60');}
 else if(e.resource==='explosives'){plate(3,9,19,13,'#5b3930');r(5,11,15,9,color);r(11,11,3,9,'#9d4f38');r(10,5,4,5,'#d4b15f');}
 else{plate(5,6,15,17,color);r(7,8,11,3,'#dfd9ad');r(9,13,7,7,e.resource==='money'?'#8b7842':'#697f3a');}
}
function fallen(ctx,e,x,y,age){if(style==='classic')return legacy.fallen(ctx,e,x,y,age);if(age<.2)return unit(ctx,{...e,moving:false},x,y,0);const c=palettes[e.team===1?1:0],{r,plate}=painter(ctx,x-14,y-5);plate(3,3,10,7,c.sand);plate(11,2,14,8,e.type==='worker'?'#be912d':c.armor);r(18,8,12,4,c.dark);}
function menuScene(ctx,width,height){if(style==='classic')return legacy.menuScene(ctx,width,height);ctx.fillStyle='#303b36';ctx.fillRect(0,0,width,height);for(let x=0;x<width;x+=24)road(ctx,x,170,24);building(ctx,{type:'base',team:0,size:3},105,100);building(ctx,{type:'factory',team:0,size:4},255,105);building(ctx,{type:'barracks',team:1,size:4},width-100,105);for(const [i,type]of ['worker','soldier','assault','medic','grenadier'].entries())unit(ctx,{type,team:0,facingX:1},120+i*38,230+i%2*8);for(let i=0;i<3;i++)unit(ctx,{type:'soldier',team:1,facingX:-1},width-145+i*36,230);}
const api={palettes,resources,painter,pixelPainter,UNIT_SCALE,road,unit,building,deposit,fallen,menuScene,setStyle,getStyle};if(typeof module!=='undefined')module.exports=api;else root.RTSArt=api;
})(typeof window!=='undefined'?window:globalThis);
