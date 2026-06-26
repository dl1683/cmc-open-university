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
  const keyCount = 4; // apple, apricot, banana, berry
  const slotCount = 8; // number of slots in the filter
  const fingerprintBits = 6; // total fingerprint bits
  const quotientBits = 3;
  const remainderBits = 3;

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
    explanation: `A quotient filter hashes each of ${keyCount} keys into a ${fingerprintBits}-bit fingerprint, then splits it into a ${quotientBits}-bit quotient and ${remainderBits}-bit remainder. The quotient chooses one of ${slotCount} canonical slots; the stored remainder is the compact evidence.`,
  };

  yield {
    state: slots('Remainders live in quotient-indexed runs'),
    highlight: { active: ['s2:rem', 's3:rem', 's2:occupied', 's3:cont', 's3:shifted'], found: ['s5:rem', 's6:rem'] },
    explanation: `Collisions form runs across the ${slotCount} slots. Metadata bits encode whether a quotient is occupied, whether a slot continues a run, and whether an entry was shifted away from its canonical slot.`,
    invariant: `The filter never stores full keys, only compact ${remainderBits}-bit remainders selected by ${quotientBits}-bit quotients.`,
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
    explanation: `Like a Bloom Filter, a quotient filter can say definitely absent or probably present. Unlike a basic Bloom filter, it stores movable ${fingerprintBits}-bit fingerprints across ${slotCount} slots, which can support deletion and merging in variants.`,
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
    explanation: `Quotient filters are easiest to understand as another point in the approximate-membership design space: compact ${fingerprintBits}-bit fingerprints split into ${quotientBits}+${remainderBits} bits, local scans, and metadata instead of multiple independent bit positions.`,
  };
}

