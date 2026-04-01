const fs = require('fs');
const lines = fs.readFileSync('./csv/locais.csv', 'utf8').split('\n').slice(0, 10);
console.log(lines.join('\n'));
