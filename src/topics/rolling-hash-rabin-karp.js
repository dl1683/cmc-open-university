// Rolling hash and Rabin-Karp: update a window fingerprint in O(1) as the
// window slides, then use hash hits as candidates that still need exact checks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rolling-hash-rabin-karp',
  title: 'Rolling Hash & Rabin-Karp',
  category: 'Data Structures',
  summary: 'A sliding-window fingerprint: remove the outgoing character, add the incoming one, and use hash hits to find candidate string matches quickly.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['slide and match', 'collisions and uses'], defaultValue: 'slide and match' },
  ],
  run,
};

const TEXT = 'abracadabra';
const PATTERN = 'abra';
const BASE = 257;
const MOD = 101;

function hash(text, mod = MOD) {
  let h = 0;
  for (const ch of text) h = (h * BASE + ch.charCodeAt(0)) % mod;
  return h;
}

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };

  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function rollingFlow(title) {
  return graphState({
    nodes: [
      { id: 'window', label: 'window', x: 0.8, y: 3.2, note: 'm chars' },
      { id: 'drop', label: 'drop', x: 2.7, y: 3.2, note: 'old char' },
      { id: 'shift', label: 'shift', x: 4.6, y: 3.2, note: 'base' },
      { id: 'add', label: 'add', x: 6.5, y: 3.2, note: 'new char' },
      { id: 'check', label: 'check', x: 8.4, y: 3.2, note: 'candidate' },
    ],
    edges: [
      { id: 'e-window-drop', from: 'window', to: 'drop' },
      { id: 'e-drop-shift', from: 'drop', to: 'shift' },
      { id: 'e-shift-add', from: 'shift', to: 'add' },
      { id: 'e-add-check', from: 'add', to: 'check' },
    ],
  }, { title });
}

