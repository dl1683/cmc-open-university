const fs = require('fs');
const source = fs.readFileSync('src/topics/binary-search.js', 'utf8');

function hasSection(source, heading) {
  const escaped = heading.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`heading:\\s*(["'\"])${escaped}(["'\"])`, 'i');
  return re.test(source);
}

console.log(hasSection(source, 'How to read the animation'));
