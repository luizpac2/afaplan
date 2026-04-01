const d = require('./backup/programacao.json');
const instructors = new Set();
d.forEach(e => { if (e.instructorId) instructors.add(e.instructorId); });
console.log(Array.from(instructors));
if (instructors.size === 0) {
  // try other field name
  console.log('No instructorId, trying instructor...');
  d.forEach(e => { if (e.instructor) instructors.add(e.instructor); });
  console.log(Array.from(instructors));
}
