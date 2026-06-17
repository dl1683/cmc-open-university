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
      heading: 'Why this exists',
      paragraphs: [
        'Rolling hashes exist because many programs repeatedly compare overlapping windows. String search slides a pattern-length window across text. Delta transfer compares blocks between files. Content-defined chunking watches a moving fingerprint to choose split points.',
        'The shared problem is that adjacent windows are almost the same. If the window length is m, a one-character slide keeps m - 1 characters and changes only the outgoing and incoming symbols. The data structure should exploit that overlap.',
      ],
    },
    {
      heading: 'Naive baseline and wall',
      paragraphs: [
        'The naive matcher compares the pattern with every length-m window. It is exact, but in the worst case it rereads m characters at many positions. A slightly different baseline hashes each window from scratch, but that still costs O(m) work per shift.',
        'The wall is overlap. Consecutive windows share nearly all their bytes, but the naive work treats them as unrelated. The second wall is collisions: a compact fingerprint can reject mismatches cheaply, but it cannot prove equality unless the implementation verifies candidates or accepts a quantified collision risk.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'Keep a fingerprint that can be updated from the previous fingerprint: remove the outgoing high-order symbol, shift the remaining contribution, add the incoming symbol, and reduce modulo a chosen base ring. One integer comparison can reject most windows.',
        'The invariant is that after each slide, the maintained fingerprint equals the value that a full hash recomputation would produce for the current window. Rabin-Karp adds a second invariant for exact search: report a match only after checking the actual characters behind a hash hit.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the "slide and match" view, the graph is the rolling update pipeline. Window identifies the current substring, drop removes the old leading character, shift moves the remaining contribution by one base position, add inserts the new trailing character, and check compares the resulting fingerprint with the pattern hash.',
        'In the "collisions and uses" view, the tables separate filtering from proof. Hash cells show cheap candidates; byte-check or strong-check cells show where correctness is actually decided. The deliberately tiny modulus is there to make collision risk visible rather than theoretical.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A common polynomial hash treats characters as digits in a base. For a window of length m, precompute base^(m - 1) modulo the modulus. To slide, subtract outgoing * base^(m - 1), multiply by base, add the incoming character, and normalize modulo the modulus.',
        'Rabin-Karp stores the pattern hash, scans each text window, and compares hashes first. If the hash differs, the window cannot equal the pattern under the maintained hash. If the hash matches, the exact version compares the bytes or characters before returning the position.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'The rolling update is correct because it performs the same algebra as recomputing the polynomial hash over the new window. The outgoing character contributed the high-order term; after removing it, multiplying by the base moves every remaining character into its new position, and adding the incoming character fills the low-order position.',
        'The search result is exact only if hash hits are verified. Equal strings must have equal hashes, so a hash mismatch is a valid rejection. Unequal strings may have equal hashes, so a hash match is a candidate, not proof. Randomized or double hashing reduces collision probability, but verification is the clean correctness boundary.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The animation searches for "abra" inside "abracadabra" with base 257 and modulus 101. The pattern hash is 8. The window at position 0 is "abra", so it hashes to 8 and is verified as a match.',
        'Sliding one step drops "a", shifts "bra", and adds "c" to form "brac", whose hash is 33. That integer mismatch rejects the window without comparing all four characters. Later, the window at position 7 is again "abra", hashes to 8, and passes the exact character check.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Preprocessing one pattern costs O(m). Scanning a text of length n costs O(n) rolling updates plus the cost of verifying candidates. With rare hash hits, the expected time is close to O(n + m). With many collisions or many true candidates, verification can dominate.',
        'Space is O(1) for one pattern hash and O(k) for k equal-length pattern hashes. Larger moduli, double hashing, or strong secondary checks reduce false candidates but increase arithmetic or memory cost. Small teaching moduli are useful for demos and dangerous as production collision budgets.',
      ],
    },
    {
      heading: 'Choosing parameters',
      paragraphs: [
        'The base should distinguish the alphabet well enough for the data being scanned, and the modulus should be large enough that accidental collisions are rare. Competitive-programming examples often use one or two large primes. Systems that treat equality as a correctness property usually add byte comparison or a strong digest instead of trusting a rolling hash alone.',
        'Normalization matters in real text. If search should be case-insensitive, Unicode-normalized, or token-based, normalize before hashing and before exact verification. Otherwise the hash is faithfully answering the wrong question.',
        'Overflow behavior is also a design choice. Some implementations use modular arithmetic with explicit primes. Others rely on unsigned machine-word overflow for speed. Either can be fine if the collision story and verification boundary are clear.',
      ],
    },
    {
      heading: 'Production pattern',
      paragraphs: [
        'The production pattern is usually weak rolling signal first, strong confirmation second. Rsync uses a cheap rolling checksum to find likely block matches, then a stronger digest to confirm them. Content-defined chunking uses a rolling condition to decide boundaries, then a strong hash to name the chunk.',
        'That split keeps the algorithm honest. The rolling hash saves work because it is cheap to maintain across overlapping windows. The strong check owns correctness because it is designed for identity. Confusing those two roles is how a useful optimization becomes a data-corruption risk.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins when the rolling summary is reused across many windows: many equal-length patterns, rsync-style block matching, backup deduplication, plagiarism prefilters, malware signatures, stream scans, and content-defined chunking.',
        'It is also a useful systems pattern beyond string search: maintain a cheap moving summary, use it to nominate candidates or boundaries, and let a stronger comparison decide identity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For one exact pattern, KMP often gives a cleaner deterministic bound with no collision discussion. For many different pattern lengths, Aho-Corasick, suffix arrays, suffix automata, or indexes may fit better.',
        'Rolling hashes also fail when the application forgets the second stage. Boundary detection and identity are different jobs: a rolling hash can choose where a chunk ends, but a strong content hash or byte comparison should decide whether two chunks are the same.',
        'They also fail under adversarial input if parameters are predictable and collision handling is weak. Public-facing services should treat rolling hashes as filters, not authority, unless the collision risk has been designed and reviewed like any other security-sensitive probability.',
      ],
    },
    {
      heading: 'Implementation traps',
      paragraphs: [
        'The common arithmetic bug is negative modulo after subtracting the outgoing term. Normalize after subtraction before multiplying or adding. The common indexing bug is sliding one character too far and hashing a shorter final window.',
        'The common architecture bug is using the teaching hash as the storage identity. A backup system may use a rolling fingerprint to find candidate boundaries, but the chunk id should be a strong content hash. The cheap rolling part is there to reduce work, not to own truth.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Karp and Rabin, Efficient Randomized Pattern-Matching Algorithms, DOI summary at https://cris.huji.ac.il/en/publications/efficient-randomized-pattern-matching-algorithms/, MIT 6.006 rolling-hash lecture at https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-9-table-doubling-karp-rabin/, Rabin fingerprinting notes at https://www.xmailserver.org/rabin.pdf, and the rsync technical report at https://www.samba.org/rsync/tech_report/. Study KMP Prefix Function, Aho-Corasick Automaton, Hash Table, Bloom Filter, Suffix Array & LCP, and Merkle Tree next.',
      ],
    },
  ],
};
