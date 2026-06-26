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
  const encodingPieces = ['labels', 'has-child bits', 'LOUDS bits', 'suffix bits'];
  const pipelineNodes = ['keys', 'fst', 'prefix', 'suffix', 'point', 'range', 'sstable'];

  yield {
    state: surfGraph('SuRF keeps trie navigation but compresses the representation'),
    highlight: { active: ['keys', 'fst', 'e-keys-fst'], compare: ['prefix', 'suffix'] },
    explanation: `SuRF, the Succinct Range Filter, starts from sorted keys and builds a Fast Succinct Trie. The pipeline has ${pipelineNodes.length} stages from keys through SSTable. Shared prefixes stay navigable while the trie is encoded compactly.`,
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
    explanation: `The fast succinct trie uses ${encodingPieces.length} encoding pieces (${encodingPieces.join(', ')}) — compact arrays and bitvectors instead of pointer-heavy nodes. Rank/select turns those bitvectors into navigation.`,
    invariant: `A definite negative can stop before touching the source table.`,
  };

  yield {
    state: surfGraph('Suffix bits tune precision without storing full keys'),
    highlight: { active: ['suffix', 'point', 'range', 'e-suffix-point'], found: ['fst'] },
    explanation: `SuRF can keep hash or real suffix bits after the truncated trie. More suffix bits reduce false positives but increase memory. The ${encodingPieces.length}th piece — ${encodingPieces[3]} — is the tuning knob.`,
  };

  const comparisonRows = ['point lookup', 'range lookup', 'key order', 'space knob'];
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
    explanation: `This ${comparisonRows.length}-row comparison shows why SuRF exists: range filtering. A Bloom filter can reject a single absent key, but it cannot say an entire key interval is empty.`,
  };
}

