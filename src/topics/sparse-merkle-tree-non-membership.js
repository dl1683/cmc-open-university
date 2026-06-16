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
  yield {
    state: sparseFlow('A sparse tree turns key bits into leaf addresses'),
    highlight: { active: ['hash', 'path'], found: ['slot', 'root'] },
    explanation: 'A sparse Merkle tree is an authenticated map, not a compact list. Hash the key, read the hash bits as a path, and place the value at that deterministic leaf slot.',
    invariant: 'Absence can be proven because every missing key has a known empty slot.',
  };

  yield {
    state: labelMatrix(
      'Tiny 4-bit universe',
      [
        { id: 'a', label: '0011' },
        { id: 'b', label: '0101' },
        { id: 'c', label: '1010' },
        { id: 'd', label: '1110' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof result' },
      ],
      [
        ['alice: 7', 'present'],
        ['empty hash', 'absent'],
        ['carol: 9', 'present'],
        ['empty hash', 'absent'],
      ],
    ),
    highlight: { active: ['b:state', 'd:state'], found: ['b:proof'] },
    explanation: 'The real universe might be 2^256 leaves. The implementation does not materialize it. It stores only non-empty paths plus precomputed default hashes for empty subtrees.',
  };

  yield {
    state: proofFlow('Non-membership is an opening to an empty leaf'),
    highlight: { active: ['query', 'walk', 'empty'], found: ['root'] },
    explanation: 'To prove key 0101 is absent, open the path for 0101 and show the default empty leaf there. The verifier recomputes upward with sibling hashes and checks the trusted root.',
    invariant: 'Presence and absence use the same recompute-to-root verifier.',
  };

  yield {
    state: labelMatrix(
      'Verifier checks',
      [
        { id: 'path', label: 'path' },
        { id: 'leaf', label: 'leaf' },
        { id: 'siblings', label: 'siblings' },
        { id: 'root', label: 'root' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'rejects', label: 'rejects if' },
      ],
      [
        ['hash(key)', 'wrong slot'],
        ['value/empty', 'bad value'],
        ['proof list', 'tampered'],
        ['trusted digest', 'mismatch'],
      ],
    ),
    highlight: { found: ['leaf:input', 'root:input'], compare: ['path:rejects', 'root:rejects'] },
    explanation: 'The proof does not ask the server to be honest. It gives the verifier enough data to derive the claimed root; any incorrect path, leaf, or sibling hash breaks the root comparison.',
  };
}

