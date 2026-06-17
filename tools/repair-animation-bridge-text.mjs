import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

let changed = 0;

for (const name of readdirSync('src/topics')) {
  if (!name.endsWith('.js')) continue;
  const path = join('src/topics', name);
  const source = readFileSync(path, 'utf8');
  let next = source
    .replace(/\.  with the initial frame/g, '. Start with the initial frame')
    .replace(/\.  the ([^"]+ control to compare)/g, (_match, rest) => `. Use the ${rest}`);

  next = next
    .split('\n')
    .map((line) => {
      const first = line.match(/^(\s*)"Use this animation for (.*) as an execution trace, not decoration\. The page summary is: (.*)",$/);
      if (first) return `${first[1]}"Read the animation as an execution trace for ${first[2]}. ${first[3]}",`;
      const noSummary = line.match(/^(\s*)"Use this animation for (.*) as an execution trace, not decoration\. (.*)",$/);
      if (noSummary) return `${noSummary[1]}"Read the animation as an execution trace for ${noSummary[2]}. ${noSummary[3]}",`;
      return line.replace(
        '"The highlighted items show the current decision point; visited, removed, or found items show what the algorithm or system has already proved. Read each frame as \\"what changed, why is that change safe, and where would this structure become useful or fail?\\""',
        '"Track active and compared items as the live decision. Visited, removed, and found marks are proof: they show what the algorithm or system has ruled out or committed to. After each frame, ask what changed, why it is safe, and where the idea helps or fails."',
      );
    })
    .join('\n');

  if (next !== source) {
    writeFileSync(path, next);
    changed += 1;
  }
}

console.log(JSON.stringify({ changed }, null, 2));
