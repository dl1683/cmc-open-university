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
    { heading: 'How to read the animation', paragraphs: [
      'The animation follows Ethereum state through a Merkle-Patricia trie, or MPT. A trie is a key-directed tree, a Merkle structure hashes children into parents, and Patricia compression collapses single-child paths. Active nodes are the path selected by the account key, found nodes are hashes or values that prove membership, and compare nodes are sibling choices that a proof must rule out.',
      'The safe inference rule is hash commitment. If a proof node hashes to the value named by its parent, and each path segment matches the searched key, then the final value is committed by the state root. A light client can verify that path without storing the full state database.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Hash_Tree.svg/800px-Hash_Tree.svg.png',
          alt: 'Merkle tree structure with hash nodes forming a binary tree over data blocks',
          caption: 'A Merkle tree: each leaf holds data, each internal node holds the hash of its children. Changing any leaf changes the root hash, providing tamper evidence. The Merkle-Patricia trie adapts this idea from a binary tree over a list to a radix trie over a key-value map. Source: Wikimedia Commons.',
        },
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Ethereum needs every full node to agree on account balances, contract code hashes, nonces, and storage roots after each block. A state root is a single hash in the block header that commits to that whole key-value map. Without a root, a node would need to trust whoever sends an account value.',
        {
          type: 'callout',
          text: 'The state root is the single value that makes Ethereum verifiable without trusting the sender. Without it, every participant would need the full 80+ GB state database to check any claim about any account.',
        },
      'The structure must support updates and proofs. Blocks change only a small fraction of accounts, but every changed account must produce a new root. Light clients and bridges then need compact proof paths from a trusted root to a claimed account or storage slot.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is a hash table from account address to account record. It gives fast lookup for a full node that already has the table. It does not give a canonical root hash or a compact path proof for a verifier that lacks the table.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Patricia_trie.svg/640px-Patricia_trie.svg.png',
          alt: 'PATRICIA trie showing compressed prefix paths and branching nodes',
          caption: 'A PATRICIA trie compresses single-child chains into shared-prefix edges. This is the radix-trie foundation that Ethereum adapts: keys are split into nibbles, shared prefixes are collapsed into extension nodes, and branch points fan out 16 ways. Source: Wikimedia Commons.',
        },
      'A plain Merkle tree over a sorted list solves commitment but makes updates awkward. Inserting one key can shift many positions, changing hashes unrelated to the changed account. A plain trie gives key-directed lookup but does not authenticate the path unless every node is hashed into the root.',
    ] },
    { heading: 'The wall', paragraphs: [
        {
          type: 'callout',
          text: 'The wall is three-dimensional: lookup performance, canonical commitment, and proof compactness must all hold at once. Every obvious structure solves two and fails the third. The Merkle-Patricia trie is Ethereum\'s answer to the three-way constraint.',
        },
      'The hard part is making the map canonical. Two nodes with the same account set must compute the same root byte-for-byte, independent of insertion order or database layout. If roots could differ for the same state, consensus would fail even when balances matched.',
      'The structure also has to handle sparse keys. Ethereum account addresses become hashed keys, which behave like random 64-nibble paths. A naive 16-way trie would have long chains with one child, wasting space and proof bytes.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Hash the account key, split it into nibbles, and store the key-value map in a compressed radix trie whose nodes are content-addressed. A nibble is half a byte, so each step chooses one of 16 possible branches. Extension nodes compress shared path segments, branch nodes represent divergence, and leaf nodes hold final values.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Trie_example.svg/600px-Trie_example.svg.png',
          alt: 'Trie data structure showing key-directed path traversal through character nodes',
          caption: 'A standard trie routes each key character to a child node. Ethereum\'s MPT operates on nibbles (half-bytes, 0-F) instead of characters, producing 16-way branching at each level. Extension nodes compress the long single-child chains that dominate a sparse 64-nibble keyspace. Source: Wikimedia Commons.',
        },
      'The root hash commits to every node below it. Changing one account rewrites the leaf, then each ancestor hash along that key path. Unchanged subtrees keep their hashes, so the update is local even though the root changes globally.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Ethereum first transforms an account address or storage key with Keccak-256. The 32-byte hash becomes 64 nibbles, and traversal follows those nibbles from the root. Branch nodes have 16 child slots plus an optional value slot, while extension and leaf nodes carry encoded path fragments.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Bitcoin_Block_Data.svg/800px-Bitcoin_Block_Data.svg.png',
          alt: 'Block header linking to Merkle root over transactions',
          caption: 'Bitcoin uses a binary Merkle tree over an ordered transaction list. Ethereum extends this idea: block headers carry a state root (the MPT over all accounts), a transactions root, and a receipts root. Each root authenticates a different dimension of the block. Source: Wikimedia Commons.',
        },
      'Nodes are serialized with RLP, Ethereum\'s Recursive Length Prefix encoding, then either embedded directly when small or referenced by hash when large. A proof is the list of encoded nodes along the path. The verifier hashes each encoded node and checks that it matches the reference from the previous node.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Merkle_Tree.svg/800px-Merkle_Tree.svg.png',
          alt: 'Merkle tree diagram showing how leaf changes propagate upward through hash recomputation to the root',
          caption: 'Hash propagation in a Merkle structure: changing any leaf forces recomputation of every hash on the path to the root. In the MPT, this path is determined by the key\'s nibble sequence, so a single account update rewrites only the ~8-12 nodes along that nibble path. Source: Wikimedia Commons.',
        },
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness comes from deterministic routing plus collision-resistant hashing. Deterministic routing means a key has one path under the encoding rules. Hashing means any change to a node changes its hash, and that change propagates to the root.',
      'A membership proof is checked from root to leaf. At each node, the verifier confirms the hash reference and consumes the next matching path fragment. If the final leaf matches the remaining key and value, the proof is valid for that state root.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Lookup cost behaves like the number of trie nodes on the compressed key path. A 64-nibble key has at most 64 branch decisions, but extension nodes often compress long single-child runs. Proof size grows with path length and encoded sibling information, not with the full number of accounts.',
      'Updates are local but write-amplified. If one account change touches 9 nodes on its path, all 9 encoded nodes and hashes must be rewritten even though only one account value changed. When a block changes 2,000 accounts, the trie work is roughly the sum of those path rewrites plus database writes for retained nodes.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'The MPT backs Ethereum account state, contract storage tries, transaction roots, and receipt roots. It lets block headers commit to large maps while proof users verify small claims. The access pattern is keyed lookup and update with authenticated proofs.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Ethereum_logo_2014.svg/400px-Ethereum_logo_2014.svg.png',
          alt: 'Ethereum diamond logo',
          caption: 'The Merkle-Patricia trie is not just one data structure inside Ethereum -- it is the verification backbone. Every light client query, every cross-chain bridge proof, every snap sync range check ultimately bottoms out at an MPT proof against a trusted state root. Source: Wikimedia Commons.',
        },
      'The same design idea appears in authenticated databases and blockchain bridges. A small root travels through a consensus or messaging layer, and a proof shows that a specific key-value claim belongs under that root.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'The MPT is expensive for high-write workloads because hashing and node persistence happen on every changed path. The trie also creates storage growth because historical nodes may remain needed for old blocks, snapshots, or recovery. That is why Ethereum research has explored Verkle tries and other commitment structures.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Blockchain.svg/800px-Blockchain.svg.png',
          alt: 'Blockchain structure showing linked blocks each containing a hash pointer to the previous block',
          caption: 'Each block header contains the state root that commits to the full account trie at that block height. As state grows across blocks, the MPT accumulates nodes -- old nodes from previous states persist in the database even when accounts are emptied, driving the 80+ GB storage footprint. Source: Wikimedia Commons.',
        },
      'It also fails as a general key-value store choice when proof generation is not needed. A normal LSM tree or B-tree can be faster and smaller for local storage. The MPT earns its cost only when remote verification against a root is part of the contract.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose a block changes one account from balance 7 ETH to 9 ETH. The account address hashes to a 64-nibble key, and the current compressed path from root to leaf has 10 encoded nodes. The client rewrites the leaf with the new account record, then recomputes the 9 ancestor hashes back to the root.',
      'A light client later receives a proof with those 10 encoded nodes and a block header containing the state root. It hashes the first proof node and checks that it equals the header root. It then follows each nibble fragment until the leaf proves the account value with balance 9 ETH.',
      'If one byte in the balance is changed back to 7 ETH inside the proof, the leaf hash changes. The parent hash no longer matches its stored child reference, and the mismatch propagates before the verifier reaches the root. The forged proof fails without the verifier knowing the full database.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: the Ethereum.org Merkle Patricia Trie documentation, the Ethereum yellow paper, go-ethereum trie code, and Ethereum research notes on Verkle trie migration. For encoding details, study RLP and hex-prefix compact encoding.',
      'Study next: tries, Merkle trees, content-addressed storage, authenticated data structures, Verkle trees, and sparse Merkle trees. The central lesson is that a root hash can make a large mutable map externally verifiable, but the proof and update costs become part of the system design.',
    ] },
  ],
};
