// Robin Hood hashing: open addressing where long-probe elements steal slots
// from short-probe elements, equalizing probe distances across the table.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'robin-hood-hashing',
  title: 'Robin Hood Hashing',
  category: 'Data Structures',
  summary: 'Linear probing with a fairness rule: if an inserting key has probed farther than the resident, it steals the slot and the displaced key continues.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['insert walk', 'lookup with early termination'], defaultValue: 'insert walk' },
  ],
  run,
};

const SIZE = 8;

const ROWS = Array.from({ length: SIZE }, (_, i) => ({ id: `s${i}`, label: `slot ${i}` }));
const COLUMNS = [
  { id: 'key', label: 'key' },
  { id: 'pd', label: 'probe dist' },
];

function snapshot(table, title) {
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
    values: table.map((entry) => [
      code(entry ? String(entry.key) : ''),
      code(entry ? String(entry.pd) : ''),
    ]),
    format: (value) => labels[value],
  });
}

function homeSlot(key) {
  return key % SIZE;
}

function makeTable() {
  return new Array(SIZE).fill(null);
}

function* insertWalk() {
  const table = makeTable();

  yield {
    state: snapshot(table, 'Empty table with 8 slots'),
    highlight: {},
    explanation: 'An empty hash table with 8 slots. Each slot will store a key and its probe distance -- how far the key sits from its home slot. The hash function is h(k) = k mod 8. Robin Hood hashing uses linear probing but adds one rule: a key that has probed farther than the current resident steals that slot.',
    invariant: 'At every slot, no later key on the same probe chain has a shorter probe distance than the resident.',
  };

  // Insert 12: h(12) = 4, lands directly
  const key1 = 12;
  table[4] = { key: key1, pd: 0 };
  yield {
    state: snapshot(table, 'Insert 12: h(12) = 4, slot empty'),
    highlight: { found: ['s4:key', 's4:pd'] },
    explanation: 'Insert 12. h(12) = 12 mod 8 = 4. Slot 4 is empty, so 12 lands at probe distance 0. No collision, no swap.',
  };

  // Insert 20: h(20) = 4, collides with 12, probes to 5
  const key2 = 20;
  table[5] = { key: key2, pd: 1 };
  yield {
    state: snapshot(table, 'Insert 20: h(20) = 4, collision at slot 4'),
    highlight: { collision: ['s4:key'], active: ['s5:key', 's5:pd'] },
    explanation: 'Insert 20. h(20) = 4, but slot 4 holds 12 (probe distance 0). The incoming 20 also has probe distance 0, so it is not "poorer" than 12 -- no swap. Probe forward to slot 5, which is empty. Place 20 at probe distance 1.',
  };
  // Fix highlight to show placed
  yield {
    state: snapshot(table, 'Insert 20: placed at slot 5, probe distance 1'),
    highlight: { found: ['s5:key', 's5:pd'], visited: ['s4:key'] },
    explanation: '20 sits one slot from its home bucket. Under plain linear probing this is unremarkable. The probe distance column is what Robin Hood hashing makes visible and controllable.',
  };

  // Insert 4: h(4) = 4, collides at 4 and 5, lands at 6
  const key3 = 4;
  table[6] = { key: key3, pd: 2 };
  yield {
    state: snapshot(table, 'Insert 4: h(4) = 4, collision chain'),
    highlight: { collision: ['s4:key', 's5:key'], found: ['s6:key', 's6:pd'] },
    explanation: 'Insert 4. h(4) = 4. Slot 4 holds 12 (pd 0 vs incoming pd 0 -- no swap). Slot 5 holds 20 (pd 1 vs incoming pd 1 -- no swap). Slot 6 is empty. Place 4 at probe distance 2. So far this looks like ordinary linear probing.',
  };

  // Insert 28: h(28) = 4, will trigger a Robin Hood swap
  const key4 = 28;
  yield {
    state: snapshot(table, 'Insert 28: h(28) = 4, probing begins'),
    highlight: { active: ['s4:key'], compare: ['s4:pd'] },
    explanation: 'Insert 28. h(28) = 4. Slot 4 holds 12 with probe distance 0. The incoming 28 also has probe distance 0. Equal probe distances do not trigger a swap -- only strictly greater does. Probe to slot 5.',
  };

  yield {
    state: snapshot(table, 'Insert 28: slot 5 holds 20 (pd 1), incoming pd 1'),
    highlight: { active: ['s5:key'], compare: ['s5:pd'] },
    explanation: 'Slot 5 holds 20 with probe distance 1. Incoming 28 has probe distance 1. Still not strictly greater. Probe to slot 6.',
  };

  yield {
    state: snapshot(table, 'Insert 28: slot 6 holds 4 (pd 2), incoming pd 2'),
    highlight: { active: ['s6:key'], compare: ['s6:pd'] },
    explanation: 'Slot 6 holds 4 with probe distance 2. Incoming 28 has probe distance 2. Equal again. Probe to slot 7.',
  };

  table[7] = { key: key4, pd: 3 };
  yield {
    state: snapshot(table, 'Insert 28: placed at slot 7, probe distance 3'),
    highlight: { found: ['s7:key', 's7:pd'] },
    explanation: 'Slot 7 is empty. Place 28 at probe distance 3. No Robin Hood swap was needed because all residents along the chain had equal or longer probe distances. The maximum probe distance is 3.',
  };

  // Insert 36: h(36) = 4, THIS one triggers the swap
  const key5 = 36;
  yield {
    state: snapshot(table, 'Insert 36: h(36) = 4, long collision chain ahead'),
    highlight: { active: ['s4:key', 's5:key', 's6:key', 's7:key'] },
    explanation: 'Insert 36. h(36) = 4. Slots 4-7 are all occupied. Watch what happens when the incoming key has probed farther than a resident.',
  };

  yield {
    state: snapshot(table, 'Insert 36: at slot 4, incoming pd 0 vs resident pd 0'),
    highlight: { active: ['s4:key'], compare: ['s4:pd'] },
    explanation: 'Slot 4: resident 12 has pd 0, incoming 36 has pd 0. Not greater. Continue.',
  };

  yield {
    state: snapshot(table, 'Insert 36: at slot 5, incoming pd 1 vs resident pd 1'),
    highlight: { active: ['s5:key'], compare: ['s5:pd'] },
    explanation: 'Slot 5: resident 20 has pd 1, incoming 36 has pd 1. Not greater. Continue.',
  };

  yield {
    state: snapshot(table, 'Insert 36: at slot 6, incoming pd 2 vs resident pd 2'),
    highlight: { active: ['s6:key'], compare: ['s6:pd'] },
    explanation: 'Slot 6: resident 4 has pd 2, incoming 36 has pd 2. Not greater. Continue.',
  };

  yield {
    state: snapshot(table, 'Insert 36: at slot 7, incoming pd 3 vs resident pd 3'),
    highlight: { active: ['s7:key'], compare: ['s7:pd'] },
    explanation: 'Slot 7: resident 28 has pd 3, incoming 36 has pd 3. Not greater. Continue to slot 0.',
  };

  table[0] = { key: key5, pd: 4 };
  yield {
    state: snapshot(table, 'Insert 36: placed at slot 0, probe distance 4'),
    highlight: { found: ['s0:key', 's0:pd'] },
    explanation: 'Slot 0 is empty. Place 36 at probe distance 4. That is the longest probe in the table. Now insert one more key that will trigger the Robin Hood swap.',
  };

  // Insert 5: h(5) = 5, will steal from 4 (pd 2) when incoming pd reaches 3
  const key6 = 5;
  yield {
    state: snapshot(table, 'Insert 5: h(5) = 5, probing begins'),
    highlight: { active: ['s5:key'], compare: ['s5:pd'] },
    explanation: 'Insert 5. h(5) = 5. Slot 5 holds 20 with pd 1. Incoming pd is 0. Not greater. Continue.',
  };

  yield {
    state: snapshot(table, 'Insert 5: at slot 6, incoming pd 1 vs resident pd 2'),
    highlight: { active: ['s6:key'], compare: ['s6:pd'] },
    explanation: 'Slot 6 holds 4 with pd 2. Incoming 5 has pd 1. Still not greater. Continue.',
  };

  yield {
    state: snapshot(table, 'Insert 5: at slot 7, incoming pd 2 vs resident pd 3'),
    highlight: { active: ['s7:key'], compare: ['s7:pd'] },
    explanation: 'Slot 7 holds 28 with pd 3. Incoming 5 has pd 2. Not greater. Continue.',
  };

  // At slot 0: 36 has pd 4, incoming 5 has pd 3. Not greater. Continue to slot 1.
  yield {
    state: snapshot(table, 'Insert 5: at slot 0, incoming pd 3 vs resident pd 4'),
    highlight: { active: ['s0:key'], compare: ['s0:pd'] },
    explanation: 'Slot 0 holds 36 with pd 4. Incoming 5 has pd 3. Not greater (36 is even poorer). Continue.',
  };

  table[1] = { key: key6, pd: 4 };
  yield {
    state: snapshot(table, 'Insert 5: placed at slot 1, probe distance 4'),
    highlight: { found: ['s1:key', 's1:pd'] },
    explanation: 'Slot 1 is empty. Place 5 at probe distance 4. No swap was triggered because every resident along the path was at least as far from home as the incoming key. To see a swap, consider what happens if we had a different insertion order.',
  };

  // Now show the swap scenario with a fresh table
  const table2 = makeTable();
  table2[3] = { key: 11, pd: 0 };  // h(11) = 3
  table2[4] = { key: 12, pd: 0 };  // h(12) = 4
  table2[5] = { key: 3, pd: 2 };   // h(3) = 3, probed to 5
  table2[6] = { key: 6, pd: 0 };   // h(6) = 6
  yield {
    state: snapshot(table2, 'New scenario: Robin Hood swap demo'),
    highlight: { active: ['s3:key', 's4:key', 's5:key', 's6:key'] },
    explanation: 'Fresh table. Key 11 sits at its home slot 3 (pd 0). Key 12 at home slot 4 (pd 0). Key 3 hashed to slot 3 but probed to slot 5 (pd 2). Key 6 at home slot 6 (pd 0). Now insert 19: h(19) = 3.',
  };

  yield {
    state: snapshot(table2, 'Insert 19: h(19) = 3, slot 3 holds 11 (pd 0)'),
    highlight: { active: ['s3:key'], compare: ['s3:pd'] },
    explanation: 'Slot 3: resident 11 has pd 0, incoming 19 has pd 0. Equal -- no swap. Probe to slot 4.',
  };

  yield {
    state: snapshot(table2, 'Insert 19: slot 4 holds 12 (pd 0), incoming pd 1'),
    highlight: { active: ['s4:key'], compare: ['s4:pd'] },
    explanation: 'Slot 4: resident 12 has pd 0, incoming 19 has pd 1. The incoming key has probed FARTHER than the resident. This is the Robin Hood moment: 19 is "poor" (far from home) and 12 is "rich" (sitting at home). Steal the slot.',
  };

  // The swap happens
  table2[4] = { key: 19, pd: 1 };
  yield {
    state: snapshot(table2, 'SWAP: 19 takes slot 4, displaces 12'),
    highlight: { found: ['s4:key', 's4:pd'], active: ['s5:key'] },
    explanation: '19 takes slot 4 (pd 1). The displaced 12 must now find a new home. 12\'s home is slot 4 (h(12) = 4), and it was at pd 0. It continues probing from slot 5 with pd 1.',
  };

  yield {
    state: snapshot(table2, 'Displaced 12: slot 5 holds 3 (pd 2), incoming pd 1'),
    highlight: { active: ['s5:key'], compare: ['s5:pd'] },
    explanation: 'Slot 5: resident 3 has pd 2, displaced 12 has pd 1. The resident is poorer (farther from home), so no swap. Continue to slot 6.',
  };

  yield {
    state: snapshot(table2, 'Displaced 12: slot 6 holds 6 (pd 0), incoming pd 2'),
    highlight: { active: ['s6:key'], compare: ['s6:pd'] },
    explanation: 'Slot 6: resident 6 has pd 0, displaced 12 has pd 2. The incoming key has probed farther. Another Robin Hood swap.',
  };

  table2[6] = { key: 12, pd: 2 };
  yield {
    state: snapshot(table2, 'SWAP: 12 takes slot 6, displaces 6'),
    highlight: { found: ['s6:key', 's6:pd'], active: ['s7:key'] },
    explanation: '12 takes slot 6 (pd 2). Displaced 6 (home slot 6, pd 0) continues from slot 7 with pd 1.',
  };

  table2[7] = { key: 6, pd: 1 };
  yield {
    state: snapshot(table2, 'Displaced 6 lands at empty slot 7'),
    highlight: { found: ['s7:key', 's7:pd'] },
    explanation: 'Slot 7 is empty. 6 lands at pd 1. The chain is done. Compare probe distances: before the insert, 6 had pd 0 (lucky) while 3 had pd 2 (unlucky). After the insert, the maximum probe distance is 2 and probe distances are more uniform. Robin Hood hashing took from the rich and gave to the poor.',
  };

  yield {
    state: snapshot(table2, 'Final table: probe distances cluster tightly'),
    highlight: { found: ['s3:pd', 's4:pd', 's5:pd', 's6:pd', 's7:pd'] },
    explanation: 'The probe distance column tells the story. In plain linear probing, some keys sit at home (pd 0) while others wander far. Robin Hood hashing compresses the variance: no key stays lucky at another key\'s expense. The maximum probe distance drops, and unsuccessful lookups terminate earlier.',
    invariant: 'For any two keys on the same probe chain, the one closer to its home slot sits earlier in the chain.',
  };
}

