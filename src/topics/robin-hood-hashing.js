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
  const r2 = (v) => Math.round(v * 100) / 100;
  const table = makeTable();

  yield {
    state: snapshot(table, `Empty table with ${SIZE} slots`),
    highlight: {},
    explanation: `An empty hash table with ${SIZE} slots. Each slot will store a key and its probe distance -- how far the key sits from its home slot. The hash function is h(k) = k mod ${SIZE}. Robin Hood hashing uses linear probing but adds one rule: a key that has probed farther than the current resident steals that slot.`,
    invariant: `At every slot, no later key on the same probe chain has a shorter probe distance than the resident.`,
  };

  // Insert 12: h(12) = 4, lands directly
  const key1 = 12;
  const home1 = homeSlot(key1);
  table[home1] = { key: key1, pd: 0 };
  yield {
    state: snapshot(table, `Insert ${key1}: h(${key1}) = ${home1}, slot empty`),
    highlight: { found: [`s${home1}:key`, `s${home1}:pd`] },
    explanation: `Insert ${key1}. h(${key1}) = ${key1} mod ${SIZE} = ${home1}. Slot ${home1} is empty, so ${key1} lands at probe distance ${table[home1].pd}. No collision, no swap.`,
  };

  // Insert 20: h(20) = 4, collides with 12, probes to 5
  const key2 = 20;
  const home2 = homeSlot(key2);
  const slot2 = 5;
  let incomingPd2 = 0;
  table[slot2] = { key: key2, pd: 1 };
  yield {
    state: snapshot(table, `Insert ${key2}: h(${key2}) = ${home2}, collision at slot ${home2}`),
    highlight: { collision: [`s${home2}:key`], active: [`s${slot2}:key`, `s${slot2}:pd`] },
    explanation: `Insert ${key2}. h(${key2}) = ${home2}, but slot ${home2} holds ${table[home2].key} (probe distance ${table[home2].pd}). The incoming ${key2} also has probe distance ${incomingPd2}, so it is not "poorer" than ${table[home2].key} -- no swap. Probe forward to slot ${slot2}, which is empty. Place ${key2} at probe distance ${table[slot2].pd}.`,
  };
  // Fix highlight to show placed
  yield {
    state: snapshot(table, `Insert ${key2}: placed at slot ${slot2}, probe distance ${table[slot2].pd}`),
    highlight: { found: [`s${slot2}:key`, `s${slot2}:pd`], visited: [`s${home2}:key`] },
    explanation: `${key2} sits ${table[slot2].pd} slot from its home bucket. Under plain linear probing this is unremarkable. The probe distance column is what Robin Hood hashing makes visible and controllable.`,
  };

  // Insert 4: h(4) = 4, collides at 4 and 5, lands at 6
  const key3 = 4;
  const home3 = homeSlot(key3);
  const slot3 = 6;
  table[slot3] = { key: key3, pd: 2 };
  yield {
    state: snapshot(table, `Insert ${key3}: h(${key3}) = ${home3}, collision chain`),
    highlight: { collision: [`s${home3}:key`, `s${slot2}:key`], found: [`s${slot3}:key`, `s${slot3}:pd`] },
    explanation: `Insert ${key3}. h(${key3}) = ${home3}. Slot ${home3} holds ${table[home3].key} (pd ${table[home3].pd} vs incoming pd 0 -- no swap). Slot ${slot2} holds ${table[slot2].key} (pd ${table[slot2].pd} vs incoming pd 1 -- no swap). Slot ${slot3} is empty. Place ${key3} at probe distance ${table[slot3].pd}. So far this looks like ordinary linear probing.`,
  };

  // Insert 28: h(28) = 4, will trigger a Robin Hood swap
  const key4 = 28;
  const home4 = homeSlot(key4);
  let incomingPd4 = 0;
  yield {
    state: snapshot(table, `Insert ${key4}: h(${key4}) = ${home4}, probing begins`),
    highlight: { active: [`s${home4}:key`], compare: [`s${home4}:pd`] },
    explanation: `Insert ${key4}. h(${key4}) = ${home4}. Slot ${home4} holds ${table[home4].key} with probe distance ${table[home4].pd}. The incoming ${key4} also has probe distance ${incomingPd4}. Equal probe distances do not trigger a swap -- only strictly greater does. Probe to slot ${home4 + 1}.`,
  };

  incomingPd4 = 1;
  yield {
    state: snapshot(table, `Insert ${key4}: slot ${slot2} holds ${table[slot2].key} (pd ${table[slot2].pd}), incoming pd ${incomingPd4}`),
    highlight: { active: [`s${slot2}:key`], compare: [`s${slot2}:pd`] },
    explanation: `Slot ${slot2} holds ${table[slot2].key} with probe distance ${table[slot2].pd}. Incoming ${key4} has probe distance ${incomingPd4}. Still not strictly greater. Probe to slot ${slot3}.`,
  };

  incomingPd4 = 2;
  yield {
    state: snapshot(table, `Insert ${key4}: slot ${slot3} holds ${table[slot3].key} (pd ${table[slot3].pd}), incoming pd ${incomingPd4}`),
    highlight: { active: [`s${slot3}:key`], compare: [`s${slot3}:pd`] },
    explanation: `Slot ${slot3} holds ${table[slot3].key} with probe distance ${table[slot3].pd}. Incoming ${key4} has probe distance ${incomingPd4}. Equal again. Probe to slot 7.`,
  };

  incomingPd4 = 3;
  const slot4 = 7;
  table[slot4] = { key: key4, pd: incomingPd4 };
  yield {
    state: snapshot(table, `Insert ${key4}: placed at slot ${slot4}, probe distance ${table[slot4].pd}`),
    highlight: { found: [`s${slot4}:key`, `s${slot4}:pd`] },
    explanation: `Slot ${slot4} is empty. Place ${key4} at probe distance ${table[slot4].pd}. No Robin Hood swap was needed because all residents along the chain had equal or longer probe distances. The maximum probe distance is ${table[slot4].pd}.`,
  };

  // Insert 36: h(36) = 4, THIS one triggers the swap
  const key5 = 36;
  const home5 = homeSlot(key5);
  let incomingPd5 = 0;
  yield {
    state: snapshot(table, `Insert ${key5}: h(${key5}) = ${home5}, long collision chain ahead`),
    highlight: { active: [`s${home5}:key`, `s${slot2}:key`, `s${slot3}:key`, `s${slot4}:key`] },
    explanation: `Insert ${key5}. h(${key5}) = ${home5}. Slots ${home5}-${slot4} are all occupied. Watch what happens when the incoming key has probed farther than a resident.`,
  };

  yield {
    state: snapshot(table, `Insert ${key5}: at slot ${home5}, incoming pd ${incomingPd5} vs resident pd ${table[home5].pd}`),
    highlight: { active: [`s${home5}:key`], compare: [`s${home5}:pd`] },
    explanation: `Slot ${home5}: resident ${table[home5].key} has pd ${table[home5].pd}, incoming ${key5} has pd ${incomingPd5}. Not greater. Continue.`,
  };

  incomingPd5 = 1;
  yield {
    state: snapshot(table, `Insert ${key5}: at slot ${slot2}, incoming pd ${incomingPd5} vs resident pd ${table[slot2].pd}`),
    highlight: { active: [`s${slot2}:key`], compare: [`s${slot2}:pd`] },
    explanation: `Slot ${slot2}: resident ${table[slot2].key} has pd ${table[slot2].pd}, incoming ${key5} has pd ${incomingPd5}. Not greater. Continue.`,
  };

  incomingPd5 = 2;
  yield {
    state: snapshot(table, `Insert ${key5}: at slot ${slot3}, incoming pd ${incomingPd5} vs resident pd ${table[slot3].pd}`),
    highlight: { active: [`s${slot3}:key`], compare: [`s${slot3}:pd`] },
    explanation: `Slot ${slot3}: resident ${table[slot3].key} has pd ${table[slot3].pd}, incoming ${key5} has pd ${incomingPd5}. Not greater. Continue.`,
  };

  incomingPd5 = 3;
  yield {
    state: snapshot(table, `Insert ${key5}: at slot ${slot4}, incoming pd ${incomingPd5} vs resident pd ${table[slot4].pd}`),
    highlight: { active: [`s${slot4}:key`], compare: [`s${slot4}:pd`] },
    explanation: `Slot ${slot4}: resident ${table[slot4].key} has pd ${table[slot4].pd}, incoming ${key5} has pd ${incomingPd5}. Not greater. Continue to slot 0.`,
  };

  incomingPd5 = 4;
  const slot5 = 0;
  table[slot5] = { key: key5, pd: incomingPd5 };
  yield {
    state: snapshot(table, `Insert ${key5}: placed at slot ${slot5}, probe distance ${table[slot5].pd}`),
    highlight: { found: [`s${slot5}:key`, `s${slot5}:pd`] },
    explanation: `Slot ${slot5} is empty. Place ${key5} at probe distance ${table[slot5].pd}. That is the longest probe in the table. Now insert one more key that will trigger the Robin Hood swap.`,
  };

  // Insert 5: h(5) = 5, will steal from 4 (pd 2) when incoming pd reaches 3
  const key6 = 5;
  const home6 = homeSlot(key6);
  let incomingPd6 = 0;
  yield {
    state: snapshot(table, `Insert ${key6}: h(${key6}) = ${home6}, probing begins`),
    highlight: { active: [`s${home6}:key`], compare: [`s${home6}:pd`] },
    explanation: `Insert ${key6}. h(${key6}) = ${home6}. Slot ${home6} holds ${table[home6].key} with pd ${table[home6].pd}. Incoming pd is ${incomingPd6}. Not greater. Continue.`,
  };

  incomingPd6 = 1;
  yield {
    state: snapshot(table, `Insert ${key6}: at slot ${slot3}, incoming pd ${incomingPd6} vs resident pd ${table[slot3].pd}`),
    highlight: { active: [`s${slot3}:key`], compare: [`s${slot3}:pd`] },
    explanation: `Slot ${slot3} holds ${table[slot3].key} with pd ${table[slot3].pd}. Incoming ${key6} has pd ${incomingPd6}. Still not greater. Continue.`,
  };

  incomingPd6 = 2;
  yield {
    state: snapshot(table, `Insert ${key6}: at slot ${slot4}, incoming pd ${incomingPd6} vs resident pd ${table[slot4].pd}`),
    highlight: { active: [`s${slot4}:key`], compare: [`s${slot4}:pd`] },
    explanation: `Slot ${slot4} holds ${table[slot4].key} with pd ${table[slot4].pd}. Incoming ${key6} has pd ${incomingPd6}. Not greater. Continue.`,
  };

  // At slot 0: 36 has pd 4, incoming 5 has pd 3. Not greater. Continue to slot 1.
  incomingPd6 = 3;
  yield {
    state: snapshot(table, `Insert ${key6}: at slot ${slot5}, incoming pd ${incomingPd6} vs resident pd ${table[slot5].pd}`),
    highlight: { active: [`s${slot5}:key`], compare: [`s${slot5}:pd`] },
    explanation: `Slot ${slot5} holds ${table[slot5].key} with pd ${table[slot5].pd}. Incoming ${key6} has pd ${incomingPd6}. Not greater (${table[slot5].key} is even poorer). Continue.`,
  };

  incomingPd6 = 4;
  const slot6final = 1;
  table[slot6final] = { key: key6, pd: incomingPd6 };
  yield {
    state: snapshot(table, `Insert ${key6}: placed at slot ${slot6final}, probe distance ${table[slot6final].pd}`),
    highlight: { found: [`s${slot6final}:key`, `s${slot6final}:pd`] },
    explanation: `Slot ${slot6final} is empty. Place ${key6} at probe distance ${table[slot6final].pd}. No swap was triggered because every resident along the path was at least as far from home as the incoming key. To see a swap, consider what happens if we had a different insertion order.`,
  };

  // Now show the swap scenario with a fresh table
  const table2 = makeTable();
  const t2k1 = 11, t2k2 = 12, t2k3 = 3, t2k4 = 6;
  table2[3] = { key: t2k1, pd: 0 };  // h(11) = 3
  table2[4] = { key: t2k2, pd: 0 };  // h(12) = 4
  table2[5] = { key: t2k3, pd: 2 };  // h(3) = 3, probed to 5
  table2[6] = { key: t2k4, pd: 0 };  // h(6) = 6
  const t2insert = 19;
  const t2home = homeSlot(t2insert);
  yield {
    state: snapshot(table2, `New scenario: Robin Hood swap demo`),
    highlight: { active: ['s3:key', 's4:key', 's5:key', 's6:key'] },
    explanation: `Fresh table. Key ${t2k1} sits at its home slot ${homeSlot(t2k1)} (pd ${table2[3].pd}). Key ${t2k2} at home slot ${homeSlot(t2k2)} (pd ${table2[4].pd}). Key ${t2k3} hashed to slot ${homeSlot(t2k3)} but probed to slot 5 (pd ${table2[5].pd}). Key ${t2k4} at home slot ${homeSlot(t2k4)} (pd ${table2[6].pd}). Now insert ${t2insert}: h(${t2insert}) = ${t2home}.`,
  };

  let t2inPd = 0;
  yield {
    state: snapshot(table2, `Insert ${t2insert}: h(${t2insert}) = ${t2home}, slot ${t2home} holds ${table2[t2home].key} (pd ${table2[t2home].pd})`),
    highlight: { active: [`s${t2home}:key`], compare: [`s${t2home}:pd`] },
    explanation: `Slot ${t2home}: resident ${table2[t2home].key} has pd ${table2[t2home].pd}, incoming ${t2insert} has pd ${t2inPd}. Equal -- no swap. Probe to slot ${t2home + 1}.`,
  };

  t2inPd = 1;
  yield {
    state: snapshot(table2, `Insert ${t2insert}: slot 4 holds ${table2[4].key} (pd ${table2[4].pd}), incoming pd ${t2inPd}`),
    highlight: { active: ['s4:key'], compare: ['s4:pd'] },
    explanation: `Slot 4: resident ${table2[4].key} has pd ${table2[4].pd}, incoming ${t2insert} has pd ${t2inPd}. The incoming key has probed FARTHER than the resident. This is the Robin Hood moment: ${t2insert} is "poor" (far from home) and ${table2[4].key} is "rich" (sitting at home). Steal the slot.`,
  };

  // The swap happens
  const displacedKey = table2[4].key;
  const displacedHome = homeSlot(displacedKey);
  const displacedOldPd = table2[4].pd;
  table2[4] = { key: t2insert, pd: t2inPd };
  let displacedPd = displacedOldPd + 1;
  yield {
    state: snapshot(table2, `SWAP: ${t2insert} takes slot 4, displaces ${displacedKey}`),
    highlight: { found: ['s4:key', 's4:pd'], active: ['s5:key'] },
    explanation: `${t2insert} takes slot 4 (pd ${table2[4].pd}). The displaced ${displacedKey} must now find a new home. ${displacedKey}'s home is slot ${displacedHome} (h(${displacedKey}) = ${displacedHome}), and it was at pd ${displacedOldPd}. It continues probing from slot 5 with pd ${displacedPd}.`,
  };

  yield {
    state: snapshot(table2, `Displaced ${displacedKey}: slot 5 holds ${table2[5].key} (pd ${table2[5].pd}), incoming pd ${displacedPd}`),
    highlight: { active: ['s5:key'], compare: ['s5:pd'] },
    explanation: `Slot 5: resident ${table2[5].key} has pd ${table2[5].pd}, displaced ${displacedKey} has pd ${displacedPd}. The resident is poorer (farther from home), so no swap. Continue to slot 6.`,
  };

  displacedPd = 2;
  yield {
    state: snapshot(table2, `Displaced ${displacedKey}: slot 6 holds ${table2[6].key} (pd ${table2[6].pd}), incoming pd ${displacedPd}`),
    highlight: { active: ['s6:key'], compare: ['s6:pd'] },
    explanation: `Slot 6: resident ${table2[6].key} has pd ${table2[6].pd}, displaced ${displacedKey} has pd ${displacedPd}. The incoming key has probed farther. Another Robin Hood swap.`,
  };

  const displaced2Key = table2[6].key;
  const displaced2Home = homeSlot(displaced2Key);
  const displaced2OldPd = table2[6].pd;
  table2[6] = { key: displacedKey, pd: displacedPd };
  const displaced2Pd = displaced2OldPd + 1;
  yield {
    state: snapshot(table2, `SWAP: ${displacedKey} takes slot 6, displaces ${displaced2Key}`),
    highlight: { found: ['s6:key', 's6:pd'], active: ['s7:key'] },
    explanation: `${displacedKey} takes slot 6 (pd ${table2[6].pd}). Displaced ${displaced2Key} (home slot ${displaced2Home}, pd ${displaced2OldPd}) continues from slot 7 with pd ${displaced2Pd}.`,
  };

  table2[7] = { key: displaced2Key, pd: displaced2Pd };
  yield {
    state: snapshot(table2, `Displaced ${displaced2Key} lands at empty slot 7`),
    highlight: { found: ['s7:key', 's7:pd'] },
    explanation: `Slot 7 is empty. ${displaced2Key} lands at pd ${table2[7].pd}. The chain is done. Compare probe distances: before the insert, ${displaced2Key} had pd ${displaced2OldPd} (lucky) while ${t2k3} had pd ${table2[5].pd} (unlucky). After the insert, the maximum probe distance is ${table2[5].pd} and probe distances are more uniform. Robin Hood hashing took from the rich and gave to the poor.`,
  };

  const maxPd = Math.max(...table2.filter(e => e !== null).map(e => e.pd));
  yield {
    state: snapshot(table2, `Final table: probe distances cluster tightly`),
    highlight: { found: ['s3:pd', 's4:pd', 's5:pd', 's6:pd', 's7:pd'] },
    explanation: `The probe distance column tells the story. In plain linear probing, some keys sit at home (pd 0) while others wander far. Robin Hood hashing compresses the variance: no key stays lucky at another key's expense. The maximum probe distance is ${maxPd}, and unsuccessful lookups terminate earlier.`,
    invariant: `For any two keys on the same probe chain, the one closer to its home slot sits earlier in the chain. Maximum probe distance in this table: ${maxPd}.`,
  };
}

