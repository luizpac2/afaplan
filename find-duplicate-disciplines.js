const d = require('./backup/disciplinas.json');
const counts = {};
d.forEach(x => {
  const s = (x.code || x.sigla || '').substring(0, 10);
  if (!counts[s]) counts[s] = [];
  counts[s].push(x.id);
});

Object.entries(counts).filter(([s, ids]) => ids.length > 1).forEach(([s, ids]) => {
  console.log(`Sigla: ${s} (${ids.length} times) - IDs: ${ids.join(', ')}`);
});
