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
  const numSlots = ROWS.length;
  const numTables = COLUMNS.length;
  const table1 = ['', 'ant', 'cat', '', 'bee'];
  const table2 = ['fox', '', 'dog', '', ''];
  const occupiedT1 = table1.filter(k => k).length;
  const occupiedT2 = table2.filter(k => k).length;
  const totalKeys = occupiedT1 + occupiedT2;

  yield {
    state: tableState(table1, table2, 'Each key has exactly two candidate homes'),
    highlight: { active: candidateIds('eel'), compare: candidateIds('ant') },
    explanation: `Cuckoo Hashing gives every key ${numTables} hash functions, h1 and h2. Lookup is brutally simple: check the h1 slot and the h2 slot. If the key is not in either place, it is absent. This is the point of the structure: worst-case lookup is ${numTables} memory probes, not a walk through a collision chain.`,
    invariant: `A stored key must live in one of its ${numTables} candidate cells across ${numSlots} slots per table.`,
  };

  yield {
    state: tableState(table1, table2, 'Insert eel: first home is occupied by cat'),
    highlight: { active: ['slot2:t1'], collision: ['slot2:t1'], compare: ['slot4:t2'] },
    explanation: `Insert "eel". Its h1 slot is table h1, slot ${homes('eel')[0]}, but "${table1[homes('eel')[0]]}" already lives there. Unlike separate chaining, cuckoo hashing does not append to a bucket. The new key kicks the old key out, then the old key tries its alternate home.`,
  };

  table1[2] = 'eel';
  yield {
    state: tableState(table1, table2, 'eel evicts cat'),
    highlight: { found: ['slot2:t1'], active: ['slot1:t2'] },
    explanation: `"eel" takes its first home. The evicted key, "cat", has candidate homes h1(cat)=slot ${homes('cat')[0]} and h2(cat)=slot ${homes('cat')[1]}. Since it was just evicted from h1, it tries h2. That second home is empty, so the insertion walk can stop.`,
  };

  table2[1] = 'cat';
  yield {
    state: tableState(table1, table2, 'All keys are back in legal homes'),
    highlight: { found: ['slot2:t1', 'slot1:t2'], compare: candidateIds('cat') },
    explanation: `The final table still satisfies the invariant: every stored key is in one of its ${numTables} homes. Lookup for "cat" checks slot ${homes('cat')[0]} in table h1 and slot ${homes('cat')[1]} in table h2, then stops. The insertion was messier than linear probing, but reads stay predictably tiny.`,
  };

  yield {
    state: tableState(table1, table2, 'Lookup reads two cells, regardless of table history'),
    highlight: { active: candidateIds('dog'), found: ['slot2:t2'] },
    explanation: `Lookup for "dog" probes h1(dog)=slot ${homes('dog')[0]} in table h1 and h2(dog)=slot ${homes('dog')[1]} in table h2. It finds the key in the second probe. This is the trade: Cuckoo Hashing makes insertion pay for collision resolution so lookup can remain constant and cache-friendly with just ${numTables} probes.`,
  };
}

