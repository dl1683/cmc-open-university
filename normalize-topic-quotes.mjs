import fs from 'node:fs';
import path from 'node:path';

function isWordChar(value) {
  return /[A-Za-z0-9_$]/.test(value ?? '');
}

function normalizeEscapedWordBoundaries(text) {
  let out = '';
  let changed = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\' && text[i + 1] === "'") {
      const prev = text[i - 1] ?? '';
      const next = text[i + 2] ?? '';
      if (!(isWordChar(prev) && isWordChar(next))) {
        out += "'";
        i += 1;
        changed += 1;
        continue;
      }
    }
    out += text[i];
  }
  return { out, changed };
}

function replaceTitleConcats(text, title) {
  const singlePattern = /\\?'((?:[^\\]|\\.)*)\\?'\s*\+\s*title\s*\+\s*\\?'((?:[^\\]|\\.)*)\\?'/g;
  const doublePattern = /\\"((?:[^\\]|\\.)*)\\"\\s*\+\s*title\s*\+\s*\\"((?:[^\\]|\\.)*)\\"/g;
  const backtickPattern = /`((?:[^\\]|\\.)*)`\s*\+\s*title\s*\+\s*`((?:[^\\]|\\.)*)`/g;
  const escapedTitle = title.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return text
    .replace(singlePattern, (_, leftText, rightText) => `'${leftText}${escapedTitle}${rightText}'`)
    .replace(doublePattern, (_, leftText, rightText) => `"${leftText}${title}${rightText}"`)
    .replace(backtickPattern, (_, leftText, rightText) => `\`${leftText}${title}${rightText}\``);
}

function extractTitle(fileText, fallback) {
  const match = fileText.match(/(?:export\\s+const\\s+title)\\s*=\\s*(['"`])([\\s\\S]*?)\\1/);
  return match ? match[2] : fallback;
}

function run() {
  const topicDir = path.join(process.cwd(), 'src', 'topics');
  const files = fs
    .readdirSync(topicDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => path.join(topicDir, file))
    .sort();

  let updated = 0;
  for (const filePath of files) {
    const original = fs.readFileSync(filePath, 'utf8');
    const title = extractTitle(original, path.basename(filePath, '.js'));
    const replaced = replaceTitleConcats(original, title);
    const normalized = normalizeEscapedWordBoundaries(replaced);
    if (normalized.out !== original) {
      fs.writeFileSync(filePath, normalized.out, 'utf8');
      updated += 1;
      console.log(`${path.basename(filePath)} changed=${normalized.changed}`);
    }
  }
  console.log(`updated=${updated}`);
}

run();