function* lookupAndDelete() {
  const slotCount = 8;
  const deleteSteps = 4; // find, remove, shift, repair

  yield {
    state: slots('Lookup quotient 2 with remainder 04'),
    highlight: { active: ['s2:occupied', 's2:rem', 's3:rem'], found: ['s2:rem'] },
    explanation: `A lookup jumps to the quotient slot among ${slotCount} total slots, finds the run for that quotient, and scans remainders in the run. If the queried remainder appears, the answer is probably present.`,
  };

  yield {
    state: slots('Lookup quotient 4 stops at an empty canonical slot'),
    highlight: { active: ['s4:occupied', 's4:rem'], removed: ['s4:rem'] },
    explanation: `If the canonical slot is not occupied, no key with that quotient has been inserted across the ${slotCount}-slot table. That gives the definitive "absent" answer.`,
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
    explanation: `Deletion requires ${deleteSteps} steps (find, remove, shift, repair) because fingerprints are represented as entries, not just smeared across independent bits. The clustered layout across ${slotCount} slots means deletion must repair shifts and metadata.`,
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
    explanation: `Approximate membership structures are not only theoretical. They are practical front doors for expensive storage and network lookups, each scanning a table of ${slotCount} or more slots.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each key as first becoming a short fingerprint, meaning a compact hash-derived identifier. The quotient is the high part of that fingerprint and chooses a home slot; the remainder is the low part that is stored near that slot.',
        { type: 'callout', text: 'A quotient filter turns one hash fingerprint into a local run: absence is exact when the quotient run cannot contain the remainder.' },
        'Occupied, continuation, and shifted bits are metadata that let the table decode runs after collisions move entries away from home. A found remainder means maybe present; an empty quotient run means definitely absent for inserted keys.',
      
        {type: 'image', src: './assets/gifs/quotient-filter.gif', alt: 'Animated walkthrough of the quotient filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A quotient filter is an approximate membership structure. It answers whether a key is definitely absent or maybe present while storing far less than the full set of keys.',
        'This exists because many systems ask membership questions before expensive work. A negative answer can skip a disk read, network lookup, or duplicate-processing path, while a positive answer can fall through to the exact backing store.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious exact approach is a hash set of full keys. It gives exact membership, but it stores every key or a large reference to every key.',
        'The obvious compact approach is a Bloom filter. It scatters several hash bits into a bit array and gives no false negatives, but deletion requires counters or extra machinery because one bit may support many keys.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Bloom evidence is not entry-like. A key is represented by several independent bit positions, so removing one key risks damaging evidence for another key.',
        'The wall is locality and mutability. If the filter needs deletion, merging, or cache-friendly lookup, a design based on movable compact entries can be easier to manage than scattered bits.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Hash the key to a fingerprint and split it into quotient plus remainder. The quotient selects a canonical slot, and the filter stores the remainder in the run for that quotient.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Bloom_filter.svg', alt: 'Bloom filter diagram showing several hash functions setting bits in an array', caption: 'Bloom filters scatter evidence across independent bit positions; quotient filters keep compact fingerprint evidence local. Source: Wikimedia Commons, Bloom filter.svg, public domain: https://commons.wikimedia.org/wiki/File:Bloom_filter.svg' },
        'Collisions form local runs instead of overwriting entries. Metadata records which quotients are occupied, which slots continue a run, and which entries were shifted from their canonical slot.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion computes a p-bit fingerprint. If q bits are used as the quotient and r bits as the remainder, the table has 2^q home slots and stores r-bit remainders.',
        'Lookup jumps to the quotient slot, decodes the run for that quotient, and scans for the remainder. If the quotient is not occupied, lookup stops immediately with definitely absent.',
        'Deletion removes the matching remainder, shifts later entries back if needed, and repairs metadata. That repair is the cost of keeping fingerprints as local movable entries.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The no-false-negative guarantee depends on the run invariant. Every inserted fingerprint keeps its remainder in the run selected by its quotient, so a later lookup for the same fingerprint searches the same run.',
        'False positives remain possible because the original key is not stored. Two different keys can share the same quotient and remainder, and the filter cannot distinguish them without checking the backing store.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is expected O(1) when the table load keeps clusters short. As load rises, runs grow longer, so each lookup scans more slots and deletion repair touches more metadata.',
        'Space is roughly one stored remainder plus metadata bits per slot. More remainder bits reduce false positives; more quotient bits create more slots and shorten runs at the cost of memory.',
        'Doubling capacity by adding one quotient bit doubles the slot count. Doubling the number of stored items without resizing raises load, which makes the constant factors worse even when the expected asymptotic form still says O(1).',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Quotient filters fit storage engines that want a compact guard before disk pages or sorted runs. A negative answer avoids an exact lookup, while a positive answer asks the storage layer to verify.',
        'They also fit deduplication windows, cache front doors, and systems that need deletion from an approximate filter. The local run layout gives a different operating point than Bloom, cuckoo, xor, and binary-fuse filters.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A quotient filter is not an exact set. A positive answer is only maybe present, so correctness-critical reads must verify against the backing store.',
        'High load and bad hash distribution are dangerous. Long clusters erase the locality advantage, and one incorrect metadata bit can make future lookups decode the wrong run.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use 8 slots, so q = 3 quotient bits. Let apricot have fingerprint 010100, giving quotient 010, home slot 2, and remainder 100.',
        'Let berry have fingerprint 010011. It has the same quotient 010 and remainder 011, so both remainders belong in the run for slot 2 rather than one overwriting the other.',
        'A lookup for berry goes to slot 2 and scans the quotient-2 run for 011. A lookup with quotient 100 can return definitely absent if slot 4 is not marked occupied.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Bender et al., Don\'t Thrash: How to Cache Your Hash on Flash, 2012; Dutta et al., The Quotient Filter: A Space-Efficient Data Structure for Approximate Membership Queries, 2013.',
        'Study Bloom filters first for the membership contract, then cuckoo filters for fingerprint buckets, counting Bloom filters for deletion through counters, LSM trees for storage-engine use, and hash tables for collision management.',
      ],
    },
  ],
};