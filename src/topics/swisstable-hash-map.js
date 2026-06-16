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
      heading: 'What it is',
      paragraphs: [
        'SwissTable is the family of hash-table designs behind Abseil flat_hash_map, flat_hash_set, node_hash_map, and node_hash_set. It is still a hash table with expected O(1) lookup, insertion, and erase, but its performance comes from the physical layout: a flat slot array plus a parallel array of control bytes.',
        'The central idea is to use the hash twice. H1 chooses where probing starts. H2, a small tag from the same hash, is stored in a control byte so a lookup can scan a group of metadata before touching full keys. This turns many random key comparisons into cheap byte comparisons, which is exactly the kind of constant-factor engineering that dominates hot maps in large services.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lookup hashes the key, splits the hash into H1 and H2, scans a group of control bytes near the H1 bucket, and builds a candidate mask for slots whose H2 tag matches. Only those candidates run full equality checks. If the group has no match and no empty slot, probing advances to another group. Deleted slots keep probe chains alive; empty slots can stop a failed lookup.',
        'Because the metadata group is compact, implementations can use SIMD-style operations to compare many control bytes at once. The exact machine instruction is not the lesson; the lesson is data-oriented design. The table arranges the cheap evidence close together so the CPU can reject most nonmatches without chasing pointers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The asymptotic story is still average O(1), but the constant factors are the point. SwissTable trades one control byte per slot and a careful probing scheme for fewer cache misses and fewer key comparisons. Abseil documents a maximum load factor around 87.5 percent for flat Swiss tables, after which the table doubles.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Abseil positions Swiss tables as efficient alternatives to std::unordered_map and std::unordered_set, while warning that they are not drop-in replacements for every use. flat_hash_map stores values inline, which is fast but does not guarantee pointer stability across rehashes. node_hash_map preserves more address stability at the cost of extra allocation and indirection.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not benchmark a hash table only on Big-O notation. Hash quality, cache locality, load factor, key size, equality cost, deletion behavior, and iteration-order assumptions all matter. Migrating code can reveal hidden bugs if old code accidentally depended on deterministic iteration order or stable references.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Abseil Swiss Tables Design Notes at https://abseil.io/about/design/swisstables and Abseil Containers guide at https://abseil.io/docs/cpp/guides/container. Study Hash Table, Cuckoo Hashing, Quotient Filter, Binary Fuse Filter, B-Tree, Database Indexing, and W-TinyLFU Cache Admission next.',
      ],
    },
  ],
};
