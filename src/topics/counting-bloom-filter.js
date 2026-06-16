// Counting Bloom filters replace bits with small counters so deletes can
// decrement shared evidence without erasing other keys' footprints.

import { arrayState, graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'counting-bloom-filter',
  title: 'Counting Bloom Filter',
  category: 'Systems',
  summary: 'A deletable Bloom-filter variant: use small counters instead of bits, increment on insert, decrement on delete, and treat nonzero as set.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['insert and delete', 'stable stream'], defaultValue: 'insert and delete' },
  ],
  run,
};

const SIZE = 12;
const POS = {
  A: [2, 5, 9],
  B: [5, 9, 10],
  C: [1, 5, 7],
};

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

function stableFlow(title) {
  return graphState({
    nodes: [
      { id: 'item', label: 'new item', x: 0.8, y: 3.2, note: 'stream' },
      { id: 'age', label: 'age down', x: 2.7, y: 3.2, note: 'random cells' },
      { id: 'insert', label: 'insert', x: 4.6, y: 3.2, note: 'set counters' },
      { id: 'query', label: 'query', x: 6.5, y: 3.2, note: 'duplicate?' },
      { id: 'stable', label: 'stable rate', x: 8.4, y: 3.2, note: 'bounded' },
    ],
    edges: [
      { id: 'e-item-age', from: 'item', to: 'age' },
      { id: 'e-age-insert', from: 'age', to: 'insert' },
      { id: 'e-insert-query', from: 'insert', to: 'query' },
      { id: 'e-query-stable', from: 'query', to: 'stable' },
    ],
  }, { title });
}

