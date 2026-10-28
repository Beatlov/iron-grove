const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,stats}=require('../engine.js');
const art=require('../art.js');
test('drawing factions, work, combat and corpse frames leaves the simulation intact and uses whole pixels',()=>{
 const g=new Game(42,{ai:false}),calls=[];
 const c=new Proxy({fillRect:(...args)=>calls.push(args)},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
 for(const type of ['build-menu','army-menu','world-menu'])art.actionIcon(c,type);
 for(const type of ['residents','freeResidents','population','carriers','power'])art.counterIcon(c,type);
 const before=JSON.stringify(g);
 for(const team of [0,1,2])for(const rank of [1,2,3])for(const type of ['worker','drone','soldier','assault','medic','grenadier','psyker','xeno','robot','demon','pirate']){
  const e={type,team,rank,id:1,moving:true,facingX:-1,facingY:-1,walkDistance:2.3,cool:1.9,carry:{resource:'minerals'}};
  const snapshot=JSON.stringify(e);art.unit(c,e,20.3,40.7,12,{working:true});art.fallen(c,e,25,40,.1);art.fallen(c,e,25,40,1);assert.equal(JSON.stringify(e),snapshot);
 }
 for(const e of g.visible()){
  if(e.type==='deposit')art.deposit(c,e,e.x*24,e.y*24);
  else if(stats[e.type]?.speed)art.unit(c,e,e.x*24,e.y*24,10);
  else art.building(c,e,e.x*24,e.y*24,10,{occupants:2,operating:true});
 }
 for(const team of [0,1])for(const [type,s]of Object.entries(stats).filter(([,s])=>s.cost)){
  art.buildingIcon(c,type,team);
  art.building(c,{type,team,size:s.size},30,50,3,{operating:true,occupants:2});
  art.building(c,{type,team,size:s.size,construction:1},30,50,3,{working:true,progress:.5});
 }
 assert.ok(calls.length>100);assert.ok(calls.every(args=>args.every(Number.isInteger)),'all sprite rectangles align to the native pixel grid');
 assert.equal(JSON.stringify(g),before);
});
test('both graphic styles preserve simulation and H9 remains an exact renderer fallback',()=>{
 const classic=require('../art-legacy.js'),g=new Game(42,{ai:false}),before=JSON.stringify(g);
 function calls(draw){const out=[],c=new Proxy({fillRect:(...a)=>out.push(a)},{get:(t,k)=>k in t?t[k]:()=>{},set:()=>true});draw(c);return out;}
 const e={type:'worker',team:0,moving:true,walkDistance:1.2,facingX:1,carry:{resource:'minerals'}};
 art.setStyle('classic');const old=calls(c=>art.unit(c,e,40,50,2));assert.deepEqual(old,calls(c=>classic.unit(c,e,40,50,2)));
 art.setStyle('refined');const current=calls(c=>art.unit(c,e,40,50,2));assert.notDeepEqual(current,old);
 assert.equal(art.setStyle('invalid'),false);assert.equal(art.getStyle(),'refined');assert.equal(JSON.stringify(g),before);
});
test('geometry scales on one native grid with one-pixel outlines rather than scaling the drawing context',()=>{
 for(const scale of [41/48,1,2]){const calls=[],c=new Proxy({fillRect:(...a)=>calls.push(a),scale:()=>assert.fail('native pixel painter must not scale the context')},{get:(t,k)=>k in t?t[k]:()=>{},set:()=>true});const p=art.pixelPainter(c,10.3,20.7,scale);p.r(0,0,5,4,'#111');p.r(5,0,5,4,'#222');assert.equal(calls[0][0]+calls[0][2],calls[1][0],'adjacent panels meet without resampling gaps');p.line(1,1,8,1,'#333');p.poly([[0,0],[10,0],[10,6]],'#444');p.plate(1,1,8,8,'#555');assert.ok(calls.every(a=>a.every(Number.isInteger)));assert.ok(calls.some(a=>a[2]===1&&a[3]===1),'one native pixel remains available at every geometry size');}
});
test('planet colors are shuffled across the whole galaxy and vary with the campaign seed including the capital',()=>{
 const order=seed=>Array.from({length:12},(_,id)=>art.planetPalette(seed,id).tiles[0]);
 const first=order(42),next=order(43);assert.notDeepEqual(first,next);assert.notEqual(first[0],next[0]);
 assert.equal(new Set(first).size,4);for(const color of new Set(first))assert.equal(first.filter(c=>c===color).length,3);
 assert.ok(Array.from({length:4},(_,col)=>new Set([first[col],first[col+4],first[col+8]]).size).some(n=>n>1),'colors must not follow galaxy columns');
 assert.deepEqual(order(42),first,'opening another campaign cannot change the original palette');
 assert.equal(new Set(Array.from({length:24},(_,seed)=>order(seed)[0])).size,4,'the starting planet has no fixed color');
});
