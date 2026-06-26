// Sparse Merkle trees: authenticate a huge key space by giving every possible
// key a deterministic leaf slot, then using default empty hashes for everything
// that has not been inserted.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sparse-merkle-tree-non-membership',
  title: 'Sparse Merkle Tree Non-Membership',
  category: 'Systems',
  summary: 'An authenticated map over a huge key space: hash keys to leaf paths, store default empty subtrees, and prove absence with the same Merkle logic as presence.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['empty leaf proofs', 'compressed sparse paths'], defaultValue: 'empty leaf proofs' },
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

function sparseFlow(title) {
  return graphState({
    nodes: [
      { id: 'key', label: 'key', x: 0.8, y: 3.2, note: 'account' },
      { id: 'hash', label: 'hash', x: 2.7, y: 3.2, note: 'bits' },
      { id: 'path', label: 'path', x: 4.6, y: 3.2, note: '0101...' },
      { id: 'slot', label: 'slot', x: 6.5, y: 3.2, note: 'leaf' },
      { id: 'root', label: 'root', x: 8.4, y: 3.2, note: 'commit' },
    ],
    edges: [
      { id: 'e-key-hash', from: 'key', to: 'hash' },
      { id: 'e-hash-path', from: 'hash', to: 'path' },
      { id: 'e-path-slot', from: 'path', to: 'slot' },
      { id: 'e-slot-root', from: 'slot', to: 'root' },
    ],
  }, { title });
}

function proofFlow(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.8, y: 3.2, note: 'key k' },
      { id: 'walk', label: 'walk', x: 2.7, y: 3.2, note: 'bit path' },
      { id: 'empty', label: 'empty', x: 4.6, y: 3.2, note: 'default' },
      { id: 'hashes', label: 'hashes', x: 6.5, y: 3.2, note: 'siblings' },
      { id: 'root', label: 'root', x: 8.4, y: 3.2, note: 'match' },
    ],
    edges: [
      { id: 'e-query-walk', from: 'query', to: 'walk' },
      { id: 'e-walk-empty', from: 'walk', to: 'empty' },
      { id: 'e-empty-hashes', from: 'empty', to: 'hashes' },
      { id: 'e-hashes-root', from: 'hashes', to: 'root' },
    ],
  }, { title });
}

function* emptyLeafProofs() {
  const flowState = sparseFlow('A sparse tree turns key bits into leaf addresses');
  const flowNodeCount = flowState.nodes.length;
  const flowEdgeCount = flowState.edges.length;
  yield {
    state: flowState,
    highlight: { active: ['hash', 'path'], found: ['slot', 'root'] },
    explanation: `A sparse Merkle tree is an authenticated map, not a compact list. The ${flowNodeCount}-stage pipeline hashes the key, reads the hash bits as a path, and places the value at that deterministic leaf slot.`,
    invariant: `Absence can be proven because every missing key has a known empty slot — the pipeline's ${flowEdgeCount} edges form a single deterministic route from key to root.`,
  };

  const bits = 4;
  const leafSlots = 2 ** bits;
  const universeRows = [
    { id: 'a', label: '0011' },
    { id: 'b', label: '0101' },
    { id: 'c', label: '1010' },
    { id: 'd', label: '1110' },
  ];
  const universeCols = [
    { id: 'state', label: 'state' },
    { id: 'proof', label: 'proof result' },
  ];
  const universeData = [
    ['alice: 7', 'present'],
    ['empty hash', 'absent'],
    ['carol: 9', 'present'],
    ['empty hash', 'absent'],
  ];
  const presentCount = universeData.filter(r => r[1] === 'present').length;
  const absentCount = universeData.filter(r => r[1] === 'absent').length;
  yield {
    state: labelMatrix('Tiny 4-bit universe', universeRows, universeCols, universeData),
    highlight: { active: ['b:state', 'd:state'], found: ['b:proof'] },
    explanation: `The real universe might be 2^256 leaves. This ${bits}-bit toy has ${leafSlots} slots but only ${presentCount} are occupied; the other ${absentCount} shown here hold empty hashes. The implementation stores only non-empty paths plus precomputed default hashes for empty subtrees.`,
  };

  const proofState = proofFlow('Non-membership is an opening to an empty leaf');
  const proofNodeCount = proofState.nodes.length;
  const queryNote = proofState.nodes.find(n => n.id === 'query').note;
  yield {
    state: proofState,
    highlight: { active: ['query', 'walk', 'empty'], found: ['root'] },
    explanation: `To prove ${queryNote} 0101 is absent, open the path for 0101 and show the default empty leaf there. The ${proofNodeCount}-step verifier recomputes upward with sibling hashes and checks the trusted root.`,
    invariant: `Presence and absence use the same ${proofNodeCount}-node recompute-to-root verifier.`,
  };

  const checkRows = [
    { id: 'path', label: 'path' },
    { id: 'leaf', label: 'leaf' },
    { id: 'siblings', label: 'siblings' },
    { id: 'root', label: 'root' },
  ];
  const checkCols = [
    { id: 'input', label: 'input' },
    { id: 'rejects', label: 'rejects if' },
  ];
  const checkData = [
    ['hash(key)', 'wrong slot'],
    ['value/empty', 'bad value'],
    ['proof list', 'tampered'],
    ['trusted digest', 'mismatch'],
  ];
  yield {
    state: labelMatrix('Verifier checks', checkRows, checkCols, checkData),
    highlight: { found: ['leaf:input', 'root:input'], compare: ['path:rejects', 'root:rejects'] },
    explanation: `The proof does not ask the server to be honest. It gives the verifier ${checkRows.length} pieces of data (${checkRows.map(r => r.label).join(', ')}); any incorrect path, leaf, or sibling hash breaks the root comparison.`,
  };
}

