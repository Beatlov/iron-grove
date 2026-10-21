const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,stats,resources,soldierCost,W,H}=require('../engine.js');
const advance=(g,t)=>{for(let i=0;i<Math.ceil(t*10);i++)g.tick(.1);};
const create=()=>new Game(42,{ai:false});
const build=(g,type,complete=true)=>{const p=g.findSite(type,0);assert.ok(p,`site: ${type}`);const b=g.build(type,p.x,p.y);if(complete)advance(g,b.construction+.1);return b;};
const workers=g=>g.alive().filter(e=>e.team===0&&e.type==='worker');
test('seeded territories and deposits are reproducible; both teams start with equal reserves',()=>{const g=create(),same=create(),h=new Game(43);assert.deepEqual(g.stock(0),g.stock(1));assert.deepEqual(g.population(0),g.population(1));assert.deepEqual(g.regionGrid,same.regionGrid);assert.notDeepEqual(g.regionGrid,h.regionGrid);for(const id of g.homeRegions)for(const resource of ['wood','stone','iron','gold'])assert.equal(g.alive().filter(e=>e.type==='deposit'&&e.resource===resource&&g.regionAt(e.x,e.y).id===id).length,3);});
test('construction pays all costs once and rejects blocked or remote deposits',()=>{const g=create(),before={...g.stock()};const base=g.alive().find(e=>e.type==='base'&&e.team===0);assert.equal(g.build('house',Math.round(base.x),Math.round(base.y)),false);assert.equal(g.build('ironmine',18,13),false);assert.deepEqual(g.stock(),before);const b=build(g,'house',false);for(const r of resources)assert.equal(g.stock()[r],before[r]-(stats.house.cost[r]||0));assert.equal(g.build('house',b.x,b.y),false);});
test('production requires arrival; stock only grows after carrier delivery',()=>{const g=create(),b=build(g,'sawmill'),u=workers(g)[0];const before=g.stock().wood;assert.equal(g.assign([u.id],b.id),1);advance(g,2);assert.equal(g.stock().wood,before);advance(g,30);assert.ok(g.stock().wood>before);assert.ok(g.get(b.node).amount<2400);assert.ok(b.buffer<=60);});
test('two work slots, releasing workers and carrying food to a warehouse',()=>{const g=create(),b=build(g,'farm');assert.equal(g.assign(workers(g).map(u=>u.id),b.id),2);assert.equal(g.workers(b).length,2);const store=build(g,'warehouse'),u=workers(g).find(u=>!u.job);u.x=store.x+1.5;u.y=store.y;u.carry={resource:'food',amount:20};const before=g.stock().food;g.tick(.1);assert.equal(g.stock().food,before+20);assert.equal(u.carry,null);g.release(g.workers(b)[0]);assert.equal(g.workers(b).length,1);});
test('houses add capacity and grow population using food',()=>{const g=create();build(g,'house');assert.equal(g.population().capacity,10);advance(g,21);assert.equal(g.population().total,7);assert.ok(g.stock().food<180-8);assert.ok(workers(g).some(u=>!g.cellBlocked(Math.floor(u.x),Math.floor(u.y))));});
test('barracks retrains an existing worker and charges wood iron gold',()=>{const g=create(),b=build(g,'barracks'),before={...g.stock()},pop=g.population().total;assert.equal(g.train(b.id),true);for(const [r,n]of Object.entries(soldierCost))assert.equal(g.stock()[r],before[r]-n);assert.equal(b.queue.length,1);advance(g,20);assert.equal(g.population().total,pop);assert.equal(g.population().soldiers,1);assert.equal(b.queue.length,0);g.demobilize(g.alive().filter(e=>e.type==='soldier').map(e=>e.id));assert.equal(g.population().soldiers,0);assert.equal(g.population().workers,pop);});
test('food and gold upkeep cause damage only on shortage',()=>{const g=create(),u=workers(g)[0];u.type='soldier';u.hp=120;u.maxHp=120;advance(g,5.1);assert.equal(g.stock().food,174);assert.equal(g.stock().gold,79.5);assert.equal(u.hp,120);g.stock().food=0;g.stock().gold=0;advance(g,5);assert.equal(u.hp,104);assert.ok(g.teams[0].hungry&&g.teams[0].unpaid);});
test('AI builds its economy and trains paid residents into an attacking army',()=>{const g=new Game(42);advance(g,240);const buildings=g.alive().filter(e=>e.team===1).map(e=>e.type);for(const t of ['farm','sawmill','quarry','house','ironmine','goldmine','barracks'])assert.ok(buildings.includes(t),t);const army=g.alive().filter(e=>e.team===1&&e.type==='soldier');assert.ok(army.length>=3,`army ${army.length}`);assert.ok(army.some(e=>['capture','attack'].includes(e.order?.type)));assert.ok(g.population(1).workers>=8);});
test('tower shoots enemies and army can destroy opposing town hall',()=>{const g=create(),tower=build(g,'tower'),enemy=g.add('soldier',1,tower.x+4,tower.y);advance(g,2);assert.ok(enemy.hp<120);const base=g.alive().find(e=>e.team===1&&e.type==='base'),ids=[];g.regions[g.homeRegions[1]].owner=0;g.get(g.regions[g.homeRegions[1]].towerId).team=0;g.stock().food=10000;g.stock().gold=10000;for(let i=0;i<16;i++)ids.push(g.add('soldier',0,base.x-4,base.y-3+i%6).id);g.command(ids,base.x,base.y,base.id);advance(g,30);assert.equal(g.result,'victory');const time=g.time;g.tick(.1);assert.equal(g.time,time);});
test('lost hall causes defeat, destroyed jobs and training release survivors',()=>{const g=create(),farm=build(g,'farm'),b=build(g,'barracks');g.assign([workers(g)[0].id],farm.id);g.train(b.id);farm.hp=0;b.hp=0;advance(g,1);assert.ok(workers(g).every(u=>!u.job&&!u.training));g.alive().find(e=>e.type==='base'&&e.team===0).hp=0;g.tick(.1);assert.equal(g.result,'defeat');});

