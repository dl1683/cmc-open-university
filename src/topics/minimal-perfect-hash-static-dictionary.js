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
  const keys = ['cat', 'dog', 'eel', 'fox'];
  const keyCount = keys.length; // 4
  const slotRange = `0..${keyCount - 1}`; // '0..3'
  const nodeCount = 5; // keys, builder, mphf, ids, values
  const edgeCount = 4;

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
    explanation: `Given a fixed set of ${keyCount} keys, a minimal perfect hash function maps every stored key to a unique integer from 0 to ${keyCount - 1}. No collisions, no empty slots for member keys.`,
    invariant: `Perfect means no collisions for the known set; minimal means the range has exactly ${keyCount} slots (${slotRange}).`,
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
    explanation: `An ordinary hash can collide and needs probing or chaining. A perfect-hash builder searches for auxiliary data so these ${keyCount} keys (${keys.join(', ')}) land in unique slots.`,
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
    explanation: `Once ${keyCount} keys have dense ids in range ${slotRange}, payload storage becomes a plain ${keyCount}-entry array. That is the attraction: compact metadata plus direct indexing for a read-only dictionary.`,
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
    explanation: `The chart compares 2 strategies. Minimal perfect hashing achieves a dense member-key range (${slotRange} for ${keyCount} keys), but only because construction is offline and the key set is fixed.`,
  };
}

