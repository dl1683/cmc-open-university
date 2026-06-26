// Runtime Bloom filters for join pruning: build-side key summaries, dynamic
// filter distribution, fact-side scan pruning, and false-positive economics.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'runtime-bloom-filter-join-pruning-case-study',
  title: 'Runtime Bloom Filter Join Pruning',
  category: 'Systems',
  summary: 'How query engines build a compact filter from join keys at runtime and push it into large scans to avoid reading rows that cannot join.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dynamic filter', 'false positives'], defaultValue: 'dynamic filter' },
  ],
  run,
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function filterGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'dim', label: 'dim', x: 0.7, y: 2.5, note: notes.dim ?? 'build' },
      { id: 'keys', label: 'keys', x: 2.0, y: 2.5, note: notes.keys ?? 'join ids' },
      { id: 'bloom', label: 'bloom', x: 3.5, y: 2.5, note: notes.bloom ?? 'bits' },
      { id: 'dist', label: 'dist', x: 5.0, y: 2.5, note: notes.dist ?? 'broadcast' },
      { id: 'fact', label: 'fact', x: 0.7, y: 5.7, note: notes.fact ?? 'large scan' },
      { id: 'scan', label: 'scan', x: 3.5, y: 5.7, note: notes.scan ?? 'probe' },
      { id: 'join', label: 'join', x: 6.6, y: 4.1, note: notes.join ?? 'hash join' },
      { id: 'out', label: 'out', x: 8.4, y: 4.1, note: notes.out ?? 'matches' },
      { id: 'stats', label: 'stats', x: 9.2, y: 2.5, note: notes.stats ?? 'saved IO' },
    ],
    edges: [
      { id: 'e-dim-keys', from: 'dim', to: 'keys' },
      { id: 'e-keys-bloom', from: 'keys', to: 'bloom' },
      { id: 'e-bloom-dist', from: 'bloom', to: 'dist' },
      { id: 'e-fact-scan', from: 'fact', to: 'scan' },
      { id: 'e-dist-scan', from: 'dist', to: 'scan' },
      { id: 'e-scan-join', from: 'scan', to: 'join' },
      { id: 'e-dim-join', from: 'dim', to: 'join' },
      { id: 'e-join-out', from: 'join', to: 'out' },
      { id: 'e-scan-stats', from: 'scan', to: 'stats' },
    ],
  }, { title });
}

function* dynamicFilter() {
  yield {
    state: filterGraph('A small build side produces a runtime key summary'),
    highlight: { active: ['dim', 'keys', 'bloom', 'e-dim-keys', 'e-keys-bloom'], compare: ['fact'] },
    explanation: 'In a selective hash join, the build side may contain only a small set of join keys after filters. A runtime Bloom filter summarizes those keys while the query is running.',
    invariant: 'A runtime filter is learned from this query execution, not only from table metadata.',
  };

  yield {
    state: filterGraph('The filter is pushed toward the large fact scan', { dist: 'push', scan: 'test ids' }),
    highlight: { active: ['bloom', 'dist', 'scan', 'e-bloom-dist', 'e-dist-scan'], found: ['keys'], compare: ['join'] },
    explanation: 'The engine distributes the filter to scan operators. A fact row whose join key is definitely not in the build-side key set can be skipped before the expensive join probe.',
  };

  yield {
    state: labelMatrix(
      'Fact scan with runtime filter',
      [
        { id: 'f0', label: 'f0' },
        { id: 'f1', label: 'f1' },
        { id: 'f2', label: 'f2' },
        { id: 'f3', label: 'f3' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'test', label: 'test' },
        { id: 'move', label: 'move' },
      ],
      [
        ['42', 'maybe', 'join'],
        ['71', 'no', 'skip'],
        ['42', 'maybe', 'join'],
        ['99', 'no', 'skip'],
      ],
    ),
    highlight: { active: ['f0:move', 'f2:move'], removed: ['f1:move', 'f3:move'] },
    explanation: 'Bloom filters have no false negatives. If the test says no, the row cannot join. If the test says maybe, the row still goes to the real join where exact equality is checked.',
  };

  yield {
    state: filterGraph('Rows that survive the filter still pass through the real join', { scan: 'maybe rows', join: 'exact', stats: 'pruned' }),
    highlight: { found: ['scan', 'join', 'out', 'stats', 'e-scan-join', 'e-join-out', 'e-scan-stats'], active: ['bloom'] },
    explanation: 'The runtime filter is a prefilter, not the join result. It reduces scan and probe work, then the hash join enforces exact join semantics.',
  };
}

