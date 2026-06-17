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
      heading: 'Why this exists',
      paragraphs: [
        'A Merkle root is a compact commitment. If the verifier trusts the root, an untrusted server can prove that a particular leaf is part of the committed data by sending sibling hashes along the path to the root. That is enough for a list, but many real systems need an authenticated map: account id to balance, nullifier to spent status, document id to digest, or key to value.',
        'Maps need two kinds of claims. The first is membership: this key has this value. The second is non-membership: this key is absent. Non-membership is harder because a dishonest server can always say it did not find a key unless the verifier knows exactly where that key would have been.',
        'A sparse Merkle tree solves that by giving every possible key a deterministic slot in an enormous logical tree. Missing keys are represented by default empty leaves and default empty subtrees. Absence becomes an opening to a known empty location, not a promise from storage.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to put only present keys into a normal Merkle tree and send membership proofs. That proves inclusion, but it does not prove absence. If the server is malicious or stale, it can simply omit a key from the response and claim the key was not there.',
        'A sorted authenticated structure can prove absence by showing neighboring keys. If the committed order contains A, C, and D, then a proof for missing B can show the gap between A and C. That is a valid design, but it exposes neighbors and requires an order-aware proof format.',
        'Sparse Merkle trees choose a different tradeoff. Hash the query key, read the digest bits as a path, and verify the exact logical slot for that key. The full tree might have 2^256 leaves, but the implementation stores only the non-empty structure and uses known default hashes for everything else.',
      ],
    },
    {
      heading: 'The core invariant',
      paragraphs: [
        'The invariant is that each key maps to one path, and only that path can contain the key value. If the key hashes to bits 0101..., the verifier will accept only a proof that follows 0101... from the root. A proof for a different path is irrelevant.',
        'The second invariant is that every all-empty subtree has a deterministic hash. The empty leaf hash is z0. The empty subtree one level up is z1 = hash(z0, z0). The next is z2 = hash(z1, z1), and so on. A verifier can use these constants without seeing every empty leaf.',
        'Together, these invariants make absence checkable. The verifier knows where the key belongs, knows what an empty region should hash to, and can recompute the committed root from the provided path data.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the empty-leaf proof view, follow the query key through hashing, bit-path selection, leaf slot, and root commitment. The important idea is determinism: the key has one logical address. A server that claims absence must open that address or show a compact proof that the address falls inside an empty branch.',
        'The proof flow is the verifier side. Start with the claimed leaf, combine it with sibling hashes in the order dictated by the key bits, and recompute upward. If the final digest equals the trusted root, the statement is true for that root.',
        'In the compressed sparse paths view, focus on the default hashes. The logical tree is huge, but most of it is empty. Production implementations store live branches, compact leaves, version metadata, and a table of default hashes rather than materializing the tree.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with an empty logical tree of fixed depth, usually the output size of a cryptographic hash. No implementation allocates 2^256 leaves. It precomputes default hashes for empty subtrees and stores a root that represents the empty map.',
        'To insert a key, hash the key into a bit string. The bits choose left or right at each level. At the leaf, store a hash of the key and value, using domain separation so leaf hashes cannot be confused with internal-node hashes. Then recompute each ancestor on the path back to the root.',
        'To verify a membership proof, the verifier hashes the leaf, applies each sibling hash at the correct side, and compares the final digest with the trusted root. To verify an empty-leaf non-membership proof, the verifier starts with the empty leaf hash for the query path and performs the same recomputation.',
      ],
    },
    {
      heading: 'Compact non-membership proofs',
      paragraphs: [
        'The simplest absence proof opens the query path to an empty leaf. In a depth-256 tree, that can require many sibling hashes unless the proof format compresses default siblings. This is conceptually clean, but not always the most efficient wire format.',
        'Many sparse tree variants use compact leaves or path compression. If only one live key exists under a long prefix, the implementation stores that key and the remaining suffix rather than every single branch. A non-membership proof can then show that the query path diverges from the stored compact leaf before it could reach an occupied slot.',
        'The verifier must still enforce the same invariant: the shown leaf or empty branch must be on the query path, and the recomputed hash must match the trusted root. Compression changes the encoding, not the security claim.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The verifier does not trust the server statement about absence. It trusts a root hash. The proof is just enough data to recompute that root under a specific interpretation of key path, leaf hash, default hashes, and sibling order.',
        'If the server opens the wrong path, the proof fails because the path bits do not match hash(key). If the server lies about an empty leaf where a value exists, the recomputed root changes. If the server changes a sibling, the recomputed root changes. If the server tries to make two different maps share one root, it needs a hash collision or a domain-separation break.',
        'This is why serialization is security-critical. Keys, values, empty leaves, internal nodes, compact leaves, and versioned nodes should have unambiguous encodings and domain tags. Ambiguous encodings can turn a strong tree into a weak commitment.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a toy tree has four-bit paths and the query key hashes to 0101. The verifier trusts root R. To prove absence, the server shows that the leaf at 0101 is the default empty leaf, plus the sibling hashes needed at each level to recompute R.',
        'If the server instead opens 0111, the verifier rejects because the path does not match the query. If the server changes one sibling hash, the recomputed root differs from R. If a value is present at 0101 in the committed map, the server cannot show an empty leaf at 0101 without changing the root.',
        'In a compact variant, the server might show a neighboring compact leaf with path 0110 and prove that the query path 0101 diverges before that leaf. The verifier checks both the divergence and the recomputed root.',
      ],
    },
    {
      heading: 'Updates and versions',
      paragraphs: [
        'Updating a key rewrites the nodes on that key path. In an immutable or versioned tree, the implementation writes new nodes for the updated path and keeps old nodes reachable from older roots. This lets clients verify historical proofs against historical roots.',
        'Versioning is powerful and expensive. Every update can create O(depth) new logical nodes unless the implementation compresses paths, batches writes, or stores nodes in a database layout tuned for locality. Garbage collection must know which old roots still matter.',
        'Diem Jellyfish Merkle Tree is one example of a storage-engine-aware sparse Merkle design. It uses a sparse authenticated map shape while paying close attention to node layout, versioned state, and practical proof generation.',
      ],
    },
    {
      heading: 'Cost model',
      paragraphs: [
        'The clean logical cost is O(depth) for lookup, update, proof generation, and verification. With 256-bit keys, depth is 256 in a binary tree. That is predictable and simple, but it can be heavy in storage engines, network proofs, and zero-knowledge circuits.',
        'Optimizations compress empty paths, cache default hashes, batch updates, use wider branching factors, store compact leaves, avoid sending predictable default siblings, and choose proof formats that match the verifier. These optimizations should be treated as format decisions, not cosmetic details.',
        'Sparse does not mean small automatically. The logical tree is enormous. The practical tree is small only because empty regions are implicit or compressed. Poor node layout can turn a theoretically simple update into many random database reads and writes.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Sparse Merkle trees fit authenticated key-value state, account maps, package registries, transparency systems, rollup state, credential revocation maps, and nullifier sets. They are especially useful when clients need to verify storage responses from a server they do not fully trust.',
        'Privacy and rollup systems often need absence as much as presence. A nullifier set, for example, needs to prove that a note has not already been spent. The absence proof must be tied to a committed root, or double-spend prevention becomes a database promise instead of a cryptographic statement.',
        'They also compose well with light clients. A light client can keep a root and verify short proofs without downloading the whole map. The server does the storage work; the client does bounded cryptographic checking.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A proof is meaningful only relative to a root the verifier already trusts. Absence is not global truth. It means absent from this committed map at this exact root version. If the verifier accepts the wrong root, the proof can be perfectly valid and still answer the wrong question.',
        'The design also fails when key hashing, serialization, or domain separation is sloppy. Leaf and branch encodings must not collide. Empty values must be distinguishable from real values. Key hashes must be stable across implementations. Versioned storage must not mix nodes from incompatible formats.',
        'Binary sparse trees can be expensive in circuits because every proof may imply many hash computations. They can also be expensive in databases if node reads are scattered. Indexed Merkle trees, Verkle trees, Patricia tries, and wider sparse trees are alternative points in the design space.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Define the proof format before optimizing storage. A verifier needs key, value or absence marker, path information, sibling hashes, compact-leaf metadata if used, hash function id, and root version. The format should reject extra ambiguity rather than relying on implementation folklore.',
        'Use explicit domain separation for empty leaves, value leaves, compact leaves, and internal nodes. Precompute default hashes once per tree depth and make them part of the implementation contract. Test membership and non-membership against independent fixtures, including wrong path, wrong sibling order, wrong key, stale root, and malformed compact proof cases.',
        'For JavaScript implementations, be careful with byte arrays and hex strings. Hash functions operate on bytes, not on display encodings. Normalize keys at the boundary, then hash the canonical bytes. A tree that signs one encoding and verifies another is not an authenticated map; it is a bug farm.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: Ethereum research on sparse Merkle optimization at https://ethresear.ch/t/optimizing-sparse-merkle-trees/3751, the Diem Jellyfish Merkle Tree paper at https://developers.diem.com/papers/jellyfish-merkle-tree/2021-01-14.pdf, JMT docs at https://docs.rs/jmt, Aztec indexed Merkle tree notes at https://docs.aztec.network/developers/docs/foundational-topics/advanced/storage/indexed_merkle_tree, and Efficient Sparse Merkle Trees at https://eprint.iacr.org/2016/683.',
        'Study Merkle Tree, Namespaced Merkle Tree Proof Case Study, Merkle Mountain Range Append-Only Log, Ethereum Merkle-Patricia Trie Case Study, Verkle Trees and Stateless Clients, KZG Polynomial Commitment Opening Case Study, Hash Table, and Persistent Segment Tree next.',
      ],
    },
  ],
};