function* lookupAndCaveats() {
  const lookupSteps = 5; // query -> mphf -> slot -> verify -> answer
  const lookupEdges = 4;
  const constructionFamilies = 4;
  const fitScenarios = 4;
  const outcomeRows = 4;

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
    explanation: `A minimal perfect hash is perfect only on the stored key set. The lookup pipeline has ${lookupSteps} stages (query, MPHF, slot, verify, answer). If you ask about a non-key, the function may still return an integer in range. Store a fingerprint or original key if misses must be detected.`,
    invariant: `MPHF gives an address across ${lookupEdges} transitions; membership semantics require verification unless all queries are guaranteed members.`,
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
    explanation: `This is the most important operational distinction across ${outcomeRows} scenarios. MPHF is an addressing function, not an approximate membership filter. Use Bloom-style filters or fingerprints when absent keys are common.`,
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
    explanation: `Modern MPHFs span ${constructionFamilies} major construction families (graph peeling, bucket search, recursive split, compressed aux). The design space balances bits per key, construction time, and lookup throughput.`,
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
    explanation: `Across ${fitScenarios} fit scenarios, MPHFs shine when the set is built once and queried heavily: language keywords, static URL dictionaries, genome k-mers, and frozen feature maps. Mutable sets remain a weak fit because any insertion requires a rebuild.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/minimal-perfect-hash-static-dictionary.gif', alt: 'Animated walkthrough of the minimal perfect hash static dictionary visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some dictionaries are frozen before they ship: compiler keywords, generated protocol names, static URL tables, genomic k-mer sets, feature vocabularies, and lookup tables inside data files. They need exact lookup, but they do not need runtime insertion.',
        'Minimal perfect hashing exists for that case. If the keys are known in advance, the builder can search for a function that maps every stored key to a dense unique id, so payloads live in a compact array.',
        {type: 'callout', text: 'A minimal perfect hash moves collision work to build time so member lookup becomes dense-array addressing.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The normal answer is an ordinary hash table. It handles changing sets and resolves collisions with chaining or probing. That flexibility is valuable when keys arrive over time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg', alt: 'Hash table with chaining showing keys mapped to buckets', caption: 'A normal hash table keeps collision machinery because arbitrary future keys may share a bucket. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_5_0_1_1_1_1_1_LL.svg.'},
        'For a fixed set, the ordinary table keeps paying for flexibility it does not use. It needs spare capacity, collision handling, and sometimes pointers or control metadata. A dense array would be smaller, but only if each key could be assigned a unique array index.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is collisions. A normal hash can map two stored keys to the same bucket, so the table needs a collision policy and extra room. If the target range is exactly 0..n-1, even one collision means another stored key has no slot.',
        'Minimal perfect hashing solves that wall offline. It spends build time and auxiliary bits to make collisions disappear for the one set that matters.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Perfect means no two stored keys collide. Minimal means the range has exactly n slots for n stored keys. Together they turn dictionary lookup for member keys into direct indexing: id = f(key), then values[id].',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Hash_table_3_1_1_0_1_0_0_SP.svg/500px-Hash_table_3_1_1_0_1_0_0_SP.svg.png', alt: 'Hash table with keys distributed into bucket slots', caption: 'Minimal perfect hashing aims for dense unique slots for the frozen key set, with no spare collision room. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_3_1_1_0_1_0_0_SP.svg.'},
        'The function is not magic for every possible key. It is constructed to be collision-free on the known set. An absent key may still produce an in-range id, so membership semantics require verification unless all queries are known members.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the build-perfect-ids view, watch the cost move to build time. The builder tries auxiliary seeds, graph structure, or bucket partitions until every known key receives a distinct id in the dense range 0 through n-1.",
        "In the lookup-and-caveats view, distinguish addressing from membership. For a stored key, the id points directly into the payload array. For an arbitrary nonmember, the function can still return an in-range id, so the caller needs verification unless all queries are known members.",
        "The useful mental model is a compiled dictionary. The runtime path is tiny because the set was frozen and the hard collision work happened earlier.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A compiler has 64 reserved words. A normal hash table can recognize them, but it still carries collision handling and spare capacity. A minimal perfect hash builder can assign each keyword a unique id from 0 to 63. The compiler then stores token metadata in a 64-entry array and looks up candidate identifiers through the generated function.',
        'If the lexer only calls the function after confirming the input is one of those 64 words, direct indexing is enough. If arbitrary identifiers go through the MPHF, the lexer must verify the key or fingerprint before returning a keyword token. Otherwise a non-keyword identifier could map to the id for `while` or `return`.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction algorithms differ. Some use random graphs and peeling. Some split keys into buckets and search for seeds. RecSplit recursively partitions hard buckets until compact subproblems can be solved. BBHash focuses on fast scalable construction for massive key sets. PTHash explores compressed auxiliary data and fast lookup.',
        'The finished structure stores the auxiliary data needed by the hash function, a dense payload array, and sometimes verification data. Lookup hashes the key through the auxiliary data, computes an id, and indexes the payload array.',
        'If the API can receive nonmembers, the lookup must verify. It can store original keys, short fingerprints, or pair the MPHF with an approximate-membership filter.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For stored keys, correctness comes from the construction certificate: the chosen auxiliary data maps each key in the fixed set to a distinct id. The dense array can then put each payload at the id assigned to its key.',
        'For absent keys, the guarantee does not apply. The function still returns some number in the range. That is why an MPHF is an addressing function, not a membership proof.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Lookup is expected constant time in practical MPHFs. Space is measured in bits per key for the function, plus payload storage and any verification data. The payload array is dense because the ids cover 0..n-1.',
        'Construction is the expensive part. The builder searches for a collision-free representation, may retry seeds, and may partition difficult buckets. That cost is acceptable when the dictionary is built once and queried many times.',
        'Build failures are normal engineering events, not theory failures. Builders may retry seeds, adjust bucket sizes, or choose a different construction when the current random choices create a hard subproblem. The shipped artifact should include enough metadata to reproduce the function for the exact key set.',
      ],
    },
    {
      heading: 'Design choices',
      paragraphs: [
        'Choose verification based on the API. If every query is guaranteed to be a member, the MPHF can return an id directly. If queries are arbitrary, store full keys, compact fingerprints, or pair the MPHF with a filter. The smaller the verification data, the more carefully collision probability and error behavior must be documented.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Bloom_filter.svg', alt: 'Bloom filter diagram showing several hash functions setting positions in a bit array', caption: 'A filter can guard arbitrary queries before the MPHF id is treated as a real member slot. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Bloom_filter.svg.'},
        'Choose construction based on scale. A tiny keyword table values simplicity. A billion-key genomic index values bits per key and build throughput. A latency-sensitive embedded dictionary values predictable lookup and compact memory layout. Minimal perfect hashing is a family of tradeoffs, not one algorithm.',
      ],
    },
    {
      heading: 'Generated artifact governance',
      paragraphs: [
        'Treat the generated hash function like compiled data. Store the source key set, builder version, random seed or construction metadata, payload ordering, and verification format together. A future build should be able to reproduce the ids or deliberately record why ids changed.',
        'This matters because downstream arrays often assume stable ids. If a generated dictionary is rebuilt and ids move, payload files, serialized indexes, or model feature maps can silently point at the wrong entries. The MPHF may still be perfect while the product is wrong.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'MPHFs are strong for static dictionaries, compiler keyword tables, generated API names, compact key-value files, genomic k-mer indexes, frozen feature maps, URL dictionaries, and compressed search infrastructure.',
        'CMPH, RecSplit, BBHash, Sux, and related systems show the range of engineering choices: construction throughput, bits per key, lookup speed, and implementation complexity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MPHFs are poor for mutable sets. Adding one key can require rebuilding the function, so ordinary hash tables or cuckoo hashing are better when updates dominate.',
        'They also fail when callers treat an id as proof. If queries are untrusted or arbitrary, verify the slot before returning a value. Otherwise a nonmember can read the payload of some real member.',
        'They are also a poor fit when the build pipeline cannot be trusted or reproduced. A generated function is part of the data artifact. If the key list, hash seeds, build version, and payload ordering drift apart, the dictionary can return fast wrong answers.',
        'A safe release process treats id changes as schema changes. Either preserve ids across builds or version every dependent artifact that stores those ids.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CMPH library at https://cmph.sourceforge.net/, RecSplit paper at https://arxiv.org/abs/1910.06416, BBHash paper PDF at https://drops.dagstuhl.de/storage/00lipics/lipics-vol075-sea2017/LIPIcs.SEA.2017.25/LIPIcs.SEA.2017.25.pdf, BBHash repository at https://github.com/rizkg/BBHash, Sux minimal perfect hashing implementation at https://github.com/vigna/sux/, and a modern survey at https://arxiv.org/abs/2506.06536. Study Hash Table, Cuckoo Hashing, Bloom Filter, Binary Fuse Filter, Ribbon Filter, LOUDS Succinct Trie, and Elias-Fano Encoding next.',
      ],
    },
  ],
};
