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
      heading: 'Why this exists',
      paragraphs: [
        'Hash tables are attractive because lookup is supposed to feel constant. Collisions are the tax. If many keys share a bucket, a lookup that should be one address calculation can turn into a chain walk, a probe run, or several cache misses.',
        'Cuckoo hashing exists for workloads that want a stronger lookup shape: compute two candidate locations, inspect those locations, and stop. It spends more effort during insertion so reads stay short and predictable.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The normal approach is separate chaining or open addressing. Chaining keeps a list at each bucket. Open addressing probes forward until it finds the key or an empty slot. Both approaches are simple, mutable, and often excellent.',
        'They also let collision history leak into lookup cost. A miss can scan a long chain or a long probe cluster. Good resizing and good hashing keep that expected cost small, but the lookup path is no longer fixed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not asymptotic notation alone. It is latency variance. A hot path that sometimes checks one cell and sometimes walks a cluster is hard to budget in packet processing, caches, and read-heavy indexes.',
        'Cuckoo hashing attacks that wall by making the table maintain a stronger invariant: every key must live in one of a small number of legal homes. Lookup can then reject every other slot without inspecting it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Give each key two independent homes. If one home is occupied during insertion, move the resident to its alternate home. That relocation may move another resident, so insertion becomes an eviction walk.',
        'The key invariant is simple: after insertion succeeds, every stored key is in one of its two homes. Lookup never follows the eviction history. It recomputes the two homes and checks only those cells.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        "In the eviction-walk view, follow the invariant, not the drama. Every key must end in one of its legal homes. An insertion may evict several residents, but each eviction is an attempt to restore that invariant with one more key placed.",
        "In the cycle-and-rehash view, watch for repetition. If the walk returns to a previous configuration or exceeds a kick limit, the current hash choices are not giving this table enough room. Rehashing changes the graph; resizing lowers density.",
        "Lookup is intentionally boring. Once insertion succeeds, lookup recomputes two homes and stops. The animation spends time on insertion because that is where the data structure pays for predictable reads.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose key A can live in slots 1 or 9, B in 9 or 4, and C in 4 or 7. If A occupies 9 and B arrives, B can evict A from 9; A moves to 1. If C later evicts B from 4, B can move back to 9. The table is not remembering this walk for lookup. It only preserves the final home invariant.',
        'A cycle happens when every move sends an evicted key to another occupied slot and the walk cannot find empty space. Production implementations cap the number of kicks so one bad insertion does not block the system indefinitely.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For key x, compute h1(x) and h2(x). Lookup checks table1[h1(x)] and table2[h2(x)]. If neither cell holds x, the key is absent. Deletion is the same direct path in reverse: find the key in one legal cell and clear it.',
        'Insertion tries one legal cell. If that cell is full, x evicts the old resident. The evicted key tries its other legal cell. The walk continues until an empty cell appears. If the walk becomes too long, the implementation rehashes, resizes, or uses a stash or bucketized variant.',
        'There is a useful graph view. Slots are vertices. Keys are edges between their two candidate slots. A valid table chooses one endpoint for every edge. Dense components and cycles explain why some insertions cannot be placed under the current hash functions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Lookup is correct because insertion preserves the home invariant. A stored key cannot be anywhere except its h1 or h2 cell. If both cells are checked and neither contains the key, no later cell can make the answer change.',
        'Insertion is a search for a legal orientation of the key-slot graph. Rehashing works because new hash seeds create a different graph. Resizing works because lower density makes it more likely that eviction walks find empty slots.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Lookup is O(1) with two candidate probes in the basic design. Deletion is O(1). Insertion is expected O(1) under the usual random-hashing assumptions and safe load factors, but a single unlucky insert can trigger many evictions or a full rebuild.',
        'Memory is close to open addressing, though practical designs often use small buckets, fingerprints, a stash, or extra candidate choices to raise load factor and reduce rebuild frequency. The main operational cost is write-side variance.',
        'Load factor is the practical dial. Higher load uses memory efficiently but makes cycles and long eviction walks more likely. Lower load costs memory but keeps inserts calmer. Bucketized cuckoo hashing changes the tradeoff by allowing each home to hold several candidates.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Use independent hash functions or a well-tested scheme for deriving alternate locations. Weakly correlated homes create clusters and cycles earlier than the theory suggests. Track insertion kick counts and rebuild frequency; those metrics reveal when load factor or hash quality is outside the intended regime.',
        'If misses dominate, the two-probe shape is attractive. If writes dominate or rebuild pauses are unacceptable, ordinary open addressing, Robin Hood hashing, or a different table may be easier to operate. Cuckoo hashing is a read-shape trade, not a universal hash-table upgrade.',
      ],
    },
    {
      heading: 'Variants',
      paragraphs: [
        'Bucketized cuckoo hashing gives each candidate home several slots. That raises practical load factors and reduces rebuilds because an insertion has more room before it must evict. Stashes keep a small overflow area for rare hard cases. More hash choices can also reduce cycles, though each extra choice costs lookup work.',
        'Cuckoo filters use the same relocation idea with compact fingerprints instead of full keys. They trade exact membership for small space and false positives. Seeing the connection helps learners separate the placement strategy from the exact dictionary semantics.',
        'Concurrent variants add another layer. Eviction walks mutate several locations, so locks, version counters, or transactional update schemes must preserve the home invariant while readers are checking only a few candidate cells.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Cuckoo-style placement fits systems where lookup latency matters more than perfectly smooth writes: packet-processing tables, read-heavy caches, high-performance hash tables, and membership filters. Cuckoo Filter reuses the placement idea with compact fingerprints for approximate membership.',
        'The general engineering pattern is worth remembering: make writes repair layout so reads can be tiny. B-Trees, LSM Trees, Roaring Bitmaps, and static filters all spend construction or maintenance work to make later queries cheaper.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The two-probe lookup promise depends on successful placement. If the table is too full or the hash functions create an unlucky component, insertion can cycle. That is why production implementations cap kick counts and treat rebuilds as a normal path.',
        'Cuckoo hashing is not automatically faster than linear probing. Cache layout, key size, equality cost, hash quality, write rate, load factor, and rebuild tolerance decide the result.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Pagh and Rodler, "Cuckoo Hashing" at https://www.rasmuspagh.net/papers/cuckoo.pdf. Study Hash Table first, then Bloom Filter, Cuckoo Filter, Quotient Filter, Xor Filter, Roaring Bitmaps, and Count-Min Sketch to see how hash-based structures trade memory, exactness, update cost, and lookup predictability.',
      ],
    },
  ],
};
