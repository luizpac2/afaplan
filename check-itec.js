const d = require('./backup/disciplinas.json');
console.log(JSON.stringify(d.filter(x => (x.code || x.sigla) === 'ITEC'), null, 2));
