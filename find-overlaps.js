const raw = require('./backup/programacao.json');
const seen = new Set();
const dups = [];

raw.forEach(a => {
  if (!a.date || !a.startTime || !a.location) return;
  const key = `${a.date}|${a.startTime}|${a.location}`;
  if (seen.has(key)) {
    dups.push(a);
  } else {
    seen.add(key);
  }
});

console.log(`Encontrados ${dups.length} eventos duplicados (mesmo local, data e hora início).`);
if (dups.length > 0) {
  console.log('Exemplo:', dups[0]);
}
