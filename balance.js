/* HELIOS H35: shared tuning knobs. Recipes/costs remain in RTS.stats / RTS.unitCosts. */
(function(root){
'use strict';
const balance=Object.freeze({population:Object.freeze({base:6,house:20}),extraction:Object.freeze({gas:.45,sulfur:.35}),combat:Object.freeze({labLimit:100,maxEffects:80,separation:.65})});
if(typeof module!=='undefined')module.exports=balance;else root.RTSBalance=balance;
})(typeof window!=='undefined'?window:globalThis);
