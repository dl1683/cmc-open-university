import { learningTracks } from './src/tracks.js';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ids = [...new Set(learningTracks.flatMap((t) => t.modules.flatMap((m) => m.topicIds)))];
const bad = [];

for (const id of ids) {
  const file = path.join('src/topics', `${id}.js`);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    const firstLine = String(result.stderr || '').split('\n')[0];
    bad.push(`${id}: ${firstLine}`);
  }
}

console.log(`bad=${bad.length}`);
for (const line of bad) console.log(line);
