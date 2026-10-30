import fs from 'fs';
const j = JSON.parse(fs.readFileSync('proof-steps-table.json', 'utf8'));
for (const id of ['100', '108', '124', '197', '202']) {
  const k = Object.keys(j).find((x) => x.includes('Node_Connectivity::' + id + '::'));
  const v = k ? j[k] : null;
  console.log(id, 'steps', Array.isArray(v) ? v.length : 'n/a');
}
console.log('mtime', fs.statSync('proof-steps-table.json').mtime);
if (fs.existsSync('public/proof-steps-table.json')) {
  console.log('public mtime', fs.statSync('public/proof-steps-table.json').mtime);
  console.log('public size', fs.statSync('public/proof-steps-table.json').size);
}
console.log('root size', fs.statSync('proof-steps-table.json').size);
