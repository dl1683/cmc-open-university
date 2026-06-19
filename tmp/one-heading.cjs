const fs=require('fs');
const src=fs.readFileSync('src/topics/binary-search.js','utf8');
const re=/heading:\s*['\"]([^'\"]+)['\"]/g;
let m; while(m=re.exec(src)){console.log(m[1]);}
