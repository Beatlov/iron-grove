/* HELIOS H15: planetary economies, structure management, campaign fleets and automatic battles. */
(function(root){
'use strict';
const W=144,H=96,BW=48,BH=32,resources=['food','money','metal','crystals','gas','sulfur','weapons','ammo','armor','explosives','medicines'];
const resourceTiers={metal:1,crystals:1,gas:1,sulfur:1,weapons:2,ammo:2,armor:2,explosives:2,medicines:2};
const stats={
 worker:{hp:60,speed:2.1,size:1},
 soldier:{hp:140,speed:2.5,size:1,damage:18,range:5,armor:3,military:true,trainTime:10,food:1,money:1},
 assault:{hp:210,speed:3.1,size:1,damage:32,range:1.3,armor:5,military:true,trainTime:14,food:1,money:1.5},
 medic:{hp:100,speed:2.7,size:1,heal:16,range:5,military:true,trainTime:14,food:1,money:1.5},
 grenadier:{hp:130,speed:2.1,size:1,damage:22,buildingDamage:90,range:6.5,armor:2,military:true,trainTime:20,cooldown:2,food:2,money:2.5},
 base:{hp:1600,size:4,capacity:5000,cost:{}},house:{hp:300,size:3,buildTime:12,cost:{metal:35,money:20}},
 warehouse:{hp:450,size:3,capacity:500,buildTime:14,cost:{metal:25,money:15}},
 farm:{hp:350,size:3,buildTime:14,cost:{metal:25,money:20},resource:'food',slots:2},
 field:{hp:180,size:2,buildTime:8,cost:{metal:8,money:10}},
 ironmine:{hp:400,size:2,buildTime:18,cost:{metal:25,money:25},resource:'metal',slots:2,rate:1.4},
 goldmine:{hp:400,size:2,buildTime:18,cost:{metal:30,money:30},resource:'crystals',slots:2,rate:.9},
 gasstation:{hp:450,size:2,buildTime:20,cost:{metal:35,money:30},resource:'gas',slots:2,collector:true},
 sulfurstation:{hp:450,size:2,buildTime:20,cost:{metal:35,money:30},resource:'sulfur',slots:2,collector:true},
 chemical:{hp:550,size:4,capacity:240,buildTime:22,cost:{metal:50,money:40,crystals:10}},
 factory:{hp:550,size:4,capacity:240,buildTime:22,cost:{metal:50,money:40,crystals:10}},
 weaponshop:{hp:300,size:2,buildTime:12,cost:{metal:25,money:20},addon:'factory',resource:'weapons',slots:1,recipe:{metal:8,gas:2},cycle:8},
 ammoshop:{hp:300,size:2,buildTime:12,cost:{metal:25,money:20},addon:'factory',resource:'ammo',slots:1,recipe:{sulfur:3,metal:4},cycle:6},
 armorshop:{hp:300,size:2,buildTime:12,cost:{metal:25,money:20},addon:'factory',resource:'armor',slots:1,recipe:{metal:6,crystals:3},cycle:8},
 explosiveshop:{hp:300,size:2,buildTime:12,cost:{metal:25,money:20},addon:'factory',resource:'explosives',slots:1,recipe:{sulfur:3,gas:2,crystals:2},cycle:10},
 medicineshop:{hp:300,size:2,buildTime:12,cost:{metal:25,money:20},addon:'chemical',resource:'medicines',slots:1,recipe:{crystals:3,gas:2},cycle:8},
 guild:{hp:450,size:3,buildTime:16,cost:{metal:30,money:45},resource:'money',slots:2,rate:.15},
 barracks:{hp:650,size:4,buildTime:22,cost:{metal:45,money:40}},
 tower:{hp:800,size:2,buildTime:24,cost:{metal:50,money:45},damage:24,range:7}
};
const unitCosts={soldier:{weapons:2,ammo:1,armor:1,money:28},assault:{weapons:3,ammo:1,armor:2,money:38},medic:{medicines:2,armor:1,money:42},grenadier:{explosives:3,armor:2,money:65}};
const colonyCost={money:180,metal:80,crystals:15,food:30},workerCost={money:20},weaponRecipe=stats.weaponshop.recipe,ROAD_SPEED=2,FIELD_YIELD=4,SOW_TIME=.6,GROW_TIME=6,HIRE_TIME=8,HARVEST_TIME=.6,FOOD_PROCESS_TIME=.4,GAS_RADIUS=9,GAS_LOAD=4,GAS_GATHER_TIME=3,GAS_PACK_TIME=2;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),isMilitary=e=>!!stats[e?.type]?.military;
const footprint=e=>{const w=e.width||e.size,h=e.height||e.size;return{x:Math.floor(e.x-w/2),y:Math.floor(e.y-h/2),w,h};};
const placement=(type,x,y)=>{const s=stats[type],w=s.width||s.size,h=s.height||s.size;return{x:Math.round(x-w/2)+w/2,y:Math.round(y-h/2)+h/2};};
class Game{
 constructor(seed=Math.floor(Math.random()*0xffffffff),options={}){
  this.seed=seed>>>0;this.rng=this.seed;this.hasOpponent=options.opponent===true;this.aiEnabled=this.hasOpponent&&options.ai!==false;this.time=0;this.result=null;this.nextId=1;this.regions=[];this.maps={};this.military=[];this.missions=[];this.battles=[];this.history=[];this.effects=[];this.activePlanet=0;this.economyClock=0;this.aiClock=0;
  this.teams=[0,1].map(()=>({stock:{food:200,money:220,metal:180,crystals:60,gas:0,sulfur:0,weapons:8,ammo:8,armor:12,explosives:5,medicines:4},pending:Object.fromEntries(resources.map(r=>[r,0])),hungry:false,unpaid:false,desertion:0}));
  this.generateRegions();this.homeRegions=this.hasOpponent?[0,11]:[0];
  for(const [team,id]of this.homeRegions.entries()){this.regions[id].owner=team;const p=this.planet(id);const base=this.add('base',team,72,48,id);base.inventory={...this.teams[team].stock};for(let i=0;i<6;i++)this.add('worker',team,76.5,45.5+i,id);}
  for(const team of [0,1])for(const resource of resources)Object.defineProperty(this.teams[team].stock,resource,{enumerable:true,configurable:true,get:()=>this.available(resource,team),set:value=>{const delta=Math.max(0,value)-this.available(resource,team);if(delta>0)this.credit(resource,delta,team);else this.withdraw(resource,-delta,team);}});
  this.message='Новая кампания: развивайте поселение и готовьте экспедиции. Нейтральные миры охраняют враждебные гарнизоны.';if(this.initEncounters)this.initEncounters(options);
 }
 random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;}
 generateRegions(){
  this.regions=[];
  for(let row=0;row<3;row++)for(let col=0;col<4;col++)this.regions.push({id:row*4+col,name:['Гелиос','Феррум','Кассандра','Ковчег','Ржавый предел','Термос','Хальдор','Вега','Пепел','Ксенон','Рубеж','Инферна'][row*4+col],x:Math.round((col+.5)*W/4+(this.random()-.5)*14),y:Math.round((row+.5)*H/3+(this.random()-.5)*14),owner:-1,neighbors:[],cells:[],outline:[],progress:0,capturing:-1});
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

  }
 }
 regionAt(x,y){const id=this.regionGrid[Math.floor(y)]?.[Math.floor(x)];return id===undefined?null:this.regions[id];}
 planet(id=this.activePlanet){
  if(this.maps[id])return this.maps[id];if(!this.regions[id])return null;
  const p={id,seed:(this.seed^Math.imul(id+1,2654435761))>>>0,entities:[],roads:new Set(),terrain:Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>+(x===0||y===0||x===W-1||y===H-1)))};
  this.maps[id]=p;let n=p.seed;const rand=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  for(const [resource,dx,dy]of [['metal',-11,-8],['crystals',11,-8]])for(let i=0;i<3;i++){const e=this.add('deposit',-1,72+dx+(i%2)*1.5,48+dy+Math.floor(i/2)*1.5,id);e.resource=resource;e.amount=2400;}
  for(let i=0;i<18;i++){const x=6+Math.floor(rand()*(W-12)),y=6+Math.floor(rand()*(H-12));if(Math.hypot(x-72,y-48)<18)continue;const e=this.add('deposit',-1,x+.5,y+.5,id);e.resource=i%2?'metal':'crystals';e.amount=2000;}
  // Guaranteed vents sit beyond the initial metal/crystal belt on every planet.
  for(const [dx,dy]of [[-18,-12],[18,12]]){const e=this.add('deposit',-1,72+dx,48+dy,id);e.resource='gas';e.amount=1800;}
  for(let i=0;i<3;i++){const angle=rand()*Math.PI*2,radius=26+rand()*12;const e=this.add('deposit',-1,Math.round(72+Math.cos(angle)*radius)+.5,Math.round(48+Math.sin(angle)*radius)+.5,id);e.resource='gas';e.amount=1800;}
  for(const [dx,dy]of [[18,-17],[-22,15]]){const e=this.add('deposit',-1,72+dx,48+dy,id);e.resource='sulfur';e.amount=1800;}
  for(let i=0;i<3;i++){const e=this.add('deposit',-1,10+Math.floor(rand()*(W-20)),10+Math.floor(rand()*(H-20)),id);e.resource='sulfur';e.amount=1600;}
  return p;
 }
 switchPlanet(id,team=0){if(this.regions[id]?.owner!==team)return false;this.planet(id);this.activePlanet=id;return true;}
 alive(id=this.activePlanet){return this.planet(id)?.entities.filter(e=>e.hp>0)||[];}
 visible(id=this.activePlanet){const all=this.alive(id);return all.filter(e=>!e.inside&&!(e.type==='deposit'&&all.some(b=>['ironmine','goldmine'].includes(b.type)&&this.covers(b,e)&&stats[b.type].resource===e.resource)));}
 covers(b,e){const f=footprint(b);return e.x>=f.x&&e.x<f.x+f.w&&e.y>=f.y&&e.y<f.y+f.h;}
 hub(b){return ['factory','chemical'].includes(b?.type);}
 requirements(type){return Object.entries(unitCosts[type]||{}).filter(([r])=>r!=='money');}
 supplied(q){return this.requirements(q.type).every(([r,n])=>(q.deliveries[r]||0)>=n);}
 supplyTotal(q){return Object.values(q.deliveries).reduce((n,v)=>n+v,0);}
 supplyRequired(q){return this.requirements(q.type).reduce((n,[r,v])=>n+v,0);}
 canSupply(type,team=0,planet=this.activePlanet){return this.requirements(type).every(([r,n])=>this.available(r,team,planet)>=n);}
 all(){return Object.values(this.maps).flatMap(p=>p.entities.filter(e=>e.hp>0));}
 get(id){if(id==null)return null;return this.all().find(e=>e.id===id)||null;}
 add(type,team,x,y,planet=this.activePlanet){if(type==='deposit'){x=Math.floor(x)+.5;y=Math.floor(y)+.5;}const s=stats[type]||{hp:1,size:1},e={id:this.nextId++,type,team,x,y,planet,hp:s.hp,maxHp:s.hp,size:s.size,path:[],job:null,building:null,inside:null,carry:null,buffer:0,node:null,construction:0,builder:null,repairer:null,queue:[],hireQueue:[],parent:null,onDemand:false,cool:0,walkDistance:0,moving:false,facingX:1,facingY:0,action:0,phase:null,crop:0,fieldStage:type==='field'?'sowing':null,fieldWork:0,grown:0,growth:0,capacity:s.capacity||0,inventory:s.capacity?Object.fromEntries(resources.map(r=>[r,0])):null,waitForRipe:type==='farm'};this.planet(planet).entities.push(e);return e;}
 storages(team=0,planet=null){return this.all().filter(b=>b.team===team&&b.capacity>0&&this.ready(b)&&(planet===null||b.planet===planet));}
 stored(b){return b?.inventory?resources.reduce((n,r)=>n+b.inventory[r],0):0;}
 room(b){return Math.max(0,b.capacity-this.stored(b));}
 reservedAt(b,resource='weapons'){return this.all().filter(e=>e.team===b.team&&e.type==='barracks').reduce((n,e)=>n+e.queue.reduce((v,q)=>v+(q.allocations||[]).filter(a=>a.store===b.id&&a.resource===resource).reduce((t,a)=>t+a.amount,0),0),0);}
 available(resource,team=0,planet=null){return this.storages(team,planet).reduce((n,b)=>n+Math.max(0,b.inventory[resource]-this.reservedAt(b,resource)),0);}
 deposit(b,resource,amount){if(!this.ready(b)||!b.inventory||!resources.includes(resource))return 0;const moved=Math.min(Math.max(0,amount),this.inputRoom(b,resource));b.inventory[resource]+=moved;return moved;}
 credit(resource,amount,team=0,planet=null){let remaining=amount;const stores=this.storages(team).sort((a,b)=>(a.planet!==planet)-(b.planet!==planet));for(const b of stores){remaining-=this.deposit(b,resource,remaining);if(remaining<1e-8)break;}return Math.max(0,remaining);}
 refund(resource,amount,team=0){this.teams[team].pending[resource]+=this.credit(resource,amount,team);}
 withdraw(resource,amount,team=0){let left=amount;for(const b of this.storages(team)){const moved=Math.min(left,Math.max(0,b.inventory[resource]-this.reservedAt(b,resource)));b.inventory[resource]-=moved;left-=moved;if(left<1e-8)break;}return amount-left;}
 reserveWeapons(q,b,amount){this.reserveMaterial(q,b,'weapons',amount);}
 reserveMaterial(q,b,resource,amount){for(const store of this.storages(b.team,b.planet)){const moved=Math.min(amount,Math.max(0,store.inventory[resource]-this.reservedAt(store,resource)));if(moved>0){q.allocations.push({store:store.id,resource,amount:moved});if(resource==='weapons')q.reserved+=moved;amount-=moved;}if(amount<1e-8)break;}}
 addons(b){return this.alive(b.planet).filter(e=>e.parent===b.id&&e.team===b.team);}
 target(b){const r=stats[b.type]?.resource||'weapons';return r==='food'?Math.max(20,this.upkeep(b.team).food*3):({metal:80,crystals:30,gas:20,sulfur:20,weapons:10,ammo:10,armor:10,explosives:6,medicines:6,money:100}[r]||0);}
 productionNeeded(b){const parent=this.get(b.parent);return !(b.onDemand||parent?.onDemand)||this.available(stats[b.type]?.resource||'weapons',b.team,b.planet)<this.target(b);}
 setDemand(id,enabled,team=0){const b=this.get(id);if(this.result||b?.team!==team||!this.ready(b)||typeof enabled!=='boolean'||!this.isProducer(b))return false;b.onDemand=enabled;return true;}
 isProducer(b){return !!b&&(!!stats[b.type]?.resource||this.hub(b));}
 inputRoom(b,r){if(!this.hub(b))return this.room(b);if(resourceTiers[r]===2)return this.room(b);const need=this.addons(b).filter(a=>this.operational(a)&&this.workers(a).length&&this.productionNeeded(a)).reduce((n,a)=>n+(stats[a.type].recipe?.[r]||0)*2,0);return Math.max(0,Math.min(this.room(b),need-b.inventory[r]));}
 claimed(u,key,id){return this.alive(u.planet).some(w=>w.type==='worker'&&w.id!==u.id&&w[key]===id&&(key!=='field'||!w.phase));}
 productionView(b){let progress=0;const ws=this.workers(b);if(b.construction>0)progress=1-b.construction/stats[b.type].buildTime;else if(b.type==='base'&&b.hireQueue.length)progress=1-b.hireQueue[0].left/HIRE_TIME;else if(b.type==='barracks'&&b.queue.length){const q=b.queue[0];progress=this.supplied(q)?1-q.left/stats[q.type].trainTime:0;}else if(stats[b.type]?.recipe)progress=b.batch?1-b.batch/stats[b.type].cycle:0;else if(this.hub(b))progress=Math.max(0,...this.addons(b).map(a=>a.batch?1-a.batch/stats[a.type].cycle:0));else if(b.type==='field')progress=b.fieldStage==='growing'?b.growth/GROW_TIME:b.fieldStage==='harvest'?1:b.fieldWork/SOW_TIME;else if(b.type==='farm'||stats[b.type]?.collector)progress=Math.max(0,...ws.map(w=>w.phase==='process'?w.action/FOOD_PROCESS_TIME:w.phase==='gas-pack'?w.action/GAS_PACK_TIME:w.gasSource?w.action/GAS_GATHER_TIME:w.field?this.get(w.field)?.fieldStage==='sowing'?this.get(w.field).fieldWork/SOW_TIME:w.action/HARVEST_TIME:0));else if(stats[b.type]?.rate)progress=b.buffer%1;
  const parent=this.get(b.parent),store=stats[b.type]?.recipe?parent:b,used=store?.inventory?this.stored(store):b.type==='barracks'?b.queue.reduce((n,q)=>n+this.supplyTotal(q),0):b.buffer,capacity=store?.inventory?store.capacity:b.type==='barracks'?30:stats[b.type]?.resource&&b.type!=='guild'?60:0;return{progress:Math.max(0,Math.min(1,progress)),used,capacity,slots:stats[b.type]?.slots||0,occupied:ws.length};}
 resetField(f){f.fieldStage='sowing';f.fieldWork=0;f.grown=0;f.growth=0;f.crop=0;}
 stock(team=0){return this.teams[team].stock;}
 affordable(cost,team=0){return !!cost&&Object.entries(cost).every(([r,n])=>Number.isFinite(n)&&n>=0&&this.stock(team)[r]>=n);}
 pay(cost,team=0){if(!this.affordable(cost,team))return false;for(const [r,n]of Object.entries(cost))this.withdraw(r,n,team);return true;}
 ready(e){return !!e&&e.hp>0&&e.construction<=0;}
 operational(e){return this.ready(e)&&e.hp>=e.maxHp*.65;}
 population(team=0){const all=this.all().filter(e=>e.team===team),workers=all.filter(e=>e.type==='worker').length,soldiers=this.military.filter(u=>u.team===team&&u.hp>0).length,reserved=this.missions.filter(m=>m.team===team&&m.kind==='colony').length*6,hiring=all.filter(e=>e.type==='base').reduce((n,b)=>n+b.hireQueue.length,0),capacity=all.filter(e=>this.ready(e)).reduce((n,e)=>n+(e.type==='base'?6:e.type==='house'?4:0),0);return{workers,soldiers,reserved,hiring,total:workers+soldiers+reserved+hiring,capacity,free:Math.max(0,capacity-workers-soldiers-reserved-hiring)};}
 army(team=0,planet=this.activePlanet){return this.military.filter(u=>u.team===team&&u.hp>0&&u.location==='reserve'&&u.planet===planet);}
 income(team=0){return this.regions.filter(r=>r.owner===team).length*12+this.all().filter(b=>b.team===team&&b.type==='guild'&&this.operational(b)).reduce((n,b)=>n+this.workers(b).filter(u=>u.inside===b.id).length*3,0);}
 upkeep(team=0){const units=this.military.filter(u=>u.team===team&&u.hp>0&&u.location!=='training');return{food:this.population(team).workers+units.reduce((n,u)=>n+stats[u.type].food,0),money:units.reduce((n,u)=>n+stats[u.type].money,0)};}
 hire(id,team=0){const b=this.get(id);if(this.result||!this.operational(b)||b.type!=='base'||b.team!==team||this.regions[b.planet].owner!==team||b.hireQueue.length>=5||this.population(team).free<1||!this.pay(workerCost,team))return false;b.hireQueue.push({left:HIRE_TIME});this.message='Найм жителя: 8 игровых секунд. Место населения зарезервировано.';return true;}
 cancelHiring(b){for(const q of b.hireQueue)this.refund('money',workerCost.money,b.team);b.hireQueue=[];}
 freeNear(b){for(let r=2;r<10;r++)for(let y=Math.floor(b.y)-r;y<=Math.floor(b.y)+r;y++)for(let x=Math.floor(b.x)-r;x<=Math.floor(b.x)+r;x++)if(!this.cellBlocked(x,y,b.planet)&&!this.alive(b.planet).some(u=>u.type==='worker'&&!u.inside&&dist(u,{x:x+.5,y:y+.5})<.7))return{x:x+.5,y:y+.5};return{x:b.x+2.5,y:b.y};}
 cellBlocked(x,y,id=this.activePlanet){const p=this.planet(id);return !p||x<1||y<1||x>=W-1||y>=H-1||p.terrain[y]?.[x]===1||this.alive(id).some(e=>{if(stats[e.type]?.speed)return false;const f=footprint(e);return x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h;});}
 blockedGrid(id){const p=this.planet(id),out=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)out[y*W+x]=p.terrain[y][x];for(const e of this.alive(id).filter(e=>!stats[e.type]?.speed)){const f=footprint(e);for(let y=Math.max(0,f.y);y<Math.min(H,f.y+f.h);y++)for(let x=Math.max(0,f.x);x<Math.min(W,f.x+f.w);x++)out[y*W+x]=1;}return out;}
 path(sx,sy,tx,ty,id=this.activePlanet){
  sx=Math.floor(sx);sy=Math.floor(sy);tx=Math.floor(tx);ty=Math.floor(ty);if(sx<0||sy<0||sx>=W||sy>=H||this.cellBlocked(tx,ty,id))return[];
  const blocked=this.blockedGrid(id),roads=this.planet(id).roads,start=sy*W+sx,goal=ty*W+tx,prev=new Int32Array(W*H).fill(-1),cost=new Float64Array(W*H).fill(Infinity),offCost=new Float64Array(W*H).fill(Infinity),heap=[];
  const offHeuristic=k=>roads.size?0:Math.hypot(tx-k%W,ty-Math.floor(k/W));
  const compare=(a,b)=>(a.off+offHeuristic(a.k))-(b.off+offHeuristic(b.k))||a.f-b.f;
  const heuristic=(x,y)=>Math.hypot(tx-x,ty-y)/ROAD_SPEED;
  const push=n=>{let i=heap.length;heap.push(n);while(i){const p=(i-1)>>1;if(compare(heap[p],n)<=0)break;heap[i]=heap[p];i=p;}heap[i]=n;};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&compare(heap[c+1],heap[c])<0)c++;if(compare(heap[c],last)>=0)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
  cost[start]=0;offCost[start]=0;push({k:start,g:0,off:0,f:heuristic(sx,sy)});
  while(heap.length){const cur=pop(),k=cur.k,x=k%W,y=Math.floor(k/W);if(cur.g!==cost[k]||cur.off!==offCost[k])continue;if(k===goal){const out=[];for(let n=k;n!==start;n=prev[n])out.push({x:n%W+.5,y:Math.floor(n/W)+.5});return out.reverse();}
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy,n=ny*W+nx;if(nx<0||ny<0||nx>=W||ny>=H||blocked[n]||dx&&dy&&(blocked[y*W+nx]||blocked[ny*W+x]))continue;const length=dx&&dy?Math.SQRT2:1,roadStep=roads.has(n)&&(!dx||!dy||roads.has(y*W+nx)&&roads.has(ny*W+x)),next=cur.g+length/(roadStep?ROAD_SPEED:1),off=cur.off+(roadStep?0:length);if(off<offCost[n]-1e-8||Math.abs(off-offCost[n])<1e-8&&next<cost[n]){cost[n]=next;offCost[n]=off;prev[n]=k;push({k:n,g:next,off,f:next+heuristic(nx,ny)});}}
  }return[];
 }
 adjacent(u,b){const f=footprint(b);return u.x>=f.x-.65&&u.x<=f.x+f.w+.65&&u.y>=f.y-.65&&u.y<=f.y+f.h+.65;}
 nearPath(u,b){const cells=[],r=Math.ceil(b.size/2)+1;for(let y=Math.floor(b.y)-r;y<=Math.floor(b.y)+r;y++)for(let x=Math.floor(b.x)-r;x<=Math.floor(b.x)+r;x++)if(!this.cellBlocked(x,y,u.planet)&&this.adjacent({x:x+.5,y:y+.5},b))cells.push({x:x+.5,y:y+.5});const roads=this.planet(u.planet).roads;cells.sort((a,c)=>Number(roads.has(Math.floor(c.y)*W+Math.floor(c.x)))-Number(roads.has(Math.floor(a.y)*W+Math.floor(a.x)))||dist(a,b)+dist(a,u)*.2-dist(c,b)-dist(c,u)*.2);for(const c of cells){const p=this.path(u.x,u.y,c.x,c.y,u.planet);if(p.length||dist(c,u)<.1)return p;}return[];}
 move(u,dt){let time=dt;const ox=u.x,oy=u.y,p=this.planet(u.planet);while(time>0&&u.path.length){const target=u.path[0];if(this.cellBlocked(Math.floor(target.x),Math.floor(target.y),u.planet)){u.path=[];break;}const speed=stats.worker.speed*(p.roads.has(Math.floor(target.y)*W+Math.floor(target.x))?ROAD_SPEED:1),d=dist(u,target),step=speed*time;if(d<=step){u.x=target.x;u.y=target.y;u.path.shift();time-=d/speed;}else{u.x+=(target.x-u.x)*step/d;u.y+=(target.y-u.y)*step/d;time=0;}}const dx=u.x-ox,dy=u.y-oy,d=Math.hypot(dx,dy);if(d>.00001){u.moving=true;u.walkDistance+=d;u.facingX=dx/d;u.facingY=dy/d;}}
 walkTo(u,b,dt){const roads=this.planet(u.planet).roads,onRoad=()=>roads.has(Math.floor(u.y)*W+Math.floor(u.x)),roadGoal=[...roads].some(k=>this.adjacent({x:k%W+.5,y:Math.floor(k/W)+.5},b));if(this.adjacent(u,b)&&(onRoad()||!roadGoal)){u.path=[];return true;}if(!u.path.length){if((u.retry||0)>this.time)return false;u.path=this.nearPath(u,b);if(!u.path.length)u.retry=this.time+2;}this.move(u,dt);const arrived=this.adjacent(u,b)&&(!u.path.length||onRoad());if(arrived)u.path=[];return arrived;}
 canBuild(type,x,y,team=0,id=this.activePlanet,parent=null,options={}){const s=stats[type],relocating=options.relocating===true,ignore=new Set(options.ignore||[]),scene=this.alive(id).filter(e=>!ignore.has(e.id));if(this.result||!s?.cost||type==='base'&&!relocating||this.regions[id]?.owner!==team||!this.alive(id).some(e=>e.type==='base'&&e.team===team&&this.ready(e))||!relocating&&!this.affordable(s.cost,team))return false;
  const host=options.host||this.get(parent);if(s.addon&&(!(relocating&&options.host?this.ready(host):this.operational(host))||host.type!==s.addon||host.team!==team||host.planet!==id||this.addons(host).some(a=>a.type===type&&!ignore.has(a.id))))return false;
  const w=s.width||s.size,h=s.height||s.size;if(!Number.isInteger(x-w/2)||!Number.isInteger(y-h/2))return false;const f=footprint({x,y,size:s.size,width:w,height:h}),roads=this.planet(id).roads;
  const ore=['metal','crystals'].includes(s.resource),covered=scene.filter(e=>e.type==='deposit'&&e.resource===s.resource&&e.amount>0&&this.covers({x,y,size:s.size},e));if(ore&&!covered.length)return false;
  for(let cy=f.y;cy<f.y+h;cy++)for(let cx=f.x;cx<f.x+w;cx++){if(cx<1||cy<1||cx>=W-1||cy>=H-1||this.planet(id).terrain[cy]?.[cx]===1||roads.has(cy*W+cx))return false;if(scene.some(e=>!stats[e.type]?.speed&&!(ore&&e.type==='deposit'&&e.resource===s.resource)&&this.covers(e,{x:cx+.5,y:cy+.5})))return false;}
  if(scene.some(e=>e.type==='worker'&&!e.inside&&e.x>=f.x&&e.x<f.x+w&&e.y>=f.y&&e.y<f.y+h))return false;
  if(s.addon){const h=footprint(host),edge=(f.x+w===h.x||h.x+h.w===f.x)&&f.y<h.y+h.h&&f.y+f.h>h.y||(f.y+f.h===h.y||h.y+h.h===f.y)&&f.x<h.x+h.w&&f.x+w>h.x;if(!edge)return false;}
  if(scene.some(e=>{if(stats[e.type]?.speed||e.team<0||e.id===parent)return false;const b=footprint(e);return f.x<b.x+b.w+1&&f.x+w+1>b.x&&f.y<b.y+b.h+1&&f.y+h+1>b.y;}))return false;
  if(s.collector&&scene.some(e=>e.type==='deposit'&&e.resource===s.resource&&dist(e,{x,y})<4))return false;return true;
 }
 build(type,x,y,team=0,id=this.activePlanet,parent=null){if(!this.canBuild(type,x,y,team,id,parent)){if(team===0)this.message='Нужно своё поселение, ресурсы, свободное место и проход между зданиями. Шахта должна стоять на своей залежи. Сборный пункт — не ближе 4 клеток к своему источнику; пристройка — вплотную к заводу.';return false;}this.pay(stats[type].cost,team);const b=this.add(type,team,x,y,id);b.construction=stats[type].buildTime;b.parent=parent;if(['metal','crystals'].includes(stats[type].resource))b.node=this.alive(id).filter(e=>e.type==='deposit'&&e.resource===stats[type].resource&&e.amount>0).sort((a,c)=>dist(a,b)-dist(c,b))[0]?.id;this.message='Участок размещён. Свободный житель автоматически подойдёт и построит здание.';return b;}
 // Player-managed removal/movement is atomic; combat destruction retains its separate rules.
 manageable(id,team=0){const b=this.get(id);return !!b&&!!stats[b.type]?.cost&&b.team===team&&this.regions[b.planet]?.owner===team&&!this.result&&!this.activeBattle?.();}
 structureGroup(id){const b=this.get(id);return b?[b,...this.addons(b)]:[];}
 canDemolish(id,team=0){const b=this.get(id);return this.manageable(id,team)&&this.ready(b)&&(b.type!=='base'||this.storages(team).some(e=>e.type==='base'&&e.id!==id));}
 cancelConstruction(id,team=0){const b=this.get(id);if(!this.manageable(id,team)||!(b.construction>0))return false;return this.removeStructure(b,true);}
 demolish(id,team=0){if(!this.canDemolish(id,team))return false;return this.removeStructure(this.get(id),false);}
 removeStructure(b,cancel){
  const group=this.structureGroup(b.id),ids=new Set(group.map(e=>e.id)),team=b.team,goods=Object.fromEntries(resources.map(r=>[r,0]));
  for(const e of group){if(cancel||e.construction>0)for(const [r,n]of Object.entries(stats[e.type].cost))goods[r]+=n;if(e.inventory)for(const r of resources)goods[r]+=e.inventory[r];if(e.buffer&&stats[e.type].resource)goods[stats[e.type].resource]+=e.buffer;if(e.batch&&stats[e.type].recipe)for(const [r,n]of Object.entries(stats[e.type].recipe))goods[r]+=n;e.hp=0;}
  for(const e of group){for(const q of e.queue){goods.money+=unitCosts[q.type].money;this.cancelTraining(e,q);}e.queue=[];this.cancelHiring(e);}
  for(const u of this.alive(b.planet).filter(e=>e.type==='worker')){
   if(ids.has(u.job)||ids.has(u.building)||ids.has(u.inside)){
    if(ids.has(u.job)&&['return','process'].includes(u.phase)&&stats[group.find(e=>e.id===u.job)?.type]?.resource==='food')goods.food+=4;
    if(u.inside)Object.assign(u,this.freeNear(group.find(e=>e.id===u.inside)||b));this.release(u);
   }else if(ids.has(u.field)){u.field=null;u.path=[];if(!u.phase)u.action=0;}
   u.path=[];u.retry=0;if(ids.has(u.pickup))u.pickup=null;if(ids.has(u.dropoff))u.dropoff=null;if(u.supply&&(ids.has(u.supply.store)||ids.has(u.supply.target)))u.supply=null;if(u.transfer&&(ids.has(u.transfer.from)||ids.has(u.transfer.to)))u.transfer=null;
  }
  for(const barracks of this.all().filter(e=>e.type==='barracks'))for(const q of barracks.queue){q.allocations=q.allocations.filter(a=>!ids.has(a.store));q.reserved=q.allocations.filter(a=>a.resource==='weapons').reduce((n,a)=>n+a.amount,0);}
  for(const [r,n]of Object.entries(goods))if(n>0)this.refund(r,n,team);
  this.message=cancel?'Строительство отменено. Стоимость возвращена, работник свободен.':'Здание снесено'+(group.length>1?' вместе с пристройками':'')+'. Запасы сохранены; стоимость готовых построек не возвращается.';return true;
 }
 movePlan(id,x,y,team=0){
  const b=this.get(id);if(!this.manageable(id,team)||!Number.isFinite(x)||!Number.isFinite(y))return null;
  const group=this.structureGroup(id),ignore=group.map(e=>e.id),dx=x-b.x,dy=y-b.y;if(!dx&&!dy)return null;
  const hosts=stats[b.type].addon?[this.get(b.parent),...this.alive(b.planet).filter(e=>e.id!==b.parent&&e.team===team&&e.type===stats[b.type].addon)]:[null];
  for(const host of hosts){let valid=true;const moves=[];for(const e of group){const parent=e.id===id?host?.id||null:e.parent,projected=e.id===id?null:{...b,x,y},px=e.x+dx,py=e.y+dy;
    if(!this.canBuild(e.type,px,py,team,e.planet,parent,{relocating:true,ignore,host:projected})){valid=false;break;}moves.push({id:e.id,x:px,y:py,parent});
   }if(valid)return moves;
  }return null;
 }
 moveBuilding(id,x,y,team=0){const plan=this.movePlan(id,x,y,team);if(!plan)return false;const moved=new Set(plan.map(e=>e.id)),b=this.get(id);
  for(const m of plan){const e=this.get(m.id);e.x=m.x;e.y=m.y;e.parent=m.parent;e.retry=0;if(['metal','crystals'].includes(stats[e.type].resource))e.node=this.alive(e.planet).find(n=>n.type==='deposit'&&n.resource===stats[e.type].resource&&n.amount>0&&this.covers(e,n))?.id;}
  for(const u of this.alive(b.planet).filter(e=>e.type==='worker')){u.path=[];u.retry=0;const inside=this.get(u.inside);if(inside&&moved.has(inside.id))Object.assign(u,this.freeNear(inside));if(!u.inside&&this.cellBlocked(Math.floor(u.x),Math.floor(u.y),u.planet))Object.assign(u,this.freeNear(b));}
  this.message='Здание перенесено'+(plan.length>1?' вместе с пристройками':'')+'. Запасы, назначения и прогресс сохранены.';return true;
 }
 findAddonSite(parent,type='weaponshop',team=0){const b=this.get(parent);if(!b||!this.affordable(stats[type]?.cost,team))return null;const f=footprint(b),size=stats[type].size;for(let y=f.y-size;y<=f.y+f.h;y++)for(let x=f.x-size;x<=f.x+f.w;x++){const pos={x:x+size/2,y:y+size/2};if(this.canBuild(type,pos.x,pos.y,team,b.planet,parent))return pos;}return null;}
 findSite(type,team=0,id=this.activePlanet){if(!this.affordable(stats[type]?.cost,team))return null;const base=this.alive(id).find(e=>e.type==='base'&&e.team===team);if(!base)return null;for(let r=4;r<60;r++)for(let y=Math.floor(base.y)-r;y<=Math.floor(base.y)+r;y++)for(let x=Math.floor(base.x)-r;x<=Math.floor(base.x)+r;x++){if(Math.abs(x-base.x)<r-1&&Math.abs(y-base.y)<r-1)continue;const pos=placement(type,x,y);if(this.canBuild(type,pos.x,pos.y,team,id))return pos;}return null;}
 roadPlan(cells,team=0,id=this.activePlanet){const p=this.planet(id),unique=new Map();for(const c of cells||[])if(Number.isInteger(c.x)&&Number.isInteger(c.y))unique.set(c.y*W+c.x,{x:c.x,y:c.y});else return{cells:[],blocked:[],cost:{money:0,metal:0},valid:false};const fresh=[...unique.values()].filter(c=>!p.roads.has(c.y*W+c.x)),blocked=fresh.filter(c=>this.cellBlocked(c.x,c.y,id)),cost={money:fresh.length,metal:fresh.length};return{cells:fresh,blocked,cost,valid:!this.result&&this.regions[id]?.owner===team&&this.alive(id).some(b=>b.type==='base'&&b.team===team&&this.ready(b))&&!blocked.length&&this.affordable(cost,team)};}
 buildRoads(cells,team=0,id=this.activePlanet){const plan=this.roadPlan(cells,team,id);if(!plan.valid||!plan.cells.length||!this.pay(plan.cost,team))return false;const p=this.planet(id);for(const c of plan.cells)p.roads.add(c.y*W+c.x);for(const u of this.alive(id).filter(e=>e.type==='worker'))u.path=[];return true;}
 road(x,y,team=0,id=this.activePlanet){return this.buildRoads([{x,y}],team,id);}

 workers(b){return this.alive(b.planet).filter(e=>e.type==='worker'&&e.job===b.id&&e.team===b.team);}
 release(u){const site=this.get(u.building);if(site?.builder===u.id)site.builder=null;if(site?.repairer===u.id)site.repairer=null;u.job=null;u.building=null;u.inside=null;u.path=[];u.phase=null;u.field=null;u.action=0;u.retry=0;u.pickup=null;u.supply=null;u.gasSource=null;u.gasWaiting=false;u.transfer=null;}
 assign(id,team=0){const b=this.get(id);if(this.result||!this.operational(b)||b.team!==team||this.regions[b.planet].owner!==team||!stats[b.type]?.slots||this.workers(b).length>=stats[b.type].slots)return false;const u=this.alive(b.planet).filter(e=>e.type==='worker'&&e.team===team&&!e.job&&!e.building&&!e.carry).sort((a,c)=>dist(a,b)-dist(c,b))[0];if(!u)return false;this.release(u);u.job=b.id;return true;}
 setHarvestWaiting(id,wait,team=0){const b=this.get(id);if(this.result||b?.type!=='farm'||b.team!==team||!this.ready(b)||this.regions[b.planet].owner!==team||typeof wait!=='boolean')return false;b.waitForRipe=wait;for(const u of this.workers(b))if(!u.phase){u.field=null;u.path=[];u.action=0;u.retry=0;}return true;}
 unassign(id,team=0){const b=this.get(id),u=b&&b.team===team&&this.workers(b).at(-1);if(!u||this.result)return false;this.release(u);return true;}
 construction(p,dt){const worked=new Set();for(const b of p.entities)if(b.repairer&&!this.get(b.repairer))b.repairer=null;const free=()=>p.entities.filter(e=>e.hp>0&&e.type==='worker'&&!e.job&&!e.building&&!e.carry&&!worked.has(e.id));
  for(const b of p.entities.filter(e=>e.hp>0&&e.construction>0)){let u=this.get(b.builder);if(!u||u.building!==b.id){b.builder=null;u=null;}if(!u){if((b.retry||0)>this.time)continue;for(const candidate of free().filter(e=>e.team===b.team).sort((a,c)=>dist(a,b)-dist(c,b))){const path=this.adjacent(candidate,b)?[]:this.nearPath(candidate,b);if(path.length||this.adjacent(candidate,b)){u=candidate;this.release(u);u.path=path;u.building=b.id;b.builder=u.id;break;}}if(!u){b.retry=this.time+2;continue;}}
   if(this.adjacent(u,b)&&!u.path.length){worked.add(u.id);b.construction=Math.max(0,b.construction-dt);if(b.construction<1e-8){b.construction=0;b.builder=null;u.building=null;u.path=[];}}
  }
 }
 production(b,dt){if(!this.operational(b))return;const s=stats[b.type],inside=this.workers(b).filter(u=>u.inside===b.id).length;
  if(b.type==='base'&&b.hireQueue.length){const q=b.hireQueue[0];q.left=Math.max(0,q.left-dt);if(q.left<1e-8){b.hireQueue.shift();const point=this.freeNear(b);this.add('worker',b.team,point.x,point.y,b.planet);}}
  if(b.type==='field'){if(b.fieldStage==='growing'){b.growth=Math.min(GROW_TIME,b.growth+dt);const grown=Math.min(FIELD_YIELD,Math.floor((b.growth+1e-8)/GROW_TIME*FIELD_YIELD));b.crop+=grown-b.grown;b.grown=grown;if(b.growth>=GROW_TIME-1e-8){b.growth=GROW_TIME;b.fieldStage='harvest';if(b.crop===0)this.resetField(b);}}return;}
  if(!b.batch&&this.isProducer(b)&&!this.productionNeeded(b))return;
  if(b.type==='guild'){this.credit('money',inside*s.rate*dt,b.team,b.planet);return;}
  if(['metal','crystals'].includes(s.resource)&&inside){let node=this.get(b.node);if(!node||node.amount<=0){node=this.alive(b.planet).filter(e=>e.type==='deposit'&&e.resource===s.resource&&e.amount>0&&this.covers(b,e)).sort((a,c)=>dist(a,b)-dist(c,b))[0];b.node=node?.id;}const amount=Math.min(60-b.buffer,inside*s.rate*dt,node?.amount||0);if(node)node.amount-=amount;b.buffer+=amount;}
  if(s.recipe&&inside){const host=this.get(b.parent);if(!this.operational(host)||host.team!==b.team||host.type!==s.addon)return;if(!b.batch){if(!Object.entries(s.recipe).every(([r,n])=>host.inventory[r]>=n))return;for(const [r,n]of Object.entries(s.recipe))host.inventory[r]-=n;b.batch=s.cycle;}b.batch=Math.max(1e-9,b.batch-dt);if(b.batch<1e-8&&this.room(host)>=1){b.batch=0;host.inventory[s.resource]++;}}


  if(b.type==='barracks'&&b.queue.length){const q=b.queue[0],u=this.military.find(u=>u.id===q.id&&u.hp>0);if(!u){this.cancelTraining(b,q);b.queue.shift();return;}if(!this.supplied(q))return;q.left-=dt;if(q.left<=0){u.location='reserve';b.queue.shift();}}
 }
 packGas(u,b,dt){if(!this.operational(b))return;if(this.walkTo(u,b,dt)){u.inside=b.id;u.phase='gas-pack';u.action=Math.min(GAS_PACK_TIME,u.action+dt);if(u.action>=GAS_PACK_TIME&&b.buffer+u.carry.amount<=60){b.buffer+=u.carry.amount;u.carry=null;u.inside=null;u.phase=null;u.action=0;u.path=[];}}}
 worker(u,dt){u.moving=false;if(u.building&&!this.get(u.building))this.release(u);if(u.job&&!this.get(u.job))this.release(u);
  if(u.building){const b=this.get(u.building);if(b.construction>0){this.walkTo(u,b,dt);return;}if(b.hp<b.maxHp&&b.team===u.team){if(this.walkTo(u,b,dt)){u.action+=dt;if(u.action>=1){u.action-=1;if(this.pay({metal:1},u.team))b.hp=Math.min(b.maxHp,b.hp+12);else{b.repairer=null;this.release(u);u.repairRetry=this.time+5;}}}return;}b.repairer=null;this.release(u);}
  // Raw gas must be sealed at a station before carriers can store it, even after unassignment.
  if(u.carry?.raw){let station=this.get(u.carry.station);if(station?.team!==u.team||stats[station.type]?.resource!==u.carry.resource){station=this.alive(u.planet).filter(e=>stats[e.type]?.collector&&stats[e.type].resource===u.carry.resource&&e.team===u.team&&this.ready(e)).sort((a,c)=>dist(a,u)-dist(c,u))[0];if(station){u.carry.station=station.id;u.path=[];u.inside=null;u.phase=null;u.action=0;}}if(station)this.packGas(u,station,dt);return;}
  if(u.job){const b=this.get(u.job);if(!this.ready(b)){this.release(u);return;}if(!this.operational(b))return;
   if(stats[b.type]?.collector){
    if(b.buffer>60-GAS_LOAD||!this.productionNeeded(b)){u.gasSource=null;u.path=[];u.action=0;return;}
    let source=this.get(u.gasSource);if(!source||source.type!=='deposit'||source.resource!==stats[b.type].resource||source.amount<=0||this.claimed(u,'gasSource',source.id)){source=this.alive(u.planet).filter(e=>e.type==='deposit'&&e.resource===stats[b.type].resource&&e.amount>0&&!this.claimed(u,'gasSource',e.id)).sort((a,c)=>dist(a,u)-dist(c,u))[0];if(u.gasSource!==source?.id){u.path=[];u.action=0;u.retry=0;}u.gasSource=source?.id;}
    const waiting=!source||b.buffer>60-GAS_LOAD;if(!!u.gasWaiting!==waiting){u.gasWaiting=waiting;u.path=[];u.retry=0;u.action=0;}
    if(waiting||!this.productionNeeded(b)){if(u.inside!==b.id&&this.walkTo(u,b,dt)){u.inside=b.id;u.path=[];}return;}
    u.inside=null;if(this.walkTo(u,source,dt)){u.action+=dt;if(u.action>=GAS_GATHER_TIME){const amount=Math.min(GAS_LOAD,source.amount);source.amount-=amount;u.carry={resource:stats[b.type].resource,amount,raw:true,station:b.id};u.phase=null;u.action=0;u.path=[];u.gasSource=null;}}return;
   }
   if(b.type==='farm'){
    if(u.phase==='process'){u.action+=dt;if(u.action>=FOOD_PROCESS_TIME&&b.buffer<=56){b.buffer+=4;u.phase=null;u.field=null;u.action=0;u.inside=null;}return;}
    if(u.phase==='return'){if(this.walkTo(u,b,dt)){u.phase='process';u.inside=b.id;u.action=0;u.path=[];}return;}
    if(b.buffer+4>60||!this.productionNeeded(b)){u.field=null;u.path=[];u.action=0;return;}
    const fields=this.alive(u.planet).filter(f=>f.type==='field'&&f.team===u.team&&this.operational(f)&&dist(f,b)<=9&&!this.claimed(u,'field',f.id));
    const harvestable=f=>fields.includes(f)&&f.crop>=4&&(!b.waitForRipe||f.fieldStage==='harvest');
    let f=this.get(u.field);if(!harvestable(f)&&!fields.some(e=>e===f&&f.fieldStage==='sowing')){f=fields.filter(harvestable).sort((a,c)=>dist(a,u)-dist(c,u))[0]||fields.filter(e=>e.fieldStage==='sowing').sort((a,c)=>dist(a,u)-dist(c,u))[0];if(u.field!==f?.id){u.path=[];u.retry=0;}u.field=f?.id;u.action=0;}
    if(!f){if(u.inside!==b.id&&this.walkTo(u,b,dt)){u.inside=b.id;u.path=[];}return;}
    u.inside=null;
    if(this.walkTo(u,f,dt)){
     if(f.fieldStage==='sowing'){f.fieldWork=Math.min(SOW_TIME,f.fieldWork+dt);if(f.fieldWork>=SOW_TIME-1e-8){f.fieldStage='growing';f.fieldWork=SOW_TIME;f.growth=0;f.grown=0;u.field=null;u.path=[];u.action=0;}return;}
     if(harvestable(f)){u.action+=dt;if(u.action>=HARVEST_TIME){f.crop-=4;if(f.fieldStage==='harvest'&&f.crop===0)this.resetField(f);u.action=0;u.phase='return';u.path=[];}}}
    return;
   }
   if(u.inside===b.id)return;if(this.walkTo(u,b,dt)){u.inside=b.id;u.path=[];}return;
  }
  if(u.inside)u.inside=null;
  if(u.carry?.order){const b=this.get(u.carry.target),q=this.supplyOrder(b,u.carry.order,u.team);if(q){if(this.walkTo(u,b,dt)){q.deliveries[u.carry.resource]=(q.deliveries[u.carry.resource]||0)+u.carry.amount;q.delivered=q.deliveries.weapons||0;u.carry=null;u.path=[];}return;}delete u.carry.order;delete u.carry.target;u.path=[];}
  if(u.carry?.to){const target=this.get(u.carry.to);if(target?.team===u.team&&this.ready(target)&&this.inputRoom(target,u.carry.resource)>0){if(this.walkTo(u,target,dt)){u.carry.amount-=this.deposit(target,u.carry.resource,u.carry.amount);if(u.carry.amount<1e-8)u.carry=null;u.path=[];}return;}delete u.carry.to;u.path=[];}
  if(u.carry){let store=this.get(u.dropoff);if(!store||store.team!==u.team||!this.ready(store)||this.inputRoom(store,u.carry.resource)<1e-8){store=this.storages(u.team,u.planet).filter(e=>this.inputRoom(e,u.carry.resource)>=1).sort((a,c)=>dist(a,u)-dist(c,u)).find(e=>this.adjacent(u,e)||this.nearPath(u,e).length);u.dropoff=store?.id;u.path=[];u.retry=0;}if(store&&this.walkTo(u,store,dt)){u.carry.amount-=this.deposit(store,u.carry.resource,u.carry.amount);if(u.carry.amount<1e-8)u.carry=null;u.dropoff=null;u.path=[];}return;}
  const broken=this.alive(u.planet).filter(b=>b.team===u.team&&this.ready(b)&&b.type!=='worker'&&b.hp<b.maxHp&&!b.repairer).sort((a,c)=>dist(a,u)-dist(c,u))[0];if(broken&&this.stock(u.team).metal>=1&&(u.repairRetry||0)<=this.time){this.release(u);u.building=broken.id;broken.repairer=u.id;return;}
  // Each reserved military material stays in its source inventory until pickup.
  for(const target of this.alive(u.planet).filter(e=>e.team===u.team&&e.type==='barracks'&&this.ready(e)))for(const order of target.queue){
   if(!this.supplyOrder(target,order.id,u.team))continue;order.allocations=order.allocations.filter(a=>{const store=this.get(a.store);return store?.team===u.team&&this.ready(store);});
   for(const [r,n]of this.requirements(order.type)){const reserved=order.allocations.filter(a=>a.resource===r).reduce((v,a)=>v+a.amount,0),transit=this.alive(u.planet).filter(w=>w.carry?.order===order.id&&w.carry.resource===r).reduce((v,w)=>v+w.carry.amount,0),missing=n-(order.deliveries[r]||0)-reserved-transit;if(missing>0)this.reserveMaterial(order,target,r,missing);}order.reserved=order.allocations.filter(a=>a.resource==='weapons').reduce((n,a)=>n+a.amount,0);
  }
  let delivery=u.supply,b=delivery&&this.get(delivery.target),q=delivery&&this.supplyOrder(b,delivery.order,u.team);
  if(!q||!q.allocations.some(a=>a.store===delivery.store&&a.amount>0)){u.supply=null;delivery=null;}
  if(!delivery){for(const target of this.alive(u.planet).filter(e=>e.team===u.team&&e.type==='barracks'&&this.ready(e))){for(const order of target.queue){if(!this.supplyOrder(target,order.id,u.team)||!order.allocations.length||this.alive(u.planet).some(w=>w.supply?.order===order.id))continue;
    const store=order.allocations.map(a=>this.get(a.store)).filter(Boolean).sort((a,c)=>dist(a,u)-dist(c,u)).find(e=>this.adjacent(u,e)||this.nearPath(u,e).length);if(store){delivery=u.supply={target:target.id,order:order.id,store:store.id};b=target;q=order;u.path=[];u.pickup=null;u.transfer=null;break;}}
   if(delivery)break;}}
  if(delivery){const store=this.get(delivery.store);if(!store||store.team!==u.team||!this.ready(store)){u.supply=null;u.path=[];return;}if(this.walkTo(u,store,dt)){const resource=q.allocations.find(a=>a.store===store.id).resource;let left=20,amount=0;for(const allocation of q.allocations.filter(a=>a.store===store.id&&a.resource===resource)){const moved=Math.min(left,allocation.amount);allocation.amount-=moved;left-=moved;amount+=moved;}q.allocations=q.allocations.filter(a=>a.amount>0);if(resource==='weapons')q.reserved-=amount;store.inventory[resource]-=amount;u.carry={resource,amount,order:q.id,target:b.id};u.supply=null;u.path=[];}return;}
  let transfer=u.transfer;if(transfer){const target=this.get(transfer.to),from=this.get(transfer.from);if(target?.team!==u.team||!this.ready(target)||from?.team!==u.team||!this.ready(from)||this.inputRoom(target,transfer.resource)<1||from.inventory[transfer.resource]<1){u.transfer=null;u.path=[];transfer=null;}}
  if(!transfer){for(const target of this.storages(u.team,u.planet).filter(e=>this.hub(e))){for(const r of resources.filter(r=>resourceTiers[r]===1)){const key=target.id+':'+r;if(this.alive(u.planet).some(w=>w.transfer?.key===key||w.carry?.to===target.id&&w.carry.resource===r))continue;const need=this.inputRoom(target,r);if(need<1)continue;const from=this.storages(u.team,u.planet).filter(e=>!this.hub(e)&&e.inventory[r]>=1).sort((a,b)=>dist(a,u)-dist(b,u))[0];if(from){transfer=u.transfer={key,from:from.id,to:target.id,resource:r};u.path=[];u.pickup=null;break;}}if(transfer)break;}}
  if(transfer){const from=this.get(transfer.from),target=this.get(transfer.to);if(this.walkTo(u,from,dt)){const amount=Math.min(20,from.inventory[transfer.resource],this.inputRoom(target,transfer.resource));from.inventory[transfer.resource]-=amount;u.carry={resource:transfer.resource,amount,to:target.id};u.transfer=null;u.path=[];}return;}
  if(!this.storages(u.team,u.planet).some(e=>this.room(e)>=1))return;
  let source=this.get(u.pickup);if(!source||source.team!==u.team||source.buffer<1||this.claimed(u,'pickup',source.id)){source=this.alive(u.planet).filter(b=>b.team===u.team&&b.buffer>=1&&stats[b.type]?.resource!=='money'&&!this.claimed(u,'pickup',b.id)).sort((a,c)=>c.buffer/(dist(c,u)+1)-a.buffer/(dist(a,u)+1))[0];u.pickup=source?.id;u.path=[];}
  if(source&&this.walkTo(u,source,dt)){const amount=Math.min(20,Math.floor(source.buffer));source.buffer-=amount;u.carry={resource:stats[source.type].resource,amount};u.path=[];u.pickup=null;}

 }
 train(id,team=0,type='soldier'){const b=this.get(id),cost=unitCosts[type];if(this.result||!cost||!this.operational(b)||b.team!==team||b.type!=='barracks'||this.regions[b.planet].owner!==team||b.queue.length>=3||this.population(team).free<1||!this.canSupply(type,team,b.planet)||!this.pay({money:cost.money},team))return false;const u={id:this.nextId++,type,team,planet:b.planet,location:'training',hp:stats[type].hp,maxHp:stats[type].hp,rank:1,xp:0};this.military.push(u);const q={id:u.id,type,left:stats[type].trainTime,reserved:0,delivered:0,deliveries:{},allocations:[]};b.queue.push(q);for(const [r,n]of this.requirements(type))this.reserveMaterial(q,b,r,n);return true;}
 supplyOrder(b,id,team){return b?.team===team&&this.ready(b)&&b.type==='barracks'&&this.military.some(u=>u.id===id&&u.hp>0&&u.team===team&&u.location==='training')?b.queue.find(q=>q.id===id):null;}
 cancelTraining(b,q){q.allocations=[];q.reserved=0;for(const [r,n]of Object.entries(q.deliveries))this.refund(r,n,b.team);q.deliveries={};q.delivered=0;const unit=this.military.find(u=>u.id===q.id);if(unit)unit.hp=0;}
 canCapture(id,team=0){const r=this.regions[id];return !!r&&r.owner!==team&&r.neighbors.some(n=>this.regions[n].owner===team);}
 sendArmy(from,to,counts,team=0){if(this.result||this.regions[from]?.owner!==team||!this.regions[to]||from===to||this.regions[to].owner!==team&&!this.canCapture(to,team))return false;const chosen=[];
  for(const [type,n]of Object.entries(counts||{})){if(!unitCosts[type]||!Number.isInteger(n)||n<0)return false;const pool=this.army(team,from).filter(u=>u.type===type);if(pool.length<n)return false;chosen.push(...pool.slice(0,n));}if(!chosen.length)return false;
  const m={id:this.nextId++,kind:'army',from,to,team,left:20,units:chosen.map(u=>u.id)};for(const u of chosen)u.location='mission';this.missions.push(m);this.message='Отряд отправлен. Перелёт — 20 игровых секунд.';return m;
 }
 colonize(id,team=0){if(this.result||this.regions[id]?.owner!==team||this.alive(id).some(e=>e.type==='base')||this.missions.some(m=>m.to===id&&m.kind==='colony')||this.population(team).free<6||!this.pay(colonyCost,team))return false;const m={id:this.nextId++,kind:'colony',to:id,team,left:20};this.missions.push(m);this.message='Отправлены 6 строителей. Слоты населения зарезервированы на время перелёта.';return m;}
 capturePlanet(id,team){const r=this.regions[id],old=r.owner;r.owner=team;if(r.guardians)r.guardians=[];const p=this.planet(id);
  for(const b of p.entities.filter(e=>e.hp>0&&e.type!=='deposit'&&e.type!=='worker')){for(const q of b.queue)this.cancelTraining(b,q);this.cancelHiring(b);b.team=team;b.hp=Math.max(1,Math.floor(b.maxHp*(.35+this.random()*.2)));b.queue=[];b.builder=null;b.repairer=null;b.batch=0;}
  for(const u of p.entities.filter(e=>e.hp>0&&e.type==='worker')){if(u.team===team)continue;if(this.random()<.65){const job=u.job,inside=u.inside;this.release(u);u.team=team;if(job&&this.get(job)?.team===team){u.job=job;u.inside=inside;}}else u.hp=0;}
  for(const u of this.military.filter(u=>u.planet===id&&u.team===old&&['training','reserve'].includes(u.location)))u.hp=0;
  this.history.unshift({time:this.time,text:`${team===0?'Вы':'Демоны'} захватили планету «${r.name}».`});this.history=this.history.slice(0,20);this.message=this.history[0].text;
  if(this.activePlanet===id&&team!==0)this.activePlanet=this.regions.find(r=>r.owner===0)?.id??id;
  if(team===0&&(this.hasOpponent?id===this.homeRegions[1]:this.regions.every(r=>r.owner===0)))this.result='victory';if(id===this.homeRegions[0]&&team===1)this.result='defeat';
 }
 arrive(m){if(m.kind==='colony'){if(this.regions[m.to].owner!==m.team||this.alive(m.to).some(e=>e.type==='base')){for(const [r,n]of Object.entries(colonyCost))this.refund(r,n,m.team);return;}this.add('base',m.team,72,48,m.to);for(let i=0;i<6;i++)this.add('worker',m.team,76.5,45.5+i,m.to);return;}
  const troops=m.units.map(id=>this.military.find(u=>u.id===id&&u.hp>0)).filter(Boolean);if(!troops.length)return;
  if(this.battles.some(b=>b.planet===m.to&&!b.done)){m.left=2;this.missions.push(m);return;}
  const owner=this.regions[m.to].owner,defenders=owner>=0?this.army(owner,m.to):[];
  if(owner===m.team){for(const u of troops){u.location='reserve';u.planet=m.to;}return;}
  const towers=owner>=0?this.alive(m.to).filter(e=>e.team===owner&&e.type==='tower'&&this.operational(e)):[];
  if(!defenders.length&&!towers.length){this.capturePlanet(m.to,m.team);for(const u of troops){u.location='reserve';u.planet=m.to;}return;}
  this.startBattle(m.to,m.team,troops,defenders,towers);
 }
 startBattle(planet,attacker,attackers,defenders,towers=[]){const b={id:this.nextId++,planet,attacker,defender:this.regions[planet].owner,time:0,done:false,winner:null,units:[],effects:[],seed:this.planet(planet).seed};
  for(const [side,army]of [[0,attackers],[1,defenders]])for(const [i,u]of army.entries()){u.location='battle';u.planet=planet;b.units.push({id:u.id,type:u.type,team:u.team,side,x:side?BW-8-Math.floor(i/6)*1.7:8+Math.floor(i/6)*1.7,y:7+(i%6)*3,hp:u.hp,maxHp:u.maxHp,size:1,cool:0,walkDistance:0,moving:false,facingX:side?-1:1,facingY:0});}
  for(const [i,t]of towers.entries())b.units.push({id:-t.id,type:'tower',team:t.team,side:1,x:Math.max(4,BW-12-Math.floor(i/4)*2.2),y:7+i%4*6,hp:Math.max(1,Math.round(250*t.hp/t.maxHp)),maxHp:250,size:2,cool:0});
  this.battles.push(b);this.message=`Начался автоматический бой за «${this.regions[planet].name}».`;
 }
 battleTick(b,dt){if(b.done)return;b.time+=dt;b.effects=b.effects.filter(e=>(e.left-=dt)>0);
  const move=(u,target,retreat=false)=>{const dx=target.x-u.x,dy=target.y-u.y,d=Math.hypot(dx,dy)||1,s=stats[u.type].speed*dt*(retreat?-.75:1),ox=u.x,oy=u.y;u.x=Math.max(2,Math.min(BW-2,u.x+dx/d*s));u.y=Math.max(2,Math.min(BH-2,u.y+dy/d*s));const actual=Math.hypot(u.x-ox,u.y-oy);u.walkDistance+=actual;u.moving=actual>.001;u.facingX=dx/d;u.facingY=dy/d;};
  for(const u of b.units.filter(u=>u.hp>0)){u.moving=false;u.cool=Math.max(0,u.cool-dt);const s=stats[u.type],foes=b.units.filter(t=>t.hp>0&&t.team!==u.team).sort((a,c)=>dist(a,u)-dist(c,u));if(!foes.length)continue;
   if(s.heal){const allies=b.units.filter(t=>t.hp>0&&t.id!==u.id&&t.team===u.team&&t.type!=='tower'&&t.hp<t.maxHp).sort((a,c)=>dist(a,u)-dist(c,u));const target=allies[0];if(target&&dist(u,target)<=s.range){if(!u.cool){target.hp=Math.min(target.maxHp,target.hp+s.heal);u.cool=1;b.effects.push({kind:'heal',x:u.x,y:u.y,tx:target.x,ty:target.y,left:.4});}if(dist(u,foes[0])<2.7)move(u,foes[0],true);}else{const escort=target||b.units.find(t=>t.hp>0&&t.team===u.team&&t.id!==u.id&&t.type!=='medic'&&t.type!=='tower');if(escort&&dist(u,escort)>3)move(u,escort);else if(dist(u,foes[0])<3)move(u,foes[0],true);}continue;}
   const foe=u.type==='grenadier'?(foes.find(t=>t.type==='tower')||foes[0]):foes[0],d=dist(u,foe);if(d<=s.range){if(!u.cool){foe.hp-=Math.max(1,(foe.type==='tower'&&s.buildingDamage?s.buildingDamage:s.damage)-(stats[foe.type]?.armor||0));u.cool=s.cooldown||1;b.effects.push({kind:u.type==='assault'?'slash':u.type==='grenadier'?'grenade':'shot',x:u.x,y:u.y,tx:foe.x,ty:foe.y,left:.3});}if(s.speed&&s.range>3&&d<2.3&&foe.type==='assault')move(u,foe,true);}else if(s.speed)move(u,foe);
  }
  for(const u of b.units.filter(u=>u.id>0)){const original=this.military.find(e=>e.id===u.id);if(original)original.hp=Math.max(0,u.hp);}
  const viable=team=>b.units.some(u=>u.hp>0&&u.team===team),offense=team=>b.units.some(u=>u.hp>0&&u.team===team&&u.type!=='medic');
  if(!viable(b.attacker)||!viable(b.defender)||!offense(b.attacker)&&!offense(b.defender)||b.time>=180){
   const winner=!viable(b.defender)?b.attacker:!viable(b.attacker)?b.defender:b.defender;b.done=true;b.winner=winner;
   for(const u of b.units.filter(u=>u.id>0)){const original=this.military.find(e=>e.id===u.id);if(original){original.hp=u.team===winner?Math.max(0,u.hp):0;original.location='reserve';}}
   if(winner===b.attacker)this.capturePlanet(b.planet,winner);else for(const u of b.units.filter(u=>u.type==='tower')){const tower=this.get(-u.id);if(tower)tower.hp=Math.max(1,Math.round(tower.maxHp*Math.max(0,u.hp)/250));}
   this.history.unshift({time:this.time,text:`Бой за «${this.regions[b.planet].name}»: ${winner===0?'победа':'поражение'}.`});this.history=this.history.slice(0,20);
  }
 }
 ai(){const team=1;for(const r of this.regions.filter(r=>r.owner===team)){const id=r.id;this.aiDispatch(id);const all=this.alive(id),base=all.find(e=>e.type==='base'&&e.team===team);if(!base){if(!this.missions.some(m=>m.to===id&&m.kind==='colony')&&this.population(team).free>=6)this.colonize(id,team);continue;}
   const farms=all.filter(e=>e.type==='farm'&&e.team===team).length,localWorkers=all.filter(e=>e.type==='worker'&&e.team===team);if(localWorkers.length<Math.min(26,12+farms*3)&&this.population(team).free>2&&this.stock(team).money>50)this.hire(base.id,team);
   const barracks=all.find(e=>e.type==='barracks'&&this.ready(e));if(barracks&&this.population(team).free>0&&this.army(team,id).length<6&&this.stock(team).money>(this.regions.some(r=>r.owner===team&&!this.alive(r.id).some(e=>e.type==='base'))?240:35)){const order=['soldier','assault','medic','soldier','grenadier'];this.train(barracks.id,team,order[this.military.filter(e=>e.team===team).length%5]);}
   const buildOrder=['house','farm','field','ironmine','goldmine','guild','barracks','gasstation','sulfurstation','factory','chemical'];for(const type of buildOrder)if(!all.some(e=>e.type===type&&e.team===team)){const site=this.findSite(type,team,id);if(site)this.build(type,site.x,site.y,team,id);break;}
   if(this.population(team).free<3&&!all.some(e=>e.type==='house'&&e.construction>0)){const site=this.findSite('house',team,id);if(site)this.build('house',site.x,site.y,team,id);}
   const guild=all.find(e=>e.type==='guild'&&this.operational(e));if(guild&&!this.workers(guild).length){const donor=localWorkers.find(u=>['ironmine','goldmine','gasstation','sulfurstation'].includes(this.get(u.job)?.type)&&!u.carry);if(donor){this.release(donor);this.assign(guild.id,team);}}
   for(const b of all.filter(e=>this.ready(e)&&stats[e.type]?.slots)){const desired=['farm','guild','gasstation','sulfurstation'].includes(b.type)?2:1;if(this.workers(b).length<desired&&localWorkers.filter(u=>!u.job&&!u.building&&!u.carry).length>2)this.assign(b.id,team);}
   for(const factory of all.filter(e=>this.hub(e)&&this.ready(e))){for(const type of Object.keys(stats).filter(t=>stats[t].addon===factory.type&&!this.addons(factory).some(a=>a.type===t))){const site=this.findAddonSite(factory.id,type,team);if(site){this.build(type,site.x,site.y,team,id,factory.id);break;}}}
   const neededFields=Math.max(2,Math.ceil((this.upkeep(team).food+5)/4));
   if(!all.some(e=>e.construction>0&&['farm','field'].includes(e.type))){const need=all.filter(e=>e.type==='field').length<neededFields?'field':farms<Math.ceil(neededFields/2)?'farm':null;if(need){const site=this.findSite(need,team,id);if(site)this.build(need,site.x,site.y,team,id);}}

  }
 }
 aiDispatch(id){const team=1,army=this.army(team,id);if(army.length>=4&&!this.missions.some(m=>m.team===team&&m.kind==='army')){const target=this.regions.filter(r=>this.canCapture(r.id,team)).sort((a,c)=>dist(a,this.regions[0])-dist(c,this.regions[0]))[0];if(target){const counts={};for(const u of army)counts[u.type]=(counts[u.type]||0)+1;this.sendArmy(id,target.id,counts,team);}}}
 tick(dt){if(this.combatStep&&this.combatStep(dt))return;if(this.result)return;dt=Math.max(0,Math.min(.1,dt));this.time+=dt;if(this.encounterTick)this.encounterTick();this.economyClock+=dt;this.aiClock+=dt;for(const team of [0,1])for(const r of resources){const pending=this.teams[team].pending;if(pending[r]>1e-8)pending[r]=this.credit(r,pending[r],team);}
  for(const p of Object.values(this.maps)){for(const b of p.entities.filter(e=>e.hp<=0&&e.type==='base'))this.cancelHiring(b);for(const b of p.entities.filter(e=>e.hp<=0&&e.type==='barracks')){for(const q of b.queue)this.cancelTraining(b,q);b.queue=[];}for(const u of p.entities.filter(e=>e.hp>0&&e.type==='worker')){if(u.job&&this.get(u.job)?.team!==u.team)this.release(u);if(u.inside&&!this.get(u.inside))this.release(u);}this.construction(p,dt);for(const b of p.entities.filter(e=>e.hp>0&&e.type!=='worker'&&e.type!=='deposit'))this.production(b,dt);for(const u of p.entities.filter(e=>e.hp>0&&e.type==='worker'))this.worker(u,dt);p.entities=p.entities.filter(e=>e.hp>0);}
  for(const r of this.regions)if(r.owner>=0)this.credit('money',12/20*dt,r.owner,r.id);
  const arrivals=[];for(const m of this.missions){m.left-=dt;if(m.left<=0)arrivals.push(m);}this.missions=this.missions.filter(m=>m.left>0);for(const m of arrivals)this.arrive(m);
  for(const b of this.battles)this.battleTick(b,dt);
  if(this.economyClock>=10){this.economyClock-=10;for(const team of [0,1]){const s=this.stock(team),u=this.upkeep(team),t=this.teams[team];t.hungry=s.food<u.food;t.unpaid=s.money<u.money;s.food=Math.max(0,s.food-u.food);s.money=Math.max(0,s.money-u.money);if(t.hungry)for(const e of this.all().filter(e=>e.team===team&&e.type==='worker'))e.hp-=5;}}
  for(const team of [0,1]){const t=this.teams[team];if(t.hungry||t.unpaid){t.desertion+=dt*(t.hungry&&t.unpaid?2:1);if(t.desertion>=30){const u=this.military.find(e=>e.team===team&&e.hp>0&&e.location!=='training');if(u){u.hp=0;for(const b of this.battles){const bu=b.units.find(e=>e.id===u.id);if(bu)bu.hp=0;}if(team===0)this.message='Нехватка снабжения: один боец покинул армию.';}t.desertion=0;}}else t.desertion=0;}
  this.military=this.military.filter(u=>u.hp>0);if(this.aiEnabled&&this.aiClock>=4){this.aiClock=0;this.ai();}
 }
}
const api={Game,stats,footprint,placement,W,H,BW,BH,dist,resources,resourceTiers,unitCosts,isMilitary,colonyCost,workerCost,weaponRecipe,ROAD_SPEED,FIELD_YIELD,SOW_TIME,GROW_TIME,HIRE_TIME,HARVEST_TIME,FOOD_PROCESS_TIME,GAS_RADIUS,GAS_LOAD,GAS_GATHER_TIME,GAS_PACK_TIME};if(typeof module!=='undefined'){module.exports=api;require('./combat.js').install(api);}else root.RTS=api;
})(typeof window!=='undefined'?window:globalThis);
