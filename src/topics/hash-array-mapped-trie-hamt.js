// Hash array mapped trie: split a key hash into chunks, use each chunk as a
// trie level, and compress sparse child arrays with bitmaps.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'hash-array-mapped-trie-hamt',
  title: 'Hash Array Mapped Trie (HAMT)',
  category: 'Data Structures',
  summary: 'The persistent hash-map engine behind immutable collections: hash chunks choose trie branches, bitmaps compress sparse nodes, and updates path-copy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lookup and bitmap', 'persistent update'], defaultValue: 'lookup and bitmap' },
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

function* lookupAndBitmap() {
  yield {
    state: graphState({
      nodes: [
        { id: 'key', label: 'key', x: 0.8, y: 4.0, note: 'user42' },
        { id: 'hash', label: 'hash', x: 2.3, y: 4.0, note: 'bits' },
        { id: 'chunk', label: '5-bit', x: 3.9, y: 4.0, note: 'level' },
        { id: 'bitmap', label: 'bitmap', x: 5.7, y: 4.0, note: 'occupied' },
        { id: 'array', label: 'array', x: 7.4, y: 4.0, note: 'dense' },
        { id: 'leaf', label: 'value', x: 9.0, y: 4.0, note: 'found' },
      ],
      edges: [
        { id: 'e-key-hash', from: 'key', to: 'hash' },
        { id: 'e-hash-chunk', from: 'hash', to: 'chunk' },
        { id: 'e-chunk-bitmap', from: 'chunk', to: 'bitmap' },
        { id: 'e-bitmap-array', from: 'bitmap', to: 'array' },
        { id: 'e-array-leaf', from: 'array', to: 'leaf' },
      ],
    }, { title: 'A HAMT walks chunks of the hash, not characters' }),
    highlight: { active: ['hash', 'chunk', 'bitmap'], found: ['leaf'] },
    explanation: 'A HAMT starts like a Hash Table: hash the key. Then it reads the hash in fixed-size chunks, commonly 5 bits at a time, and uses those chunks as levels in a Trie.',
    invariant: 'Same hash prefix means shared trie path.',
  };

  yield {
    state: labelMatrix(
      'Bitmap compresses a sparse 32-way node',
      [
        { id: 'slots', label: 'logical slots' },
        { id: 'bitmap', label: 'bitmap' },
        { id: 'rank', label: 'rank' },
        { id: 'dense', label: 'dense array' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['0..31', 'virtual fanout'],
        ['bits 2,9,27', 'occupied'],
        ['popcount before 9 = 1', 'array index'],
        ['[slot2, slot9, slot27]', 'compact'],
      ],
    ),
    highlight: { active: ['bitmap:example', 'rank:example'], found: ['dense:meaning'] },
    explanation: 'The trick is not storing 32 pointers in every node. A bitmap marks which logical children exist, and popcount maps a logical slot to the compact child-array index.',
  };

  yield {
    state: labelMatrix(
      'Lookup steps',
      [
        { id: 'l0', label: 'level 0' },
        { id: 'l1', label: 'level 1' },
        { id: 'leaf', label: 'leaf' },
      ],
      [
        { id: 'bits', label: 'hash bits' },
        { id: 'action', label: 'action' },
      ],
      [
        ['00101', 'child 5'],
        ['11010', 'child 26'],
        ['equals key', 'return value'],
      ],
    ),
    highlight: { found: ['leaf:action'], active: ['l0:bits', 'l1:bits'] },
    explanation: 'A good hash spreads keys so the trie stays shallow. Collisions are handled at leaves with key equality, collision nodes, or deeper chunks depending on implementation.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'keys', min: 1, max: 1000000 }, y: { label: 'levels at 32-way fanout', min: 0, max: 5 } },
      series: [
        { id: 'depth', label: 'log32 n', points: [{ x: 1, y: 1 }, { x: 1000, y: 2 }, { x: 32768, y: 3 }, { x: 1000000, y: 4 }] },
      ],
    }),
    highlight: { found: ['depth'] },
    explanation: 'The branching factor is why HAMT operations feel close to O(1) in practice. A million keys need only a handful of 5-bit levels before leaf checks.',
  };
}

