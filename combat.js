/* HELIOS H21: neutral encounters, deliberate battle start, campaign pause and veterancy. */
(function(root){
'use strict';
function install(api){
 const {Game,stats,unitCosts,resources,dist,footprint,W,H}=api;
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
  ensureCombatTeam(team){if(this.teams[team])return;const entry={pending:Object.fromEntries(resources.map(r=>[r,0])),stock:{},hungry:false,unpaid:false,desertion:0};this.teams[team]=entry;for(const resource of resources)Object.defineProperty(entry.stock,resource,{enumerable:true,get:()=>this.available(resource,team),set:value=>{const delta=Math.max(0,value)-this.available(resource,team);if(delta>0)this.credit(resource,delta,team);else this.withdraw(resource,-delta,team);}});},
  activeBattle(){return this.battles.find(b=>b.id===this.activeBattleId)||null;},
  combatStep(dt){if(this.laboratoryPending&&!this.activeBattle()){this.encounterTick(Math.max(0,Math.min(.1,dt)));return true;}const b=this.activeBattle();if(!b)return false;if(b.done)return true;if(b.laboratory){this.battleTick(b,Math.max(0,Math.min(.1,dt)));return true;}return false;},
  encounterTick(dt=0){for(const e of [...this.pendingEncounters])if(e.defense&&!this.activeBattle()){e.countdown=Math.max(0,e.countdown-dt);if(e.countdown<1e-8)this.startEncounter(e.id);}
   for(const s of this.sites())if(!s.active&&s.respawnAt!==null&&this.time>=s.respawnAt){s.active=true;s.generation++;s.respawnAt=null;s.guards=this.makeGuards(s.faction,2+Math.floor(s.planet/6),s.planet);this.history.unshift({time:this.time,text:'Новая активность: '+s.name+' · '+this.regions[s.planet].name});this.history=this.history.slice(0,20);}
   this.pendingEncounters=this.pendingEncounters.filter(e=>e.units.some(id=>this.military.some(u=>u.id===id&&u.hp>0)));
  },
  unitProfile(u){const s=stats[u.type],rank=Math.max(1,Math.min(3,u.rank||1)),bonus=rank-1;return{...s,hp:Math.round(s.hp*(1+.12*bonus)),damage:(s.damage||0)*(1+.15*bonus),heal:(s.heal||0)*(1+.15*bonus),armor:(s.armor||0)+bonus*.5};},
  gainXP(u,amount){if(u.team!==0||u.hp<=0||!unitCosts[u.type])return false;const previous=u.rank||1,oldMax=u.maxHp;u.xp=(u.xp||0)+Math.max(0,amount);u.rank=u.xp>=ranks[2]?3:u.xp>=ranks[1]?2:1;if(u.rank>previous){u.maxHp=this.unitProfile(u).hp;u.hp=Math.min(u.maxHp,Math.max(1,u.hp/oldMax*u.maxHp));return true;}return false;},
  encounterBusy(planet,site=null){return this.pendingEncounters.some(e=>e.planet===planet&&e.site===site)||this.missions.some(m=>m.to===planet&&(site?m.site===site:m.kind==='army'))||this.battles.some(b=>!b.done&&b.planet===planet&&b.site===site);},
  canRaid(from,id,team=0){const s=this.site(id);return !!s&&s.active&&this.regions[from]?.owner===team&&(this.regions[s.planet].owner===team||this.canCapture(s.planet,team))&&!this.encounterBusy(s.planet,s.id)&&!this.activeBattle()&&!this.result;},
  sendRaid(from,id,counts,team=0){if(!this.canRaid(from,id,team))return false;const s=this.site(id),chosen=[];for(const [type,n]of Object.entries(counts||{})){if(!unitCosts[type]||!Number.isInteger(n)||n<0)return false;const pool=this.army(team,from).filter(u=>u.type===type);if(pool.length<n)return false;chosen.push(...pool.slice(0,n));}if(!chosen.length)return false;const m={id:this.nextId++,kind:'raid',from,to:s.planet,site:s.id,generation:s.generation,team,left:20,units:chosen.map(u=>u.id)};for(const u of chosen)u.location='mission';this.missions.push(m);this.message='Экспедиция к '+s.name+': перелёт 20 с.';return m;},
  queueEncounter(m,troops){const defense=!m.site&&m.team!==0&&this.regions[m.to].owner===0,e={id:this.nextId++,planet:m.to,from:m.from,site:m.site||null,generation:m.generation||null,team:m.team,laboratory:!!m.laboratory,defense,countdown:defense?3:null,landing:m.landing||'edge',units:troops.map(u=>u.id)};for(const u of troops){u.location='arrived';u.planet=m.to;}this.pendingEncounters.push(e);this.message=defense?'Нападение на '+this.regions[e.planet].name+'! Бой начнётся через 3 с.':'Отряд прибыл: '+(this.site(e.site)?.name||this.regions[e.planet].name)+'. Выберите место высадки.';this.history.unshift({time:this.time,text:this.message});this.history=this.history.slice(0,20);return e;},
  arrive(m){
   if(m.kind==='colony'){if(this.activeBattle()){m.left=.1;this.missions.push(m);return;}return oldArrive.call(this,m);}
   const troops=(m.units||[]).map(id=>this.military.find(u=>u.id===id&&u.hp>0)).filter(Boolean);if(!troops.length)return;
   if(m.kind==='return'){for(const u of troops){u.location='reserve';u.planet=m.to;}return;}
   if(m.kind==='raid'){const s=this.site(m.site);if(!s?.active||s.generation!==m.generation){for(const u of troops){u.location='reserve';u.planet=m.from;}return;}return this.queueEncounter(m,troops);}
   if(this.battles.some(b=>b.planet===m.to&&!b.done)||this.pendingEncounters.some(e=>e.planet===m.to&&!e.site)){m.left=2;this.missions.push(m);return;}
   const owner=this.regions[m.to].owner;if(owner===0&&m.team!==0)return this.queueEncounter(m,troops);if(owner===m.team){for(const u of troops){u.location='reserve';u.planet=m.to;}return;}
   const defenders=owner>=0?this.army(owner,m.to):this.guardians(m.to),towers=owner>=0?this.alive(m.to).filter(e=>e.team===owner&&e.type==='tower'&&this.operational(e)):[];
   if(!defenders.length&&!towers.length&&!this.alive(m.to).some(e=>e.type==='base')){this.capturePlanet(m.to,m.team);for(const u of troops){u.location='reserve';u.planet=m.to;}return;}
   return this.queueEncounter(m,troops);
  },
  retreatEncounter(id){if(this.activeBattle())return false;const e=this.pendingEncounters.find(e=>e.id===id);if(!e||e.defense)return false;const troops=e.units.map(id=>this.military.find(u=>u.id===id&&u.hp>0)).filter(Boolean);this.pendingEncounters=this.pendingEncounters.filter(v=>v!==e);if(troops.length){for(const u of troops)u.location='mission';this.missions.push({id:this.nextId++,kind:'return',from:e.planet,to:e.from,team:e.team,left:20,units:troops.map(u=>u.id)});}return true;},
  startEncounter(id,landing='edge'){
   if(this.activeBattle()||this.result||!['center','edge'].includes(landing))return false;const e=this.pendingEncounters.find(v=>v.id===id);if(!e)return false;const troops=e.units.map(id=>this.military.find(u=>u.id===id&&u.hp>0&&u.location==='arrived')).filter(Boolean);if(!troops.length)return false;
   const s=this.site(e.site);if(e.site&&(!s?.active||s.generation!==e.generation))return this.retreatEncounter(id);
   const owner=this.regions[e.planet].owner,defenders=s?s.guards.filter(u=>u.hp>0):owner>=0?this.army(owner,e.planet):this.guardians(e.planet),towers=!s&&owner>=0?this.alive(e.planet).filter(t=>t.team===owner&&t.type==='tower'&&this.operational(t)):[];
   this.pendingEncounters=this.pendingEncounters.filter(v=>v!==e);return this.startBattle(e.planet,e.team,troops,defenders,towers,{from:e.from,site:e.site,generation:e.generation,landing:e.defense?e.landing:landing,laboratory:!!e.laboratory});
  },
  siteSurface(id){const site=this.site(id);if(!site)return null;const key='site:'+id;if(this.maps[key])return this.maps[key];const parent=this.planet(site.planet),width=site.kind==='moon'?112:96,height=site.kind==='moon'?80:64,p={id:key,width,height,seed:(parent.seed^Math.imul(id,2654435761))>>>0,roads:new Set(),entities:[],terrain:Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>+(x<1||y<1||x>=width-1||y>=height-1)))};this.maps[key]=p;
   for(let i=0;i<8;i++){const n=(Math.imul(i+1,1664525)^p.seed)>>>0,e=this.add('deposit',-1,10+n%(width-20),10+(n>>>8)%(height-20),key);e.resource=i%2?'metal':'crystals';e.amount=1200;}return p;
  },
  battleSurface(b=this.activeBattle()){return b?this.planet(b.mapId??b.planet):this.planet();},
  canManageProcesses(team=0){const b=this.activeBattle();return !b||!b.done&&b.defender===team&&!b.site;},
  deploymentPoint(p,anchor,index){const width=p.width||W,height=p.height||H;for(let r=0;r<20;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=Math.floor(anchor.x)+dx+.5,y=Math.floor(anchor.y)+dy+.5;if(x<2||y<2||x>width-2||y>height-2||this.cellBlocked(Math.floor(x),Math.floor(y),p.id))continue;if((index--||0)<=0)return{x,y};}return{x:5.5,y:height/2+.5};},
  battleUnit(b,u,side,anchor){const p=this.battleSurface(b),pos=this.deploymentPoint(p,anchor,b.units.filter(v=>v.side===side&&v.type!=='tower').length),v={id:u.id,type:u.type,team:u.team,faction:u.faction,rank:u.rank||1,side,...pos,hp:u.hp,maxHp:u.maxHp||this.unitProfile(u).hp,size:1,cool:0,walkDistance:0,moving:false,facingX:side?-1:1,facingY:0,dealt:0,healed:0,lastHP:u.hp};u.location='battle';u.planet=b.planet;b.units.push(v);b.initial.push({id:u.id,type:u.type,side});return v;},
  startBattle(planet,attacker,attackers,defenders,towers=[],context={}){
   if(this.activeBattle()||!['edge','center'].includes(context.landing||'edge'))return false;const surface=context.site?this.siteSurface(context.site):this.planet(planet),site=this.site(context.site),width=surface.width||W,height=surface.height||H,owner=this.regions[planet].owner,defender=defenders[0]?.team??(owner>=0?owner:2),local=this.alive(surface.id),headquarters=local.find(e=>e.team===defender&&e.type==='base'),b={id:this.nextId++,planet,mapId:surface.id,from:context.from??this.homeRegions[attacker]??0,site:context.site||null,generation:context.generation||null,attacker,defender,time:0,done:false,winner:null,units:[],effects:[],seed:surface.seed,guardRefs:defenders,initial:[],reward:{},promotions:[],landing:context.landing||'edge',laboratory:!!context.laboratory,entityRefs:local,baseId:headquarters?.id};
   b.field={w:width,h:height,terrain:surface.terrain,entities:surface.entities,roads:surface.roads};b.defenseAnchor=local.find(e=>e.team===defender&&e.type==='barracks'&&this.ready(e))||headquarters||{x:width/2+12,y:height/2};b.landingAnchor=b.landing==='center'?{x:width/2,y:height/2}:{x:5,y:height/2};
   if(defender===0&&!site){const all=this.army(0,planet);defenders=[...new Map([...defenders,...all].map(u=>[u.id,u])).values()];b.guardRefs=defenders;}
   this.ensureCombatTeam(attacker);this.ensureCombatTeam(defender);for(const u of attackers)this.battleUnit(b,u,0,b.landingAnchor);for(const u of defenders)this.battleUnit(b,u,1,b.defenseAnchor);
   for(const t of [...new Map([...towers,...local.filter(e=>e.type==='tower'&&e.team===defender&&this.operational(e))].map(e=>[e.id,e])).values()])b.units.push({id:-t.id,entityId:t.id,type:'tower',team:t.team,rank:1,side:1,x:t.x,y:t.y,hp:t.hp,maxHp:t.maxHp,size:t.size,cool:0,dealt:0,healed:0,lastHP:t.hp});
   this.battles.push(b);this.activeBattleId=b.id;this.message='Бой на поверхности: '+(site?.name||this.regions[planet].name)+'. Строительство недоступно.';return b;
  },
  damageAmount(attacker,target,distance=dist(attacker,target),falloff=1){const a=this.unitProfile(attacker),t=this.unitProfile(target),kind=a.damageType||'firearm';if(t.immunities?.includes(kind))return 0;let raw=(stats[target.type]?.cost&&a.buildingDamage?a.buildingDamage*(1+.15*((attacker.rank||1)-1)):a.damage)*falloff;if(kind==='mental'&&attacker.type==='psyker')raw*=1+Math.max(0,1-distance/a.range);raw*=t.weaknesses?.[kind]||1;return Math.max(1,raw-(kind==='mental'?0:t.armor));},
  battleTick(b,dt){
   if(b.done)return;const surface=this.battleSurface(b),width=b.field.w,height=b.field.h;b.time+=dt;b.effects=b.effects.filter(e=>(e.left-=dt)>0);
   if(b.defender===0&&!b.site)for(const u of this.army(0,b.planet))this.battleUnit(b,u,1,b.defenseAnchor);
   const entities=this.alive(b.mapId),primary=new Set(b.units.filter(u=>u.entityId).map(u=>u.entityId)),passive=entities.filter(e=>e.team===b.defender&&e.type!=='deposit'&&!(e.type==='worker'&&e.inside)&&!primary.has(e.id)).map(e=>({id:-e.id,entityId:e.id,type:e.type,team:e.team,side:1,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,size:e.size,passive:true,ref:e}));
   for(const u of b.units){const original=u.entityId?entities.find(e=>e.id===u.entityId):this.military.find(v=>v.id===u.id)||b.guardRefs.find(v=>v.id===u.id);if(original&&original.hp!==u.lastHP)u.hp=original.hp;}
   const targets=[...b.units,...passive],distance=(u,v)=>v.entityId&&v.type!=='worker'?Math.hypot(Math.max(0,Math.abs(u.x-v.x)-v.size/2),Math.max(0,Math.abs(u.y-v.y)-v.size/2)):dist(u,v);
   const move=(u,target,retreat=false)=>{const profile=this.unitProfile(u),ox=u.x,oy=u.y,dx=target.x-u.x,dy=target.y-u.y,d=Math.hypot(dx,dy)||1;
    if(retreat){const step=profile.speed*dt*.75,nx=u.x-dx/d*step,ny=u.y-dy/d*step;if(!this.cellBlocked(Math.floor(nx),Math.floor(ny),b.mapId)){u.x=Math.max(2,Math.min(width-2,nx));u.y=Math.max(2,Math.min(height-2,ny));}}
    else{const cell=Math.floor(target.x)+':'+Math.floor(target.y),near=target.entityId&&target.type!=='worker';if(!u.route?.length||u.routeTarget!==cell||this.cellBlocked(Math.floor(u.route[0].x),Math.floor(u.route[0].y),b.mapId)){u.routeTarget=cell;const actor={...u,planet:b.mapId};u.route=near?this.nearPath(actor,target):this.path(u.x,u.y,target.x,target.y,b.mapId);if(!u.route.length&&!this.cellBlocked(Math.floor(target.x),Math.floor(target.y),b.mapId))u.route=[{x:target.x,y:target.y}];}
     let remaining=profile.speed*dt;while(remaining>0&&u.route?.length){const point=u.route[0],len=dist(u,point);if(len<=remaining){u.x=point.x;u.y=point.y;u.route.shift();remaining-=len;}else{u.x+=(point.x-u.x)/len*remaining;u.y+=(point.y-u.y)/len*remaining;remaining=0;}}}
    const travelled=Math.hypot(u.x-ox,u.y-oy);u.walkDistance+=travelled;u.moving=travelled>.001;u.facingX=dx/d;u.facingY=dy/d;
   };
   for(const u of b.units.filter(u=>u.hp>0)){if(u.hp<=0)continue;u.moving=false;u.cool=Math.max(0,u.cool-dt);const profile=this.unitProfile(u),enemies=targets.filter(v=>v.hp>0&&v.team!==u.team).sort((a,c)=>(Number(!!a.passive)-Number(!!c.passive))||distance(u,a)-distance(u,c));if(!enemies.length)continue;
    if(profile.heal){const allies=b.units.filter(v=>v.hp>0&&v.id!==u.id&&v.team===u.team&&!v.entityId&&v.hp<v.maxHp).sort((a,c)=>dist(a,u)-dist(c,u)),target=allies[0];if(target&&dist(u,target)<=profile.range){if(!u.cool){const amount=Math.min(profile.heal,target.maxHp-target.hp);target.hp+=amount;u.healed+=amount;u.cool=1;b.effects.push({kind:'heal',x:u.x,y:u.y,tx:target.x,ty:target.y,left:.4});}if(dist(u,enemies[0])<3)move(u,enemies[0],true);}else{const escort=target||b.units.find(v=>v.hp>0&&v.team===u.team&&v.id!==u.id&&v.type!=='medic'&&!v.entityId);if(escort&&dist(u,escort)>3)move(u,escort);else if(dist(u,enemies[0])<3)move(u,enemies[0],true);}continue;}
    const foe=u.type==='grenadier'?(enemies.find(v=>v.entityId&&v.type!=='worker')||enemies[0]):(enemies.find(v=>!v.passive)||enemies.find(v=>v.type==='base')||enemies[0]),range=distance(u,foe);
    if(range<=profile.range){if(!u.cool){const hits=profile.splash?enemies.filter(v=>distance(foe,v)<=profile.splash):[foe];for(const target of hits){const falloff=profile.splash?Math.max(.45,1-distance(foe,target)/profile.splash*.55):1,amount=this.damageAmount(u,target,dist(u,target),falloff);u.dealt+=Math.min(Math.max(0,target.hp),amount);target.hp-=amount;if(target.ref)target.ref.hp=Math.max(0,target.hp);}u.cool=profile.cooldown||1;b.effects.push({kind:profile.damageType==='mental'?'mental':profile.damageType==='cutting'?'slash':profile.splash?'grenade':'shot',x:u.x,y:u.y,tx:foe.x,ty:foe.y,radius:profile.splash||0,left:.35});}
     if(profile.speed&&profile.range>3){if(range<2.3&&this.unitProfile(foe).range<2)move(u,foe,true);else if(u.type==='psyker'&&range>3)move(u,foe);}
    }else if(profile.speed)move(u,foe);
   }
   for(const u of b.units){const original=u.entityId?b.entityRefs.find(e=>e.id===u.entityId):this.military.find(v=>v.id===u.id)||b.guardRefs.find(v=>v.id===u.id);if(original)original.hp=Math.max(0,u.hp);u.lastHP=Math.max(0,u.hp);}
   const viable=team=>b.units.some(u=>u.hp>0&&u.team===team),offense=team=>b.units.some(u=>u.hp>0&&u.team===team&&this.unitProfile(u).damage>0),base=b.baseId&&b.entityRefs.find(e=>e.id===b.baseId),baseLost=base&&base.hp<=0;
   if(baseLost||!viable(b.attacker)||!viable(b.defender)&&!base||(!offense(b.attacker)&&!offense(b.defender))||b.time>=180)this.finishBattle(b,(baseLost||!viable(b.defender)&&!base)&&viable(b.attacker)?b.attacker:b.defender);
  },
  finishBattle(b,winner){
   if(b.done)return;b.done=true;b.winner=winner;const victory=winner===b.attacker;
   for(const u of b.units.filter(u=>u.id>0)){const original=this.military.find(v=>v.id===u.id)||b.guardRefs.find(v=>v.id===u.id);if(!original)continue;original.hp=Math.max(0,u.hp);if(u.side===1&&victory&&!b.site&&original.hp>0){const retreat=this.regions.find(r=>r.owner===b.defender&&r.id!==b.planet);if(retreat)original.planet=retreat.id;else{original.hp=0;u.hp=0;}}if(original.team===0&&original.hp>0){const xp=(original.team===winner?20:8)+Math.min(20,Math.floor((u.dealt+u.healed)/20));if(this.gainXP(original,xp))b.promotions.push({id:original.id,type:original.type,rank:original.rank});}original.location=original.team===2?'guard':'reserve';if(u.side===0)original.planet=(!b.site&&victory)?b.planet:b.from;}
   const s=this.site(b.site);
   if(s){s.guards=s.guards.filter(u=>u.hp>0);if(victory&&s.active&&s.generation===b.generation){s.active=false;s.guards=[];s.respawnAt=this.time+1200+Math.floor(this.random()*600);b.reward={...s.reward};for(const [r,n]of Object.entries(b.reward))this.refund(r,n,b.attacker);}}
   else{this.regions[b.planet].guardians=this.guardians(b.planet);if(victory){const base=b.entityRefs.find(e=>e.id===b.baseId);if(base&&base.hp<=0)base.hp=1;this.capturePlanet(b.planet,winner);}}
   b.summary={victory,survivors:b.units.filter(u=>u.side===0&&u.hp>0).length,lost:b.units.filter(u=>u.side===0&&u.hp<=0).length,enemiesLost:b.units.filter(u=>u.side===1&&u.hp<=0).length,reward:b.reward,promotions:b.promotions};
   this.history.unshift({time:this.time,text:(victory?'Победа':'Поражение')+': '+(s?.name||this.regions[b.planet].name)});this.history=this.history.slice(0,20);
  },
  acknowledgeBattle(id){const b=this.activeBattle();if(!b||b.id!==id||!b.done)return false;this.activeBattleId=null;this.military=this.military.filter(u=>u.hp>0);return true;}
 });
}
if(typeof module!=='undefined')module.exports={install};else install(root.RTS);
})(typeof window!=='undefined'?window:globalThis);