function* compressedSparsePaths() {
  const defaultNodes = [
    { id: 'z0', label: 'z0', x: 0.8, y: 3.2, note: 'empty leaf' },
    { id: 'z1', label: 'z1', x: 2.7, y: 3.2, note: 'hash z0,z0' },
    { id: 'z2', label: 'z2', x: 4.6, y: 3.2, note: 'empty level' },
    { id: 'live', label: 'live path', x: 6.5, y: 3.2, note: 'stored' },
    { id: 'root', label: 'root', x: 8.4, y: 3.2, note: 'mixed' },
  ];
  const defaultEdges = [
    { id: 'e-z0-z1', from: 'z0', to: 'z1' },
    { id: 'e-z1-z2', from: 'z1', to: 'z2' },
    { id: 'e-z2-live', from: 'z2', to: 'live' },
    { id: 'e-live-root', from: 'live', to: 'root' },
  ];
  const emptyLevels = defaultNodes.filter(n => n.id.startsWith('z')).length;
  const baseNote = defaultNodes[0].note;
  yield {
    state: graphState({ nodes: defaultNodes, edges: defaultEdges }, { title: 'Default hashes compress empty space' }),
    highlight: { active: ['z0', 'z1', 'z2'], found: ['live', 'root'] },
    explanation: `Every all-empty subtree has a deterministic hash: z0 for an ${baseNote}, z1 = hash(z0,z0), z2 = hash(z1,z1), and so on. The ${emptyLevels} default levels shown here let a sparse implementation store those constants once.`,
  };

  const storageRows = [
    { id: 'default', label: 'default hashes' },
    { id: 'compact', label: 'compact leaf' },
    { id: 'branch', label: 'sparse branch' },
    { id: 'version', label: 'versioned key' },
  ];
  const storageCols = [
    { id: 'saves', label: 'saves' },
    { id: 'risk', label: 'risk' },
  ];
  const storageData = [
    ['empty levels', 'domain rules'],
    ['single-child path', 'proof format'],
    ['missing children', 'lookup logic'],
    ['old roots', 'storage growth'],
  ];
  yield {
    state: labelMatrix('Storage tricks', storageRows, storageCols, storageData),
    highlight: { found: ['default:saves', 'compact:saves'], compare: ['version:risk'] },
    explanation: `Production sparse trees avoid storing the impossible full tree. ${storageRows.length} tricks — ${storageRows.map(r => r.label).join(', ')} — compress empty subtrees, collapse one-child paths, and version nodes so old roots remain provable.`,
  };

  const costRows = [
    { id: 'lookup', label: 'lookup' },
    { id: 'absence', label: 'absence' },
    { id: 'update', label: 'update' },
    { id: 'proof', label: 'proof size' },
  ];
  const costCols = [
    { id: 'plain', label: 'plain SMT' },
    { id: 'optimized', label: 'optimized' },
  ];
  const costData = [
    ['depth hashes', 'skip empties'],
    ['empty path', 'compact leaf'],
    ['rewrite path', 'version nodes'],
    ['O(depth)', 'compressed'],
  ];
  const operationCount = costRows.length;
  yield {
    state: labelMatrix('Cost model', costRows, costCols, costData),
    highlight: { active: ['absence:plain', 'absence:optimized'], found: ['proof:optimized'] },
    explanation: `The logical model is simple: one path per key. Across ${operationCount} operations (${costRows.map(r => r.label).join(', ')}), the engineering challenge is keeping depth-256 proofs, random I/O, and old-version storage practical.`,
  };

  const summaryState = sparseFlow('Sparse Merkle trees sit between maps and proofs');
  const summaryNodeCount = summaryState.nodes.length;
  const firstNodeLabel = summaryState.nodes[0].label;
  const lastNodeLabel = summaryState.nodes[summaryNodeCount - 1].label;
  yield {
    state: summaryState,
    highlight: { active: ['key', 'path', 'slot'], found: ['root'] },
    explanation: `A hash table gives fast lookup but no public proof. A normal Merkle tree gives proofs over a known list. A sparse Merkle tree's ${summaryNodeCount}-node pipeline from ${firstNodeLabel} to ${lastNodeLabel} gives authenticated key-value lookup, including proof that a key is missing.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'empty leaf proofs') yield* emptyLeafProofs();
  else if (view === 'compressed sparse paths') yield* compressedSparsePaths();
  else throw new InputError('Pick a sparse-merkle-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the root as a commitment to a key-value map. A commitment is a short value that fixes a larger data set; a Merkle root fixes the tree below it because each parent hash depends on its children.',
        {type: 'image', src: './assets/gifs/sparse-merkle-tree-non-membership.gif', alt: 'Animated walkthrough of the sparse merkle tree non membership visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The active path is chosen by the query key hash. A found empty leaf or branch proves absence only for that path and only under the trusted root shown.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Ordinary Merkle trees prove membership well: a server sends a leaf and sibling hashes, and the verifier recomputes the root. Authenticated maps also need non-membership, which means proving a key is absent.',
        {type: 'callout', text: 'A sparse Merkle tree proves absence by making the missing key location deterministic, then opening that location against the committed root.'},
        'A sparse Merkle tree gives every possible key a deterministic logical slot. Missing keys correspond to default empty leaves or empty subtrees, so absence becomes an opening to where the key would have been.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store only present keys in an ordinary Merkle tree and send membership proofs. That proves inclusion when the server gives the key.',
        'It does not prove absence. A malicious or stale server can omit a key and say it did not find it. The verifier needs to know the exact address where that key belongs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is negative evidence. Proving this leaf exists is local, but proving no leaf with this key exists requires a committed address rule.',
        'Sorted authenticated maps can prove absence by showing neighboring keys, but that exposes neighbors and needs order-aware proofs. Sparse Merkle trees instead pay for a huge logical tree with implicit empty regions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Hash the key and read the hash bits as a path from root to leaf. If the path starts 0101, the verifier accepts only proof data that follows left, right, left, right for those bits.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hash_Tree.svg/500px-Hash_Tree.svg.png', alt: 'Merkle hash tree with data blocks at leaves and hashes combined upward to a top hash', caption: 'Sparse trees use the same recursive hash commitment as ordinary Merkle trees, but most empty leaves are represented by default hashes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_Tree.svg.'},
        'Every empty subtree has a deterministic hash. If z0 is the empty-leaf hash, then z1 = hash(z0, z0), z2 = hash(z1, z1), and so on. The verifier can recompute empty regions without downloading them.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'To insert a key, hash the key into a fixed-length bit string and follow that path to a leaf. Store a domain-separated hash of the key and value, then recompute ancestors back to the root.',
        'To prove membership, send the leaf and sibling hashes. To prove non-membership, send proof data showing that the query path reaches an empty leaf or empty compressed branch. The verifier recomputes upward and compares with the trusted root.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The verifier does not trust the server statement that a key is absent. It trusts the root and checks whether the supplied path data recomputes that root under the key-path rule.',
        'If the server opens the wrong path, the key bits do not match. If it claims empty where a value exists, the recomputed root changes. If it changes a sibling hash, the root changes. Forgery requires breaking the hash commitment or encoding rules.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The clean binary-tree cost is O(depth) for lookup, update, proof generation, and verification. With 256-bit key hashes, depth is 256, so the bound is predictable but not tiny.',
        'Implementations reduce practical cost with default-hash tables, path compression, compact leaves, batched writes, wider branching factors, and proof formats that omit predictable empty siblings. Poor node layout can still cause many scattered database reads and writes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sparse Merkle trees fit authenticated key-value state: account balances, package registry entries, credential revocation maps, rollup state, document digests, and nullifier sets. A light client can keep a root and verify short proofs.',
        'Non-membership matters in double-spend prevention. A nullifier set must prove that a note has not already been spent. Without an absence proof tied to a committed root, the claim is only a database promise.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A proof is meaningful only relative to a trusted root. If the verifier accepts a stale or wrong root, the proof can be valid and still answer the wrong question.',
        'The design also fails when serialization is ambiguous. Empty leaves, value leaves, internal nodes, compact leaves, hash identifiers, key encodings, and version metadata need domain separation. Binary proofs can also be costly in circuits and storage engines.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a toy tree with four-bit paths. The query key bob hashes to 0101, and the verifier trusts root R. To prove absence, the server shows that path 0101 reaches the default empty leaf plus sibling hashes for each level.',
        'The verifier starts with empty leaf hash z0 at path 0101. At each level it combines the current hash with the sibling on the side dictated by the path bit. After four levels, the recomputed value must equal R.',
        'If the server opens 0111 instead, the path check fails. If a value is present at 0101, replacing that leaf with z0 changes the root. In a compact tree, a proof can show a stored leaf on a diverging path instead.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Ethereum sparse Merkle optimization notes, the Diem Jellyfish Merkle Tree paper, JMT documentation, Aztec indexed Merkle tree notes, and Efficient Sparse Merkle Trees. Focus on proof format, default hashes, compression, and versioned storage.',
        'Next study Merkle Tree, Content-Addressed Merkle DAGs, Merkle Patricia Trie, Verkle Trees, KZG Commitments, Persistent Segment Trees, Hash Functions, and authenticated data structures.',
      ],
    },
  ],
};