function* persistentUpdate() {
  yield {
    state: graphState({
      nodes: [
        { id: 'root0', label: 'root v0', x: 0.8, y: 2.8, note: 'old map' },
        { id: 'a', label: 'node A', x: 2.8, y: 2.8, note: 'shared' },
        { id: 'b', label: 'node B', x: 4.8, y: 2.8, note: 'shared' },
        { id: 'leaf0', label: 'old val', x: 6.9, y: 2.8, note: 'x=1' },
        { id: 'root1', label: 'root v1', x: 0.8, y: 5.7, note: 'new map' },
        { id: 'a1', label: 'node A', x: 2.8, y: 5.7, note: 'copy' },
        { id: 'b1', label: 'node B', x: 4.8, y: 5.7, note: 'copy' },
        { id: 'leaf1', label: 'new val', x: 6.9, y: 5.7, note: 'x=2' },
      ],
      edges: [
        { id: 'e-r0-a', from: 'root0', to: 'a' },
        { id: 'e-a-b', from: 'a', to: 'b' },
        { id: 'e-b-leaf0', from: 'b', to: 'leaf0' },
        { id: 'e-r1-a1', from: 'root1', to: 'a1' },
        { id: 'e-a1-b1', from: 'a1', to: 'b1' },
        { id: 'e-b1-leaf1', from: 'b1', to: 'leaf1' },
      ],
    }, { title: 'Persistent update copies only the changed path' }),
    highlight: { active: ['root1', 'a1', 'b1', 'leaf1'], compare: ['root0', 'leaf0'] },
    explanation: 'Updating an immutable HAMT does not copy the whole map. It copies the root-to-leaf path selected by the key hash and reuses every untouched branch.',
    invariant: 'Old roots still point to old nodes.',
  };

  yield {
    state: labelMatrix(
      'Update cost',
      [
        { id: 'lookup', label: 'lookup' },
        { id: 'set', label: 'set key' },
        { id: 'delete', label: 'delete key' },
        { id: 'iterate', label: 'iterate' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'why', label: 'why' },
      ],
      [
        ['O(hash chunks)', 'shallow trie'],
        ['O(depth) copies', 'path copy'],
        ['O(depth) copies', 'maybe shrink'],
        ['O(n)', 'visit leaves'],
      ],
    ),
    highlight: { found: ['set:cost', 'delete:cost'], compare: ['iterate:cost'] },
    explanation: 'Asymptotically, HAMT depth is logarithmic in the number of keys with a large base. Practically, the constants are dominated by hashing, popcount, allocation, and cache locality.',
  };

  yield {
    state: labelMatrix(
      'Why immutable maps use HAMTs',
      [
        { id: 'undo', label: 'undo' },
        { id: 'state', label: 'app state' },
        { id: 'share', label: 'sharing' },
        { id: 'batch', label: 'batch build' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'caveat', label: 'caveat' },
      ],
      [
        ['old roots', 'memory retained'],
        ['cheap snapshots', 'allocation'],
        ['copy path only', 'pointer chasing'],
        ['transient mutation', 'API discipline'],
      ],
    ),
    highlight: { active: ['undo:benefit', 'state:benefit', 'share:benefit'], compare: ['batch:caveat'] },
    explanation: 'Immutable collections want old versions to remain usable. HAMTs make that affordable, while transient builders or batched mutation often recover construction speed when many updates happen together.',
  };

  yield {
    state: labelMatrix(
      'Compare structures',
      [
        { id: 'hash', label: 'hash table' },
        { id: 'trie', label: 'trie' },
        { id: 'hamt', label: 'HAMT' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'trade', label: 'tradeoff' },
      ],
      [
        ['flat lookup', 'resize/mutate'],
        ['prefix lookup', 'alphabet nodes'],
        ['persistent map', 'hash+bitmap'],
      ],
    ),
    highlight: { found: ['hamt:strength'], compare: ['hash:strength', 'trie:strength'] },
    explanation: 'A HAMT is not a replacement for every hash table. It is the versioned-map answer when updates should return a new map and old maps must keep working.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lookup and bitmap') yield* lookupAndBitmap();
  else if (view === 'persistent update') yield* persistentUpdate();
  else throw new InputError('Pick a HAMT view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A hash array mapped trie, or HAMT, is a map/set data structure that combines hashing, trie navigation, bitmap compression, and structural sharing. It is a major implementation strategy behind immutable hash maps in functional languages and JavaScript libraries.',
        'The idea starts like a Hash Table: hash the key. Instead of using the hash to choose one flat bucket, split the hash into small chunks, often 5 bits each. Each chunk selects the next branch in a high-fanout Trie. Because most nodes are sparse, a bitmap records which logical children exist and a compact array stores only those children.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lookup reads the first hash chunk, checks the node bitmap, uses popcount to translate the logical slot into a dense-array index, then descends. The next hash chunk chooses the next level. At the leaf, the implementation checks the real key to handle hash collisions. A 32-way fanout keeps depth low; even large maps usually need only a few levels.',
        'Persistent updates use path copying. Setting one key copies only the nodes along that key hash path and reuses all untouched branches. The old root still reaches the old version, while the new root reaches the updated path. That is the same structural-sharing lesson as Persistent Segment Tree, but applied to associative maps.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The theoretical cost is logarithmic in the number of keys with a large base, often described as effectively constant for practical map sizes. The real costs are hashing, bitmap popcount, allocation, pointer chasing, collision handling, and garbage collection of old versions. HAMTs trade the locality of a flat Hash Table for cheap immutable snapshots and updates that do not mutate old maps.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Phil Bagwell described HAMTs in Ideal Hash Trees. Immutable.js documents its Map as implemented by a hash-array mapped trie, and JavaScript HAMT libraries expose immutable map APIs that resemble ES6 Map while preserving previous versions. Clojure-style persistent maps popularized the structure as a core everyday collection rather than a niche algorithm exercise.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A HAMT is not automatically faster than a mutable hash table. For one map that is mutated in place, a flat table often wins. HAMTs shine when old versions matter: undo stacks, app-state snapshots, transactional transforms, and purely functional APIs. Another misconception is that immutability means copying everything. The point is the opposite: copy the edited path and share the rest.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Bagwell Ideal Hash Trees at https://lampwww.epfl.ch/papers/idealhashtrees.pdf, Immutable.js Map docs at https://immutable-js.com/docs/v5/Map/, and a JavaScript HAMT implementation at https://github.com/mattbierner/hamt. Study Hash Table, Trie, PATRICIA Trie, Persistent Segment Tree, Git Internals, and MVCC Internals & VACUUM next.',
      ],
    },
  ],
};
