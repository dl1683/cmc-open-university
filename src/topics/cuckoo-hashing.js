// Cuckoo hashing: two candidate homes per key, constant-time lookup, and
// insertion by eviction. The animation shows why the lookup is simple and why
// insertion sometimes needs a rehash.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cuckoo-hashing',
  title: 'Cuckoo Hashing',
  category: 'Data Structures',
  summary: 'A hash table where each key has two possible homes: lookup checks two slots, insertion evicts until every key lands.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['eviction walk', 'cycle and rehash'], defaultValue: 'eviction walk' },
  ],
  run,
};

const ROWS = [
  { id: 'slot0', label: 'slot 0' },
  { id: 'slot1', label: 'slot 1' },
  { id: 'slot2', label: 'slot 2' },
  { id: 'slot3', label: 'slot 3' },
  { id: 'slot4', label: 'slot 4' },
];

const COLUMNS = [
  { id: 't1', label: 'table h1' },
  { id: 't2', label: 'table h2' },
];

function tableState(table1, table2, title) {
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
    rows: ROWS,
    columns: COLUMNS,
    values: ROWS.map((_, i) => [code(table1[i] ?? ''), code(table2[i] ?? '')]),
    format: (value) => labels[value],
  });
}

function homes(key) {
  return {
    ant: [1, 3],
    bee: [4, 0],
    cat: [2, 1],
    dog: [0, 2],
    eel: [2, 4],
    fox: [1, 0],
    gnu: [4, 2],
  }[key];
}

function candidateIds(key) {
  const [a, b] = homes(key);
  return [`slot${a}:t1`, `slot${b}:t2`];
}

function* evictionWalk() {
  const table1 = ['', 'ant', 'cat', '', 'bee'];
  const table2 = ['fox', '', 'dog', '', ''];

  yield {
    state: tableState(table1, table2, 'Each key has exactly two candidate homes'),
    highlight: { active: candidateIds('eel'), compare: candidateIds('ant') },
    explanation: 'Cuckoo Hashing gives every key two hash functions, h1 and h2. Lookup is brutally simple: check the h1 slot and the h2 slot. If the key is not in either place, it is absent. This is the point of the structure: worst-case lookup is two memory probes, not a walk through a collision chain.',
    invariant: 'A stored key must live in one of its two candidate cells.',
  };

  yield {
    state: tableState(table1, table2, 'Insert eel: first home is occupied by cat'),
    highlight: { active: ['slot2:t1'], collision: ['slot2:t1'], compare: ['slot4:t2'] },
    explanation: 'Insert "eel". Its h1 slot is table h1, slot 2, but "cat" already lives there. Unlike separate chaining, cuckoo hashing does not append to a bucket. The new key kicks the old key out, then the old key tries its alternate home.',
  };

  table1[2] = 'eel';
  yield {
    state: tableState(table1, table2, 'eel evicts cat'),
    highlight: { found: ['slot2:t1'], active: ['slot1:t2'] },
    explanation: '"eel" takes its first home. The evicted key, "cat", has candidate homes h1(cat)=slot 2 and h2(cat)=slot 1. Since it was just evicted from h1, it tries h2. That second home is empty, so the insertion walk can stop.',
  };

  table2[1] = 'cat';
  yield {
    state: tableState(table1, table2, 'All keys are back in legal homes'),
    highlight: { found: ['slot2:t1', 'slot1:t2'], compare: candidateIds('cat') },
    explanation: 'The final table still satisfies the invariant: every stored key is in one of its two homes. Lookup for "cat" checks slot2 in table h1 and slot1 in table h2, then stops. The insertion was messier than linear probing, but reads stay predictably tiny.',
  };

  yield {
    state: tableState(table1, table2, 'Lookup reads two cells, regardless of table history'),
    highlight: { active: candidateIds('dog'), found: ['slot2:t2'] },
    explanation: 'Lookup for "dog" probes h1(dog)=slot 0 in table h1 and h2(dog)=slot 2 in table h2. It finds the key in the second probe. This is the trade: Cuckoo Hashing makes insertion pay for collision resolution so lookup can remain constant and cache-friendly.',
  };
}

