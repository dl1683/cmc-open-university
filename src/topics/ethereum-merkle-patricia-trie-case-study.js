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
      heading: 'What it is',
      paragraphs: [
        'Ethereum uses a modified Merkle-Patricia trie as an authenticated key-value map. The trie stores account state, contract storage, transactions, and receipts in forms whose roots are committed in block headers or account fields. It combines the path-sharing of PATRICIA Trie with the cryptographic commitment of Merkle Tree.',
        'The structure is deterministic and verifiable. If two tries contain the same key-value pairs, they produce the same root. If a value, path, or encoded node changes, hashes on the path change and the root changes. That root is the compact fingerprint other participants can compare or verify against.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Keys are transformed into nibble paths. Branch nodes provide 16-way fanout plus an optional value slot. Extension nodes compress shared path segments. Leaf nodes store the remaining suffix and value. Nodes are encoded and hashed, so a parent can refer to a child by digest. This gives the map both trie lookup and Merkle proof behavior.',
        'A proof carries the encoded nodes needed for one key path. A verifier starts from a trusted root, decodes a node, checks that the requested path matches the branch or extension, hashes the node, and compares the result to the parent reference. If the path reaches the claimed leaf and every digest matches, the value is proven relative to the root.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Merkle-Patricia tries are not simple in-memory maps. They pay for cryptographic verification with hashing, encoding, node database reads, path compression rules, and update write amplification. Updating one key rewrites hashes along its path. The payoff is that clients can verify small proofs instead of trusting a remote database or downloading all state.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Ethereum block headers include roots for state, transactions, and receipts. Account records can include storage roots for contract storage. EthereumJS describes the modified Merkle Patricia tree as a persistent data structure mapping arbitrary-length binary data, with the protocol requirement of producing a single 32-byte value identifying the key-value set.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The root hash proves a state relative to a trusted header; it does not by itself prove that the header is canonical. Bridges, light clients, and indexers must still decide which headers to trust. Another misconception is that the trie is chosen mainly for speed. It is chosen for authenticated state and proofs, while performance work happens around caching, batching, pruning, snapshotting, and alternative trees.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ethereum.org Merkle Patricia Trie docs at https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/, Ethereum yellow paper at https://ethereum.github.io/yellowpaper/paper.pdf, and EthereumJS trie repository at https://github.com/ethereumjs/merkle-patricia-tree. Study Merkle Tree, PATRICIA Trie, Hash Array Mapped Trie (HAMT), Git Internals, and Byzantine Generals next.',
      ],
    },
  ],
};
