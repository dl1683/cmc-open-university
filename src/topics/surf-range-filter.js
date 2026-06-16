// SuRF range filter: a succinct trie that answers point and range filters with
// one-sided error, useful where Bloom filters cannot prune empty ranges.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'surf-range-filter',
  title: 'SuRF Range Filter',
  category: 'Data Structures',
  summary: 'A succinct range filter built from a compressed trie: prune point lookups and empty range scans with tunable false positives.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['succinct trie', 'range pruning'], defaultValue: 'succinct trie' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function surfGraph(title) {
  return graphState({
    nodes: [
      { id: 'keys', label: 'sorted keys', x: 0.8, y: 3.6, note: 'strings/bytes' },
      { id: 'fst', label: 'FST trie', x: 2.8, y: 3.6, note: 'labels + louds' },
      { id: 'prefix', label: 'prefix path', x: 4.9, y: 2.0, note: 'shared bytes' },
      { id: 'suffix', label: 'suffix bits', x: 4.9, y: 5.2, note: 'tune FPR' },
      { id: 'point', label: 'point filter', x: 7.0, y: 2.2, note: 'key exists?' },
      { id: 'range', label: 'range filter', x: 7.0, y: 5.0, note: '[a, b] empty?' },
      { id: 'sstable', label: 'SSTable', x: 9.0, y: 3.6, note: 'source of truth' },
    ],
    edges: [
      { id: 'e-keys-fst', from: 'keys', to: 'fst', weight: 'build' },
      { id: 'e-fst-prefix', from: 'fst', to: 'prefix', weight: 'traverse' },
      { id: 'e-fst-suffix', from: 'fst', to: 'suffix', weight: 'store' },
      { id: 'e-prefix-point', from: 'prefix', to: 'point', weight: 'lookup' },
      { id: 'e-prefix-range', from: 'prefix', to: 'range', weight: 'seek' },
      { id: 'e-suffix-point', from: 'suffix', to: 'point', weight: 'check' },
      { id: 'e-point-sstable', from: 'point', to: 'sstable', weight: 'maybe read' },
      { id: 'e-range-sstable', from: 'range', to: 'sstable', weight: 'maybe scan' },
    ],
  }, { title });
}

function* succinctTrie() {
  yield {
    state: surfGraph('SuRF keeps trie navigation but compresses the representation'),
    highlight: { active: ['keys', 'fst', 'e-keys-fst'], compare: ['prefix', 'suffix'] },
    explanation: 'SuRF, the Succinct Range Filter, starts from sorted keys and builds a Fast Succinct Trie. Shared prefixes stay navigable while the trie is encoded compactly.',
  };

  yield {
    state: labelMatrix(
      'Trie encoding pieces',
      [
        { id: 'labels', label: 'labels' },
        { id: 'haschild', label: 'has-child bits' },
        { id: 'louds', label: 'LOUDS bits' },
        { id: 'suffix', label: 'suffix bits' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'job', label: 'job' },
      ],
      [
        ['edge bytes', 'match key bytes'],
        ['node has child?', 'navigate down'],
        ['level order shape', 'rank/select movement'],
        ['truncated key tails', 'lower false positives'],
      ],
    ),
    highlight: { active: ['labels:stores', 'louds:job'], found: ['suffix:job'] },
    explanation: 'The fast succinct trie uses compact arrays and bitvectors instead of pointer-heavy nodes. Rank/select turns those bitvectors into navigation.',
    invariant: 'A definite negative can stop before touching the source table.',
  };

  yield {
    state: surfGraph('Suffix bits tune precision without storing full keys'),
    highlight: { active: ['suffix', 'point', 'range', 'e-suffix-point'], found: ['fst'] },
    explanation: 'SuRF can keep hash or real suffix bits after the truncated trie. More suffix bits reduce false positives but increase memory.',
  };

  yield {
    state: labelMatrix(
      'Bloom filter versus SuRF',
      [
        { id: 'point', label: 'point lookup' },
        { id: 'range', label: 'range lookup' },
        { id: 'order', label: 'key order' },
        { id: 'space', label: 'space knob' },
      ],
      [
        { id: 'bloom', label: 'Bloom' },
        { id: 'surf', label: 'SuRF' },
      ],
      [
        ['excellent', 'good'],
        ['cannot answer', 'core feature'],
        ['ignored', 'used by trie'],
        ['bits per key', 'trie + suffix bits'],
      ],
    ),
    highlight: { active: ['range:bloom', 'range:surf'], found: ['order:surf'] },
    explanation: 'The reason SuRF exists is range filtering. A Bloom filter can reject a single absent key, but it cannot say an entire key interval is empty.',
  };
}

