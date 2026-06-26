// Hash function distribution: why the function matters more than the table.
// Scatter plots show where keys land; histograms show how evenly they spread.

import { plotState, scatterState } from '../core/state.js';

export const topic = {
  id: 'hash-function-comparison',
  title: 'Hash Function Distribution',
  category: 'Concepts',
  summary: 'Watch how different hash functions spread keys across buckets — see why distribution matters more than speed.',
  controls: [
    { id: 'keyCount', label: 'Number of keys', type: 'select', options: ['50', '200', '500'], defaultValue: '50' },
  ],
  run,
};

// --- hash functions ---------------------------------------------------

function moduloHash(key, m) {
  return key % m;
}

const GOLDEN_RATIO = 0.6180339887;

function multiplicationHash(key, m) {
  return Math.floor(m * ((key * GOLDEN_RATIO) % 1));
}

function djb2Hash(str, m) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h % m;
}

// --- helpers -----------------------------------------------------------

function bucketCounts(keys, hashFn, m) {
  const counts = new Array(m).fill(0);
  for (const k of keys) counts[hashFn(k, m)]++;
  return counts;
}

function collisionProbability(n, m) {
  // Birthday-paradox approximation: P(collision) = 1 - exp(-n(n-1)/(2m))
  return 1 - Math.exp(-n * (n - 1) / (2 * m));
}

function parseKeyCount(raw) {
  const n = parseInt(raw, 10);
  if ([50, 200, 500].includes(n)) return n;
  return 50;
}

// --- generator ---------------------------------------------------------