function* cycleAndRehash() {
  let table1 = ['', 'ant', 'eel', '', 'bee'];
  let table2 = ['fox', 'cat', 'dog', '', ''];

  yield {
    state: tableState(table1, table2, 'Insert gnu: both homes are occupied'),
    highlight: { active: candidateIds('gnu'), collision: ['slot4:t1', 'slot2:t2'] },
    explanation: 'Now insert "gnu". Its two homes are h1(gnu)=slot 4 and h2(gnu)=slot 2. Both are occupied. Cuckoo insertion can still try an eviction walk, but a long walk is a warning: the current hash functions may have created a cycle.',
  };

  table1[4] = 'gnu';
  yield {
    state: tableState(table1, table2, 'gnu evicts bee'),
    highlight: { found: ['slot4:t1'], active: ['slot0:t2'] },
    explanation: '"gnu" kicks out "bee". The evicted key moves to its alternate home, h2(bee)=slot 0. But that slot contains "fox", so the walk continues. The table is not broken yet; it is searching for an empty alternate position.',
  };

  table2[0] = 'bee';
  yield {
    state: tableState(table1, table2, 'bee evicts fox'),
    highlight: { found: ['slot0:t2'], active: ['slot1:t1'] },
    explanation: '"bee" kicks out "fox". Now "fox" tries h1(fox)=slot 1, which contains "ant". The chain is getting longer. Production implementations cap the number of evictions so one unlucky insert cannot stall the table indefinitely.',
  };

  table1[1] = 'fox';
  yield {
    state: tableState(table1, table2, 'fox evicts ant: cycle risk'),
    highlight: { found: ['slot1:t1'], active: ['slot3:t2'], compare: ['slot4:t1', 'slot0:t2', 'slot1:t1'] },
    explanation: 'When the insertion walk grows too long, the table probably entered a dependency cycle under the current hash functions. The usual repair is to rehash with new hash seeds, or to grow the table and reinsert all keys. Stashes and bucketized cuckoo variants reduce how often this happens.',
    invariant: 'Lookup remains two probes only if insertion keeps every key in one legal home.',
  };

  table1 = ['', 'fox', '', 'ant', 'gnu'];
  table2 = ['bee', 'cat', 'dog', '', 'eel'];
  yield {
    state: tableState(table1, table2, 'After rehash: same keys, new layout'),
    highlight: { found: ['slot4:t1', 'slot0:t2', 'slot1:t1', 'slot3:t1', 'slot4:t2'] },
    explanation: 'A rehash changes the hash functions, so the conflict graph changes. That sounds expensive, but it is rare when the load factor is kept under control. The table buys very fast reads by occasionally paying a rebuild cost on writes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'eviction walk') yield* evictionWalk();
  else if (view === 'cycle and rehash') yield* cycleAndRehash();
  else throw new InputError('Pick a Cuckoo Hashing view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Cuckoo Hashing is a dictionary data structure that gives each key two possible homes, usually in two tables or two bucket choices. A lookup computes both hash functions and checks both candidate cells. If the key is not in either cell, it is absent. That makes lookup worst-case constant time in the ordinary successful layout.',
        'The name comes from the insertion behavior. A new key may kick out an existing key, just as a cuckoo chick displaces another egg. The evicted key moves to its alternate home, possibly evicting another key. The walk continues until an empty cell appears or the implementation decides the walk is cycling and rehashes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For key x, compute h1(x) and h2(x). Lookup checks table1[h1(x)] and table2[h2(x)]. Insert tries one of those cells. If occupied, insert x there and evict the previous resident. The evicted key then tries its other cell. This turns collision resolution into a sequence of relocations rather than a chain or probe run.',
        'The structure has a useful graph view. Keys are edges between their two possible slots. A valid table orientation assigns each edge to one of its endpoints. Cycles and dense components are what make insertion fail. Rehashing changes the graph by changing hash functions; resizing lowers the density.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is O(1) with two candidate probes. Insertion is expected O(1) under standard assumptions and safe load factors, but a single insert can trigger many evictions or a rehash. Deletion is simple: clear the cell if the key is present. Memory is close to ordinary open addressing, though many production variants use small buckets, fingerprints, or a stash to improve load factor and reduce rebuild frequency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Cuckoo-style placement appears in high-performance hash tables, packet-processing tables, network switches, membership filters, and systems where predictable lookup latency matters more than perfectly smooth insertion. The Cuckoo Filter adapts the idea for approximate membership, making it a useful neighbor of Bloom Filter and Hash Table in this platform.',
        'The core lesson generalizes beyond hashing: sometimes you spend complexity on writes so reads become tiny, predictable, and cache-friendly. That same trade appears in B-Trees (How Databases Read), LSM Trees (How Cassandra Writes), and Roaring Bitmaps.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The two-probe lookup guarantee depends on successful insertion. If the table is too full or the hash functions create an unlucky component, insertion can cycle. Production implementations use maximum kick counts, rehashing, resizing, buckets, and stashes. Another misconception is that Cuckoo Hashing is always faster than linear probing. The answer depends on cache layout, write rate, load factor, hash quality, and whether failed inserts are acceptable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Pagh and Rodler, "Cuckoo Hashing" at https://www.rasmuspagh.net/papers/cuckoo.pdf. Study Hash Table first, then Bloom Filter, Cuckoo Hashing, Roaring Bitmaps, and Count-Min Sketch to see how different hash-based structures spend memory, exactness, and update cost.',
      ],
    },
  ],
};
