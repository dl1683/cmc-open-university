// Quotient filter: an approximate membership structure that stores compact
// fingerprints in quotient-indexed slots with metadata bits for runs.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'quotient-filter',
  title: 'Quotient Filter',
  category: 'Data Structures',
  summary: 'A compact approximate-membership filter: split fingerprints into quotient slots and stored remainders, then scan runs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fingerprint layout', 'lookup and delete'], defaultValue: 'fingerprint layout' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function slots(title) {
  return labelMatrix(
    title,
    [
      { id: 's0', label: 'slot 0' },
      { id: 's1', label: 'slot 1' },
      { id: 's2', label: 'slot 2' },
      { id: 's3', label: 'slot 3' },
      { id: 's4', label: 'slot 4' },
      { id: 's5', label: 'slot 5' },
      { id: 's6', label: 'slot 6' },
      { id: 's7', label: 'slot 7' },
    ],
    [
      { id: 'rem', label: 'remainder' },
      { id: 'occupied', label: 'occupied' },
      { id: 'cont', label: 'continuation' },
      { id: 'shifted', label: 'shifted' },
    ],
    [
      ['', '0', '0', '0'],
      ['11', '1', '0', '0'],
      ['04', '1', '0', '1'],
      ['19', '0', '1', '1'],
      ['', '0', '0', '0'],
      ['02', '1', '0', '0'],
      ['18', '0', '1', '1'],
      ['', '0', '0', '0'],
    ],
  );
}