export function* run(input) {
  const N = parseKeyCount(input.keyCount);
  const M = 16; // bucket count for scatter demos

  // Generate keys: a mix of sequential and patterned (multiples of 4)
  const keys = Array.from({ length: N }, (_, i) => i * 3 + 7);

  // --- Frame 1: Modulo hash scatter ---
  const modPoints = keys.map((k, i) => ({
    id: `mod-${i}`,
    x: k,
    y: moduloHash(k, M) + (Math.random() * 0.4 - 0.2), // jitter to show overlap
    clusterId: moduloHash(k, M),
  }));

  yield {
    state: scatterState({
      axes: {
        x: { label: 'key value' },
        y: { label: 'bucket (key % 16)' },
      },
      points: modPoints,
    }),
    highlight: { active: ['modulo'] },
    explanation: `Naive modulo hash: bucket = key % ${M}. With ${N} keys spaced by 3, only a few of the ${M} buckets receive keys. Notice the horizontal bands — keys with the same remainder cluster into the same bucket, leaving others empty. This is primary clustering: patterns in the input become patterns in the output.`,
    invariant: `${N} keys mapped to ${M} buckets using key % ${M}.`,
  };

  // --- Frame 2: Multiplication hash scatter ---
  const mulPoints = keys.map((k, i) => ({
    id: `mul-${i}`,
    x: k,
    y: multiplicationHash(k, M) + (Math.random() * 0.4 - 0.2),
    clusterId: multiplicationHash(k, M),
  }));

  yield {
    state: scatterState({
      axes: {
        x: { label: 'key value' },
        y: { label: 'bucket (multiplication method)' },
      },
      points: mulPoints,
    }),
    highlight: { active: ['multiplication'] },
    explanation: `Multiplication method: bucket = floor(${M} * frac(key * ${GOLDEN_RATIO})). The golden ratio's irrationality scrambles the bit pattern. Keys that were neighbors in modulo hash land in different buckets here. The scatter fills the vertical range much more uniformly — every bucket gets roughly its fair share.`,
    invariant: `Same ${N} keys, same ${M} buckets, but the multiplication method uses Knuth's golden-ratio constant A = 0.6180339887.`,
  };

  // --- Frame 3: Modulo bucket histogram ---
  const modCounts = bucketCounts(keys, moduloHash, M);
  const modHistSeries = [{
    id: 'mod-hist',
    label: 'modulo hash',
    points: modCounts.map((c, b) => ({ x: b, y: c })),
  }];

  yield {
    state: plotState({
      axes: {
        x: { label: 'bucket number' },
        y: { label: 'keys in bucket' },
      },
      series: modHistSeries,
    }),
    highlight: { active: ['mod-hist'] },
    explanation: `Bucket load histogram for modulo hash. The tall bars are overloaded buckets — every key landing there must probe or chain past the others. The zero-height bars are wasted space. A perfect hash function would make every bar the same height (${(N / M).toFixed(1)} keys per bucket). Modulo hash is far from that when keys have arithmetic patterns.`,
    invariant: `Ideal load: ${(N / M).toFixed(1)} keys/bucket. Worst bucket: ${Math.max(...modCounts)} keys. Empty buckets: ${modCounts.filter((c) => c === 0).length}.`,
  };

  // --- Frame 4: Multiplication bucket histogram ---
  const mulCounts = bucketCounts(keys, multiplicationHash, M);
  const mulHistSeries = [{
    id: 'mul-hist',
    label: 'multiplication hash',
    points: mulCounts.map((c, b) => ({ x: b, y: c })),
  }];

  yield {
    state: plotState({
      axes: {
        x: { label: 'bucket number' },
        y: { label: 'keys in bucket' },
      },
      series: mulHistSeries,
    }),
    highlight: { active: ['mul-hist'] },
    explanation: `Same histogram, multiplication method. The bars are far more even. The worst bucket has fewer keys; the best has more. This is what good distribution looks like: the hash function destroys the input pattern and spreads keys uniformly. The cost of a lookup depends on the tallest bar, not the average — so flattening the histogram is the whole game.`,
    invariant: `Ideal load: ${(N / M).toFixed(1)} keys/bucket. Worst bucket: ${Math.max(...mulCounts)} keys. Empty buckets: ${mulCounts.filter((c) => c === 0).length}.`,
  };

  // --- Frame 5: Collision probability curve ---
  const loadFactors = Array.from({ length: 21 }, (_, i) => i * 0.05);
  const collisionSeries = [{
    id: 'collision-curve',
    label: 'P(collision)',
    points: loadFactors.map((lf) => {
      const n = Math.round(lf * M);
      return { x: lf, y: collisionProbability(n, M) };
    }),
  }];

  yield {
    state: plotState({
      axes: {
        x: { label: 'load factor (n / m)' },
        y: { label: 'P(at least one collision)' },
      },
      series: collisionSeries,
    }),
    highlight: { active: ['collision-curve'] },
    explanation: `Collision probability versus load factor for ${M} buckets, assuming a perfect hash (uniform random). Even at load factor 0.5, the probability of at least one collision is already high. This is the birthday paradox applied to hashing: collisions arrive much sooner than intuition suggests. A hash table at 50% full is already managing collisions constantly.`,
    invariant: `At load factor 0.5: P(collision) = ${(collisionProbability(Math.round(0.5 * M), M) * 100).toFixed(1)}%. At load factor 1.0: P(collision) = ${(collisionProbability(M, M) * 100).toFixed(1)}%.`,
  };

  // --- Frame 6: Birthday paradox — three table sizes ---
  const tableSizes = [16, 64, 256];
  const maxInsert = 80;
  const birthdaySeries = tableSizes.map((sz) => ({
    id: `birthday-${sz}`,
    label: `m = ${sz}`,
    points: Array.from({ length: maxInsert + 1 }, (_, n) => ({
      x: n,
      y: collisionProbability(n, sz),
    })),
  }));

  yield {
    state: plotState({
      axes: {
        x: { label: 'items inserted' },
        y: { label: 'P(at least one collision)' },
      },
      series: birthdaySeries,
    }),
    highlight: { active: ['birthday-16', 'birthday-64', 'birthday-256'] },
    explanation: `The birthday paradox at three table sizes. With m = 16 buckets, inserting just 6 items gives a >50% chance of collision. With m = 64, it takes about 10. With m = 256, about 20. The curve always rises faster than you expect — collisions grow with the square of the item count (each new item can collide with ALL previous ones), so doubling items roughly quadruples collision probability.`,
    invariant: `50% collision threshold: m=16 at ~6 items, m=64 at ~10 items, m=256 at ~19 items.`,
  };

  // --- Frame 7: Sequential keys — modulo vs multiplication scatter ---
  const seqKeys = Array.from({ length: Math.min(N, 50) }, (_, i) => i);
  const seqModPoints = seqKeys.map((k, i) => ({
    id: `seq-mod-${i}`,
    x: k,
    y: moduloHash(k, M),
    clusterId: 0,
  }));
  const seqMulPoints = seqKeys.map((k, i) => ({
    id: `seq-mul-${i}`,
    x: k,
    y: multiplicationHash(k, M) + M + 2, // offset upward to separate the two strips
    clusterId: 1,
  }));

  yield {
    state: scatterState({
      axes: {
        x: { label: 'key (sequential 0, 1, 2, ...)' },
        y: { label: 'bucket (bottom: modulo, top: multiplication)' },
      },
      points: [...seqModPoints, ...seqMulPoints],
    }),
    highlight: { active: ['sequential'] },
    explanation: `Sequential keys (0, 1, 2, ...) are the one case where modulo hash shines: each key lands in the next bucket in perfect round-robin order (bottom strip). The multiplication method (top strip) scrambles them — still uniform overall, but without the neat pattern. This is why modulo hash survives in practice for auto-increment IDs. The danger is non-sequential patterns: any stride that shares a factor with m causes clustering.`,
    invariant: `${seqKeys.length} sequential keys, ${M} buckets. Modulo: perfect spread. Multiplication: scrambled but uniform.`,
  };

  // --- Frame 8: DJB2 on string keys ---
  const sampleStrings = [
    'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
    'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
    'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
  ];
  const djb2Counts = new Array(M).fill(0);
  for (const s of sampleStrings) djb2Counts[djb2Hash(s, M)]++;
  const djb2Series = [
    {
      id: 'djb2-hist',
      label: 'DJB2 hash',
      points: djb2Counts.map((c, b) => ({ x: b, y: c })),
    },
    {
      id: 'ideal',
      label: 'ideal uniform',
      points: Array.from({ length: M }, (_, b) => ({ x: b, y: sampleStrings.length / M })),
    },
  ];

  yield {
    state: plotState({
      axes: {
        x: { label: 'bucket number' },
        y: { label: 'keys in bucket' },
      },
      series: djb2Series,
    }),
    highlight: { active: ['djb2-hist', 'ideal'] },
    explanation: `Summary: DJB2 string hash on ${sampleStrings.length} NATO phonetic words, compared against the ideal uniform line (${(sampleStrings.length / M).toFixed(1)} keys/bucket). A good hash function makes the histogram hug the ideal line. The three things that matter: (1) uniformity — every bucket gets its fair share, (2) avalanche — similar keys land in different buckets, (3) speed — non-crypto hashes like DJB2, FNV, MurmurHash, and xxHash compute in nanoseconds. Distribution quality determines whether your O(1) hash table stays O(1) or degrades to O(n).`,
    invariant: `DJB2 worst bucket: ${Math.max(...djb2Counts)} keys. Empty buckets: ${djb2Counts.filter((c) => c === 0).length}/${M}. Ideal: ${(sampleStrings.length / M).toFixed(1)} keys/bucket.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each dot is one key and each bucket is an array slot in a hash table. A collision happens when two keys choose the same bucket. The histogram shows whether lookup work is spread evenly or concentrated in one slow bucket.',
        {type: 'callout', text: 'A hash function protects O(1) lookup only when it erases input patterns before the bucket index is chosen.'},
        {type: 'image', src: './assets/gifs/hash-function-comparison.gif', alt: 'Animated walkthrough of the hash function comparison visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A hash table is fast only if keys spread across buckets. Real keys have structure: IDs, timestamps, paths, addresses, and names are not random. Hash functions exist to turn structured inputs into bucket choices that behave close to uniform.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg', alt: 'Hash table with chaining showing several keys mapped into buckets', caption: 'The table can only stay fast if the hash function spreads keys across buckets instead of feeding long collision chains. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_5_0_1_1_1_1_1_LL.svg.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious hash for integers is key % m, where m is the bucket count. It is simple and works well for consecutive IDs when m fits the pattern. Many first implementations start here because it is correct on small examples.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Modulo does not mix information. With m = 16, keys 0, 16, 32, and 48 all land in bucket 0. Patterned keys turn expected O(1) lookup into long chains or probe clusters.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A good hash destroys input patterns before bucket reduction. Avalanche means a small input change flips many output bits. Keyed hashing adds a hidden seed so an attacker cannot predict collisions in advance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Fast hashes mix bytes with xor, shifts, rotations, and multiplication by constants. Universal hashing picks a random function from a family, such as ((a*k + b) mod p) mod m. Cryptographic hashes spend more work to make collision-finding infeasible.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Cryptographic_Hash_Function.svg', alt: 'Several text inputs passing through a cryptographic hash function to produce different digests', caption: 'The avalanche idea is visible here: small input changes should produce very different digest bits before bucket reduction happens. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cryptographic_Hash_Function.svg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The table needs the largest bucket to stay near the average load. Uniform hashing gives expected lookup O(1 + n/m) with separate chaining. Universal hashing guarantees any two fixed keys collide with probability at most 1/m over the random choice of hash function.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Hashing a fixed integer is O(1), and hashing a string of length L is O(L) because every byte may matter. A cheap weak hash saves arithmetic but can create expensive bucket scans. A stronger keyed hash costs more per key but protects the table against chosen-collision input.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel i7 processor die photograph', caption: 'Hash speed matters because every lookup pays the mixing cost before memory access. The right function balances arithmetic, cache behavior, and adversarial resistance. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Language maps and sets rely on hash quality for their normal O(1) behavior. Bloom filters, consistent hashing, deduplication, checksums, and load balancing also depend on uniform spread. In each case, a biased hash creates hot buckets, false positives, or hot servers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Hashing cannot remove collisions; it only spreads them. Hash tables still need chaining, probing, resizing, or another collision strategy. Hashing also destroys order, so it is the wrong primary structure for range queries, prefix scans, and nearest-neighbor search.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Hash keys 0, 3, 6, 9, 12, 15, 18, 21, 24, and 27 into 6 buckets with key % 6. The remainders alternate between 0 and 3, so two buckets get five keys each and four buckets stay empty. Lookup in those buckets is no longer constant-looking.',
        'Use 8 buckets instead. The same keys map to 0, 3, 6, 1, 4, 7, 2, 5, 0, and 3. The largest bucket has 2 keys because stride 3 and bucket count 8 are coprime, showing why modulo depends on luck with input patterns.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Knuth on division and multiplication hashing, Carter and Wegman on universal hashing, and Aumasson and Bernstein on SipHash. Study hash tables, Bloom filters, consistent hashing, rolling hash, cuckoo hashing, and Robin Hood hashing next.',
      ],
    },
  ],
};
