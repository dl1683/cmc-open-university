const fs = require('fs');

const files = fs.readdirSync('src/topics').filter((f) => f.endsWith('.js'));
const count = new Map();

for (const f of files) {
  const src = fs.readFileSync(`src/topics/${f}`, 'utf8');
  const re = /heading:\s*([`"'])(.*?)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    count.set(m[2], (count.get(m[2]) || 0) + 1);
  }
}

const rows = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
console.log('TOTAL_FILES', files.length);
for (const [h, n] of rows.slice(0, 220)) {
  console.log(String(n).padStart(4, ' '), h);
}
console.log('UNIQUE', rows.length);
