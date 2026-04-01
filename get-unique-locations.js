const fs = require('fs');
const disciplines = JSON.parse(fs.readFileSync('./backup/disciplinas.json'));
const events = JSON.parse(fs.readFileSync('./backup/programacao.json'));

const locs = new Set();
disciplines.forEach(d => { if (d.location) locs.add(d.location); });
events.forEach(e => { if (e.location) locs.add(e.location); });

console.log(Array.from(locs));
