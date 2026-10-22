const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../engine.js');
const create=()=>new Game(42,{ai:false});
const advance=(g,t)=>{for(let i=0;i<Math.ceil(t*10);i++)g.tick(.1);};
const until=(g,fn,t=100)=>{for(let i=0;i<t*10&&!fn();i++)g.tick(.1);assert.ok(fn(),'simulation reached expected state');};
const site=(g,type)=>{const p=g.findSite(type,0);assert.ok(p);return g.build(type,p.x,p.y);};
const workers=g=>g.alive().filter(u=>u.team===0&&u.type==='worker');
test('site waits without idle workers, then assigns a released resident and finishes',()=>{
 const g=create();for(const u of workers(g))u.order={type:'hold'};
 const b=site(g,'house'),food=g.stock().food;advance(g,6);assert.equal(b.builder,null);assert.equal(b.construction,12);assert.ok(g.stock().food<food);
 const u=workers(g)[0];g.release(u);until(g,()=>b.builder===u.id);assert.equal(u.building,b.id);
 until(g,()=>g.ready(b));assert.equal(b.builder,null);assert.equal(u.building,null);assert.equal(g.population().total,6);
});
test('construction pauses if the builder dies and a replacement completes the existing site',()=>{
 const g=create(),b=site(g,'house');until(g,()=>b.construction<10);const builder=g.get(b.builder);for(const u of workers(g))if(u!==builder)u.order={type:'hold'};
 const remaining=b.construction;builder.hp=0;advance(g,2);assert.equal(b.construction,remaining);assert.equal(b.builder,null);
 const replacement=workers(g)[0];g.release(replacement);until(g,()=>g.ready(b));assert.equal(g.population().total,5);assert.equal(replacement.building,null);
});
test('one worker builds queued sites sequentially, never progresses two sites at once',()=>{
 const g=create();for(const u of workers(g).slice(1))u.order={type:'hold'};const a=site(g,'house'),b=site(g,'farm');g.tick(.1);assert.ok(a.builder);assert.equal(b.builder,null);
 until(g,()=>g.ready(a));assert.equal(b.construction,12);until(g,()=>g.ready(b));assert.equal(g.population().capacity,10);
});
test('workers enter workplaces, disappear from visibility and combat targets, but remain fed residents',()=>{
 const g=create(),b=site(g,'farm');until(g,()=>g.ready(b));const u=workers(g)[0];g.assign([u.id],b.id);assert.equal(u.inside,null);until(g,()=>u.inside===b.id);
 const population=g.population().total,hp=u.hp;assert.ok(!g.visible().includes(u));assert.equal(g.population().total,population);const before=g.stock().food;advance(g,5.1);assert.ok(g.stock().food<before+30);assert.equal(u.hp,hp);
 g.stock().food=0;b.buffer=0;for(const other of workers(g))other.carry=null;g.economyClock=4.95;g.tick(.1);assert.ok(u.hp<hp);const currentHp=u.hp;const enemy=g.add('soldier',1,u.x,u.y);enemy.order={type:'attack',id:u.id};g.combat(enemy,.1);assert.equal(enemy.order,null);assert.equal(u.hp,currentHp);g.command([u.id],u.x+5,u.y+5);assert.equal(u.order,null);assert.equal(u.inside,b.id);
 g.release(u);assert.equal(u.inside,null);assert.ok(g.visible().includes(u));assert.equal(u.job,null);
});
test('destroying an occupied workplace releases its residents and assigned production stops',()=>{
 const g=create(),b=site(g,'farm');until(g,()=>g.ready(b));const u=workers(g)[0];g.assign([u.id],b.id);until(g,()=>u.inside===b.id);b.hp=0;g.tick(.1);assert.equal(u.inside,null);assert.equal(u.job,null);assert.ok(g.visible().includes(u));
});
test('walking animation advances with actual displacement, then rests on arrival',()=>{
 const g=create(),u=workers(g)[0];const p=g.path(u.x,u.y,u.x+4,u.y+4);assert.ok(p.length);u.path=p;u.order={type:'move'};const phase=u.walkDistance;g.tick(.1);assert.ok(u.walkDistance>phase);assert.ok(u.moving);assert.ok(Math.abs(u.facingX)>0&&Math.abs(u.facingY)>0);until(g,()=>!u.order);g.tick(.1);assert.equal(u.moving,false);
});
test('an unreachable construction site does not progress until a route opens',()=>{
 const g=create(),b=site(g,'house'),u=workers(g)[0];for(const other of workers(g).slice(1))other.order={type:'hold'};
 const x=Math.floor(u.x),y=Math.floor(u.y);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)g.terrain[y+dy][x+dx]=1;
 advance(g,2);assert.equal(b.builder,null);assert.equal(b.construction,12);g.terrain[y][x-1]=0;until(g,()=>g.ready(b));assert.equal(u.building,null);
});
test('barracks can retrain an indoor worker without losing population or leaving a ghost job',()=>{
 const g=create(),farm=site(g,'farm');until(g,()=>g.ready(farm));const u=workers(g)[0];g.assign([u.id],farm.id);until(g,()=>u.inside===farm.id);
 const p=g.findSite('barracks',0),barracks=g.add('barracks',0,p.x,p.y);for(const other of workers(g))if(other!==u)other.carry={resource:'wood',amount:1};
 const total=g.population().total;assert.ok(g.train(barracks.id));assert.equal(u.training,barracks.id);assert.equal(u.inside,null);assert.equal(u.job,null);assert.ok(g.visible().includes(u));until(g,()=>u.type==='soldier');assert.equal(g.population().total,total);assert.equal(g.workers(farm).length,0);
});