function* compressedSparsePaths() {
  yield {
    state: graphState({
      nodes: [
        { id: 'z0', label: 'z0', x: 0.8, y: 3.2, note: 'empty leaf' },
        { id: 'z1', label: 'z1', x: 2.7, y: 3.2, note: 'hash z0,z0' },
        { id: 'z2', label: 'z2', x: 4.6, y: 3.2, note: 'empty level' },
        { id: 'live', label: 'live path', x: 6.5, y: 3.2, note: 'stored' },
        { id: 'root', label: 'root', x: 8.4, y: 3.2, note: 'mixed' },
      ],
      edges: [
        { id: 'e-z0-z1', from: 'z0', to: 'z1' },
        { id: 'e-z1-z2', from: 'z1', to: 'z2' },
        { id: 'e-z2-live', from: 'z2', to: 'live' },
        { id: 'e-live-root', from: 'live', to: 'root' },
      ],
    }, { title: 'Default hashes compress empty space' }),
    highlight: { active: ['z0', 'z1', 'z2'], found: ['live', 'root'] },
    explanation: 'Every all-empty subtree has a deterministic hash: z0 for an empty leaf, z1 = hash(z0,z0), z2 = hash(z1,z1), and so on. A sparse implementation stores those constants once.',
  };

  yield {
    state: labelMatrix(
      'Storage tricks',
      [
        { id: 'default', label: 'default hashes' },
        { id: 'compact', label: 'compact leaf' },
        { id: 'branch', label: 'sparse branch' },
        { id: 'version', label: 'versioned key' },
      ],
      [
        { id: 'saves', label: 'saves' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['empty levels', 'domain rules'],
        ['single-child path', 'proof format'],
        ['missing children', 'lookup logic'],
        ['old roots', 'storage growth'],
      ],
    ),
    highlight: { found: ['default:saves', 'compact:saves'], compare: ['version:risk'] },
    explanation: 'Production sparse trees avoid storing the impossible full tree. They compress empty subtrees, collapse one-child paths, and often version nodes so old roots remain provable.',
  };

  yield {
    state: labelMatrix(
      'Cost model',
      [
        { id: 'lookup', label: 'lookup' },
        { id: 'absence', label: 'absence' },
        { id: 'update', label: 'update' },
        { id: 'proof', label: 'proof size' },
      ],
      [
        { id: 'plain', label: 'plain SMT' },
        { id: 'optimized', label: 'optimized' },
      ],
      [
        ['depth hashes', 'skip empties'],
        ['empty path', 'compact leaf'],
        ['rewrite path', 'version nodes'],
        ['O(depth)', 'compressed'],
      ],
    ),
    highlight: { active: ['absence:plain', 'absence:optimized'], found: ['proof:optimized'] },
    explanation: 'The logical model is simple: one path per key. The engineering challenge is keeping depth-256 proofs, random I/O, and old-version storage practical.',
  };

  yield {
    state: sparseFlow('Sparse Merkle trees sit between maps and proofs'),
    highlight: { active: ['key', 'path', 'slot'], found: ['root'] },
    explanation: 'A hash table gives fast lookup but no public proof. A normal Merkle tree gives proofs over a known list. A sparse Merkle tree gives authenticated key-value lookup, including proof that a key is missing.',
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
      heading: 'What it is',
      paragraphs: [
        'A sparse Merkle tree is an authenticated key-value map over an enormous fixed universe. Instead of packing only existing records into consecutive leaves, it assigns every possible key a deterministic leaf slot, usually by hashing the key and reading the digest bits as a path. Missing keys are represented by default empty leaves and default empty subtrees.',
        'That design makes non-membership proofs natural. In an ordinary unsorted Merkle tree, proving that a value is absent is awkward because the tree only commits to what is present. In a sparse Merkle tree, every possible key has a place. If the path for key k opens to the default empty value and recomputes the root, k is absent relative to that root.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The empty tree has a known stack of default hashes: z0 for an empty leaf, z1 = hash(z0,z0), z2 = hash(z1,z1), continuing up to the root depth. Inserting a key replaces one empty leaf with a value leaf and recomputes hashes on the path to the root. Membership proof sends the value leaf plus sibling hashes. Non-membership proof sends an empty leaf opening, or in compact forms, a neighboring compact leaf proving that the requested path diverges.',
        'No implementation materializes 2^256 leaves. Practical trees store only non-empty branches and enough metadata to reconstruct default siblings. Variants such as Jellyfish Merkle Tree use sparse-tree semantics with storage-engine-aware node layout, compact leaf handling, and versioned node keys so old roots can remain queryable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The clean logical cost is O(depth) for lookup, update, and proof verification. With 256-bit keys, depth can be 256, which is acceptable for some systems but expensive in zero-knowledge circuits or high-throughput storage engines. Optimizations compress empty paths, cache default hashes, batch updates, choose wider radix nodes, and design proof formats that do not repeat predictable empty siblings.',
      ],
    },
    {
      heading: 'Real-world case studies',
      paragraphs: [
        'Diem introduced Jellyfish Merkle Tree as a sparse Merkle tree optimized for LSM-tree-backed blockchain state. Its paper describes a space-and-computation-efficient authenticated state tree inspired by Ethereum-style Patricia Merkle designs but adapted for versioned storage.',
        'Rollup and privacy systems use the idea for nullifier and state trees because they need to prove both membership and non-membership. Aztec documentation explains why naive sparse nullifier trees are conceptually simple but costly in circuits, motivating indexed Merkle trees and batch insertion techniques. Ethereum research discussions similarly explore sparse-tree optimization for huge key spaces.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Sparse does not mean small by itself. The logical tree is enormous; the implementation is small only because it compresses default subtrees. Sparse Merkle trees also do not replace consensus. A proof is meaningful only relative to a root that the verifier already trusts. Finally, absence is not a global truth; it means absent from the committed map at that exact root version.',
        'Hash-domain separation matters. Leaves, internal nodes, empty values, and compact nodes should be encoded so one kind cannot be confused for another. Poor serialization can break the security story even when the tree shape is mathematically sound.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: Ethereum research on sparse Merkle optimization at https://ethresear.ch/t/optimizing-sparse-merkle-trees/3751, Diem Jellyfish Merkle Tree paper at https://developers.diem.com/papers/jellyfish-merkle-tree/2021-01-14.pdf, JMT docs at https://docs.rs/jmt, Aztec indexed Merkle tree notes at https://docs.aztec.network/developers/docs/foundational-topics/advanced/storage/indexed_merkle_tree, and Efficient Sparse Merkle Trees at https://eprint.iacr.org/2016/683. Study Merkle Tree, Namespaced Merkle Tree Proof Case Study, Merkle Mountain Range Append-Only Log, Ethereum Merkle-Patricia Trie Case Study, Verkle Trees & Stateless Clients, and Hash Table next.',
      ],
    },
  ],
};
