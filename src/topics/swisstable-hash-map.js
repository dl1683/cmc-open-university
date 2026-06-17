// SwissTable hash map: flat open addressing with control bytes and group
// probing, popularized by Abseil flat_hash_map.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'swisstable-hash-map',
  title: 'SwissTable Hash Map',
  category: 'Data Structures',
  summary: 'A production hash-table design: split hashes into H1/H2, scan control-byte groups with SIMD-style masks, and keep values flat in memory.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['probe groups', 'flat table tradeoffs'], defaultValue: 'probe groups' },
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

function* probeGroups() {
  yield {
    state: graphState({
      nodes: [
        { id: 'key', label: 'key', x: 0.9, y: 2.8, note: 'lookup' },
        { id: 'hash', label: 'hash64', x: 2.5, y: 2.8, note: 'avalanche' },
        { id: 'split', label: 'H1/H2', x: 4.1, y: 2.8, note: 'bucket+tag' },
        { id: 'ctrl', label: 'ctrl', x: 5.8, y: 2.8, note: '16 bytes' },
        { id: 'mask', label: 'mask', x: 7.4, y: 2.8, note: 'matches' },
        { id: 'eq', label: 'equals', x: 9.0, y: 2.8, note: 'few keys' },
      ],
      edges: [
        { id: 'e-key-hash', from: 'key', to: 'hash', weight: '' },
        { id: 'e-hash-split', from: 'hash', to: 'split', weight: '' },
        { id: 'e-split-ctrl', from: 'split', to: 'ctrl', weight: '' },
        { id: 'e-ctrl-mask', from: 'ctrl', to: 'mask', weight: '' },
        { id: 'e-mask-eq', from: 'mask', to: 'eq', weight: '' },
      ],
    }, { title: 'Lookup filters a probe group before touching keys' }),
    highlight: { active: ['split', 'ctrl', 'mask'], found: ['eq'] },
    explanation: 'SwissTable splits the hash. H1 chooses where probing starts; H2 is stored in a compact control byte. A group scan finds only slots whose H2 tag could match, so expensive key equality checks are rare.',
  };

  yield {
    state: labelMatrix(
      'One 16-byte control group',
      [{ id: 'ctrl', label: 'ctrl' }],
      Array.from({ length: 16 }, (_, i) => ({ id: `c${i}`, label: String(i) })),
      [['E', '7a', '11', 'D', '2f', '7a', '80', '01', 'E', '9c', '7a', '44', 'D', '32', '10', 'E']],
    ),
    highlight: { active: ['ctrl:c1', 'ctrl:c5', 'ctrl:c10'], compare: ['ctrl:c0', 'ctrl:c8', 'ctrl:c15'] },
    explanation: 'The control array stores tiny metadata beside the slots: empty, deleted, or a 7-bit H2 tag. A lookup for H2=7a creates a mask for candidate slots 1, 5, and 10, then checks only those actual keys.',
    invariant: 'Control bytes are a fast prefilter; the real key comparison still decides equality.',
  };

  yield {
    state: labelMatrix(
      'Probe decision',
      [
        { id: 'hit', label: 'candidate' },
        { id: 'empty', label: 'empty' },
        { id: 'deleted', label: 'deleted' },
        { id: 'next', label: 'next group' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'action', label: 'action' },
      ],
      [
        ['H2 tag', 'check key'],
        ['stop', 'not found'],
        ['skip', 'keep probing'],
        ['probe', 'scan group'],
      ],
    ),
    highlight: { found: ['hit:action', 'empty:action', 'deleted:action'] },
    explanation: 'Deleted slots cannot terminate a probe chain, but an empty slot can. That rule preserves correctness while keeping open addressing compact.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'load factor', min: 0.35, max: 0.90 }, y: { label: 'key comparisons per miss', min: 0, max: 8 } },
      series: [
        { id: 'classic', label: 'classic linear probing', points: [{ x: 0.40, y: 0.8 }, { x: 0.60, y: 1.5 }, { x: 0.75, y: 3.2 }, { x: 0.86, y: 6.5 }] },
        { id: 'swiss', label: 'SwissTable-style filter', points: [{ x: 0.40, y: 0.2 }, { x: 0.60, y: 0.35 }, { x: 0.75, y: 0.7 }, { x: 0.86, y: 1.2 }] },
      ],
    }),
    highlight: { active: ['swiss'], compare: ['classic'] },
    explanation: 'The exact curve depends on data and hashing, but the design goal is clear: scan metadata cheaply, avoid cache misses, and delay real key comparisons until a compact filter says they are plausible.',
  };
}