function* rangePruning() {
  yield {
    state: labelMatrix(
      'Range query example',
      [
        { id: 'seek', label: 'seek lower bound' },
        { id: 'walk', label: 'walk trie' },
        { id: 'empty', label: 'no key in interval' },
        { id: 'maybe', label: 'maybe overlaps' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'result', label: 'result' },
      ],
      [
        ['start at prefix a', 'candidate position'],
        ['compare with b', 'detect next key prefix'],
        ['definite empty', 'skip SSTable'],
        ['possible overlap', 'consult table'],
      ],
    ),
    highlight: { active: ['empty:result', 'maybe:result'], found: ['walk:work'] },
    explanation: 'For a range [a, b], the filter asks whether the trie contains any key that could fall inside the interval. A definite empty avoids a table scan.',
  };

  yield {
    state: surfGraph('Range filters protect ordered storage from empty scans'),
    highlight: { active: ['range', 'sstable', 'e-range-sstable'], found: ['prefix', 'suffix'] },
    explanation: 'Ordered storage engines often answer range queries by seeking through sorted files. SuRF can skip files whose keys cannot overlap the requested interval.',
  };

  yield {
    state: labelMatrix(
      'Where range filtering pays',
      [
        { id: 'lsm', label: 'LSM levels' },
        { id: 'time', label: 'time-series shards' },
        { id: 'logs', label: 'log search' },
        { id: 'prefix', label: 'prefix scans' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'benefit', label: 'benefit' },
      ],
      [
        ['many sorted files', 'skip empty files'],
        ['time windows', 'skip cold shards'],
        ['lexicographic keys', 'avoid dead ranges'],
        ['common prefixes', 'prune by trie path'],
      ],
    ),
    highlight: { found: ['lsm:benefit', 'prefix:benefit'], compare: ['time:problem'] },
    explanation: 'The pattern is any ordered key space where empty ranges are common and source reads are expensive.',
  };

  yield {
    state: labelMatrix(
      'Failure and tuning',
      [
        { id: 'fp', label: 'false positive' },
        { id: 'suffix', label: 'few suffix bits' },
        { id: 'update', label: 'updates' },
        { id: 'range', label: 'wide ranges' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['unneeded table read', 'correct but slower'],
        ['higher FPR', 'add suffix bits'],
        ['static structure', 'rebuild with segment'],
        ['many overlaps', 'filter less useful'],
      ],
    ),
    highlight: { active: ['fp:symptom', 'suffix:response'], found: ['update:response'] },
    explanation: 'SuRF has one-sided error like Bloom filters. False positives waste work; false negatives would be correctness bugs and are not allowed.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'succinct trie') yield* succinctTrie();
  else if (view === 'range pruning') yield* rangePruning();
  else throw new InputError('Pick a SuRF view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'SuRF stands for Succinct Range Filter. It is a compact filter for ordered keys that supports both point membership tests and range emptiness tests. A Bloom Filter can tell you that one key is definitely absent, but it cannot tell you that no key exists between apple and apricot. SuRF is designed for that ordered-range question.',
        'The SIGMOD paper SuRF: Practical Range Query Filtering with Fast Succinct Tries presents SuRF as a fast and compact data structure for approximate membership tests over point and range queries: https://db.cs.cmu.edu/papers/2018/mod601-zhangA-hm.pdf. The ACM record is at https://dl.acm.org/doi/10.1145/3183713.3196931.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'SuRF builds on a Fast Succinct Trie. A trie preserves key order and shared prefixes. Instead of storing pointer-heavy nodes, SuRF stores labels, child indicators, and LOUDS-style bitvectors that support navigation with rank/select operations. It may store truncated suffix information to reduce false positives without keeping full keys.',
        'A point lookup walks the trie and checks suffix information. A range lookup asks whether any key path can fall inside the requested interval. If the answer is definitely empty, the storage engine skips the expensive source lookup or scan. If the answer is maybe, the engine checks the authoritative data structure.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The core tradeoff is memory versus false-positive rate. More suffix bits make false positives rarer. Fewer suffix bits make the filter smaller. The query work is shaped by key length and succinct-trie navigation, not by hashing several independent positions as in a Bloom filter.',
        'SuRF is usually built for immutable sorted structures such as SSTables. Updating it in place is not the main design goal. That fits LSM engines because new data is flushed into immutable files and old files are rewritten during compaction.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a RocksDB-like LSM tree serving range scans over user_id/time keys. A query asks for user 42 between 10:00 and 10:05. Many SSTables at several levels may not contain any key in that interval. A point Bloom filter cannot reject the whole range. A SuRF attached to each file can say that the interval is definitely empty for most files, so the engine opens and seeks fewer files.',
        'The result is not just less CPU. It is fewer cache misses, fewer block reads, and less interference with compaction. The SuRF paper evaluates this exact storage-engine motivation and reports speedups for range-heavy workloads.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'SuRF is not a replacement for the table. It can only reject impossible point or range queries. Maybe still means consult the source of truth. Another trap is using it for unordered data. The structure earns its advantage from sorted keys and prefix order. If the workload is mostly single-key gets, a simpler Bloom or Ribbon-family filter may be smaller or faster.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SuRF paper PDF at https://db.cs.cmu.edu/papers/2018/mod601-zhangA-hm.pdf, ACM DOI https://dl.acm.org/doi/10.1145/3183713.3196931, and SIGMOD slides at https://people.iiis.tsinghua.edu.cn/~huanchen/slides/surf-sigmod18.pdf. Study Trie, PATRICIA Trie, Rank/Select Bitvector, Bloom Filter, RocksDB LSM Case Study, and Database Indexing next.',
      ],
    },
  ],
};