function* falsePositives() {
  yield {
    state: labelMatrix(
      'Bloom filter outcomes',
      [
        { id: 'hit', label: 'real hit' },
        { id: 'miss', label: 'real miss' },
        { id: 'fp', label: 'false pos' },
        { id: 'fn', label: 'false neg' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['maybe', 'join'],
        ['no', 'skip'],
        ['maybe', 'extra'],
        ['none', 'bad'],
      ],
    ),
    highlight: { active: ['miss:effect', 'hit:effect'], compare: ['fp:effect'], removed: ['fn:effect'] },
    explanation: 'Bloom filters can produce false positives, which waste some work, but they must not produce false negatives. A false negative would drop a row that should join, breaking correctness.',
    invariant: 'Runtime filters may be approximate only in the safe direction.',
  };

  yield {
    state: labelMatrix(
      'Filter timing',
      [
        { id: 'early', label: 'early' },
        { id: 'late', label: 'late' },
        { id: 'small', label: 'small' },
        { id: 'huge', label: 'huge' },
      ],
      [
        { id: 'win', label: 'win' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['skip IO', 'wait'],
        ['fast', 'miss IO'],
        ['cheap', 'weak'],
        ['precise', 'ship'],
      ],
    ),
    highlight: { active: ['early:win', 'small:win'], compare: ['late:risk', 'huge:risk'] },
    explanation: 'A runtime filter has a timing tradeoff. Waiting for a precise filter can delay scans. Sending an early small filter can start pruning sooner but may pass more false positives.',
  };

  yield {
    state: filterGraph('A saturated filter stops being useful', { bloom: 'full bits', scan: 'many maybe', stats: 'low save' }),
    highlight: { active: ['bloom', 'scan', 'stats', 'e-dist-scan', 'e-scan-stats'], compare: ['out'] },
    explanation: 'If the build side is huge or the filter bitset is too small, too many bits are set. Then almost every fact key returns maybe and the filter adds overhead without much pruning.',
  };

  yield {
    state: labelMatrix(
      'Complete star join case',
      [
        { id: 'dim', label: 'dim' },
        { id: 'filter', label: 'filter' },
        { id: 'fact', label: 'fact' },
        { id: 'join', label: 'join' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['small', 'build'],
        ['bloom', 'push'],
        ['big', 'prune'],
        ['exact', 'verify'],
      ],
    ),
    highlight: { found: ['filter:lesson', 'fact:lesson', 'join:lesson'], compare: ['dim:state'] },
    explanation: 'A complete case is a star-schema query: filter a small date or product dimension, build a runtime filter from surviving dimension keys, push it into the huge fact scan, and then run the exact join on remaining rows.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dynamic filter') yield* dynamicFilter();
  else if (view === 'false positives') yield* falsePositives();
  else throw new InputError('Pick a runtime-filter view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a join filter moving from the build side of a query to the scan side. A join combines rows that share a key, and the build side is the smaller input whose keys are known before the larger input is scanned.',
        'The active key is being hashed into a bit array. A probe key is skipped only when at least one required bit is zero, because that proves the key was not seen on the build side.',
        {type:'callout', text:'A runtime Bloom filter turns build-side knowledge into a safe scan-side proof of absence.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/ac/Bloom_filter.svg', alt:'Diagram of a Bloom filter mapping set elements into bit positions.', caption:'Bloom filter diagram by David Eppstein, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Analytic queries often scan a large table and join it with a smaller filtered table. If only 1% of customer IDs survive the small side, scanning every order row and sending every row into the join wastes CPU, memory bandwidth, and network exchange.',
        'A runtime Bloom filter exists because the query learns useful key information while it runs. The engine can summarize the small-side keys and push that summary into the large-side scan before most useless rows reach the join.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to build a hash table for the small side and probe every row from the large side. That is correct and simple because the hash table contains the exact keys needed for the join.',
        'It is also expensive when the large side has billions of rows. The engine still reads, decodes, hashes, and transports rows that have no possible match.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is data movement before certainty. The exact hash table may live at the join operator, while the large table scan may happen in many workers or storage readers upstream.',
        'Shipping the whole hash table to every scan can be too large, and waiting for the full build side can delay the scan. The system needs a compact summary that is safe to use for rejection.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A Bloom filter is a probabilistic set representation made from a bit array and several hash functions. Inserting a key sets several bits; testing a key checks those same bit positions.',
        'If any checked bit is zero, the key is definitely absent. If all bits are one, the key may be present, so the row must still go to the exact join to avoid false matches.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During the build phase, the engine hashes each join key from the small input into the Bloom filter. The filter is then broadcast or pushed down to scan workers, storage readers, or exchange operators.',
        'During the probe phase, each large-side key is tested before expensive join work. A negative test drops the row immediately, while a maybe test continues to the exact hash join where correctness is decided.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is one-sided. Bloom filters can create false positives because unrelated keys may set the same bits, but they do not create false negatives if the same hash functions and bit array are used.',
        'That means the filter can only fail by letting extra rows through. The exact join still checks real key equality, so false positives waste work but cannot change the final result.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Building the filter costs O(nk), where n is build-side key count and k is the number of hash functions. Testing costs O(k) per probe row, and memory is the bit-array size, often measured as bits per key.',
        'Cost behaves through selectivity. If a 10 million row scan is reduced to 500,000 maybe rows, the filter saved 9.5 million join probes; if the false-positive rate is high, the scan pays hash cost and still sends most rows onward.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Runtime Bloom filters appear in distributed SQL engines, columnar query engines, data lake scans, and vectorized execution pipelines. They are strongest when the build side is much smaller than the probe side and the join key has useful selectivity.',
        'They also help remote storage scans because fewer rows leave the storage layer. The filter turns a join fact learned in compute into a pruning rule near the bytes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The filter fails as an optimization when the build side is large, the join key is not selective, or the bit array is too small. Saturated filters have many one bits, so almost every probe becomes maybe.',
        'It can also be a bad fit for high-churn streaming joins where the key set changes faster than filters can be rebuilt and distributed. Deletions require counting or replacement filters, not a plain Bloom filter.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A query joins 100,000 selected customer IDs against 50,000,000 order rows. A Bloom filter with 1,000,000 bits and 7 hashes uses about 125 KB and has an approximate false-positive rate near 0.8% for 100,000 inserted keys.',
        'If only 2% of order rows truly match, the scan expects about 1,000,000 true maybe rows plus about 392,000 false positives from the remaining 49,000,000 rows. The join probes 1.39 million rows instead of 50 million, so the filter cost buys about 36 times less downstream join work.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Bloom 1970 at https://dl.acm.org/doi/10.1145/362686.362692 and Apache Spark runtime filtering documentation at https://spark.apache.org/docs/latest/sql-performance-tuning.html. Study hash joins, bitmap indexes, columnar predicate pushdown, approximate membership queries, and distributed query planning next.',
      ],
    },
  ],
};