function* lookupWithEarlyTermination() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const table = makeTable();
  table[3] = { key: 11, pd: 0 };
  table[4] = { key: 19, pd: 1 };
  table[5] = { key: 3, pd: 2 };
  table[6] = { key: 12, pd: 2 };
  table[7] = { key: 6, pd: 1 };

  const occupiedSlots = table.filter(e => e !== null).length;
  const loadFactor = r2(occupiedSlots / SIZE);
  yield {
    state: snapshot(table, `Robin Hood table: lookup benefits`),
    highlight: { active: ['s3:pd', 's4:pd', 's5:pd', 's6:pd', 's7:pd'] },
    explanation: `This table was built with Robin Hood insertion (${occupiedSlots} keys in ${SIZE} slots, load factor ${loadFactor}). Probe distances are stored alongside keys. This enables a powerful optimization: early termination on unsuccessful lookups. If the element you are searching for would have a probe distance greater than the resident's, the element cannot be in the table.`,
  };

  // Successful lookup: find 3
  const searchKey1 = 3;
  const searchHome1 = homeSlot(searchKey1);
  let searchPd1 = 0;
  yield {
    state: snapshot(table, `Lookup ${searchKey1}: h(${searchKey1}) = ${searchHome1}, start probing`),
    highlight: { active: [`s${searchHome1}:key`] },
    explanation: `Look up key ${searchKey1}. h(${searchKey1}) = ${searchHome1}. Check slot ${searchHome1}: it holds ${table[searchHome1].key}, not ${searchKey1}. In plain linear probing, we would keep scanning until we find ${searchKey1} or hit an empty slot. Robin Hood hashing can do the same, but the probe distance gives us more information.`,
  };

  searchPd1 = 1;
  yield {
    state: snapshot(table, `Lookup ${searchKey1}: slot 4 holds ${table[4].key}, not ${searchKey1}`),
    highlight: { active: ['s4:key'], compare: ['s4:pd'] },
    explanation: `Slot 4 holds ${table[4].key}. Our search probe distance is now ${searchPd1}. The resident's probe distance is ${table[4].pd}. Keep scanning -- the resident is not "richer" than our search position.`,
  };

  searchPd1 = 2;
  yield {
    state: snapshot(table, `Lookup ${searchKey1}: slot 5 holds ${table[5].key} -- found!`),
    highlight: { found: ['s5:key', 's5:pd'] },
    explanation: `Slot 5 holds ${table[5].key}. Found in ${searchPd1 + 1} probes (slots ${searchHome1}, ${searchHome1 + 1}, ${searchHome1 + 2}). The probe distance recorded is ${table[5].pd}, which matches our search distance of ${searchPd1}. Successful lookups behave similarly to plain linear probing.`,
  };

  // Unsuccessful lookup with early termination: look for 27
  const searchKey2 = 27;
  const searchHome2 = homeSlot(searchKey2);
  let searchPd2 = 0;
  yield {
    state: snapshot(table, `Lookup ${searchKey2}: h(${searchKey2}) = ${searchHome2}, does ${searchKey2} exist?`),
    highlight: { active: [`s${searchHome2}:key`] },
    explanation: `Look up key ${searchKey2}. h(${searchKey2}) = ${searchHome2}. Slot ${searchHome2} holds ${table[searchHome2].key} (pd ${table[searchHome2].pd}). Our search pd is ${searchPd2}. Keep scanning.`,
  };

  searchPd2 = 1;
  yield {
    state: snapshot(table, `Lookup ${searchKey2}: slot 4, search pd ${searchPd2} vs resident pd ${table[4].pd}`),
    highlight: { active: ['s4:key'], compare: ['s4:pd'] },
    explanation: `Slot 4 holds ${table[4].key} (pd ${table[4].pd}). Our search pd is ${searchPd2}. Equal. Keep scanning.`,
  };

  searchPd2 = 2;
  yield {
    state: snapshot(table, `Lookup ${searchKey2}: slot 5, search pd ${searchPd2} vs resident pd ${table[5].pd}`),
    highlight: { active: ['s5:key'], compare: ['s5:pd'] },
    explanation: `Slot 5 holds ${table[5].key} (pd ${table[5].pd}). Our search pd is ${searchPd2}. Equal. Keep scanning.`,
  };

  searchPd2 = 3;
  yield {
    state: snapshot(table, `Lookup ${searchKey2}: slot 6, search pd ${searchPd2} vs resident pd ${table[6].pd} -- STOP`),
    highlight: { active: ['s6:key'], compare: ['s6:pd'] },
    explanation: `Slot 6 holds ${table[6].key} with pd ${table[6].pd}. Our search pd is ${searchPd2}. Our probe distance exceeds the resident's. If ${searchKey2} existed in the table and hashed to slot ${searchHome2}, the Robin Hood insertion rule would have placed it before any key with a shorter probe distance. Since the resident at pd ${table[6].pd} is "richer" than our pd ${searchPd2} search position, ${searchKey2} cannot exist beyond this point. Absent -- confirmed without reaching an empty slot.`,
    invariant: `Robin Hood ordering means keys are sorted by probe distance along each chain. Once your search probe distance (${searchPd2}) exceeds a resident's (${table[6].pd}), the key is provably absent.`,
  };

  // Compare with plain linear probing
  const probesUsed = searchPd2 + 1;
  yield {
    state: snapshot(table, `Early termination saves probes on misses`),
    highlight: { visited: [`s${searchHome2}:key`, 's4:key', 's5:key', 's6:key'] },
    explanation: `Plain linear probing would continue scanning slot 6, slot 7, and only stop at an empty slot. Robin Hood hashing stopped at slot 6 after ${probesUsed} probes by comparing probe distances. For dense tables (load factor 80-90%), this makes unsuccessful lookups much faster. The variance in lookup cost shrinks because the maximum probe distance itself is smaller.`,
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
        'The animation shows open addressing, where keys live directly inside the hash table. A collision means the target slot is occupied, so insertion probes later slots until it finds a place.',
        {type: 'callout', text: 'Robin Hood hashing reduces lookup tail cost by equalizing probe distances across an open-addressed cluster.'},
        'Probe distance means how far a key sits from its ideal hash slot. Active cells show the current probe, and compare cells show the resident key whose distance is being checked.',
        'The safe inference is the swap rule. If the incoming key has traveled farther than the resident key, the incoming key takes the slot and the resident key continues probing.',
        {type: 'image', src: './assets/gifs/robin-hood-hashing.gif', alt: 'Animated walkthrough of the robin hood hashing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Hash tables are expected to give fast lookup, but average lookup time can hide bad tails. A service may tolerate average two-probe lookups while still suffering latency spikes from keys stuck deep inside clusters.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Standard_deviation_diagram.svg', alt: 'Normal curve with standard deviation regions', caption: 'The target is variance reduction: average probe cost can be fine while the tail still hurts latency. Source: https://commons.wikimedia.org/wiki/File:Standard_deviation_diagram.svg.'},
        'Robin Hood hashing exists to reduce variance in probe distances. It tries to keep unlucky keys from becoming extremely unlucky while lucky keys sit close to home.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious open-addressing method is linear probing. Hash the key to an ideal slot, and if that slot is full, scan forward until an empty slot appears.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/HASHTB12.svg/500px-HASHTB12.svg.png', alt: 'Hash table diagram showing collisions resolved by linear probing', caption: 'Open addressing stores records inside the table and resolves a collision by probing later slots. Source: https://commons.wikimedia.org/wiki/File:HASHTB12.svg.'},
        'Linear probing is cache-friendly because probes walk contiguous memory. It performs well at moderate load, and deletion can be handled with tombstones or backward shifting.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is clustering. Once several occupied slots form a run, new keys that hash into the run extend it, and lookups for keys near the end become expensive.',
        'Plain linear probing does not care who has already suffered many probes. A key can sit ten slots from home while another key sits one slot from home, even if swapping them would reduce the worst lookup path.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Robin Hood hashing uses probe distance as priority. A key that has traveled farther is treated as poorer, so it steals a slot from a key that is closer to its ideal position.',
        'This does not necessarily reduce the total number of probes. It reduces spread, which makes lookup cost more predictable and gives failed searches an early stopping rule.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During insertion, keep the incoming key and its current probe distance. At each occupied slot, compute the resident key distance from its own ideal slot.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A probe chain is a directed walk through candidate slots; the Robin Hood rule changes who gets to stop earlier on that walk. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'If the incoming distance is greater than the resident distance, swap them. The displaced resident becomes the incoming key and continues probing with its distance increased.',
        'Lookup follows the same probe sequence. If it reaches an empty slot, the key is absent; if it reaches a resident with a smaller probe distance than the search distance, the key is also absent because the sought key would have stolen that slot earlier.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is monotone fairness along a cluster: keys with larger probe distances are not allowed to sit behind keys with smaller distances when the larger-distance key arrives at that slot. Each insertion restores this local ordering by swapping.',
        'The early-stop lookup rule follows from the same invariant. If the search has probed distance d and finds a resident with distance less than d, the searched key could not have been inserted beyond that point without displacing the resident.',
        'Correctness still depends on probing every possible candidate until a proof of absence appears. Robin Hood changes placement order, but equality is still checked by comparing stored keys, not by trusting hashes alone.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Expected lookup and insertion are O(1) under a good hash function and a bounded load factor. Doubling the table while keeping load factor fixed keeps expected probe counts similar, but rehashing costs O(n).',
        'The behavior improvement is in the tail. At high load, Robin Hood tends to make long probe distances less extreme, so the worst successful lookups are closer to the average.',
        'The extra cost is insertion work. A single insertion can trigger several swaps, and deletion usually needs backward shifting or tombstone handling that preserves the probe-distance invariant.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Robin Hood hashing fits in-memory maps where cache locality and predictable lookup latency matter. It is common in high-performance hash-map libraries that use contiguous arrays instead of per-entry heap nodes.',
        'It is useful for compiler symbol tables, routing metadata, runtime dictionaries, and analytics engines that perform many point lookups. The access pattern is repeated exact lookup with controlled load factor and stable hash quality.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails under poor or adversarial hashing. If many keys share nearby ideal slots, no placement rule can avoid long clusters without resizing or changing the hash function.',
        'It is also a poor fit when stable references to entries are required. Open-addressed tables move entries during insertion, deletion, and rehashing, so pointers into the table are fragile.',
        'Very high load factors make every open-addressed strategy tense. Robin Hood reduces variance, but it does not make a nearly full table cheap.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a table of size 8. Insert A with ideal slot 2, so A lands at 2 with distance 0; insert B with ideal slot 2, slot 2 is full, so B lands at 3 with distance 1.',
        'Now insert C with ideal slot 2. It probes slot 2 with distance 0, then slot 3 with distance 1, then lands at slot 4 with distance 2 because A and B are not poorer than C when compared.',
        'Insert D with ideal slot 3. At slot 3, D has distance 0 while B has distance 1, so D does not steal. At slot 4, D has distance 1 while C has distance 2, so D still does not steal and lands at slot 5 with distance 2.',
        'If a later key E reaches a slot with distance 4 while the resident has distance 1, E swaps in. That single swap reduces the worst-case distance for E and pushes the luckier resident forward.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Pedro Celis, Robin Hood hashing, 1986; Knuth, The Art of Computer Programming, hashing sections; modern hash-map implementation notes from Abseil SwissTable and related open-addressing designs.',
        'Study next by contrast. Read Hash Table for the basic contract, Linear Probing for the baseline, Cuckoo Hashing for a relocation-based alternative, Load Factor for resizing behavior, and Universal Hashing for adversarial-risk control.',
      ],
    },
  ],
};