function* rangePruning() {
  const querySteps = ['seek lower bound', 'walk trie', 'no key in interval', 'maybe overlaps'];

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
    explanation: `For a range [a, b], the filter walks ${querySteps.length} steps: ${querySteps.join(' -> ')}. A definite empty avoids a table scan.`,
  };

  yield {
    state: surfGraph('Range filters protect ordered storage from empty scans'),
    highlight: { active: ['range', 'sstable', 'e-range-sstable'], found: ['prefix', 'suffix'] },
    explanation: `Ordered storage engines often answer range queries by seeking through sorted files. SuRF can skip files whose keys cannot overlap the requested interval.`,
  };

  const useCases = ['LSM levels', 'time-series shards', 'log search', 'prefix scans'];
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
    explanation: `The pattern applies across ${useCases.length} domains (${useCases.join(', ')}): any ordered key space where empty ranges are common and source reads are expensive.`,
  };

  const failureModes = ['false positive', 'few suffix bits', 'updates', 'wide ranges'];
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
    explanation: `SuRF has one-sided error like Bloom filters. Watch for ${failureModes.length} failure modes: ${failureModes.join(', ')}. False positives waste work; false negatives would be correctness bugs and are not allowed.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        { type: 'callout', text: 'SuRF is safe because it only says no when the compressed trie proves no stored key can inhabit the queried interval.' },
        'Read the succinct-trie view as a compressed prefix tree. A prefix tree, or trie, stores keys by shared leading bytes; succinct means tree shape is encoded with bitvectors instead of pointers. Labels, has-child bits, LOUDS shape bits, and suffix bits are the navigation pieces that replace nodes and pointers.',
        'In the range-pruning view, definite empty means the SSTable can be skipped. Maybe means the filter cannot prove absence, so the sorted file remains the source of truth. The safe inference is one-sided: false positives waste reads, but false negatives would lose data and are not allowed.',
        {type: 'image', src: './assets/gifs/surf-range-filter.gif', alt: 'Animated walkthrough of the surf range filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Bloom_filter_speed.svg',
          alt: 'Bloom filter diagram in front of a slower storage layer, with definite negative and false positive paths.',
          caption: 'A Bloom filter can reject an exact key before storage, but its hash layout cannot answer ordered range emptiness. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Bloom_filter_speed.svg.',
        },
        'Storage engines often hold many immutable sorted files. A query for a key range should not read a file if no key in that file can fall inside the interval. SuRF, the Succinct Range Filter, exists to reject empty ranges before disk seeks, decompression, and iterator setup.',
        'Bloom filters are excellent for exact-key absence, but hashing destroys order. Range queries need order because [apple, apricot] is about neighboring keys, not independent hashes. SuRF keeps enough trie order to answer some interval emptiness questions with a compact memory budget.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one Bloom filter per sorted file. For point lookup of key k, a no answer safely skips the file. For a range [lo, hi], the Bloom filter has no way to represent all keys between lo and hi without testing many possible keys.',
        'Another approach is to store only the minimum and maximum key for each file. That rejects ranges outside the file boundary, but it cannot see holes inside the file. A full pointer trie sees holes, yet it is too large for a hot-path per-file filter.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is preserving order without paying for a pointer-heavy trie. A filter lives in memory so it can protect slower storage. If the filter consumes too much RAM, it evicts useful cache pages and gives back the latency it saved.',
        'The contract is also strict. A range filter may return maybe when the range is empty, because that only causes an unnecessary file read. It must never return empty when a real key exists in the interval, because that would make the storage engine omit correct data.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg',
          alt: 'Trie containing words that share prefixes.',
          caption: 'A trie makes prefix navigation visible, the order structure SuRF keeps while compressing storage. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.',
        },
        'SuRF stores an over-approximation of the key set in a compact trie. Over-approximation means every real key path remains represented, but some absent paths may look possible after truncation. That is exactly the same safety shape as a Bloom filter, extended from points to ordered intervals.',
        'The Fast Succinct Trie, or FST, replaces child pointers with arrays and rank/select bitvector navigation. rank counts set bits up to a position, and select finds the position of a numbered set bit. Those primitives let the filter navigate tree shape while using bits instead of heap nodes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build starts from sorted keys in one SSTable. Shared prefixes become trie paths, labels store edge bytes, has-child bits mark whether a node descends, and LOUDS bits encode level-order tree shape. Optional suffix bits store truncated real or hashed tail information to reduce false positives.',
        'A point query walks the trie by bytes and checks suffix evidence when the explicit path stops. A range query seeks the lower bound and asks whether any represented path could fall between lo and hi. If no path can inhabit the interval, the filter returns definite empty; otherwise it returns maybe.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is that real keys are a subset of represented keys. Truncating a trie can merge possible tails, which widens the represented set. It does not remove the prefix path of any key that was present when the filter was built.',
        'Therefore a definite empty answer is safe. If the compressed trie proves that no represented key can fall inside [lo, hi], then no real key can fall inside that interval either. A maybe answer carries no correctness promise; it only says the storage engine must consult the source file.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build cost is O(nL) for n sorted keys with average length L, because the builder reads key bytes and emits compact trie arrays. Point and range lookups are O(L) in key length, with rank/select treated as constant-time over prepared bitvectors. When key count doubles, filter storage grows roughly linearly in the number and shape of prefixes represented.',
        'The behavior cost is false positives. More suffix bits make the filter larger but skip more file reads; fewer suffix bits save memory but return maybe more often. A range false positive can be more expensive than a point false positive because it can force iterator setup and block reads over part of a file.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SuRF fits LSM-tree storage engines with immutable SSTables and ordered keys. A range query over tenant 17 and time 10:00 to 10:05 can skip files whose compressed key trie proves no key has that tenant-time prefix. The access pattern is narrow, selective ranges over sorted keys.',
        'It also fits time-series shards, metric stores, and multi-tenant logs when the key schema places selective dimensions early. Prefix locality is the reason the trie helps. If the key begins with a random hash, the structure has little order to exploit.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SuRF fails when the workload is mostly exact-key lookup and ranges are rare. A Bloom, Ribbon, or Xor filter can be smaller and simpler for point queries. It also fails on wide ranges that overlap most files because the filter cannot prune much.',
        'It is snapshot-oriented. If the SSTable changes but the filter is reused, the safety invariant can break. Production systems pair the filter with one immutable file and rebuild it when compaction creates a new file.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an SSTable contains far, fas, fat, top, and toy. A truncated trie that keeps two bytes represents fa* and to*. Query range [fog, foz] finds no represented path between the bounds, so the file is definite empty for that range.',
        'Query range [fan, faq] does overlap represented fa*, even though fan is not a real key. SuRF must return maybe because truncation cannot distinguish every absent tail. The storage engine reads the SSTable, finds no key in the range, and pays a false-positive read rather than losing data.',
        'If the filter uses 14 bits per key for 1 million keys, it uses about 14 million bits, or 1.75 MB. Adding more real suffix bits might reduce range false positives but grows that memory. The engineering question is whether the avoided disk and block-cache work is worth the extra resident bytes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Zhang, Lim, Leis, Andersen, Kaminsky, Keeton, and Pavlo, "SuRF: Practical Range Query Filtering with Fast Succinct Tries," SIGMOD 2018. The paper gives the FST layout, suffix variants, and point-versus-range false-positive measurements.',
        'Study tries, Bloom filters, and rank/select bitvectors before this topic. Then study LSM trees, SSTable block indexes, Ribbon filters, and database indexing so the filter can be placed correctly in a storage read path.',
      ],
    },
  ],
};