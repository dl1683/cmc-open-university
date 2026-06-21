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
        'The table shows 8 slots, each displaying a key and its probe distance -- how far that key sits from its home slot (h(key) mod 8). Active highlights mark the slot being examined. Collision highlights show an occupied slot blocking the incoming key. Found highlights mark a key that just landed.',
        {type: 'callout', text: 'Robin Hood hashing reduces lookup tail cost by equalizing probe distances across an open-addressed cluster.'},
        'The probe distance column is the heart of Robin Hood hashing. Watch it during insertion: when the incoming key\'s probe distance exceeds the resident\'s, the resident is evicted and the incoming key takes the slot. The evicted key then continues probing. During lookup, the probe distance enables early termination: if your search distance exceeds the resident\'s, the key is absent.',
        'The insert-walk view shows collisions, the swap decision, and the cascade of displaced keys. The lookup view shows how probe-distance ordering makes unsuccessful lookups fast.',
      
        {type: 'image', src: './assets/gifs/robin-hood-hashing.gif', alt: 'Animated walkthrough of the robin hood hashing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
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
