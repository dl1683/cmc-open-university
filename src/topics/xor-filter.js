// Xor filter: a static approximate-membership filter built by peeling a
// 3-uniform hypergraph and assigning fingerprints in reverse order.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'xor-filter',
  title: 'Xor Filter',
  category: 'Data Structures',
  summary: 'A compact static membership filter: three table positions xor to a fingerprint, giving fast no-false-negative queries after construction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['peeling build', 'membership query'], defaultValue: 'peeling build' },
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

function hypergraph(title) {
  return graphState({
    nodes: [
      { id: 'kA', label: 'key A', x: 0.8, y: 1.6, note: 'degree 3' },
      { id: 'kB', label: 'key B', x: 0.8, y: 3.7, note: 'degree 3' },
      { id: 'kC', label: 'key C', x: 0.8, y: 5.8, note: 'degree 3' },
      { id: 's0', label: 'slot 0', x: 3.1, y: 1.0, note: 'fingerprint byte' },
      { id: 's1', label: 'slot 1', x: 3.1, y: 2.2, note: 'fingerprint byte' },
      { id: 's2', label: 'slot 2', x: 3.1, y: 3.4, note: 'fingerprint byte' },
      { id: 's3', label: 'slot 3', x: 3.1, y: 4.6, note: 'fingerprint byte' },
      { id: 's4', label: 'slot 4', x: 3.1, y: 5.8, note: 'fingerprint byte' },
      { id: 'stack', label: 'peel stack', x: 6.4, y: 3.5, note: 'reverse assignment' },
      { id: 'table', label: 'xor table', x: 8.7, y: 3.5, note: 'final filter' },
    ],
    edges: [
      { id: 'e-A-0', from: 'kA', to: 's0', weight: 'h1' },
      { id: 'e-A-2', from: 'kA', to: 's2', weight: 'h2' },
      { id: 'e-A-4', from: 'kA', to: 's4', weight: 'h3' },
      { id: 'e-B-1', from: 'kB', to: 's1', weight: 'h1' },
      { id: 'e-B-2', from: 'kB', to: 's2', weight: 'h2' },
      { id: 'e-B-3', from: 'kB', to: 's3', weight: 'h3' },
      { id: 'e-C-0', from: 'kC', to: 's0', weight: 'h1' },
      { id: 'e-C-3', from: 'kC', to: 's3', weight: 'h2' },
      { id: 'e-C-4', from: 'kC', to: 's4', weight: 'h3' },
      { id: 'e-stack-table', from: 'stack', to: 'table', weight: 'reverse fill' },
    ],
  }, { title });
}

