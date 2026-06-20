// Ethereum Merkle-Patricia Trie: a cryptographically authenticated key-value
// map where trie paths, node hashes, and proofs all meet.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ethereum-merkle-patricia-trie-case-study',
  title: 'Ethereum Merkle-Patricia Trie Case Study',
  category: 'Systems',
  summary: 'Ethereum state as an authenticated trie: account/storage keys become nibble paths, nodes hash upward, and compact proofs verify values from a root.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['state root', 'proof path'], defaultValue: 'state root' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function* stateRoot() {
  yield {
    state: graphState({
      nodes: [
        { id: 'key', label: 'key', x: 0.8, y: 4.0, note: 'account' },
        { id: 'hash', label: 'hash', x: 2.2, y: 4.0, note: 'secure' },
        { id: 'nibble', label: 'nibbles', x: 3.8, y: 4.0, note: 'path' },
        { id: 'branch', label: 'branch', x: 5.6, y: 4.0, note: '16-way' },
        { id: 'leaf', label: 'leaf', x: 7.4, y: 4.0, note: 'value' },
        { id: 'root', label: 'root', x: 9.0, y: 4.0, note: 'hash' },
      ],
      edges: [
        { id: 'e-key-hash', from: 'key', to: 'hash' },
        { id: 'e-hash-nibble', from: 'hash', to: 'nibble' },
        { id: 'e-nibble-branch', from: 'nibble', to: 'branch' },
        { id: 'e-branch-leaf', from: 'branch', to: 'leaf' },
        { id: 'e-leaf-root', from: 'leaf', to: 'root' },
      ],
    }, { title: 'Ethereum turns key-value state into one root hash' }),
    highlight: { active: ['hash', 'nibble', 'branch'], found: ['root'] },
    explanation: 'Ethereum state is a key-value map with a cryptographic fingerprint. Keys are hashed, split into nibbles, walked through a modified PATRICIA Trie, and hashed upward into a state root.',
    invariant: 'Same trie contents imply the same root; a changed value changes the root path.',
  };

  yield {
    state: labelMatrix(
      'Node roles',
      [
        { id: 'branch', label: 'branch' },
        { id: 'ext', label: 'extension' },
        { id: 'leaf', label: 'leaf' },
        { id: 'hash', label: 'hash ref' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['16 children + value', 'fanout'],
        ['shared path', 'compress'],
        ['suffix + value', 'terminate'],
        ['child digest', 'prove'],
      ],
    ),
    highlight: { found: ['branch:purpose', 'ext:purpose', 'hash:purpose'] },
    explanation: 'The trie combines radix branching with path compression. Branch nodes split on nibbles; extension nodes compress shared path segments; leaf nodes hold the remaining path and value.',
  };

  yield {
    state: labelMatrix(
      'What roots commit to',
      [
        { id: 'state', label: 'state trie' },
        { id: 'storage', label: 'storage trie' },
        { id: 'tx', label: 'tx trie' },
        { id: 'receipt', label: 'receipt trie' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'root', label: 'root use' },
      ],
      [
        ['accounts', 'block header'],
        ['contract slots', 'account field'],
        ['block txs', 'block header'],
        ['logs/outcomes', 'block header'],
      ],
    ),
    highlight: { active: ['state:root', 'storage:root'], compare: ['tx:root', 'receipt:root'] },
    explanation: 'Ethereum uses authenticated tries in several places. The state root commits to accounts; each contract can point at a storage root; block headers also commit to transactions and receipts.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'changed keys', min: 0, max: 100 }, y: { label: 'nodes rewritten', min: 0, max: 600 } },
      series: [
        { id: 'flat', label: 'hash whole map', points: [{ x: 1, y: 500 }, { x: 20, y: 520 }, { x: 100, y: 560 }] },
        { id: 'trie', label: 'trie paths', points: [{ x: 1, y: 8 }, { x: 20, y: 140 }, { x: 100, y: 520 }] },
      ],
    }),
    highlight: { found: ['trie'], compare: ['flat'] },
    explanation: 'The trie lets clients update and prove local paths instead of rehashing one monolithic state blob. The actual cost depends on path overlap, storage layout, and client implementation.',
  };
}

