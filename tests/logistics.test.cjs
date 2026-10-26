const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game,stats,droneCost,DRONE_TIME,DRONE_MINERAL_UPKEEP,logisticsPriorities,W,dist}=require('../engine');
const {detachCarriers,activate}=require('./transport-fixture.cjs');
const step=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*10);i++)g.tick(.1);};
const until=(g,fn,seconds=180)=>{for(let i=0;i<seconds*10&&!fn();i++)g.tick(.1);assert.ok(fn(),'logistics action completes');};
const make=()=>{const g=new Game(42);g.storages()[0].capacity=100000;g.stock().food=10000;g.stock().tokens=10000;g.stock().minerals=10000;return g;};

test('starter robots belong to the core, use docks but no population, and all free residents wait indoors',()=>{
 const g=new Game(42),base=g.storages()[0];assert.equal(g.carriers(base).length,2);assert.equal(stats.base.carrierSlots,2);assert.equal(stats.warehouse.carrierSlots,4);assert.equal(g.freeWorkers().length,6);assert.equal(g.population().total,6);assert.equal(g.upkeep().food,6);assert.equal(g.upkeep().tokens,0);assert.equal(g.upkeep().minerals,2);assert.ok(g.freeWorkers().every(w=>w.inside===base.id));assert.ok(!g.visible().some(e=>stats[e.type]?.speed));step(g,2);assert.equal(g.carriers(base).length,2);
});
test('buying reserves a real dock, costs tokens and minerals, takes six seconds and never consumes a human slot',()=>{
 const g=make(),b=g.add('warehouse',0,90.5,54.5),pop=g.population().total,before={...g.stock()};g.tick(.1);assert.equal(g.carriers(b).length,0);assert.ok(g.buyDrone(b.id));assert.equal(g.stock().tokens,before.tokens+.06-droneCost.tokens);assert.equal(g.stock().minerals,before.minerals-droneCost.minerals);assert.equal(g.population().total,pop);step(g,DRONE_TIME-.2);assert.equal(g.carriers(b).length,0);assert.ok(g.productionView(b).progress>.9);step(g,.2);assert.equal(g.carriers(b).length,1);for(let i=0;i<3;i++)assert.ok(g.buyDrone(b.id));const stock={...g.stock()};assert.equal(g.buyDrone(b.id),false);assert.deepEqual({...g.stock()},stock);step(g,19);assert.equal(g.carriers(b).length,4);assert.equal(b.droneQueue.length,0);assert.equal(g.population().total,pop);
});
test('robots consume minerals only; humans consume food only; an unserviced robot loses health without charging tokens',()=>{
 const g=new Game(42),tokens=g.stock().tokens,food=g.stock().food,minerals=g.stock().minerals;step(g,10.1);assert.equal(g.stock().minerals,minerals-2*DRONE_MINERAL_UPKEEP);assert.equal(g.stock().food,food-6);assert.ok(Math.abs(g.stock().tokens-tokens-g.time*.6)<1e-6);g.stock().minerals=0;const ds=g.carriers(g.storages()[0]);step(g,10);assert.ok(ds.every(d=>d.hp===stats.drone.hp-5));assert.equal(g.upkeep().tokens,0);assert.equal(g.upkeep().food,6);
});
test('a destroyed or captured dock refunds its paid unfinished robots to the previous owner once',()=>{
 const g=make(),b=g.add('warehouse',0,90.5,54.5);g.buyDrone(b.id);g.buyDrone(b.id);const minerals=g.stock().minerals,tokens=g.stock().tokens;b.hp=0;g.tick(.1);assert.equal(g.stock().minerals,minerals+2*droneCost.minerals);assert.ok(Math.abs(g.stock().tokens-tokens-2*droneCost.tokens-.06)<1e-6);g.tick(.1);assert.equal(g.stock().minerals,minerals+2*droneCost.minerals);assert.equal(g.buyDrone(b.id),false);
 const foreign=g.add('warehouse',1,100.5,54.5);assert.equal(g.buyDrone(foreign.id),false);const pending=g.add('warehouse',0,110.5,54.5);pending.construction=10;assert.equal(g.buyDrone(pending.id),false);assert.equal(g.buyDrone(g.storages()[0].id),false);
});
test('residents walk from the core to work, visibly sow and harvest fields, then walk home when unassigned',()=>{
 const g=make(),base=g.storages()[0],farm=g.add('farm',0,84.5,45.5),field=g.add('field',0,88,45);assert.ok(g.assign(farm.id));const w=g.workers(farm)[0];assert.equal(w.inside,null);assert.ok(g.adjacent(w,base));assert.ok(g.visible().includes(w));assert.equal(g.freeWorkers().length,5);until(g,()=>w.arrivedJob===farm.id);until(g,()=>field.fieldStage==='growing');until(g,()=>w.inside===farm.id);assert.ok(!g.visible().includes(w));until(g,()=>w.phase==='return');assert.ok(g.visible().includes(w));assert.ok(g.adjacent(w,field));until(g,()=>w.phase==='process');until(g,()=>!w.phase);assert.ok(g.unassign(farm.id));assert.ok(g.visible().includes(w));assert.equal(g.freeWorkers().length,6);until(g,()=>w.inside===base.id);assert.ok(!g.visible().includes(w));
});
test('a builder physically leaves and returns to the core and nobody carries ordinary cargo as a human',()=>{
 const g=make(),base=g.storages()[0],pos=g.findSite('house'),b=g.build('house',pos.x,pos.y);until(g,()=>b.builder);const w=g.get(b.builder);assert.ok(g.visible().includes(w));assert.equal(g.freeWorkers().length,5);until(g,()=>g.ready(b));assert.equal(w.job,null);until(g,()=>w.inside===base.id);assert.equal(g.freeWorkers().length,6);const mine=g.add('ironmine',0,95,40);mine.buffer=20;until(g,()=>g.alive().some(d=>d.type==='drone'&&d.carry));assert.ok(g.alive().filter(e=>e.type==='worker').every(e=>!e.carry));
});
test('minerals miners commute to the post before extracting, remain visible outdoors and hide during unloading',()=>{
 const g=make(),post=g.add('ironmine',0,63,40);assert.ok(g.assign(post.id));const w=g.workers(post)[0];until(g,()=>w.arrivedJob===post.id);assert.ok(g.adjacent(w,post));until(g,()=>w.carry?.raw);assert.ok(g.visible().includes(w));until(g,()=>w.phase==='gas-pack');assert.ok(!g.visible().includes(w));until(g,()=>!w.carry);assert.ok(post.buffer>0);assert.ok(g.visible().includes(w));
});
test('robot claims are exclusive and source buffer plus cargo plus delivered stock is conserved',()=>{
 const g=make(),base=g.storages()[0],ds=g.carriers(base),post=g.add('ironmine',0,90,40),other=g.add('goldmine',0,98,40);post.buffer=other.buffer=40;for(const d of ds){d.inside=null;d.x=60.5;d.y=60.5;g.carrier(d,.1);}assert.equal(new Set(ds.map(d=>d.task.from)).size,2);assert.equal(post.buffer,40);assert.equal(other.buffer,40);const start=g.stock().crystals;until(g,()=>other.buffer===0&&ds.every(d=>d.carry?.resource!=='crystals'));assert.equal(g.stock().crystals,start+40);assert.ok(g.freeWorkers().every(w=>!w.pickup&&!w.transfer&&!w.supply));
});
test('a mine can supply the factory directly while delivery reservations cap the actual input demand',()=>{
 const g=make(),base=g.storages()[0],factory=g.add('factory',0,88,48),shop=g.add('weaponshop',0,91,48),post=g.add('ironmine',0,96,42);shop.parent=factory.id;g.assign(shop.id);base.inventory.minerals=0;post.buffer=40;const ds=g.carriers(base);for(const d of ds){d.inside=null;d.x=94.5;d.y=45.5;g.carrier(d,.1);}assert.ok(ds.some(d=>d.task?.kind==='production'&&d.task.from===post.id&&d.task.to===factory.id));const promised=ds.reduce((n,d)=>n+(d.task?.to===factory.id?d.task.amount:0)+(d.carry?.to===factory.id?d.carry.amount:0),0);assert.equal(promised,stats.weaponshop.recipe.minerals*2);until(g,()=>factory.inventory.minerals===promised);assert.equal(factory.inventory.minerals,stats.weaponshop.recipe.minerals*2);assert.equal(base.inventory.minerals,0);
});
test('factory inputs have priority over military supplies and ordinary output; tuning remains data-only',()=>{
 const g=make(),base=g.storages()[0],ds=detachCarriers(g),b=g.add('barracks',0,95,54),factory=g.add('factory',0,88,48),shop=g.add('weaponshop',0,91,48),mine=g.add('ironmine',0,60,40);g.add('house',0,60.5,52.5);shop.parent=factory.id;g.assign(shop.id);mine.buffer=30;assert.ok(g.train(b.id));const d=activate(g,ds[0]);d.x=60.5;d.y=55.5;g.carrier(d,.1);assert.equal(d.task.kind,'production');assert.equal(d.task.to,factory.id);assert.ok(logisticsPriorities.production>logisticsPriorities.military);assert.ok(logisticsPriorities.military>logisticsPriorities.output);assert.deepEqual(logisticsPriorities.resources,{});
});
test('the scheduler skips an unreachable source and handles reachable work without sending a group',()=>{
 const g=make(),ds=g.carriers(g.storages()[0]),a=g.add('ironmine',0,30,30),b=g.add('goldmine',0,85,40);a.buffer=b.buffer=20;for(let y=27;y<=32;y++)for(let x=27;x<=32;x++)if(x===27||y===27||x===32||y===32)g.planet().terrain[y][x]=1;g.carrier(ds[0],.1);assert.equal(ds[0].task.from,b.id);assert.notEqual(ds[1].task?.from,b.id);until(g,()=>b.buffer===0&&ds.every(d=>!d.carry));assert.equal(a.buffer,20);
});
test('a drone is ground-bound, follows a road detour and gains exactly twice the road speed',()=>{
 const g=make(),d=g.carriers(g.storages()[0])[0];d.inside=null;d.x=20.5;d.y=20.5;const p=g.planet();for(let y=20;y<=30;y++){p.roads.add(y*W+20);p.roads.add(y*W+30);}for(let x=20;x<=30;x++)p.roads.add(30*W+x);d.path=g.path(20.5,20.5,30.5,20.5);assert.ok(d.path.length>20);assert.ok(d.path.every(c=>p.roads.has(Math.floor(c.y)*W+Math.floor(c.x))));const before=d.y;g.move(d,.1);assert.ok(Math.abs(d.y-before-stats.drone.speed*.2)<1e-8);assert.equal(d.x,20.5);p.terrain[21][20]=1;d.path=[{x:20.5,y:21.5}];const pos={x:d.x,y:d.y};g.move(d,1);assert.equal(dist(d,pos),0);
});
test('a robot survives removal of its dock with cargo, rebinds without exceeding paid/queued slots',()=>{
 const g=make(),base=g.storages()[0],d=g.carriers(base)[0],dock=g.add('warehouse',0,90.5,55.5);for(let i=0;i<4;i++)g.buyDrone(dock.id);d.inside=null;d.carry={resource:'crystals',amount:7};base.hp=0;g.syncCarriers(g.planet());assert.equal(d.home,null);assert.equal(d.carry.amount,7);assert.equal(dock.droneQueue.length,4);dock.droneQueue.pop();g.syncCarriers(g.planet());assert.equal(d.home,dock.id);assert.equal(g.carriers(dock).length,1);assert.equal(d.carry.amount,7);until(g,()=>!d.carry);assert.equal(dock.inventory.crystals,7);
});
test('drones are rendered smaller than human workers in both styles without fractional pixels or mutation',()=>{
 const art=require('../art'),bounds=(type,style)=>{art.setStyle(style);const rects=[],ctx=new Proxy({fillRect:(x,y,w,h)=>rects.push([x,y,w,h])},{get:(t,k)=>k in t?t[k]:()=>{},set:()=>true}),e={type,team:0,walkDistance:2,moving:true,carry:{resource:'minerals',amount:5}},before=JSON.stringify(e);art.unit(ctx,e,40,50,2);assert.equal(JSON.stringify(e),before);assert.ok(rects.every(a=>a.every(Number.isInteger)));return{w:Math.max(...rects.map(a=>a[0]+a[2]))-Math.min(...rects.map(a=>a[0])),h:Math.max(...rects.map(a=>a[1]+a[3]))-Math.min(...rects.map(a=>a[1]))};};for(const style of ['refined','classic']){const d=bounds('drone',style),w=bounds('worker',style);assert.ok(d.h<w.h*.65);assert.ok(d.w*d.h<w.w*w.h);}art.setStyle('refined');
});