function* peelingBuild() {
  const numKeys = 3;
  const slotsPerKey = 3;
  const totalSlots = 5;
  const filterFamilies = 4;

  yield {
    state: hypergraph('Each key touches three candidate slots'),
    highlight: { active: ['kA', 'e-A-0', 'e-A-2', 'e-A-4'], compare: ['kB', 'kC'] },
    explanation: `An xor filter maps every key to ${slotsPerKey} table positions plus a small fingerprint. Construction views this as a hypergraph: ${numKeys} keys are edges connected to ${slotsPerKey} slot vertices.`,
  };

  yield {
    state: labelMatrix(
      'Peeling degree-one slots',
      [
        { id: 'round1', label: 'round 1' },
        { id: 'round2', label: 'round 2' },
        { id: 'round3', label: 'round 3' },
        { id: 'fail', label: 'cycle case' },
      ],
      [
        { id: 'find', label: 'find' },
        { id: 'push', label: 'push' },
        { id: 'remove', label: 'remove' },
      ],
      [
        ['slot with one remaining key', 'push that key', 'delete its three incidences'],
        ['new degree-one slots appear', 'push next key', 'keep peeling'],
        ['all keys peeled', 'build succeeds', 'assign in reverse'],
        ['no degree-one slot', 'graph core remains', 'retry with new hash seed'],
      ],
    ),
    highlight: { active: ['round1:find', 'round1:push', 'round2:find'], compare: ['fail:find'] },
    explanation: `The build succeeds when the hypergraph of ${numKeys} keys over ${totalSlots} slots can be peeled down to nothing. If a cyclic core remains, the implementation retries with a new hash seed or larger table.`,
    invariant: `Xor filters buy very compact queries by doing a one-time static construction over ${numKeys} keys mapped to ${totalSlots} slots.`,
  };

  yield {
    state: hypergraph('Reverse assignment makes each key equation true'),
    highlight: { active: ['stack', 'table', 'e-stack-table'], found: ['s0', 's2', 's4'] },
    explanation: `After peeling, process ${numKeys} keys in reverse order. For each key, ${slotsPerKey - 1} of its slots are already fixed, so choose the remaining slot value that makes slot[h1] xor slot[h2] xor slot[h3] equal the key fingerprint.`,
  };

  yield {
    state: labelMatrix(
      'Filter family comparison',
      [
        { id: 'bloom', label: 'Bloom filter' },
        { id: 'cuckoo', label: 'cuckoo filter' },
        { id: 'xor', label: 'xor filter' },
        { id: 'fuse', label: 'binary fuse' },
      ],
      [
        { id: 'updates', label: 'updates' },
        { id: 'query', label: 'query' },
        { id: 'space', label: 'space profile' },
      ],
      [
        ['append-friendly', 'k bit probes', 'simple and robust'],
        ['insert/delete possible', 'fingerprint lookup', 'compact but insertion can fail'],
        ['static/rebuild', '3 reads + xor', 'very compact'],
        ['static/rebuild', 'few reads', 'newer, often smaller'],
      ],
    ),
    highlight: { found: ['xor:query', 'xor:space'], compare: ['bloom:updates', 'cuckoo:updates'] },
    explanation: `Across ${filterFamilies} filter families, xor filters are not a drop-in replacement for every Bloom filter. They are best when the set is built once, queried many times, and rebuilt rather than updated incrementally.`,
  };
}

