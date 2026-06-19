import fs from 'node:fs';
import path from 'node:path';

const files = [
  'graph-bfs',
  'dijkstra',
  'attention',
  'heap-sort',
  'retries-jitter',
  'backpressure',
  'tail-latency',
  'softmax-temperature',
  'causal-graphs',
  'transformer-block',
  'transformer-inference-roofline',
  'prefix-caching-radixattention',
  'quantization',
  'event-loop',
  'webassembly-linear-memory-case-study',
];

const targets = ['The wall', 'Worked example', 'How to read the animation', 'How it works (2)', 'The core insight', 'Frame-by-frame checkpoints', 'Micro checks', 'Try this now'];

for (const id of files) {
  const p = path.join('src/topics', `${id}.js`);
  const t = fs.readFileSync(p, 'utf8');
  const sectionsMatch = t.match(/export const article\s*=\s*\{[\s\S]*?\n\};\s*$/);
  if (!sectionsMatch) continue;
  const body = sectionsMatch[0];
  const start = body.indexOf('sections: [' );
  if (start === -1) continue;
  const raw = body.slice(start);
  console.log(`\n=== ${p} ===`);
  for (const heading of targets) {
    const idx = raw.indexOf(`heading: '${heading}',`);
    const idx2 = raw.indexOf(`heading: "${heading}",`);
    const idx3 = raw.indexOf(`heading: \`${heading}\`,`);
    let h = -1;
    if (idx !== -1) h = idx;
    else if (idx2 !== -1) h = idx2;
    else if (idx3 !== -1) h = idx3;
    if (h === -1) continue;
    const startLine = raw.slice(0, h).split('\n').length;
    const segment = raw.slice(h, h + 2200);
    const end = segment.indexOf('},');
    const block = (end === -1 ? segment : segment.slice(0, end + 2));
    console.log(`\n-- ${heading} (line ${startLine}) --`);
    const lines = block.split('\n').slice(0, 30);
    console.log(lines.join('\n'));
  }
}