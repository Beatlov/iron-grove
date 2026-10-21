const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game,W,H}=require('../engine.js');
const make=()=>new Game(42,{ai:false}),advance=(g,t)=>{for(let i=0;i<Math.ceil(t*10);i++)g.tick(.1);};
const supply=g=>{for(const t of g.teams){t.stock.food=10000;t.stock.gold=10000;}};
test('12 large, connected territories cover the world and neighbor graph is symmetric',()=>{
 const g=make();assert.equal(g.regions.length,12);assert.equal(g.regions.reduce((sum,r)=>sum+r.cells.length,0),W*H);
 for(const r of g.regions){assert.ok(r.cells.length>600);assert.ok(r.outline.length>20);for(const id of r.neighbors)assert.ok(g.regions[id].neighbors.includes(r.id));
  const seen=new Set(),q=[r.cells[0]];seen.add(q[0].y*W+q[0].x);for(let i=0;i<q.length;i++){const c=q[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=c.x+dx,y=c.y+dy,k=y*W+x;if(g.regionAt(x,y)?.id===r.id&&!seen.has(k)){seen.add(k);q.push({x,y});}}}assert.equal(seen.size,r.cells.length);
 }
 assert.equal(g.regions.filter(r=>r.owner===0).length,1);assert.equal(g.regions.filter(r=>r.owner===1).length,1);assert.ok(!g.canCapture(g.homeRegions[1]));
 for(const team of [0,1]){const b=g.alive().find(e=>e.type==='base'&&e.team===team);assert.equal(g.regionAt(b.x,b.y).id,g.homeRegions[team]);}
});
test('only soldiers can capture an adjacent tower; distant regions reject capture',()=>{
 const g=make(),r=g.regions[g.regions[0].neighbors[0]],tower=g.get(r.towerId),worker=g.alive().find(e=>e.type==='worker');worker.x=tower.x+2;worker.y=tower.y;
 assert.equal(g.capture([worker.id],r.id),false);advance(g,13);assert.equal(r.owner,-1);
 const soldier=g.add('soldier',0,tower.x+2,tower.y);assert.equal(g.capture([soldier.id],11),false);assert.equal(g.capture([soldier.id],r.id),true);advance(g,11);assert.equal(r.owner,-1);assert.ok(r.progress>10);advance(g,1.2);assert.equal(r.owner,0);assert.equal(tower.team,0);assert.equal(tower.hp,Infinity);assert.ok(r.neighbors.some(id=>g.canCapture(id)));
});
test('contested capture pauses and abandoned progress decays; recapture requires adjacency',()=>{
 const g=make(),r=g.regions[g.regions[0].neighbors[0]],tower=g.get(r.towerId);const u=g.add('soldier',0,tower.x+3,tower.y);advance(g,4);const progress=r.progress;
 const enemy=g.add('soldier',1,tower.x-3,tower.y);g.updateCaptures(1);assert.equal(r.progress,progress);enemy.hp=0;u.x=tower.x+10;g.updateCaptures(1);assert.ok(r.progress<progress);u.x=tower.x+3;advance(g,12);assert.equal(r.owner,0);
 assert.equal(g.canCapture(r.id,1),r.neighbors.some(id=>g.regions[id].owner===1));
});
test('construction is restricted to owned territory and unlocked by capture',()=>{
 const g=make(),r=g.regions[g.regions[0].neighbors[0]];let site;
 for(const c of r.cells){r.owner=0;const valid=g.canBuild('house',c.x,c.y);r.owner=-1;if(valid){site=c;break;}}
 assert.ok(site);assert.equal(g.build('house',site.x,site.y),false);const tower=g.get(r.towerId);g.add('soldier',0,tower.x+2,tower.y);advance(g,12.2);assert.ok(g.build('house',site.x,site.y));
});
test('enemy hall is protected before taking its home territory, then normal combat wins',()=>{
 const g=make();supply(g);const hall=g.alive().find(e=>e.type==='base'&&e.team===1),r=g.regions[g.homeRegions[1]],ids=[];
 for(let i=0;i<12;i++)ids.push(g.add('soldier',0,hall.x+3,hall.y-2+i%4).id);g.command(ids,hall.x,hall.y,hall.id);advance(g,10);assert.equal(hall.hp,hall.maxHp);assert.equal(g.result,null);
 // Model a campaign which has reached the last frontier; perform the final capture normally.
 for(const id of r.neighbors)g.regions[id].owner=0;const tower=g.get(r.towerId);const u=g.get(ids[0]);u.x=tower.x+2;u.y=tower.y;u.order={type:'capture',id:tower.id};u.path=[];advance(g,13);assert.equal(r.owner,0);
 g.command(ids,hall.x,hall.y,hall.id);advance(g,30);assert.equal(g.result,'victory');
});
test('eight-way paths use diagonals without cutting blocked corners; groups get distinct destinations',()=>{
 const g=make(),p=g.path(65.5,40.5,70.5,45.5);assert.equal(p.length,5);assert.ok(p.every((c,i)=>!i||c.x!==p[i-1].x&&c.y!==p[i-1].y));
 g.terrain[40][66]=1;g.terrain[41][65]=1;const detour=g.path(65.5,40.5,67.5,42.5);assert.ok(detour.length>2);assert.notDeepEqual(detour[0],{x:66.5,y:41.5});
 const ids=[g.add('soldier',0,60.5,40.5).id,g.add('soldier',0,61.5,40.5).id];g.command(ids,70,50);assert.notDeepEqual(g.get(ids[0]).path.at(-1),g.get(ids[1]).path.at(-1));
});
test('a real army can capture a continuous chain from home to enemy land and win',()=>{
 const g=make();supply(g);const start=g.regions[g.homeRegions[0]],goal=g.homeRegions[1],prev=new Map([[start.id,null]]),q=[start.id];
 for(let i=0;i<q.length;i++)for(const n of g.regions[q[i]].neighbors)if(!prev.has(n)){prev.set(n,q[i]);q.push(n);}
 const chain=[];for(let n=goal;n!==start.id;n=prev.get(n))chain.push(n);chain.reverse();
 const ids=[];for(let i=0;i<8;i++)ids.push(g.add('soldier',0,start.x+2,start.y).id);
 for(const id of chain){assert.ok(g.capture(ids,id));for(let i=0;i<1100&&g.regions[id].owner!==0;i++)g.tick(.1);assert.equal(g.regions[id].owner,0);}
 const hall=g.alive().find(e=>e.type==='base'&&e.team===1);g.command(ids,hall.x,hall.y,hall.id);advance(g,35);assert.equal(g.result,'victory');
});
