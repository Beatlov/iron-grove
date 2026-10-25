/* Isolated fixtures for the real battle engine. No campaign instance is accepted or mutated. */
(function(root){
'use strict';
function install(api){
 const {Game,stats,unitCosts}=api,playerTypes=Object.keys(unitCosts),enemyTypes=[...playerTypes,'xeno','robot','demon','pirate'],limit=30;
 function normalizeBattleLabConfig(input={}){
  const mode=input.mode||'attack';if(!['attack','defense'].includes(mode))throw Error('Выберите атаку или оборону.');const landing=input.landing||'edge';if(!['edge','center'].includes(landing))throw Error('Выберите высадку в центре или у края.');const seed=input.seed??42;if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Ключ карты: целое число от 0 до 4294967295.');
  const side=(rows,allowed,name)=>{if(!Array.isArray(rows))throw Error('Выберите состав: '+name+'.');const seen=new Set(),out=[];let total=0;
   for(const row of rows){if(!row||!allowed.includes(row.type)||seen.has(row.type)||!Number.isInteger(row.count)||row.count<0||row.count>limit||!Number.isInteger(row.rank)||row.rank<1||row.rank>3)throw Error('Проверьте состав «'+name+'»: количество 0–30, ранг I–III.');seen.add(row.type);total+=row.count;if(row.count)out.push({type:row.type,count:row.count,rank:row.rank});}
   if(total<1||total>limit)throw Error('В отряде «'+name+'» должно быть от 1 до '+limit+' бойцов.');return out;
  };return{seed,landing,mode,left:side(input.left,playerTypes,'Ваш отряд'),right:side(input.right,enemyTypes,'Противники')};
 }
 function createBattleLab(input){const config=normalizeBattleLabConfig(input),game=new Game(config.seed,{opponent:false,neutrals:false});
  const army=(rows,team)=>rows.flatMap(row=>Array.from({length:row.count},()=>{const unit={id:game.nextId++,type:row.type,team,planet:team?1:0,location:'reserve',rank:row.rank,xp:[0,40,110][row.rank-1]};unit.maxHp=game.unitProfile(unit).hp;unit.hp=unit.maxHp;game.military.push(unit);return unit;}));
  const left=army(config.left,0),right=army(config.right,2);if(config.mode==='defense'){game.add('barracks',0,84,54,0);game.laboratoryPending=true;game.queueEncounter({from:1,to:0,team:2,laboratory:true,landing:config.landing},right);}else game.startBattle(1,0,left,right,[],{laboratory:true,landing:config.landing});return{game,get battle(){return game.battles.at(-1)||null;},config};
 }
 Object.assign(api,{normalizeBattleLabConfig,createBattleLab,battleLabLimit:limit});
}
if(typeof module!=='undefined')module.exports={install};else install(root.RTS);
})(typeof window!=='undefined'?window:globalThis);
