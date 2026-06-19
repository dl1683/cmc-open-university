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
      heading: 'How to read the animation',
      paragraphs: [
        'The succinct-trie view shows what survives compression. Labels, has-child bits, LOUDS shape bits, and suffix bits are the four pieces that replace pointer-heavy trie nodes. Watch which encoding piece each step highlights and ask: what navigation does this piece enable?',
        'The range-pruning view shows filtering decisions. "Definite empty" means skip the SSTable -- no disk read. "Maybe overlaps" means consult the source file. SuRF earns its memory when most range queries land on definite empty.',
        {
          type: 'diagram',
          text: 'Query: any key in [app, apr]?\n\n  Trie walk:        Decision:\n  root -> a         prefix matches\n    a -> p          prefix matches\n      p -> p        interval lower bound\n      p -> r        interval upper bound\n      no path       => DEFINITE EMPTY, skip SSTable\n\n  If trie had path:\n      p -> q        falls inside [app, apr]\n                    => MAYBE, read SSTable',
          label: 'How the filter turns a range query into a trie walk',
        },
        {
          type: 'note',
          text: 'The SSTable node in the graph is always the source of truth. SuRF is a front gate that saves work only when it can reject. It never replaces the sorted file for positive answers.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Storage engines need to know whether an entire key interval can be skipped. A Bloom filter rejects one absent key but cannot prove that no key exists between "apple" and "apricot." SuRF exists for ordered data where empty ranges are common and source reads are expensive.',
        {
          type: 'quote',
          text: 'SuRF can be used as a drop-in replacement for Bloom filters to additionally support range queries, achieving significant speedups for workloads that include range queries with only a modest increase in false positive rates for point queries.',
          attribution: 'Zhang, Lim, Leis, Andersen, Kaminsky, Keeton, Pavlo, SIGMOD 2018',
        },
        'The common setting is an LSM tree with many immutable sorted files. A point lookup asks whether one exact key might live in a file. A range scan asks a broader question: could any key in this file overlap [left, right]? When most files are disjoint from the query range, answering before reading blocks saves disk seeks, decompression, cache space, and CPU.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Attempt 1: one Bloom filter per file. That helps point lookups -- if the exact key is absent, skip the file. Range scans still must seek through every file because the filter hashes keys, and hashing destroys prefix and interval structure.',
        'Attempt 2: store min and max keys per file. That rejects ranges completely outside the file but cannot reject holes inside. A file with keys near "a" and near "z" covers the entire alphabet even if the middle is empty.',
        'Attempt 3: a full trie over all keys. That answers prefix and range questions, but a pointer-heavy trie is too large for a per-file filter sitting on the hot read path.',
        {
          type: 'table',
          headers: ['Approach', 'Point lookup', 'Range query', 'Memory', 'Limitation'],
          rows: [
            ['Bloom filter', 'Yes -- hash check', 'No -- order lost', '~10 bits/key', 'Cannot reason about intervals'],
            ['Min/max keys', 'No', 'Coarse -- outer bounds only', '2 keys/file', 'Cannot detect internal holes'],
            ['Full trie', 'Yes', 'Yes', 'Pointers per node', 'Too large for a hot-path filter'],
            ['SuRF', 'Yes -- trie walk', 'Yes -- prefix navigation', '~14 bits/key typical', 'One-sided error (false positives)'],
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A normal trie preserves order but costs too many pointers. A hash filter saves memory but loses range reasoning. The wall is keeping enough trie order to reject ranges without storing full keys or a pointer-heavy tree.',
        'Filters live on the hot path. A filter that saves disk reads but doubles memory pressure loses in the block cache. A filter that is compact but slow adds latency to every lookup. A range filter must be small, navigable, and safe: it may return "maybe" too often, but it must never claim "empty" when a real key exists.',
        {
          type: 'note',
          text: 'This is the same one-sided error contract as a Bloom filter, extended from points to intervals. False positives waste work. False negatives would be correctness bugs.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'SuRF builds a Fast Succinct Trie (FST) from sorted keys. The FST replaces child pointers with bitvectors and rank/select operations, compressing the trie to near information-theoretic minimum while preserving navigability.',
        {
          type: 'diagram',
          text: 'Sorted keys:  ["far", "fas", "fat", "top", "toy"]\n\n  Pointer trie:              Succinct trie (FST):\n\n       root                  Labels:    [f, t]\n      /    \\                 HasChild:  [1, 1]\n     f      t                LOUDS-D:   1 1 0\n     |      |                      level 2:\n     a      o                Labels:    [a, o]\n    /|\\    / \\               HasChild:  [1, 1]\n   r  s t  p  y              LOUDS-D:   1 0 1 0\n                                   level 3:\n  Pointers: 7 nodes          Labels:    [r, s, t, p, y]\n  FST: arrays + bitvectors   HasChild:  [0, 0, 0, 0, 0]\n  Navigation via rank/select  Suffix:    (optional bits)',
          label: 'From pointer trie to Fast Succinct Trie',
        },
        'A point lookup walks labels and checks suffix bits at the leaf. A range lookup [a, b] seeks the lower-bound prefix and asks whether any trie path could fall inside the interval. If no path can match, the answer is "definite empty." If a path might match, the storage engine reads the source table.',
        {
          type: 'table',
          headers: ['FST component', 'Stores', 'Navigation role'],
          rows: [
            ['Labels array', 'Edge byte per node', 'Match query key bytes left to right'],
            ['HasChild bitvector', '1 if node has children, 0 if leaf', 'Decide: descend or stop'],
            ['LOUDS-Dense bits', 'Level-order child presence', 'rank/select finds child position'],
            ['LOUDS-Sparse bits', 'Labels + child indicators for sparse levels', 'Saves space in deep, sparse trie regions'],
            ['Suffix bits', 'Truncated key tails (real or hashed)', 'Reduce false positives without storing full keys'],
          ],
        },
        'LOUDS (level-order unary degree sequence) encodes tree shape. Instead of storing child pointers, bitvectors record which nodes have children and where those children appear in level order. rank(position) counts set bits up to a position; select(k) finds the k-th set bit. These two operations replace pointer chasing.',
        {
          type: 'code',
          language: 'python',
          text: '# Pseudocode: SuRF range query\ndef range_filter(surf, lo, hi):\n    """Return DEFINITE_EMPTY or MAYBE."""\n    # Walk trie to lower bound\n    node = surf.root\n    for byte in lo:\n        child = surf.find_child(node, byte)  # rank/select\n        if child is None:\n            # lo prefix not in trie => check if any key\n            # between lo and hi could exist via neighbor paths\n            return check_neighbors(surf, node, lo, hi)\n        node = child\n    # Reached a trie node matching lo prefix\n    # Check if any path from here could fall within [lo, hi]\n    if surf.has_key_in_range(node, lo, hi):\n        return MAYBE\n    return DEFINITE_EMPTY',
        },
        'The build process is snapshot-oriented: sorted keys are read, common prefixes form trie paths, the trie is encoded into compact arrays, and suffix bits are attached per the chosen false-positive budget. This fits immutable SSTables because filters rebuild when files flush or compact.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The one-sided guarantee comes from keeping every real key prefix needed by the truncated trie. Truncation can make an absent key look possible (the trie merges nearby absent keys into a shared prefix), but it cannot remove a real key path. The filter over-approximates the true key set -- it never under-approximates.',
        {
          type: 'diagram',
          text: 'Correctness contract:\n\n  Real keys in SSTable:  {far, fas, fat, top, toy}\n  Trie represents:       {fa*, to*}  (truncated after 2 bytes)\n\n  Query "fan":  fa* matches  =>  MAYBE  (false positive, safe)\n  Query "fog":  no match     =>  EMPTY  (true negative, correct)\n  Query "fat":  fa* matches  =>  MAYBE  (true positive, correct)\n\n  INVARIANT: real keys are always a subset of trie-represented keys.\n  The filter may widen the set. It must never shrink it.',
          label: 'One-sided error: over-approximation is safe, under-approximation is a bug',
        },
        'Bloom filters destroy order with hashing. SuRF preserves enough order to reason about intervals. That single difference is why Bloom can say "this exact key is absent" while SuRF can say "no key from this file falls inside this interval."',
        'Suffix bits control precision. Real suffix bits retain key-order information and help range pruning. Hash suffix bits reduce point false positives but do not help ordering. The suffix policy depends on whether the workload is point-heavy, range-heavy, or mixed.',
        {
          type: 'table',
          headers: ['Suffix type', 'Bits stored', 'Helps point queries', 'Helps range queries', 'Tradeoff'],
          rows: [
            ['None (SuRF-Base)', '0', 'No', 'No', 'Smallest filter, highest FPR'],
            ['Hash (SuRF-Hash)', 'Hash of remaining key', 'Yes', 'No -- hash has no order', 'Good for point-heavy workloads'],
            ['Real (SuRF-Real)', 'Actual next key bytes', 'Yes', 'Yes -- preserves order', 'Best for range-heavy workloads'],
            ['Mixed', 'Some hash + some real', 'Yes', 'Partial', 'Tunable compromise'],
          ],
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Time', 'Depends on'],
          rows: [
            ['Build filter', 'O(n * L)', 'n = keys, L = avg key length; one pass over sorted keys'],
            ['Point query', 'O(L)', 'Walk trie depth = key length; rank/select are O(1) with precomputed tables'],
            ['Range query', 'O(L)', 'Seek lower bound, check neighbor paths'],
            ['Space', '~10-14 bits/key typical', 'Depends on trie shape, suffix bits, key distribution'],
          ],
        },
        'The tradeoff is memory versus false positives. More suffix bits reduce unnecessary source reads but increase filter size. At 10 bits per key with real suffixes, the SuRF paper reports point FPR around 2% and range FPR around 1% on typical string workloads.',
        {
          type: 'note',
          text: 'False positives have different costs for points and ranges. A point false positive causes one table lookup. A range false positive can cause seeks, iterator setup, block reads, and downstream filtering across a large portion of a file. That asymmetry is why preserving order is worth the extra implementation complexity.',
        },
        'Query time follows key length and succinct navigation rather than independent hash probes. For short keys (8-32 bytes), this is comparable to Bloom. For very long keys, the trie walk is deeper but benefits from prefix sharing.',
        'Build cost matters. SuRF is not a good fit for highly mutable in-place sets where every insert must update the filter immediately. It fits systems that already create immutable sorted runs and build filters once per run.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'LSM tree SSTable filtering: attach SuRF to each sorted file; range scans skip files whose keys cannot overlap the query interval.',
            'Time-series shards: a query for user 42 between 10:00 and 10:05 skips files whose time prefixes fall outside that window.',
            'Multi-tenant key designs: tenant_id|timestamp|event_id keys share long prefixes; the trie captures that structure and prunes per-tenant ranges cheaply.',
            'Log search and dashboard queries: narrow time-window slices typically touch few files; a range filter rejects the rest and protects latency.',
            'Prefix scans: any workload using hierarchical keys (namespace|object, account|ledger_position, metric|time_bucket) benefits from trie-based prefix pruning.',
          ],
        },
        'The pattern is any ordered key space where empty ranges are common and source reads are expensive. SuRF pays for itself when it avoids disk seeks, block decompression, cache pollution, and compaction interference.',
        {
          type: 'code',
          language: 'text',
          text: '# RocksDB-style read path with SuRF\n#\n# Query: SELECT * WHERE tenant=17 AND time BETWEEN 10:00 AND 10:05\n#\n# Level 0:  SSTable A  keys [tenant=1..tenant=10]   SuRF => EMPTY, skip\n# Level 0:  SSTable B  keys [tenant=11..tenant=20]  SuRF => MAYBE, read\n# Level 1:  SSTable C  keys [tenant=15..tenant=25]  SuRF => MAYBE, read\n# Level 1:  SSTable D  keys [tenant=30..tenant=50]  SuRF => EMPTY, skip\n# Level 2:  SSTable E  keys [tenant=1..tenant=100]  SuRF => MAYBE, read\n#\n# Without SuRF: 5 SSTable reads.  With SuRF: 3 reads.  Saved: 2 disk seeks.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Unordered or random-prefix keys: if leading bytes are random hashes, the trie has no useful prefix locality and every query hits "maybe."',
            'Mostly single-key gets: a simpler Bloom, Ribbon, or Xor filter may be smaller, faster, and easier to implement.',
            'Very wide ranges: if nearly every SSTable overlaps the requested interval, the filter cannot prune much. Range filters reward narrow, selective queries.',
            'High-churn mutable sets: SuRF is snapshot-oriented. Frequent inserts require full rebuilds, not incremental updates.',
            'Poor key schema: timestamps before tenant IDs scatter tenant-specific queries across many prefixes, erasing the advantage of ordered prefix pruning.',
          ],
        },
        {
          type: 'note',
          text: 'Stale filters are dangerous only if the system treats them as authoritative after the underlying file changes. The standard answer is immutability: pair each filter with the exact file snapshot it summarizes and rebuild on compaction.',
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Mitigation'],
          rows: [
            ['Random-prefix keys', 'FPR approaches 100%', 'Restructure key schema; put selective dimensions first'],
            ['Wide range queries', 'Most files return MAYBE', 'Use coarser min/max bounds as a first filter'],
            ['Too few suffix bits', 'High FPR on narrow ranges', 'Increase real suffix bits; measure avoided-work improvement'],
            ['Filter outlives SSTable', 'Correctness risk', 'Immutable pairing: one filter per file snapshot'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'SuRF is the first practical data structure that supports both single-key lookups and range queries using only around 14 bits per key.',
          attribution: 'Zhang, Lim, Leis, Andersen, Kaminsky, Keeton, Pavlo, SIGMOD 2018',
        },
        {
          type: 'table',
          headers: ['Source', 'Link'],
          rows: [
            ['SuRF paper (SIGMOD 2018)', 'https://dl.acm.org/doi/10.1145/3183713.3196931'],
            ['Paper PDF (CMU)', 'https://db.cs.cmu.edu/papers/2018/mod601-zhangA-hm.pdf'],
            ['SIGMOD 2018 slides', 'https://people.iiis.tsinghua.edu.cn/~huanchen/slides/surf-sigmod18.pdf'],
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic'],
          rows: [
            ['Prerequisite', 'Trie and PATRICIA Trie -- prefix navigation that SuRF compresses'],
            ['Prerequisite', 'Rank/Select Bitvector -- the movement primitives inside the FST'],
            ['Contrast', 'Bloom Filter -- point-only filter that SuRF generalizes to ranges'],
            ['Contrast', 'Ribbon Filter -- modern point filter with better space efficiency'],
            ['Production context', 'RocksDB LSM Case Study -- the storage engine where SuRF deploys'],
            ['Extension', 'SSTable Block Index Filter -- file-level filtering in the broader read path'],
            ['Broader view', 'Database Indexing -- where range filters fit in the full index stack'],
          ],
        },
      ],
    },
  ],
};