function* slideAndMatch() {
  const patternHash = hash(PATTERN);
  yield {
    state: rollingFlow('Rabin-Karp hashes each sliding window'),
    highlight: { active: ['window', 'drop', 'add'], found: ['check'] },
    explanation: `Search for pattern "${PATTERN}" in "${TEXT}". A rolling hash gives every length-${PATTERN.length} window a fingerprint without recomputing the whole window from scratch.`,
    invariant: 'Equal strings must have equal hashes; equal hashes still need exact comparison.',
  };

  yield {
    state: labelMatrix(
      'Windows over abracadabra',
      [
        { id: 'p0', label: 'pos 0' },
        { id: 'p1', label: 'pos 1' },
        { id: 'p2', label: 'pos 2' },
        { id: 'p7', label: 'pos 7' },
      ],
      [
        { id: 'window', label: 'window' },
        { id: 'hash', label: 'hash' },
        { id: 'result', label: 'result' },
      ],
      [
        ['abra', String(hash('abra')), 'candidate'],
        ['brac', String(hash('brac')), 'skip'],
        ['raca', String(hash('raca')), 'skip'],
        ['abra', String(hash('abra')), 'candidate'],
      ],
    ),
    highlight: { found: ['p0:result', 'p7:result'], compare: ['p1:result', 'p2:result'] },
    explanation: `The pattern hash is ${patternHash}. Windows at positions 0 and 7 have the same hash, so they become candidates. Other windows are rejected by one integer comparison.`,
  };

  yield {
    state: labelMatrix(
      'Roll one step',
      [
        { id: 'old', label: 'old' },
        { id: 'drop', label: 'drop' },
        { id: 'shift', label: 'shift' },
        { id: 'add', label: 'add' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['hash(abra)', 'old window'],
        ['remove a', 'high term'],
        ['multiply base', 'slide left'],
        ['append c', 'new brac'],
      ],
    ),
    highlight: { active: ['drop:operation', 'shift:operation', 'add:operation'], found: ['add:meaning'] },
    explanation: 'Polynomial rolling hashes treat a window like a number in a base. Sliding right removes the outgoing high-order character, shifts the remaining contribution, and adds the new character.',
    invariant: 'The update is O(1) once base powers are precomputed.',
  };

  yield {
    state: rollingFlow('Rabin-Karp filters, then verifies'),
    highlight: { active: ['check'], found: ['window'], compare: ['drop', 'shift', 'add'] },
    explanation: 'Rabin-Karp is a filter. A hash mismatch proves the window is not the pattern. A hash match only says maybe; the implementation compares the actual bytes to rule out collision.',
  };
}

function* collisionsAndUses() {
  yield {
    state: labelMatrix(
      'Tiny modulus collision demo',
      [
        { id: 'w1', label: 'cada' },
        { id: 'w2', label: 'adab' },
        { id: 'w3', label: 'brac' },
        { id: 'w4', label: 'dabr' },
      ],
      [
        { id: 'hash13', label: 'hash mod 13' },
        { id: 'verdict', label: 'byte check' },
      ],
      [
        [String(hash('cada', 13)), 'different'],
        [String(hash('adab', 13)), 'different'],
        [String(hash('brac', 13)), 'different'],
        [String(hash('dabr', 13)), 'different'],
      ],
    ),
    highlight: { compare: ['w1:hash13', 'w2:hash13', 'w3:hash13', 'w4:hash13'], found: ['w1:verdict', 'w2:verdict'] },
    explanation: 'With a deliberately tiny modulus, different windows collide. That is why Rabin-Karp never treats a hash hit as proof of equality unless a collision probability is explicitly acceptable.',
  };

  yield {
    state: labelMatrix(
      'Where rolling hashes appear',
      [
        { id: 'search', label: 'string search' },
        { id: 'rsync', label: 'rsync delta' },
        { id: 'cdc', label: 'CDC chunking' },
        { id: 'dedup', label: 'dedup store' },
      ],
      [
        { id: 'rolling part', label: 'rolling part' },
        { id: 'strong part', label: 'strong check' },
      ],
      [
        ['window hash', 'byte compare'],
        ['weak checksum', 'strong digest'],
        ['boundary test', 'chunk hash'],
        ['similar chunks', 'content id'],
      ],
    ),
    highlight: { active: ['rsync:rolling part', 'cdc:rolling part'], found: ['dedup:strong part'] },
    explanation: 'Rolling hashes are often the cheap front door. Systems then use a stronger hash, MAC, or byte comparison before trusting equality.',
  };

  yield {
    state: labelMatrix(
      'Algorithm fit',
      [
        { id: 'kmp', label: 'KMP' },
        { id: 'rk', label: 'Rabin-Karp' },
        { id: 'aho', label: 'Aho-Corasick' },
        { id: 'suffix', label: 'Suffix Array' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['one exact pattern', 'deterministic'],
        ['many fixed windows', 'collisions'],
        ['many patterns', 'larger automaton'],
        ['many text queries', 'build index'],
      ],
    ),
    highlight: { found: ['rk:best'], compare: ['rk:tradeoff', 'kmp:tradeoff'] },
    explanation: 'Rabin-Karp is not always the best single-pattern matcher. It shines when hashing lets you compare many windows, many equal-length patterns, or chunk boundaries cheaply.',
  };

  yield {
    state: rollingFlow('The pattern is filter then confirm'),
    highlight: { active: ['window', 'check'], found: ['add'], compare: ['drop'] },
    explanation: 'The durable lesson is a two-stage pattern: maintain a cheap rolling summary over a moving window, use it to nominate candidates, then confirm candidates with the structure that owns correctness.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'slide and match') yield* slideAndMatch();
  else if (view === 'collisions and uses') yield* collisionsAndUses();
  else throw new InputError('Pick a rolling-hash view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A rolling hash is a fingerprint for a fixed-size moving window. When the window slides one character or byte to the right, the hash can be updated from the old hash by removing the outgoing symbol and adding the incoming symbol. Rabin-Karp uses that trick for string matching: hash the pattern, roll across the text, and only compare bytes where the window hash matches the pattern hash.',
        'The key distinction is candidate versus proof. If two strings are equal, their hashes match. If two hashes match, the strings might still differ. Rabin-Karp is therefore a fast filter, not a substitute for exact comparison unless the application explicitly accepts probabilistic equality.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A common polynomial rolling hash treats a string as digits in a base modulo a prime. For a window of length m, precompute base^(m-1). To slide, subtract the outgoing character times that high power, multiply by the base, add the incoming character, and reduce modulo the prime. That turns O(m) rehashing per position into O(1) update work.',
        'Rabin fingerprints use polynomial arithmetic over GF(2), which makes them especially useful for byte streams and content-defined chunking. The mental model stays the same: a small rolling fingerprint tracks the current window, and a simple predicate over that fingerprint decides whether something interesting may have happened.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Preprocessing the pattern is O(m). Scanning a text of length n is expected O(n + matches * m) if hash hits are rare and candidates are verified by byte comparison. Worst-case time can degrade when many collisions or many true candidates force repeated exact checks. Space is O(1) for one pattern, or O(k) hashes for k equal-length patterns stored in a Hash Table or Bloom Filter-style filter.',
      ],
    },
    {
      heading: 'Real-world case studies',
      paragraphs: [
        'Rsync uses rolling checksums as part of its delta-transfer algorithm: the receiver summarizes blocks, the sender rolls over its file to find matching blocks, and only unmatched data needs transfer. The weak rolling checksum is paired with a stronger check before accepting equality.',
        'Backup and deduplication systems use related rolling fingerprints for content-defined chunking. Instead of fixed-size blocks, they cut chunks when the rolling fingerprint matches a boundary predicate, so inserting bytes near the front of a file does not shift every later boundary. The chunk is then identified by a cryptographic digest rather than the rolling hash itself.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use a teaching modulus as a real collision budget. Small moduli collide constantly. Production systems choose larger fingerprints, independent checks, or cryptographic hashes depending on the risk. Also separate boundary detection from identity: a rolling hash may decide where a chunk ends, but a strong content hash should decide whether two chunks are the same.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Karp and Rabin, Efficient Randomized Pattern-Matching Algorithms, DOI summary at https://cris.huji.ac.il/en/publications/efficient-randomized-pattern-matching-algorithms/, MIT 6.006 rolling-hash lecture at https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-9-table-doubling-karp-rabin/, Rabin fingerprinting notes at https://www.xmailserver.org/rabin.pdf, and the rsync technical report at https://www.samba.org/rsync/tech_report/. Study KMP Prefix Function, Aho-Corasick Automaton, Hash Table, Bloom Filter, Suffix Array & LCP, and Merkle Tree next.',
      ],
    },
  ],
};
