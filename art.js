/* HELIOS H3. Native pixel artwork only; this module never advances simulation. */
(function(root){
'use strict';
const resources={food:'#9bd34f',money:'#ddc779',metal:'#8daab8',crystals:'#c48bcc',gas:'#72c7bd',weapons:'#c7a376'};
const palettes=[
 {ink:'#171b1c',dark:'#303a2c',shade:'#465733',armor:'#718846',light:'#94a760',sand:'#ddc79b',cream:'#f0dcad',steel:'#626a70',steelLight:'#9ca3a0',pack:'#8e6643',glow:'#9ded32',hot:'#dcb76d'},
 {ink:'#1b191d',dark:'#332b30',shade:'#57343a',armor:'#8b4444',light:'#b55b4c',sand:'#b9a080',cream:'#ddc5a0',steel:'#565361',steelLight:'#8e8690',pack:'#695049',glow:'#ffb34c',hot:'#ef7644'}
];
function painter(ctx,ox,oy,scale=1){
 const r=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(ox+x*scale),Math.round(oy+y*scale),Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)));};
 const line=(x0,y0,x1,y1,c,width=1)=>{x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let err=dx+dy;for(;;){r(x0,y0,width,width,c);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}}};
 const poly=(points,c)=>{const lo=Math.floor(Math.min(...points.map(p=>p[1]))),hi=Math.ceil(Math.max(...points.map(p=>p[1])));for(let y=lo;y<hi;y++){const xs=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y+.5&&b[1]>y+.5)||(b[1]<=y+.5&&a[1]>y+.5))xs.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const left=Math.round(xs[i]),right=Math.round(xs[i+1]);if(right>left)r(left,y,right-left,1,c);}}};
 const plate=(x,y,w,h,c,edge='#171b1c')=>{r(x+1,y,w-2,h,edge);r(x,y+1,w,h-2,edge);r(x+1,y+1,w-2,h-2,c);};
 return{r,line,poly,plate};
}
function road(ctx,x,y,size=24){
 const {r}=painter(ctx,x,y,size/24);
 r(0,0,24,24,'#383f39');
 // A directionless, repeating surface: no borders or lane markings at tile joins.
 for(let row=0;row<4;row++)for(let col=0;col<4;col++)r(2+col*6,2+row*6,2,2,(row+col)%2?'#3e453d':'#323b35');
}
function unit(ctx,e,x,y,time=0,state={}){
 const team=e.team===1?1:0,c=palettes[team],demon=team===1,worker=e.type==='worker',phase=Math.floor((e.walkDistance||0)*5)%4,step=e.moving?[0,2,0,-2][phase]:0;
 // An identical foot anchor is used by walking, idle and action frames.
 const p=painter(ctx,Math.round(x)-15,Math.round(y)-25),{r,line,poly,plate}=p;
 r(5,30,22,3,'#14171477');
 if(worker){
  const face=e.facingX<-.15?-1:1,step=e.moving?[0,2,0,-2][phase]:0,wp=painter(ctx,Math.round(x)-12,Math.round(y)-23),{r,line,plate,poly}=wp;
  for(const [dx,shift]of [[6,step],[15,-step]]){plate(dx,16+Math.max(0,shift),5,11-Math.abs(shift),c.dark);r(dx+1,17+Math.max(0,shift),3,5,'#6c7772');r(dx-1,26+Math.max(0,shift),7,3,c.ink);r(dx,26+Math.max(0,shift),5,1,c.sand);}
  plate(5,6,16,13,c.pack);r(7,7,12,4,c.sand);r(7,11,12,6,demon?c.shade:'#667c68');r(8,12,2,5,c.sand);r(16,12,2,5,c.sand);r(9,17,8,2,c.dark);
  plate(9,1,10,9,c.sand);r(8,1,12,3,c.armor);r(9,0,10,2,c.light);r(10,5,8,2,c.ink);r(11,5,6,1,c.glow);r(11,8,6,2,c.sand);
  if(demon){poly([[9,3],[6,-1],[9,0],[11,3]],c.cream);poly([[17,3],[21,-1],[20,3],[19,5]],c.cream);}
  if(state.working){line(18,13,23,8,c.steelLight,2);r(22,6,4,3,c.sand);if(Math.floor(time*7)%2){r(25,6,2,1,c.hot);r(25,10,1,2,c.cream);}}
  else if(e.carry?.resource==='gas'){for(const dx of [5,15]){plate(dx,13,7,11,c.steel);r(dx+1,15,5,5,resources.gas);r(dx+2,12,3,2,e.carry.raw?c.steelLight:c.glow);r(dx+2,16,1,3,c.cream);}}
  else if(e.carry){plate(4,13,19,10,c.pack);r(5,14,17,2,c.sand);r(10,16,7,4,resources[e.carry.resource]||c.light);r(7,16,1,5,c.cream);}
  else{r(3,10,4,8,c.sand);r(19,10,4,8,c.sand);r(4,16,3,3,c.pack);r(19,16,3,3,c.pack);}
  return;
 }
 const medic=e.type==='medic',assault=e.type==='assault',grenade=e.type==='grenadier',front=e.facingY<-.45,face=e.facingX<-.15?-1:1;
 // Mirroring is integral so the native one-pixel outline stays sharp in both directions.
 ctx.save();if(face<0){ctx.translate(Math.round(x)*2,0);ctx.scale(-1,1);}
 const paint=painter(ctx,Math.round(x)-15,Math.round(y)-25),q=paint.r,pl=paint.plate,ln=paint.line,pg=paint.poly;
 const body=medic?c.sand:c.armor,lit=medic?c.cream:c.light;
 // Feet/hips. Four movement frames use the same timing as the simulation's distance.
 for(const [dx,shift]of [[8,step],[19,-step]]){pl(dx,21+Math.max(0,shift),6,10-Math.abs(shift),c.dark);q(dx+1,22+Math.max(0,shift),4,4,c.armor);q(dx+1,25+Math.max(0,shift),4,3,c.sand);q(dx-1,29+Math.max(0,shift),8,3,c.ink);q(dx,29+Math.max(0,shift),6,1,c.cream);}
 pl(8,17,17,7,c.dark);q(10,20,5,3,c.sand);q(20,20,3,3,c.sand);
 // Brown equipment pack and antenna are intentionally visible behind the left shoulder.
 pl(5,4,9,14,c.pack);q(6,5,3,3,c.sand);pl(8,-1,3,7,c.dark);q(9,0,1,2,c.glow);
 pl(10,8,15,14,c.shade);q(12,9,10,5,body);q(12,14,9,3,c.sand);q(14,17,8,4,c.dark);
 pg([[4,10],[7,7],[14,8],[16,11],[14,17],[4,17]],c.ink);pg([[5,10],[8,8],[13,9],[14,12],[13,15],[5,15]],body);q(6,10,5,2,lit);
 pl(24,11,5,8,c.armor);q(25,12,3,2,c.light);
 // Helmet: low, broad, with the characteristic horizontal green visor from the reference.
 pg([[13,1],[21,1],[24,4],[24,10],[20,13],[13,11],[11,7],[11,3]],c.ink);pg([[14,2],[21,2],[23,5],[22,8],[13,7],[12,5]],body);q(14,2,6,2,lit);q(15,8,9,3,c.ink);q(16,8,7,1,c.glow);q(17,9,5,1,c.glow);q(14,11,7,2,c.sand);
 if(demon){pg([[11,5],[8,-1],[12,1],[15,5]],c.cream);pg([[22,4],[26,-1],[26,3],[24,7]],c.cream);q(7,12,2,3,c.cream);q(8,13,3,1,c.cream);}
 else if(medic){q(18,3,2,5,'#467d3c');q(16,5,6,1,'#467d3c');q(7,10,2,5,'#467d3c');q(5,12,6,1,'#467d3c');}
 else{q(7,11,2,3,c.sand);q(8,10,2,2,c.sand);q(9,11,2,1,c.sand);}
 const shooting=(e.cool||0)>(grenade?1.83:.84),recoil=shooting?1:0;
 if(medic){
  pl(5,23,9,6,c.sand);q(8,24,2,4,'#467d3c');q(6,25,6,2,'#467d3c');pl(23,17,8,4,c.steel);q(29,18,2,2,c.glow);
 }else if(assault){
  const swing=shooting?2:0;ln(26,22,30-swing,4,c.ink,3);ln(27,20,31-swing,3,demon?c.hot:'#d3d6b3',2);ln(28,17,31-swing,4,demon?'#ffda95':'#b3db62');q(24,20,6,2,c.sand);pl(3,17,7,8,c.armor);q(5,19,3,3,c.sand);
 }else{
  const gx=14-recoil,gy=16,gw=grenade?17:19;
  pl(gx,gy,gw,6,c.steel);q(gx+2,gy+1,gw-5,1,c.steelLight);q(gx+4,gy+3,gw-7,2,c.dark);q(gx+gw-3,gy+2,4,3,c.ink);q(gx+gw-2,gy+2,2,2,c.steel);q(gx+7,gy+2,2,2,c.glow);
  if(grenade){pl(19-recoil,21,7,7,c.steel);for(let i=0;i<3;i++)q(21-recoil,22+i*2,3,1,c.hot);q(5,18,2,4,c.hot);q(8,18,2,4,c.hot);}
 }
 q(11,18,4,3,c.sand);q(medic?24:24-recoil,21,3,2,c.sand);
 if(front){pl(13,6,8,9,c.pack);q(14,7,6,2,c.sand);q(15,12,4,2,c.dark);}
 ctx.restore();
}
function deposit(ctx,e,x,y,time=0){
 const {r,plate,poly,line}=painter(ctx,Math.round(x)-12,Math.round(y)-14),c=resources[e.resource];r(1,20,23,3,'#191c1d88');
 if(e.amount<=0){r(4,17,17,3,'#747063');r(6,17,4,1,'#aaa18e');return;}
 if(e.resource==='scrap'){
  poly([[1,18],[4,7],[9,5],[10,1],[16,6],[20,9],[23,20]],'#242b2b');r(5,7,5,10,'#7c8177');r(6,8,2,7,'#bac0a1');line(11,5,20,16,'#b98b58',3);r(11,11,7,6,'#455944');r(12,12,5,2,'#889d6d');r(2,18,8,3,'#9f764c');r(17,17,6,3,'#59616a');
 }else if(e.resource==='regolith'){
  poly([[0,20],[2,12],[7,11],[8,4],[16,3],[19,10],[23,14],[24,21]],'#444844');poly([[2,19],[3,13],[9,13],[10,6],[16,5],[18,12],[22,15],[22,19]],'#969386');r(10,6,6,2,'#c3bca5');r(4,14,5,2,'#bcb6a0');r(12,14,6,5,'#757569');r(2,20,21,2,'#555c54');
 }else if(e.resource==='metal'){
  poly([[1,19],[4,9],[7,8],[9,0],[16,3],[19,11],[23,16],[22,21]],'#303b3d');poly([[4,18],[6,10],[9,9],[11,3],[16,5],[17,13],[21,17],[20,19]],'#687f88');line(11,4,13,13,'#c6cbbc',2);r(6,12,3,3,'#abc4c8');r(15,14,4,2,'#9cb1b4');r(3,20,17,2,'#414f54');
 }else if(e.resource==='gas'){
  if(e.type==='deposit'){poly([[1,20],[3,14],[8,10],[17,11],[23,18],[21,22]],'#4b5750');r(6,15,13,5,'#202d2b');r(8,16,9,2,'#416e66');const drift=Math.floor(time*2)%3;r(8,10-drift,5,4,'#6dafa2');r(12,5-drift,5,5,'#88c4b3');r(9,1-drift,4,3,'#a2c8b488');}
  else{plate(5,4,15,19,'#4a6463');r(7,7,11,11,c);r(8,8,2,8,'#bee6d7');r(6,4,13,3,'#a9b4a4');r(10,1,5,3,'#687d71');r(8,19,9,2,'#314941');r(16,9,2,6,'#4d8f85');}
 }else if(e.resource==='food'){
  plate(6,4,14,18,'#75846b');r(8,7,10,11,'#aad06d');r(9,8,2,8,'#e3e9a4');r(7,3,12,4,'#c2c2a8');r(8,18,10,3,'#495945');
 }else if(e.resource==='money'){plate(3,7,20,14,'#827447');r(5,9,16,8,'#d8c478');r(10,10,6,6,'#7e8050');r(12,9,2,8,'#f0df98');}else if(e.resource==='weapons'){plate(2,11,22,6,c||'#6d7472');r(4,12,15,2,'#b3bab0');r(10,16,4,5,'#343b39');r(20,12,6,4,'#303735');r(6,13,2,2,'#b3cb80');}else{
  r(2,19,21,3,'#52465c');for(const [dx,dy,h]of [[3,19,12],[14,19,17],[8,17,23]]){poly([[dx,dy],[dx-1,dy-h+5],[dx+2,dy-h],[dx+5,dy-h+5],[dx+4,dy]],'#594967');poly([[dx+1,dy-1],[dx+1,dy-h+5],[dx+2,dy-h+2],[dx+4,dy-h+5],[dx+3,dy]],c);line(dx+2,dy-h+5,dx+2,dy-3,'#e3b5dc');}
 }
}
function building(ctx,e,x,y,time=0,state={}){
 const c=palettes[e.team===1?1:0],demon=e.team===1,neutral=e.team<0,n=e.size===3?36:24,p=painter(ctx,Math.round(x)-n,Math.round(y)-n,2),{r,line,plate,poly}=p;
 const s=n,roof=c.armor,edge=c.ink,steel=c.steel,trim=c.sand,signal=neutral?'#e1bd78':c.glow;
 const foundation=()=>{plate(0,s-9,s,10,c.dark);r(2,s-2,s-4,1,c.steel);for(let i=0;i<3;i++){r(2+i*3,s-4,2,1,c.hot);r(3+i*3,s-4,1,1,edge);}};
 const panel=(px,py,w,h)=>{plate(px,py,w,h,roof);r(px+1,py+1,w-2,2,c.light);r(px+1,py+h-3,w-2,2,c.shade);};
 const vents=(px,py,count)=>{for(let i=0;i<count;i++){r(px+i*3,py,2,4,edge);r(px+i*3,py,2,1,c.steelLight);}};
 const skull=(px,py)=>{r(px,py,5,4,c.sand);r(px,py+1,1,1,edge);r(px+3,py+1,1,1,edge);r(px+1,py+4,3,1,c.sand);};
 r(1,s-1,s+2,3,'#171c1c99');
 if((e.construction||0)>0){
  const progress=state.progress||0,h=Math.max(1,Math.floor((s-4)*progress));foundation();r(3,s-3-h,s-6,h,c.steel);for(let i=0;i<3;i++)line(2+i*8,s-2,2+i*8,2,c.pack,2);line(2,3,s-2,3,c.sand,2);line(3,s-4,s-3,5,c.pack);r(3,Math.floor(time*4)%s,s-6,1,signal);
  if(state.working){r(s-5,s-8,2,2,c.cream);if(Math.floor(time*8)%2){r(s-2,s-10,1,2,c.hot);r(s-8,s-5,1,1,c.hot);}}return;
 }
 foundation();
 if(e.type==='base'){
  panel(3,8,30,22);panel(6,4,24,13);r(9,7,18,5,edge);r(10,8,16,2,c.steelLight);r(12,9,12,2,signal);panel(13,18,12,14);r(15,22,8,10,edge);r(16,23,6,7,c.steel);r(17,23,4,1,signal);
  for(const dx of [0,27]){panel(dx,19,9,13);r(dx+2,22,5,4,edge);r(dx+3,23,3,2,signal);}
  vents(8,15,6);line(28,8,28,-4,c.steelLight);line(24,0,32,0,c.steelLight);r(27,-5,3,2,signal);r(5,30,5,2,trim);r(28,30,5,2,trim);
  if(demon){poly([[4,9],[2,1],[6,4],[9,8]],trim);poly([[26,8],[31,0],[30,7],[29,11]],trim);skull(16,5);r(6,18,5,2,c.hot);}
 }else if(e.type==='house'){
  panel(2,5,20,18);r(6,3,12,3,c.steel);for(let i=0;i<3;i++){plate(4+i*6,8,5,9,c.shade);r(5+i*6,9,3,4,trim);r(5+i*6,9,3,1,c.cream);r(5+i*6,14,3,1,signal);}r(5,20,14,1,steel);r(3,2,2,4,c.steelLight);r(3,1,2,1,signal);
 }else if(e.type==='warehouse'){
  for(const [dx,dy]of [[1,10],[13,11],[7,2]]){plate(dx,dy,11,9,c.shade);r(dx+1,dy+1,9,2,trim);for(let i=0;i<3;i++)r(dx+2+i*3,dy+4,1,4,c.light);r(dx+3,dy+3,5,2,c.pack);}
  line(0,8,0,21,steel,2);line(22,8,22,21,steel,2);r(0,7,24,2,c.steelLight);r(9,9,6,2,signal);
 }else if(e.type==='sawmill'){
  panel(1,5,15,15);r(3,8,11,9,edge);vents(4,9,3);r(16,10,7,11,steel);r(17,12,5,3,trim);r(1,20,22,3,edge);for(let i=0;i<6;i++)r(2+i*3,20,1,2,c.steelLight);r(4,16,6,3,c.pack);r(6,16,1,3,trim);r(16,6,5,3,signal);
 }else if(e.type==='quarry'){
  plate(2,13,20,10,c.shade);r(5,16,14,6,edge);line(3,4,3,20,c.steelLight,2);line(19,4,19,20,c.steelLight,2);r(2,3,20,3,trim);r(10,6,4,13,steel);for(let i=0;i<4;i++)line(9,8+i*3,14,10+i*3,c.steelLight);r(4,19,5,3,'#a69d8b');r(16,7,3,2,signal);
 }else if(e.type==='farm'){
  for(const [dx,dy]of [[1,7],[9,3],[17,7]]){plate(dx,dy,7,14,steel);r(dx+1,dy+2,5,9,c.shade);r(dx+2,dy+3,3,7,resources.food);r(dx+2,dy+3,1,6,c.cream);r(dx,dy,7,2,trim);r(dx+1,dy+11,5,2,c.steelLight);}r(1,22,22,1,c.pack);
 }else if(e.type==='ironmine'){
  panel(5,8,18,15);plate(9,12,10,11,edge);r(11,14,6,8,'#af6c3d');r(12,17,4,5,'#efb465');r(13,19,2,3,c.cream);for(const [dx,dy]of [[1,2],[17,-1]]){r(dx,dy,5,12,edge);r(dx+1,dy+1,3,10,steel);r(dx,dy-1,5,2,trim);}r(1,19,6,3,resources.metal);
 }else if(e.type==='goldmine'){
  panel(2,16,20,7);for(const side of [-1,1]){line(12+side*8,17,12+side*6,4,steel,2);r(12+side*6,5,2,4,resources.crystals);}poly([[10,14],[9,6],[12,0],[15,6],[14,14]],edge);poly([[11,12],[10,6],[12,2],[14,6],[13,12]],resources.crystals);r(11,5,1,6,'#e4c5e3');r(9,19,6,1,resources.crystals);
 }else if(e.type==='gasstation'){
  panel(0,16,24,8);for(const dx of [2,14]){plate(dx,2,8,17,c.steel);r(dx+1,5,6,10,c.shade);r(dx+2,6,4,8,resources.gas);r(dx+2,6,1,7,c.cream);r(dx,2,8,3,c.sand);r(dx+2,0,4,2,c.steelLight);}line(6,1,18,1,c.steelLight,2);r(9,18,6,5,c.ink);r(10,19,4,2,signal);for(const dx of [2,18]){plate(dx,21,4,5,c.pack);r(dx+1,22,2,2,resources.gas);}
 }else if(e.type==='field'){
  r(0,3,24,21,'#524d35');r(1,4,22,19,'#726243');for(let row=0;row<4;row++){r(2,6+row*4,20,2,'#3e4931');for(let col=0;col<5;col++){if(e.fieldStage!=='sowing'&&row*5+col<Math.ceil((e.crop||0)/16*20))r(3+col*4,5+row*4,2,e.fieldStage==='growing'?2:3,e.fieldStage==='growing'?'#6d7845':'#a8b763');}}r(0,3,24,1,c.sand);r(0,4,1,19,c.sand);
 }else if(e.type==='factory'){
  panel(1,5,22,18);r(4,10,16,10,c.ink);r(6,12,12,6,c.steel);r(7,13,10,2,c.steelLight);r(10,16,3,4,c.pack);r(1,20,22,2,c.sand);r(4,1,5,8,c.steel);r(16,-2,5,11,c.steel);r(16,-3,5,2,c.sand);r(5,2,3,1,c.glow);r(17,11,3,2,c.hot);
 }else if(e.type==='guild'){
  panel(1,6,22,17);panel(4,1,16,7);r(6,3,12,2,c.sand);r(10,8,5,14,c.ink);r(11,10,3,11,c.sand);r(3,12,5,6,c.steel);r(16,12,5,6,c.steel);r(4,13,3,2,c.glow);r(17,13,3,2,c.glow);r(2,20,20,2,c.pack);
 }else if(e.type==='barracks'){
  panel(0,8,24,14);plate(4,11,16,12,edge);r(6,12,12,9,c.steel);for(let i=0;i<4;i++)r(6,13+i*2,12,1,c.shade);r(3,21,18,2,trim);r(10,21,4,2,c.hot);panel(3,2,18,7);r(5,4,14,2,edge);r(7,4,10,1,signal);r(1,11,2,9,c.sand);r(21,11,2,9,c.sand);
 }else if(e.type==='tower'){
  panel(3,17,18,6);plate(8,8,8,11,steel);panel(5,3,14,8);for(const dx of [7,15]){plate(dx,-4,3,11,c.steelLight);r(dx+1,-3,1,7,edge);r(dx,-5,3,2,c.cream);}r(10,7,4,2,signal);r(9,16,6,2,c.sand);
 }else if(e.type==='outpost'){
  plate(5,19,14,5,neutral?steel:c.shade);plate(8,16,8,5,trim);r(11,-2,2,20,c.steelLight);r(11,0,1,16,signal);line(7,4,17,4,steel,2);line(7,4,5,-1,c.steelLight);line(17,4,19,-1,c.steelLight);r(10,-5,4,4,edge);r(11,-4,2,2,signal);r(8,17,8,1,signal);
 }
 if(demon&&e.type!=='base'&&e.type!=='outpost'){
  // Demonic architecture is armored metal with horn brackets, never organic tentacles.
  poly([[1,10],[0,3],[3,5],[5,9]],trim);poly([[19,9],[23,3],[23,8],[22,12]],trim);if(['barracks','house'].includes(e.type))skull(10,6);r(2,s-3,2,1,c.hot);r(s-4,s-3,2,1,c.hot);
 }
 for(let i=0;i<(state.occupants||0);i++)r(3+i*3,s-1,2,1,signal);
 if(state.operating){const shift=Math.floor(time*4)%3;r(s-5,12+shift*2,1,1,signal);if(e.type==='gasstation'){r(5,7+shift*2,2,1,'#d3ebd0');r(17,11-shift*2,2,1,'#d3ebd0');}else if(e.type==='ironmine'){r(3,-2-Math.floor(time*2)%4,2,1,'#afa98b77');}else if(e.type==='quarry'){line(10,9+shift,13,11+shift,trim);}else if(e.type==='farm'){r(11,10+shift,2,1,c.cream);}else if(e.type==='sawmill'){r(5+shift*2,19,3,2,trim);}}
}
function fallen(ctx,e,x,y,age){
 const c=palettes[e.team===1?1:0];
 if(age<.2&&e.type!=='worker'){unit(ctx,{...e,moving:false,walkDistance:0},x+Math.floor(age*8),y+Math.floor(age*10),0);return;}
 const {r,plate,poly}=painter(ctx,x-14,y-5);r(1,8,28,3,'#14171466');
 if(e.type==='worker'){plate(3,3,8,5,c.sand);plate(14,2,8,5,c.sand);r(9,5,8,4,c.shade);r(12,3,4,3,c.steel);}
 else{plate(6,2,14,8,c.armor);r(7,3,8,2,c.light);r(5,6,7,3,c.sand);plate(1,2,7,6,c.armor);r(2,3,4,1,c.dark);plate(17,5,12,4,c.steel);r(21,6,7,1,c.steelLight);r(9,9,5,2,c.pack);}
}
function menuScene(ctx,width,height){
 ctx.imageSmoothingEnabled=false;ctx.fillStyle='#30352e';ctx.fillRect(0,0,width,height);const p=painter(ctx,0,0,2),{r,line,plate}=p;
 for(let y=0;y<height/2;y+=12)for(let x=0;x<width/2;x+=12){r(x,y,11,11,(x+y)%24?'#343a32':'#353a33');r(x,y+11,12,1,'#282f29');}
 r(0,49,width/2,32,'#252c29');for(let x=5;x<width/2;x+=18)r(x,64,8,1,'#7b795e');
 for(let i=0;i<5;i++){plate(9+i*28,9,23,12,'#444b3f');r(11+i*28,12,17,1,'#646a51');r(16+i*28,16,8,2,'#2e352f');}
 building(ctx,{type:'base',team:0,size:3},90,138,0);building(ctx,{type:'barracks',team:0,size:2},174,140,0);building(ctx,{type:'tower',team:1,size:2},width-80,116,0);
 for(const [i,type]of ['soldier','assault','medic','grenadier'].entries())unit(ctx,{type,team:0,id:i,facingX:1},130+i*37,215+(i%2)*12,0);
 unit(ctx,{type:'worker',team:0,id:1},85,202,0);
 for(const [i,type]of ['soldier','assault','grenadier'].entries())unit(ctx,{type,team:1,id:i,facingX:-1},width-160+i*35,204+i%2*14,0);
 const q=painter(ctx,width-145,height-65,2);q.plate(0,0,42,17,'#3b4735');q.r(3,3,36,2,'#69724e');for(let i=0;i<5;i++)q.r(4+i*7,8,3,5,'#28392e');
}
const api={palettes,resources,painter,road,unit,building,deposit,fallen,menuScene};if(typeof module!=='undefined')module.exports=api;else root.RTSArt=api;
})(typeof window!=='undefined'?window:globalThis);
