import { learningTracks } from './src/tracks.js';
import fs from 'node:fs';
import path from 'node:path';

const ids=[...new Set(learningTracks.flatMap((t)=>t.modules.flatMap((m)=>m.topicIds)))];
const rows=[];

const headingRegex=/heading\s*:\s*([`'\"])((?:[^\\]|\\.|[\s\S])*?)\1/g;

for(const id of ids){
  const file=path.join('src','topics',`${id}.js`);
  if(!fs.existsSync(file)) continue;
  const text=fs.readFileSync(file,'utf8');

  const articleMatch=text.match(/export\s+const\s+article\s*=\s*\{[\s\S]*?\n\};/m);
  if(!articleMatch){
    rows.push({id, sections:0, headings:0, words:0, hasStudyPrompt:false, status:'no-article'});
    continue;
  }

  const headings=[];
  let m;
  const seen=new Map();
  while((m=headingRegex.exec(articleMatch[0]))!==null){
    const h=m[2].trim();
    headings.push(h);
    seen.set(h.toLowerCase(), (seen.get(h.toLowerCase())||0)+1);
  }

  const paragraphMatches=[...(articleMatch[0].matchAll(/paragraphs\s*:\s*\[([\s\S]*?)\]/g))];
  let words=0;
  for(const pm of paragraphMatches){
    for(const literal of pm[1].matchAll(/([`'\"])([\s\S]*?)\1/g)) {
      words += String(literal[2]).trim().split(/\s+/).filter(Boolean).length;
    }
  }

  const duplicateHeadings=[...seen.entries()].filter(([,count])=>count>1).map(([h])=>h);
  const hasFrame=headings.some((h)=>h.toLowerCase()==='frame-by-frame checkpoints');
  const hasMicro=headings.some((h)=>h.toLowerCase()==='micro checks');
  const hasTry=headings.some((h)=>h.toLowerCase()==='try this now');
  const hasMap=headings.some((h)=>h.toLowerCase()==='learning map');

  rows.push({
    id,
    sections: headings.length,
    words,
    duplicateCount: duplicateHeadings.length,
    duplicateHeadings: duplicateHeadings.slice(0,3).join('|'),
    hasMap,
    hasFrame,
    hasMicro,
    hasTry,
  });
}

const weakBySections=rows.filter(r=>r.sections<8).sort((a,b)=>a.sections-b.sections || b.words-a.words);
console.log('weak_sections_8', weakBySections.length);
console.log('id,sections,words,duplicates,hasMap,hasFrame,hasMicro,hasTry');
for(const r of weakBySections.slice(0,80)){
  console.log(`${r.id},${r.sections},${r.words},${r.duplicateCount},${r.hasMap},${r.hasFrame},${r.hasMicro},${r.hasTry}`);
}

const duplicates=rows.filter(r=>r.duplicateCount>0);
console.log('duplicate_headings', duplicates.length);
console.log('duplicate sample', duplicates.slice(0,60).map(r=>`${r.id}:${r.duplicateHeadings}`).join('; '));

const ultraWeak=rows.filter(r=>r.words<200).sort((a,b)=>a.words-b.words);
console.log('words_under_200',ultraWeak.length);
console.log('ultraweak sample',ultraWeak.slice(0,80).map(r=>`${r.id}:${r.words}`).join('; '));