function* flatTableTradeoffs() {
  yield {
    state: labelMatrix(
      'Flat vs node hash maps',
      [
        { id: 'flat', label: 'flat' },
        { id: 'node', label: 'node' },
        { id: 'std', label: 'std chain' },
      ],
      [
        { id: 'layout', label: 'layout' },
        { id: 'good', label: 'good at' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['inline', 'cache hits', 'rehash moves'],
        ['pointers', 'stable addr', 'extra alloc'],
        ['buckets', 'familiar', 'pointer chase'],
      ],
    ),
    highlight: { active: ['flat:layout', 'flat:good'], compare: ['node:risk', 'std:risk'] },
    explanation: 'Abseil flat_hash_map stores values inline in the slot array. That is cache friendly, but rehashing can move values and invalidate pointers. Node variants trade memory and indirection for address stability.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'api', label: 'API', x: 0.9, y: 2.8, note: 'map/set' },
        { id: 'layout', label: 'layout', x: 2.8, y: 2.8, note: 'flat/node' },
        { id: 'load', label: 'load', x: 4.7, y: 3.5, note: 'up to 7/8' },
        { id: 'ptr', label: 'pointers', x: 4.7, y: 2.1, note: 'stability' },
        { id: 'perf', label: 'perf', x: 6.8, y: 2.8, note: 'cache/SIMD' },
        { id: 'bugs', label: 'bugs', x: 8.6, y: 2.8, note: 'order deps' },
      ],
      edges: [
        { id: 'e-api-layout', from: 'api', to: 'layout', weight: '' },
        { id: 'e-layout-load', from: 'layout', to: 'load', weight: '' },
        { id: 'e-layout-ptr', from: 'layout', to: 'ptr', weight: '' },
        { id: 'e-load-perf', from: 'load', to: 'perf', weight: '' },
        { id: 'e-ptr-bugs', from: 'ptr', to: 'bugs', weight: '' },
        { id: 'e-perf-bugs', from: 'perf', to: 'bugs', weight: '' },
      ],
    }, { title: 'Container migration is a contract audit' }),
    highlight: { active: ['layout', 'ptr', 'perf'], found: ['bugs'] },
    explanation: 'SwissTable is a systems lesson: a faster container changes memory layout, pointer stability, erase behavior, and iteration order assumptions.',
  };

  yield {
    state: labelMatrix(
      'Migration checklist',
      [
        { id: 'hash', label: 'hash' },
        { id: 'order', label: 'order' },
        { id: 'addr', label: 'addr' },
        { id: 'erase', label: 'erase' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['good entropy?', 'clusters'],
        ['relies on order?', 'nondeterminism'],
        ['stores refs?', 'dangling'],
        ['expects iter?', 'API mismatch'],
      ],
    ),
    highlight: { found: ['hash:question', 'order:question', 'addr:question', 'erase:question'] },
    explanation: 'The right migration review is not "is SwissTable faster?" It is "which contracts did the old table accidentally provide, and does the new table intentionally provide them?"',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'table size', min: 0, max: 100 }, y: { label: 'relative memory traffic', min: 0, max: 1.0 } },
      series: [
        { id: 'node', label: 'node/chained map', points: [{ x: 5, y: 0.25 }, { x: 25, y: 0.55 }, { x: 50, y: 0.78 }, { x: 100, y: 0.95 }] },
        { id: 'flat', label: 'flat SwissTable', points: [{ x: 5, y: 0.18 }, { x: 25, y: 0.30 }, { x: 50, y: 0.42 }, { x: 100, y: 0.55 }] },
      ],
    }),
    highlight: { active: ['flat'], compare: ['node'] },
    explanation: 'Flat layout and metadata scanning reduce pointer chasing. The lesson generalizes beyond C++: data layout is often the difference between theoretical O(1) and practical throughput.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'probe groups') yield* probeGroups();
  else if (view === 'flat table tradeoffs') yield* flatTableTradeoffs();
  else throw new InputError('Pick a SwissTable view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Hash maps are supposed to be O(1), but real machines do not execute Big-O. They load cache lines, chase pointers, branch, compare keys, and move memory during rehash. A table that does fewer random loads can beat a table with the same asymptotic bound.',
        'SwissTable is a production hash-table design built around that fact. It keeps entries flat, stores compact metadata next to the slots, and scans a group of control bytes before it touches full keys.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A classic chained hash table stores bucket heads that point to heap-allocated nodes. It is simple, familiar, and can keep element addresses stable. The cost is allocation overhead and pointer chasing when collisions occur.',
        'A plain open-addressed table removes many pointers by storing entries in an array. That improves locality, but failed lookups can walk long probe clusters and compare many real keys. If keys are strings, structs, or cache-cold objects, equality becomes expensive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the failed lookup. The key is not present, but the table still has to prove absence. In a dense open-addressed table, that proof may inspect several slots before it reaches an empty marker.',
        'SwissTable changes the question order. Before asking "is this key equal?", it asks "does this slot even have the right short hash tag?" Most slots fail that cheap metadata test, so the full key comparison never runs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the hash. H1 chooses where probing starts. H2 is a short tag stored in one byte of metadata for the slot. A lookup scans a group of control bytes, builds a bit mask of candidate H2 matches, and only compares the real keys behind those candidates.',
        'The control byte is a prefilter, not equality. A matching H2 tag says "this slot might be the key." A nonmatching tag says "this slot cannot be the key." The full key comparison remains the final authority.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lookup hashes the key into a wide hash value. H1 determines the first probe group. H2 is stored in the metadata for full slots. The table compares the desired H2 against a small group of control bytes, often with SIMD-style operations, and gets a mask of plausible slots.',
        'For each bit in the candidate mask, the table performs the real equality check. If none match and the group has no empty slot, probing continues. A deleted slot cannot stop probing, because a later insertion may have passed through it. An empty slot can stop a failed lookup, because the key could not have been inserted beyond that empty position in the same probe sequence.',
        'The flat variant stores values inside the slot array. The node variant keeps element addresses more stable by paying for allocation and indirection. That choice affects correctness of user code that stores pointers or references into the map.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the probe-groups view, follow the path from key to hash to H1/H2 split. The important visual move is not the arrow; it is the filter. The control-byte group is searched before the full entries are touched.',
        'In the 16-byte control group, the repeated H2 tag marks candidate slots. Empty cells matter because they prove absence. Deleted cells matter because they preserve the probe chain. The mask is the reason a dense table can skip most equality checks.',
        'In the flat-table view, read the comparison as an API audit. The flat layout reduces pointer chasing, but rehash can move elements. The node layout spends memory and extra loads to keep addresses more stable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The H2 tag is allowed to have false positives. Two different keys can share the same short tag. That only costs an equality check. It cannot create a false hit because the actual key comparison still runs.',
        'The table proves absence with the first empty slot in the probe sequence. If the key had been inserted earlier, insertion would have found the same probe path and would not have skipped an empty slot. Deleted slots are different: they once held entries, so they cannot prove that later entries are absent.',
        'The performance argument is separate from the correctness argument. Correctness comes from open-addressing probe rules. Speed comes from doing many cheap metadata checks before a few expensive object checks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a lookup starts at a group whose control bytes contain tags E, 7a, 11, D, 2f, 7a, 80, 01, E, 9c, 7a, 44, D, 32, 10, E. The desired H2 is 7a. The metadata scan returns candidate positions 1, 5, and 10.',
        'The table compares the lookup key only with the entries at slots 1, 5, and 10. If none are equal, the empty markers in the same group can stop the miss. If the group had no empty marker, probing would continue to the next group.',
        'That example shows the core trade. The table may scan more metadata bytes than a simple map, but those bytes are compact and cache-friendly. It tries to spend bandwidth on cheap metadata instead of expensive key loads.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The average lookup, insert, and erase story is still O(1) under ordinary hash-table assumptions. The point is the constant factor: one metadata byte per slot, grouped probing, and a high-quality hash can reduce cache misses and full equality checks.',
        'Abseil documents Swiss-table metadata based on a 64-bit hash split into H1 and a 7-bit H2 tag. Its container guide describes memory as roughly the slot payload plus one metadata byte per bucket, with a maximum load factor of 87.5 percent before growth.',
        'When the table grows, flat entries can move. That rehash cost is occasional, but it matters for latency-sensitive paths and for code that has kept references into the table.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'SwissTable-style maps win in hot in-memory indexes: compiler symbol tables, service metadata maps, routing tables, feature maps, dedup tables, and large C++ maps that do not need sorted iteration.',
        'The broader data-structure lesson is portable. If a small summary can reject most candidates, put that summary where the CPU can scan it cheaply before touching the heavy object.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'SwissTable is not an ordered map. It does not give predecessor queries, sorted scans, or deterministic ordering as a semantic contract. Use a tree or a sorted structure when order is the point.',
        '`flat_hash_map` is not a safe replacement for code that stores long-lived pointers or references into map elements. Rehash can move entries. If address stability matters, use a node-based variant or a different container.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Poor hash quality can still cluster probes. Adversarial keys can destroy the average-case story if the hash function is weak. Expensive destructors, huge values, and frequent rehashes can also dominate the metadata win.',
        'Migration bugs often come from accidental contracts in the old container: relying on iteration order, storing element addresses, expecting a particular erase return value, or assuming that a benchmark with integer keys predicts behavior for string-heavy production keys.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Abseil Swiss Tables Design Notes at https://abseil.io/about/design/swisstables and the Abseil Containers guide at https://abseil.io/docs/cpp/guides/container.',
        'Study Hash Table for the base invariant, Cuckoo Hashing for a different collision strategy, Quotient Filter and Binary Fuse Filter for metadata-heavy membership ideas, B-Tree and Database Indexing for ordered access, and V8 Hidden Classes and Inline Caches for another example where layout dominates speed.',
      ],
    },
  ],
};
