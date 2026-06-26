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
  const lookupStages = ['key', 'hash64', 'H1/H2', 'ctrl', 'mask', 'equals'];
  const groupSize = 16;
  const h2Target = '7a';

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
    explanation: `SwissTable splits the hash across ${lookupStages.length} stages: ${lookupStages.join(' -> ')}. H1 chooses where probing starts; H2 is stored in a compact control byte. A group scan finds only slots whose H2 tag could match, so expensive key equality checks are rare.`,
  };

  const h2Candidates = [1, 5, 10];
  yield {
    state: labelMatrix(
      'One 16-byte control group',
      [{ id: 'ctrl', label: 'ctrl' }],
      Array.from({ length: groupSize }, (_, i) => ({ id: `c${i}`, label: String(i) })),
      [['E', '7a', '11', 'D', '2f', '7a', '80', '01', 'E', '9c', '7a', '44', 'D', '32', '10', 'E']],
    ),
    highlight: { active: ['ctrl:c1', 'ctrl:c5', 'ctrl:c10'], compare: ['ctrl:c0', 'ctrl:c8', 'ctrl:c15'] },
    explanation: `The control array stores ${groupSize} tiny metadata bytes beside the slots: empty, deleted, or a 7-bit H2 tag. A lookup for H2=${h2Target} creates a mask for ${h2Candidates.length} candidate slots (${h2Candidates.join(', ')}), then checks only those actual keys.`,
    invariant: `Control bytes are a fast prefilter; the real key comparison still decides equality.`,
  };

  const probeOutcomes = ['candidate', 'empty', 'deleted', 'next group'];
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
    explanation: `Each slot in a ${groupSize}-byte group falls into one of ${probeOutcomes.length} outcomes: ${probeOutcomes.join(', ')}. Deleted slots cannot terminate a probe chain, but an empty slot can. That rule preserves correctness while keeping open addressing compact.`,
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
    explanation: `The exact curve depends on data and hashing, but the design goal is clear: scan ${groupSize} metadata bytes cheaply, avoid cache misses, and delay real key comparisons until a compact filter says they are plausible.`,
  };
}

