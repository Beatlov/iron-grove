/* Iron Grove — deterministic simulation, shared by browser and Node tests. */
(function (root) {
  'use strict';
  const W=42,H=26;
  const stats={worker:{hp:50,speed:2.5,damage:4,range:1.2,cost:40,time:4},soldier:{hp:100,speed:2.1,damage:15,range:1.5,cost:70,time:6},base:{hp:1200,size:3},barracks:{hp:550,size:2,cost:120}};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  class Game {
    constructor(){
      this.time=0;this.wood=160;this.entities=[];this.nextId=1;this.wave=0;this.nextWave=55;this.result=null;this.message='Выделите рабочих и отправьте их к деревьям правой кнопкой.';
      this.terrain=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>{
        if(x===0||y===0||x===W-1||y===H-1)return 1;
        return (x>=19&&x<=22&&!(y>=11&&y<=14))?1:0;
      }));
      this.add('base',0,6.5,13.5);this.add('base',1,35.5,13.5);
      [[4,10],[6,10],[8,10]].forEach(([x,y])=>this.add('worker',0,x+.5,y+.5));
      this.add('soldier',0,10.5,13.5);this.add('soldier',0,10.5,15.5);
      [[4,5],[5,5],[6,5],[7,5],[4,6],[5,6],[6,6],[7,6],[4,20],[5,20],[6,20],[7,20],[31,5],[32,5],[33,5],[34,5],[32,20],[33,20],[34,20]].forEach(([x,y])=>this.add('tree',-1,x+.5,y+.5));
    }
    add(type,team,x,y){const s=stats[type]||{hp:180};const e={id:this.nextId++,type,team,x,y,hp:s.hp,maxHp:s.hp,cool:0,path:[],order:null,queue:[],size:s.size||1,carry:0};this.entities.push(e);return e;}
    alive(){return this.entities.filter(e=>e.hp>0);}
    get(id){return this.entities.find(e=>e.id===id&&e.hp>0);}
    cellBlocked(x,y){return x<0||y<0||x>=W||y>=H||this.terrain[y][x]===1||this.alive().some(e=>!stats[e.type]?.speed&&Math.abs(x+.5-e.x)<e.size/2&&Math.abs(y+.5-e.y)<e.size/2);}
    path(sx,sy,tx,ty){
      sx=Math.floor(sx);sy=Math.floor(sy);tx=Math.floor(tx);ty=Math.floor(ty);
      if(tx<0||ty<0||tx>=W||ty>=H||this.cellBlocked(tx,ty))return [];
      const key=(x,y)=>y*W+x,start=key(sx,sy),goal=key(tx,ty),q=[[sx,sy]],parents=new Map([[start,null]]);
      for(let i=0;i<q.length;i++){const [x,y]=q[i];if(key(x,y)===goal){const p=[];let k=goal;while(k!==start){p.push({x:k%W+.5,y:Math.floor(k/W)+.5});k=parents.get(k);}return p.reverse();}
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(!this.cellBlocked(nx,ny)&&!parents.has(k)){parents.set(k,key(x,y));q.push([nx,ny]);}}
      }return [];
    }
    nearPath(u,target){
      const cells=[];const r=Math.ceil(target.size/2)+1;
      for(let y=Math.floor(target.y)-r;y<=Math.floor(target.y)+r;y++)for(let x=Math.floor(target.x)-r;x<=Math.floor(target.x)+r;x++)if(!this.cellBlocked(x,y))cells.push({x:x+.5,y:y+.5});
      cells.sort((a,b)=>(dist(a,target)+dist(a,u)*.15)-(dist(b,target)+dist(b,u)*.15));
      for(const c of cells){const p=this.path(u.x,u.y,c.x,c.y);if(p.length||dist(u,c)<.2)return p;}return [];
    }
    command(ids,x,y,targetId){
      if(this.result)return;
      const target=this.get(targetId);let n=0;
      for(const id of ids){const u=this.get(id);if(!u||u.team!==0||!stats[u.type]?.speed)continue;
        if(target?.team===1){u.order={type:'attack',id:target.id};u.path=this.nearPath(u,target);}
        else if(target?.type==='tree'&&u.type==='worker'){u.order={type:'gather',id:target.id};u.path=this.nearPath(u,target);}
        else {let tx=Math.floor(x)+(n%3)-1,ty=Math.floor(y)+Math.floor(n/3);if(this.cellBlocked(tx,ty)){tx=Math.floor(x);ty=Math.floor(y);}u.order={type:'move'};u.path=this.path(u.x,u.y,tx,ty);n++;}
      }
    }
    canBuild(x,y){return !this.result&&this.wood>=120&&this.alive().some(e=>e.team===0&&e.type==='worker')&&this.alive().some(e=>e.team===0&&e.type==='base'&&dist(e,{x,y})<9)&&[-.5,.5].every(dx=>[-.5,.5].every(dy=>!this.cellBlocked(Math.floor(x+dx),Math.floor(y+dy))))&&!this.alive().some(e=>stats[e.type]?.speed&&Math.abs(e.x-x)<1.2&&Math.abs(e.y-y)<1.2);}
    build(x,y){if(!this.canBuild(x,y)){this.message='Нужны 120 дерева, рабочий и свободные 2×2 клетки рядом с базой.';return false;}this.wood-=120;this.add('barracks',0,x,y);this.message='Казарма готова. Выделите её для найма бойцов.';return true;}
    train(id,type){const b=this.get(id),s=stats[type];if(this.result||!b||b.team!==0||!s||!(b.type==='base'&&type==='worker'||b.type==='barracks'&&type==='soldier'))return false;
      if(this.wood<s.cost){this.message='Недостаточно дерева.';return false;}if(b.queue.length>=5){this.message='Очередь заполнена.';return false;}this.wood-=s.cost;b.queue.push({type,left:s.time});return true;}
    move(u,dt){let remaining=stats[u.type].speed*dt;while(u.path.length&&remaining>0){const p=u.path[0];if(this.cellBlocked(Math.floor(p.x),Math.floor(p.y))){u.path=[];break;}const d=dist(u,p);if(d<=remaining){u.x=p.x;u.y=p.y;u.path.shift();remaining-=d;}else{u.x+=(p.x-u.x)/d*remaining;u.y+=(p.y-u.y)/d*remaining;remaining=0;}}}
    tick(dt){
      if(this.result)return;dt=Math.min(dt,.1);this.time+=dt;
      if(this.time>=this.nextWave){this.wave++;this.nextWave+=45;for(let i=0;i<Math.min(2+this.wave,8);i++){const u=this.add('soldier',1,32.5,11.5+i%4);const b=this.alive().find(e=>e.type==='base'&&e.team===0);if(b){u.order={type:'attack',id:b.id};u.path=this.nearPath(u,b);}}this.message='Вражеский отряд идёт через перевал!';}
      for(const e of this.alive()){
        if(e.queue.length){const q=e.queue[0];q.left-=dt;if(q.left<=0){const p=this.nearPath({x:e.x+e.size,y:e.y+e.size},e);const cell=p.at(-1);if(cell){this.add(q.type,e.team,cell.x,cell.y);e.queue.shift();}}}
        if(!stats[e.type]?.speed)continue;e.cool=Math.max(0,e.cool-dt);
        let o=e.order,target=o&&this.get(o.id);
        if(o?.type==='gather'){
          if(e.carry>=20||(!target&&e.carry)){const b=this.alive().find(b=>b.type==='base'&&b.team===e.team);if(b){if(dist(e,b)<=b.size/2+1){this.wood+=e.carry;e.carry=0;e.path=target?this.nearPath(e,target):[];}else if(!e.path.length||e.returning!==b.id){e.path=this.nearPath(e,b);e.returning=b.id;} } }
          else if(target&&dist(e,target)<=1.5){e.returning=null;if(e.cool===0){const n=Math.min(4,target.hp);target.hp-=n;e.carry+=n;e.cool=.65;}}
          else if(!target){const tree=this.alive().filter(t=>t.type==='tree').sort((a,b)=>dist(e,a)-dist(e,b))[0];if(tree){e.order={type:'gather',id:tree.id};e.path=this.nearPath(e,tree);}else e.order=null;}
        }else{
          const enemies=this.alive().filter(t=>t.team>=0&&t.team!==e.team&&dist(e,t)<5).sort((a,b)=>dist(e,a)-dist(e,b));
          const explicit=o?.type==='attack'&&target;
          const foe=explicit&&dist(e,target)<=target.size/2+stats[e.type].range?target:enemies[0];
          if(foe&&(!o||o.type==='attack')){const range=stats[e.type].range+(foe.size-1)/2;if(dist(e,foe)<=range){if(e.cool===0){foe.hp-=stats[e.type].damage;e.cool=.8;}continue;}if(!e.path.length)e.path=this.nearPath(e,foe);}
          if(o?.type==='attack'&&target&&!e.path.length)e.path=this.nearPath(e,target);
          if(o?.type==='attack'&&!target){e.order=null;e.path=[];}
        }
        this.move(e,dt);if(e.order?.type==='move'&&!e.path.length)e.order=null;
      }
      for(const team of [0,1])if(!this.alive().some(e=>e.team===team&&e.type==='base'))this.result=team===0?'defeat':'victory';
      this.entities=this.entities.filter(e=>e.hp>0);
    }
  }
  const api={Game,stats,W,H,dist};if(typeof module!=='undefined')module.exports=api;else root.RTS=api;
})(typeof window!=='undefined'?window:globalThis);