test('capture preserves bought robots and their cargo but refunds the unbuilt order outside the captured surface',()=>{
 const g=make(),planet=1;g.regions[planet].owner=1;const host=g.add('base',1,72,48,planet);host.inventory.tokens=100;host.inventory.minerals=100;assert.ok(g.buyDrone(host.id,1));const d=g.spawnCarrier(host);d.inside=null;d.carry={resource:'gas',amount:7};g.capturePlanet(planet,0);assert.equal(d.team,0);assert.equal(d.home,host.id);assert.equal(d.carry.amount,7);assert.equal(host.droneQueue.length,0);assert.equal(g.teams[1].pending.tokens,droneCost.tokens);assert.equal(g.teams[1].pending.minerals,droneCost.minerals);assert.equal(g.carriers(host).length,1);assert.equal(host.inventory.minerals,100-droneCost.minerals);
});
test('robot orders follow battle process permissions: attackers blocked, defenders may purchase',()=>{
 const g=make(),dock=g.add('warehouse',0,90.5,55.5),unit={id:g.nextId++,type:'soldier',team:0,planet:0,hp:140,maxHp:140,location:'reserve'};g.military.push(unit);g.startBattle(1,0,[unit],g.guardians(1));const before={...g.stock()};assert.equal(g.buyDrone(dock.id),false);assert.deepEqual({...g.stock()},before);
 const h=make(),other=h.add('warehouse',0,90.5,55.5);h.startBattle(0,2,h.makeGuards('pirates',2,0),[]);assert.ok(h.buyDrone(other.id));assert.equal(other.droneQueue.length,1);
});
test('an idle robot returns to its dock smoothly while dispatch checks are throttled',()=>{
 const g=make(),d=g.carriers(g.storages()[0])[0];d.inside=null;d.x=82.5;d.y=48.5;d.walkDistance=0;step(g,.5);assert.ok(d.walkDistance>=stats.drone.speed*.5-.01);until(g,()=>d.inside===d.home);assert.equal(d.returning,false);
});
test('a route blocked after dispatch releases the unpaid pickup claim without losing resources',()=>{
 const g=make(),d=g.carriers(g.storages()[0])[0],post=g.add('ironmine',0,96,40);post.buffer=20;g.carrier(d,.1);assert.equal(d.task.from,post.id);for(let y=37;y<=42;y++)for(let x=93;x<=98;x++)if(x===93||x===98||y===37||y===42)g.planet().terrain[y][x]=1;d.path=[];d.retry=0;g.carrier(d,.1);assert.equal(d.task,null);assert.equal(d.carry,null);assert.equal(post.buffer,20);
});
test('a loaded robot reroutes when a formerly reachable delivery becomes blocked',()=>{
 const g=make(),base=g.storages()[0],d=g.carriers(base)[0],blocked=g.add('warehouse',0,96.5,48.5),other=g.add('warehouse',0,86.5,50.5);base.capacity=g.stored(base);d.inside=null;d.x=90.5;d.y=48.5;d.carry={resource:'crystals',amount:7,to:blocked.id};for(let y=45;y<=51;y++)for(let x=93;x<=99;x++)if(x===93||x===99||y===45||y===51)g.planet().terrain[y][x]=1;g.carrier(d,.1);assert.equal(d.carry.to,undefined);until(g,()=>!d.carry);assert.equal(other.inventory.crystals,7);assert.equal(blocked.inventory.crystals,0);
});
