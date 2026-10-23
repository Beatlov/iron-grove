const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,stats}=require('../engine.js');
const art=require('../art.js');
test('drawing factions, work, combat and corpse frames leaves the simulation intact and uses whole pixels',()=>{
 const g=new Game(42,{ai:false}),calls=[];
 const c=new Proxy({fillRect:(...args)=>calls.push(args)},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
 const before=JSON.stringify(g);
 for(const team of [0,1])for(const type of ['worker','soldier','assault','medic','grenadier']){
  const e={type,team,id:1,moving:true,facingX:-1,facingY:-1,walkDistance:2.3,cool:1.9,carry:{resource:'metal'}};
  const snapshot=JSON.stringify(e);art.unit(c,e,20.3,40.7,12,{working:true});art.fallen(c,e,25,40,.1);art.fallen(c,e,25,40,1);assert.equal(JSON.stringify(e),snapshot);
 }
 for(const e of g.visible()){
  if(e.type==='deposit')art.deposit(c,e,e.x*24,e.y*24);
  else if(stats[e.type]?.speed)art.unit(c,e,e.x*24,e.y*24,10);
  else art.building(c,e,e.x*24,e.y*24,10,{occupants:2,operating:true});
 }
 for(const team of [0,1])for(const [type,s]of Object.entries(stats).filter(([,s])=>s.cost)){
  art.building(c,{type,team,size:s.size},30,50,3,{operating:true,occupants:2});
  art.building(c,{type,team,size:s.size,construction:1},30,50,3,{working:true,progress:.5});
 }
 assert.ok(calls.length>100);assert.ok(calls.every(args=>args.every(Number.isInteger)),'all sprite rectangles align to the native pixel grid');
 assert.equal(JSON.stringify(g),before);
});
