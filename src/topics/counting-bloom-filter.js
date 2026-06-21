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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/counting-bloom-filter.gif', alt: 'Animated walkthrough of the counting bloom filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Counting Bloom filters exist because ordinary Bloom filters are good at compact membership checks but bad at deletion. A normal Bloom filter stores bits. If two keys share a bit and one key is deleted, clearing the bit can accidentally erase evidence for the other key.',
        {
          type: 'callout',
          text: 'Counting Bloom filters keep the Bloom filter maybe answer while adding enough shared evidence accounting to delete safely.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png',
          alt: 'Bloom filter bit array with several keys mapped by hash arrows',
          caption: 'Bloom filter hash footprint diagram. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bloom_filter.svg/500px-Bloom_filter.svg.png',
        },
        'Counting replaces each bit with a small counter. Insert increments the counters selected by the hash functions. Delete decrements those same counters. Query still asks whether all selected counters are nonzero.',
        'The structure is useful when approximate membership is valuable but the set changes over time: cache summaries, mutable network filters, duplicate suppression windows, distributed stores, and streaming systems.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to use a classic Bloom filter and clear bits on delete. That breaks because multiple keys can share the same bit. Clearing a shared bit can create a false negative for another key that is still present.',
        'Another shortcut is to rebuild the whole filter whenever deletes matter. That can be correct, but it may be too expensive if updates are frequent or the source set is distributed.',
        'Counting Bloom filters are the middle ground: keep local update support while preserving the basic Bloom-filter query contract, as long as operations are well formed and counters do not overflow or underflow.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is shared evidence accounting. A bit says "at least one inserted key touched this cell." A counter says "how many inserts currently contribute to this cell." That count lets one key leave without erasing another key\'s footprint.',
        'The membership semantics stay approximate. If all counters are nonzero, the key may be present because other keys could have produced the same pattern. If any counter is zero, the key is definitely absent, provided updates were correct.',
        'The new risk is that the data structure is no longer monotone. Ordinary Bloom filters never create false negatives after insertion. Counting Bloom filters can create false negatives if counters overflow, underflow, or receive deletes without matching inserts.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For insert(x), compute k hash positions and increment each counter. For query(x), compute the same positions and return definitely absent if any counter is zero. For delete(x), decrement each counter. Overlapping keys are safe because shared counters can stay positive after one key is removed.',
        'Stable Bloom filters adapt the counter idea for unbounded streams. Before inserting a new item, randomly decrement some counters. Then insert the new item by setting or incrementing its counters. The system reaches a stable fill rate, so memory stays bounded, but old items can disappear and later query as absent.',
        'Counter width matters. Small counters save memory but can saturate under hot keys or high load. Wide counters reduce overflow risk but move the structure farther from the compactness that made Bloom filters attractive.',
        'Concurrent updates also need care. If multiple threads insert and delete without atomic counter operations or proper ownership rules, the counter array can drift away from reality.',
        'Deletion should normally be tied to an authoritative store. The filter is a summary; it should not be the only record of whether a key exists. The source of truth decides whether a delete is legal.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'Read counters as removable Bloom-filter bits. Insertion increments every hashed counter; deletion decrements them. Query still checks whether all corresponding counters are nonzero, so it inherits false positives while adding support for removals.',
        'The failure mode is counter honesty. If you delete an item that was never inserted, decrement too far, overflow a tiny counter, or race updates, you can create false negatives. Counting Bloom filters buy deletion with more memory and stricter update discipline.',
        'The stable-stream view proves a different contract. Random aging makes the filter forget old evidence on purpose. That is unacceptable for exact membership summaries but useful for bounded-memory stream deduplication.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because each counter is a reference count for approximate evidence. If A and B share two positions and A is removed, the shared counters remain positive because B still contributes.',
        'It preserves the Bloom-filter advantage because query still touches only k cells. The structure does not store the keys themselves. It stores only the compact hashed footprint.',
        'Stable filters work because aging and insertion reach equilibrium. Old items gradually lose evidence, while recent or repeated items refresh their counters. The result is a recency-biased approximate set for streams.',
        'The correctness line is therefore conditional: no false negatives require valid deletes and healthy counters. Once the system deliberately ages counters, as stable filters do, it has chosen a different contract.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Insert, query, and delete are O(k). Space is larger than a bit Bloom filter because every cell stores several bits of counter. Four-bit counters are common in teaching examples, but real choices depend on overflow risk, expected multiplicity, and memory budget. Stable filters add per-insert aging work, chosen to control the steady-state false-positive rate.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloom_filter_fp_probability.svg/500px-Bloom_filter_fp_probability.svg.png',
          alt: 'Bloom filter false positive probability curves for different filter sizes',
          caption: 'False positive probability as Bloom filter load changes. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Bloom_filter_fp_probability.svg/500px-Bloom_filter_fp_probability.svg.png',
        },
        'Counting filters trade memory for deletion. Stable filters trade the no-false-negative guarantee for bounded memory over infinite streams. Cuckoo filters and quotient filters make different tradeoffs around deletion, locality, fingerprints, and load factor.',
        'The practical design question is not which approximate filter is best in the abstract. It is which contract the system needs: no deletes, safe deletes, recency windows, compact transfer, or fast local lookup.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Counting Bloom filters were motivated by mutable approximate-membership workloads such as cache summaries. A proxy or distributed cache may need to advertise compact summaries while its contents change. Counting counters support local deletion and update, then a standard bit-style summary can be derived for sharing.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Bloom_filter_speed.svg/500px-Bloom_filter_speed.svg.png',
          alt: 'Bloom filter in front of slower storage with false positive and fast negative paths',
          caption: 'Bloom filter as a fast guard before slow storage. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Bloom_filter_speed.svg/500px-Bloom_filter_speed.svg.png',
        },
        'Stable Bloom filters target duplicate detection over data streams where exact all-time memory is impossible. The Deng and Rafiei SIGMOD work framed the problem directly: in an unbounded stream, old duplicate evidence must eventually be evicted, so the structure deliberately trades some false negatives for bounded memory.',
        'They also fit approximate replay suppression, crawling windows, telemetry dedupe, cache admission, and systems that can tolerate false positives but need compact state. When deletion correctness is critical, the application must guarantee matched insert/delete operations.',
        'Counting filters are also useful during rebuild transitions. A system can maintain a mutable approximate summary while a larger exact index is being compacted or refreshed, as long as the summary is treated as a hint rather than final truth.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Counting does not make Bloom filters exact. A positive answer remains a false-positive-prone maybe. Counting also does not make arbitrary deletes safe. If an application deletes absent keys, counters can be decremented below the evidence needed by real keys. Saturating counters can avoid wraparound but complicates deletion semantics.',
        'Stable Bloom filters are not drop-in replacements for ordinary filters. They can forget real old items, which is a false negative under the classic Bloom contract. Use them only when recency-window behavior is acceptable.',
        'Another failure is ignoring adversarial or skewed inputs. Hot keys can drive counters toward saturation, and poor hash independence can cluster evidence. Approximate filters need load-factor monitoring, rebuild policy, and test data that reflects production skew.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Bonomi et al., An Improved Construction for Counting Bloom Filters at https://www.eecs.harvard.edu/~michaelm/postscripts/esa2006b.pdf, Deng and Rafiei, Stable Bloom Filters at https://webdocs.cs.ualberta.ca/~drafiei/papers/DupDet06Sigmod.pdf, Broder and Mitzenmacher survey context at https://www.eecs.harvard.edu/~michaelm/NEWWORK/postscripts/BloomFilterSurvey.pdf, Cuckoo Filter paper at https://www.cs.cmu.edu/~dga/papers/cuckoo-conext2014.pdf, and Cuckoo Filter NSDI paper at https://www.usenix.org/system/files/nsdip13-paper6.pdf. Study Bloom Filter, Cuckoo Filter, Quotient Filter, Count-Min Sketch, and Heavy Hitters next.',
      ],
    },
  ],
};