function* membershipQuery() {
  const reads = 3;
  const hashPositions = 3;
  const errorTypes = 4;

  yield {
    state: labelMatrix(
      'Query one key',
      [
        { id: 'hash', label: 'hash positions' },
        { id: 'load', label: 'load bytes' },
        { id: 'xor', label: 'xor bytes' },
        { id: 'compare', label: 'compare' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['h1=0, h2=2, h3=4', 'three deterministic slots'],
        ['table[0], table[2], table[4]', 'small fingerprints'],
        ['v0 xor v2 xor v4', 'reconstruct candidate fingerprint'],
        ['equals f(key)?', 'maybe present or definitely absent'],
      ],
    ),
    highlight: { active: ['load:example', 'xor:example', 'compare:example'], found: ['compare:meaning'] },
    explanation: `A query performs ${reads} table reads and one xor chain across ${hashPositions} hash positions. If the reconstructed fingerprint matches the key fingerprint, answer maybe present; otherwise answer definitely absent.`,
  };

  yield {
    state: hypergraph('Present key reconstructs its fingerprint'),
    highlight: { active: ['kA', 's0', 's2', 's4', 'e-A-0', 'e-A-2', 'e-A-4'], found: ['table'] },
    explanation: `For a stored key, construction guaranteed the xor equation across all ${hashPositions} positions. That is why xor filters have no false negatives for the immutable set used to build the table.`,
  };

  yield {
    state: labelMatrix(
      'Error semantics',
      [
        { id: 'present', label: 'stored key' },
        { id: 'absentmiss', label: 'absent, no match' },
        { id: 'absentfp', label: 'absent, fingerprint match' },
        { id: 'mutate', label: 'new key after build' },
      ],
      [
        { id: 'answer', label: 'answer' },
        { id: 'correctness', label: 'correctness' },
      ],
      [
        ['maybe present', 'true positive'],
        ['definitely absent', 'true negative'],
        ['maybe present', 'false positive'],
        ['not represented', 'rebuild needed'],
      ],
    ),
    highlight: { active: ['present:correctness', 'absentfp:correctness'], compare: ['mutate:correctness'] },
    explanation: `The guarantee matches Bloom Filter semantics across ${errorTypes} error categories: false positives are possible; false negatives for the built set are not. Updates change the set, so the filter must be rebuilt or replaced.`,
  };

  yield {
    state: labelMatrix(
      'Production placement',
      [
        { id: 'sstable', label: 'SSTable/block' },
        { id: 'object', label: 'object manifest' },
        { id: 'cdn', label: 'CDN cache' },
        { id: 'stream', label: 'streaming set' },
      ],
      [
        { id: 'fit', label: 'fit?' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['excellent', 'immutable after flush'],
        ['excellent', 'built per snapshot'],
        ['good', 'rebuild on publish'],
        ['poor', 'continuous updates'],
      ],
    ),
    highlight: { found: ['sstable:fit', 'object:fit'], compare: ['stream:fit'] },
    explanation: `Xor filters are a natural companion to immutable storage files and manifests, needing only ${reads} reads per query. They are a weaker fit for constantly changing membership sets.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'peeling build') yield* peelingBuild();
  else if (view === 'membership query') yield* membershipQuery();
  else throw new InputError('Pick an xor filter view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the build view as a small graph problem. Each key is an edge that touches three table slots, while active marks the key or slot being processed. Found marks a slot whose stored byte has already been fixed.',
        {type: 'callout', text: 'An xor filter moves work from query time into construction: solve the equations once, then answer with three reads.'},
        'The lookup view shows the contract after construction. A query hashes the key to three slots, XORs the three stored values, and compares the result with a short fingerprint, which is a compact hash value used only for checking.',
        'Watch the build reverse direction after peeling. Peeling removes keys that have a slot no other remaining key needs; reverse assignment fills that slot so the key equation becomes true without changing equations already made true.',
        {type: 'image', src: './assets/gifs/xor-filter.gif', alt: 'Animated walkthrough of the xor filter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An xor filter is a fixed-set gate that returns definitely absent or maybe present. That distinction matters when the real check means a disk seek, a network request, or a decompression step.',
        'The set must be fixed, also called static, before the filter is built. Static means the keys are known up front and do not need individual insertions later.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Bloom_filter_speed.svg',
          alt: 'Bloom filter diagram showing a fast membership gate before slower lookup',
          caption: 'A Bloom filter is the baseline approximate-membership gate; xor filters keep the same maybe-or-definitely-not contract for sealed sets. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Bloom_filter_speed.svg.',
        },
        'A Bloom filter already gives this gate, but it keeps enough slack to support future insertions. An xor filter spends more work during construction so the finished filter can answer with three reads and one fingerprint comparison.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a hash set if exact answers are required. It stores every key or a full hash of every key, so a query can confirm presence without false positives.',
        'That becomes expensive when the filter is only a gate in front of slower storage. Storing 16 bytes per key for 100 million keys costs about 1.6 GB before allocator and table overhead.',
        'The usual smaller approach is a Bloom filter. It sets several bits for each key and answers absent when any checked bit is zero, but it accepts false positives when all checked bits happen to be one.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the Bloom filter pays for mutability after mutability is no longer needed. Once an SSTable, manifest, or package index is sealed, no future key will be inserted into that exact filter.',
        'At a 1% false-positive rate, a Bloom filter needs about 9.6 bits per key. The information limit for any approximate filter at 1% is log2(100), about 6.64 bits per key, so the Bloom layout spends about 45% extra space for its simple bit-array behavior.',
        'That extra space changes system behavior. Saving 2 bits per key over 1 billion keys saves about 250 MB of memory, which can keep more filters resident and avoid more disk reads.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to turn membership into equations over XOR. XOR is the bit operation where equal bits cancel to 0 and different bits produce 1, so if two table values are known, the third can be chosen to make a target result.',
        'For each real key, the filter enforces this equation: table[h0(key)] XOR table[h1(key)] XOR table[h2(key)] equals fingerprint(key). The query repeats the same three reads; if the equation holds, the answer is maybe present, and if it fails, the key is definitely absent.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg',
          alt: 'Directed graph with nodes connected by arrows',
          caption: 'The construction is a graph problem: peel edges away until no unresolved core remains, then assign values in reverse. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.',
        },
        'Construction is the hard part because all equations share table slots. The filter builds a graph, peels keys whose equations have one private slot, then solves those equations backward.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with n keys and allocate a table with a little more than n slots, commonly about 1.23n. Hash each key to three slot indexes and compute its fingerprint, often 8 bits for about a 1 in 256 random match rate.',
        'Build an incidence count for every slot, meaning the number of remaining keys that mention that slot. When a slot has count 1, the only key touching it can be peeled, pushed onto a stack, and removed from the counts of its other two slots.',
        'After all keys peel, process the stack in reverse. For each key, choose the one slot that was private at peel time and set it to fingerprint XOR the other two current table values.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every assigned key keeps its XOR equation true. During reverse processing, the key has one slot reserved by the peel order, while the other two slots already have values.',
        'Setting the reserved slot to fingerprint XOR valueA XOR valueB forces the whole three-slot XOR to equal the fingerprint. This cannot break earlier keys because their equations were satisfied using slots that are no longer being chosen as this key\'s reserved slot.',
        'Inductively, each reversed stack step adds one more true equation and preserves all previous true equations. Therefore every original key returns maybe present, so the filter has no false negatives for the set used to build it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup is constant time because it always does three hashes, three table reads, two XOR operations, and one comparison. Doubling the number of stored keys does not increase the number of reads per query; it only makes the table larger.',
        'Space is roughly 1.23 times n times f bits, where n is the number of keys and f is the fingerprint width. With 1,000,000 keys and 8-bit fingerprints, the table is about 1,230,000 bytes, or 9.84 bits per key.',
        'Build time is expected linear because each key is inserted into counts, peeled once, and assigned once. The risk is retry cost: if the graph has a cyclic core with no degree-one slot, the builder must choose a new seed and rebuild.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LSM-tree databases use per-file filters to avoid reading sorted-string tables that cannot contain a requested key. An xor filter fits because an SSTable is immutable after flush or compaction.',
        'CDN and object-store manifests also fit the pattern. A snapshot can publish a compact filter over object names so a server can reject absent objects before parsing a larger index.',
        'Package registries and content-addressed stores can use the same gate over package names or hashes. The filter does not replace the authoritative index; it reduces how often that index is consulted.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'An xor filter fails as an update structure. Adding one key changes the shared equation system, so the practical update operation is rebuild the whole filter.',
        'It also fails when construction latency must be perfectly bounded. Most builds succeed with ordinary slack, but a bad seed can leave a cyclic core and force another pass over the keys.',
        'It is not an authentication mechanism. A maybe-present result only means a short fingerprint matched, so access control, revocation, and integrity checks still need an authoritative lookup.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use three keys A, B, and C with 4-bit fingerprints. Let fingerprint(A)=6, fingerprint(B)=9, and fingerprint(C)=12, where the table initially has slots 0 through 4.',
        'Suppose A touches slots 0, 1, 2; B touches 2, 3, 4; and C touches 1, 3, 4. Slot 0 has degree 1, so peel A; after removing A, slot 2 has degree 1, so peel B; after removing B, C peels.',
        'Assign backward. Set C using slot 1 with table[3]=0 and table[4]=0, so table[1]=12; set B using slot 2 with table[3]=0 and table[4]=0, so table[2]=9; set A using slot 0 with table[1]=12 and table[2]=9, so table[0]=6 XOR 12 XOR 9 = 3.',
        'Query A reads slots 0, 1, 2 and computes 3 XOR 12 XOR 9 = 6, which matches fingerprint(A). An absent key that hashes to 0, 3, 4 with fingerprint 3 also matches by chance, because 3 XOR 0 XOR 0 = 3; that is the false-positive behavior.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Graf and Lemire, Xor Filters: Faster and Smaller Than Bloom and Cuckoo Filters, Journal of Experimental Algorithmics 25, 2020, https://arxiv.org/abs/1912.08258. For the graph side of construction, study hypergraph peeling and random graph cores.',
        'Study Bloom filters first for the definitely-absent versus maybe-present contract. Study cuckoo filters next for fingerprint-based approximate membership with updates, then binary fuse filters and ribbon filters for tighter static filters.',
        'For systems context, connect this topic to LSM trees, SSTables, package indexes, and CDN manifests. The common design rule is simple: when the set is sealed and negative lookups dominate, move cost from query time into build time.',
      ],
    },
  ],
};
