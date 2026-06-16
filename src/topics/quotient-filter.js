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
      heading: 'What it is',
      paragraphs: [
        'A quotient filter is a compact approximate-membership data structure. It hashes each key into a fingerprint, uses the high bits as a quotient to choose a slot, and stores the low bits as a remainder inside a clustered run.',
        'Like Bloom Filter and Cuckoo Hashing, it answers "definitely not present" or "probably present." Its particular design emphasizes locality, compact fingerprints, and variants that support deletion and merging.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The quotient selects a canonical slot. If multiple fingerprints share a quotient or collide with nearby entries, the filter stores remainders in a contiguous cluster. Metadata bits mark occupied quotients, continuation entries, and shifted entries so the implementation can recover run boundaries.',
        'Lookup jumps to the quotient slot and scans the matching run for the remainder. Deletion removes the remainder and repairs the cluster so later lookups still decode correctly.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Quotient filters use space proportional to stored fingerprints plus metadata bits. Lookup is local when clusters are short, but high load factors create longer runs. False positives depend on fingerprint length. Deletion and merging are possible but require careful metadata maintenance.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Quotient filters and related AMQs are useful before disk reads, object lookups, duplicate detection, database compaction, streaming pipelines, and systems that need compact probabilistic sets with locality.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A quotient filter is not exact. Matching a remainder means the fingerprint matches, not that the original key was certainly inserted. Another misconception is that deletion is free. The clustered representation makes deletion possible, but correctness depends on repairing run metadata.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: Stanford approximate-membership lecture notes at https://web.stanford.edu/class/archive/cs/cs166/cs166.1196/lectures/14/Small14.pdf, the streaming quotient filter paper at https://www.vldb.org/pvldb/vol6/p589-dutta.pdf, and quotient-filter GPU paper metadata at https://escholarship.org/uc/item/3v12f7dn. Study Bloom Filter, Cuckoo Hashing, Hash Table, LSM Trees (How Cassandra Writes), and Count-Min Sketch next.',
      ],
    },
  ],
};