function* flatTableTradeoffs() {
  const layouts = ['flat', 'node', 'std chain'];
  const maxLoadFactor = 7 / 8;

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
    explanation: `Abseil flat_hash_map stores values inline in the slot array, comparing ${layouts.length} layout strategies. That is cache friendly, but rehashing at ${(maxLoadFactor * 100).toFixed(1)}% load can move values and invalidate pointers. Node variants trade memory and indirection for address stability.`,
  };

  const migrationConcerns = ['layout', 'pointers', 'perf', 'bugs'];
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
    explanation: `SwissTable is a systems lesson: a faster container changes ${migrationConcerns.length} concerns — ${migrationConcerns.join(', ')}. Memory layout, pointer stability, erase behavior, and iteration order assumptions all shift.`,
  };

  const checklistItems = ['hash', 'order', 'addr', 'erase'];
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
    explanation: `The right migration review asks ${checklistItems.length} questions (${checklistItems.join(', ')}): not "is SwissTable faster?" but "which contracts did the old table accidentally provide, and does the new table intentionally provide them?"`,
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
    explanation: `Flat layout and metadata scanning reduce pointer chasing. With a max load of ${(maxLoadFactor * 100).toFixed(1)}%, the lesson generalizes beyond C++: data layout is often the difference between theoretical O(1) and practical throughput.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        {
          type: 'callout',
          text: 'SwissTable spends one cheap metadata byte per slot to avoid touching expensive keys on most failed candidates.',
        },
        'Read the probe-groups view as a failed-lookup proof. The control bytes are checked first; only slots whose short H2 tag matches become real key-comparison candidates.',
        'Read empty and deleted control bytes differently. An empty byte proves the lookup can stop; a deleted byte cannot stop the probe chain because later keys may have passed through it.',
        {
          type: 'image',
          src: './assets/gifs/swisstable-hash-map.gif',
          alt: 'Animated walkthrough of the swisstable hash map visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg',
          alt: 'Hash table diagram with keys mapped into buckets and collision chains.',
          caption: 'A conventional hash table explains the collision problem; SwissTable keeps open addressing but adds a metadata filter before key comparison. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_5_0_1_1_1_1_1_LL.svg.',
        },
        'A hash map promises expected O(1) lookup, but machines pay in cache misses, branches, key comparisons, and pointer chasing. SwissTable exists because a table with the same Big-O can be much faster when its memory layout matches the CPU.',
        'The design goal is to keep entries flat in memory and reject most nonmatching slots by scanning compact metadata. That shifts work from expensive random payload loads to cheap byte comparisons.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Chaining stores a linked list or small container at each bucket. It handles collisions simply, but each collision can add pointer chasing and separate allocation.',
        'Plain open addressing stores entries in an array and probes forward after collisions. It improves locality, but a failed lookup in a dense table can inspect many full slots before reaching an empty one.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is proving absence. If a key is not present, the table must search until it reaches evidence that the probe sequence could not have continued.',
        'At high load, many slots are full, and full key equality checks can dominate cost. Long strings, compound keys, or cache-cold payloads make each unnecessary comparison visible.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the hash into H1 and H2. H1 chooses the probe-group start, while H2 is a short tag stored in a control byte beside each slot.',
        'A lookup scans a group of control bytes and builds a mask of H2 matches. A nonmatching tag proves the full key cannot be there; a matching tag only says to run the real equality check.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg',
          alt: 'Computer cache hierarchy diagram from CPU registers through memory.',
          caption: 'SwissTable is a cache-locality story: compact metadata lets the CPU reject many slots before loading full key-value payloads. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.',
        },
        'Each slot has a control byte that marks empty, deleted, or full with a short H2 tag. The table probes groups of control bytes, commonly 16 bytes at a time, so one vector-like comparison can test many slots.',
        'On lookup, a candidate mask points to slots whose H2 matches the searched key. The table checks only those full keys. If the group contains an empty marker and no key matched, absence is proven.',
        'Insertion follows the same probe sequence and uses an empty or reusable deleted slot. Rehashing grows the table before probe chains become too long, often around a high load factor such as seven eighths.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the open-addressing invariant: every key is stored somewhere on the probe sequence determined by its hash. A lookup follows the same sequence, so it cannot skip a possible location.',
        'H2 tags are filters with false positives but no false negatives for the stored tag. If the tag differs, the key cannot match that slot; if the tag matches, the full equality test remains the authority.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Expected lookup, insert, and erase remain O(1) with a good hash and controlled load factor. The practical behavior improves because many failed slots cost one metadata-byte comparison rather than one key load and equality check.',
        'If a 16-byte group stores 7-bit H2 tags, a random failed lookup expects 16 / 128 = 0.125 accidental tag matches per group. Most groups therefore trigger zero full key comparisons.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SwissTable-style maps fit performance-sensitive C++ and systems code where hash maps are hot paths. Abseil flat_hash_map and related designs use the flat layout to reduce memory traffic.',
        'They are especially useful for small keys, interned strings, compiler tables, routing maps, and deduplication sets where lookup misses are frequent and cache behavior dominates.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Flat maps can move elements during rehash, so code that stores pointers or references into the map can break. Node variants trade speed and memory for address stability.',
        'Bad hash functions still hurt. If H1 clusters keys or H2 tags collide heavily, metadata filtering cannot rescue the table from long probe sequences and excess equality checks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A lookup wants H2 = 0x7a in a 16-slot group. The control bytes contain 0x7a at slots 1, 5, and 10, plus empty markers at slots 0, 8, and 15.',
        'The mask points to three candidate slots, so only three full keys are compared. If none match and an empty marker appears in the same group, the key is absent; the other occupied slots were rejected by metadata alone.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Abseil Swiss Tables design notes and Google dense hash table history for the production context. Next study hash tables, open addressing, Robin Hood hashing, cache locality, and SIMD-style byte masks.',
      ],
    },
  ],
};
