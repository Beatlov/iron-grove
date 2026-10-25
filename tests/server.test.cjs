const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const os=require('node:os');

test('preview serves the current checkout from any cwd and never reuses a conditional cached response',async()=>{
 const child=spawn('python3',['-u',path.resolve(__dirname,'../serve.py'),'0'],{cwd:os.tmpdir(),stdio:['ignore','pipe','pipe']});
 try{
  const port=await new Promise((resolve,reject)=>{
   let output='';const timeout=setTimeout(()=>reject(new Error('server startup timed out')),8000);
   child.once('error',e=>{clearTimeout(timeout);reject(e);});
   child.once('exit',code=>{clearTimeout(timeout);reject(new Error('server exited: '+code));});
   child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/on port (\d+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});
  });
  const base=`http://127.0.0.1:${port}`;
  const response=await fetch(base);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const html=await response.text();assert.match(html,/Неоновый предел/);assert.match(html,/Версия: HELIOS H27/);
  const files=[...html.matchAll(/(?:src|href)="((?:engine\.js|game\.js|art\.js|style\.css)\?[^\"]+)"/g)].map(m=>m[1]);assert.equal(files.length,4);
  for(const file of ['',...files]){
   const fresh=await fetch(`${base}/${file}`,{headers:{'If-Modified-Since':'Fri, 01 Jan 2100 00:00:00 GMT','If-None-Match':'"old-build"'}});
   assert.equal(fresh.status,200,file);assert.match(fresh.headers.get('cache-control'),/no-store/);assert.ok((await fresh.text()).length>0);
  }
 }finally{child.kill();}
});
