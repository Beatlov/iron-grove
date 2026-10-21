// Integration smoke test without a browser. Does not verify visual layout.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('UI initializes, renders, selects a base, trains, pauses and restarts',()=>{
  const elements=new Map(),handlers={},windowHandlers={};let frame;
  const context2d=new Proxy({},{get:(_,name)=>()=>{},set:()=>true});
  const make=()=>({textContent:'',style:{},children:[],tagName:'DIV',replaceChildren(){this.children=[];},append(e){this.children.push(e);}});
  const canvas=make();Object.assign(canvas,{getContext:()=>context2d,addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:1008,height:624})});elements.set('#game',canvas);
  const sandbox={console,document:{querySelector:(id)=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);},createElement:make},requestAnimationFrame:fn=>frame=fn};sandbox.window=sandbox;sandbox.addEventListener=(name,fn)=>windowHandlers[name]=fn;
  vm.createContext(sandbox);for(const file of ['engine.js','game.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox,{filename:file});
  frame(16);assert.equal(elements.get('#wood').textContent,160);
  const event={clientX:6.5*24,clientY:13.5*24,button:0,pointerId:1,shiftKey:false};handlers.pointerdown(event);handlers.pointerup(event);
  assert.equal(elements.get('#selection').textContent,'Штаб');elements.get('#actions').children[0].onclick();assert.equal(elements.get('#wood').textContent,120);
  elements.get('#pause').onclick();assert.equal(elements.get('#overlay').hidden,false);
  elements.get('#restart').onclick();assert.equal(elements.get('#overlay').hidden,true);assert.equal(elements.get('#wood').textContent,160);
  windowHandlers.keydown({code:'KeyB',target:{tagName:'BODY'}});frame(32);assert.match(elements.get('#message').textContent,/Выберите место/);
  handlers.pointerdown({clientX:11*24,clientY:18*24,button:0});assert.equal(elements.get('#wood').textContent,40);
});
