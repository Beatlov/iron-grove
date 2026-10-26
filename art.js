/* HELIOS H31: brutal industrial art on a unified native pixel grid, with the complete H9 renderer available for comparison. */
(function(root){
'use strict';
const legacy=typeof module!=='undefined'?require('./art-legacy.js'):root.RTSArtLegacy;
const {painter}=legacy,resources={...legacy.resources,minerals:'#b79d70',herbs:'#84b969',mycelium:'#d0b5d4',psiomycin:'#9b87dd'};
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
// Shared square-grid RTS camera: depth goes 2 pixels right / 1 pixel up.
// No world-grid shear or bitmap resampling; every face is rasterized on the native grid.
const perspective=Object.freeze({depthX:2,depthY:-1,light:'upper-left'});
function prism(p,x,y,w,h,front,top,side,ink='#101416'){
 x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);
 const dx=Math.max(2,Math.min(6,Math.floor(w/6)*2,Math.floor(h/3)*2)),dy=dx/2;
 p.poly([[x,y+dy],[x+dx,y],[x+w-1,y],[x+w-1,y+h-dy-1],[x+w-dx-1,y+h-1],[x,y+h-1]],ink);
 p.poly([[x+1,y+dy+1],[x+dx,y+1],[x+w-3,y+1],[x+w-dx-2,y+dy+1]],top);
 p.r(x+1,y+dy+2,Math.max(1,w-dx-2),Math.max(1,h-dy-4),front);
 p.poly([[x+w-dx,y+dy+1],[x+w-2,y+2],[x+w-2,y+h-dy-2],[x+w-dx,y+h-3]],side);
 p.line(x+1,y+dy+1,x+w-dx-2,y+dy+1,top);
}
function yard(p,w,h,type,c){
 const slab='#65685b',light='#7d7f6c',seam='#4b5149';
 // Broad poured concrete under the structure, interrupted perimeter and exposed corners.
 p.poly([[8,3],[w-15,3],[w-15,7],[w-4,7],[w-4,h-17],[w-7,h-17],[w-7,h-5],[w/2+8,h-5],[w/2+8,h-2],[w/2-8,h-2],[w/2-8,h-5],[4,h-5],[4,15],[8,15]],slab);
 p.line(9,4,w-17,4,light);p.line(5,16,5,h-8,light);p.r(w/2-7,h-6,14,4,'#747766');
 for(let x=20;x<w-8;x+=18)p.line(x,8,x,h-7,seam);
 for(let y=22;y<h-7;y+=18)p.line(6,y,w-8,y,seam);
 p.r(6,h-8,4,1,light);p.r(w-11,10,3,1,light);p.r(8,h-6,2,1,seam);
 if(type==='field')return;
 // Short fence sections leave entrances and middle side attachment sockets open.
 const post=(x,y)=>{prism(p,x,y,4,7,c.steel,c.steelLight,c.dark,c.ink);p.r(x+1,y+2,1,2,c.sand);};
 const fence=(x,y,len)=>{p.r(x,y+3,len,4,c.dark);p.r(x,y+3,len,1,c.steelLight);p.r(x,y+6,len,1,c.steel);for(let i=4;i<len-2;i+=5)p.r(x+i,y+4,1,2,c.steel);post(x,y);post(x+len-4,y);};
 fence(7,3,w>=72?18:10);if(w>=72){fence(w-24,h-10,17);p.r(3,19,2,10,c.dark);p.r(3,19,1,10,c.steelLight);post(2,17);post(2,27);}
 post(3,h-15);post(w/2-11,h-9);post(w/2+8,h-9);
 p.r(w/2-10,h-8,2,2,c.hot);p.r(w/2+9,h-8,2,2,c.hot);
 // Drain and service locker are functional edge detail, not a continuous rectangular frame.
 p.r(w-8,18,3,9,c.dark);for(let y=19;y<26;y+=3)p.r(w-8,y,2,1,c.steelLight);
 if(w>=72){prism(p,w-17,8,9,11,c.steel,c.steelLight,c.dark,c.ink);p.r(w-14,13,3,2,c.glow);}
}
// Appearance only: never advance the simulation RNG or alter terrain/collision.
const surfaceSchemes={planet:['#444d43','#5b4940','#5c5541','#514a59'],moon:['#4b5567'],asteroid:['#55483c'],wreck:['#354d53']};
const surfacePalettes=new Map();
function surfacePaletteAt(kind,index){
 const schemes=surfaceSchemes[kind]||surfaceSchemes.planet,key=kind+':'+index;
 if(surfacePalettes.has(key))return surfacePalettes.get(key);
 const base=schemes[index],shade=offset=>'#'+base.slice(1).match(/../g).map(v=>Math.max(0,Math.min(255,parseInt(v,16)+offset)).toString(16).padStart(2,'0')).join('');
 const theme=Object.freeze({tiles:Object.freeze([base,shade(2),shade(-2)]),background:shade(-28),dark:shade(-17),speck:shade(27),slab:shade(16),edge:shade(-23),light:shade(34),mini:shade(-8),orb:shade(49)});
 surfacePalettes.set(key,theme);return theme;
}
function surfacePalette(kind='planet',seed=0){
 let mixed=seed>>>0;mixed=Math.imul(mixed^(mixed>>>16),0x7feb352d);mixed=Math.imul(mixed^(mixed>>>15),0x846ca68b);mixed=(mixed^(mixed>>>16))>>>0;
 return surfacePaletteAt(kind,mixed%(surfaceSchemes[kind]||surfaceSchemes.planet).length);
}
let planetColorSeed=null,planetColorOrder=[];
function planetPalette(seed,id){
 seed=seed>>>0;if(planetColorSeed!==seed){
  // Shuffle a balanced bag with a private PRNG; world generation and combat RNG stay untouched.
  const order=Array.from({length:12},(_,i)=>i%4);let random=seed^0x9e3779b9;
  for(let i=order.length-1;i>0;i--){random=(random+0x6d2b79f5)|0;let n=Math.imul(random^(random>>>15),1|random);n=(n+Math.imul(n^(n>>>7),61|n))^n;const j=Math.floor(((n^(n>>>14))>>>0)/4294967296*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  planetColorSeed=seed;planetColorOrder=order;
 }
 return surfacePaletteAt('planet',planetColorOrder[id%planetColorOrder.length]);
}
const UNIT_SCALE=41/48;
let style='refined';
function setStyle(value){if(!['refined','classic'].includes(value))return false;style=value;return true;}
const getStyle=()=>style;
function drone(ctx,e,x,y,time=0){
 const c=palettes[e.team===1?1:0],{r,plate,poly}=pixelPainter(ctx,x-9,y-10,1),face=e.facingX<0?-1:1,roll=e.moving?Math.floor((e.walkDistance||0)*7)%3:0;
 // Low tracked chassis: one native pixel grid, smaller than the resident silhouette.
 r(1,10,17,2,'#26302b');plate(0,5,18,7,c.ink);r(1,6,16,4,c.steel);r(2,6,4,1,c.steelLight);r(12,6,4,1,c.steelLight);
 for(const offset of [0,12]){r(offset,6,6,5,c.ink);r(offset+1,7,4,3,c.dark);for(let i=0;i<3;i++)r(offset+1+(i+roll)%4,9,1,1,c.steelLight);}
 poly([[3,3],[5,1],[12,1],[15,4],[14,8],[4,8]],c.ink);r(5,2,7,2,c.light);r(4,4,10,3,c.armor);r(5,4,8,1,c.sand);r(face>0?12:4,5,2,2,c.glow);r(8,0,2,2,c.dark);r(8,0,1,1,c.hot);
 if(e.carry){plate(5,2,7,5,c.ink);r(6,3,5,3,resources[e.carry.resource]||c.sand);r(7,3,1,3,c.cream);r(11,2,1,4,c.steelLight);}else{r(7,3,5,2,c.dark);r(8,3,3,1,c.steelLight);}
}
function resident(ctx,e,x,y,time=0,state={}){
 const c=palettes[e.team===1?1:0],phase=Math.floor((e.walkDistance||0)*6)%4,step=e.moving?[0,1,0,-1][phase]:0,face=e.facingX<-.15?-1:1;
 ctx.save();if(face<0){ctx.translate(Math.round(x)*2,0);ctx.scale(-1,1);}const {r,plate,line}=pixelPainter(ctx,x-8,y-20,1),suit=e.team===1?'#936130':'#be912d';
 r(4,20,11,1,'#14171955');
 // Compact industrial worker: reinforced boots, knee pads and a heavy safety vest.
 for(const [lx,offset]of [[6,step],[10,-step]]){r(lx,14+Math.max(0,offset),2,6-Math.abs(offset),c.ink);r(lx,14+Math.max(0,offset),2,3,suit);r(lx,16+Math.max(0,offset),2,1,c.steelLight);r(lx-1,19+Math.max(0,offset),4,2,c.ink);r(lx-1,19+Math.max(0,offset),3,1,c.steel);}
 plate(3,8,4,7,c.pack);r(4,9,2,4,c.steel);r(4,9,1,3,c.sand);
 plate(6,8,7,7,suit);r(7,9,5,3,c.steel);r(7,9,4,1,c.steelLight);r(8,10,3,2,c.dark);r(7,13,6,2,c.dark);r(9,13,2,1,c.sand);
 // Broad collar and angular pauldrons retain the small human silhouette, not marine armor.
 r(6,7,7,2,c.ink);r(7,8,5,1,c.sand);plate(4,8,4,4,c.steel);r(5,9,2,1,c.sand);plate(11,8,4,4,c.steel);r(12,9,2,1,c.sand);
 plate(5,1,8,7,c.ink);r(6,2,6,2,c.sand);r(7,2,1,2,c.steel);r(5,4,8,1,c.steelLight);
 r(7,5,5,3,c.sand);r(7,5,5,1,c.dark);r(8,5,3,1,c.hot);r(8,6,4,1,c.cream);r(8,7,4,1,c.steel);r(10,6,2,2,c.dark);
 if(e.facingY<-.45){r(7,5,5,3,c.sand);r(7,5,1,2,c.steel);r(8,9,3,4,c.pack);r(9,10,1,2,c.sand);}
 if(e.carry){plate(5,11,10,6,c.steel);r(6,12,8,3,resources[e.carry.resource]||c.sand);r(8,12,1,3,c.cream);r(4,12,2,3,c.dark);r(14,12,2,3,c.dark);r(4,12,2,1,c.sand);r(14,12,2,1,c.sand);}
 else if(state.working){const swing=Math.floor(time*6)%2;r(4,9,2,4,suit);line(11,10,14,12-swing,c.ink,2);r(13,11-swing,2,2,c.dark);r(13,11-swing,1,1,c.sand);line(15,8-swing,15,16-swing,c.steelLight);r(13,7-swing,5,2,c.steel);if(e.building&&swing)r(17,15,1,1,c.hot);}
 else{r(4,10+step,2,4,suit);r(4,13+step,2,2,c.dark);r(4,13+step,1,1,c.sand);r(12,10-step,2,4,suit);r(12,13-step,2,2,c.dark);r(12,13-step,1,1,c.sand);}
 ctx.restore();
}
function unit(ctx,e,x,y,time=0,state={}){
 if(e.type==='drone')return drone(ctx,e,x,y,time);if(e.type==='worker'&&style!=='classic')return resident(ctx,e,x,y,time,state);
 if(style==='classic'&&!['psyker','xeno','robot','demon','pirate'].includes(e.type)&&(e.rank||1)===1)return legacy.unit(ctx,e,x,y,time,state);
 const demon=e.team===1||e.type==='demon',c={...palettes[demon?1:0]},psyker=e.type==='psyker'||e.type==='demon',worker=e.type==='worker',medic=e.type==='medic',assault=e.type==='assault',grenadier=e.type==='grenadier';
 if(psyker){c.glow='#bca0da';c.armor=demon?'#743a43':'#4b4565';c.light='#827695';}
 if(e.type==='pirate'){c.armor='#765438';c.light='#aa8658';c.glow='#d89f49';}
 if(e.type==='robot'){c.armor='#58646a';c.light='#8b9590';c.sand='#535b5d';c.glow='#dc785a';}
 const phase=Math.floor((e.walkDistance||0)*5)%4,step=e.moving?[0,2,0,-2][phase]:0,face=e.facingX<-.15?-1:1,back=e.facingY<-.45;
 ctx.save();if(face<0){ctx.translate(Math.round(x)*2,0);ctx.scale(-1,1);}
 const {r,plate,poly,line}=pixelPainter(ctx,x-14*UNIT_SCALE,y-25*UNIT_SCALE,UNIT_SCALE);
 if(e.type==='xeno'){
  r(3,30,29,2,'#14171955');for(const [lx,sy]of [[5,step],[24,-step]]){line(lx,18,lx-3,26+sy,'#101416',4);line(lx-3,26+sy,lx+2,31,'#8c8960',2);line(lx,20,lx+6,27-sy,'#444b3c',3);}
  poly([[4,10],[9,5],[22,5],[28,12],[26,23],[15,27],[5,22]],'#171d1a');plate(8,12,16,10,'#655c52');r(10,13,12,3,'#93916c');r(12,18,8,2,'#393e35');poly([[10,2],[22,2],[29,8],[25,16],[12,15],[7,9]],'#4b634b');r(13,3,9,3,'#7c8b62');r(23,8,5,2,'#d9a75e');poly([[25,12],[33,15],[26,19]],'#c8ba91');line(6,16,1,12,'#b7a880',3);ctx.restore();return;
 }
 const suit=worker?(demon?'#936130':'#be912d'):medic?c.sand:c.armor,highlight=worker?'#d9b250':medic?c.cream:c.light;
 r(5,31,23,2,'#14171955');
 // Large, simple leg shapes; every phase shares the same foot anchor.
 for(const [lx,s]of [[7,step],[20,-step]]){plate(lx,20+Math.max(0,s),7,11-Math.abs(s),c.ink);r(lx+1,21+Math.max(0,s),5,6-Math.abs(s),suit);if(!worker)r(lx+1,23+Math.max(0,s),4,3,c.sand);r(lx-1,28+Math.max(0,s),9,4,c.ink);r(lx,28+Math.max(0,s),7,1,c.steel);}
 // Backpack, antenna and solid chest blocks, deliberately no fine surface noise.
 prism({r,poly,line},3,7,9,15,c.pack,c.sand,c.dark,c.ink);r(4,8,3,8,worker?'#b07825':c.pack);r(7,3,3,7,c.ink);r(8,3,1,3,worker?c.hot:c.glow);
 plate(8,10,18,14,c.ink);r(9,11,16,11,suit);r(12,19,10,5,c.dark);r(13,11,7,5,worker?c.sand:c.sand);r(9,12,3,6,highlight);
 plate(3,12,9,9,c.ink);r(4,13,7,6,suit);r(4,13,5,2,highlight);plate(24,13,6,9,c.ink);r(25,14,4,5,suit);
 // Reinforced pauldrons, collar, belt and scarred plates give weight without growing the unit.
 poly([[3,14],[7,12],[12,12],[9,14]],c.steelLight);r(3,14,9,1,c.steel);r(4,15,2,3,c.steelLight);r(24,13,6,2,c.steel);r(13,16,10,2,c.dark);r(16,19,3,2,c.steelLight);r(7,26,2,2,c.steel);r(21,26,2,2,c.steel);r(10,12,2,1,c.cream);
 // Helmet and mask closely follow the supplied reference.
 poly([[12,1],[21,1],[21,3],[25,3],[25,12],[20,14],[11,12],[9,8],[9,4],[12,4]],c.ink);
 const helmet=worker||medic?c.sand:c.armor;
 r(12,2,9,3,worker||medic?c.cream:c.light);r(10,5,14,5,helmet);r(13,3,10,6,helmet);r(13,9,13,5,c.ink);r(14,10,11,3,c.dark);
 r(11,7,3,1,c.steelLight);r(21,5,2,1,c.dark);r(24,8,2,5,c.steel);
 if(worker){r(16,10,3,2,c.hot);r(22,10,2,2,c.hot);}else r(16,10,8,2,c.glow);
 poly([[11,5],[15,3],[22,3],[24,5]],worker||medic?c.cream:c.light);r(24,6,1,2,c.shade);
 if(demon){poly([[10,6],[7,0],[11,2],[14,6]],c.sand);poly([[21,5],[26,0],[25,6]],c.sand);r(5,14,2,3,c.sand);r(26,16,2,3,c.sand);r(16,15,4,2,c.sand);}
 if(medic){r(17,4,2,4,'#526c44');r(16,5,4,2,'#526c44');}
 const recoil=(e.cool||0)>(grenadier?1.83:.84)?1:0;
 if(worker){
  if(state.working){plate(23,16,8,4,c.steel);r(29,12,3,7,c.steelLight);r(29,11,5,3,c.steel);r(21,18,5,4,c.ink);if(Math.floor(time*7)%2){r(33,9,2,2,c.hot);r(32,14,2,1,c.cream);}}
  else if(e.carry){prism({r,poly,line},9,17,22,10,c.steel,c.steelLight,c.dark,c.ink);r(11,19,18,5,c.steelLight);r(13,20,3,3,resources[e.carry.resource]||c.sand);r(24,20,3,3,resources[e.carry.resource]||c.sand);r(8,18,5,4,c.ink);r(28,18,4,4,c.ink);}
  else{r(3,19+step,5,5,c.ink);r(25,20-step,5,4,c.ink);}
 }else if(medic){plate(3,22,10,8,c.sand);r(7,23,2,6,'#427640');r(5,25,6,2,'#427640');plate(20,17,12,5,c.steel);r(29,18,3,2,c.glow);r(22,21,5,3,c.sand);}
 else if(psyker){line(28,28,28,7,c.ink,4);line(28,27,28,7,c.steelLight,2);plate(24,3,9,8,c.dark);r(26,5,5,4,c.glow);r(27,6,2,2,c.cream);r(21,18,8,4,c.sand);poly([[9,14],[13,24],[24,24],[26,14]],c.dark);r(14,18,8,2,c.glow);}
 else if(assault){const swing=recoil*3;line(25,22,31-swing,5,c.ink,4);line(26,20,31-swing,4,c.steelLight,2);line(27,18,31-swing,5,c.sand);r(22,21,7,3,c.ink);r(22,20,4,2,c.sand);r(5,19,5,4,c.sand);}
 else{const gx=12-recoil;plate(gx,17,23,7,c.ink);r(gx+2,18,18,3,c.steel);r(gx+4,18,11,1,c.steelLight);r(gx+8,20,5,5,c.dark);r(gx+20,19,4,3,c.dark);r(gx+10,19,2,2,c.glow);r(9,21,5,3,c.sand);r(25-recoil,23,4,2,c.sand);if(grenadier){plate(17,22,10,8,c.ink);r(19,23,6,5,c.steel);r(20,23,4,1,c.hot);r(20,26,4,1,c.hot);}}
 if(e.type==='robot'){plate(10,3,15,11,c.steel);r(14,7,9,3,c.glow);r(9,13,3,7,c.steelLight);r(25,14,3,5,c.steelLight);r(14,14,5,4,c.hot);}
 if(e.type==='pirate'){r(10,5,14,3,'#8b4941');r(11,9,4,3,c.ink);r(5,14,3,2,c.sand);}
 if((e.rank||1)>1){const trim=e.rank===3?'#d9b661':'#c3ccca';r(4,13,7,1,trim);r(25,14,4,1,trim);r(5,16,4,1,trim);if(e.rank===3){r(5,18,4,1,trim);r(13,3,8,1,trim);r(12,22,10,1,trim);}}
 if(back){prism({r,poly,line},11,9,12,11,c.pack,c.sand,c.dark,c.ink);r(12,10,10,3,worker?'#ae7d29':c.sand);r(13,15,8,4,c.pack);}
 ctx.restore();
}
function road(ctx,x,y,size=24){if(style==='classic')return legacy.road(ctx,x,y,size);const {r}=painter(ctx,x,y,size/24);r(0,0,24,24,'#343c3d');for(const [x,y,w]of [[2,3,5],[13,12,7],[6,20,4]])r(x,y,w,2,'#3c4444');r(18,2,2,2,'#293336');}
// Dedicated 32px UI symbols: readable silhouettes, no lot, fences or surface microdetail.
function counterIcon(ctx,type){const c=palettes[0],{r,plate,poly}=pixelPainter(ctx,0,0,1);if(type==='carriers'){drone(ctx,{team:0},16,22);return;}if(type==='population'){plate(4,9,24,19,c.armor);poly([[3,10],[16,2],[29,10]],c.ink);poly([[7,9],[16,5],[25,9]],c.sand);r(13,17,6,10,c.dark);return;}plate(10,4,12,9,c.sand);r(11,9,10,2,c.dark);plate(6,14,20,12,c.steel);r(9,16,14,7,c.hot);if(type==='freeResidents'){r(20,17,4,12,c.glow);r(16,21,12,4,c.glow);}else{r(9,24,5,5,c.dark);r(18,24,5,5,c.dark);}}
function buildingIcon(ctx,type,team=0){
 const c=palettes[team===1?1:0],{r,plate,poly}=pixelPainter(ctx,0,0,1);
 const hall=(x,y,w,h)=>{plate(x,y,w,h,c.armor);r(x+1,y+1,w-2,3,c.light);};
 const gate=(x,y,w,h)=>{plate(x,y,w,h,c.dark);r(x+1,y+1,w-2,1,c.steelLight);};
 const tank=(x,y,w,h,color)=>{plate(x,y,w,h,c.steel);r(x+2,y+2,w-4,h-4,color);r(x+2,y+2,2,h-4,c.sand);};
 switch(type){
 case 'base':poly([[8,5],[23,5],[28,11],[28,25],[4,25],[4,11]],c.ink);r(7,11,18,12,c.armor);r(10,7,12,5,c.light);gate(12,16,8,10);r(14,9,4,2,c.glow);break;
 case 'house':hall(4,8,15,18);hall(18,13,10,13);r(7,14,4,4,c.sand);r(13,14,3,4,c.sand);gate(21,20,4,6);break;
 case 'warehouse':hall(4,7,22,20);gate(8,15,11,12);plate(21,20,8,7,c.sand);break;
 case 'farm':tank(5,6,10,20,c.glow);tank(17,6,10,20,c.glow);r(14,21,4,3,c.steelLight);break;
 case 'field':plate(4,6,24,21,c.pack);for(let y=10;y<=22;y+=6)r(7,y,18,3,c.light);break;
 case 'ironmine':hall(4,15,10,11);poly([[12,8],[28,8],[25,19],[15,19]],c.ink);poly([[15,10],[25,10],[23,16],[17,16]],c.steelLight);r(18,19,4,7,c.steel);break;
 case 'goldmine':hall(4,14,10,12);poly([[16,18],[19,5],[23,10],[27,7],[27,22]],c.ink);poly([[18,18],[20,9],[22,15],[25,12],[25,20]],'#b18bb7');break;
 case 'gasstation':tank(8,5,16,22,'#78b8a3');r(13,3,6,3,c.steelLight);break;
 case 'sulfurstation':hall(5,16,22,11);tank(8,5,6,16,'#d0bd62');tank(19,5,6,16,'#d0bd62');break;
 case 'factory':hall(4,10,24,17);gate(8,18,13,9);r(9,14,12,3,c.hot);plate(23,3,5,10,c.steel);r(23,3,5,2,c.sand);break;
 case 'chemical':tank(4,10,8,17,'#78b8a3');tank(13,5,8,22,'#78b8a3');tank(22,13,7,14,'#78b8a3');r(10,19,15,2,c.steelLight);break;
 case 'cryptofarm':hall(4,6,24,21);for(let x=8;x<=22;x+=7){gate(x,12,4,12);r(x+1,14,2,2,c.glow);r(x+1,19,2,1,c.steelLight);}break;
 case 'greenhouse':plate(4,8,24,19,c.steel);poly([[6,9],[10,4],[22,4],[26,9]],c.sand);r(7,11,18,12,'#638779');for(let x=10;x<=22;x+=6)r(x,15,2,7,c.glow);r(15,8,2,17,c.sand);break;
 case 'incubator':tank(7,5,18,22,'#ad8db8');r(12,12,8,7,'#ded2ab');r(15,10,2,12,'#806587');break;
 case 'psishop':hall(4,13,24,14);tank(10,4,12,21,'#9b87dd');r(15,9,2,10,c.cream);break;
 case 'barracks':hall(3,10,12,17);hall(17,10,12,17);gate(6,18,6,9);gate(20,18,6,9);plate(13,4,6,13,c.sand);r(15,7,2,6,c.glow);break;
 case 'tower':plate(8,17,16,10,c.armor);plate(5,10,22,10,c.steel);plate(9,4,5,10,c.dark);plate(19,4,5,10,c.dark);r(10,4,2,7,c.sand);r(20,4,2,7,c.sand);break;
 case 'weaponshop':hall(4,11,24,15);plate(7,15,18,5,c.dark);r(12,19,4,5,c.dark);r(8,15,12,1,c.steelLight);break;
 case 'ammoshop':hall(4,10,24,17);for(let x=8;x<=22;x+=6){plate(x,13,4,11,c.hot);r(x+1,12,2,3,c.sand);}break;
 case 'armorshop':hall(4,11,24,16);poly([[8,13],[12,11],[16,14],[20,11],[24,13],[21,19],[21,25],[11,25],[11,19]],c.ink);r(13,16,6,7,c.steelLight);break;
 case 'explosiveshop':hall(4,9,24,18);plate(8,16,6,9,c.hot);plate(18,16,6,9,c.hot);r(10,13,2,4,c.sand);r(20,13,2,4,c.sand);break;
 case 'medicineshop':hall(4,9,24,18);r(9,13,14,11,c.sand);r(14,13,4,11,c.armor);r(10,17,12,3,c.armor);break;
 default:hall(5,8,22,19);gate(11,17,10,10);
 }
}
function building(ctx,e,x,y,time=0,state={}){
 if(style==='classic'&&!['cryptofarm','greenhouse','incubator','psishop'].includes(e.type))return legacy.building(ctx,e,x,y,time,state);
 const width=(e.width||e.size||2)*24,height=(e.height||e.size||2)*24,c=palettes[e.team===1?1:0],signal=c.glow,ox=Math.round(x-width/2),oy=Math.round(y-height/2);
 ctx.save();ctx.beginPath();ctx.rect(ox,oy,width,height);ctx.clip();
 const {r,plate,line,poly}=pixelPainter(ctx,ox,oy,2),w=width/2,h=height/2;
 const detail=painter(ctx,ox,oy);
 yard(detail,width,height,e.type,c);
 const block=(x,y,bw,bh,color=c.armor)=>{
  prism(detail,x*2,y*2,bw*2,bh*2,color,color===c.steel?c.steelLight:c.light,c.shade,c.ink);
  detail.r(x*2+3,(y+bh)*2-5,Math.max(1,bw*2-10),1,c.dark);
  for(const px of [x*2+3,(x+bw)*2-9]){detail.r(px,(y+bh)*2-8,1,1,c.sand);detail.r(px,(y+bh)*2-4,1,1,c.steelLight);}
 };
 const door=(x,y,bw,bh)=>{plate(x,y,bw,bh,c.dark);r(x+1,y+1,bw-2,bh-2,c.steel);r(x+2,y+1,bw-4,1,c.steelLight);for(let sy=y*2+5;sy<(y+bh)*2-3;sy+=4)detail.r(x*2+3,sy,bw*2-6,1,c.dark);};
 const vent=(x,y)=>{r(x,y,7,4,c.dark);r(x+1,y+1,5,1,c.steelLight);r(x+1,y+3,5,1,c.steel);};
 if(e.construction>0){const level=Math.max(2,Math.floor((h-8)*(state.progress||0)));r(4,h-6,w-8,2,c.steel);r(5,h-6-level,w-10,level,c.shade);for(let i=0;i<3;i++)r(4+i*Math.floor((w-9)/2),4,1,h-9,c.pack);line(4,5,w-4,h-8,c.sand);line(w-5,5,5,h-8,c.sand);if(state.working){r(w-6,h-10,2,2,c.hot);r(w-8,h-12,1,2,c.cream);}ctx.restore();return;}
 const tank=(x,y,bw,bh,color)=>{const px=Math.round(x*2),py=Math.round(y*2),tw=Math.round(bw*2),th=Math.round(bh*2);detail.poly([[px+3,py],[px+tw-4,py],[px+tw-1,py+3],[px+tw-1,py+th-4],[px+tw-4,py+th-1],[px+3,py+th-1],[px,py+th-4],[px,py+3]],c.ink);detail.poly([[px+3,py+1],[px+tw-4,py+1],[px+tw-2,py+3],[px+tw-2,py+th-4],[px+tw-4,py+th-2],[px+3,py+th-2],[px+1,py+th-4],[px+1,py+3]],color);detail.r(px+3,py+3,2,th-7,c.cream);detail.r(px+tw-5,py+4,3,th-8,c.shade);detail.r(px+2,py+5,tw-4,1,c.steelLight);detail.r(px+2,py+th-6,tw-4,2,c.steel);};
 const type=e.type;
 if(type==='field'){r(2,3,w-4,h-7,'#403a28');for(let i=0;i<4;i++){r(3,5+i*4,w-6,2,'#67613b');if(e.fieldStage!=='sowing'&&(e.crop||0)>i){for(let j=0;j<4;j++)r(4+j*4,4+i*4,2,3,e.fieldStage==='growing'?'#73894b':'#c1be68');}}r(1,h-5,w-2,2,c.steel);}
 else if(type==='base'){block(5,19,14,18);block(w-17,16,12,22,c.steel);poly([[10,9],[w-15,9],[w-6,18],[w-6,h-15],[w/2,h-7],[10,h-15],[5,18]],c.ink);poly([[11,10],[w-16,10],[w-8,19],[w-8,h-17],[w/2,h-10],[11,h-17],[7,19]],c.armor);poly([[11,11],[w-16,11],[w-9,18],[10,18]],c.light);door(w/2-5,h-22,10,13);block(w/2-9,7,16,9,c.steel);r(w/2-5,10,8,2,signal);line(w-13,4,w-13,14,c.steelLight,2);poly([[w-20,3],[w-6,3],[w-9,7],[w-17,7]],c.sand);r(w-13,0,1,4,c.hot);}
 else if(type==='house'){block(4,5,w-13,12);block(12,16,w-16,13);block(3,20,8,9,c.steel);for(const [px,py]of [[7,9],[15,9],[17,20],[25,20]]){r(px,py,5,4,c.dark);r(px+1,py+1,3,2,c.sand);}door(6,h-16,5,10);r(2,h-7,12,2,c.steel);r(w-10,11,7,2,c.sand);r(w-9,13,1,10,c.steelLight);}
 else if(type==='warehouse'){block(3,8,w-15,h-16,c.steel);door(7,17,w-24,h-25);r(5,10,w-19,3,c.steelLight);block(w-13,16,9,6,c.pack);block(w-13,23,9,6,c.armor);r(w-15,5,2,h-14,c.steel);r(w-15,5,12,2,c.sand);line(w-5,7,w-5,14,c.steelLight);r(w-7,13,4,2,c.ink);r(w-13,h-6,9,1,c.steelLight);}
 else if(type==='farm'){block(3,h-14,w-6,7,c.steel);tank(4,7,12,h-17,'#7d934d');tank(w-16,4,12,h-14,'#91a45a');r(4,h-14,w-8,2,c.steelLight);block(w/2-4,h-14,8,7);r(w/2-2,h-12,4,3,signal);line(9,4,w-9,4,c.steelLight,2);r(w/2-1,4,2,8,c.steel);}
 else if(type==='ironmine'){block(2,4,8,10,c.steel);r(4,7,4,3,c.steelLight);block(11,12,10,8,c.pack);poly([[12,13],[15,8],[18,12],[20,9],[21,16],[12,16]],resources.minerals);r(8,15,13,3,c.dark);for(let i=0;i<4;i++)r(9+i*3,16,1,1,c.steelLight);r(19,6,2,7,c.steel);r(13,5,8,2,c.sand);}
 else if(type==='goldmine'){block(3,13,w-6,7,c.steel);block(3,5,6,9);poly([[10,7],[19,5],[22,8],[19,13],[12,14]],c.ink);poly([[11,8],[18,7],[20,8],[18,11],[12,12]],resources.crystals);r(15,3,2,5,c.steelLight);r(4,7,3,2,signal);r(11,16,9,2,c.dark);for(let i=0;i<3;i++)r(12+i*3,15,1,4,resources.crystals);}
 else if(type==='gasstation'){tank(3,3,12,17,c.steel);r(6,7,6,9,resources.gas);r(7,8,1,6,c.cream);block(16,12,6,8);line(14,6,20,6,c.steelLight,2);line(20,6,20,13,c.steelLight,2);r(17,15,3,2,signal);r(3,20,18,2,c.dark);}
 else if(type==='sulfurstation'){block(3,11,w-6,9,c.steel);tank(4,4,6,14,c.steel);tank(14,2,6,14,c.steel);r(5,8,4,5,resources.sulfur);r(15,6,4,5,resources.sulfur);r(8,16,8,3,c.dark);r(9,17,6,1,c.sand);line(10,8,14,8,c.steelLight,2);}
 else if(type==='factory'){block(4,12,w-16,h-19,c.steel);block(7,5,w-22,10);door(8,20,w-25,h-27);r(10,22,w-29,4,c.hot);r(w-13,7,4,h-18,c.steel);r(w-15,5,8,3,c.sand);r(5,7,w-14,2,c.sand);line(w-15,9,w-15,18,c.steelLight);r(w-18,17,6,3,c.ink);tank(w-12,h-19,8,12,c.steel);r(w-10,h-16,4,3,c.hot);}
 else if(type==='chemical'){block(3,h-15,w-6,8,c.steel);tank(5,13,10,h-21,resources.gas);tank(18,8,11,h-16,c.steel);tank(w-16,4,10,h-12,'#758c76');r(20,14,7,11,resources.gas);r(w-14,9,5,16,resources.medicines);line(9,8,w-10,8,c.steelLight,2);line(10,8,10,14,c.steelLight,2);line(23,4,23,8,c.steelLight,2);block(w/2-4,h-15,8,7);r(w/2-2,h-13,4,2,signal);}
 else if(type==='weaponshop'){block(2,14,w-4,7,c.steel);r(4,4,2,11,c.steel);r(w-6,4,2,11,c.steel);r(3,3,w-6,4,c.armor);r(6,12,13,3,c.dark);r(8,11,9,1,c.steelLight);r(12,14,2,3,c.pack);r(w-7,8,3,3,signal);}
 else if(type==='ammoshop'){block(4,11,w-8,10,c.steel);block(7,3,10,10);poly([[4,3],[20,3],[17,8],[7,8]],c.sand);r(10,9,4,7,c.dark);for(let i=0;i<3;i++){r(5+i*5,17,3,4,c.hot);r(6+i*5,16,1,2,c.cream);}}
 else if(type==='armorshop'){block(3,5,5,h-10,c.steel);block(w-8,5,5,h-10,c.steel);r(4,3,w-8,4,c.armor);r(8,h-7,w-16,3,c.steel);poly([[9,9],[12,11],[15,9],[18,13],[16,19],[9,19],[6,13]],c.ink);poly([[10,11],[12,13],[14,11],[16,14],[15,17],[10,17],[8,14]],resources.armor);r(11,5,2,6,c.steelLight);}
 else if(type==='explosiveshop'){block(3,7,w-6,10,c.shade);poly([[3,7],[8,3],[w-7,3],[w-3,7]],c.light);for(let i=0;i<3;i++){tank(3+i*6,13,5,7,resources.explosives);r(4+i*6,14,3,1,c.hot);}r(7,6,10,2,c.dark);}
 else if(type==='medicineshop'){block(4,6,w-8,14,c.sand);block(7,3,w-14,5,c.steel);r(8,9,8,7,c.dark);r(11,10,2,5,resources.medicines);r(9,12,6,1,resources.medicines);r(3,16,4,5,c.steel);r(w-7,16,4,5,c.steel);r(9,18,6,2,c.steelLight);}
 else if(type==='cryptofarm'){block(3,8,w-6,h-13,c.steel);for(let i=0;i<3;i++){door(5+i*8,12,6,h-20);for(let sy=14;sy<h-10;sy+=4){r(6+i*8,sy,3,1,c.dark);r(10+i*8,sy,1,1,signal);}}r(6,6,w-12,3,c.sand);vent(w-10,3);}
 else if(type==='greenhouse'){block(3,8,w-6,h-13,c.steel);poly([[3,8],[7,3],[w-7,3],[w-3,8],[w-3,h-7],[3,h-7]],c.ink);poly([[5,9],[8,5],[w-8,5],[w-5,9],[w-5,h-9],[5,h-9]],'#638779');for(let i=0;i<3;i++){r(6+i*4,10,2,8,'#91b468');r(6+i*4,10,1,2,'#c6d18c');}line(5,9,w-5,9,c.sand);r(w/2,4,1,h-12,c.steelLight);}
 else if(type==='incubator'){block(3,9,w-6,h-15,c.steel);tank(5,4,w-10,h-9,'#8f7b94');r(8,9,w-16,7,'#d0b5d4');r(8,9,2,5,'#e0d1df');r(7,h-7,w-14,2,signal);}
 else if(type==='psishop'){block(3,10,w-6,h-16,c.steel);tank(8,3,8,h-10,'#8b79b3');r(10,6,4,9,'#c3abdf');r(4,13,3,4,c.dark);r(w-7,13,3,4,signal);}

 else if(type==='barracks'){block(3,16,19,h-22);block(w-22,10,18,h-16,c.steel);poly([[2,16],[8,9],[20,9],[23,16]],c.light);poly([[w-23,10],[w-18,5],[w-7,5],[w-3,10]],c.armor);door(7,22,11,h-28);door(w-18,16,10,h-22);block(w/2-3,7,6,h-14,c.steel);r(w/2-1,10,2,8,c.sand);r(w/2-1,23,2,7,signal);r(6,18,13,2,c.sand);}
 else if(type==='tower'){poly([[4,15],[9,12],[18,13],[22,17],[18,22],[6,22]],c.ink);poly([[5,16],[10,14],[17,14],[20,17],[17,20],[7,20]],c.steel);block(7,8,11,9);poly([[4,7],[8,4],[20,4],[22,8],[18,12],[7,12]],c.armor);r(8,1,3,9,c.ink);r(15,1,3,9,c.ink);r(9,1,1,7,c.steelLight);r(16,1,1,7,c.steelLight);r(8,15,8,2,signal);}
 // Native-grid industrial detail. Large structural forms remain legible at normal zoom.
 const d=detail.r,edge=detail.line;
 const grille=(x,y,gw,gh)=>{detail.plate(x,y,gw,gh,c.dark);for(let i=2;i<gh-1;i+=3)d(x+2,y+i,gw-4,1,c.steelLight);};
 const pipe=(x,y,tx,ty)=>{edge(x+1,y+1,tx+1,ty+1,c.ink,3);edge(x,y,tx,ty,c.steel,2);edge(x,y,tx,ty,c.steelLight);};
 const crate=(x,y)=>{prism(detail,x,y,10,8,c.pack,c.sand,c.dark,c.ink);d(x+3,y+3,1,3,c.dark);};
 const hazard=(x,y,hw)=>{d(x,y,hw,3,c.ink);for(let i=0;i<hw-2;i+=5)d(x+i,y,2,3,c.hot);};
 const roof=(x,y,rw,rh)=>{for(let i=8;i<rw-3;i+=10){d(x+i,y,1,rh,c.shade);d(x+i+1,y+1,1,rh-2,c.dark);}d(x+3,y+rh-2,rw-6,1,c.ink);};
 if(type!=='field'){
  // Local paving, edge chips and cable ends stay inside the exact building footprint.
  d(4,height-11,9,1,'#7b7b65');d(width-14,12,7,1,'#6b7364');d(width-9,height-15,4,2,c.dark);
  if(width>=72){crate(width-13,height-13);d(4,height-17,10,1,c.dark);}
 }
 if(type==='base'){grille(15,43,10,11);grille(width-28,38,10,15);roof(24,22,32,11);hazard(width/2-10,height-14,20);pipe(width-19,20,width-19,42);detail.poly([[width/2,43],[width/2+5,48],[width/2,53],[width/2-5,48]],c.sand);d(width/2-1,45,2,6,c.dark);}
 else if(type==='house'){roof(13,12,25,10);roof(30,34,27,9);grille(7,43,9,7);pipe(width-16,24,width-16,36);d(31,52,19,1,c.sand);crate(width-14,height-13);}
 else if(type==='warehouse'){roof(9,18,31,13);hazard(15,height-14,22);pipe(width-29,13,width-29,34);crate(width-23,height-17);crate(width-13,height-16);d(width-18,14,10,1,c.cream);for(let i=0;i<3;i++)d(18+i*6,height-9,4,1,c.steelLight);}
 else if(type==='farm'){pipe(18,9,18,15);pipe(30,42,44,42);grille(31,height-18,12,6);d(13,24,9,1,c.cream);d(width-26,18,10,1,c.cream);d(width-25,25,5,7,'#b9c781');}
 else if(type==='ironmine'){grille(6,15,10,7);hazard(20,36,22);pipe(17,21,25,21);for(let i=0;i<4;i++)d(23+i*4,33,2,2,c.steelLight);}
 else if(type==='goldmine'){grille(8,34,10,6);pipe(10,24,19,24);d(24,16,6,2,'#e5c4d8');d(26,20,3,4,resources.crystals);hazard(25,39,12);}
 else if(type==='gasstation'){pipe(28,16,35,16);grille(33,30,7,7);hazard(9,41,17);d(15,6,9,1,c.cream);}
 else if(type==='sulfurstation'){grille(16,31,15,6);pipe(12,25,29,25);hazard(13,41,22);d(13,9,3,8,resources.sulfur);d(33,6,3,7,resources.sulfur);}
 else if(type==='factory'){roof(17,12,width-48,12);grille(17,16,16,7);pipe(11,35,11,61);hazard(18,height-16,28);crate(5,height-16);d(21,45,23,3,c.steelLight);d(29,48,7,5,c.ink);d(width-18,18,2,14,c.cream);}
 else if(type==='chemical'){pipe(27,38,37,38);pipe(58,22,65,22);pipe(46,8,46,16);grille(39,height-18,14,6);d(43,26,3,20,c.cream);d(width-27,16,3,25,c.cream);hazard(12,height-9,17);}
 else if(type==='weaponshop'){grille(9,8,10,4);pipe(6,17,6,28);d(14,25,23,2,c.steelLight);d(26,27,3,7,c.ink);hazard(8,40,26);}
 else if(type==='ammoshop'){grille(17,24,12,5);pipe(9,20,9,31);hazard(8,42,29);d(20,10,8,1,c.cream);}
 else if(type==='armorshop'){grille(7,23,6,10);grille(36,23,5,10);d(19,28,2,6,c.cream);hazard(15,41,18);}
 else if(type==='explosiveshop'){grille(16,10,12,5);pipe(7,20,7,27);hazard(8,24,30);d(21,34,2,5,c.cream);}
 else if(type==='medicineshop'){grille(17,8,14,5);pipe(36,18,36,34);for(let i=0;i<3;i++){d(16+i*5,36,3,6,resources.medicines);d(17+i*5,34,1,3,c.cream);}}
 else if(type==='cryptofarm'){grille(8,20,9,18);grille(width-17,20,9,18);pipe(8,12,width-12,12);d(18,height-15,22,2,c.sand);}
 else if(type==='barracks'){roof(14,22,26,8);roof(width-36,14,23,7);grille(18,36,14,6);grille(width-31,23,12,6);hazard(15,height-14,23);hazard(width-35,height-14,18);pipe(width/2+3,37,width/2+3,66);}
 else if(type==='tower'){grille(18,25,13,6);pipe(12,29,12,36);hazard(16,41,18);d(19,5,1,9,c.cream);d(33,5,1,9,c.cream);}
 if(type!=='field'){
  // Sparse wear follows panel edges; no random noisy texture over the silhouette.
  d(9,height-19,3,1,c.steelLight);d(width-17,24,2,1,c.steelLight);d(width-8,height-9,2,1,c.pack);
 }
 if(e.team===1&&type!=='field'){poly([[3,11],[2,4],[5,7],[7,11]],c.sand);poly([[w-7,11],[w-2,4],[w-3,11]],c.sand);}
 if(state.operating){const pulse=Math.floor(time*4)%3;r(w-7,Math.min(h-10,14)+pulse,2,1,signal);if(type==='ironmine')r(10,1-Math.floor(time*2)%2,2,1,'#b1ac90');}
 ctx.restore();
}
function deposit(ctx,e,x,y,time=0){
 if(style==='classic'&&!['minerals','tokens','herbs','mycelium','psiomycin'].includes(e.resource))return legacy.deposit(ctx,e,x,y,time);
 const {r,plate,poly,line}=painter(ctx,Math.round(x)-12,Math.round(y)-14),color=resources[e.resource]||resources.crystals;
 if(e.amount<=0){r(4,17,17,3,'#626357');r(7,16,4,1,'#8d8e77');return;}
 if(e.resource==='minerals'){poly([[1,21],[2,15],[7,12],[8,8],[15,9],[19,14],[23,16],[22,22]],'#252926');poly([[3,19],[4,15],[10,12],[15,12],[20,17],[20,20]],'#756956');poly([[9,10],[14,10],[18,15],[11,16],[7,14]],color);r(5,16,4,2,'#d0bb87');r(14,17,6,2,'#a28b61');r(11,12,3,2,'#e1c999');}
 else if(e.resource==='herbs'){plate(7,15,12,7,'#69533c');line(12,18,12,5,'#43623d',2);poly([[12,12],[5,6],[5,11],[11,15]],color);poly([[13,9],[19,4],[19,9],[13,13]],'#b3d58a');}
 else if(e.resource==='mycelium'){plate(4,18,18,4,'#5c495e');r(8,12,3,8,'#d5c9a8');r(16,14,2,6,'#d5c9a8');poly([[3,13],[5,8],[11,6],[15,11],[14,14]],color);poly([[12,15],[14,11],[19,10],[22,15]],'#a186b9');r(7,9,3,2,'#eee2ce');}
 else if(e.resource==='psiomycin'){plate(7,6,11,17,'#413448');r(9,9,7,12,color);r(9,9,2,10,'#d4c5ed');r(9,3,7,4,'#8d9a8b');r(12,13,3,5,'#e1dbb3');}
 else if(e.resource==='tokens'){poly([[5,7],[18,7],[22,11],[22,19],[18,23],[5,23],[2,19],[2,11]],'#292d2b');r(5,10,14,10,'#bba267');r(7,12,10,6,'#504b3c');r(9,13,6,4,'#e0cd8d');}
 else if(e.resource==='crystals'||e.resource==='sulfur'){
  const crystal=e.resource==='crystals',dark=e.resource==='minerals'?'#303e46':crystal?'#553954':'#6d602c';
  poly([[1,21],[3,12],[8,12],[10,3],[16,3],[18,13],[22,15],[23,21]],'#1c2528');
  poly([[3,19],[5,13],[10,13],[11,5],[15,5],[17,14],[21,16],[21,19]],dark);
  poly([[10,6],[12,4],[15,4],[16,6]],e.resource==='minerals'?'#c3d2d2':crystal?'#e5c4d8':'#f4df89');r(15,7,2,8,dark);r(11,6,3,10,color);r(5,14,3,4,color);r(17,16,3,3,color);r(11,5,2,5,crystal?'#e5c4d8':e.resource==='sulfur'?'#f4df89':'#c3d2d2');
 }else if(e.resource==='gas'&&e.type==='deposit'){poly([[1,20],[4,13],[17,12],[23,18],[21,22]],'#2d3c39');r(6,16,12,4,'#172524');r(8,15,8,2,color);const shift=Math.floor(time*2)%3;r(9,7-shift,5,5,'#78b8a3');r(12,3-shift,4,4,'#a2d2b8');}
 else if(e.resource==='gas'){plate(6,4,13,19,'#394c49');r(8,7,9,11,color);r(8,7,2,8,'#c0ddd0');r(9,2,7,3,'#919e8d');}
 else if(e.resource==='weapons'){plate(2,12,21,6,'#24292e');r(4,13,16,2,'#6f737d');r(11,17,4,5,'#24292e');r(17,14,2,2,'#a7ee15');}
 else if(e.resource==='armor'){poly([[3,8],[8,5],[10,9],[15,9],[17,5],[22,8],[19,15],[19,22],[6,22],[6,15]],'#20292f');r(8,10,9,11,color);r(9,11,2,6,'#d1d9d7');}
 else if(e.resource==='ammo'){prism({r,poly,line},3,8,19,14,'#3d443a','#8d987d','#29352d');for(let i=0;i<3;i++){r(6+i*5,10,3,9,color);r(6+i*5,8,3,3,'#eed098');}}
 else if(e.resource==='medicines'){prism({r,poly,line},3,8,19,14,color,'#e1e6c8','#6e8b79');r(10,10,4,10,'#467b45');r(7,13,10,4,'#467b45');r(9,5,7,3,'#5c6e60');}
 else if(e.resource==='explosives'){prism({r,poly,line},3,9,19,13,'#5b3930','#bf956c','#403131');r(5,11,15,9,color);r(11,11,3,9,'#9d4f38');r(10,5,4,5,'#d4b15f');}
 else{prism({r,poly,line},5,6,15,17,color,'#dfd9ad',e.resource==='tokens'?'#8b7842':'#506438');r(7,8,11,3,'#dfd9ad');r(9,13,7,7,e.resource==='tokens'?'#8b7842':'#697f3a');}
}
function fallen(ctx,e,x,y,age){if(e.type==='drone')return drone(ctx,{...e,moving:false},x,y);if(style==='classic')return legacy.fallen(ctx,e,x,y,age);if(age<.2)return unit(ctx,{...e,moving:false},x,y,0);const c=palettes[e.team===1?1:0],{r,plate}=painter(ctx,x-14,y-5);plate(3,3,10,7,c.sand);plate(11,2,14,8,e.type==='worker'?'#be912d':c.armor);r(18,8,12,4,c.dark);}
function menuScene(ctx,width,height){if(style==='classic')return legacy.menuScene(ctx,width,height);ctx.fillStyle='#303b36';ctx.fillRect(0,0,width,height);for(let x=0;x<width;x+=24)road(ctx,x,170,24);building(ctx,{type:'base',team:0,size:3},105,100);building(ctx,{type:'factory',team:0,size:4},255,105);building(ctx,{type:'barracks',team:1,size:4},width-100,105);for(const [i,type]of ['worker','soldier','assault','medic','grenadier'].entries())unit(ctx,{type,team:0,facingX:1},120+i*38,230+i%2*8);for(let i=0;i<3;i++)unit(ctx,{type:'soldier',team:1,facingX:-1},width-145+i*36,230);}
const api={palettes,resources,painter,pixelPainter,perspective,prism,UNIT_SCALE,surfacePalette,planetPalette,road,unit,building,buildingIcon,counterIcon,deposit,fallen,menuScene,setStyle,getStyle};if(typeof module!=='undefined')module.exports=api;else root.RTSArt=api;
})(typeof window!=='undefined'?window:globalThis);
