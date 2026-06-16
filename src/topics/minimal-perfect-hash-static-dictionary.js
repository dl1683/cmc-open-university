// Minimal perfect hashing: for a fixed key set, build a collision-free mapping
// into exactly 0..n-1 so values can live in a dense array.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'minimal-perfect-hash-static-dictionary',
  title: 'Minimal Perfect Hash Static Dictionary',
  category: 'Data Structures',
  summary: 'A static dictionary trick: precompute a hash function that maps a known key set onto 0..n-1 with no collisions, then store payloads in a dense array.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build perfect ids', 'lookup and caveats'], defaultValue: 'build perfect ids' },
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

function* buildPerfectIds() {
  yield {
    state: graphState({
      nodes: [
        { id: 'keys', label: 'known keys', x: 0.8, y: 3.6, note: 'static set' },
        { id: 'builder', label: 'builder', x: 2.7, y: 3.6, note: 'search seeds' },
        { id: 'mphf', label: 'MPHF', x: 4.6, y: 3.6, note: 'no collisions' },
        { id: 'ids', label: '0..n-1', x: 6.5, y: 3.6, note: 'dense' },
        { id: 'values', label: 'values[]', x: 8.4, y: 3.6, note: 'array' },
      ],
      edges: [
        { id: 'e-keys-builder', from: 'keys', to: 'builder' },
        { id: 'e-builder-mphf', from: 'builder', to: 'mphf' },
        { id: 'e-mphf-ids', from: 'mphf', to: 'ids' },
        { id: 'e-ids-values', from: 'ids', to: 'values' },
      ],
    }, { title: 'Fixed keys become dense array ids' }),
    highlight: { active: ['builder', 'mphf'], found: ['ids', 'values'] },
    explanation: 'Given a fixed set of n keys, a minimal perfect hash function maps every stored key to a unique integer from 0 to n-1. No collisions, no empty slots for member keys.',
    invariant: 'Perfect means no collisions for the known set; minimal means the range has exactly n slots.',
  };

  yield {
    state: labelMatrix(
      'Perfect id assignment',
      [
        { id: 'cat', label: 'cat' },
        { id: 'dog', label: 'dog' },
        { id: 'eel', label: 'eel' },
        { id: 'fox', label: 'fox' },
      ],
      [
        { id: 'ordinary', label: 'ordinary hash' },
        { id: 'perfect', label: 'perfect id' },
      ],
      [
        ['bucket 7', '2'],
        ['bucket 7', '0'],
        ['bucket 3', '3'],
        ['bucket 3', '1'],
      ],
    ),
    highlight: { collision: ['cat:ordinary', 'dog:ordinary', 'eel:ordinary', 'fox:ordinary'], found: ['cat:perfect', 'dog:perfect', 'eel:perfect', 'fox:perfect'] },
    explanation: 'An ordinary hash can collide and needs probing or chaining. A perfect-hash builder searches for auxiliary data so this exact key set lands in unique slots.',
  };

  yield {
    state: labelMatrix(
      'Dense value table',
      [
        { id: 'slot0', label: 'slot 0' },
        { id: 'slot1', label: 'slot 1' },
        { id: 'slot2', label: 'slot 2' },
        { id: 'slot3', label: 'slot 3' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'payload', label: 'payload' },
      ],
      [
        ['dog', 'value dog'],
        ['fox', 'value fox'],
        ['cat', 'value cat'],
        ['eel', 'value eel'],
      ],
    ),
    highlight: { found: ['slot0:payload', 'slot1:payload', 'slot2:payload', 'slot3:payload'] },
    explanation: 'Once keys have dense ids, payload storage becomes a plain array. That is the attraction: compact metadata plus direct indexing for a read-only dictionary.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'load factor', min: 0, max: 100 }, y: { label: 'lookup probes / overhead', min: 0, max: 100 } },
      series: [
        { id: 'hash', label: 'ordinary hash table', points: [{ x: 40, y: 22 }, { x: 70, y: 42 }, { x: 90, y: 78 }] },
        { id: 'mphf', label: 'MPHF static ids', points: [{ x: 100, y: 18 }, { x: 100, y: 18 }] },
      ],
    }),
    highlight: { found: ['mphf'], compare: ['hash'] },
    explanation: 'The chart is conceptual. Minimal perfect hashing achieves a dense member-key range, but only because construction is offline and the key set is fixed.',
  };
}