test('construction takes simulation time and unfinished houses grant no capacity or births',()=>{
 const g=create(),b=build(g,'house',false),before={...g.stock()};assert.equal(b.construction,12);assert.equal(g.population().capacity,6);assert.ok(g.cellBlocked(b.x,b.y));
 advance(g,11);assert.ok(!g.ready(b));assert.equal(g.population().capacity,6);assert.equal(g.population().total,6);
 advance(g,1.1);assert.ok(g.ready(b));assert.equal(g.population().capacity,10);assert.equal(g.stock().wood,before.wood);advance(g,20);assert.equal(g.population().total,7);
});
test('unfinished production and barracks reject staffing and training; readiness enables both',()=>{
 const g=create(),farm=build(g,'farm',false),barracks=build(g,'barracks',false),u=workers(g)[0],before={...g.stock()};
 assert.equal(g.assign([u.id],farm.id),0);assert.equal(g.train(barracks.id),false);assert.deepEqual(g.stock(),before);advance(g,11);assert.equal(farm.buffer,0);
 advance(g,2);assert.equal(g.assign([u.id],farm.id),1);assert.equal(g.train(barracks.id),false);advance(g,10);assert.ok(g.train(barracks.id));
});
test('unfinished towers cannot shoot and unfinished warehouses cannot accept deliveries',()=>{
 const g=create(),tower=build(g,'tower',false),store=g.build('warehouse',18,22),enemy=g.add('soldier',1,tower.x+4,tower.y),u=workers(g)[0];
 u.x=store.x+1.5;u.y=store.y;u.carry={resource:'iron',amount:20};const before=g.stock().iron;advance(g,1);assert.equal(enemy.hp,120);assert.equal(g.stock().iron,before);
 advance(g,24);assert.ok(enemy.hp<120);
});
test('large map remains navigable and destroyed construction never activates',()=>{
 const g=create();assert.equal(W,144);assert.equal(H,96);const p=g.path(15.5,22.5,W-15.5,22.5);assert.ok(p.length>40);assert.ok(p.every(c=>!g.cellBlocked(Math.floor(c.x),Math.floor(c.y))));
 const house=build(g,'house',false);house.hp=0;advance(g,25);assert.equal(g.get(house.id),undefined);assert.equal(g.population().capacity,6);
});
