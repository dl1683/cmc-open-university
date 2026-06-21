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
        'The "slide and match" view shows the rolling hash pipeline at each window position in the text. Active nodes (drop, shift, add) mark the three O(1) operations that update the hash as the window moves one character right. When the check node lights up as found, the window hash matched the pattern hash and the full character-by-character verification confirmed a real match.',
        {type: 'callout', text: 'Rabin-Karp is exact because hashing only rejects windows; every accepted candidate still passes a byte comparison.'},
        'The matrix view below the pipeline shows concrete hash values for each window. Windows highlighted as compare were rejected by a single integer comparison -- no characters examined. Windows highlighted as found passed both the hash check and the byte verification.',
        'In the "collisions and uses" view, a deliberately tiny modulus forces different windows to produce the same hash. The verdict column shows the byte check catching every collision. Watch how many windows are rejected by one integer comparison versus how many require the full m-character scan. That ratio is the entire point of the algorithm.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'String search -- find every occurrence of a short pattern P (length m) inside a long text T (length n) -- appears in document search, genome scanning, network intrusion detection, and plagiarism checking. The inputs can be enormous: a genome is billions of characters, and a plagiarism detector may check thousands of patterns at once.',
        'Rabin and Karp published their algorithm in 1987 with a specific insight: hashing can turn m character comparisons into one integer comparison. If two strings hash to different values, they cannot be equal, so a single subtraction rejects a window that brute force would examine character by character. The trick is making the hash update cost O(1) instead of O(m) as the window slides.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The brute-force matcher tries every starting position i in T and compares P[0..m-1] against T[i..i+m-1] character by character. If all m match, report i. This is correct and easy to implement.',
        'It works fine on friendly inputs. The worst case is the problem: P = "aab" in T = "aaaaaab" forces nearly m comparisons at every position before the mismatch appears at the last character. With n - m + 1 starting positions, worst-case work is O(nm).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Consecutive windows overlap by m - 1 characters, but brute force treats each window as independent and rereads almost everything. All the comparison work from the previous position is thrown away.',
        'Hashing each window seems like a fix: compare one hash value instead of m characters. But computing a fresh hash over m characters at every position still costs O(m) per window -- O(nm) total. No improvement.',
        'The wall: adjacent windows share almost all their data, yet a naive hash recomputes from scratch every time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat a length-m string as a polynomial in a chosen base d. "abc" with d = 256 becomes 97 * 256^2 + 98 * 256 + 99. When the window slides one character right, the outgoing character occupies the highest-order term. Remove it, multiply the remainder by d to shift every coefficient up one position, and add the incoming character in the ones place. Three arithmetic operations, regardless of m.',
        `This is a rolling hash: each window fingerprint is derived from the previous window fingerprint in O(1). A modulus q keeps numbers small. Total hashing for all n - m + 1 windows: O(n). Hashing the pattern once: O(m).`,
        'Two invariants hold after every slide. First, the maintained hash equals what a full recomputation would produce. Second, a hash match is only a candidate, never proof -- the algorithm always verifies candidates by comparing actual characters, because different strings can hash to the same value under modular arithmetic.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Hash the pattern P to get h_P. Hash the first window T[0..m-1] to get h_w. Precompute highPower = d^(m-1) mod q so the outgoing character contribution can be removed in one multiply.`,
        'For each position i from 1 to n - m: (1) subtract T[i-1] * highPower from h_w to remove the outgoing character; (2) multiply h_w by d to shift remaining characters up; (3) add T[i+m-1] for the incoming character; (4) reduce mod q. If h_w equals h_P, compare T[i..i+m-1] against P character by character. Report i on match.',
        'The polynomial structure is what makes the O(1) update exact. Each character contributes d^k for its position k in the window. Sliding right decrements every position by one -- which is precisely what multiplying by d does after removing the old high-order term.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing rows and columns combining', caption: 'The rolling hash is a compact numeric layout: character coefficients combine with powers of the base the way rows combine with columns. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        'The hash formula: hash("c_0 c_1 ... c_{m-1}") = (c_0 * d^(m-1) + c_1 * d^(m-2) + ... + c_{m-1} * d^0) mod q. Rolling from position i to i+1: h_new = (d * (h_old - c_i * d^(m-1)) + c_{i+m}) mod q.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties. First, the rolling update preserves the polynomial: subtracting the outgoing term, multiplying by d, and adding the incoming term produces the same value as hashing the new window from scratch. Expand the polynomial to verify this algebraically.',
        'Second, equal strings always produce equal hashes (the hash is a deterministic function). A hash mismatch is therefore a sound rejection: the window cannot match. A hash match is not proof -- collisions exist under modular arithmetic -- so the algorithm verifies candidates character by character. Cheap rejection plus verified acceptance makes the result exact, not probabilistic.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Preprocessing: O(m) to hash the pattern and compute highPower. Scanning: O(n) for n - m + 1 rolling updates at O(1) each. Verification: O(m) per candidate. Expected total: O(n + m), because a good prime q makes collisions rare -- each window has a 1/q chance of a false match.',
        'Worst case: O(nm) when every window collides. This requires adversarial input or a tiny modulus. With q = 10^9 + 7 and n = 10^6, the expected number of false positives across all windows is about (n - m + 1)/q, roughly 0.001.',
        'Space: O(1) beyond the input for single-pattern search. For k equal-length patterns, store all k pattern hashes in a set: O(k) space, O(1) expected lookup per window position.',
        'Scaling: doubling n doubles scan time. Doubling m does not change scan cost but doubles each verification. In practice the linear scan dominates; verifications are rare events with a good modulus.',
        'Multi-pattern extension: given k patterns of the same length m, compute all k hashes upfront, store them in a hash set, and slide one window across the text. Expected time: O(n + km). Brute force would need O(knm). Rabin-Karp collapses the k factor out of the scan because all patterns share the same rolling computation.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Plagiarism detection: hash every m-word window of a submitted document and check against a database of known fingerprints. The rolling hash makes scanning cheap; the hash set lookup handles thousands of reference patterns in one pass.',
        'Rsync delta transfer: rsync computes a cheap rolling checksum over fixed-size blocks to find matching regions between a local and remote file, then confirms matches with a strong MD5 digest. The rolling hash identifies unchanged blocks without transferring them, cutting network traffic.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram showing data entering one end and leaving the other', caption: 'A sliding window has queue-like movement: one item leaves, one enters, and the maintained summary updates from that boundary change. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
        `Git pack files: git uses a rolling hash similar to the Adler32-style checksum used by rsync to find matching blocks between file versions for delta compression. The rolling hash nominates candidates; a stronger SHA comparison confirms them.`,
        'Content-defined chunking in backup and deduplication: a rolling hash over a sliding window triggers a chunk boundary when hash mod p equals 0. Variable-size chunks adapt to insertions and deletions, so identical content produces identical chunks even when shifted in the file. The rolling hash picks boundaries; a strong content hash (SHA-256, BLAKE3) provides chunk identity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For single-pattern search, KMP (Knuth-Morris-Pratt) gives O(n + m) worst case with no collision risk and no modulus to tune. If you only need one pattern in trusted input, KMP is the simpler, more predictable choice.',
        'For large sets of patterns with shared prefixes, Aho-Corasick builds a finite automaton and guarantees O(n + total_pattern_length + matches) worst case. It handles variable-length patterns naturally, where Rabin-Karp needs a separate rolling hash per pattern length.',
        'Under adversarial input with a predictable modulus, an attacker can craft strings that force every window to collide, degrading to O(nm). Public-facing services should randomize the modulus or treat Rabin-Karp as a filter backed by verified comparison, never as an authority on equality.',
        'The most dangerous failure mode: skipping the verification step. A hash match is a candidate, not proof. Systems that treat rolling-hash equality as string equality corrupt data -- this is how deduplication bugs happen.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Search for P = "abc" (m = 3) in T = "xabcyabc" (n = 8) with base d = 256 and modulus q = 101.',
        'Pattern hash: h_P = (97 * 256^2 + 98 * 256 + 99) mod 101. That is 6,382,179 mod 101 = 90. Precompute highPower = 256^2 mod 101 = 65,536 mod 101 = 88.',
        'Position 0, window "xab": h = (120 * 256^2 + 97 * 256 + 98) mod 101 = 39. Since 39 != 90, reject. One integer comparison, zero character work.',
        'Position 1, window "abc": roll the hash. Remove outgoing "x" (code 120): h = (39 - 120 * 88) mod 101 = (39 - 10,560) mod 101. The result is negative, so add multiples of 101 to normalize: -10,521 mod 101 = 84. Shift and add incoming "c" (code 99): h = (84 * 256 + 99) mod 101 = 21,603 mod 101 = 90. Hash matches h_P. Verify: T[1..3] = "abc" = P. Match at position 1.',
        'Position 2 "bcy": hash 28, reject. Position 3, window "cya": hash 62, reject. Position 4, window "yab": hash 71, reject. Each rejection costs one integer comparison.',
        'Position 5, window "abc": rolling hash produces 90 again. Verify: T[5..7] = "abc" = P. Match at position 5.',
        'Total: 6 rolling hash updates (O(1) each), 2 full verifications (O(m) each), 4 instant rejections. Expected time: O(n + m). With q = 101, each non-matching window has about a 1% chance of a false positive. With q = 10^9 + 7, that drops to roughly one in a billion per window.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Karp, R. M. and Rabin, M. O., "Efficient Randomized Pattern-Matching Algorithms," IBM Journal of Research and Development, 1987. Knuth, D. E., Morris, J. H., and Pratt, V. R., "Fast Pattern Matching in Strings," SIAM Journal on Computing, 1977. The rsync technical report, samba.org/rsync/tech_report/.',
        'Deterministic single-pattern alternative: KMP Prefix Function -- guaranteed O(n + m) worst case, no collision risk. Multi-pattern automaton: Aho-Corasick -- builds a trie with failure links, handles variable-length patterns in one scan. Hashing foundations: Hash Table -- the same polynomial hashing and modular arithmetic in a different setting. Right-to-left skip heuristic: Boyer-Moore -- often faster in practice for single patterns by skipping characters based on mismatch information. Probabilistic membership: Bloom Filter -- trades exactness for space using hash-based membership testing.',
      ],
    },
  ],
};
