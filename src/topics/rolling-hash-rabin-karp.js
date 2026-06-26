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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation slides a fixed-length window over a text. The window hash is a number that summarizes the current substring, and the pattern hash is the number for the string we want to find.',
        {type: 'callout', text: 'Rabin-Karp is exact because hashing only rejects windows; every accepted candidate still passes a byte comparison.'},
        'Active steps show the rolling update: remove the outgoing character, shift the remaining contribution, and add the incoming character. Found means the hash matched and the final character check also matched.',
        'Read hash matches as candidates, not proof. The animation deliberately shows collisions so the verification step is visible instead of hidden inside the word match.',
        {type: 'image', src: './assets/gifs/rolling-hash-rabin-karp.gif', alt: 'Animated walkthrough of the rolling hash rabin karp visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'String search asks where a pattern of length m appears inside a text of length n. The task appears in editors, search engines, plagiarism detection, genome scans, file synchronization, and intrusion detection.',
        'Rabin-Karp exists because many windows can be rejected by one integer comparison. If two strings have different hash values, they cannot be equal under that hash computation, so the algorithm skips the m-character comparison for most positions.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is brute force. Align the pattern at each position and compare characters from left to right until a mismatch or a full match appears.',
        'For one short pattern in a short text, this is fine. The code is simple, and many mismatches happen at the first character.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when many alignments share long prefixes with the pattern. A pattern of length 1,000 searched across 1,000,000 positions can do close to 1,000 comparisons at many positions.',
        'Hashing each window from scratch does not solve the wall because computing a length-m hash at every position also costs O(nm). The missing ingredient is an O(1) update from one window to the next.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use a polynomial rolling hash. Treat characters as coefficients in a base-d number, reduce modulo a prime q, and update the number when the window shifts by one character.',
        'The hash is a filter for equality. Different hash means definitely different strings, while equal hash means maybe equal and must be verified byte by byte.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a length-m window c0 through c_(m-1), compute c0*d^(m-1) + c1*d^(m-2) + ... + c_(m-1) modulo q. Precompute highPower = d^(m-1) mod q so the outgoing character can be removed quickly.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing rows and columns combining', caption: 'The rolling hash is a compact numeric layout: character coefficients combine with powers of the base the way rows combine with columns. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        'To roll from position i to i + 1, subtract the outgoing character times highPower, multiply by d, add the incoming character, and reduce modulo q. If the new hash equals the pattern hash, compare the actual strings before reporting a match.',
        'Modulo arithmetic keeps the number bounded. A prime modulus makes accidental collisions less frequent for ordinary inputs, while randomized choices make adversarial collisions harder.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The rolling update is correct because it preserves the polynomial value for the new window. Removing the highest-power term, shifting powers by multiplying by d, and adding the new low-power term gives the same value as recomputing from scratch.',
        'The search is exact because it never reports a hash match alone. Hash mismatch safely rejects, and hash match only triggers verification; the verified character comparison is the final authority.',
        'Collisions only affect cost. A bad collision causes extra verification work, but it cannot create a false reported match when verification is present.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Precomputing the pattern hash and first window hash costs O(m). Scanning n - m + 1 windows costs O(n) rolling work because each shift does constant arithmetic.',
        'Verification costs O(m) per candidate. With a large prime modulus and ordinary input, candidates are rare, so expected time is O(n + m); with adversarial collisions, worst-case time is O(nm).',
        'Space is O(1) for one pattern. For k equal-length patterns, store k pattern hashes in a set and use the same rolling scan, so memory becomes O(k) and the scan still moves once through the text.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Rabin-Karp is useful when many patterns of the same length share one scan. A plagiarism detector can hash every m-word window and compare against a large set of known fingerprints.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram showing data entering one end and leaving the other', caption: 'A sliding window has queue-like movement: one item leaves, one enters, and the maintained summary updates from that boundary change. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
        'File synchronization systems use rolling checksums to nominate matching blocks before confirming with stronger hashes. Content-defined chunking uses rolling hashes to choose boundaries that survive insertions and deletions in nearby bytes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For one pattern, KMP gives O(n + m) worst-case time without collision risk. Rabin-Karp is usually chosen for hashing flexibility or multi-pattern scanning, not because it dominates every single-pattern case.',
        'Predictable small moduli invite collisions. Public-facing systems should randomize hash parameters or treat rolling hashes only as candidate generators backed by strong verification.',
        'Skipping verification is the dangerous bug. A rolling hash is not an identity function, and hash equality can corrupt deduplication, search, or synchronization results if treated as string equality.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Search for pattern abc in text xabcyabc with base d = 256 and modulus q = 101. The pattern hash is (97*256^2 + 98*256 + 99) mod 101 = 90, and highPower is 256^2 mod 101 = 88.',
        'The first window xab hashes to 39, so it is rejected by one integer comparison. To roll forward, subtract 120*88, normalize modulo 101, multiply by 256, add 99, and get 90 for the window abc.',
        'Because 90 equals the pattern hash, the algorithm compares bytes and confirms a match at position 1. Later the window at position 5 also hashes to 90 and verifies as abc, so the matches are positions 1 and 5.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Karp and Rabin, Efficient randomized pattern-matching algorithms, 1987; Knuth, Morris, and Pratt, Fast pattern matching in strings, 1977; rsync technical report for rolling-checksum block matching.',
        'Study next by contrast. Read KMP for deterministic single-pattern matching, Aho-Corasick for many variable-length patterns, Hash Table for collision behavior, Bloom Filter for hash-based filtering, and Content-Defined Chunking for rolling hashes in storage systems.',
      ],
    },
  ],
};