function* fingerprintLayout() {
  yield {
    state: labelMatrix(
      'Hash fingerprint splits into quotient and remainder',
      [
        { id: 'apple', label: 'apple' },
        { id: 'apricot', label: 'apricot' },
        { id: 'banana', label: 'banana' },
        { id: 'berry', label: 'berry' },
      ],
      [
        { id: 'fingerprint', label: 'fingerprint' },
        { id: 'quotient', label: 'quotient' },
        { id: 'remainder', label: 'remainder' },
        { id: 'slot', label: 'home slot' },
      ],
      [
        ['001011', '001', '011', '1'],
        ['010100', '010', '100', '2'],
        ['101010', '101', '010', '5'],
        ['010011', '010', '011', '2'],
      ],
    ),
    highlight: { active: ['apple:quotient', 'apple:remainder', 'berry:quotient', 'berry:remainder'], found: ['apricot:slot', 'berry:slot'] },
    explanation: 'A quotient filter hashes each key into a fingerprint, then splits that fingerprint into a quotient and remainder. The quotient chooses the canonical slot; the stored remainder is the compact evidence.',
  };

  yield {
    state: slots('Remainders live in quotient-indexed runs'),
    highlight: { active: ['s2:rem', 's3:rem', 's2:occupied', 's3:cont', 's3:shifted'], found: ['s5:rem', 's6:rem'] },
    explanation: 'Collisions form runs. Metadata bits encode whether a quotient is occupied, whether a slot continues a run, and whether an entry was shifted away from its canonical slot.',
    invariant: 'The filter never stores full keys, only compact fingerprints.',
  };

  yield {
    state: labelMatrix(
      'Membership answers',
      [
        { id: 'hit', label: 'remainder found' },
        { id: 'miss', label: 'quotient empty' },
        { id: 'maybe', label: 'same fingerprint' },
        { id: 'delete', label: 'delete' },
      ],
      [
        { id: 'answer', label: 'answer' },
        { id: 'certainty', label: 'certainty' },
      ],
      [
        ['probably present', 'false positives possible'],
        ['definitely absent', 'no false negatives'],
        ['probably present', 'key identity unknown'],
        ['remove fingerprint', 'metadata must be repaired'],
      ],
    ),
    highlight: { found: ['miss:answer', 'miss:certainty'], compare: ['hit:certainty', 'maybe:certainty'] },
    explanation: 'Like a Bloom Filter, a quotient filter can say definitely absent or probably present. Unlike a basic Bloom filter, it stores movable fingerprints, which can support deletion and merging in variants.',
  };

  yield {
    state: labelMatrix(
      'Approximate-membership family',
      [
        { id: 'bloom', label: 'Bloom Filter' },
        { id: 'cuckoo', label: 'Cuckoo Filter' },
        { id: 'quotient', label: 'Quotient Filter' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'good', label: 'good at' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['bits', 'simple inserts', 'deletion needs counting'],
        ['fingerprints', 'deletion + lookup locality', 'eviction failures'],
        ['remainder runs', 'locality + merge variants', 'cluster management'],
      ],
    ),
    highlight: { found: ['quotient:stores', 'quotient:good'], compare: ['bloom:tradeoff', 'cuckoo:tradeoff'] },
    explanation: 'Quotient filters are easiest to understand as another point in the approximate-membership design space: compact fingerprints, local scans, and metadata instead of multiple independent bit positions.',
  };
}

function* lookupAndDelete() {
  yield {
    state: slots('Lookup quotient 2 with remainder 04'),
    highlight: { active: ['s2:occupied', 's2:rem', 's3:rem'], found: ['s2:rem'] },
    explanation: 'A lookup jumps to the quotient slot, finds the run for that quotient, and scans remainders in the run. If the queried remainder appears, the answer is probably present.',
  };

  yield {
    state: slots('Lookup quotient 4 stops at an empty canonical slot'),
    highlight: { active: ['s4:occupied', 's4:rem'], removed: ['s4:rem'] },
    explanation: 'If the canonical slot is not occupied, no key with that quotient has been inserted. That gives the definitive "absent" answer.',
  };

  yield {
    state: labelMatrix(
      'Delete must preserve runs',
      [
        { id: 'find', label: 'find entry' },
        { id: 'remove', label: 'clear remainder' },
        { id: 'shift', label: 'shift cluster back' },
        { id: 'repair', label: 'repair metadata' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'why', label: 'why required' },
      ],
      [
        ['scan quotient run', 'target exact fingerprint'],
        ['remove stored remainder', 'delete evidence'],
        ['close empty gap', 'lookups still find later entries'],
        ['update bits', 'run boundaries stay decodable'],
      ],
    ),
    highlight: { active: ['find:operation', 'remove:operation'], found: ['shift:why', 'repair:why'] },
    explanation: 'Deletion is possible because fingerprints are represented as entries, not just smeared across independent bits. But the clustered layout means deletion must repair shifts and metadata.',
  };

  yield {
    state: labelMatrix(
      'Where quotient filters fit',
      [
        { id: 'database', label: 'database page check' },
        { id: 'stream', label: 'duplicate detection' },
        { id: 'storage', label: 'object storage' },
        { id: 'gpu', label: 'GPU variant' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'link', label: 'study link' },
      ],
      [
        ['could this key be on disk?', 'LSM Trees'],
        ['have we seen this fingerprint?', 'Count-Min Sketch'],
        ['is object probably present?', 'CRUSH Placement'],
        ['many lookups in parallel', 'Ray Distributed Execution'],
      ],
    ),
    highlight: { found: ['database:question', 'stream:question'], compare: ['gpu:link'] },
    explanation: 'Approximate membership structures are not only theoretical. They are practical front doors for expensive storage and network lookups.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fingerprint layout') yield* fingerprintLayout();
  else if (view === 'lookup and delete') yield* lookupAndDelete();
  else throw new InputError('Pick a quotient-filter view.');
}

export const article = {
  sections: [
    {
      heading: 'The problem',
      paragraphs: [
        'Approximate-membership filters sit in front of expensive truth sources. A database page check, object-store shard lookup, stream dedupe table, or cache miss path wants to reject keys that are definitely absent without reading the full backing structure.',
        'The filter must be small, fast, and honest about uncertainty. A negative answer must be exact for inserted keys. A positive answer can only mean maybe present, because the filter stores fingerprints rather than full keys.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious solution is a Bloom filter. Hash the key several ways, set bits, and answer maybe-present only when all required bits are set. That is simple and often good enough.',
        'The wall appears when the system wants entry-like behavior. Bloom evidence is smeared across unrelated bit positions, so deletion needs counters or extra structure. Locality is weak because one lookup touches several independent positions. Merging and resizing are possible in some designs, but not as direct as moving compact stored fingerprints.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'A quotient filter stores the evidence for a key as a compact remainder in a quotient-indexed table. Hash the key to a fingerprint. Split the fingerprint into a quotient and a remainder. The quotient selects a canonical slot; the table stores the remainder near that slot.',
        'Collisions become runs. Metadata bits tell the decoder which quotients are occupied, which slots continue a run, and which entries have been shifted away from their canonical slot. The result is still approximate, but the filter now has local entries it can scan, shift, and delete.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'Insertion computes a p-bit fingerprint, uses the high q bits as the quotient, and stores the remaining r bits as the remainder. If the canonical slot is free, the remainder can sit there. If the slot is part of a cluster, the insertion places the remainder into the correct quotient run and shifts later entries forward.',
        'Lookup first checks whether the quotient is marked occupied. If not, no inserted key with that quotient exists, so the answer is definitely absent. If the quotient is occupied, the decoder locates the cluster, finds the run for that quotient, and scans the run for the queried remainder.',
        'Deletion removes the matching remainder from its run, shifts later entries back when needed, and repairs the metadata bits. That repair step is the price of having movable compact entries rather than independent Bloom bits.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The no-false-negative guarantee comes from the run invariant: every inserted fingerprint keeps its remainder in the run selected by its quotient. A lookup for the same fingerprint visits that same run.',
        'False positives remain possible because the original key is gone. If a different key produces the same quotient and remainder, the filter cannot distinguish it from the inserted key. With r remainder bits, the rough false-positive scale is about 2^-r, with load and implementation details affecting constants.',
        'This is also why the hash function is part of the correctness story. A biased hash can create overloaded quotients and repeated remainders, raising false positives and cluster length at the same time. The table logic assumes fingerprints are distributed well enough that runs stay short.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose "apricot" hashes to fingerprint 010100. The quotient is 010, so its canonical slot is 2, and the stored remainder is 100. Suppose "berry" hashes to 010011. It has the same quotient 010 and remainder 011, so both remainders belong in the run for quotient 2.',
        'A lookup for "berry" jumps to quotient 2, decodes the run, and scans for remainder 011. If it is present, the answer is maybe present. A lookup for a key whose quotient is 4 can stop immediately when slot 4 is not marked occupied. That negative answer is exact.',
      ],
    },
    {
      heading: 'Cost and tradeoff',
      paragraphs: [
        'Lookup is expected O(1) when the load factor keeps clusters short. It is also cache-friendly because the scan stays near the quotient slot. Insert and delete are more expensive than Bloom updates because they can shift clustered entries and update metadata.',
        'Space is the stored remainder bits plus metadata bits per slot. Increasing the remainder length lowers false positives. Increasing load saves space but grows clusters, raises scan cost, and makes metadata repair more delicate.',
      ],
    },
    {
      heading: 'Choosing parameters',
      paragraphs: [
        'Pick the quotient bits from capacity and the remainder bits from tolerated false positives. More quotient bits create more slots, which lowers load and shortens clusters. More remainder bits make accidental fingerprint matches less likely. A design that saves a few bits per entry but pushes the table near saturation can lose the lookup behavior that made the filter attractive.',
        'Plan for growth before choosing the layout. If the filter is a short-lived guard for a batch, rebuilding may be fine. If it sits in a storage service, you need a policy for compaction, rebuilding, or rolling to a larger filter before long clusters become normal. Approximate structures still need operational capacity planning.',
      ],
    },
    {
      heading: 'Testing the invariant',
      paragraphs: [
        'A useful test suite builds hostile clusters on purpose. Insert several fingerprints with the same quotient, delete from the front, middle, and back of the run, then verify that every remaining inserted fingerprint is still found. Random tests should compare the filter against an exact set and assert no false negatives across thousands of insert/delete sequences.',
        'Measure cluster length, load factor, false-positive rate, and delete-repair behavior. The structure is small enough that a bug may pass casual examples while corrupting one metadata bit in a dense cluster. That single bit can make later lookups decode the wrong run.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'A quotient filter is not an exact set. A positive answer must be verified against the backing store when correctness matters. It is also not a free mutable index: high load, long clusters, or incorrect metadata updates can turn a small local structure into a source of missed entries.',
        'Deletion is the sharp edge. Removing the right remainder is not enough; the implementation must preserve decodable run boundaries for every later quotient in the cluster. Tests should include clustered inserts, deletes from the middle of runs, and deletes that collapse cluster edges.',
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        'Use quotient filters when locality, compact fingerprints, or deletion support matter more than the absolute simplicity of a Bloom filter. They fit storage-engine page guards, cache front doors, duplicate detection windows, streaming membership summaries, and merge-oriented approximate-membership designs.',
        'They are useful to study beside Bloom, cuckoo, xor, and binary-fuse filters because they show a different design point: quotient-indexed runs with local scans and metadata, not scattered bits or alternate buckets.',
        'In a storage engine, the usual pattern is conservative: a negative answer skips disk, while a positive answer triggers the real lookup. That means false positives cost extra work, but false negatives would lose data. This asymmetry is the reason approximate membership filters are acceptable in front of exact stores.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the fingerprint-layout view, start with the split table. The quotient column explains the home slot; the remainder column explains what is actually stored. When two keys share quotient 2, the slot table shows why a run forms instead of overwriting one entry with another.',
        'In the lookup-and-delete view, compare the quotient-2 lookup with the quotient-4 lookup. Quotient 2 must scan a run for the remainder. Quotient 4 can stop at an unoccupied canonical slot. In the delete frame, focus on the shift and repair rows; those are the steps that keep future lookups from losing the rest of the cluster.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: Stanford approximate-membership lecture notes at https://web.stanford.edu/class/archive/cs/cs166/cs166.1196/lectures/14/Small14.pdf, the streaming quotient filter paper at https://www.vldb.org/pvldb/vol6/p589-dutta.pdf, and quotient-filter GPU paper metadata at https://escholarship.org/uc/item/3v12f7dn.',
        'Study Bloom Filter, Counting Bloom Filter, Cuckoo Filter, Cuckoo Hashing, Hash Table, Xor Filter, Binary Fuse Filter, Ribbon Filter, LSM Trees, and Count-Min Sketch next.',
      ],
    },
  ],
};