function* lookupWithEarlyTermination() {
  const table = makeTable();
  table[3] = { key: 11, pd: 0 };
  table[4] = { key: 19, pd: 1 };
  table[5] = { key: 3, pd: 2 };
  table[6] = { key: 12, pd: 2 };
  table[7] = { key: 6, pd: 1 };

  yield {
    state: snapshot(table, 'Robin Hood table: lookup benefits'),
    highlight: { active: ['s3:pd', 's4:pd', 's5:pd', 's6:pd', 's7:pd'] },
    explanation: 'This table was built with Robin Hood insertion. Probe distances are stored alongside keys. This enables a powerful optimization: early termination on unsuccessful lookups. If the element you are searching for would have a probe distance greater than the resident\'s, the element cannot be in the table.',
  };

  // Successful lookup: find 3
  yield {
    state: snapshot(table, 'Lookup 3: h(3) = 3, start probing'),
    highlight: { active: ['s3:key'] },
    explanation: 'Look up key 3. h(3) = 3. Check slot 3: it holds 11, not 3. In plain linear probing, we would keep scanning until we find 3 or hit an empty slot. Robin Hood hashing can do the same, but the probe distance gives us more information.',
  };

  yield {
    state: snapshot(table, 'Lookup 3: slot 4 holds 19, not 3'),
    highlight: { active: ['s4:key'], compare: ['s4:pd'] },
    explanation: 'Slot 4 holds 19. Our search probe distance is now 1. The resident\'s probe distance is also 1. Keep scanning -- the resident is not "richer" than our search position.',
  };

  yield {
    state: snapshot(table, 'Lookup 3: slot 5 holds 3 -- found!'),
    highlight: { found: ['s5:key', 's5:pd'] },
    explanation: 'Slot 5 holds 3. Found in 3 probes (slots 3, 4, 5). The probe distance recorded is 2, which matches our search distance of 2. Successful lookups behave similarly to plain linear probing.',
  };

  // Unsuccessful lookup with early termination: look for 27
  yield {
    state: snapshot(table, 'Lookup 27: h(27) = 3, does 27 exist?'),
    highlight: { active: ['s3:key'] },
    explanation: 'Look up key 27. h(27) = 3. Slot 3 holds 11 (pd 0). Our search pd is 0. Keep scanning.',
  };

  yield {
    state: snapshot(table, 'Lookup 27: slot 4, search pd 1 vs resident pd 1'),
    highlight: { active: ['s4:key'], compare: ['s4:pd'] },
    explanation: 'Slot 4 holds 19 (pd 1). Our search pd is 1. Equal. Keep scanning.',
  };

  yield {
    state: snapshot(table, 'Lookup 27: slot 5, search pd 2 vs resident pd 2'),
    highlight: { active: ['s5:key'], compare: ['s5:pd'] },
    explanation: 'Slot 5 holds 3 (pd 2). Our search pd is 2. Equal. Keep scanning.',
  };

  yield {
    state: snapshot(table, 'Lookup 27: slot 6, search pd 3 vs resident pd 2 -- STOP'),
    highlight: { active: ['s6:key'], compare: ['s6:pd'] },
    explanation: 'Slot 6 holds 12 with pd 2. Our search pd is 3. Our probe distance exceeds the resident\'s. If 27 existed in the table and hashed to slot 3, the Robin Hood insertion rule would have placed it before any key with a shorter probe distance. Since the resident at pd 2 is "richer" than our pd 3 search position, 27 cannot exist beyond this point. Absent -- confirmed without reaching an empty slot.',
    invariant: 'Robin Hood ordering means keys are sorted by probe distance along each chain. Once your search probe distance exceeds a resident\'s, the key is provably absent.',
  };

  // Compare with plain linear probing
  yield {
    state: snapshot(table, 'Early termination saves probes on misses'),
    highlight: { visited: ['s3:key', 's4:key', 's5:key', 's6:key'] },
    explanation: 'Plain linear probing would continue scanning slot 6, slot 7, and only stop at an empty slot. Robin Hood hashing stopped at slot 6 by comparing probe distances. For dense tables (load factor 80-90%), this makes unsuccessful lookups much faster. The variance in lookup cost shrinks because the maximum probe distance itself is smaller.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'insert walk') yield* insertWalk();
  else if (view === 'lookup with early termination') yield* lookupWithEarlyTermination();
  else throw new InputError('Pick a Robin Hood Hashing view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The table shows 8 slots, each displaying a key and its probe distance -- how far that key sits from its home slot (h(key) mod 8). Active highlights mark the slot being examined. Collision highlights show an occupied slot blocking the incoming key. Found highlights mark a key that just landed.',
        {type: 'callout', text: 'Robin Hood hashing reduces lookup tail cost by equalizing probe distances across an open-addressed cluster.'},
        'The probe distance column is the heart of Robin Hood hashing. Watch it during insertion: when the incoming key\'s probe distance exceeds the resident\'s, the resident is evicted and the incoming key takes the slot. The evicted key then continues probing. During lookup, the probe distance enables early termination: if your search distance exceeds the resident\'s, the key is absent.',
        'The insert-walk view shows collisions, the swap decision, and the cascade of displaced keys. The lookup view shows how probe-distance ordering makes unsuccessful lookups fast.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Pedro Celis introduced Robin Hood hashing in his 1986 PhD thesis at the University of Waterloo, supervised by J. Ian Munro. The problem was not average-case lookup speed -- linear probing already achieves O(1) expected time. The problem was variance.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal curve with standard deviation regions', caption: 'The target is variance reduction: average probe cost can be fine while the tail still hurts latency. Source: https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.'},
        'In a linear-probing table at 80% load, most keys sit at or near their home slot, but a few unlucky keys land at the end of long clusters and require 10, 20, or more probes. The maximum probe distance for n keys under standard linear probing is O(log n). A single slow lookup can blow a latency budget. Robin Hood hashing attacks the variance, not the mean.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Linear probing: hash the key to a slot; if occupied, try the next slot, then the next, until an empty slot appears. Lookup follows the same path. It is simple, cache-friendly (sequential memory access), and O(1) expected time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/HASHTB12.svg/500px-HASHTB12.svg.png', alt: 'Hash table diagram showing collisions resolved by linear probing', caption: 'Open addressing stores records inside the table and resolves a collision by probing later slots. Source: https://commons.wikimedia.org/wiki/File:HASHTB12.svg.'},
        'At moderate load factors (50-70%), linear probing works well. Most insertions find an empty slot within 1-3 probes. The hash table is a contiguous array, so the CPU prefetcher helps. For many workloads, this is good enough.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Linear probing creates clusters. Once a few adjacent slots fill up, every new key that hashes into the cluster extends it. The cluster grows superlinearly: a cluster of length k is hit by any of the k slots\' hash values, so longer clusters attract more keys (the "primary clustering" effect that Knuth analyzed).',
        'The consequence is unfairness. Keys that arrive early and hash to uncrowded regions sit at probe distance 0. Keys that arrive later or hash into a cluster can be pushed 10 or 20 slots from home. The expected probe length is O(1), but the maximum probe distance is Theta(log n). A few keys pay a heavy tax so the rest can be fast. If your application cannot tolerate tail latency, that variance is the wall.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Track each key\'s probe distance (how far it is from its home slot). On insertion, if the incoming key has a longer probe distance than the key currently occupying a slot, swap them. The "poor" key (far from home) steals the slot from the "rich" key (close to home), and the displaced rich key continues probing.',
        'This is the Robin Hood rule: steal from the rich, give to the poor. It does not change the total number of probes across all keys. It redistributes them. Lucky keys give up a little; unlucky keys gain a lot. The maximum probe distance drops, and all keys cluster toward the mean.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insert(key): compute home = h(key) mod m. Set probe_distance = 0 and slot = home. While slot is occupied: if probe_distance > resident.probe_distance, swap the incoming key with the resident (the incoming key takes the slot; the displaced resident becomes the new "incoming" key with the resident\'s old probe distance). Move to the next slot, increment probe_distance. When an empty slot is found, place the key with its current probe_distance.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A probe chain is a directed walk through candidate slots; the Robin Hood rule changes who gets to stop earlier on that walk. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Lookup(key): compute home = h(key) mod m. Set search_distance = 0. Scan forward from home. At each slot: if the slot holds the key, return it. If the slot is empty, the key is absent. If search_distance > resident.probe_distance, the key is absent (early termination). Otherwise increment search_distance and continue.',
        'Delete(key): find the key using the lookup procedure. Then either mark the slot with a tombstone (simple but degrades performance over time) or use backward-shift deletion: move subsequent keys back to fill the gap, decrementing their probe distances. Backward-shift keeps the table tombstone-free but is more complex to implement.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The Robin Hood rule maintains a monotonic ordering: along any probe chain starting from a home slot, keys appear in non-decreasing order of probe distance. A key with probe distance d cannot appear after a key with probe distance less than d on the same chain.',
        'This ordering is why early termination works. If you are searching for key x with search distance d and encounter a resident with probe distance less than d, then x cannot be farther along the chain. If x had been inserted, the Robin Hood rule would have placed it before any shorter-distance resident.',
        'The variance reduction follows from a smoothing argument. Swapping a long-probe key into a short-probe key\'s slot transfers one unit of probe distance: the rich key\'s distance increases by at most 1, while the poor key\'s distance decreases by at least 1. Celis proved that the expected maximum probe distance drops from Theta(log n) to O(log log n) under uniform hashing. The mean probe distance stays the same; the distribution tightens.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Expected lookup (successful and unsuccessful): O(1). Same as linear probing. The constant factor is similar because probe chains are sequential memory accesses.',
        'Maximum probe distance: O(log log n) expected, down from Theta(log n) for standard linear probing. With 1,000 keys, log(1000) is about 10 and log(log(1000)) is about 2.3. With 1,000,000 keys, log n is about 20 and log log n is about 3. The tail shrinks dramatically.',
        'Space: same as linear probing. One contiguous array. Each slot stores a key (or key-value pair) plus a small probe-distance counter. The extra per-slot byte is the only overhead beyond standard open addressing.',
        'Load factor: Robin Hood hashing tolerates load factors of 90% or higher with graceful degradation, because the variance compression keeps probe chains short even when the table is dense. Standard linear probing becomes painful above 70-80%.',
        'Cache behavior: excellent. Probing is sequential, so the CPU prefetcher works. The memory layout is identical to linear probing -- a flat array, no pointers, no linked lists.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Rust\'s standard HashMap (before 1.36) used Robin Hood hashing. The hashbrown crate, which replaced it, adopted SwissTable probing but was directly inspired by Robin Hood\'s variance-reduction insight. The jump from Robin Hood to SwissTable reflects a shift toward SIMD-assisted probing, not a rejection of the fairness principle.',
        'Game engines use Robin Hood hashing for entity lookup tables and spatial indexing. The predictable tail latency matters when a frame budget is 16ms and a single slow hash lookup can cause a frame drop.',
        'Embedded systems and real-time applications benefit from the tighter probe-distance bound. When the worst-case probe count is O(log log n) instead of O(log n), the gap between average and worst-case performance narrows, making latency budgets easier to meet.',
        'Database index implementations use Robin Hood probing for in-memory hash indexes where cache-friendly sequential access and low tail latency both matter.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Deletion is the main pain point. Tombstone deletion degrades performance under insert-delete churn. Backward-shift deletion is correct but complex: after removing a key, each subsequent key on the chain must be checked and possibly shifted back, with its probe distance decremented. Production implementations need to get this right or the probe-distance invariant breaks.',
        'Robin Hood hashing does not provide O(1) worst-case lookup like cuckoo hashing does. The O(log log n) bound is expected under uniform hashing, not guaranteed. Adversarial inputs or weak hash functions can still create long chains.',
        'SwissTable (abseil::flat_hash_map, Rust hashbrown) has largely superseded Robin Hood hashing in production. SwissTable uses SIMD instructions to scan 16 control bytes in parallel, achieving similar or better performance without tracking probe distances per slot. The metadata overhead is 1 byte per slot for control bytes versus 1 byte for probe distances, but the SIMD scan is faster than sequential comparison.',
        'Implementation complexity sits between plain linear probing (simplest) and cuckoo hashing (most complex). The swap logic during insertion is straightforward, but backward-shift deletion and the interaction with resizing require care.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Table of size 8, h(k) = k mod 8. Insert keys 14, 6, 22, 30, 38 in order.',
        'Insert 14: h(14) = 6. Slot 6 empty. Place 14 at pd 0. Table: [_, _, _, _, _, _, 14(0), _].',
        'Insert 6: h(6) = 6. Slot 6 holds 14 (pd 0). Incoming pd 0. Equal, no swap. Slot 7 empty. Place 6 at pd 1. Table: [_, _, _, _, _, _, 14(0), 6(1)].',
        'Insert 22: h(22) = 6. Slot 6 holds 14 (pd 0), incoming pd 0 -- no swap. Slot 7 holds 6 (pd 1), incoming pd 1 -- no swap. Slot 0 empty. Place 22 at pd 2. Table: [22(2), _, _, _, _, _, 14(0), 6(1)].',
        'Insert 30: h(30) = 6. Probe through slots 6, 7, 0. At slot 6: pd 0 vs 0, no swap. Slot 7: pd 1 vs 1, no swap. Slot 0: pd 2 vs 2, no swap. Slot 1 empty. Place 30 at pd 3. Table: [22(2), 30(3), _, _, _, _, 14(0), 6(1)].',
        'Insert 38: h(38) = 6. Probe through slots 6, 7, 0, 1. At each slot, incoming pd equals resident pd -- no swap. Slot 2 empty. Place 38 at pd 4. Table: [22(2), 30(3), 38(4), _, _, _, 14(0), 6(1)].',
        'Now insert 46: h(46) = 6. Incoming pd starts at 0. Slots 6 (pd 0), 7 (pd 1), 0 (pd 2), 1 (pd 3), 2 (pd 4) -- incoming pd matches each resident, no swap until slot 3 (empty). Place 46 at pd 5.',
        'This worst case (all keys hash to the same slot) shows Robin Hood cannot help when every key on the chain has equal probe distance. The fairness rule only helps when probe distances differ -- when the chain mixes keys from different home slots. In practice, with a good hash function, keys interleave from many home slots, and the swap rule keeps probe distances tight.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Celis, P. "Robin Hood Hashing," PhD thesis, University of Waterloo, 1986. The foundational work proving O(log log n) expected maximum probe distance. Celis, Larson & Munro, "Robin Hood Hashing" (FOCS 1985) -- the conference paper introducing the technique.',
        {
          type: 'bullets',
          items: [
            'Hash Table -- the foundation: linear probing, chaining, load factors, and rehashing.',
            'Cuckoo Hashing -- an alternative that guarantees O(1) worst-case lookup using two tables and eviction chains, at the cost of more complex insertion.',
            'SwissTable Hash Map -- the current production standard: SIMD-assisted probing with control bytes, now used in C++ (Abseil), Rust (hashbrown), and Go runtime.',
            'Bloom Filter -- when you only need "definitely absent or maybe present" and can tolerate false positives, a Bloom filter uses far less memory than any hash table.',
            'Consistent Hashing -- distributes keys across a ring of nodes; a different use of hashing for distributed systems rather than local lookup.',
          ],
        },
      ],
    },
  ],
};
