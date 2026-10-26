/* Audio adapters only: sound never controls the simulation. */
(function(){
'use strict';
const sound=new RTSAudio.Sound(),observe=RTSAudio.createObserver(name=>sound.play(name));window.gameAudio={sound,observe};
const enabled=document.querySelector('#sound-enabled'),volume=document.querySelector('#sound-volume'),label=document.querySelector('#sound-value'),toggle=document.querySelector('#sound-toggle');
function refresh(){enabled.checked=sound.enabled;volume.value=Math.round(sound.volume*100);label.textContent=Math.round(sound.volume*100)+'%';toggle.textContent=sound.enabled?'♪':'♪×';toggle.setAttribute('aria-pressed',String(sound.enabled));toggle.setAttribute('aria-label',sound.enabled?'Отключить звук':'Включить звук');toggle.title=sound.enabled?'Звук включён · громкость в меню':'Звук выключен';}
async function enable(value){sound.setEnabled(value);refresh();if(value&&await sound.unlock())sound.play('ui-click');}
enabled.onchange=()=>enable(enabled.checked);toggle.onclick=()=>enable(!sound.enabled);volume.oninput=()=>{sound.setVolume(Number(volume.value)/100);refresh();};volume.onchange=async()=>{if(await sound.unlock())sound.play('select');};
document.querySelector('#sound-test').onclick=async()=>{if(await sound.unlock())sound.play('building-ready');};
window.addEventListener('pointerdown',()=>{sound.unlock();},{capture:true});window.addEventListener('keydown',()=>{sound.unlock();},{capture:true});
document.addEventListener('click',e=>{const button=e.target.closest?.('button');if(button&&!button.disabled&&!['sound-toggle','sound-test'].includes(button.id))sound.play('ui-click');},{capture:true});
document.addEventListener('visibilitychange',()=>sound.setHidden(document.hidden));window.addEventListener('blur',()=>sound.stop());
refresh();observe(game);
})();
