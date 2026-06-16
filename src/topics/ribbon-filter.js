// Ribbon filter: a static approximate-membership filter built by solving a
// narrow banded linear system, then querying with local word-parallel reads.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ribbon-filter',
  title: 'Ribbon Filter',
  category: 'Data Structures',
  summary: 'A very compact static membership filter: each key writes a narrow band equation, construction solves the system, and queries test a local fingerprint.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['banded system', 'filter tradeoffs'], defaultValue: 'banded system' },
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

function ribbonGraph(title) {
  return graphState({
    nodes: [
      { id: 'keys', label: 'static key set', x: 0.7, y: 3.6, note: 'build once' },
      { id: 'band', label: 'ribbon band', x: 2.7, y: 3.6, note: 'narrow window' },
      { id: 'system', label: 'linear system', x: 4.7, y: 3.6, note: 'xor equations' },
      { id: 'solver', label: 'band solver', x: 6.6, y: 3.6, note: 'incremental elimination' },
      { id: 'table', label: 'stored bits', x: 8.5, y: 2.3, note: 'near lower bound' },
      { id: 'query', label: 'query window', x: 8.5, y: 5.0, note: 'local dot product' },
    ],
    edges: [
      { id: 'e-keys-band', from: 'keys', to: 'band', weight: 'hash start' },
      { id: 'e-band-system', from: 'band', to: 'system', weight: 'row' },
      { id: 'e-system-solver', from: 'system', to: 'solver', weight: 'solve' },
      { id: 'e-solver-table', from: 'solver', to: 'table', weight: 'assign bits' },
      { id: 'e-table-query', from: 'table', to: 'query', weight: 'read band' },
      { id: 'e-band-query', from: 'band', to: 'query', weight: 'same hash' },
    ],
  }, { title });
}

function* bandedSystem() {
  yield {
    state: ribbonGraph('Each key becomes one narrow band equation'),
    highlight: { active: ['keys', 'band', 'system', 'e-keys-band', 'e-band-system'], compare: ['solver'] },
    explanation: 'A Ribbon filter is static. During construction, each key maps to a short contiguous band of table positions and contributes one xor-style equation over those positions.',
  };

  yield {
    state: labelMatrix(
      'Toy band matrix',
      [
        { id: 'k0', label: 'key A' },
        { id: 'k1', label: 'key B' },
        { id: 'k2', label: 'key C' },
        { id: 'k3', label: 'key D' },
      ],
      [
        { id: 'c0', label: '0' },
        { id: 'c1', label: '1' },
        { id: 'c2', label: '2' },
        { id: 'c3', label: '3' },
        { id: 'c4', label: '4' },
        { id: 'c5', label: '5' },
      ],
      [
        ['1', '1', '1', '.', '.', '.'],
        ['.', '1', '1', '1', '.', '.'],
        ['.', '.', '1', '1', '1', '.'],
        ['.', '.', '.', '1', '1', '1'],
      ],
    ),
    highlight: { active: ['k1:c1', 'k1:c2', 'k1:c3'], found: ['k2:c2', 'k2:c3', 'k2:c4'] },
    explanation: 'The matrix is banded because each row touches nearby columns. That locality is why practical Ribbon construction and queries can be cache-friendly.',
    invariant: 'Every stored key gets an equation whose answer matches its target fingerprint.',
  };

  yield {
    state: ribbonGraph('The solver fills a compact table of bits'),
    highlight: { active: ['system', 'solver', 'table', 'e-system-solver', 'e-solver-table'], found: ['band'] },
    explanation: 'Construction solves the banded Boolean system. Once solved, the filter keeps only the assigned bit table; it does not need the original keys or the full matrix.',
  };

  yield {
    state: ribbonGraph('A query replays the same band and tests the fingerprint'),
    highlight: { active: ['band', 'table', 'query', 'e-table-query', 'e-band-query'], compare: ['keys'] },
    explanation: 'Lookup hashes the candidate key to the same kind of band, reads the local table positions, combines them, and compares the result to the candidate fingerprint.',
  };
}