function* cycleAndRehash() {
  const numSlots = ROWS.length;
  const numTables = COLUMNS.length;
  let table1 = ['', 'ant', 'eel', '', 'bee'];
  let table2 = ['fox', 'cat', 'dog', '', ''];
  const initialKeys = table1.filter(k => k).length + table2.filter(k => k).length;

  yield {
    state: tableState(table1, table2, 'Insert gnu: both homes are occupied'),
    highlight: { active: candidateIds('gnu'), collision: ['slot4:t1', 'slot2:t2'] },
    explanation: `Now insert "gnu". Its ${numTables} homes are h1(gnu)=slot ${homes('gnu')[0]} and h2(gnu)=slot ${homes('gnu')[1]}. Both are occupied. Cuckoo insertion can still try an eviction walk, but a long walk is a warning: the current hash functions may have created a cycle.`,
  };

  table1[4] = 'gnu';
  yield {
    state: tableState(table1, table2, 'gnu evicts bee'),
    highlight: { found: ['slot4:t1'], active: ['slot0:t2'] },
    explanation: `"gnu" kicks out "bee". The evicted key moves to its alternate home, h2(bee)=slot ${homes('bee')[1]}. But that slot contains "${table2[homes('bee')[1]]}", so the walk continues. The table is not broken yet; it is searching for an empty alternate position.`,
  };

  table2[0] = 'bee';
  yield {
    state: tableState(table1, table2, 'bee evicts fox'),
    highlight: { found: ['slot0:t2'], active: ['slot1:t1'] },
    explanation: `"bee" kicks out "fox". Now "fox" tries h1(fox)=slot ${homes('fox')[0]}, which contains "${table1[homes('fox')[0]]}". The chain is getting longer. Production implementations cap the number of evictions so one unlucky insert cannot stall the table indefinitely.`,
  };

  table1[1] = 'fox';
  yield {
    state: tableState(table1, table2, 'fox evicts ant: cycle risk'),
    highlight: { found: ['slot1:t1'], active: ['slot3:t2'], compare: ['slot4:t1', 'slot0:t2', 'slot1:t1'] },
    explanation: `When the insertion walk grows too long, the table probably entered a dependency cycle under the current hash functions. The usual repair is to rehash with new hash seeds, or to grow the table and reinsert all ${initialKeys + 1} keys. Stashes and bucketized cuckoo variants reduce how often this happens.`,
    invariant: `Lookup remains ${numTables} probes only if insertion keeps every key in one of its ${numTables} legal homes.`,
  };

  table1 = ['', 'fox', '', 'ant', 'gnu'];
  table2 = ['bee', 'cat', 'dog', '', 'eel'];
  const rehashTotal = table1.filter(k => k).length + table2.filter(k => k).length;
  yield {
    state: tableState(table1, table2, 'After rehash: same keys, new layout'),
    highlight: { found: ['slot4:t1', 'slot0:t2', 'slot1:t1', 'slot3:t1', 'slot4:t2'] },
    explanation: `A rehash changes the hash functions, so the conflict graph changes. That sounds expensive, but it is rare when the load factor is kept under control. All ${rehashTotal} keys land in new slots across ${numSlots} positions per table, buying very fast reads by occasionally paying a rebuild cost on writes.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Two tables sit side by side: table h1 on the left, table h2 on the right. Each key owns exactly two candidate slots, one in each table, computed by two independent hash functions. Active highlights mark the slots under consideration. Collision highlights show an occupied slot that forces an eviction.',
        'In the eviction-walk view, watch the chain reaction. A new key lands in its h1 slot and kicks out the resident. The evicted key moves to its alternate slot in the other table. The chain stops when an eviction lands in an empty cell. Found highlights mark keys that have settled into a legal home.',
        'In the cycle-and-rehash view, the chain keeps going. Every eviction displaces another resident, and the walk never finds an empty slot. When the chain exceeds a threshold, the table declares the current hash functions unworkable and rehashes all keys with new seeds. The final frame shows the same keys in a conflict-free layout.',
        'The invariant to check at every frame: every stored key sits in one of its two candidate cells. Lookup correctness depends entirely on this property surviving every insertion.',
      
        {type: 'image', src: './assets/gifs/cuckoo-hashing.gif', alt: 'Animated walkthrough of the cuckoo hashing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Standard hash tables promise O(1) expected lookup, but collisions break that promise. A chaining table with a bad hash function or adversarial input can degrade to O(n) -- every key in one bucket, lookup becomes a linked-list scan. Open addressing under high load clusters probes into long runs. The expected case is fast; the worst case is not.',
        { type: 'callout', text: 'Cuckoo hashing makes lookup constant by forcing every key into one of two precomputed homes.' },
        'Pagh and Rodler (2004) asked: can a hash table guarantee O(1) worst-case lookup, not just expected? Cuckoo hashing is their answer. Two hash functions, two tables, two probes per lookup -- always. The table pays for this guarantee during insertion, not during reads.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Chaining: hash each key to a bucket, store collisions in a linked list. Expected lookup is O(1 + alpha) where alpha is the load factor (keys / slots). The chain works, but its length varies. A bucket with 5 collisions costs 5 pointer chases. Adversarial input can put every key in one bucket.',
        'Open addressing (linear probing, quadratic probing): hash to a slot, scan forward on collision. No linked lists, better cache behavior, but probes cluster under load. A run of 20 occupied slots means the 21st insert scans 20 cells before finding room, and every lookup that hashes into that run pays the same scan cost.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Both chaining and open addressing share the same flaw: lookup cost depends on collision history. A chain might be length 1 or length 50. A probe run might be 1 slot or 30. The expected cost is O(1), but the variance is unbounded in the worst case.',
        'For most software this variance is tolerable. For network routers processing packets at line rate, hardware caches with fixed cycle budgets, and real-time systems that cannot afford a long tail, variable-time lookup is a design problem. The system needs a hard bound on how many memory accesses a lookup can cost.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Give each key exactly two legal homes, one per table. Lookup checks both homes and stops -- two probes, always, regardless of how many keys are stored or how many collisions happened during insertion.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Cuckoo_hashing_example.svg/250px-Cuckoo_hashing_example.svg.png', alt: 'Cuckoo hashing table with arrows to alternate locations', caption: 'The arrows make the two-home invariant visible: insertion may move keys, but lookup still checks fixed homes. Source: https://en.wikipedia.org/wiki/Cuckoo_hashing.' },
        'Insertion enforces this by eviction. If the new key\'s first home is occupied, it kicks the resident out. The displaced key tries its alternate home in the other table. If that is also occupied, another eviction happens. The chain continues until someone lands in an empty slot. The name comes from the cuckoo bird, which lays eggs in other birds\' nests and evicts their young.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Two tables T1 and T2, two hash functions h1 and h2. Each table has m slots.',
        'Lookup(x): check T1[h1(x)] and T2[h2(x)]. If either cell holds x, return it. If neither does, x is absent. Cost: exactly 2 memory accesses.',
        'Insert(x): try T1[h1(x)]. If empty, place x and stop. If occupied by y, place x there and evict y. Now insert y into T2[h2(y)]. If that is empty, place y and stop. If occupied by z, evict z and continue the chain. If the chain exceeds a threshold (typically 6 log n kicks), declare failure: the current hash functions have created a cycle. Pick new hash functions and reinsert every key from scratch.',
        'Delete(x): check T1[h1(x)] and T2[h2(x)]. If either holds x, clear the slot. Cost: O(1), and unlike Bloom filters, deletion is clean -- no false negatives, no counter overflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The home invariant: after every successful insertion, every stored key occupies one of its two candidate cells. Lookup correctness follows directly -- if x is not in T1[h1(x)] or T2[h2(x)], it cannot be anywhere else in the table.',
        'Think of the key-slot relationship as a bipartite graph. Slots in T1 are one set of vertices, slots in T2 are the other. Each key is an edge connecting its two candidate slots. A valid table assigns each edge to one of its endpoints (the slot where the key actually lives). Insertion is a search for a valid assignment. A cycle in this cuckoo graph means no valid assignment exists under the current hash functions -- that is when rehashing is needed.',
        'With truly random hash functions and load factor below 50%, the cuckoo graph is sparse. Cycles are rare: the probability of a rehash on any single insertion is O(1/n). New hash seeds create a different graph, and a sparse random bipartite graph almost always admits a valid assignment.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup: O(1) worst case. Two probes, always. This is the entire point of the data structure.',
        'Delete: O(1) worst case. Check two cells, clear the one that holds the key.',
        'Insert: O(1) amortized. Most insertions place the key directly or after a short eviction chain. Rehashing is O(n) but happens with probability O(1/n) per insert, so the amortized cost stays constant.',
        'Space: the basic two-table design needs load factor below 50% to keep insertion reliable. That means storing n keys requires at least 2n slots -- worse than chaining (which tolerates alpha > 1) or linear probing (which works well up to 70-80% load). Extensions improve this: d-ary cuckoo hashing (d > 2 hash functions) reaches ~91% load; bucketized cuckoo hashing (b slots per bucket) reaches ~95%.',
        'What happens when n doubles: lookup stays 2 probes. Insert amortized cost stays O(1). Table must grow to maintain load factor, and regrowth means a full rehash of all keys.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Network hardware (routers, switches, firewalls): packet classification needs to match a flow against a forwarding table in a fixed number of clock cycles. Two parallel memory lookups fit TCAM and SRAM pipelines. Cuckoo hashing gives that deterministic access pattern.',
        'Cuckoo filters (Fan, Andersen, Kaminsky, Mitzenmacher, 2014): replace Bloom filters for approximate set membership. They store compact fingerprints using cuckoo placement, support deletion (Bloom filters do not without counting), achieve better space efficiency at low false-positive rates, and have better cache locality because each lookup touches 2 buckets instead of k independent bit positions.',
        'Real-time systems: any context where a lookup must complete within a hard deadline benefits from worst-case O(1). Game engines, embedded systems, and latency-sensitive caches use cuckoo-style tables when the read path cannot tolerate variance.',
        'High-performance key-value stores: libcuckoo and similar concurrent cuckoo hash tables serve read-heavy workloads where the predictable lookup cost outweighs the more complex insertion path.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Space overhead: the basic scheme wastes roughly half of allocated memory. Chaining and linear probing use space more efficiently at moderate load factors. For most software applications, 50% utilization is an unacceptable price for worst-case O(1) lookup.',
        'Insertion cascades: a single insert can trigger a long eviction chain. If the chain hits a cycle, the entire table must be rehashed -- an O(n) pause. Write-heavy workloads or latency-sensitive write paths suffer from this variance.',
        'Complexity: Robin Hood hashing gives nearly the same low lookup variance with simpler code, no second table, and no eviction chains. For most software hash tables, Robin Hood or well-tuned linear probing is easier to implement, debug, and maintain.',
        'Concurrency: eviction chains mutate multiple slots, making lock-free or fine-grained-locking implementations harder than for simpler open-addressing schemes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'T1 and T2 each have 4 slots (indices 0-3). h1(x) = x mod 4, h2(x) = floor(x / 4) mod 4.',
        'Insert 5: h1(5) = 1. T1[1] is empty. Place 5 there. T1 = [_, 5, _, _]. T2 = [_, _, _, _].',
        'Insert 9: h1(9) = 1. T1[1] holds 5 -- collision. Evict 5, place 9: T1[1] = 9. Now insert evicted 5 into T2: h2(5) = 1. T2[1] is empty. Place 5 there. T1 = [_, 9, _, _]. T2 = [_, 5, _, _].',
        'Insert 13: h1(13) = 1. T1[1] holds 9 -- collision. Evict 9, place 13: T1[1] = 13. Insert evicted 9 into T2: h2(9) = 2. T2[2] is empty. Place 9 there. T1 = [_, 13, _, _]. T2 = [_, 5, 9, _].',
        'Lookup 5: check T1[h1(5)] = T1[1] = 13, not 5. Check T2[h2(5)] = T2[1] = 5. Found in exactly 2 probes. No chain walk, no probe scan, no matter how many evictions happened during the inserts that built this table.',
        'Lookup 99: check T1[h1(99)] = T1[3] = empty. Check T2[h2(99)] = T2[0] = empty. Absent, confirmed in 2 probes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Pagh & Rodler 2004, "Cuckoo Hashing" -- the foundational paper proving O(1) worst-case lookup with two hash functions and two tables. Fan, Andersen, Kaminsky & Mitzenmacher 2014, "Cuckoo Filter: Practically Better Than Bloom" -- extends cuckoo placement to approximate membership with deletion support.',
        {
          type: 'bullets',
          items: [
            'Hash Table -- chaining and open addressing, the baseline that cuckoo hashing improves on.',
            'Bloom Filter -- trades exactness for space; cuckoo filters are the modern alternative.',
            'Robin Hood Hashing -- variance reduction within open addressing; simpler than cuckoo hashing for most software.',
            'Linear Probing -- the simplest open-addressing scheme; good cache behavior but variable-length probe runs.',
            'Perfect Hashing -- another path to O(1) worst-case lookup, but requires knowing all keys in advance.',
          ],
        },
      ],
    },
  ],
};
