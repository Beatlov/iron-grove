/* HELIOS H30: replaceable sound events; no simulation dependencies or external assets. */
(function(root){
'use strict';
const cues={
 'ui-click':{gap:.05,tones:[[480,240,.045,.13,'square']]},
 select:{gap:.08,tones:[[220,320,.07,.12,'triangle']]},
 place:{gap:.14,tones:[[150,70,.1,.2,'triangle']],noise:[.07,.12,1200]},
 build:{gap:.7,tones:[[95,55,.07,.1,'triangle']],noise:[.04,.09,1500]},
 'building-ready':{gap:.4,tones:[[320,320,.12,.17,'triangle',0],[480,480,.18,.13,'triangle',.1]]},
 'unit-ready':{gap:.4,tones:[[240,240,.09,.16,'square'],[360,360,.14,.12,'triangle',.09]]},
 production:{gap:.8,tones:[[420,300,.08,.08,'triangle']]},
 arrival:{gap:.8,tones:[[440,440,.12,.16,'triangle'],[660,660,.2,.12,'triangle',.15]]},
 'battle-start':{gap:1,tones:[[140,240,.25,.16,'sawtooth']]},
 shot:{gap:.085,tones:[[110,40,.065,.17,'sawtooth']],noise:[.075,.17,2400]},
 grenade:{gap:.3,tones:[[75,28,.3,.24,'sine']],noise:[.38,.23,700]},
 slash:{gap:.12,tones:[[230,75,.1,.1,'triangle']],noise:[.09,.14,1800]},
 mental:{gap:.18,tones:[[380,150,.2,.12,'sine'],[390,165,.18,.07,'triangle']]},
 heal:{gap:.25,tones:[[510,690,.15,.09,'sine']]},
 victory:{gap:1,tones:[[260,260,.16,.16,'triangle'],[330,330,.16,.14,'triangle',.14],[440,440,.3,.14,'triangle',.28]]},
 defeat:{gap:1,tones:[[220,150,.22,.16,'triangle'],[150,75,.35,.14,'triangle',.2]]}
};
class Sound{
 constructor(env=root){this.env=env;this.context=null;this.master=null;this.volume=.3;this.enabled=true;this.hidden=false;this.voices=new Set();this.last=new Map();this.samples=new Map();this.noise=null;try{const s=JSON.parse(env.localStorage?.getItem('iron-grove-sound-v1')||'null');if(s){if(typeof s.enabled==='boolean')this.enabled=s.enabled;if(Number.isFinite(s.volume))this.volume=Math.max(0,Math.min(1,s.volume));}}catch(_){}}
 save(){try{this.env.localStorage?.setItem('iron-grove-sound-v1',JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch(_){}}
 async unlock(){if(!this.enabled||this.hidden)return false;try{if(!this.context){const Audio=this.env.AudioContext||this.env.webkitAudioContext;if(!Audio)return false;this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=this.volume;this.master.connect(this.context.destination);}if(this.context.state==='suspended')await this.context.resume();return this.context.state==='running';}catch(_){return false;}}
 setVolume(value){if(!Number.isFinite(Number(value)))return;this.volume=Math.max(0,Math.min(1,Number(value)));this.apply();this.save();}
 setEnabled(value){this.enabled=!!value;this.apply();this.save();}
 setHidden(value){this.hidden=!!value;this.apply();}
 apply(){if(!this.enabled||this.hidden||!this.volume)this.stop();if(this.master)this.master.gain.setValueAtTime(this.enabled&&!this.hidden?this.volume:0,this.context.currentTime);}
 stop(){for(const voice of [...this.voices])voice.stop();}
 // Supply a same-origin file later. Until decoded, or on failure, the synthesized cue remains available.
 async setSample(name,url){if(!cues[name])return false;if(!url){this.samples.delete(name);return true;}const entry={buffer:null,url};this.samples.set(name,entry);try{if(!await this.unlock())return false;const response=await this.env.fetch(url);if(!response.ok)throw Error('audio response');const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(this.samples.get(name)===entry)entry.buffer=buffer;return true;}catch(_){return false;}}
 addVoice(source,gain,duration,level,filter=null,delay=0){if(this.voices.size>=24)return;const ctx=this.context,t=ctx.currentTime+delay;let ended=false;const finish=()=>{if(ended)return;ended=true;this.voices.delete(voice);source.disconnect();gain.disconnect();filter?.disconnect();};const voice={stop:()=>{try{source.stop();}catch(_){}finish();}};this.voices.add(voice);source.onended=finish;source.connect(filter||gain);if(filter)filter.connect(gain);gain.connect(this.master);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level),t+.005);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.start(t);source.stop(t+duration+.02);}
 noiseBuffer(){if(this.noise)return this.noise;const c=this.context,b=c.createBuffer(1,c.sampleRate,c.sampleRate),data=b.getChannelData(0);let n=0x13baf;for(let i=0;i<data.length;i++){n^=n<<13;n^=n>>>17;n^=n<<5;data[i]=((n>>>0)/4294967296)*2-1;}this.noise=b;return b;}
 play(name){const cue=cues[name],ctx=this.context;if(!cue||!this.enabled||this.hidden||this.volume<=0||!ctx||ctx.state!=='running')return false;const t=ctx.currentTime;if(t-(this.last.get(name)??-Infinity)<cue.gap||this.voices.size>=24)return false;this.last.set(name,t);
  try{const sample=this.samples.get(name)?.buffer;if(sample){const source=ctx.createBufferSource();source.buffer=sample;this.addVoice(source,ctx.createGain(),Math.max(.01,sample.duration),.5);return true;}
   for(const [start,end,duration,level,type,delay=0]of cue.tones||[]){const source=ctx.createOscillator();source.type=type;source.frequency.setValueAtTime(start,t+delay);source.frequency.exponentialRampToValueAtTime(end,t+delay+duration);this.addVoice(source,ctx.createGain(),duration,level,null,delay);}
   if(cue.noise){const [duration,level,frequency]=cue.noise,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=this.noiseBuffer();filter.type='lowpass';filter.frequency.value=frequency;this.addVoice(source,ctx.createGain(),duration,level,filter);}return true;
  }catch(_){return false;}
 }
}
function createObserver(emit){const states=new WeakMap();return function observe(sim,{silent=false}={}){
 let s=states.get(sim),initial=!s;if(initial){s={entities:new Map(),military:new Map(),arrivals:new Set(),battles:new Map(),effects:new WeakSet(),flows:new WeakSet(),result:null};states.set(sim,s);}const play=name=>{if(!initial&&!silent)emit(name);};
 const entities=new Map();for(const e of sim.all()){if(e.team!==0)continue;const prev=s.entities.get(e.id);entities.set(e.id,{construction:e.construction});if(!prev){if(e.construction>0)play('place');else if(e.type==='worker'||e.type==='drone')play('unit-ready');}else if(prev.construction>0){if(e.construction<=0)play('building-ready');else if(e.builder&&Math.floor(e.construction*2)!==Math.floor(prev.construction*2))play('build');}}s.entities=entities;
 const military=new Map();for(const u of sim.military){if(u.team!==0||u.hp<=0)continue;military.set(u.id,u.location);if(s.military.get(u.id)==='training'&&u.location!=='training')play('unit-ready');}s.military=military;
 const arrivals=new Set();for(const e of sim.pendingEncounters||[]){arrivals.add(e.id);if(!s.arrivals.has(e.id))play('arrival');}s.arrivals=arrivals;
 for(const b of sim.battles){if(!s.battles.has(b.id)&&!b.done)play('battle-start');if(b.done&&!s.battles.get(b.id))play(b.winner===0?'victory':'defeat');s.battles.set(b.id,b.done);if(!b.done)for(const effect of b.effects){if(!s.effects.has(effect)){s.effects.add(effect);play(effect.kind==='grenade'?'grenade':effect.kind==='shot'?'shot':effect.kind);}}}
 for(const e of sim.resourceFlowHistory||[])if(!s.flows.has(e)){s.flows.add(e);if(e.team===0&&e.direction==='income'&&e.source==='production')play('production');}
 if(sim.result&&sim.result!==s.result&&!sim.activeBattle?.())play(sim.result==='victory'?'victory':'defeat');s.result=sim.result;
 };}
const api={Sound,createObserver,events:Object.freeze(Object.keys(cues))};if(typeof module!=='undefined')module.exports=api;else root.RTSAudio=api;
})(typeof window!=='undefined'?window:globalThis);