function* filterTradeoffs() {
  yield {
    state: labelMatrix(
      'Static filter comparison',
      [
        { id: 'bloom', label: 'Bloom' },
        { id: 'xor', label: 'Xor' },
        { id: 'fuse', label: 'Binary Fuse' },
        { id: 'ribbon', label: 'Ribbon' },
      ],
      [
        { id: 'construction', label: 'construction' },
        { id: 'space', label: 'space goal' },
        { id: 'updates', label: 'updates' },
      ],
      [
        ['set bits', 'simple but overhead', 'incremental add only'],
        ['peel graph', 'compact', 'rebuild'],
        ['segmented peel', 'very compact', 'rebuild'],
        ['solve band system', 'extremely compact', 'rebuild'],
      ],
    ),
    highlight: { active: ['ribbon:construction', 'ribbon:space'], compare: ['bloom:updates', 'fuse:space'] },
    explanation: 'Ribbon filters push hard on space efficiency. The cost is that build logic is more complex and the set is static.',
  };

  yield {
    state: labelMatrix(
      'Where Ribbon fits',
      [
        { id: 'sst', label: 'immutable SSTable' },
        { id: 'manifest', label: 'object manifest' },
        { id: 'artifact', label: 'build artifact set' },
        { id: 'session', label: 'live session set' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['excellent', 'rebuilt with file'],
        ['excellent', 'published snapshot'],
        ['good', 'versioned deploy'],
        ['poor', 'frequent insert/delete'],
      ],
    ),
    highlight: { found: ['sst:fit', 'manifest:why', 'artifact:why'], compare: ['session:fit'] },
    explanation: 'Ribbon is a snapshot structure. If the membership set changes per request, use Bloom, counting Bloom, or Cuckoo filters instead.',
  };

  yield {
    state: ribbonGraph('Lower false-positive targets need more fingerprint bits'),
    highlight: { active: ['keys', 'system', 'table'], found: ['query'] },
    explanation: 'Like other filters, Ribbon trades memory for false-positive probability. More target fingerprint bits reduce false positives but increase bits per key.',
  };

  yield {
    state: labelMatrix(
      'Engineering checklist',
      [
        { id: 'seed', label: 'seed retry' },
        { id: 'load', label: 'load factor' },
        { id: 'cache', label: 'cache locality' },
        { id: 'truth', label: 'truth source' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'risk', label: 'risk if ignored' },
      ],
      [
        ['what if solve fails?', 'fragile build pipeline'],
        ['how full is table?', 'slow or failed construction'],
        ['are bands local?', 'query loses advantage'],
        ['who verifies maybe?', 'false positive becomes bug'],
      ],
    ),
    highlight: { active: ['seed:question', 'truth:risk'], found: ['cache:question'] },
    explanation: 'A production filter is more than its lookup formula. Build retries, table sizing, locality, and source-of-truth verification decide whether the structure is safe.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'banded system') yield* bandedSystem();
  else if (view === 'filter tradeoffs') yield* filterTradeoffs();
  else throw new InputError('Pick a Ribbon filter view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A Ribbon filter is a static approximate-membership filter. It represents a fixed set of keys and answers whether a query key is definitely absent or maybe present. Like Bloom Filter, Xor Filter, and Binary Fuse Filter, it allows false positives but should not allow false negatives for the set used to build it. The distinctive idea is construction: keys define narrow bands in a Boolean linear system, and the builder solves that system to produce a compact table.',
        'The paper Ribbon filter: practically smaller than Bloom and Xor introduces the design for static sets and emphasizes configurable space overhead and false-positive rates: https://arxiv.org/abs/2103.02515. A later paper, Fast Succinct Retrieval and Approximate Membership using Ribbon, expands the retrieval view and reports very small overheads in practical settings: https://arxiv.org/abs/2109.01892.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'During construction, each key hashes to a starting position and a short band of table positions. That band becomes one equation. The target is a fingerprint for the key. The builder solves the resulting banded system over Boolean variables, producing a table that satisfies every stored key. A query hashes the candidate key, reads its local band from the table, combines the bits, and checks whether the result equals the candidate fingerprint.',
        'The word ribbon is a good mental model: each key touches a narrow strip of the table instead of arbitrary scattered positions. That locality is valuable because memory systems punish random access. It also makes the structure different from a plain Bloom filter, which sets multiple bits directly, and from an Xor filter, which relies on peeling a sparse hypergraph.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is O(1) with a small local memory footprint. Construction is expected linear for practical designs, but it is more sophisticated than setting Bloom bits or peeling an Xor filter. The set is static: after the system is solved, arbitrary insertions and deletions invalidate the equations. Updates normally mean building a new filter for a new snapshot.',
        'The payoff is space. Ribbon-family papers focus on getting close to the information-theoretic lower bound of about log2(1/f) bits per key for false-positive rate f. That matters when a storage engine, object index, or distributed cache carries billions of keys and every extra bit per key becomes real money.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine an object storage gateway with immutable shard manifests. Each shard has millions of object keys. Before checking a shard manifest or remote metadata service, the gateway asks a filter whether the key can be in that shard. A definite negative skips the shard. A maybe-present answer does the authoritative lookup. Because manifests are versioned and published as snapshots, a Ribbon filter can be built once per manifest version and served cheaply many times.',
        'The same pattern appears in LSM-tree files, package indexes, static denylist snapshots, and compiled asset manifests. The build path can afford more CPU because publication is offline or batched. The query path gets the benefit: small memory, local reads, and fast rejection of misses.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Ribbon filters are not mutable sets. They are also not proof of membership; maybe-present still needs a source of truth when correctness matters. Another trap is comparing only lookup speed. If the build system is latency-sensitive or the set changes continuously, a simpler mutable structure can be the better engineering choice even with more space overhead. Finally, construction needs ordinary failure handling: bad seeds, sizing choices, or load assumptions should lead to rebuilds, not production surprises.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Ribbon filter: practically smaller than Bloom and Xor at https://arxiv.org/abs/2103.02515, Fast Succinct Retrieval and Approximate Membership using Ribbon at https://arxiv.org/abs/2109.01892, SEA/LIPIcs metadata at https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.SEA.2022.4, and Meta Engineering background at https://engineering.fb.com/2021/07/09/core-infra/ribbon-filter/. Study Bloom Filter, Cuckoo Filter, Xor Filter, Binary Fuse Filter, and Quotient Filter next.',
      ],
    },
  ],
};
