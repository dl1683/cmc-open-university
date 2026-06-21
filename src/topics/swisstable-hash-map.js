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
        { type: "callout", text: "SwissTable spends one cheap metadata byte per slot to avoid touching expensive keys on most failed candidates." },
        "Read the animation as the execution trace for SwissTable Hash Map. A production hash-table design: split hashes into H1/H2, scan control-byte groups with SIMD-style masks, and keep values flat in memory..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/swisstable-hash-map.gif', alt: 'Animated walkthrough of the swisstable hash map visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
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
        'Hash maps are supposed to be O(1), but real machines do not execute Big-O. They load cache lines, chase pointers, branch, compare keys, and move memory during rehash. A table that does fewer random loads can beat a table with the same asymptotic bound.',
        'SwissTable is a production hash-table design built around that fact. It keeps entries flat, stores compact metadata next to the slots, and scans a group of control bytes before it touches full keys.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Chaining (each bucket holds a linked list) handles collisions but scatters memory: every list node is a separate allocation, poison for CPU caches. Open addressing stores everything in one flat array: on collision, probe the next slot.',
        'Linear probing checks slot h, h+1, h+2, ... -- simple, cache-friendly, but creates "clusters" where runs of occupied slots attract more collisions. The longer the cluster, the more likely the next insertion lands inside it and extends it further.',
        'Robin Hood hashing fixes clustering variance by stealing from the rich: if the current element has a shorter probe distance than the one already sitting in the slot, swap them. This keeps all probe sequences short and narrows the gap between best-case and worst-case lookup. SwissTable takes a different path: instead of reordering entries, it adds a fast metadata layer that skips most equality checks entirely.',
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
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg',
          alt: 'Computer cache hierarchy diagram from CPU registers through memory.',
          caption: 'SwissTable is a cache-locality story: compact metadata lets the CPU reject many slots before loading full key-value payloads. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.',
        },
        'A lookup hashes the key into a wide hash value. H1 determines the first probe group. H2 is stored in the metadata for full slots. The table compares the desired H2 against a small group of control bytes, often with SIMD-style operations, and gets a mask of plausible slots.',
        'For each bit in the candidate mask, the table performs the real equality check. If none match and the group has no empty slot, probing continues. A deleted slot cannot stop probing, because a later insertion may have passed through it. An empty slot can stop a failed lookup, because the key could not have been inserted beyond that empty position in the same probe sequence.',
        'The flat variant stores values inside the slot array. The node variant keeps element addresses more stable by paying for allocation and indirection. That choice affects correctness of user code that stores pointers or references into the map.',
      ],
    },
    {
      heading: 'How it works (2)',
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
      heading: 'Real-world uses',
      paragraphs: [
        'SwissTable-style maps win in hot in-memory indexes: compiler symbol tables, service metadata maps, routing tables, feature maps, dedup tables, and large C++ maps that do not need sorted iteration.',
        'The broader data-structure lesson is portable. If a small summary can reject most candidates, put that summary where the CPU can scan it cheaply before touching the heavy object.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'SwissTable is not an ordered map. It does not give predecessor queries, sorted scans, or deterministic ordering as a semantic contract. Use a tree or a sorted structure when order is the point.',
        '`flat_hash_map` is not a safe replacement for code that stores long-lived pointers or references into map elements. Rehash can move entries. If address stability matters, use a node-based variant or a different container.',
      ],
    },
    {
      heading: 'Where it fails (2)',
      paragraphs: [
        'Poor hash quality can still cluster probes. Adversarial keys can destroy the average-case story if the hash function is weak. Expensive destructors, huge values, and frequent rehashes can also dominate the metadata win.',
        'Migration bugs often come from accidental contracts in the old container: relying on iteration order, storing element addresses, expecting a particular erase return value, or assuming that a benchmark with integer keys predicts behavior for string-heavy production keys.',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Prerequisites: Hash Table (open addressing and chaining fundamentals), basic understanding of CPU caches and memory locality, and familiarity with bit manipulation (masks, popcount). If linear probing is unfamiliar, study Hash Table first -- SwissTable optimizes a probe sequence you need to understand before seeing the optimization.',
        'This topic unlocks several directions. Quotient Filter and Binary Fuse Filter use similar metadata-heavy designs for approximate membership. V8 Hidden Classes and Inline Caches show another case where data layout dominates speed over asymptotic complexity. B-Tree and Database Indexing cover the ordered-access path that hash tables cannot serve.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'SwissTable keeps a maximum load factor of 87.5%. Why not 100%? What happens to probe chain length as the table fills past 80%, and how does the H2 metadata filter change the practical cost curve compared to plain linear probing at the same load?',
            'Deleted slots use a special control byte that means "skip me but keep probing." Why can a tombstone not simply be marked empty? Construct a three-key insertion sequence where clearing a deleted slot to empty would make a later lookup incorrectly report "not found."',
            'Linear probing creates clusters: runs of occupied slots that grow because new keys landing anywhere inside the run extend it by one. SwissTable does not eliminate clustering -- it still uses open addressing. How does the H2 prefilter reduce the cost of walking through a cluster, even though the cluster is the same length?',
            'If you replaced the SwissTable H2 tags with a Bloom-filter-style bit array per group, what would you gain and what would you lose? Think about false-positive rates, memory per slot, and the ability to delete entries.',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why SwissTable Hash Map moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Knuth, The Art of Computer Programming, Volume 3, Section 6.4 gives the foundational analysis of linear probing -- expected probe lengths, clustering, and the sensitivity to load factor. Celis (1986) introduced Robin Hood hashing, which equalizes probe distances by displacing entries on insertion. The Abseil Swiss Tables Design Notes (https://abseil.io/about/design/swisstables) document the H1/H2 split, control-byte layout, and SIMD group scanning used in production C++ maps. The Abseil Containers guide (https://abseil.io/docs/cpp/guides/container) covers the flat_hash_map and node_hash_map API and migration considerations.',
          'Study next by role. Prerequisite: Hash Table (chaining and basic open addressing) to ground the collision model SwissTable improves on. Related structure: Bloom Filter, another hash-based design that trades accuracy for extreme space savings. Alternative collision strategy: Cuckoo Hashing, which guarantees worst-case O(1) lookup by maintaining two tables and displacing entries on collision. Distributed extension: Consistent Hashing, which maps keys to a ring of servers so adding a node moves only a fraction of the data.',
        ],
      },
],
};