function* proofPath() {
  yield {
    state: graphState({
      nodes: [
        { id: 'root', label: 'root', x: 0.8, y: 4.0, note: 'trusted' },
        { id: 'n1', label: 'node', x: 2.6, y: 4.0, note: 'hash ok' },
        { id: 'n2', label: 'node', x: 4.4, y: 4.0, note: 'hash ok' },
        { id: 'leaf', label: 'leaf', x: 6.2, y: 4.0, note: 'value' },
        { id: 'siblings', label: 'siblings', x: 8.2, y: 4.0, note: 'needed' },
      ],
      edges: [
        { id: 'e-root-n1', from: 'root', to: 'n1' },
        { id: 'e-n1-n2', from: 'n1', to: 'n2' },
        { id: 'e-n2-leaf', from: 'n2', to: 'leaf' },
        { id: 'e-leaf-siblings', from: 'leaf', to: 'siblings' },
      ],
    }, { title: 'A proof carries the nodes needed to recompute the root' }),
    highlight: { active: ['root', 'n1', 'n2'], found: ['leaf'] },
    explanation: 'A Merkle-Patricia proof gives a verifier enough encoded nodes along the key path to recompute hashes up to the trusted root. The verifier does not need the whole state database.',
    invariant: 'Proof verification is recompute-and-compare.',
  };

  yield {
    state: labelMatrix(
      'Proof verifier loop',
      [
        { id: 'path', label: 'path' },
        { id: 'decode', label: 'decode node' },
        { id: 'hash', label: 'hash node' },
        { id: 'match', label: 'match ref' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'failure', label: 'failure if' },
      ],
      [
        ['consume nibbles', 'wrong branch'],
        ['RLP payload', 'malformed'],
        ['Keccak digest', 'tampered'],
        ['parent child', 'not equal'],
      ],
    ),
    highlight: { active: ['hash:check', 'match:check'], removed: ['match:failure'] },
    explanation: 'The proof is data, not trust. Each node is decoded, checked against the requested path, hashed, and compared to the child reference carried by its parent.',
  };

  yield {
    state: labelMatrix(
      'Why clients care',
      [
        { id: 'light', label: 'light client' },
        { id: 'bridge', label: 'bridge' },
        { id: 'indexer', label: 'indexer' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'uses', label: 'uses proof for' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['account value', 'stale root'],
        ['cross-chain state', 'bad header trust'],
        ['spot checks', 'missing history'],
        ['inclusion/exclusion', 'encoding bugs'],
      ],
    ),
    highlight: { found: ['light:uses', 'bridge:uses', 'audit:uses'], compare: ['bridge:risk'] },
    explanation: 'Proofs are only as trustworthy as the root they target. Once the root is trusted, the proof can establish inclusion or absence without downloading the entire state.',
  };

  yield {
    state: labelMatrix(
      'Tradeoffs',
      [
        { id: 'pro', label: 'verification' },
        { id: 'write', label: 'write amp' },
        { id: 'storage', label: 'storage' },
        { id: 'future', label: 'future' },
      ],
      [
        { id: 'result', label: 'result' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['strong', 'root commits'],
        ['high', 'paths rewrite'],
        ['large', 'node db'],
        ['Verkle', 'smaller proofs'],
      ],
    ),
    highlight: { found: ['pro:result'], active: ['write:result', 'storage:result'], compare: ['future:lesson'] },
    explanation: 'The MPT is a correctness structure first and a performance structure second. Its proof model is powerful, but state growth and proof size motivate later authenticated-tree designs such as Verkle trees.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'state root') yield* stateRoot();
  else if (view === 'proof path') yield* proofPath();
  else throw new InputError('Pick an Ethereum trie view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "State root" traces how Ethereum converts raw account keys into a single root hash: key, secure hash, nibble path, branch/extension/leaf nodes, and the root digest. "Proof path" traces how a verifier walks encoded nodes from a trusted root down to a claimed value.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current pipeline stage: the key being hashed, the nibble being consumed, the node being encoded.',
            'Found (green) nodes are committed outcomes: the root hash in the state-root view, or the verified leaf in the proof-path view.',
            'Compare (blue) nodes show contrast cases: transaction and receipt roots alongside the state root, or sibling hashes alongside the proof path.',
          ],
        },
        'In the matrix views, rows are node types or trie roles and columns are properties. Watch the "purpose" column: every node type exists to solve a specific structural problem.',
        {
          type: 'note',
          text: 'The animation uses a small trie with a handful of keys. Ethereum mainnet has over 250 million accounts, each with a 32-byte hashed key producing a 64-nibble path. The data structure is identical; the scale is six orders of magnitude larger.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Ethereum executes thousands of transactions per block. Each transaction can change account balances, contract storage slots, nonces, and code hashes. After execution, the block header must commit to the entire resulting state -- roughly 250 million accounts and hundreds of millions of storage slots -- in a single 32-byte value.',
        {
          type: 'quote',
          text: 'The state is stored not in the blockchain itself, but in a separate modified Merkle Patricia tree.',
          attribution: 'Ethereum Yellow Paper (Appendix D)',
        },
        'That 32-byte value is the state root. It must satisfy three requirements simultaneously: it must change whenever any committed value changes, it must allow a verifier to check a single account without downloading the full database, and it must be deterministic so that every node computing the same state produces the same root.',
        {
          type: 'table',
          headers: ['Requirement', 'What breaks without it'],
          rows: [
            ['Deterministic root', 'Nodes disagree on state after the same block; consensus fails'],
            ['Incremental update', 'Changing one account rehashes the entire state; blocks take minutes'],
            ['Compact proofs', 'Light clients must download the full state to verify anything; phones cannot participate'],
          ],
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is a sorted key-value list hashed as a Merkle tree. Sort accounts by address, build a binary Merkle tree over the list, and put the root in the block header. This is how certificate transparency logs and Git tree objects work.',
        {
          type: 'diagram',
          text: 'Sorted Merkle list:\n\n  H(H(A,B), H(C,D))       <-- root\n       /         \\\n   H(A,B)      H(C,D)\n    / \\          / \\\n   A   B        C   D      <-- accounts in sorted order\n\nTo update account B:\n  Recompute H(A,B), then H(H(A,B), H(C,D))\n  Proof for B: [A, H(C,D)]  -- O(log n) siblings',
          label: 'A sorted Merkle list supports proofs but not efficient key-addressed lookup',
        },
        'This works for static or append-only data. Bitcoin uses it for transactions within a block. But Ethereum state is not a list -- it is a mutable sparse map. Accounts are addressed by 20-byte addresses (160 bits). Insertions and deletions happen every block. A sorted list means finding the insertion point costs O(log n) comparisons, and every insertion shifts the positions of later elements, invalidating cached proofs and requiring O(n) rehashing in the worst case.',
        'The second instinct is a hash table: O(1) lookup, O(1) update. But a hash table has no canonical ordering and produces no compact proof. Two nodes with the same key-value pairs in different insertion orders get different internal layouts. There is no root to commit to.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'No single standard data structure satisfies all three requirements.',
        {
          type: 'table',
          headers: ['Structure', 'Key lookup', 'Deterministic root', 'Compact proof', 'Incremental update'],
          rows: [
            ['Hash table', 'O(1)', 'No -- order depends on insertion sequence', 'No', 'O(1)'],
            ['Sorted list + Merkle', 'O(log n)', 'Yes', 'Yes -- O(log n) siblings', 'O(n) for insertion/deletion'],
            ['Binary trie', 'O(key length)', 'Yes', 'Yes', 'O(key length) -- but deep and sparse'],
            ['PATRICIA trie + hashing', 'O(key length)', 'Yes', 'Yes', 'O(key length) with compression'],
          ],
        },
        'The binary trie comes closest, but with 256-bit keys (Keccak hashes of addresses), the trie is 256 levels deep and overwhelmingly sparse. Most internal nodes have exactly one child. Without compression, the database stores hundreds of millions of single-child nodes that exist only to connect two real branch points.',
        {
          type: 'note',
          text: 'The wall is three-dimensional: lookup performance, canonical commitment, and proof compactness must all hold at once. Every obvious structure solves two and fails the third. The Merkle-Patricia trie is Ethereum\'s answer to the three-way constraint.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Combine a radix trie (key-directed path traversal) with path compression (skip single-child chains) and cryptographic hashing (parent commits to child). The result is a data structure where the key determines the path, compression removes wasted nodes, and hashing produces a deterministic root that changes only along modified paths.',
        {
          type: 'diagram',
          text: 'Key: 0xCAFE...  (hashed address)\nNibbles: C, A, F, E, ...\n\n  root\n   |-- nibble C --> extension [A, F] --> branch\n                                          |-- nibble E --> leaf (account data)\n                                          |-- nibble 3 --> leaf (different account)\n\nInserting a key starting with C, A, F, 7:\n  The branch at [C, A, F] gains a new child at slot 7.\n  Only the branch node, the extension, and the root are rehashed.\n  Everything else is untouched.',
          label: 'Path compression skips the 62 nibbles where only one key exists; hashing propagates changes upward',
        },
        'The root is deterministic because the trie layout depends only on the set of keys and values, not on insertion order. Two nodes that process the same transactions in the same order produce identical tries with identical roots. If a single storage slot changes, only the nodes on its nibble path are rewritten and rehashed -- typically 8-12 nodes out of hundreds of millions.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Ethereum uses four node types, RLP encoding, and Keccak-256 hashing to build the trie.',
        {
          type: 'table',
          headers: ['Node type', 'Structure', 'Purpose'],
          rows: [
            ['Branch', '17-element array: 16 child slots (one per nibble 0-F) + 1 value slot', 'Fanout -- routes the path based on the next nibble'],
            ['Extension', '[encoded-path, child-reference]', 'Compression -- skips a shared prefix of nibbles to avoid single-child chains'],
            ['Leaf', '[encoded-path, value]', 'Termination -- stores the remaining key suffix and the account/storage data'],
            ['Hash reference', '32-byte Keccak digest', 'Commitment -- replaces any node whose RLP encoding exceeds 32 bytes'],
          ],
        },
        'The key pipeline: take a 20-byte account address, hash it with Keccak-256 to get a 32-byte "secure key," then split the secure key into 64 nibbles (each nibble is 4 bits, values 0-F). The nibble sequence is the path through the trie.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Secure key derivation\nconst address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";\nconst secureKey = keccak256(address);\n// secureKey = 0x1c5e3a7b...  (32 bytes, 64 nibbles)\n// nibbles  = [1, c, 5, e, 3, a, 7, b, ...]\n\n// Path traversal pseudocode\nfunction get(root, nibbles) {\n  let node = db.load(root);\n  let i = 0;\n  while (i < nibbles.length) {\n    if (node.type === "branch") {\n      node = db.load(node.children[nibbles[i]]);\n      i += 1;\n    } else if (node.type === "extension") {\n      // extension.path must match the next nibbles\n      assert(nibbles.slice(i, i + node.path.length) === node.path);\n      node = db.load(node.child);\n      i += node.path.length;\n    } else if (node.type === "leaf") {\n      assert(nibbles.slice(i) === node.path);\n      return node.value;  // account: [nonce, balance, storageRoot, codeHash]\n    }\n  }\n}',
        },
        'Ethereum nests tries. The global state trie maps account addresses to account records. Each contract account record contains a storageRoot field that points to a separate storage trie mapping 32-byte storage slots to 32-byte values. Block headers also carry separate roots for transactions and receipts.',
        {
          type: 'diagram',
          text: 'Block header fields:\n  stateRoot   ---> state trie ---> account record\n                                     |-- nonce\n                                     |-- balance\n                                     |-- storageRoot ---> storage trie ---> slot values\n                                     |-- codeHash\n  transactionsRoot ---> tx trie ---> encoded transactions\n  receiptsRoot     ---> receipt trie ---> logs, gas used, status',
          label: 'A single block header commits to four separate tries through three root hashes',
        },
        'Proof construction: to prove an account value, the full node collects every encoded node on the path from the state root to the target leaf. The proof is just the list of RLP-encoded nodes. The verifier decodes each node, follows the nibble path, hashes each node with Keccak-256, and checks that each hash matches the child reference in the parent. If the chain reaches the root, the value is authentic.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three properties working together.',
        {
          type: 'bullets',
          items: [
            'Determinism: the trie layout is a pure function of the key-value contents and the encoding rules. No insertion-order dependence, no randomness, no tie-breaking. Two nodes with the same state produce the same root byte-for-byte.',
            'Collision resistance: Keccak-256 makes it computationally infeasible to find two different nodes that hash to the same digest. A parent that commits to a child hash commits to exactly one child content.',
            'Path integrity: the nibble path is derived from the key hash. A verifier consuming nibbles and matching them against extension/leaf paths cannot be redirected to a different key without breaking the hash chain.',
          ],
        },
        {
          type: 'quote',
          text: 'The trie requires that the key-value binding set stored in the trie is uniquely determined by the single root hash.',
          attribution: 'Ethereum Yellow Paper (Section 4.1)',
        },
        'If any node is tampered with -- a value changed, a nibble path altered, a child reference swapped -- the Keccak hash of that node changes. That change propagates upward: every ancestor recomputes a different hash until the root changes. A valid proof under root R proves that the value existed in the exact state committed by R. A forged proof under root R would require finding a Keccak collision.',
        'Path compression (extension nodes) preserves determinism because the compressed path is stored inside the node and included in its hash. The trie cannot silently skip nibbles -- the extension node declares exactly which nibbles it skips, and that declaration is part of the commitment.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'What drives it'],
          rows: [
            ['Lookup', 'O(64) nibble steps, ~8-12 DB reads', 'Key length is fixed at 64 nibbles; compression reduces actual node fetches'],
            ['Insert/Update', 'O(64) in theory, ~8-12 node writes + rehashes', 'Only the nodes on the modified path are rewritten'],
            ['Proof size', '~1-3 KB for one account', 'Each node on the path is included; branch nodes are 532 bytes RLP-encoded'],
            ['State size', '~80 GB (mainnet 2024)', 'Every unique node is stored; historical state multiplies this further'],
            ['Write amplification', '~8-12x per key update', 'Each touched node is re-encoded, rehashed, and written to the DB'],
          ],
        },
        'The practical bottleneck is database I/O. Each node lookup is a LevelDB or PebbleDB read with a 32-byte hash key. Branch nodes are large (up to 532 bytes RLP-encoded), and the working set rarely fits in cache during block processing. Client teams spend enormous engineering effort on node caching, batch writes, and pruning strategies.',
        {
          type: 'note',
          text: 'Updating one key rewrites ~8-12 nodes. A block with 200 transactions touching 1,000 distinct keys rewrites ~8,000-12,000 nodes. At ~200 bytes average per node, that is 1.6-2.4 MB of database writes per block, every 12 seconds. State growth means the trie never shrinks even when accounts are emptied -- tombstone nodes persist until garbage collection.',
        },
        'Proof size is the other cost that matters at scale. An MPT proof for one account is roughly 1-3 KB (the encoded nodes on one path). For a bridge verifying 100 accounts, that is 100-300 KB of proof data. Verkle trees, Ethereum\'s planned replacement, reduce proof size to roughly 150 bytes per account by using polynomial commitments instead of hash-based inclusion.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A light client wants to verify that account 0xd8dA...6045 has a balance of 1.5 ETH at block 19,000,000.',
        {
          type: 'diagram',
          text: 'Step 1: Obtain block header #19000000 from a trusted source\n  header.stateRoot = 0x7a8b...3c4f  (32 bytes, trusted)\n\nStep 2: Request proof from a full node\n  eth_getProof(0xd8dA...6045, [], 19000000)\n  Response: [\n    node0: branch [16 children + value]  (RLP ~400 bytes)\n    node1: extension [path: "c5e3", child: 0xab...]  (RLP ~40 bytes)\n    node2: branch [16 children + value]  (RLP ~450 bytes)\n    node3: leaf [path: "a7b9...remaining", value: RLP(account)]  (RLP ~120 bytes)\n  ]\n\nStep 3: Verify\n  hash(node3) == node2.children[nibble] ?  yes\n  hash(node2) == node1.child ?              yes\n  hash(node1) == node0.children[nibble] ?  yes\n  hash(node0) == header.stateRoot ?         yes\n  => account data is authentic under stateRoot 0x7a8b...3c4f',
          label: 'Four encoded nodes, four hash checks, one trusted root',
        },
        {
          type: 'code',
          language: 'javascript',
          text: '// Simplified proof verification\nfunction verifyProof(stateRoot, key, proofNodes) {\n  const nibbles = toNibbles(keccak256(key)); // 64 nibbles\n  let expectedHash = stateRoot;\n  let nibbleIndex = 0;\n\n  for (const encodedNode of proofNodes) {\n    // Check: does this node hash to what the parent committed?\n    if (keccak256(encodedNode) !== expectedHash) {\n      return { valid: false, reason: "hash mismatch" };\n    }\n    const node = rlpDecode(encodedNode);\n\n    if (node.length === 17) {\n      // Branch node: follow the next nibble\n      expectedHash = node[nibbles[nibbleIndex]];\n      nibbleIndex += 1;\n    } else if (node.length === 2) {\n      const { path, isLeaf } = decodeHexPrefix(node[0]);\n      if (isLeaf) {\n        // Leaf: remaining path must match, return value\n        if (matchPath(nibbles, nibbleIndex, path)) {\n          return { valid: true, value: rlpDecode(node[1]) };\n        }\n        return { valid: false, reason: "path mismatch at leaf" };\n      } else {\n        // Extension: consume shared path, follow child\n        if (!matchPath(nibbles, nibbleIndex, path)) {\n          return { valid: false, reason: "path mismatch at extension" };\n        }\n        nibbleIndex += path.length;\n        expectedHash = node[1];\n      }\n    }\n  }\n  return { valid: false, reason: "proof too short" };\n}',
        },
        'The light client never downloaded the state database. It verified one account with four encoded nodes (~1 KB total) and one trusted root hash. If the full node had altered the balance, the leaf hash would change, breaking the chain at node2.',
        {
          type: 'note',
          text: 'Absence proofs work similarly. If the requested key does not exist, the proof leads to a branch node with an empty child at the expected nibble, or to a leaf/extension whose path diverges from the requested key. The verifier confirms that the trie has no entry at that path under the given root.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Consumer', 'What they prove', 'Trust anchor', 'Failure risk'],
          rows: [
            ['Light client (Helios, Lodestar)', 'Account balance, nonce, code', 'Beacon chain finalized header', 'Stale root if sync lags finality'],
            ['Cross-chain bridge', 'Token balance on source chain', 'Relayed header or oracle', 'Fake header = forged proof; oracle compromise'],
            ['Indexer (Etherscan, Dune)', 'Spot-check RPC responses', 'Local full node header', 'Missing history if node is pruned'],
            ['Smart contract (on-chain verifier)', 'Storage slot in another contract', 'block.stateRoot (EVM opcode)', 'Gas cost ~200K+ for on-chain RLP decode + Keccak'],
            ['State sync (snap sync)', 'Bulk account ranges', 'Pivot block state root', 'Incomplete sync if peers drop'],
          ],
        },
        'The common pattern: a party that cannot or should not store the full state needs to verify one fact about it. The MPT proof is the mechanism. The trust anchor is always a block header, and the proof is only as trustworthy as the header source.',
        {
          type: 'note',
          text: 'EIP-1186 (eth_getProof) standardized the JSON-RPC method for requesting MPT proofs. Before it, light clients had to reconstruct proofs from raw node data. The standard made proof-based verification practical for wallets, bridges, and off-chain verifiers.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Proof size: an MPT inclusion proof for one account is 1-3 KB. Proving 1,000 accounts for a state sync or bridge checkpoint means 1-3 MB of proof data. Verkle proofs for the same 1,000 accounts would be roughly 150 KB. The polynomial commitment structure amortizes witness cost across multiple keys.',
            'State bloat: every account ever created adds nodes to the trie. Ethereum mainnet state exceeds 80 GB. Empty accounts (zero balance, no code, no storage) still occupy trie nodes unless explicitly cleaned, and cleanup itself costs gas.',
            'Write amplification: updating one storage slot rewrites the full path of nodes, re-encodes them in RLP, and rehashes each one. Under heavy DeFi activity, a single block can trigger tens of thousands of node writes. Client implementors build custom caching layers (Geth\'s snapshot layer, Erigon\'s flat database) to absorb this.',
            'Implementation complexity: the encoding rules are consensus-critical. RLP encoding, hex-prefix path encoding, the leaf terminator flag (0x20), branch value slots, embedded short nodes (RLP < 32 bytes stored inline rather than hashed), and empty-node semantics are all sources of implementation bugs. A verifier that mishandles one edge case can accept a forged state claim.',
            'Root trust is external: the trie proves nothing about whether the root is canonical, finalized, or safe. A valid proof under a reorged or forged root proves the wrong world. Bridges and light clients need a separate consensus-trust mechanism.',
          ],
        },
        {
          type: 'table',
          headers: ['Problem', 'MPT cost', 'Verkle tree cost', 'Improvement factor'],
          rows: [
            ['Single-account proof', '~1-3 KB', '~150 bytes', '~10-20x smaller'],
            ['1,000-account proof', '~1-3 MB', '~150 KB', '~10-20x smaller'],
            ['Stateless block witness', '~1-2 MB', '~100-200 KB', '~10x smaller'],
            ['Node storage overhead', 'High (hash references everywhere)', 'Lower (commitments compress)', 'Moderate'],
          ],
        },
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Use a mature client library for production. EthereumJS (@ethereumjs/trie), Go-Ethereum (trie package), and Reth (alloy-trie) have been battle-tested against consensus. Rolling your own RLP + hex-prefix encoder is a bug farm.',
            'Test against the Ethereum Foundation\'s official test vectors (ethereum/tests repository, TrieTests directory). These cover insertion ordering, deletion, branch collapsing, extension splitting, and proof of absence.',
            'Separate header trust from proof verification. The proof checker answers "does value V exist under root R?" It cannot answer "is R the canonical finalized state root?" Header trust comes from the consensus layer -- beacon chain sync committee signatures for post-merge Ethereum.',
            'Profile database I/O, not hash computation. Keccak-256 is fast (~500 MB/s on modern CPUs). The bottleneck is random LevelDB reads for each node on the path. Batch reads, node caching, and flat-storage overlays dominate real client performance work.',
            'Handle proof-of-absence explicitly. A key that does not exist in the trie produces a proof that ends at a divergence point -- a branch with an empty child or an extension/leaf whose path does not match. The verifier must accept this as a valid "not found" answer, not treat it as an error.',
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: 'Hex-prefix encoding (consensus-critical detail):\n\n  nibbles [1, 2, 3]     + leaf flag --> 0x20 | (0x10 for odd length) | first nibble\n  even leaf:   [1, 2, 3, 4]  --> [0x20, 0x12, 0x34]\n  odd leaf:    [1, 2, 3]      --> [0x31, 0x23]\n  even ext:    [1, 2, 3, 4]  --> [0x00, 0x12, 0x34]\n  odd ext:     [1, 2, 3]      --> [0x11, 0x23]\n\n  The first nibble of the encoded byte encodes two flags:\n    bit 1 (0x20): 1 = leaf, 0 = extension\n    bit 0 (0x10): 1 = odd number of nibbles (first nibble packed into this byte)\n  Getting this wrong means a leaf is decoded as an extension or vice versa.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Ethereum Yellow Paper, Appendix D', 'Formal specification of the Modified Merkle Patricia Trie, RLP encoding, hex-prefix encoding. https://ethereum.github.io/yellowpaper/paper.pdf'],
            ['ethereum.org Patricia Merkle Trie docs', 'Illustrated walkthrough of node types, encoding, and proof verification. https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/'],
            ['EthereumJS trie implementation', 'Production TypeScript implementation with proof generation and verification. https://github.com/ethereumjs/ethereumjs-monorepo/tree/master/packages/trie'],
            ['Vitalik Buterin, "Merkling in Ethereum" (2015)', 'Design rationale for choosing MPT over alternatives. https://blog.ethereum.org/2015/11/15/merkling-in-ethereum'],
            ['EIP-1186: eth_getProof', 'JSON-RPC standard for requesting Merkle-Patricia proofs from a node. https://eips.ethereum.org/EIPS/eip-1186'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Merkle Tree for the hash-upward commitment pattern and PATRICIA Trie for the radix-based path compression that MPT extends.',
            'Encoding layer: study RLP Encoding to understand the serialization that makes node hashing deterministic and consensus-compatible.',
            'Evolution: study Verkle Trees to see how polynomial commitments replace hash-based witnesses for smaller proofs, which is Ethereum\'s planned MPT replacement.',
            'Contrast: study Hash Array Mapped Trie (HAMT) for a different approach to hash-based persistent maps, used in Clojure and IPFS but without the cryptographic commitment property.',
            'Application: study Git Internals for another system that uses Merkle-style content addressing (tree objects, blob hashes) for a different purpose -- version control instead of consensus state.',
          ],
        },
      ],
    },
  ],
};