function* insertAndDelete() {
  const counters = new Array(SIZE).fill(0);

  yield {
    state: arrayState(counters),
    highlight: {},
    explanation: 'A Counting Bloom Filter starts like a Bloom Filter, but every cell is a small counter instead of one bit. Query still asks whether all hashed cells are nonzero.',
    invariant: 'Counters let overlapping keys share evidence without losing track of how many inserts contributed to a cell.',
  };

  for (const key of ['A', 'B']) {
    const positions = POS[key];
    yield {
      state: arrayState(counters),
      highlight: { active: positions.map((p) => `i${p}`) },
      explanation: `insert(${key}): increment counters ${positions.join(', ')}. Overlap is allowed; shared cells count both keys instead of only remembering one bit.`,
    };
    for (const p of positions) counters[p] += 1;
    yield {
      state: arrayState(counters),
      highlight: { found: positions.map((p) => `i${p}`) },
      explanation: `After inserting ${key}, those counters are positive. The filter still cannot prove membership, but it can safely say no when any required counter is zero.`,
    };
  }

  yield {
    state: arrayState(counters),
    highlight: { active: POS.A.map((p) => `i${p}`), compare: POS.B.map((p) => `i${p}`) },
    explanation: 'A and B overlap at counters 5 and 9. That is why deletion needs counts. Clearing those cells would accidentally erase part of B.',
  };

  for (const p of POS.A) counters[p] -= 1;
  yield {
    state: arrayState(counters),
    highlight: { removed: POS.A.map((p) => `i${p}`), found: POS.B.map((p) => `i${p}`) },
    explanation: 'delete(A): decrement only A positions. The shared counters remain nonzero because B still contributes to them. B can still query as maybe present.',
    invariant: 'Correct deletion assumes each delete corresponds to a prior insert and counters do not underflow.',
  };

  yield {
    state: labelMatrix(
      'Operation contract',
      [
        { id: 'insert', label: 'insert' },
        { id: 'query', label: 'query' },
        { id: 'delete', label: 'delete' },
        { id: 'overflow', label: 'overflow' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['increment k cells', 'counter cap'],
        ['all nonzero?', 'false positive'],
        ['decrement k cells', 'bad delete'],
        ['saturate or widen', 'false negatives'],
      ],
    ),
    highlight: { found: ['delete:action'], compare: ['overflow:risk'] },
    explanation: 'Counting filters buy deletion with memory and discipline. Bad deletes, counter overflow, or underflow can create false negatives, which ordinary Bloom filters avoid.',
  };
}

function* stableStream() {
  yield {
    state: stableFlow('Stable Bloom filters forget old stream evidence'),
    highlight: { active: ['age', 'insert'], found: ['stable'] },
    explanation: 'A stable Bloom filter targets unbounded streams. It randomly decrements some counters before inserting the new item, so old evidence gradually disappears and memory stays fixed.',
    invariant: 'Stable filters trade possible false negatives for bounded memory over an infinite stream.',
  };

  yield {
    state: labelMatrix(
      'Variant map',
      [
        { id: 'classic', label: 'classic Bloom' },
        { id: 'counting', label: 'counting Bloom' },
        { id: 'stable', label: 'stable Bloom' },
        { id: 'cuckoo', label: 'cuckoo filter' },
      ],
      [
        { id: 'delete', label: 'delete?' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['no', 'tiny bits'],
        ['yes', 'counters'],
        ['ages out', 'false negatives'],
        ['yes', 'fingerprints'],
      ],
    ),
    highlight: { active: ['counting:delete', 'stable:delete'], compare: ['classic:delete'], found: ['cuckoo:delete'] },
    explanation: 'Different approximate-membership structures choose different contracts. Counting Bloom preserves deletions when operations are well-formed; stable Bloom handles endless streams by allowing old items to fade.',
  };

  yield {
    state: labelMatrix(
      'Streaming duplicate detection',
      [
        { id: 'recent', label: 'recent item' },
        { id: 'old', label: 'old item' },
        { id: 'new', label: 'new item' },
        { id: 'hot', label: 'hot repeat' },
      ],
      [
        { id: 'counter', label: 'counters' },
        { id: 'answer', label: 'answer' },
      ],
      [
        ['high', 'maybe duplicate'],
        ['aged down', 'maybe absent'],
        ['zeros exist', 'definitely new'],
        ['refreshed', 'kept alive'],
      ],
    ),
    highlight: { found: ['recent:answer', 'hot:answer'], compare: ['old:answer'] },
    explanation: 'Stable filters are useful when recency matters more than all-time history: web crawl deduplication windows, telemetry streams, approximate replay suppression, and cache-admission hints.',
  };

  yield {
    state: stableFlow('The right filter depends on the contract'),
    highlight: { active: ['query', 'stable'], compare: ['age'], found: ['insert'] },
    explanation: 'If false negatives are unacceptable, use a normal or counting Bloom filter with rebuilds as needed. If the stream is unbounded and old history may be forgotten, a stable filter is a better fit.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'insert and delete') yield* insertAndDelete();
  else if (view === 'stable stream') yield* stableStream();
  else throw new InputError('Pick a counting-bloom-filter view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A counting Bloom filter replaces each bit in a classic Bloom filter with a small counter. Inserting a key increments the k counters selected by the hash functions. Query checks whether all k counters are nonzero. Deleting a key decrements those same counters. This makes deletion possible without clearing shared evidence that other keys still need.',
        'The contract is still approximate membership. Positive answers are maybe present. Negative answers are supposed to be definite when inserts and deletes are well formed. Counting adds a new danger: counter overflow, underflow, or deleting a key that was not inserted can break the no-false-negative property.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For insert(x), compute k hash positions and increment each counter. For query(x), compute the same positions and return definitely absent if any counter is zero. For delete(x), decrement each counter. Overlapping keys are safe because shared counters can stay positive after one key is removed.',
        'Stable Bloom filters adapt the counter idea for unbounded streams. Before inserting a new item, randomly decrement some counters. Then insert the new item by setting or incrementing its counters. The system reaches a stable fill rate, so memory stays bounded, but old items can disappear and later query as absent.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insert, query, and delete are O(k). Space is larger than a bit Bloom filter because every cell stores several bits of counter. Four-bit counters are common in teaching examples, but real choices depend on overflow risk, expected multiplicity, and memory budget. Stable filters add per-insert aging work, chosen to control the steady-state false-positive rate.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Counting Bloom filters were motivated by mutable approximate-membership workloads such as cache summaries. A proxy or distributed cache may need to advertise compact summaries while its contents change. Counting counters support local deletion and update, then a standard bit-style summary can be derived for sharing.',
        'Stable Bloom filters target duplicate detection over data streams where exact all-time memory is impossible. The Deng and Rafiei SIGMOD work framed the problem directly: in an unbounded stream, old duplicate evidence must eventually be evicted, so the structure deliberately trades some false negatives for bounded memory.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Counting does not make Bloom filters exact. A positive answer remains a false-positive-prone maybe. Counting also does not make arbitrary deletes safe. If an application deletes absent keys, counters can be decremented below the evidence needed by real keys. Saturating counters can avoid wraparound but complicates deletion semantics.',
        'Stable Bloom filters are not drop-in replacements for ordinary filters. They can forget real old items, which is a false negative under the classic Bloom contract. Use them only when recency-window behavior is acceptable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Bonomi et al., An Improved Construction for Counting Bloom Filters at https://www.eecs.harvard.edu/~michaelm/postscripts/esa2006b.pdf, Deng and Rafiei, Stable Bloom Filters at https://webdocs.cs.ualberta.ca/~drafiei/papers/DupDet06Sigmod.pdf, Broder and Mitzenmacher survey context at https://www.eecs.harvard.edu/~michaelm/NEWWORK/postscripts/BloomFilterSurvey.pdf, Cuckoo Filter paper at https://www.cs.cmu.edu/~dga/papers/cuckoo-conext2014.pdf, and Cuckoo Filter NSDI paper at https://www.usenix.org/system/files/nsdip13-paper6.pdf. Study Bloom Filter, Cuckoo Filter, Quotient Filter, Count-Min Sketch, and Heavy Hitters next.',
      ],
    },
  ],
};
