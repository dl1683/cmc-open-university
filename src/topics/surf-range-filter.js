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
      heading: 'Why this exists',
      paragraphs: [
        'Storage engines often need to know whether a whole key interval can be skipped. A Bloom filter can reject one absent key, but it cannot prove that no key exists between apple and apricot. SuRF exists for ordered data where empty ranges are common and source reads are expensive.',
        'The common setting is an LSM tree with many immutable sorted files. A point lookup asks whether one exact key might be in each file. A range scan asks a broader question: could any key in this file overlap [left, right]? If many files are cold or disjoint from the requested range, answering that question before reading blocks can save disk seeks, decompression, cache space, and CPU time.',
        'SuRF stands for Succinct Range Filter. It keeps enough ordered key structure to reason about prefixes and intervals, while compressing the trie enough to be usable as a filter rather than a full in-memory index.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is one Bloom filter per file or block. That helps point lookups: if the exact key is absent, skip the file. Range scans still have to seek through files because the filter has no order. It hashes keys on purpose, and hashing destroys prefix and interval structure.',
        'Another tempting approach is to store min and max keys for every file. That can reject ranges that are completely outside the file, but it cannot reject holes inside the file. If a file contains keys near a and keys near z, the min/max interval covers everything between them even if most middle prefixes are absent.',
        'A full trie over all keys would answer richer prefix and range questions, but a pointer-heavy trie can be too large for a per-file filter. The storage engine needs a middle ground: more ordered structure than a hash filter and much less memory than a normal trie.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A normal trie preserves order but costs too many pointers and nodes for a compact filter. A compact hash filter saves memory but loses range reasoning. The wall is keeping enough trie order to reject ranges without storing full keys or a pointer-heavy tree.',
        'That wall matters because filters live on the hot path. A filter that saves disk reads but doubles memory pressure can lose in the block cache. A filter that is compact but slow can add latency to every lookup. A range filter has to be small, navigable, and safe: it may return maybe too often, but it must not claim empty when a real key exists.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Encode a trie succinctly, then truncate it carefully. The trie keeps sorted-prefix navigation, while bitvectors and rank/select replace bulky child pointers. Optional suffix bits lower false positives without storing entire keys.',
        'The invariant is one-sided error. SuRF is allowed to say maybe for an absent point key or an empty range. It is not allowed to say definitely absent when the source table contains a matching key. The compressed trie and suffix choices must preserve that safety property.',
        'This turns range filtering into a navigation problem. Instead of hashing a key several times, the filter walks ordered prefixes and asks whether any path in the truncated trie could land inside the query interval.',
      ],
    },
    {
      heading: 'Visual guide',
      paragraphs: [
        'In the succinct-trie view, focus on what order information survives compression. Labels, child bits, LOUDS shape, and suffix bits are not decorative encoding details. They are the pieces that let the filter navigate prefixes without pointer-heavy trie nodes.',
        'In the range-pruning view, interpret maybe as a performance result, not a correctness result. A definite empty can skip the SSTable. A possible overlap must consult the source of truth. SuRF is useful because many expensive range reads become definite negatives.',
        'The SSTable node is deliberately the source of truth. SuRF is a front gate. It saves work only when it can reject; it never replaces the sorted file for positive answers.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'SuRF builds a Fast Succinct Trie from sorted keys. A point lookup walks labels and suffix information. A range lookup asks whether any trie path could fall inside the interval. If no path can match, the answer is definitely empty. If a path might match, the storage engine checks the source table.',
        'The Fast Succinct Trie stores labels in arrays and tree shape in bitvectors. Rank/select operations recover navigation that a normal trie would get from pointers. Suffix bits tune precision: real suffix bits preserve key-order information, hash suffix bits reduce point false positives, and mixed choices trade space for pruning power.',
        'LOUDS, or level-order unary degree sequence, is one common way to encode tree shape. Instead of storing child pointers on every node, the structure stores bitvectors that describe which nodes have children and where those children appear in level order. Rank/select primitives turn positions in those bitvectors into parent-child navigation.',
        'The build process is snapshot-oriented. Sorted keys are read, common prefixes form trie paths, the trie is encoded into compact arrays, and suffix bits are attached according to the chosen false-positive budget. This fits immutable SSTables because filters can be rebuilt when files are flushed or compacted.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The one-sided guarantee comes from keeping all real key prefixes needed by the truncated trie. Truncation can make an absent key or empty range look possible, but it cannot remove a real key path in a way that would reject existing data. False positives waste reads; false negatives would be correctness bugs.',
        'Bloom filters deliberately destroy order with hashing. SuRF preserves enough order to reason about intervals. That single difference is why a Bloom filter can say this exact key is absent, while SuRF can often say no key from this sorted file can fall inside this interval.',
        'For point lookups, an absent key may share all stored prefix information and suffix bits with a real key, so SuRF can return maybe. For range lookups, an empty interval may still cross a truncated prefix that could hide a real key, so SuRF again returns maybe. These are safe over-approximations of the real key set.',
        'The correctness contract is therefore simple: every stored key must remain represented by at least one navigable path through the filter. The filter may merge absent space into represented space, but it must not carve out represented keys.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The tradeoff is memory versus false positives. More suffix bits reduce unnecessary source reads and increase filter size. Query time follows key length and succinct navigation rather than several independent hashes. SuRF is usually built for immutable sorted files, which fits LSM engines that flush and compact SSTables.',
        'The workload determines whether the extra structure is worth it. If most reads are exact-key gets, a simpler point filter may win. If range scans regularly touch many sorted files only to discover they are empty, SuRF earns its memory by preventing disk, decompression, and block-cache work.',
        'False positives have different costs for points and ranges. A point false positive usually causes one table lookup. A range false positive can cause seeks, iterator setup, block reads, and downstream filtering across a larger part of a file. That is why preserving order can be worth extra implementation complexity.',
        'Build cost matters too. SuRF is not a great fit for a highly mutable in-place set where every insert must update the filter immediately. It fits systems that already create immutable sorted runs and can build filters once per run.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'A RocksDB-like LSM tree serving user_id/time scans can attach SuRF to each SSTable. A query for user 42 between 10:00 and 10:05 can skip files whose keys cannot overlap that interval. The payoff is fewer seeks, block reads, cache misses, and compaction interference.',
        'It also wins for prefix-heavy key designs: tenant_id plus timestamp, namespace plus object key, account plus ledger position, or metric name plus time bucket. The shared prefixes make the trie meaningful, and the ordered suffix lets the filter reject many irrelevant intervals.',
        'SuRF is especially useful when range misses are common. Dashboards, log search, time-window scans, and multi-tenant stores often ask for narrow slices that touch only a few files. A filter that can reject the rest protects both latency and shared storage resources.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SuRF is not a replacement for the table. Maybe still means consult the source of truth. It is also the wrong shape for unordered data or mostly single-key gets where a simpler Bloom, Ribbon-family, or Xor-style filter may be smaller or faster.',
        'It also struggles with very wide ranges. If nearly every SSTable overlaps the requested interval, the filter cannot prune much. Range filters are best when key design clusters related data and many files occupy disjoint key intervals.',
        'Poor key design can erase the advantage. If the leading bytes are random hashes, the trie has little useful prefix locality. If timestamps are placed before tenant ids, a tenant-specific query may scatter across many prefixes. Ordered filters reward schemas that put the most selective range dimensions early enough to prune.',
        'Operationally, stale filters are dangerous only if the system treats them as authoritative after the underlying file changes. The usual answer is immutability: pair each filter with the exact file snapshot it summarizes, and rebuild on compaction rather than mutating the filter independently.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine an LSM level with sorted files keyed as tenant_id|timestamp|event_id. A query for tenant 17 between 10:00 and 10:05 checks many files. A point Bloom filter cannot answer whether a file has any key in that interval. SuRF can walk the tenant and time prefixes and often return definite empty for files whose key ranges fall elsewhere.',
        'When the answer is maybe, the engine still reads the table block and checks the real keys. That is the safe part of the design. SuRF only removes work when it can prove absence under its truncated trie representation; it never invents data or hides existing keys.',
        'If the filter stores only short prefixes, many tenant 17 time ranges may collapse into maybe. Adding real suffix bits can help range pruning because they retain more ordered information about the hidden tail. Adding hash suffix bits may improve point lookup precision but is less helpful for ordering. The right suffix policy depends on whether the workload is point-heavy, range-heavy, or mixed.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the API honest. A range filter should return definite empty or maybe, not true or false as if it were the source of truth. That naming prevents callers from accidentally treating a false positive as a real hit.',
        'Build from sorted, normalized byte keys. Locale-dependent string comparison, mixed encodings, or inconsistent separators can break the relationship between trie order and table order. The filter and SSTable comparator must agree exactly.',
        'Measure by avoided work, not only false-positive rate. A range false positive on a large cold file is more expensive than a point false positive on a cached block. Useful metrics include filter bytes per key, point false-positive rate, range false-positive rate by interval width, skipped files, skipped blocks, and end-to-end read latency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SuRF paper PDF at https://db.cs.cmu.edu/papers/2018/mod601-zhangA-hm.pdf, ACM DOI https://dl.acm.org/doi/10.1145/3183713.3196931, and SIGMOD slides at https://people.iiis.tsinghua.edu.cn/~huanchen/slides/surf-sigmod18.pdf.',
        'Study Trie and PATRICIA Trie for prefix navigation, Rank/Select Bitvector for succinct movement, Bloom Filter and Ribbon Filter for point-filter contrast, RocksDB LSM Case Study for the storage setting, SSTable Block Index Filter for file-level filtering, and Database Indexing for the broader read-path design.',
      ],
    },
  ],
};
