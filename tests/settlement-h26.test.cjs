const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game,stats,resources}=require('../engine');
const make=()=>{const g=new Game(42);g.storages()[0].capacity=100000;g.stock().food=10000;return g;};
test('nearest receiving store beats a home dock, skips full stores and accounts for promised capacity',()=>{
 const g=make(),home=g.storages()[0],d=g.carriers(home)[0],post=g.add('ironmine',0,100,40),near=g.add('warehouse',0,104.5,40.5),far=g.add('warehouse',0,111.5,40.5);post.buffer=20;d.inside=null;d.x=98.5;d.y=40.5;
 assert.ok(g.chooseTransport(d));assert.equal(d.task.from,post.id);assert.equal(d.task.to,near.id);d.task=null;d.path=[];
 near.capacity=1;near.inventory.food=1;assert.ok(g.chooseTransport(d));assert.equal(d.task.to,far.id);d.task=null;
 near.capacity=21;const other=g.carriers(home)[1];other.carry={resource:'food',amount:20,to:near.id};assert.equal(g.nearestStorage(d,'metal'),far);other.carry=null;assert.equal(g.nearestStorage(d,'metal'),near);
});
test('loaded carrier reroutes to closest available store and preserves cargo when all stores are full',()=>{
 const g=make(),base=g.storages()[0],d=g.carriers(base)[0],near=g.add('warehouse',0,92.5,45.5),far=g.add('warehouse',0,107.5,45.5);d.inside=null;d.x=90.5;d.y=45.5;near.capacity=far.capacity=0;base.capacity=g.stored(base);d.carry={resource:'crystals',amount:7,to:base.id};g.carrier(d,.1);assert.equal(d.carry.amount,7);assert.equal(d.carry.to,undefined);far.capacity=100;near.capacity=100;d.retry=0;g.carrier(d,.1);assert.equal(d.carry,null);assert.equal(near.inventory.crystals,7);assert.equal(far.inventory.crystals,0);
});
test('workforce separates bought residents, staffed commutes, construction, raw cargo, queued hires and robots globally',()=>{
 const g=make(),core=g.storages()[0];assert.deepEqual(g.workforce(),{total:6,free:6,staffed:0,busy:0,drones:2,hauling:0});const farm=g.add('farm',0,84.5,45.5);g.assign(farm.id);assert.equal(g.workforce().staffed,1);const ws=g.freeWorkers();ws[0].building=123;ws[1].carry={raw:true,resource:'metal',amount:6};assert.equal(g.workforce().busy,2);assert.equal(g.workforce().free,3);g.add('house',0,110.5,65.5);assert.ok(g.hire(core.id));assert.equal(g.workforce().total,6);g.regions[1].owner=0;g.add('base',0,72,48,1);g.add('worker',0,75,48,1);assert.equal(g.workforce().total,7);assert.equal(g.workforce(0,0).total,6);assert.equal(g.workforce(0,1).free,1);const d=g.carriers(core)[0];d.carry={resource:'food',amount:2};assert.equal(g.workforce().hauling,1);assert.equal(g.population().workers,7);g.workers(farm)[0].hp=0;assert.equal(g.workforce().staffed,0);
});
test('every second-tier batch takes more inputs and time without changing hiring, extraction or maintenance',()=>{
 const old={weaponshop:[6,2,8],ammoshop:[2,3,6],armorshop:[5,3,8],explosiveshop:[3,2,3,10],medicineshop:[4,2,8]};for(const [type,values]of Object.entries(old)){const cycle=values.pop();assert.ok(stats[type].cycle>cycle);Object.values(stats[type].recipe).forEach((n,i)=>assert.ok(n>values[i]));}
 const g=new Game(42);assert.deepEqual(g.upkeep(),{food:6,money:0,metal:2});assert.equal(stats.ironmine.gatherTime,3);assert.equal(stats.goldmine.gatherTime,3.5);
});
