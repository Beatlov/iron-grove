/* HELIOS H36: local, priority-allocated power; fuel remains a physical inventory resource. */
(function(root){
'use strict';
function install(api){
 const {Game,stats,balance,dist}=api;
 Object.assign(Game.prototype,{
  powerWorking(b){const s=stats[b.type],workers=this.workers(b);if(s.recipe){const host=this.get(b.parent);return workers.length>0&&this.operational(host)&&this.room(host)>=1&&(b.batch>0||this.productionNeeded(b)&&Object.entries(s.recipe).every(([r,n])=>host.inventory[r]>=n));}if(b.type==='barracks')return !!b.queue[0]&&this.supplied(b.queue[0]);if(b.type==='tower'){const battle=this.activeBattle();return !!battle&&!battle.done&&battle.mapId===b.planet;}if(s.collector||s.extractor)return workers.length>0&&b.buffer<60&&this.productionNeeded(b)&&this.alive(b.planet).some(n=>n.type==='deposit'&&n.resource===s.resource&&n.amount>0&&(s.extractor?this.covers(b,n):dist(n,b)<=s.radius));if(b.type==='farm')return workers.some(u=>u.phase||u.carry||u.field)||workers.length>0&&this.addons(b).some(f=>f.fieldStage==='sowing'||f.fieldStage==='harvest');if(b.type==='cryptofarm')return workers.length>0&&this.productionNeeded(b)&&this.storages(b.team).some(s=>this.inputRoom(s,'tokens')>1e-8);return false;},
  powerDemand(b){const s=balance.power.loads[b.type];return s?(this.powerWorking(b)?s.active:s.idle):0;},
  powerGrid(planet=this.activePlanet,team=0,dt=.1){
   dt=Math.max(.001,dt);const buildings=this.alive(planet).filter(b=>b.team===team&&stats[b.type]?.cost),entries=new Map(),sources=[],loads=[];let regular=0,potentialGas=0;
   for(const b of buildings){const spec=balance.power.loads[b.type],source=balance.power.sources[b.type],enabled=b.powerEnabled!==false,ready=this.operational(b),entry={id:b.id,enabled,online:ready&&enabled,draw:0,output:0,priority:b.powerPriority??spec?.priority??50,reason:!ready?'damaged':!enabled?'manual':null};entries.set(b.id,entry);if(!ready||!enabled)continue;if(source){const capacity=source.fuel?Math.min(source.output,(b.inventory[source.fuel]||0)/(source.fuelPerPowerSecond*dt)):source.output;sources.push({b,entry,source,capacity});if(source.fuel)potentialGas+=capacity;else regular+=capacity;}if(spec){entry.draw=this.powerDemand(b);loads.push({b,entry});}}
   // A workshop cannot consume power without its host; boost host priority to its highest child.
   for(const {b,entry}of loads)if(stats[b.type]?.recipe){const parent=entries.get(b.parent);if(parent)parent.priority=Math.max(parent.priority,entry.priority);}
   loads.sort((a,b)=>b.entry.priority-a.entry.priority||Number(!!stats[a.b.type]?.recipe)-Number(!!stats[b.b.type]?.recipe)||a.b.id-b.b.id);
   const capacity=regular+potentialGas;let left=capacity,used=0,demand=0;
   for(const {b,entry}of loads){const parent=stats[b.type]?.recipe&&entries.get(b.parent);demand+=entry.draw;if(stats[b.type]?.recipe&&(!parent||!parent.online)){entry.online=false;entry.reason='parent';continue;}if(entry.draw>left+1e-8){entry.online=false;entry.reason='shortage';continue;}left=Math.max(0,left-entry.draw);used+=entry.draw;}
   let gasLoad=Math.max(0,used-regular),gasExpense=0;for(const {b,entry,source,capacity:available}of sources){entry.output=source.fuel?Math.min(gasLoad,available):available;if(source.fuel){gasLoad-=entry.output;gasExpense+=entry.output*source.fuelPerPowerSecond;entry.online=available>0;entry.reason=entry.output>0?null:available>=source.output-1e-8?'standby':available>0?'low-fuel':'fuel';}else entry.reason=null;}
   return{planet,team,capacity,used,demand,regular,gasExpense,entries,offline:loads.filter(v=>!v.entry.online).length};
  },
  powered(b){if(!b)return false;const s=stats[b.type];if(!s?.cost)return true;const grid=this._powerFrame?.get(b.planet+':'+b.team)||this.powerGrid(b.planet,b.team),entry=grid.entries.get(b.id);if(!entry?.online)return false;if(s.bio){const parent=this.get(b.parent);return !!parent&&this.powered(parent);}return !balance.power.loads[b.type]||this.powerDemand(b)<=entry.draw+1e-8;},
  beginPowerTick(dt){this._powerFrame=new Map();for(const p of Object.values(this.maps))for(const team of [...new Set(p.entities.filter(b=>b.hp>0&&stats[b.type]?.cost).map(b=>b.team))]){const grid=this.powerGrid(p.id,team,dt);this._powerFrame.set(p.id+':'+team,grid);for(const entry of grid.entries.values()){const b=this.get(entry.id),source=balance.power.sources[b?.type];if(source?.fuel&&entry.output>0){const amount=Math.min(b.inventory[source.fuel],entry.output*source.fuelPerPowerSecond*dt);b.inventory[source.fuel]-=amount;this.recordResourceFlow(source.fuel,'expense',amount,team,'power');}}}},
  setPower(id,enabled,priority=null,team=0){const b=this.get(id);if(!this.ready(b)||b.team!==team||this.regions[b.planet]?.owner!==team||!this.canManageProcesses(team)||this.result||b.type==='base'||!balance.power.loads[b.type]&&!balance.power.sources[b.type]||typeof enabled!=='boolean'||priority!==null&&![10,50,100].includes(priority))return false;b.powerEnabled=enabled;b.powerPriority=priority;return true;}
 });
}
if(typeof module!=='undefined')module.exports={install};else install(root.RTS);
})(typeof window!=='undefined'?window:globalThis);
