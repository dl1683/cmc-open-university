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
      heading: 'Why This Exists',
      paragraphs: [
        'Ethereum needs every block to commit to a huge changing key-value database. Full nodes can store the database. A block header cannot. The header needs one compact value that says, in effect, this is the exact account state after this block.',
        'That value is the state root. It must change when any committed account or storage value changes. It must let a verifier check one account or one storage slot without downloading the whole database. Ethereum uses a modified Merkle-Patricia trie because it combines key-directed lookup, prefix compression, and cryptographic commitments.',
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        'A normal hash table is good at finding account records, but it does not produce a small proof that a remote answer is honest. A flat Merkle tree is good at committing to a list, but Ethereum state is not just a list. It is a sparse map keyed by account addresses and contract storage slots.',
        'A plain trie gives key paths and prefix sharing, but by itself it is just a data structure, not a cryptographic commitment. The wall is needing all three properties at once: map lookup by key, compact paths for a sparse space, and a root hash that commits to every reachable node.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'Turn each key into a path of nibbles, where a nibble is half a byte and has 16 possible values. Use branch nodes when paths split. Use extension nodes to compress long shared stretches. Use leaf nodes to hold the final suffix and value. Then encode each node and hash upward until one root digest remains.',
        'The root is deterministic under the same key-value contents and encoding rules. If a value changes, the leaf changes. If the leaf changes, its parent reference changes. That change propagates up the path until the state root changes. A small local update becomes visible in one global commitment.',
      ],
    },
    {
      heading: 'Reading the Views',
      paragraphs: [
        'In the state root view, read left to right: key, secure hash, nibble path, branch or compressed path nodes, leaf value, and root hash. The point is that Ethereum is not hashing a whole state file every time. It is rewriting and rehashing the paths touched by changed keys.',
        'In the proof path view, start from the trusted root and walk downward through encoded nodes supplied by the proof. Each step consumes part of the requested key path and recomputes a hash. The verifier accepts only if the path, value, and digest chain line up with the root it already trusts.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'Ethereum first uses hashed keys for secure tries, then reads the hash as a sequence of nibbles. A branch node has 16 child positions plus an optional value slot. An extension node stores a shared path segment and points to the next node. A leaf node stores the remaining path suffix and the value. Short embedded nodes and hash references are implementation details, but the idea is the same: parent nodes commit to child nodes.',
        'Accounts live under the global state trie. Contract storage has its own trie, and the account record carries that storage root. Blocks also carry roots for transactions and receipts. These roots let a block header commit to several structured datasets without carrying the datasets themselves.',
        'A proof is a package of encoded nodes along one path. The verifier starts from a trusted root, decodes the first node, checks the relevant path piece, hashes the node, and compares that hash to the expected reference. It repeats until it reaches the claimed value or proves the path is absent.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'Verification is local, but trust is anchored by the root. The verifier does not need the entire state database. It only needs the nodes that sit on the requested path and the root hash from a block header it trusts. If any encoded node, child reference, path segment, or value is tampered with, the recomputed digest chain will not match.',
        'Path compression keeps sparse keys from producing enormous one-child chains. Hashing keeps compressed paths honest. The trie can skip over boring stretches, but it cannot hide what those stretches are because the encoded node is part of the hash commitment.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Suppose a light client wants to check an account balance at a particular block. It obtains the block header through whatever trust path it uses, then asks a full node for a proof for that account key. The full node returns the encoded trie nodes on the hashed key path, ending in the account record or in a proof of absence.',
        'The light client does not trust the full node. It decodes the proof, consumes the account-key nibbles, hashes each node, and compares the final reconstructed root with the state root in the header. If they match, the account value belongs to that state root. If they do not, the proof is wrong or targets a different root.',
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        'The Merkle-Patricia trie is a correctness structure first and a performance structure second. It pays for hashing, node encoding, database reads, path decoding, cache pressure, and write amplification. Updating one key rewrites the nodes and hashes along that key path, and real clients spend a lot of engineering effort making that affordable.',
        'Proofs are also not free. They can be large compared with newer authenticated-tree designs, and state growth makes node storage and pruning hard. These costs are why Ethereum research and roadmap work has explored Verkle trees and other commitment schemes for smaller proofs and better state access.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'It wins when a protocol needs a compact commitment to a large mutable map. Block headers can carry roots. Light clients can verify selected accounts or storage slots. Bridges and auditors can check inclusion or absence relative to a trusted header. Indexers can spot-check remote data instead of blindly trusting it.',
        'It also gives the protocol a clean mental model: the root is the fingerprint of the committed state. If two nodes agree on the state root for a block, they agree on the authenticated state contents behind that root, assuming the same trie rules and database availability.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'A proof is only as good as the root. If the verifier accepts a fake or non-canonical header, a perfectly valid proof can still prove the wrong world. Bridges, light clients, and indexers need a separate answer for header trust and consensus finality.',
        'The trie also fails as a simple performance story. It is complex to implement, easy to get wrong at encoding boundaries, and expensive under heavy state growth. It solves authenticated state, not every storage problem.',
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        'Use a mature client library for production proofs. The details that look small are consensus details: RLP encoding, hex-prefix path encoding, the leaf terminator flag, branch value slots, embedded short nodes, empty values, and proof of absence. A verifier that accepts one malformed path can accept a false state claim.',
        'Keep header trust separate from trie verification. The proof checker can say that a value belongs under a given state root. It cannot say that the state root is canonical, finalized, or safe for a bridge by itself. Test inclusion and absence proofs against known client vectors before trusting remote full nodes.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: ethereum.org Merkle Patricia Trie docs at https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/, Ethereum yellow paper at https://ethereum.github.io/yellowpaper/paper.pdf, and EthereumJS trie repository at https://github.com/ethereumjs/merkle-patricia-tree. Study Merkle Tree, PATRICIA Trie, Hash Array Mapped Trie (HAMT), Git Internals, and Byzantine Generals next.',
      ],
    },
  ],
};
