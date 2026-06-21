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
        'Scatter frames: each dot is one key. The horizontal axis is the raw key value; the vertical axis is the bucket the hash function assigns it to. Dots that stack vertically at the same y-coordinate share a bucket — those keys will collide. A good hash spreads dots evenly across the y-range.',
        {type: 'callout', text: 'A hash function protects O(1) lookup only when it erases input patterns before the bucket index is chosen.'},
        'Histogram frames: each bar is one bucket. Height is the number of keys in that bucket. A flat histogram means uniform distribution — ideal. Tall spikes mean overloaded buckets and degraded lookup time.',
        'The invariant line below each frame reports the worst-bucket count, empty-bucket count, and ideal load, so you can compare distribution quality numerically rather than guessing from the chart.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A hash table promises O(1) average lookup. That promise rests entirely on one assumption: the hash function distributes keys uniformly across buckets. If it does not, some buckets overflow into long chains or probe sequences, and the O(1) promise degrades toward O(n). The table structure is just an array — the hash function is the algorithm.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg', alt: 'Hash table with chaining showing several keys mapped into buckets', caption: 'The table can only stay fast if the hash function spreads keys across buckets instead of feeding long collision chains. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_5_0_1_1_1_1_1_LL.svg.'},
        'This is not an academic concern. In 2011, researchers demonstrated hash-flooding denial-of-service attacks against web frameworks (PHP, Java, Python, Ruby) by crafting inputs that collided under the frameworks\' default hash functions. Every request that should have been O(1) became O(n), taking down servers with modest traffic. The fix was switching to randomized hash functions (SipHash). The vulnerability was not in the table; it was in the hash function.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use key % table_size. This is the division method: divide the key by the number of buckets and take the remainder. It is the simplest possible hash function, requires no constants or configuration, and works correctly for any integer key.',
        'For auto-increment database IDs (0, 1, 2, 3, ...) it is actually perfect: keys round-robin through the buckets in order, every bucket gets exactly its fair share, and there is zero waste. This is why modulo hashing persists in practice despite its weaknesses.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Modulo hashing breaks on patterned input. If keys are multiples of the table size (or share a common factor with it), they all land in the same bucket. Keys 0, 16, 32, 48 all hash to bucket 0 when m = 16. Keys 0, 4, 8, 12 all hash to buckets 0, 4, 8, 12 when m = 16, leaving 12 buckets empty.',
        'This is called primary clustering: the hash function preserves the arithmetic structure of the input instead of destroying it. Any regularity in the keys — stride patterns, aligned addresses, encoded timestamps with low-entropy suffixes — becomes a regularity in the bucket assignments. The table works perfectly on random input and fails on the structured input that real systems produce.',
        'Choosing a prime table size helps (it shares no factors with common strides) but does not solve the fundamental problem: modulo hashing cannot scramble bit patterns. It can only take remainders.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The multiplication method (Knuth, TAOCP Vol 3, Section 6.4): pick a constant A between 0 and 1, compute key * A, take the fractional part, and multiply by the table size. The formula is h(key) = floor(m * frac(key * A)). Knuth recommends A = (sqrt(5) - 1) / 2 = 0.6180339887, the golden ratio conjugate, because its continued-fraction expansion has the slowest possible convergence, which maximizes the spread of consecutive keys.',
        'Universal hashing (Carter and Wegman, 1979): instead of picking one hash function, pick a random function from a family at table creation time. A family H is universal if for any two distinct keys x and y, the probability that h(x) = h(y) is at most 1/m when h is chosen uniformly from H. A simple universal family for integer keys: h(k) = ((a*k + b) mod p) mod m, where p is a prime larger than the key space and a, b are random with a != 0. Because the adversary does not know which function was chosen, they cannot craft colliding inputs.',
        'Cryptographic hashes (SHA-256, BLAKE3) guarantee that finding collisions is computationally infeasible. But they are 10-100x slower than non-cryptographic hashes because they must resist intentional attack, not just accidental patterns. SipHash (Aumasson and Bernstein, 2012) splits the difference: it is keyed (randomized like universal hashing), fast enough for hash tables, and resistant to hash-flooding attacks. Python, Rust, and Ruby all use SipHash for their built-in dictionaries.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Cryptographic_Hash_Function.svg', alt: 'Several text inputs passing through a cryptographic hash function to produce different digests', caption: 'The avalanche idea is visible here: small input changes should produce very different digest bits before bucket reduction happens. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cryptographic_Hash_Function.svg.'},
        'Non-cryptographic hashes optimized for speed: FNV-1a (simple byte-mixing loop), MurmurHash3 (fast mixing with good avalanche), xxHash (SIMD-friendly, extremely fast on long inputs), wyhash (minimal code, excellent distribution). These all achieve near-uniform distribution on real-world data at throughputs of gigabytes per second.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The multiplication method works because irrational numbers cannot produce repeating fractional parts. Multiplying successive integers by the golden ratio and taking the fractional part produces a low-discrepancy sequence — the same mathematical property that makes the golden angle arrange sunflower seeds efficiently. Each new value falls into the largest existing gap, so the sequence fills the interval [0, 1) as uniformly as possible.',
        'Universal hashing works because randomization breaks the adversary. Without knowing a and b, the attacker cannot predict which keys will collide. The expected number of collisions for any fixed input is at most n/m, which is the best possible for any deterministic hash function on worst-case input. The guarantee is probabilistic over the random choice of hash function, not over the distribution of keys.',
        'The avalanche property is what separates good hashes from bad ones: flipping one bit in the input should flip roughly half the bits in the output. Modulo hash has zero avalanche — changing the high bits of the key does not change the low bits of the output. Multiplication hash has partial avalanche. MurmurHash and xxHash have near-perfect avalanche because they mix bits with shifts, multiplies, and xors designed to propagate single-bit changes across the entire word.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'All hash functions discussed here run in O(1) per key (or O(L) for a string of length L — you must read every byte). The difference is the constant factor. Modulo hash: one integer division. Multiplication hash: one multiply, one floor. FNV-1a: one multiply and one xor per byte. MurmurHash3: a few multiplies and shifts per 4-byte block. SipHash: ~15 arithmetic operations per 8-byte block. SHA-256: ~64 rounds of mixing per 64-byte block.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel i7 processor die photograph', caption: 'Hash speed matters because every lookup pays the mixing cost before memory access. The right function balances arithmetic, cache behavior, and adversarial resistance. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:KL_Intel_i7_die.jpg.'},
        'On modern hardware (2024 benchmarks): xxHash processes ~30 GB/s. MurmurHash3: ~8 GB/s. SipHash: ~2 GB/s. SHA-256: ~0.5 GB/s. For a hash table doing millions of lookups per second, the 15x difference between xxHash and SipHash is real — but SipHash is still fast enough that the bottleneck is usually memory access, not hash computation.',
        'Memory cost is zero beyond the hash value itself. The hash function is stateless (or stores a single seed). The table pays for buckets and collision resolution; the hash function does not add to that.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Hash tables are the primary consumer. Every programming language\'s built-in dictionary, set, or map depends on a good hash function. Python dicts, Java HashMaps, C++ unordered_maps, JavaScript objects (V8 uses a variant of MurmurHash internally) — all rely on hash quality for their O(1) guarantee.',
        'Bloom filters and their variants (cuckoo, quotient, xor filters) use hash functions to map elements to bit positions. Poor distribution means more false positives because bits cluster instead of spreading.',
        'Checksums and integrity verification: CRC32, xxHash, and BLAKE3 detect accidental corruption. Content-addressable storage (git, IPFS) uses cryptographic hashes as object identifiers. Deduplication systems hash file blocks to find duplicates without byte-by-byte comparison.',
        'Load balancing: consistent hashing (Karger et al., 1997) assigns requests to servers by hashing the request key. Uniform hash distribution means uniform server load. A biased hash function creates hot spots.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Hash flooding attacks exploit deterministic hash functions. An attacker who knows the hash function can craft keys that all collide, turning O(1) operations into O(n). This brought down web servers in the 2011 HashDoS attacks. The defense: use a keyed hash (SipHash) with a random seed chosen at startup. The attacker cannot predict collisions without the seed.',
        'Collision resolution is still necessary regardless of hash quality. Even a perfect random hash produces collisions via the birthday paradox. With n keys in m buckets, the expected number of collisions is approximately n^2 / (2m). The hash function controls how well collisions spread; it cannot eliminate them.',
        'Hash table resizing is expensive. When the load factor exceeds a threshold (typically 0.7-0.75), the table doubles in size and rehashes every key. This O(n) cost is amortized over future insertions but creates latency spikes. Hash function speed matters here because every key is re-hashed during resize.',
        'Non-comparable keys: hash tables cannot support range queries, ordered iteration, or nearest-neighbor lookups. For those, you need trees or sorted structures. The hash function destroys ordering by design — the same property that gives uniform distribution prevents any notion of "close keys go to close buckets."',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Hash 10 keys (0, 3, 6, 9, 12, 15, 18, 21, 24, 27) into m = 8 buckets. Modulo: 0%8=0, 3%8=3, 6%8=6, 9%8=1, 12%8=4, 15%8=7, 18%8=2, 21%8=5, 24%8=0, 27%8=3. Bucket 0 has 2 keys, bucket 3 has 2 keys, all others have 1. Two collisions — not terrible because 3 and 8 are coprime.',
        'Same keys, modulo m = 6: 0%6=0, 3%6=3, 6%6=0, 9%6=3, 12%6=0, 15%6=3, 18%6=0, 21%6=3, 24%6=0, 27%6=3. All keys land in just 2 of 6 buckets (0 and 3). Five keys per bucket — this is O(n/2) per lookup, not O(1). The stride 3 and the table size 6 share factor 3, which kills distribution.',
        'Multiplication method with A = 0.618, m = 8: h(0) = 0, h(3) = floor(8 * frac(1.854)) = floor(8 * 0.854) = 6, h(6) = floor(8 * frac(3.708)) = floor(8 * 0.708) = 5, h(9) = floor(8 * frac(5.562)) = floor(8 * 0.562) = 4, h(12) = floor(8 * frac(7.416)) = floor(8 * 0.416) = 3, h(15) = floor(8 * frac(9.270)) = floor(8 * 0.270) = 2, h(18) = floor(8 * frac(11.124)) = floor(8 * 0.124) = 0, h(21) = floor(8 * frac(12.978)) = floor(8 * 0.978) = 7, h(24) = floor(8 * frac(14.832)) = floor(8 * 0.832) = 6, h(27) = floor(8 * frac(16.686)) = floor(8 * 0.686) = 5. Buckets: {0:2, 2:1, 3:1, 4:1, 5:2, 6:2, 7:1}. Seven of 8 buckets used, max load 2. Much better than modulo with m = 6, and comparable to modulo with m = 8 — but the multiplication method does not depend on m being coprime with the stride.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, D. (1998). The Art of Computer Programming, Vol 3: Sorting and Searching, Section 6.4 — the multiplication method, analysis of division method, and the golden ratio constant. Carter, J. L. and Wegman, M. N. (1979). "Universal Classes of Hash Functions" — the foundational paper on universal hashing with probabilistic collision bounds. Aumasson, J.-P. and Bernstein, D. J. (2012). "SipHash: a fast short-input PRF" — the keyed hash function adopted by Python, Rust, and Ruby to prevent hash-flooding attacks.',
        'See Hash Table for the data structure itself. Cuckoo Hashing and Robin Hood Hashing for advanced collision resolution. Bloom Filter for hash-based approximate membership. Rolling Hash & Rabin-Karp for hash-based string matching. Big-O Growth Rates for why the O(1)-vs-O(n) distinction matters at scale.',
      ],
    },
  ],
};
