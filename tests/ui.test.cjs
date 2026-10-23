const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('campaign UI hires citizens, assigns buildings, dispatches armies and only opens owned planets',()=>{
 const elements=new Map(),handlers={};let frame;
 const ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
 function make(){const e={textContent:'',style:{},children:[],value:'',checked:true,tagName:'DIV',getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:1008,height:624}),addEventListener(n,f){handlers[this.id+':'+n]=f;},replaceChildren(){this.children=[];},append(x){this.children.push(x);},setPointerCapture(){}};let id='';Object.defineProperty(e,'id',{get:()=>id,set:v=>{id=v;elements.set('#'+v,e);}});return e;}
 const document={querySelector:id=>{if(!elements.has(id)){const e=make();e.id=id.slice(1);}return elements.get(id);},createElement:make};
 const sandbox={console,document,requestAnimationFrame:fn=>frame=fn};sandbox.window=sandbox;sandbox.addEventListener=()=>{};vm.createContext(sandbox);
 for(const file of ['engine.js','art.js','game.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox,{filename:file});
 const run=s=>vm.runInContext(s,sandbox),el=s=>document.querySelector('#'+s);
 el('seed').value='42';el('menu-speed').value='.6';el('ai').checked=false;el('start').onclick();assert.equal(el('menu').hidden,true);assert.equal(el('resources').children.length,5);assert.equal(el('buildings').children.length,11);assert.equal(el('planet-select').children.length,1);
 run("game.add('house',0,60,40);selected=game.alive().find(e=>e.type==='base').id;updateUI()");const before=run('game.population().workers');el('actions').children.find(b=>b.title.startsWith('Нанять жителя')).onclick();assert.equal(run('game.population().workers'),before+1);
 run("selected=game.add('guild',0,77,42).id;updateUI()");el('actions').children.find(b=>b.title==='Занять одно рабочее место свободным жителем').onclick();assert.equal(run('game.workers(game.get(selected)).length'),1);
 run("selected=game.add('barracks',0,65,45).id;updateUI()");el('actions').children.find(b=>b.textContent==='Десантник').onclick();assert.equal(run('game.military[0].location'),'training');assert.equal(run('game.population().workers'),before+1);
 run('for(let i=0;i<105;i++)game.tick(.1);updateUI()');assert.equal(run('game.army().length'),1);
 const target=run('game.regions[0].neighbors[0]');run('inspected='+target);el('army-open').onclick();assert.equal(el('army').hidden,false);el('army-source').value='0';el('army-target').value=String(target);el('count-soldier').value='1';el('count-soldier').oninput();assert.equal(el('dispatch').disabled,false);el('dispatch').onclick();assert.equal(run('game.missions.length'),1);el('army-close').onclick();
 run('for(let i=0;i<205;i++)game.tick(.1);updateUI()');assert.equal(run('game.regions['+target+'].owner'),0);assert.equal(el('planet-select').children.length,2);el('planet-select').onchange({target:{value:String(target)}});assert.equal(run('game.activePlanet'),target);
 el('planet-select').onchange({target:{value:'11'}});assert.equal(run('game.activePlanet'),target);assert.equal(run('typeof game.command'),'undefined');
 el('pause').onclick();assert.equal(run('paused'),true);el('speed-fast').onclick();assert.equal(run('paused'),false);assert.equal(run('speed'),1);
 const time=run('game.time');el('help-open').onclick();frame(0);frame(100);assert.equal(run('game.time'),time);el('help-close').onclick();
 el('menu-open').onclick();const saved=run('game.time');frame(200);assert.equal(run('game.time'),saved);el('resume').onclick();assert.equal(el('menu').hidden,true);
 run("switchPlanet(0);selected=null;updateUI()");const w=run("game.alive().find(e=>e.type==='worker'&&!e.inside)");const cam=run('({...camera})');handlers['game:pointerdown']({button:0,clientX:(w.x-cam.x)*24,clientY:(w.y-cam.y)*24,pointerId:1});assert.equal(run('selected'),null);
 run(`switchPlanet(${target});selected=game.add('guild',0,60,40).id;game.capturePlanet(${target},1);updateUI()`);assert.equal(run('game.activePlanet'),0);assert.equal(run('selected'),null);
});
