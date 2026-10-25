// Isolate physical transport tests from the two ready starter robots.
// Detached robots are outside the simulation until explicitly returned, like an unavailable fleet.
function detachCarriers(g){const drones=g.all().filter(e=>e.type==='drone');for(const p of Object.values(g.maps))for(let i=p.entities.length-1;i>=0;i--)if(p.entities[i].type==='drone')p.entities.splice(i,1);return drones;}
function activate(g,d){const p=g.planet(d.planet);if(!p.entities.includes(d))p.entities.push(d);d.inside=null;d.retry=0;return d;}
module.exports={detachCarriers,activate};
