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
        'The build view starts with a fixed key set. Fixed means all keys are known before the structure is built, so runtime insertion is not part of the contract. The builder searches for auxiliary data that maps each stored key to a different integer from 0 to n - 1.',
        'A minimal perfect hash function, or MPHF, is perfect because stored keys do not collide and minimal because the range has exactly n slots for n keys. The safe inference rule is narrow: for stored keys, the returned id is a direct address; for arbitrary nonkeys, the id is not proof of membership. The lookup view shows why verification may still be needed.',
        {type: 'image', src: './assets/gifs/minimal-perfect-hash-static-dictionary.gif', alt: 'Animated walkthrough of the minimal perfect hash static dictionary visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        {type: 'callout', text: 'A minimal perfect hash moves collision work to build time so member lookup becomes dense-array addressing.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some dictionaries are built once and queried many times. Compiler keywords, protocol field names, static URL dictionaries, genomic k-mers, frozen feature vocabularies, and compressed search indexes often have this shape. Runtime insertion is irrelevant, but memory and lookup speed matter.',
        'A minimal perfect hash exists to remove unused flexibility. Instead of keeping spare buckets and collision chains, it compiles the known key set into a function that gives each key a dense id. Payloads can then live in a compact array indexed by that id.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is an ordinary hash table. It hashes a key to a bucket and resolves collisions by chaining, probing, or another collision policy. This is the right tool when keys arrive over time or deletion is common.',
        'For a frozen set, that generality becomes overhead. A table may keep empty space to preserve load factor, store control bytes, and chase pointers or probe sequences. If the set never changes, the collision problem can be solved before shipping the dictionary.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg', alt: 'Hash table with chaining showing keys mapped to buckets', caption: 'A normal hash table keeps collision machinery because arbitrary future keys may share a bucket. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_5_0_1_1_1_1_1_LL.svg.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a dense range leaves no spare slot for a collision. If two stored keys both map to id 17, one payload has no unique address. Ordinary hashing expects collisions and designs around them; minimal perfect hashing tries to make them impossible for the stored set.',
        'There is a second wall for arbitrary queries. A function from strings to 0..n - 1 can return an id for any string, including strings not in the dictionary. Without verification, a nonmember can accidentally read the payload of a real key.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move collision work from lookup time to build time. The builder can try seeds, graph assignments, bucket splits, or recursive partitions until the fixed keys receive unique ids. The shipped function stores only the auxiliary data needed to reproduce that assignment.',
        'The result separates addressing from membership. For known members, f(key) gives a dense array slot. For untrusted queries, f(key) is only a candidate slot, so the system must check a stored key, fingerprint, or separate membership filter.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Hash_table_3_1_1_0_1_0_0_SP.svg/500px-Hash_table_3_1_1_0_1_0_0_SP.svg.png', alt: 'Hash table with keys distributed into bucket slots', caption: 'Minimal perfect hashing aims for dense unique slots for the frozen key set, with no spare collision room. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_3_1_1_0_1_0_0_SP.svg.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction algorithms vary, but the shape is shared. Partition the keys into easier subproblems, search for local seeds or graph assignments, and record enough auxiliary bits to compute each final id. If a random choice creates a cycle or collision, retry or split further.',
        'Lookup is short. Hash the query through the generated function, compute an id in 0..n - 1, and index the payload array. If queries can be nonmembers, compare a stored fingerprint or original key before returning the payload.',
        'Some designs use graph peeling, where keys become edges in a random graph and an acyclic graph gives an assignment order. Others use bucket search or recursive splitting to solve small groups compactly. The design tradeoff is build time, bits per key, and lookup speed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness for members comes from the construction certificate. The builder has found auxiliary data such that every key in the fixed set maps to a unique id. Storing each payload at its assigned id makes lookup correct for those keys.',
        'Minimality follows from the range size. There are n stored keys and exactly n ids, so a collision-free assignment uses every id once. That dense assignment is why the payload storage can be a plain n-entry array.',
        'The guarantee does not extend to absent keys. A nonmember can still produce an id because the function is total over possible inputs. Verification is therefore part of dictionary correctness when callers are not already trusted to query only members.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is O(1) in practical implementations because it performs a fixed number of hash and table operations. Payload storage is dense O(n), and the function overhead is measured in bits per key. The whole point is to replace sparse buckets and collision metadata with compact auxiliary data.',
        'Construction is the expensive phase. Builders may scan all keys, retry random seeds, split hard buckets, or rebuild a failed component. That cost is acceptable when the dictionary is built once and served many times.',
        'When n doubles, payload storage doubles and auxiliary metadata usually doubles by bits-per-key rate. Lookup does not become a tree walk or a probe sequence merely because the set is larger. Build time and memory during construction are the parts that can become painful at billion-key scale.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Bloom_filter.svg', alt: 'Bloom filter diagram showing several hash functions setting positions in a bit array', caption: 'A filter can guard arbitrary queries before the MPHF id is treated as a real member slot. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Bloom_filter.svg.'},
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MPHFs fit compiler keyword tables, generated parsers, static protocol dictionaries, read-only key-value files, genomic k-mer indexes, URL blocklists, frozen ML feature maps, and compressed search structures. The access pattern is many lookups against a set that changes only through rebuilds.',
        'They are strongest when payload ids matter. A dense id can address an array of token metadata, offsets, counts, feature weights, or compressed records. This avoids storing the key with every payload when membership is known through another layer.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Mutable sets are a bad fit. Inserting one new key can break the collision-free assignment, so the function may need a rebuild. If updates dominate, ordinary hash tables, cuckoo hashing, or log-structured indexes are usually better.',
        'Untrusted queries are dangerous without verification. An MPHF can map "whlie" to some valid keyword id even though "whlie" is not a keyword. The API must store fingerprints, original keys, or guard queries with a filter when misses are possible.',
        'Generated-artifact drift is another failure mode. If the key list, builder version, random seed, payload order, and verification format are not versioned together, the function can be perfect while the payload array is wrong. Treat the generated hash as compiled data with a reproducible build record.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a tiny language has four reserved words: if, else, for, and return. A builder finds an MPHF with ids if -> 2, else -> 0, for -> 3, and return -> 1. The compiler stores token payloads in values[0..3] in that id order.',
        'When the lexer sees "return", f("return") returns 1 and values[1] gives the RETURN token. If the lexer sends only candidates already matched by the keyword scanner, no extra check is needed. If it sends arbitrary identifiers, f("retun") may still return an id, so the lexer must compare a stored fingerprint or string before claiming a keyword.',
        'For n = 1,000,000 frozen keys, a dense payload array has exactly 1,000,000 payload slots. An ordinary table at 70 percent load needs about 1,428,572 buckets before payloads and collision metadata. The MPHF spends build time to recover that space and keep lookup direct.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study CMPH, BBHash, RecSplit, PTHash, and Sux for concrete construction families and bits-per-key tradeoffs. The stable idea is not one construction but the contract: a fixed key set receives a collision-free dense id function built offline.',
        'Study Hash Table for collision handling, Cuckoo Hashing for another relocation-based design, Bloom Filter and Binary Fuse Filter for membership guards, and succinct tries for ordered static dictionaries. Then compare whether your workload needs exact dense ids, membership answers, or prefix/range queries before choosing a structure.',
      ],
    },
  ],
};
