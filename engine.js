/* DOM-independent simulation. All gameplay time advances through tick(dt). */
(function(root){
'use strict';
const W=144,H=96,resources=['wood','stone','food','iron','gold'];
const stats={
 worker:{hp:60,speed:2.8,size:1},soldier:{hp:120,speed:2.5,size:1,damage:18,range:1.3},
 outpost:{hp:Infinity,size:2},base:{hp:1600,size:3,cost:{}},house:{hp:300,size:2,buildTime:12,cost:{wood:50,stone:15}},
 warehouse:{buildTime:14,hp:450,size:2,cost:{wood:50,stone:20}},
 sawmill:{buildTime:16,hp:350,size:2,cost:{wood:50},resource:'wood',slots:2,rate:2},
 quarry:{buildTime:18,hp:400,size:2,cost:{wood:50},resource:'stone',slots:2,rate:2},
 farm:{buildTime:12,hp:300,size:2,cost:{wood:50},resource:'food',slots:2,rate:3},
 ironmine:{buildTime:20,hp:400,size:2,cost:{wood:60,stone:20},resource:'iron',slots:2,rate:1.5},
 goldmine:{buildTime:20,hp:400,size:2,cost:{wood:60,stone:20},resource:'gold',slots:2,rate:1.5},
 barracks:{buildTime:22,hp:650,size:2,cost:{wood:90,stone:30}},tower:{buildTime:24,hp:800,size:2,cost:{wood:60,stone:80},damage:26,range:7}
};
const soldierCost={wood:20,iron:15,gold:10};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
class Game{
 constructor(seed=Math.floor(Math.random()*0xffffffff),options={}){
  this.seed=seed>>>0;this.rng=this.seed;this.aiEnabled=options.ai!==false;this.time=0;this.result=null;this.nextId=1;this.entities=[];this.economyClock=0;this.aiClock=0;
  this.message='Постройте ферму и лесопилку. Выделите рабочих и нажмите ПКМ по зданию, чтобы назначить их.';
  this.teams=[0,1].map(()=>({stock:{wood:380,stone:180,food:180,iron:60,gold:80},birth:0,hungry:false,unpaid:false}));
  this.terrain=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>+(x===0||y===0||x===W-1||y===H-1)));
  this.generateRegions();
  for(let team=0;team<2;team++){
   const r=this.regions[this.homeRegions[team]],base=this.add('base',team,r.x+(team?6.5:-6.5),r.y+.5);
   for(let i=0;i<6;i++)this.add('worker',team,base.x+(team?-4:4),base.y-2+i);
  }
  // Every large territory has its own finite resource patches.
  for(const r of this.regions)for(const [resource,dx,dy]of [['wood',-8,-9],['stone',8,-9],['iron',-8,9],['gold',8,9]]){
   const target={x:r.x+dx+(this.random()-.5)*2,y:r.y+dy+(this.random()-.5)*2};
   const cells=r.cells.filter(c=>c.x>1&&c.y>1&&c.x<W-2&&c.y<H-2&&!this.cellBlocked(c.x,c.y)).sort((a,b)=>dist(a,target)-dist(b,target));
   for(let i=0;i<3;i++){const c=cells[i],n=this.add('deposit',-1,c.x+.5,c.y+.5);n.resource=resource;n.amount=2400;}
  }
 }
 generateRegions(){
  this.regions=[];
  for(let row=0;row<3;row++)for(let col=0;col<4;col++)this.regions.push({id:row*4+col,name:['Лесной край','Тихая долина','Северный тракт','Сосновый берег','Каменные поля','Срединные земли','Речная излучина','Высокий бор','Южные луга','Золотая низина','Старый рубеж','Красный предел'][row*4+col],x:Math.round((col+.5)*W/4+(this.random()-.5)*14),y:Math.round((row+.5)*H/3+(this.random()-.5)*14),owner:-1,neighbors:[],cells:[],outline:[],progress:0,capturing:-1});
  this.regionGrid=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>{
   const wx=x+.5+6*Math.sin(y/12)+3*Math.sin(x/19+y/23),wy=y+.5+5*Math.sin(x/17)+2*Math.sin(y/11);
   const r=this.regions.reduce((best,r)=>Math.hypot(wx-r.x,wy-r.y)<Math.hypot(wx-best.x,wy-best.y)?r:best,this.regions[0]);r.cells.push({x,y});return r.id;
  }));
  const at=(x,y)=>this.regionGrid[y]?.[x];
  for(const r of this.regions){
   const neighbors=new Set(),edges=new Map();
   for(const {x,y}of r.cells){
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const n=at(x+dx,y+dy);if(n!==undefined&&n!==r.id)neighbors.add(n);}
    if(at(x,y-1)!==r.id)edges.set(`${x},${y}`,[x+1,y]);
    if(at(x+1,y)!==r.id)edges.set(`${x+1},${y}`,[x+1,y+1]);
    if(at(x,y+1)!==r.id)edges.set(`${x+1},${y+1}`,[x,y+1]);
    if(at(x-1,y)!==r.id)edges.set(`${x},${y+1}`,[x,y]);
   }
   r.neighbors=[...neighbors];
   const first=edges.keys().next().value;let key=first;
   do{const [x,y]=key.split(',').map(Number);r.outline.push({x,y});const next=edges.get(key);if(!next)break;key=next.join(',');}while(key!==first&&r.outline.length<=edges.size);
   const simplify=points=>{if(points.length<3)return points;const a=points[0],b=points.at(-1),dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;let max=.8,index=-1;
    for(let i=1;i<points.length-1;i++){const p=points[i],t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0,d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);if(d>max){max=d;index=i;}}
    return index<0?[a,b]:[...simplify(points.slice(0,index+1)).slice(0,-1),...simplify(points.slice(index))];};
   // Split at three-way junctions, then simplify each shared border in a canonical direction.
   const outline=r.outline,borderNeighbors=outline.map((a,i)=>{const b=outline[(i+1)%outline.length];return b.x>a.x?at(a.x,a.y-1):b.y>a.y?at(a.x,a.y):b.x<a.x?at(b.x,a.y):at(a.x-1,b.y);});
   let firstJunction=borderNeighbors.findIndex((n,i)=>n!==borderNeighbors[(i+borderNeighbors.length-1)%borderNeighbors.length]);if(firstJunction<0)firstJunction=0;
   r.borderRuns=[];let run;
   for(let i=0;i<outline.length;i++){const k=(i+firstJunction)%outline.length,n=borderNeighbors[k]??-1,a=outline[k],b=outline[(k+1)%outline.length];if(!run||run.neighbor!==n){run={neighbor:n,points:[a]};r.borderRuns.push(run);}run.points.push(b);}
   for(const run of r.borderRuns){const a=run.points[0],b=run.points.at(-1),forward=a.x<b.x||a.x===b.x&&a.y<b.y;run.points=simplify(forward?run.points:[...run.points].reverse());if(!forward)run.points.reverse();}
   r.displayOutline=r.borderRuns.flatMap(run=>run.points.slice(0,-1));
   const center=r.cells.filter(c=>c.x>2&&c.y>2&&c.x<W-3&&c.y<H-3).sort((a,b)=>dist({x:a.x+.5,y:a.y+.5},r)-dist({x:b.x+.5,y:b.y+.5},r))[0];r.x=center.x;r.y=center.y;
   const tower=this.add('outpost',-1,r.x,r.y);tower.region=r.id;r.towerId=tower.id;
  }
  this.homeRegions=[0,11];for(let team=0;team<2;team++){const r=this.regions[this.homeRegions[team]];r.owner=team;this.get(r.towerId).team=team;}
 }
 regionAt(x,y){const id=this.regionGrid[Math.floor(y)]?.[Math.floor(x)];return id===undefined?null:this.regions[id];}
 canCapture(id,team=0){const r=this.regions[id];return !!r&&r.owner!==team&&r.neighbors.some(n=>this.regions[n].owner===team);}
 capture(ids,id,team=0){
  if(this.result||!this.canCapture(id,team)){if(team===0)this.message='Можно захватить только соседнюю с вашими владениями территорию.';return false;}
  const tower=this.get(this.regions[id].towerId);let count=0;
  for(const uid of ids){const u=this.get(uid);if(u?.team!==team||u.type!=='soldier')continue;this.release(u);u.order={type:'capture',id:tower.id};u.path=this.nearPath(u,tower);count++;}
  if(team===0)this.message=count?'Отряд направлен к башне. Удерживайте её 12 игровых секунд без противника рядом.':'Для захвата выберите солдат.';return count>0;
 }
 updateCaptures(dt){
  for(const r of this.regions){const tower=this.get(r.towerId),soldiers=this.alive().filter(u=>u.type==='soldier'&&dist(u,tower)<=3.5),teams=[0,1].filter(t=>soldiers.some(u=>u.team===t));
   if(teams.length===2)continue;
   const team=teams[0];if(team===undefined||team===r.owner||!this.canCapture(r.id,team)){r.progress=Math.max(0,r.progress-dt);if(!r.progress)r.capturing=-1;continue;}
   if(r.capturing!==team){r.capturing=team;r.progress=0;}r.progress+=dt;
   if(r.progress>=12){r.owner=team;tower.team=team;r.progress=0;r.capturing=-1;this.message=team===0?'Территория «'+r.name+'» присоединена. Теперь доступны её соседи.':'Противник захватил территорию «'+r.name+'».';}
  }
 }

 random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;}
 add(type,team,x,y){const s=stats[type]||{hp:1,size:1};const e={id:this.nextId++,type,team,x,y,hp:s.hp,maxHp:s.hp,size:s.size,path:[],order:null,job:null,training:null,carry:null,buffer:0,cool:0,queue:[],node:null,construction:0};this.entities.push(e);return e;}
 alive(){return this.entities.filter(e=>e.hp>0);}
 ready(b){return !!b&&b.hp>0&&b.construction<=0;}
 get(id){return this.entities.find(e=>e.id===id&&e.hp>0);}
 stock(team=0){return this.teams[team].stock;}
 population(team=0){const all=this.alive().filter(e=>e.team===team);return{total:all.filter(e=>stats[e.type]?.speed).length,workers:all.filter(e=>e.type==='worker').length,soldiers:all.filter(e=>e.type==='soldier').length,capacity:6+all.filter(e=>e.type==='house'&&this.ready(e)).length*4};}
 affordable(cost,team=0){return Object.entries(cost).every(([r,n])=>this.stock(team)[r]>=n);}
 pay(cost,team=0){if(!this.affordable(cost,team))return false;for(const [r,n]of Object.entries(cost))this.stock(team)[r]-=n;return true;}
 cellBlocked(x,y){return x<0||y<0||x>=W||y>=H||this.terrain[y][x]===1||this.alive().some(e=>!stats[e.type]?.speed&&Math.abs(x+.5-e.x)<e.size/2&&Math.abs(y+.5-e.y)<e.size/2);}
 path(sx,sy,tx,ty){
  sx=Math.floor(sx);sy=Math.floor(sy);tx=Math.floor(tx);ty=Math.floor(ty);
  if(sx<0||sy<0||sx>=W||sy>=H||this.cellBlocked(tx,ty))return [];
  const blocked=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)blocked[y*W+x]=this.terrain[y][x];
  for(const e of this.alive().filter(e=>!stats[e.type]?.speed))for(let y=Math.max(0,Math.floor(e.y-e.size/2));y<Math.min(H,Math.ceil(e.y+e.size/2));y++)for(let x=Math.max(0,Math.floor(e.x-e.size/2));x<Math.min(W,Math.ceil(e.x+e.size/2));x++)if(Math.abs(x+.5-e.x)<e.size/2&&Math.abs(y+.5-e.y)<e.size/2)blocked[y*W+x]=1;
  const start=sy*W+sx,goal=ty*W+tx;if(blocked[goal])return [];const prev=new Int32Array(W*H).fill(-1),cost=new Float64Array(W*H).fill(Infinity),heap=[];
  const heuristic=(x,y)=>{const dx=Math.abs(tx-x),dy=Math.abs(ty-y);return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy);};
  const push=n=>{let i=heap.length;heap.push(n);while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
  cost[start]=0;push({k:start,g:0,f:heuristic(sx,sy)});
  while(heap.length){const cur=pop(),k=cur.k,x=k%W,y=Math.floor(k/W);if(cur.g!==cost[k])continue;
   if(k===goal){const p=[];for(let n=k;n!==start;n=prev[n])p.push({x:n%W+.5,y:Math.floor(n/W)+.5});return p.reverse();}
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy,n=ny*W+nx;if(nx<0||ny<0||nx>=W||ny>=H||blocked[n])continue;
    if(dx&&dy&&(blocked[y*W+nx]||blocked[ny*W+x]))continue;
    const next=cur.g+(dx&&dy?Math.SQRT2:1);if(next<cost[n]){cost[n]=next;prev[n]=k;push({k:n,g:next,f:next+heuristic(nx,ny)});}
   }
  }return [];
 }
 nearPath(u,b){const cells=[],r=Math.ceil(b.size/2)+1;for(let y=Math.floor(b.y)-r;y<=Math.floor(b.y)+r;y++)for(let x=Math.floor(b.x)-r;x<=Math.floor(b.x)+r;x++)if(!this.cellBlocked(x,y))cells.push({x:x+.5,y:y+.5});cells.sort((a,c)=>dist(a,b)+dist(a,u)*.2-dist(c,b)-dist(c,u)*.2);for(const c of cells){const p=this.path(u.x,u.y,c.x,c.y);if(p.length||dist(u,c)<.1)return p;}return [];}
 adjacent(u,b){return Math.abs(u.x-b.x)<=b.size/2+.65&&Math.abs(u.y-b.y)<=b.size/2+.65;}
 walkTo(u,b,dt){if(this.adjacent(u,b))return true;if(!u.path.length)u.path=this.nearPath(u,b);this.move(u,dt);return this.adjacent(u,b);}
 move(u,dt){let n=stats[u.type].speed*dt;while(n>0&&u.path.length){const p=u.path[0];if(this.cellBlocked(Math.floor(p.x),Math.floor(p.y))){u.path=[];break;}const d=dist(u,p);if(d<=n){u.x=p.x;u.y=p.y;u.path.shift();n-=d;}else{u.x+=(p.x-u.x)*n/d;u.y+=(p.y-u.y)*n/d;n=0;}}}
 workers(b){return this.alive().filter(u=>u.type==='worker'&&u.job===b.id&&!u.training);}
 canBuild(type,x,y,team=0){const s=stats[type];if(this.result||!s?.cost||type==='base'||!Number.isInteger(x)||!Number.isInteger(y)||!this.affordable(s.cost,team))return false;
  if(!this.population(team).workers)return false;
  for(const dx of [-.5,.5])for(const dy of [-.5,.5])if(this.regionAt(x+dx,y+dy)?.owner!==team)return false;
  for(const dx of [-.5,.5])for(const dy of [-.5,.5])if(this.cellBlocked(Math.floor(x+dx),Math.floor(y+dy)))return false;
  if(this.alive().some(e=>stats[e.type]?.speed&&Math.abs(e.x-x)<1&&Math.abs(e.y-y)<1))return false;
  // Preserve a one-tile transport lane between buildings.
  if(this.alive().some(e=>e.team>=0&&!stats[e.type]?.speed&&Math.abs(e.x-x)<e.size/2+2&&Math.abs(e.y-y)<e.size/2+2))return false;
  if(s.resource&&s.resource!=='food'&&!this.alive().some(e=>e.type==='deposit'&&e.resource===s.resource&&e.amount>0&&dist(e,{x,y})<=5))return false;
  return true;
 }
 build(type,x,y,team=0){if(!this.canBuild(type,x,y,team)){if(team===0)this.message='Нельзя строить: проверьте цену, свободные 2×2 клетки, проход между зданиями (1) и принадлежность территории. Добывающее здание — в 5 клетках от залежи.';return false;}
  this.pay(stats[type].cost,team);const b=this.add(type,team,x,y);b.construction=stats[type].buildTime;if(stats[type].resource&&stats[type].resource!=='food')b.node=this.alive().filter(e=>e.type==='deposit'&&e.resource===stats[type].resource&&e.amount>0).sort((a,c)=>dist(a,b)-dist(c,b))[0].id;
  if(team===0)this.message='Строительство началось. После завершения можно назначить рабочих. Цена списана сразу.';return b;
 }
 release(u){if(u.training)return false;u.job=null;u.order=null;u.pickup=null;u.path=[];return true;}
 assign(ids,id,team=0){const b=this.get(id);if(!this.ready(b)||b.team!==team||!stats[b.type]?.slots||this.result)return 0;let n=0;for(const uid of ids){const u=this.get(uid);if(!u||u.type!=='worker'||u.team!==team||u.training||u.carry||u.job===b.id||this.workers(b).length>=stats[b.type].slots)continue;this.release(u);u.job=b.id;n++;}return n;}
 train(id,team=0){const b=this.get(id);if(this.result||!this.ready(b)||b.team!==team||b.type!=='barracks'||b.queue.length>=3||!this.affordable(soldierCost,team))return false;
  // Prefer idle carriers, but every worker can be retrained; population does not increase.
  const u=this.alive().filter(e=>e.team===team&&e.type==='worker'&&!e.training&&!e.carry).sort((a,c)=>Number(!!a.job)-Number(!!c.job)||dist(a,b)-dist(c,b))[0];if(!u)return false;
  this.pay(soldierCost,team);this.release(u);u.training=b.id;b.queue.push({id:u.id,left:6});return true;
 }
 demobilize(ids,team=0){if(this.result)return;for(const id of ids){const u=this.get(id);if(u?.team===team&&u.type==='soldier'){u.type='worker';u.maxHp=stats.worker.hp;u.hp=Math.min(u.hp,u.maxHp);u.order=null;u.path=[];}}}
 command(ids,x,y,targetId,team=0){if(this.result)return;const target=this.get(targetId);if(target?.type==='outpost'){this.capture(ids,target.region,team);return;}let index=0;const columns=Math.ceil(Math.sqrt(ids.length));for(const id of ids){const u=this.get(id);if(!u||u.team!==team||!stats[u.type]?.speed||u.training)continue;
  if(target?.team===team&&stats[target.type]?.slots&&u.type==='worker'){this.assign([id],target.id,team);continue;}
  this.release(u);if(target&&target.team>=0&&target.team!==team){u.order={type:'attack',id:target.id};u.path=this.nearPath(u,target);}else{u.order={type:'move'};const n=index++,tx=x+(n%columns-(columns-1)/2)*1.1,ty=y+(Math.floor(n/columns)-(Math.ceil(ids.length/columns)-1)/2)*1.1;u.path=this.path(u.x,u.y,this.cellBlocked(Math.floor(tx),Math.floor(ty))?x:tx,this.cellBlocked(Math.floor(tx),Math.floor(ty))?y:ty);}
 }}
 logistics(u,dt){
  if(u.carry){const stores=this.alive().filter(b=>b.team===u.team&&this.ready(b)&&['base','warehouse'].includes(b.type)).sort((a,b)=>dist(u,a)-dist(u,b));const b=stores[0];if(b&&this.walkTo(u,b,dt)){this.stock(u.team)[u.carry.resource]+=u.carry.amount;u.carry=null;u.path=[];}return;}
  if(u.job){const b=this.get(u.job);if(!b){u.job=null;u.path=[];return;}this.walkTo(u,b,dt);return;}
  let b=this.get(u.pickup);if(!b||b.buffer<4){u.pickup=null;u.path=[];b=this.alive().filter(e=>e.team===u.team&&e.buffer>=4).sort((a,c)=>c.buffer/(dist(c,u)+1)-a.buffer/(dist(a,u)+1))[0];if(b)u.pickup=b.id;}
  if(b&&this.walkTo(u,b,dt)){const amount=Math.min(20,Math.floor(b.buffer));if(amount){b.buffer-=amount;u.carry={resource:stats[b.type].resource,amount};}u.pickup=null;u.path=[];}
 }
 combat(e,dt){e.cool=Math.max(0,e.cool-dt);const s=stats[e.type],explicit=this.get(e.order?.id);let foes=this.alive().filter(t=>t.team>=0&&t.team!==e.team&&t.type!=='outpost'&&(t.type!=='base'||this.regionAt(t.x,t.y).owner===e.team)&&dist(e,t)<= (s.range||1.1)+(t.size-1)/2);
  foes.sort((a,b)=>Number(!stats[a.type]?.speed)-Number(!stats[b.type]?.speed)||dist(e,a)-dist(e,b));const foe=foes[0];
  if(foe){if(!e.cool){foe.hp-=s.damage||4;e.cool=1;}return true;}
  if(e.type==='tower')return false;
  if(e.order?.type==='attack'){if(!explicit){e.order=null;e.path=[];}else {if(!e.path.length)e.path=this.nearPath(e,explicit);this.move(e,dt);}return true;}
  const nearby=this.alive().filter(t=>t.team>=0&&t.team!==e.team&&t.type!=='outpost'&&(t.type!=='base'||this.regionAt(t.x,t.y).owner===e.team)&&dist(e,t)<6).sort((a,b)=>dist(e,a)-dist(e,b))[0];if(nearby){if(!e.path.length)e.path=this.nearPath(e,nearby);this.move(e,dt);return true;}return false;
 }
 findSite(type,team){const b=this.alive().find(e=>e.type==='base'&&e.team===team);if(!b)return null;const points=[];for(const r of this.regions.filter(r=>r.owner===team))for(const {x,y}of r.cells)if(x>1&&y>1&&x<W-1&&y<H-1&&this.canBuild(type,x,y,team))points.push({x,y});points.sort((a,c)=>dist(a,b)-dist(c,b));return points[0];}
 ai(){
  const team=1,buildings=this.alive().filter(e=>e.team===team&&!stats[e.type]?.speed),pop=this.population(team);
  for(const type of ['farm','sawmill','quarry','house','ironmine','goldmine','barracks'])if(!buildings.some(e=>e.type===type)){const p=this.findSite(type,team);if(p)this.build(type,p.x,p.y,team);break;}
  if(pop.total>=pop.capacity&&buildings.some(b=>b.type==='barracks')&&!buildings.some(b=>b.type==='house'&&!this.ready(b))){const p=this.findSite('house',team);if(p)this.build('house',p.x,p.y,team);}
  let idle=this.alive().filter(u=>u.team===team&&u.type==='worker'&&!u.job&&!u.training&&!u.carry);
  // Reserve at least two residents to transport resources.
  for(const type of ['farm','sawmill','quarry','ironmine','goldmine'])for(const b of buildings.filter(e=>e.type===type&&this.ready(e))){const need=type==='farm'?2:1;while(this.workers(b).length<need&&idle.length>2)this.assign([idle.shift().id],b.id,team);}
  const barracks=buildings.find(b=>b.type==='barracks');if(barracks&&pop.workers>10&&pop.soldiers<10)this.train(barracks.id,team);
  const army=this.alive().filter(e=>e.team===team&&e.type==='soldier'),base=this.alive().find(e=>e.team===0&&e.type==='base');
  if(base&&army.length>=3){
   if(this.regions[this.homeRegions[0]].owner===team)this.command(army.map(e=>e.id),base.x,base.y,base.id,team);
   else{const frontier=this.regions.filter(r=>this.canCapture(r.id,team)).sort((a,b)=>dist(a,base)-dist(b,base));if(frontier[0]){const target=frontier.find(r=>army.some(u=>u.order?.type==='capture'&&u.order.id===r.towerId))||frontier[0];if(!army.every(u=>u.order?.type==='capture'&&u.order.id===target.towerId))this.capture(army.map(e=>e.id),target.id,team);}}
  }
 }
 tick(dt){if(this.result)return;dt=Math.max(0,Math.min(dt,.1));this.time+=dt;this.economyClock+=dt;this.aiClock+=dt;
  for(const b of this.alive().filter(e=>e.construction>0)){b.construction=Math.max(0,b.construction-dt);if(b.construction<1e-8){b.construction=0;if(b.team===0)this.message='Строительство завершено. Выделите здание, чтобы назначить рабочих.';}}
  for(const team of [0,1]){const t=this.teams[team],pop=this.population(team),house=this.alive().find(b=>b.team===team&&b.type==='house'&&this.ready(b)),base=this.alive().find(b=>b.team===team&&b.type==='base');
   if(house&&base&&pop.total<pop.capacity&&t.stock.food>=8){t.birth+=dt;if(t.birth>=20){const cells=[];for(let y=Math.floor(house.y)-2;y<=Math.floor(house.y)+2;y++)for(let x=Math.floor(house.x)-2;x<=Math.floor(house.x)+2;x++)if(!this.cellBlocked(x,y))cells.push({x:x+.5,y:y+.5});const p=cells[0];if(p){t.stock.food-=8;this.add('worker',team,p.x,p.y);t.birth=0;}}}else t.birth=0;
  }
  for(const b of this.alive().filter(e=>!stats[e.type]?.speed&&e.team>=0&&this.ready(e))){
   const s=stats[b.type];if(s.resource){const count=this.workers(b).filter(u=>this.adjacent(u,b)).length;let amount=Math.min(60-b.buffer,count*s.rate*dt);if(s.resource!=='food'){let n=this.get(b.node);if(!n||n.amount<=0){n=this.alive().filter(e=>e.type==='deposit'&&e.resource===s.resource&&e.amount>0&&dist(e,b)<=5).sort((a,c)=>dist(a,b)-dist(c,b))[0];b.node=n?.id;}amount=Math.min(amount,n?.amount||0);if(n)n.amount-=amount;}b.buffer+=amount;}
   if(b.type==='tower')this.combat(b,dt);
   if(b.queue.length){const q=b.queue[0],u=this.get(q.id);if(!u){b.queue.shift();continue;}if(this.walkTo(u,b,dt)){q.left-=dt;if(q.left<=0){u.type='soldier';u.maxHp=stats.soldier.hp;u.hp=u.maxHp;u.training=null;u.path=[];b.queue.shift();}}}
  }
  for(const u of this.alive().filter(e=>stats[e.type]?.speed)){
   if(u.training){if(!this.get(u.training)){u.training=null;u.path=[];}continue;}
   if(u.type==='soldier'&&this.combat(u,dt))continue;
   if(u.order?.type==='attack'&&this.combat(u,dt))continue;
   if(u.order?.type==='capture'){const tower=this.get(u.order.id);if(tower)this.walkTo(u,tower,dt);else u.order=null;continue;}
   if(u.order?.type==='move'){this.move(u,dt);if(!u.path.length)u.order=null;continue;}
   if(u.type==='worker')this.logistics(u,dt);
  }
  this.updateCaptures(dt);
  if(this.economyClock>=5){this.economyClock-=5;for(const team of [0,1]){const t=this.teams[team],p=this.population(team);t.hungry=t.stock.food<p.total;t.unpaid=t.stock.gold<p.soldiers*.5;t.stock.food=Math.max(0,t.stock.food-p.total);t.stock.gold=Math.max(0,t.stock.gold-p.soldiers*.5);for(const u of this.alive().filter(e=>e.team===team&&stats[e.type]?.speed)){if(t.hungry)u.hp-=8;if(t.unpaid&&u.type==='soldier')u.hp-=8;}}}
  if(this.aiEnabled&&this.aiClock>=3){this.aiClock=0;this.ai();}
  const bases=[0,1].map(team=>this.alive().some(e=>e.type==='base'&&e.team===team));if(!bases[0])this.result='defeat';else if(!bases[1])this.result='victory';
  this.entities=this.entities.filter(e=>e.hp>0);
 }
}
const api={Game,stats,W,H,dist,resources,soldierCost};if(typeof module!=='undefined')module.exports=api;else root.RTS=api;
})(typeof window!=='undefined'?window:globalThis);
