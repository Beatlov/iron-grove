/* HELIOS H34: production-first delivery, nearest stores and visible field workers. */
(function(root){
'use strict';
function install(api){
 const {Game,stats,resources,resourceTiers,dist,W,droneCost,DRONE_TIME}=api;
 // Data, not UI: future upgrades can replace movement and tune these priorities.
 const logisticsPriorities={military:80,production:100,output:60,resources:{}};
 api.logisticsPriorities=logisticsPriorities;
 Object.assign(Game.prototype,{
  workerHome(u){return this.alive(u.planet).filter(b=>b.type==='base'&&b.team===u.team&&this.ready(b)).sort((a,b)=>dist(a,u)-dist(b,u))[0]||null;},
  freeWorkers(team=0,planet=this.activePlanet){return this.alive(planet).filter(u=>u.type==='worker'&&u.team===team&&!u.job&&!u.building&&!u.carry);},
  workerVisible(u){return !u.inside&&(!!u.carry?.bio||!!u.building||!!u.returning||!!u.job&&(u.arrivedJob!==u.job||this.get(u.job)?.type==='farm'||!!stats[this.get(u.job)?.type]?.bio||!!stats[this.get(u.job)?.type]?.collector));},
  leaveInterior(u){if(!u.inside)return;const b=this.get(u.inside);if(b)Object.assign(u,this.freeNear(b));u.inside=null;u.returning=false;u.path=[];u.retry=0;},
  returnHome(u,dt){const home=this.workerHome(u);if(!home){u.inside=null;u.returning=false;u.path=[];return;}u.home=home.id;if(u.inside===home.id){u.returning=false;return;}if(u.inside)this.leaveInterior(u);u.returning=true;if(this.walkTo(u,home,dt)){u.inside=home.id;u.returning=false;u.path=[];}},
  carriers(b){return this.alive(b.planet).filter(d=>d.type==='drone'&&d.home===b.id&&d.team===b.team);},
  carrierDocks(team=0,planet=this.activePlanet){return this.alive(planet).filter(b=>b.team===team&&stats[b.type]?.carrierSlots&&this.ready(b));},
  syncCarriers(p){
   const docks=p.entities.filter(b=>b.hp>0&&stats[b.type]?.carrierSlots&&this.ready(b));
   for(const d of p.entities.filter(e=>e.hp>0&&e.type==='drone')){const home=this.get(d.home);if(home?.team===d.team&&this.ready(home))continue;if(d.inside)this.leaveInterior(d);d.home=null;d.task=null;d.path=[];const next=docks.filter(b=>b.team===d.team&&this.carriers(b).length+b.droneQueue.length<stats[b.type].carrierSlots).sort((a,b)=>dist(a,d)-dist(b,d))[0];if(next)d.home=next.id;}

  },
  spawnCarrier(b){const point=this.freeNear(b),d=this.add('drone',b.team,point.x,point.y,b.planet);d.home=b.id;d.inside=b.id;return d;},
  buyDrone(id,team=0){const b=this.get(id);if(this.result||!this.canManageProcesses(team)||!this.operational(b)||b.team!==team||this.regions[b.planet]?.owner!==team||!stats[b.type]?.carrierSlots||this.carriers(b).length+b.droneQueue.length>=stats[b.type].carrierSlots||!this.pay(droneCost,team))return false;b.droneQueue.push({id:this.nextId++,left:DRONE_TIME});this.message='Заказ грузового дрона: 30 токенов + 12 минералов, сборка 6 с. Содержание: 1 минерал / 10 с.';return true;},
  cancelDrones(b,captured=false){for(const q of b.droneQueue)for(const [r,n]of Object.entries(droneCost)){if(!captured)this.refund(r,n,b.team);else{let left=n;for(const store of this.storages(b.team).filter(s=>s.planet!==b.planet))left-=this.deposit(store,r,left);this.teams[b.team].pending[r]+=left;}}b.droneQueue=[];},
  transportClaims(d){return this.alive(d.planet).filter(e=>e.type==='drone'&&e.team===d.team&&e.id!==d.id);},
  incoming(d,to,r=null){return this.transportClaims(d).reduce((n,c)=>n+(c.carry?.to===to&&(!r||c.carry.resource===r)?c.carry.amount:0)+(c.task?.to===to&&(!r||c.task.resource===r)?c.task.amount:0),0);},
  transportRoom(d,to,r){return Math.max(0,Math.min(this.inputRoom(to,r)-this.incoming(d,to.id,r),this.room(to)-this.incoming(d,to.id)));},
  transportAvailable(d,from,r,buffer=false){const claims=this.transportClaims(d).reduce((n,c)=>n+(c.task?.from===from.id&&c.task.resource===r&&!c.task.order?c.task.amount:0),0);return Math.max(0,(buffer?Math.floor(from.buffer):from.inventory[r]-this.reservedAt(from,r))-claims);},
  maintainSupply(p,team){for(const b of p.entities.filter(b=>b.hp>0&&b.team===team&&b.type==='barracks'&&this.ready(b)))for(const q of b.queue){if(!this.supplyOrder(b,q.id,team))continue;q.allocations=q.allocations.filter(a=>{const s=this.get(a.store);return a.amount>0&&s?.team===team&&this.ready(s);});for(const [r,n]of this.requirements(q.type)){const reserved=q.allocations.filter(a=>a.resource===r).reduce((v,a)=>v+a.amount,0),transit=p.entities.filter(d=>d.hp>0&&d.team===team&&d.carry?.order===q.id&&d.carry.resource===r).reduce((v,d)=>v+d.carry.amount,0),missing=n-(q.deliveries[r]||0)-reserved-transit;if(missing>1e-8)this.reserveMaterial(q,b,r,missing);}q.reserved=q.allocations.filter(a=>a.resource==='weapons').reduce((n,a)=>n+a.amount,0);}},
  transportTasks(d){
   const all=this.alive(d.planet),claims=this.transportClaims(d),stores=this.storages(d.team,d.planet),tasks=[],capacity=stats.drone.load;
   const push=(kind,from,to,r,amount,buffer=false,order=null)=>{amount=Math.min(capacity,amount);if(amount<1)return;const key=[kind,from.id,to.id,r,order||''].join(':');if(claims.some(c=>c.task?.key===key))return;tasks.push({key,kind,from:from.id,to:to.id,resource:r,amount,buffer,order,priority:logisticsPriorities[kind]+(logisticsPriorities.resources[r]||0)});};
   for(const b of all.filter(b=>b.type==='barracks'&&b.team===d.team&&this.ready(b)))for(const q of b.queue)if(this.supplyOrder(b,q.id,d.team))for(const a of q.allocations){const from=this.get(a.store);if(from)push('military',from,b,a.resource,a.amount,false,q.id);}
   const buffers=all.filter(b=>b.team===d.team&&b.buffer>=1&&stats[b.type]?.resource&&stats[b.type].resource!=='tokens'&&this.ready(b));
   for(const to of stores.filter(b=>this.hub(b)))for(const r of resources.filter(r=>resourceTiers[r]===1)){const room=this.transportRoom(d,to,r);if(room<1)continue;for(const from of stores.filter(b=>!this.hub(b))){push('production',from,to,r,Math.min(room,this.transportAvailable(d,from,r)));}for(const from of buffers.filter(b=>stats[b.type].resource===r))push('production',from,to,r,Math.min(room,this.transportAvailable(d,from,r,true)),true);}
   // Output goes to the nearest reachable store from its pickup position, not its home dock.
   for(const to of this.carrierDocks(d.team,d.planet)){for(const from of buffers){const r=stats[from.type].resource;push('output',from,to,r,Math.min(this.transportRoom(d,to,r),this.transportAvailable(d,from,r,true)),true);}for(const from of stores.filter(b=>this.hub(b)))for(const r of resources.filter(r=>resourceTiers[r]===2))push('output',from,to,r,Math.min(this.transportRoom(d,to,r),this.transportAvailable(d,from,r)));}
   return tasks.sort((a,b)=>b.priority-a.priority||(dist(d,this.get(a.from))+dist(this.get(a.from),this.get(a.to)))-(dist(d,this.get(b.from))+dist(this.get(b.from),this.get(b.to)))||a.key.localeCompare(b.key));
  },
  transportRoute(d,task){const from=this.get(task.from),to=this.get(task.to);if(!from||!to)return null;const pickup=this.adjacent(d,from)?[]:this.nearPath(d,from);if(!pickup.length&&!this.adjacent(d,from))return null;const point=pickup.at(-1)||d,actor={...d,x:point.x,y:point.y},delivery=this.adjacent(actor,to)?[]:this.nearPath(actor,to);if(!delivery.length&&!this.adjacent(actor,to))return null;let offroad=0,seconds=0;const roads=this.planet(d.planet).roads;for(const path of [pickup,delivery]){let prev=path===pickup?d:point;for(const cell of path){const length=dist(prev,cell),road=roads.has(Math.floor(cell.y)*W+Math.floor(cell.x));if(!road)offroad+=length;seconds+=length/(stats.drone.speed*(road?api.ROAD_SPEED:1));prev=cell;}}return{pickup,offroad,seconds};},
  nearestStorage(d,resource){return this.carrierDocks(d.team,d.planet).filter(b=>this.transportRoom(d,b,resource)>1e-8).sort((a,b)=>dist(a,d)-dist(b,d)||a.id-b.id).find(b=>this.adjacent(d,b)||this.nearPath(d,b).length)||null;},
  chooseTransport(d){const tasks=this.transportTasks(d),waiting=d.outputWait||{},keys=new Set(tasks.filter(t=>t.kind==='output').map(t=>t.from+':'+t.resource));d.outputWait=Object.fromEntries([...keys].map(key=>[key,waiting[key]??this.time]));while(tasks.length){const priority=tasks[0].priority,group=tasks.filter(t=>t.priority===priority),candidates=[];
   for(const task of group){const route=this.transportRoute(d,task);if(route)candidates.push({task,route,waiting:task.kind==='output'?Math.max(0,this.time-d.outputWait[task.from+':'+task.resource]-20):0});}
   const nearest=new Map();for(const entry of candidates.filter(e=>e.task.kind==='output')){const key=entry.task.from+':'+entry.task.resource,point=entry.route.pickup.at(-1)||d,distance=dist(point,this.get(entry.task.to)),current=nearest.get(key);if(!current||distance<current.distance-1e-8||Math.abs(distance-current.distance)<1e-8&&entry.task.to<current.entry.task.to)nearest.set(key,{entry,distance});}
   let best=null;for(const entry of candidates){if(entry.task.kind==='output'&&nearest.get(entry.task.from+':'+entry.task.resource)?.entry!==entry)continue;const route=entry.route;if(!best||entry.waiting>best.waiting+1e-8||Math.abs(entry.waiting-best.waiting)<1e-8&&(route.offroad<best.route.offroad-1e-8||Math.abs(route.offroad-best.route.offroad)<1e-8&&route.seconds<best.route.seconds))best=entry;}
   if(best){if(best.task.kind==='output')delete d.outputWait[best.task.from+':'+best.task.resource];d.task=best.task;d.path=best.route.pickup;return true;}tasks.splice(0,group.length);
  }return false;},
  dockCarrier(d,home,dt){if(d.inside===home.id){d.returning=false;return;}d.returning=true;if(this.walkTo(d,home,dt)){d.inside=home.id;d.returning=false;d.path=[];}},
  carrier(d,dt){
   d.moving=false;const home=this.get(d.home);if(!home||home.team!==d.team||!this.ready(home)){d.task=null;return;}
   if(d.carry){if(d.inside)this.leaveInterior(d);const c=d.carry;
    if(c.order){const b=this.get(c.target),q=this.supplyOrder(b,c.order,d.team);if(q){if(this.walkTo(d,b,dt)){q.deliveries[c.resource]=(q.deliveries[c.resource]||0)+c.amount;q.delivered=q.deliveries.weapons||0;d.carry=null;d.path=[];}return;}delete c.order;delete c.target;d.path=[];}
    let to=this.get(c.to);if(to?.team!==d.team||!this.ready(to)||this.inputRoom(to,c.resource)<1e-8){delete c.to;d.path=[];to=this.nearestStorage(d,c.resource);if(to)c.to=to.id;}
    if(to){if(this.walkTo(d,to,dt)){const delivered=this.deposit(to,c.resource,c.amount);if(c.fresh)this.recordResourceFlow(c.resource,'income',delivered,d.team,c.fresh);c.amount-=delivered;if(c.amount<1e-8)d.carry=null;d.path=[];}else if(!d.path.length&&(d.retry||0)>this.time){delete c.to;d.retry=0;}}return;
   }
   this.maintainSupply(this.planet(d.planet),d.team);
   let t=d.task;if(t){const from=this.get(t.from),to=this.get(t.to),q=t.order&&this.supplyOrder(to,t.order,d.team),amount=t.order?q?.allocations.filter(a=>a.store===t.from&&a.resource===t.resource).reduce((n,a)=>n+a.amount,0):from?this.transportAvailable(d,from,t.resource,t.buffer):0;if(from?.team!==d.team||!this.ready(from)||to?.team!==d.team||!this.ready(to)||!amount||!t.order&&this.transportRoom(d,to,t.resource)<1){d.task=null;d.path=[];t=null;}}
   if(!t){if((d.retry||0)>this.time){if(d.returning)this.dockCarrier(d,home,dt);return;}if(!this.chooseTransport(d)){this.dockCarrier(d,home,dt);d.retry=this.time+1;return;}t=d.task;d.returning=false;d.retry=0;}
   if(d.inside){const path=d.path;this.leaveInterior(d);d.path=path;}
   const from=this.get(t.from),to=this.get(t.to);if(!this.walkTo(d,from,dt)){if(!d.path.length&&(d.retry||0)>this.time)d.task=null;return;}
   let amount=Math.min(t.amount,stats.drone.load);if(t.order){const q=this.supplyOrder(to,t.order,d.team);if(!q){d.task=null;return;}let left=amount;for(const a of q.allocations.filter(a=>a.store===from.id&&a.resource===t.resource)){const take=Math.min(left,a.amount,from.inventory[t.resource]);a.amount-=take;from.inventory[t.resource]-=take;left-=take;}amount-=left;q.allocations=q.allocations.filter(a=>a.amount>1e-8);q.reserved=q.allocations.filter(a=>a.resource==='weapons').reduce((n,a)=>n+a.amount,0);if(amount>0)d.carry={resource:t.resource,amount,order:t.order,target:to.id};}
   else{amount=Math.min(amount,this.transportAvailable(d,from,t.resource,t.buffer),this.transportRoom(d,to,t.resource));if(amount>0){if(t.buffer)from.buffer-=amount;else from.inventory[t.resource]-=amount;d.carry={resource:t.resource,amount,to:to.id};if(t.buffer)d.carry.fresh=from.type==='farm'?'food':'extraction';}}
   d.task=null;d.path=[];
  }
 });
}
if(typeof module!=='undefined')module.exports={install};else install(root.RTS);
})(typeof window!=='undefined'?window:globalThis);
