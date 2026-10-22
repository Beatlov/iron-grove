const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,stats,unitCosts,isMilitary}=require('../engine.js');
const create=()=>new Game(42,{ai:false});
const advance=(g,t)=>{for(let i=0;i<Math.ceil(t*10);i++)g.tick(.1);};
test('all four chassis train from existing drones, charge their own prices and preserve population',()=>{
 const g=create(),b=g.add('barracks',0,40,40);
 for(const r of Object.keys(g.stock()))g.stock()[r]=10000;
 const original=g.population().total;
 for(const type of Object.keys(unitCosts)){
  const before={...g.stock()};assert.ok(g.train(b.id,0,type));const q=b.queue[0],u=g.get(q.id);
  assert.equal(q.type,type);assert.equal(q.left,stats[type].trainTime);
  for(const [r,n]of Object.entries(unitCosts[type]))assert.equal(g.stock()[r],before[r]-n);
  u.x=41.5;u.y=40;advance(g,stats[type].trainTime+.2);
  assert.equal(u.type,type);assert.equal(u.hp,stats[type].hp);assert.equal(u.training,null);assert.equal(g.population().total,original);
  assert.ok(isMilitary(u));
 }
 assert.equal(g.population().soldiers,4);assert.equal(g.population().workers,2);
 const before={...g.stock()};assert.equal(g.train(b.id,0,'invalid'),false);assert.deepEqual(g.stock(),before);
});
test('mixed training queue limits capacity and preserves chosen class order',()=>{
 const g=create(),b=g.add('barracks',0,40,40);for(const r of Object.keys(g.stock()))g.stock()[r]=10000;
 for(const type of ['medic','assault','grenadier'])assert.ok(g.train(b.id,0,type));
 assert.equal(g.train(b.id,0,'soldier'),false);assert.deepEqual(b.queue.map(q=>q.type),['medic','assault','grenadier']);
 const drones=b.queue.map(q=>g.get(q.id));for(const u of drones){u.x=41.5;u.y=40;}
 advance(g,29);assert.deepEqual(drones.map(u=>u.type),['medic','assault','grenadier']);
});
test('marine fires at range, assault needs contact and armor absorbs incoming damage',()=>{
 const g=create(),marine=g.add('soldier',0,50,40),target=g.add('assault',1,54,40);
 g.combat(marine,.1);assert.equal(target.hp,stats.assault.hp-(stats.soldier.damage-stats.assault.armor));
 const hp=marine.hp;g.combat(target,.1);assert.equal(marine.hp,hp);
 target.x=51;g.combat(target,.1);assert.equal(marine.hp,hp-(stats.assault.damage-stats.soldier.armor));
 assert.ok(g.effects.some(e=>e.kind==='shot'));assert.ok(g.effects.some(e=>e.kind==='slash'));
});
test('medic heals nearest wounded ally without overheal or enemy attacks, including explicit orders',()=>{
 const g=create(),medic=g.add('medic',0,50,40),near=g.add('soldier',0,52,40),far=g.add('assault',0,54,40),foe=g.add('worker',1,51,40);
 near.hp=near.maxHp-5;far.hp=10;
 g.combat(medic,.1);assert.equal(near.hp,near.maxHp);assert.equal(far.hp,10);assert.equal(foe.hp,foe.maxHp);
 g.command([medic.id],foe.x,foe.y,foe.id);g.combat(medic,1);assert.equal(foe.hp,foe.maxHp);assert.equal(medic.order,null);
 assert.equal(far.hp,26);assert.ok(g.effects.some(e=>e.kind==='heal'));
 far.x=56;g.combat(medic,1);assert.equal(far.hp,26);
});
test('grenadier prioritizes structures and deals siege damage, but cannot bypass home sector protection',()=>{
 const g=create(),u=g.add('grenadier',0,50,40),building=g.add('house',1,55,40),enemy=g.add('worker',1,52,40);
 g.combat(u,.1);assert.equal(building.hp,stats.house.hp-90);assert.equal(enemy.hp,enemy.maxHp);
 g.combat(u,1);assert.equal(building.hp,stats.house.hp-90);g.combat(u,1);assert.equal(building.hp,stats.house.hp-180);
 const base=g.alive().find(e=>e.team===1&&e.type==='base');u.x=base.x-4;u.y=base.y;const hp=base.hp;
 g.combat(u,2);assert.equal(base.hp,hp);g.regions[g.homeRegions[1]].owner=0;
 g.command([u.id],base.x,base.y,base.id);g.combat(u,2);assert.equal(base.hp,hp-90);
});
test('every new class captures sectors, pays military upkeep and demobilizes to a drone',()=>{
 for(const type of ['assault','medic','grenadier']){
  const g=create(),r=g.regions.find(r=>g.canCapture(r.id)),tower=g.get(r.towerId),u=g.add(type,0,tower.x+1.5,tower.y);
  assert.ok(g.capture([u.id],r.id));advance(g,12.2);assert.equal(r.owner,0,type);
  g.stock().gold=0;g.economyClock=4.99;const hp=u.hp;g.tick(.1);assert.equal(u.hp,hp-8);assert.equal(g.population().soldiers,1);
  g.demobilize([u.id]);assert.equal(u.type,'worker');assert.equal(g.population().soldiers,0);assert.ok(u.hp<=stats.worker.hp);
 }
});