function* lookupAndCaveats() {
  yield {
    state: graphState({
      nodes: [
        { id: 'query', label: 'query key', x: 0.8, y: 2.4, note: 'maybe key' },
        { id: 'mphf', label: 'MPHF', x: 2.7, y: 2.4, note: 'returns id' },
        { id: 'slot', label: 'slot', x: 4.6, y: 2.4, note: 'array index' },
        { id: 'verify', label: 'verify', x: 6.5, y: 2.4, note: 'fingerprint' },
        { id: 'answer', label: 'answer', x: 8.4, y: 2.4, note: 'value/miss' },
      ],
      edges: [
        { id: 'e-query-mphf', from: 'query', to: 'mphf' },
        { id: 'e-mphf-slot', from: 'mphf', to: 'slot' },
        { id: 'e-slot-verify', from: 'slot', to: 'verify' },
        { id: 'e-verify-answer', from: 'verify', to: 'answer' },
      ],
    }, { title: 'Absent keys still need verification' }),
    highlight: { active: ['mphf', 'slot', 'verify'], found: ['answer'] },
    explanation: 'A minimal perfect hash is perfect only on the stored key set. If you ask about a non-key, the function may still return an integer in range. Store a fingerprint or original key if misses must be detected.',
    invariant: 'MPHF gives an address; membership semantics require verification unless all queries are guaranteed members.',
  };

  yield {
    state: labelMatrix(
      'Lookup outcomes',
      [
        { id: 'member', label: 'stored key' },
        { id: 'nonmember', label: 'absent key' },
        { id: 'trusted', label: 'trusted query' },
        { id: 'untrusted', label: 'untrusted query' },
      ],
      [
        { id: 'mphf', label: 'MPHF result' },
        { id: 'needed', label: 'needed extra' },
      ],
      [
        ['correct id', 'none or value check'],
        ['some id', 'fingerprint/key'],
        ['correct id', 'dense array ok'],
        ['some id', 'verify before value'],
      ],
    ),
    highlight: { found: ['member:mphf', 'trusted:needed'], compare: ['nonmember:needed', 'untrusted:needed'] },
    explanation: 'This is the most important operational distinction. MPHF is an addressing function, not an approximate membership filter. Use Bloom-style filters or fingerprints when absent keys are common.',
  };

  yield {
    state: labelMatrix(
      'Construction families',
      [
        { id: 'graph', label: 'graph peeling' },
        { id: 'bucket', label: 'bucket search' },
        { id: 'split', label: 'recursive split' },
        { id: 'compress', label: 'compressed aux' },
      ],
      [
        { id: 'idea', label: 'idea' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['acyclic assignment', 'rehash if cycle'],
        ['small buckets', 'seed search'],
        ['split until easy', 'construction work'],
        ['few bits/key', 'lookup decode'],
      ],
    ),
    highlight: { active: ['graph:idea', 'bucket:idea', 'split:idea'], found: ['compress:tradeoff'] },
    explanation: 'Modern MPHFs differ in how they search for collision-free assignments and how they store auxiliary data. The design space balances bits per key, construction time, and lookup throughput.',
  };

  yield {
    state: labelMatrix(
      'When it is a fit',
      [
        { id: 'compiler', label: 'keywords' },
        { id: 'genome', label: 'k-mers' },
        { id: 'staticMap', label: 'static map' },
        { id: 'mutable', label: 'mutable set' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong', 'known set'],
        ['strong', 'huge static keys'],
        ['strong', 'dense values'],
        ['weak', 'rebuild needed'],
      ],
    ),
    highlight: { found: ['compiler:fit', 'genome:fit', 'staticMap:fit'], compare: ['mutable:reason'] },
    explanation: 'MPHFs shine when the set is built once and queried heavily: language keywords, static URL dictionaries, genome k-mers, frozen feature maps, and compact read-only lookup tables.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build perfect ids') yield* buildPerfectIds();
  else if (view === 'lookup and caveats') yield* lookupAndCaveats();
  else throw new InputError('Pick a minimal-perfect-hash view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A minimal perfect hash function, or MPHF, maps a fixed set of n keys to the integers 0 through n-1 with no collisions. Perfect means no two stored keys collide. Minimal means there are no unused member slots in the target range. The result is ideal for static dictionaries: compute id = f(key), then read values[id].',
        'This differs from an ordinary Hash Table. A normal table works for changing sets and handles collisions with probing or chaining. An MPHF is usually built offline for a known set. It spends construction time and auxiliary bits so lookups for member keys become compact dense-array indexing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction algorithms vary. Some use random graphs and peeling. Some split keys into buckets, then search for a seed that makes each bucket collision-free. RecSplit recursively partitions hard buckets until small subproblems can be solved compactly. BBHash focuses on fast scalable construction for massive key sets. PTHash revisits front-coded hashing and compressed auxiliary tables.',
        'The lookup path is short: hash the key through the stored auxiliary data, compute a dense id, and index an array. But the function is defined to be collision-free only for the original set. A non-key can still produce an in-range id, so applications that receive arbitrary queries store fingerprints, original keys, or pair the MPHF with a membership filter.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is expected constant time in practical MPHFs. Space is usually measured in bits per key for the function, plus payload storage and any verification data. Construction can be expensive compared with ordinary hashing because the builder searches for a collision-free representation. That is acceptable when the structure is read many times after being built once.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'CMPH was created as a portable C library for efficient minimal perfect hashing over large key sets. RecSplit showed that practical MPHFs could get close to the information-theoretic lower bound while keeping expected linear construction and constant lookup. BBHash demonstrated fast construction for very large sets. In production, these ideas appear in static dictionaries, compact key-value files, compiler keyword tables, genomic k-mer indexes, and compressed search infrastructure.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The main misconception is that an MPHF proves membership. It does not. It maps stored keys uniquely, but absent keys may map to any slot. If an API receives untrusted or arbitrary keys, verify the slot before returning the value. Another trap is using MPHFs for mutable data. Adding one key can require rebuilding the function, so use Cuckoo Hashing or ordinary hash tables when updates dominate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CMPH library at https://cmph.sourceforge.net/, RecSplit paper at https://arxiv.org/abs/1910.06416, BBHash paper PDF at https://drops.dagstuhl.de/storage/00lipics/lipics-vol075-sea2017/LIPIcs.SEA.2017.25/LIPIcs.SEA.2017.25.pdf, BBHash repository at https://github.com/rizkg/BBHash, Sux minimal perfect hashing implementation at https://github.com/vigna/sux/, and a modern survey at https://arxiv.org/abs/2506.06536. Study Hash Table, Cuckoo Hashing, Bloom Filter, LOUDS Succinct Trie, Elias-Fano Encoding, and Binary Fuse Filter next.',
      ],
    },
  ],
};
