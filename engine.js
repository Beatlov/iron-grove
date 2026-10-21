/* DOM-independent simulation. All gameplay time advances through tick(dt). */
(function(root){
'use strict';
const W=42,H=26,resources=['wood','stone','food','iron','gold'];
const stats={
 worker:{hp:60,speed:2.8,size:1},soldier:{hp:120,speed:2.5,size:1,damage:18,range:1.3},
 base:{hp:1600,size:3,cost:{}},house:{hp:300,size:2,cost:{wood:50,stone:15}},
 warehouse:{hp:450,size:2,cost:{wood:50,stone:20}},
 sawmill:{hp:350,size:2,cost:{wood:50},resource:'wood',slots:2,rate:2},
 quarry:{hp:400,size:2,cost:{wood:50},resource:'stone',slots:2,rate:2},
 farm:{hp:300,size:2,cost:{wood:50},resource:'food',slots:2,rate:3},
 ironmine:{hp:400,size:2,cost:{wood:60,stone:20},resource:'iron',slots:2,rate:1.5},
 goldmine:{hp:400,size:2,cost:{wood:60,stone:20},resource:'gold',slots:2,rate:1.5},
 barracks:{hp:650,size:2,cost:{wood:90,stone:30}},tower:{hp:800,size:2,cost:{wood:60,stone:80},damage:26,range:7}
};
const soldierCost={wood:20,iron:15,gold:10};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
class Game{
 constructor(seed=Math.floor(Math.random()*0xffffffff),options={}){
  this.seed=seed>>>0;this.rng=this.seed;this.aiEnabled=options.ai!==false;this.time=0;this.result=null;this.nextId=1;this.entities=[];this.economyClock=0;this.aiClock=0;
  this.message='Постройте ферму и лесопилку. Выделите рабочих и нажмите ПКМ по зданию, чтобы назначить их.';
  this.teams=[0,1].map(()=>({stock:{wood:380,stone:180,food:180,iron:60,gold:80},birth:0,hungry:false,unpaid:false}));
  this.terrain=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>+(x===0||y===0||x===W-1||y===H-1)));
  this.add('base',0,5.5,13.5);this.add('base',1,W-5.5,13.5);
  for(let team=0;team<2;team++)for(let i=0;i<6;i++)this.add('worker',team,team?W-9.5:9.5,10.5+i);
  // Random mirrored deposits give both sides the same travel distances and quantities.
  for(const [resource,baseY] of [['wood',4],['stone',8],['iron',18],['gold',22]]){
   const x=4+Math.floor(this.random()*6),y=baseY+Math.floor(this.random()*2);
   for(let i=0;i<3;i++)for(const nx of [x+i,W-1-x-i]){const n=this.add('deposit',-1,nx+.5,y+.5);n.resource=resource;n.amount=2400;}
  }
 }
 random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;}
 add(type,team,x,y){const s=stats[type]||{hp:1,size:1};const e={id:this.nextId++,type,team,x,y,hp:s.hp,maxHp:s.hp,size:s.size,path:[],order:null,job:null,training:null,carry:null,buffer:0,cool:0,queue:[],node:null};this.entities.push(e);return e;}
 alive(){return this.entities.filter(e=>e.hp>0);}
 get(id){return this.entities.find(e=>e.id===id&&e.hp>0);}
 stock(team=0){return this.teams[team].stock;}
 population(team=0){const all=this.alive().filter(e=>e.team===team);return{total:all.filter(e=>stats[e.type]?.speed).length,workers:all.filter(e=>e.type==='worker').length,soldiers:all.filter(e=>e.type==='soldier').length,capacity:6+all.filter(e=>e.type==='house').length*4};}
 affordable(cost,team=0){return Object.entries(cost).every(([r,n])=>this.stock(team)[r]>=n);}
 pay(cost,team=0){if(!this.affordable(cost,team))return false;for(const [r,n]of Object.entries(cost))this.stock(team)[r]-=n;return true;}
 cellBlocked(x,y){return x<0||y<0||x>=W||y>=H||this.terrain[y][x]===1||this.alive().some(e=>!stats[e.type]?.speed&&Math.abs(x+.5-e.x)<e.size/2&&Math.abs(y+.5-e.y)<e.size/2);}
 path(sx,sy,tx,ty){
  sx=Math.floor(sx);sy=Math.floor(sy);tx=Math.floor(tx);ty=Math.floor(ty);
  if(this.cellBlocked(tx,ty))return [];
  const blocked=new Set();for(const e of this.alive().filter(e=>!stats[e.type]?.speed))for(let y=0;y<H;y++)if(Math.abs(y+.5-e.y)<e.size/2)for(let x=0;x<W;x++)if(Math.abs(x+.5-e.x)<e.size/2)blocked.add(y*W+x);
  const start=sy*W+sx,goal=ty*W+tx,q=[start],prev=new Map([[start,null]]);
  for(let i=0;i<q.length;i++){const k=q[i],x=k%W,y=Math.floor(k/W);if(k===goal){const p=[];for(let n=k;n!==start;n=prev.get(n))p.push({x:n%W+.5,y:Math.floor(n/W)+.5});return p.reverse();}
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*W+nx;if(nx>=0&&ny>=0&&nx<W&&ny<H&&!this.terrain[ny][nx]&&!blocked.has(n)&&!prev.has(n)){prev.set(n,k);q.push(n);}}
  }return [];
 }
 nearPath(u,b){const cells=[],r=Math.ceil(b.size/2)+1;for(let y=Math.floor(b.y)-r;y<=Math.floor(b.y)+r;y++)for(let x=Math.floor(b.x)-r;x<=Math.floor(b.x)+r;x++)if(!this.cellBlocked(x,y))cells.push({x:x+.5,y:y+.5});cells.sort((a,c)=>dist(a,b)+dist(a,u)*.2-dist(c,b)-dist(c,u)*.2);for(const c of cells){const p=this.path(u.x,u.y,c.x,c.y);if(p.length||dist(u,c)<.1)return p;}return [];}
 adjacent(u,b){return Math.abs(u.x-b.x)<=b.size/2+.65&&Math.abs(u.y-b.y)<=b.size/2+.65;}
 walkTo(u,b,dt){if(this.adjacent(u,b))return true;if(!u.path.length)u.path=this.nearPath(u,b);this.move(u,dt);return this.adjacent(u,b);}
 move(u,dt){let n=stats[u.type].speed*dt;while(n>0&&u.path.length){const p=u.path[0];if(this.cellBlocked(Math.floor(p.x),Math.floor(p.y))){u.path=[];break;}const d=dist(u,p);if(d<=n){u.x=p.x;u.y=p.y;u.path.shift();n-=d;}else{u.x+=(p.x-u.x)*n/d;u.y+=(p.y-u.y)*n/d;n=0;}}}
 workers(b){return this.alive().filter(u=>u.type==='worker'&&u.job===b.id&&!u.training);}
 canBuild(type,x,y,team=0){const s=stats[type];if(this.result||!s?.cost||type==='base'||!Number.isInteger(x)||!Number.isInteger(y)||!this.affordable(s.cost,team))return false;
  const base=this.alive().find(e=>e.type==='base'&&e.team===team);if(!base||dist(base,{x,y})>15||!this.population(team).workers)return false;
  for(const dx of [-.5,.5])for(const dy of [-.5,.5])if(this.cellBlocked(Math.floor(x+dx),Math.floor(y+dy)))return false;
  if(this.alive().some(e=>stats[e.type]?.speed&&Math.abs(e.x-x)<1&&Math.abs(e.y-y)<1))return false;
  // Preserve a one-tile transport lane between buildings.
  if(this.alive().some(e=>e.team>=0&&!stats[e.type]?.speed&&Math.abs(e.x-x)<e.size/2+2&&Math.abs(e.y-y)<e.size/2+2))return false;
  if(s.resource&&s.resource!=='food'&&!this.alive().some(e=>e.type==='deposit'&&e.resource===s.resource&&e.amount>0&&dist(e,{x,y})<=5))return false;
  return true;
 }
 build(type,x,y,team=0){if(!this.canBuild(type,x,y,team)){if(team===0)this.message='Нельзя строить: проверьте цену, свободные 2×2 клетки, проход между зданиями (1) и расстояние до ратуши (15). Добывающее здание — в 5 клетках от залежи.';return false;}
  this.pay(stats[type].cost,team);const b=this.add(type,team,x,y);if(stats[type].resource&&stats[type].resource!=='food')b.node=this.alive().filter(e=>e.type==='deposit'&&e.resource===stats[type].resource&&e.amount>0).sort((a,c)=>dist(a,b)-dist(c,b))[0].id;
  if(team===0)this.message='Здание готово. Назначьте рабочих: выделение → ПКМ по зданию. Свободные рабочие перевозят продукцию.';return b;
 }
 release(u){if(u.training)return false;u.job=null;u.order=null;u.pickup=null;u.path=[];return true;}
 assign(ids,id,team=0){const b=this.get(id);if(!b||b.team!==team||!stats[b.type]?.slots||this.result)return 0;let n=0;for(const uid of ids){const u=this.get(uid);if(!u||u.type!=='worker'||u.team!==team||u.training||u.carry||u.job===b.id||this.workers(b).length>=stats[b.type].slots)continue;this.release(u);u.job=b.id;n++;}return n;}
 train(id,team=0){const b=this.get(id);if(this.result||!b||b.team!==team||b.type!=='barracks'||b.queue.length>=3||!this.affordable(soldierCost,team))return false;
  // Prefer idle carriers, but every worker can be retrained; population does not increase.
  const u=this.alive().filter(e=>e.team===team&&e.type==='worker'&&!e.training&&!e.carry).sort((a,c)=>Number(!!a.job)-Number(!!c.job)||dist(a,b)-dist(c,b))[0];if(!u)return false;
  this.pay(soldierCost,team);this.release(u);u.training=b.id;b.queue.push({id:u.id,left:6});return true;
 }
 demobilize(ids,team=0){if(this.result)return;for(const id of ids){const u=this.get(id);if(u?.team===team&&u.type==='soldier'){u.type='worker';u.maxHp=stats.worker.hp;u.hp=Math.min(u.hp,u.maxHp);u.order=null;u.path=[];}}}
 command(ids,x,y,targetId,team=0){if(this.result)return;const target=this.get(targetId);for(const id of ids){const u=this.get(id);if(!u||u.team!==team||!stats[u.type]?.speed||u.training)continue;
  if(target?.team===team&&stats[target.type]?.slots&&u.type==='worker'){this.assign([id],target.id,team);continue;}
  this.release(u);if(target&&target.team>=0&&target.team!==team){u.order={type:'attack',id:target.id};u.path=this.nearPath(u,target);}else{u.order={type:'move'};u.path=this.path(u.x,u.y,x,y);}
 }}
 logistics(u,dt){
  if(u.carry){const stores=this.alive().filter(b=>b.team===u.team&&['base','warehouse'].includes(b.type)).sort((a,b)=>dist(u,a)-dist(u,b));const b=stores[0];if(b&&this.walkTo(u,b,dt)){this.stock(u.team)[u.carry.resource]+=u.carry.amount;u.carry=null;u.path=[];}return;}
  if(u.job){const b=this.get(u.job);if(!b){u.job=null;u.path=[];return;}this.walkTo(u,b,dt);return;}
  let b=this.get(u.pickup);if(!b||b.buffer<4){u.pickup=null;u.path=[];b=this.alive().filter(e=>e.team===u.team&&e.buffer>=4).sort((a,c)=>c.buffer/(dist(c,u)+1)-a.buffer/(dist(a,u)+1))[0];if(b)u.pickup=b.id;}
  if(b&&this.walkTo(u,b,dt)){const amount=Math.min(20,Math.floor(b.buffer));if(amount){b.buffer-=amount;u.carry={resource:stats[b.type].resource,amount};}u.pickup=null;u.path=[];}
 }
 combat(e,dt){e.cool=Math.max(0,e.cool-dt);const s=stats[e.type],explicit=this.get(e.order?.id);let foes=this.alive().filter(t=>t.team>=0&&t.team!==e.team&&dist(e,t)<= (s.range||1.1)+(t.size-1)/2);
  foes.sort((a,b)=>Number(!stats[a.type]?.speed)-Number(!stats[b.type]?.speed)||dist(e,a)-dist(e,b));const foe=foes[0];
  if(foe){if(!e.cool){foe.hp-=s.damage||4;e.cool=1;}return true;}
  if(e.type==='tower')return false;
  if(e.order?.type==='attack'){if(!explicit){e.order=null;e.path=[];}else {if(!e.path.length)e.path=this.nearPath(e,explicit);this.move(e,dt);}return true;}
  const nearby=this.alive().filter(t=>t.team>=0&&t.team!==e.team&&dist(e,t)<6).sort((a,b)=>dist(e,a)-dist(e,b))[0];if(nearby){if(!e.path.length)e.path=this.nearPath(e,nearby);this.move(e,dt);return true;}return false;
 }
 findSite(type,team){const b=this.alive().find(e=>e.type==='base'&&e.team===team);if(!b)return null;const points=[];for(let y=2;y<H-1;y++)for(let x=2;x<W-1;x++)if(this.canBuild(type,x,y,team))points.push({x,y});points.sort((a,c)=>dist(a,b)-dist(c,b));return points[0];}
 ai(){
  const team=1,buildings=this.alive().filter(e=>e.team===team&&!stats[e.type]?.speed),pop=this.population(team);
  for(const type of ['farm','sawmill','quarry','house','ironmine','goldmine','barracks'])if(!buildings.some(e=>e.type===type)){const p=this.findSite(type,team);if(p)this.build(type,p.x,p.y,team);break;}
  if(pop.total>=pop.capacity&&buildings.some(b=>b.type==='barracks')){const p=this.findSite('house',team);if(p)this.build('house',p.x,p.y,team);}
  let idle=this.alive().filter(u=>u.team===team&&u.type==='worker'&&!u.job&&!u.training&&!u.carry);
  // Reserve at least two residents to transport resources.
  for(const type of ['farm','sawmill','quarry','ironmine','goldmine'])for(const b of buildings.filter(e=>e.type===type)){const need=type==='farm'?2:1;while(this.workers(b).length<need&&idle.length>2)this.assign([idle.shift().id],b.id,team);}
  const barracks=buildings.find(b=>b.type==='barracks');if(barracks&&pop.workers>10&&pop.soldiers<10)this.train(barracks.id,team);
  const army=this.alive().filter(e=>e.team===team&&e.type==='soldier'),base=this.alive().find(e=>e.team===0&&e.type==='base');if(base&&(army.length>=3||army.some(e=>e.order?.type==='attack')))this.command(army.map(e=>e.id),base.x,base.y,base.id,team);
 }
 tick(dt){if(this.result)return;dt=Math.max(0,Math.min(dt,.1));this.time+=dt;this.economyClock+=dt;this.aiClock+=dt;
  for(const team of [0,1]){const t=this.teams[team],pop=this.population(team),house=this.alive().find(b=>b.team===team&&b.type==='house'),base=this.alive().find(b=>b.team===team&&b.type==='base');
   if(house&&base&&pop.total<pop.capacity&&t.stock.food>=8){t.birth+=dt;if(t.birth>=20){const cells=[];for(let y=Math.floor(house.y)-2;y<=Math.floor(house.y)+2;y++)for(let x=Math.floor(house.x)-2;x<=Math.floor(house.x)+2;x++)if(!this.cellBlocked(x,y))cells.push({x:x+.5,y:y+.5});const p=cells[0];if(p){t.stock.food-=8;this.add('worker',team,p.x,p.y);t.birth=0;}}}else t.birth=0;
  }
  for(const b of this.alive().filter(e=>!stats[e.type]?.speed&&e.team>=0)){
   const s=stats[b.type];if(s.resource){const count=this.workers(b).filter(u=>this.adjacent(u,b)).length;let amount=Math.min(60-b.buffer,count*s.rate*dt);if(s.resource!=='food'){let n=this.get(b.node);if(!n||n.amount<=0){n=this.alive().filter(e=>e.type==='deposit'&&e.resource===s.resource&&e.amount>0&&dist(e,b)<=5).sort((a,c)=>dist(a,b)-dist(c,b))[0];b.node=n?.id;}amount=Math.min(amount,n?.amount||0);if(n)n.amount-=amount;}b.buffer+=amount;}
   if(b.type==='tower')this.combat(b,dt);
   if(b.queue.length){const q=b.queue[0],u=this.get(q.id);if(!u){b.queue.shift();continue;}if(this.walkTo(u,b,dt)){q.left-=dt;if(q.left<=0){u.type='soldier';u.maxHp=stats.soldier.hp;u.hp=u.maxHp;u.training=null;u.path=[];b.queue.shift();}}}
  }
  for(const u of this.alive().filter(e=>stats[e.type]?.speed)){
   if(u.training){if(!this.get(u.training)){u.training=null;u.path=[];}continue;}
   if(u.type==='soldier'&&this.combat(u,dt))continue;
   if(u.order?.type==='attack'&&this.combat(u,dt))continue;
   if(u.order?.type==='move'){this.move(u,dt);if(!u.path.length)u.order=null;continue;}
   if(u.type==='worker')this.logistics(u,dt);
  }
  if(this.economyClock>=5){this.economyClock-=5;for(const team of [0,1]){const t=this.teams[team],p=this.population(team);t.hungry=t.stock.food<p.total;t.unpaid=t.stock.gold<p.soldiers*.5;t.stock.food=Math.max(0,t.stock.food-p.total);t.stock.gold=Math.max(0,t.stock.gold-p.soldiers*.5);for(const u of this.alive().filter(e=>e.team===team&&stats[e.type]?.speed)){if(t.hungry)u.hp-=8;if(t.unpaid&&u.type==='soldier')u.hp-=8;}}}
  if(this.aiEnabled&&this.aiClock>=3){this.aiClock=0;this.ai();}
  const bases=[0,1].map(team=>this.alive().some(e=>e.type==='base'&&e.team===team));if(!bases[0])this.result='defeat';else if(!bases[1])this.result='victory';
  this.entities=this.entities.filter(e=>e.hp>0);
 }
}
const api={Game,stats,W,H,dist,resources,soldierCost};if(typeof module!=='undefined')module.exports=api;else root.RTS=api;
})(typeof window!=='undefined'?window:globalThis);
