/* HELIOS H13: neutral encounters, deliberate battle start, campaign pause and veterancy. */
(function(root){
'use strict';
function install(api){
 const {Game,stats,unitCosts,dist,W,H,BW,BH}=api;
 Object.assign(stats.soldier,{damageType:'firearm',weaknesses:{cutting:1.35,explosive:1.35}});
 Object.assign(stats.assault,{damageType:'cutting',weaknesses:{mental:1.35}});
 Object.assign(stats.grenadier,{damageType:'explosive',splash:2.3,weaknesses:{firearm:1.35,cutting:1.35}});
 Object.assign(stats.medic,{immunities:['mental']});
 stats.psyker={hp:115,speed:2.5,size:1,damage:26,range:6,armor:1,military:true,trainTime:18,food:1,money:2,damageType:'mental',weaknesses:{explosive:1.35}};
 unitCosts.psyker={weapons:1,medicines:2,armor:1,money:55};
 stats.xeno={hp:95,speed:3.2,size:1,damage:15,range:1.25,armor:1,damageType:'cutting',enemy:true,weaknesses:{explosive:1.25}};
 stats.robot={hp:130,speed:1.9,size:1,damage:13,range:4.5,armor:5,damageType:'firearm',enemy:true};
 stats.demon={hp:115,speed:2.5,size:1,damage:16,range:4,armor:2,damageType:'mental',enemy:true};
 stats.pirate={hp:105,speed:2.5,size:1,damage:14,range:5,armor:2,damageType:'firearm',enemy:true};
 const factions={xenos:{name:'Ксеносы',type:'xeno'},robots:{name:'Роботы',type:'robot'},demons:{name:'Демоны',type:'demon'},pirates:{name:'Пираты',type:'pirate'}};
 const ranks=[0,40,110],siteTypes={asteroid:{name:'Астероид',reward:{metal:60,crystals:20,money:30}},moon:{name:'Малая планета',reward:{food:80,sulfur:20,gas:16}},wreck:{name:'Обломки корабля',reward:{weapons:3,ammo:4,armor:2,money:40}}};
 Object.assign(api,{factions,rankThresholds:ranks,siteTypes});
 const oldArrive=Game.prototype.arrive;
 Object.assign(Game.prototype,{
  initEncounters(options={}){
   this.neutralEnabled=options.neutrals!==false&&!this.hasOpponent;this.pendingEncounters=[];this.activeBattleId=null;
   for(const r of this.regions){r.faction=Object.keys(factions)[(r.id+this.seed)%4];r.guardians=[];r.sites=[];if(!this.neutralEnabled)continue;
    if(r.owner<0)r.guardians=this.makeGuards(r.faction,2+Math.floor(r.id/4),r.id);
    const candidates=r.cells.filter(c=>{const d=dist(c,r);return d>=5&&d<9;});
    for(let i=0;i<2;i++){const kind=Object.keys(siteTypes)[(r.id+i)%3],cell=candidates[(r.id*17+i*Math.floor(candidates.length/2))%candidates.length]||{x:r.x+5,y:r.y+5},faction=Object.keys(factions)[(r.id+i+this.seed+1)%4];r.sites.push({id:this.nextId++,planet:r.id,kind,name:siteTypes[kind].name+' '+(r.id+1)+'-'+(i+1),x:cell.x+.5,y:cell.y+.5,faction,active:true,generation:1,guards:this.makeGuards(faction,2+Math.floor(r.id/6),r.id),reward:{...siteTypes[kind].reward},respawnAt:null});}
   }
  },
  makeGuards(faction,count,planet){return Array.from({length:count},()=>{const type=factions[faction].type;return{id:this.nextId++,type,faction,team:2,planet,location:'guard',hp:stats[type].hp,maxHp:stats[type].hp,rank:1,xp:0};});},
  sites(){return this.regions.flatMap(r=>r.sites||[]);},
  site(id){return this.sites().find(s=>s.id===id)||null;},
  guardians(planet){return(this.regions[planet]?.guardians||[]).filter(u=>u.hp>0);},
  activeBattle(){return this.battles.find(b=>b.id===this.activeBattleId)||null;},
  combatStep(dt){const b=this.activeBattle();if(!b)return false;if(!b.done)this.battleTick(b,Math.max(0,Math.min(.1,dt)));return true;},
  encounterTick(){
   for(const s of this.sites())if(!s.active&&s.respawnAt!==null&&this.time>=s.respawnAt){s.active=true;s.generation++;s.respawnAt=null;s.guards=this.makeGuards(s.faction,2+Math.floor(s.planet/6),s.planet);this.history.unshift({time:this.time,text:'Новая активность: '+s.name+' · '+this.regions[s.planet].name});this.history=this.history.slice(0,20);}
   this.pendingEncounters=this.pendingEncounters.filter(e=>e.units.some(id=>this.military.some(u=>u.id===id&&u.hp>0)));
  },
  unitProfile(u){const s=stats[u.type],rank=Math.max(1,Math.min(3,u.rank||1)),bonus=rank-1;return{...s,hp:Math.round(s.hp*(1+.12*bonus)),damage:(s.damage||0)*(1+.15*bonus),heal:(s.heal||0)*(1+.15*bonus),armor:(s.armor||0)+bonus*.5};},
  gainXP(u,amount){if(u.team!==0||u.hp<=0||!unitCosts[u.type])return false;const previous=u.rank||1,oldMax=u.maxHp;u.xp=(u.xp||0)+Math.max(0,amount);u.rank=u.xp>=ranks[2]?3:u.xp>=ranks[1]?2:1;if(u.rank>previous){u.maxHp=this.unitProfile(u).hp;u.hp=Math.min(u.maxHp,Math.max(1,u.hp/oldMax*u.maxHp));return true;}return false;},
  encounterBusy(planet,site=null){return this.pendingEncounters.some(e=>e.planet===planet&&e.site===site)||this.missions.some(m=>m.to===planet&&(site?m.site===site:m.kind==='army'))||this.battles.some(b=>!b.done&&b.planet===planet&&b.site===site);},
  canRaid(from,id,team=0){const s=this.site(id);return !!s&&s.active&&this.regions[from]?.owner===team&&(this.regions[s.planet].owner===team||this.canCapture(s.planet,team))&&!this.encounterBusy(s.planet,s.id)&&!this.activeBattle()&&!this.result;},
  sendRaid(from,id,counts,team=0){if(!this.canRaid(from,id,team))return false;const s=this.site(id),chosen=[];for(const [type,n]of Object.entries(counts||{})){if(!unitCosts[type]||!Number.isInteger(n)||n<0)return false;const pool=this.army(team,from).filter(u=>u.type===type);if(pool.length<n)return false;chosen.push(...pool.slice(0,n));}if(!chosen.length)return false;const m={id:this.nextId++,kind:'raid',from,to:s.planet,site:s.id,generation:s.generation,team,left:20,units:chosen.map(u=>u.id)};for(const u of chosen)u.location='mission';this.missions.push(m);this.message='Экспедиция к '+s.name+': перелёт 20 с.';return m;},
  queueEncounter(m,troops){const e={id:this.nextId++,planet:m.to,from:m.from,site:m.site||null,generation:m.generation||null,team:m.team,units:troops.map(u=>u.id)};for(const u of troops){u.location='arrived';u.planet=m.to;}this.pendingEncounters.push(e);this.message='Отряд прибыл: '+(this.site(e.site)?.name||this.regions[e.planet].name)+'. Можно начать бой.';this.history.unshift({time:this.time,text:this.message});this.history=this.history.slice(0,20);return e;},
  arrive(m){
   if(m.kind==='colony')return oldArrive.call(this,m);
   const troops=(m.units||[]).map(id=>this.military.find(u=>u.id===id&&u.hp>0)).filter(Boolean);if(!troops.length)return;
   if(m.kind==='return'){for(const u of troops){u.location='reserve';u.planet=m.to;}return;}
   if(m.kind==='raid'){const s=this.site(m.site);if(!s?.active||s.generation!==m.generation){for(const u of troops){u.location='reserve';u.planet=m.from;}return;}return this.queueEncounter(m,troops);}
   if(this.battles.some(b=>b.planet===m.to&&!b.done)||this.pendingEncounters.some(e=>e.planet===m.to&&!e.site)){m.left=2;this.missions.push(m);return;}
   const owner=this.regions[m.to].owner;if(owner===m.team){for(const u of troops){u.location='reserve';u.planet=m.to;}return;}
   const defenders=owner>=0?this.army(owner,m.to):this.guardians(m.to),towers=owner>=0?this.alive(m.to).filter(e=>e.team===owner&&e.type==='tower'&&this.operational(e)):[];
   if(!defenders.length&&!towers.length){this.capturePlanet(m.to,m.team);for(const u of troops){u.location='reserve';u.planet=m.to;}return;}
   return this.queueEncounter(m,troops);
  },
  retreatEncounter(id){if(this.activeBattle())return false;const e=this.pendingEncounters.find(e=>e.id===id);if(!e)return false;const troops=e.units.map(id=>this.military.find(u=>u.id===id&&u.hp>0)).filter(Boolean);this.pendingEncounters=this.pendingEncounters.filter(v=>v!==e);if(troops.length){for(const u of troops)u.location='mission';this.missions.push({id:this.nextId++,kind:'return',from:e.planet,to:e.from,team:e.team,left:20,units:troops.map(u=>u.id)});}return true;},
  startEncounter(id){
   if(this.activeBattle()||this.result)return false;const e=this.pendingEncounters.find(v=>v.id===id);if(!e)return false;const troops=e.units.map(id=>this.military.find(u=>u.id===id&&u.hp>0&&u.location==='arrived')).filter(Boolean);if(!troops.length)return false;
   const s=this.site(e.site);if(e.site&&(!s?.active||s.generation!==e.generation))return this.retreatEncounter(id);
   const owner=this.regions[e.planet].owner,defenders=s?s.guards.filter(u=>u.hp>0):owner>=0?this.army(owner,e.planet):this.guardians(e.planet),towers=!s&&owner>=0?this.alive(e.planet).filter(t=>t.team===owner&&t.type==='tower'&&this.operational(t)):[];
   this.pendingEncounters=this.pendingEncounters.filter(v=>v!==e);return this.startBattle(e.planet,e.team,troops,defenders,towers,{from:e.from,site:e.site,generation:e.generation});
  },
  startBattle(planet,attacker,attackers,defenders,towers=[],context={}){
   if(this.activeBattle())return false;const surface=this.planet(planet),site=this.site(context.site),b={id:this.nextId++,planet,from:context.from??this.homeRegions[attacker]??0,site:context.site||null,generation:context.generation||null,attacker,defender:defenders[0]?.team??(this.regions[planet].owner>=0?this.regions[planet].owner:2),time:0,done:false,winner:null,units:[],effects:[],seed:surface.seed,guardRefs:defenders,initial:[],reward:{},promotions:[]};
   b.field={w:BW,h:BH,terrain:Array.from({length:BH},(_,y)=>Array.from({length:BW},(_,x)=>surface.terrain[Math.min(H-1,Math.floor(y*H/BH))][Math.min(W-1,Math.floor(x*W/BW))])),deposits:surface.entities.filter(e=>e.type==='deposit').slice(0,16).map(e=>({resource:e.resource,x:e.x*BW/W,y:e.y*BH/H,amount:e.amount}))};
   for(const [side,army]of [[0,attackers],[1,defenders]])for(const [i,u]of army.entries()){u.location='battle';u.planet=planet;const p=this.unitProfile(u);b.units.push({id:u.id,type:u.type,team:u.team,faction:u.faction,rank:u.rank||1,side,x:side?BW-8-Math.floor(i/6)*1.7:8+Math.floor(i/6)*1.7,y:7+i%6*3,hp:u.hp,maxHp:u.maxHp||p.hp,size:1,cool:0,walkDistance:0,moving:false,facingX:side?-1:1,facingY:0,dealt:0,healed:0});b.initial.push({id:u.id,type:u.type,side});}
   for(const [i,t]of towers.entries())b.units.push({id:-t.id,type:'tower',team:t.team,rank:1,side:1,x:BW-12-Math.floor(i/4)*2.2,y:7+i%4*6,hp:Math.max(1,Math.round(250*t.hp/t.maxHp)),maxHp:250,size:2,cool:0,dealt:0,healed:0});
   this.battles.push(b);this.activeBattleId=b.id;this.message='Автоматический бой: '+(site?.name||this.regions[planet].name)+'. Развитие приостановлено.';return b;
  },
  damageAmount(attacker,target,distance=dist(attacker,target),falloff=1){const a=this.unitProfile(attacker),t=this.unitProfile(target),kind=a.damageType||'firearm';if(t.immunities?.includes(kind))return 0;let raw=(target.type==='tower'&&a.buildingDamage?a.buildingDamage*(1+.15*((attacker.rank||1)-1)):a.damage)*falloff;if(kind==='mental'&&attacker.type==='psyker')raw*=1+Math.max(0,1-distance/a.range);raw*=t.weaknesses?.[kind]||1;return Math.max(1,raw-(kind==='mental'?0:t.armor));},
  battleTick(b,dt){
   if(b.done)return;b.time+=dt;b.effects=b.effects.filter(e=>(e.left-=dt)>0);
   const move=(u,target,retreat=false)=>{const s=this.unitProfile(u),dx=target.x-u.x,dy=target.y-u.y,d=Math.hypot(dx,dy)||1,step=s.speed*dt*(retreat?-.75:1),ox=u.x,oy=u.y;u.x=Math.max(2,Math.min(BW-2,u.x+dx/d*step));u.y=Math.max(2,Math.min(BH-2,u.y+dy/d*step));const delta=Math.hypot(u.x-ox,u.y-oy);u.walkDistance+=delta;u.moving=delta>.001;u.facingX=dx/d;u.facingY=dy/d;};
   for(const u of b.units.filter(u=>u.hp>0)){if(u.hp<=0)continue;u.moving=false;u.cool=Math.max(0,u.cool-dt);const s=this.unitProfile(u),foes=b.units.filter(v=>v.hp>0&&v.team!==u.team).sort((a,c)=>dist(a,u)-dist(c,u));if(!foes.length)continue;
    if(s.heal){const allies=b.units.filter(v=>v.hp>0&&v.id!==u.id&&v.team===u.team&&v.type!=='tower'&&v.hp<v.maxHp).sort((a,c)=>dist(a,u)-dist(c,u)),target=allies[0];if(target&&dist(u,target)<=s.range){if(!u.cool){const n=Math.min(s.heal,target.maxHp-target.hp);target.hp+=n;u.healed+=n;u.cool=1;b.effects.push({kind:'heal',x:u.x,y:u.y,tx:target.x,ty:target.y,left:.4});}if(dist(u,foes[0])<3)move(u,foes[0],true);}else{const escort=target||b.units.find(v=>v.hp>0&&v.team===u.team&&v.id!==u.id&&v.type!=='medic'&&v.type!=='tower');if(escort&&dist(u,escort)>3)move(u,escort);else if(dist(u,foes[0])<3)move(u,foes[0],true);}continue;}
    const foe=u.type==='grenadier'?(foes.find(v=>v.type==='tower')||foes[0]):foes[0],d=dist(u,foe);
    if(d<=s.range){if(!u.cool){const targets=s.splash?foes.filter(v=>dist(v,foe)<=s.splash):[foe];for(const target of targets){const falloff=s.splash?Math.max(.45,1-dist(target,foe)/s.splash*.55):1,n=this.damageAmount(u,target,dist(u,target),falloff),actual=Math.min(Math.max(0,target.hp),n);target.hp-=n;u.dealt+=actual;}u.cool=s.cooldown||1;b.effects.push({kind:s.damageType==='mental'?'mental':s.damageType==='cutting'?'slash':s.splash?'grenade':'shot',x:u.x,y:u.y,tx:foe.x,ty:foe.y,radius:s.splash||0,left:.35});}
     if(s.speed&&s.range>3){if(d<2.3&&this.unitProfile(foe).range<2)move(u,foe,true);else if(u.type==='psyker'&&d>3)move(u,foe);}
    }else if(s.speed)move(u,foe);
   }
   for(const u of b.units.filter(u=>u.id>0)){const original=this.military.find(v=>v.id===u.id)||b.guardRefs.find(v=>v.id===u.id);if(original)original.hp=Math.max(0,u.hp);}
   const viable=team=>b.units.some(u=>u.hp>0&&u.team===team),offense=team=>b.units.some(u=>u.hp>0&&u.team===team&&this.unitProfile(u).damage>0);
   if(!viable(b.attacker)||!viable(b.defender)||(!offense(b.attacker)&&!offense(b.defender))||b.time>=180)this.finishBattle(b,!viable(b.defender)&&viable(b.attacker)?b.attacker:b.defender);
  },
  finishBattle(b,winner){
   if(b.done)return;b.done=true;b.winner=winner;const victory=winner===b.attacker;
   for(const u of b.units.filter(u=>u.id>0)){const original=this.military.find(v=>v.id===u.id)||b.guardRefs.find(v=>v.id===u.id);if(!original)continue;original.hp=Math.max(0,u.hp);if(original.team===0&&original.hp>0){const xp=(original.team===winner?20:8)+Math.min(20,Math.floor((u.dealt+u.healed)/20));if(this.gainXP(original,xp))b.promotions.push({id:original.id,type:original.type,rank:original.rank});}original.location=original.team===2?'guard':'reserve';if(u.side===0)original.planet=(!b.site&&victory)?b.planet:b.from;}
   const s=this.site(b.site);
   if(s){s.guards=s.guards.filter(u=>u.hp>0);if(victory&&s.active&&s.generation===b.generation){s.active=false;s.guards=[];s.respawnAt=this.time+1200+Math.floor(this.random()*600);b.reward={...s.reward};for(const [r,n]of Object.entries(b.reward))this.refund(r,n,b.attacker);}}
   else{this.regions[b.planet].guardians=this.guardians(b.planet);if(victory)this.capturePlanet(b.planet,winner);}
   if(!victory)for(const u of b.units.filter(u=>u.type==='tower')){const t=this.get(-u.id);if(t)t.hp=Math.max(1,Math.round(t.maxHp*Math.max(0,u.hp)/250));}
   b.summary={victory,survivors:b.units.filter(u=>u.side===0&&u.hp>0).length,lost:b.units.filter(u=>u.side===0&&u.hp<=0).length,enemiesLost:b.units.filter(u=>u.side===1&&u.hp<=0).length,reward:b.reward,promotions:b.promotions};
   this.history.unshift({time:this.time,text:(victory?'Победа':'Поражение')+': '+(s?.name||this.regions[b.planet].name)});this.history=this.history.slice(0,20);
  },
  acknowledgeBattle(id){const b=this.activeBattle();if(!b||b.id!==id||!b.done)return false;this.activeBattleId=null;this.military=this.military.filter(u=>u.hp>0);return true;}
 });
}
if(typeof module!=='undefined')module.exports={install};else install(root.RTS);
})(typeof window!=='undefined'?window:globalThis);
