// Verkle trees: vector commitments replace sibling-hash bundles so state
// witnesses can be small enough for stateless-client designs.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'verkle-trees-stateless-clients',
  title: 'Verkle Trees & Stateless Clients',
  category: 'Systems',
  summary: 'A roadmap authenticated-tree primer: wide vector-commitment nodes shrink state witnesses so clients can verify without storing all state.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['witness shape', 'tradeoff map'], defaultValue: 'witness shape' },
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

function* witnessShape() {
  yield {
    state: graphState({
      nodes: [
        { id: 'block', label: 'block', x: 0.8, y: 4.0, note: 'accesses' },
        { id: 'witness', label: 'witness', x: 2.6, y: 4.0, note: 'paths' },
        { id: 'commit', label: 'commit', x: 4.5, y: 4.0, note: 'vector' },
        { id: 'root', label: 'root', x: 6.4, y: 4.0, note: 'trusted' },
        { id: 'client', label: 'client', x: 8.4, y: 4.0, note: 'stateless' },
      ],
      edges: [
        { id: 'e-block-witness', from: 'block', to: 'witness' },
        { id: 'e-witness-commit', from: 'witness', to: 'commit' },
        { id: 'e-commit-root', from: 'commit', to: 'root' },
        { id: 'e-root-client', from: 'root', to: 'client' },
      ],
    }, { title: 'A stateless client verifies a block with a witness' }),
    highlight: { active: ['witness', 'commit'], found: ['client'] },
    explanation: `A ${5}-stage verification pipeline: a stateless client does not keep the whole state database. It receives a block plus a witness for the state touched by that block, then verifies the witness against a ${'trusted'} root.`,
    invariant: `The witness replaces local state for verification, not consensus trust — the endpoint is ${'stateless'}.`,
  };

  yield {
    state: labelMatrix(
      'Merkle proof versus Verkle proof',
      [
        { id: 'merkle', label: 'Merkle' },
        { id: 'mpt', label: 'MPT' },
        { id: 'verkle', label: 'Verkle' },
      ],
      [
        { id: 'proof', label: 'proof carries' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['sibling hashes', 'per level'],
        ['encoded path nodes', 'large'],
        ['commitment proof', 'compact'],
      ],
    ),
    highlight: { found: ['verkle:proof', 'verkle:shape'], compare: ['mpt:shape'] },
    explanation: `Comparing ${3} tree types: a Merkle proof carries sibling hashes, Ethereum Merkle-Patricia proofs carry encoded path nodes, and a Verkle proof uses vector commitments so one proof can cover many parent-child openings more ${'compact'}ly.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'root', label: 'root', x: 0.8, y: 4.0, note: 'C0' },
        { id: 'c17', label: 'child 17', x: 2.8, y: 4.0, note: 'open' },
        { id: 'c99', label: 'child 99', x: 4.8, y: 4.0, note: 'open' },
        { id: 'proof', label: 'proof', x: 6.8, y: 4.0, note: 'batched' },
        { id: 'ok', label: 'verify', x: 8.6, y: 4.0, note: 'root ok' },
      ],
      edges: [
        { id: 'e-root-c17', from: 'root', to: 'c17' },
        { id: 'e-root-c99', from: 'root', to: 'c99' },
        { id: 'e-c99-proof', from: 'c99', to: 'proof' },
        { id: 'e-proof-ok', from: 'proof', to: 'ok' },
      ],
    }, { title: 'A vector commitment opens selected child positions' }),
    highlight: { active: ['root', 'proof'], found: ['ok'], compare: ['c17', 'c99'] },
    explanation: `Instead of sending every sibling commitment at a wide node, a Verkle witness uses a ${'batched'} proof to show that selected positions in the committed vector contain the claimed child commitments — here opening ${2} children from the root.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'state accesses in block', min: 1, max: 6000 }, y: { label: 'relative witness bytes', min: 0, max: 100 } },
      series: [
        { id: 'mpt', label: 'hexary MPT', points: [{ x: 1, y: 8 }, { x: 1000, y: 40 }, { x: 3000, y: 72 }, { x: 6000, y: 100 }] },
        { id: 'verkle', label: 'Verkle-style', points: [{ x: 1, y: 2 }, { x: 1000, y: 8 }, { x: 3000, y: 14 }, { x: 6000, y: 24 }] },
      ],
    }),
    highlight: { found: ['verkle'], compare: ['mpt'] },
    explanation: `The chart is illustrative, not a rollup claim. At ${6000} state accesses the Verkle-style witness reaches only ${24}% of relative bytes versus ${100}% for hexary MPT — vector-commitment witnesses grow much more slowly at block scale.`,
  };
}

function* tradeoffMap() {
  yield {
    state: labelMatrix(
      'Verkle design levers',
      [
        { id: 'fanout', label: 'wide fanout' },
        { id: 'commit', label: 'commitment' },
        { id: 'batch', label: 'batch proof' },
        { id: 'state', label: 'state layout' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['short paths', 'wide nodes'],
        ['small witness', 'crypto work'],
        ['many opens', 'prover cost'],
        ['stateless route', 'migration'],
      ],
    ),
    highlight: { active: ['commit:benefit', 'batch:benefit'], compare: ['commit:cost', 'state:cost'] },
    explanation: `Across ${4} design levers, Verkle trees move complexity from sending many hashes into proving openings of committed vectors — each lever has a ${'benefit'} and a ${'cost'}, a real trade, not free compression.`,
  };

  yield {
    state: labelMatrix(
      'Client responsibilities',
      [
        { id: 'full', label: 'full node' },
        { id: 'stateless', label: 'stateless' },
        { id: 'builder', label: 'block builder' },
        { id: 'network', label: 'network' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'sends', label: 'sends/checks' },
      ],
      [
        ['state db', 'root'],
        ['little/no state', 'witness'],
        ['state access', 'witness data'],
        ['headers+blocks', 'payload size'],
      ],
    ),
    highlight: { found: ['stateless:stores', 'stateless:sends'], active: ['builder:sends'] },
    explanation: `The stateless-client idea shifts state availability into witnesses — a stateless node stores ${'little/no state'} and checks ${'witness'} data. That affects all ${4} client roles: block builders, peers, execution clients, and gas/accounting rules.`,
  };

  yield {
    state: labelMatrix(
      'Compare authenticated trees',
      [
        { id: 'merkle', label: 'Merkle tree' },
        { id: 'mpt', label: 'MPT' },
        { id: 'verkle', label: 'Verkle' },
      ],
      [
        { id: 'commit', label: 'commitment' },
        { id: 'best', label: 'best at' },
      ],
      [
        ['hash pair', 'simple proofs'],
        ['hash trie', 'Ethereum today'],
        ['vector commit', 'small witnesses'],
      ],
    ),
    highlight: { active: ['verkle:commit', 'verkle:best'], compare: ['merkle:best', 'mpt:best'] },
    explanation: `${3} authenticated tree families compared: Merkle trees are simple and robust, Merkle-Patricia tries give Ethereum authenticated key-value state, and Verkle trees target a different bottleneck — ${'small witnesses'} for stateless validation.`,
  };

  yield {
    state: labelMatrix(
      'Misreadings to avoid',
      [
        { id: 'done', label: 'rollout' },
        { id: 'trust', label: 'trust' },
        { id: 'size', label: 'state size' },
        { id: 'speed', label: 'speed' },
      ],
      [
        { id: 'wrong', label: 'wrong read' },
        { id: 'clean', label: 'clean read' },
      ],
      [
        ['already done', 'roadmap work'],
        ['proof replaces consensus', 'root still trusted'],
        ['state disappears', 'witness changes'],
        ['always faster', 'different bottleneck'],
      ],
    ),
    highlight: { removed: ['done:wrong', 'trust:wrong', 'size:wrong'], found: ['done:clean', 'trust:clean'] },
    explanation: `${4} common misreadings contrasted — ${'wrong read'} versus ${'clean read'}: Verkle trees are an authenticated-data-structure upgrade intended to make witnesses small enough for stateless or near-stateless validation, with new proving and migration costs.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'witness shape') yield* witnessShape();
  else if (view === 'tradeoff map') yield* tradeoffMap();
  else throw new InputError('Pick a Verkle view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The witness-shape view follows a block, the state values it touches, a witness, a vector commitment, and a stateless client. A stateless client verifies a block without storing the whole state database locally.',
        {
          type: 'callout',
          text: 'Verkle trees keep the authenticated-state guarantee but replace sibling-hash bundles with compact vector-commitment openings.',
        },
        'Active nodes are proof material currently being checked, found nodes are claims established against the trusted root, and compare nodes contrast Merkle-Patricia proofs with Verkle proofs. The safe inference is that a client can trust an opened value only if the proof verifies against a state root it already accepts.',
      
        {type: 'image', src: './assets/gifs/verkle-trees-stateless-clients.gif', alt: 'Animated walkthrough of the verkle trees stateless clients visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A blockchain validator normally stores the state needed to check a block: accounts, balances, contract storage, and metadata. As that database grows, the disk requirement raises the cost of running a validating node.',
        'Stateless validation tries to move state storage out of the validator. The block producer sends a witness that proves the values read and written by the block are consistent with a trusted root.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious authenticated structure is a Merkle tree. To prove a leaf value, send the leaf and the sibling hashes along its path, then let the verifier recompute the root.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt: 'Binary Merkle tree with leaf hashes and a top hash', caption: 'Merkle trees anchor each leaf under a root hash, but a proof must carry sibling hashes along the path. Source: Wikimedia Commons, David Goehring, public domain.'},
        'This is simple and robust for one lookup. The proof is easy to audit because changing any leaf or sibling hash changes the recomputed root.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears at block scale. A block can touch hundreds or thousands of state keys, and Merkle-style witnesses carry path material for those accesses.',
        'In a wide trie, each level may require enough sibling or node material that witness bytes become comparable to the block itself. If witnesses are too large to propagate cheaply, stateless clients lose their network advantage.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to commit to a whole vector of children at each node. A vector commitment lets the prover open selected positions without revealing every sibling value.',
        'Verkle trees use high branching factors, commonly 256 children per node, so paths are shallow. A multiproof can batch many openings across the touched nodes, replacing many sibling-hash bundles with compact cryptographic openings.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A key is split into chunks, such as bytes. Each chunk selects one child position in a 256-way node, so a 32-bit key can be represented by four byte choices.',
        'Each internal node stores a commitment to its vector of child commitments or values. A witness contains the opened positions needed by the block and a proof that those openings match the commitments on the path to the trusted root.',
        'The verifier checks the batched proof, recomputes the path commitments, and compares the final root. It does not need the untouched children and does not need to store the state trie.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from binding commitments. If a node commitment is binding, the prover cannot open the same child position to two different values without breaking the cryptographic assumption.',
        'The root ties the whole path together. If every opened child is consistent with its parent commitment and the top commitment equals the trusted state root, then the shown values are exactly the values committed by that root.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Merkle proofs scale with path length and sibling material. Verkle witnesses trade that hash-heavy cost for commitment openings and more expensive cryptographic verification.',
        'Cost behaves differently across actors. Validators store less state and receive smaller witnesses, while block builders must construct witnesses and clients must support the commitment scheme and trusted setup or transparency assumptions of the chosen construction.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The main use is stateless blockchain validation, especially in Ethereum research and roadmap discussions. The goal is to let more machines verify blocks without carrying a full state database.',
        'The same idea belongs to a broader family of authenticated data structures. Whenever a system needs compact proofs about a small subset of a large committed vector, vector commitments are a candidate tool.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Verkle trees are not a free upgrade. They add sophisticated cryptography, migration complexity, new implementation risks, and proof-generation work that simple hash trees avoid.',
        'They also do not remove the need for data availability. A stateless client can verify a witness it receives, but the network still needs some participants to store or serve the underlying state values.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a width-256 tree stores 2 to the 24 keys, so it needs 3 levels because 256 * 256 * 256 equals 2 to the 24. A key 0x11_63_A4 follows child 0x11 at the root, then 0x63, then 0xA4 at the leaf level.',
        'A binary Merkle tree over 2 to the 24 leaves has depth 24, so one proof carries 24 sibling hashes. At 32 bytes per hash, that is 768 bytes before encoding overhead for a single key.',
        'A Verkle proof for the same key opens 3 committed positions plus proof material. For many keys in one block, shared path nodes and batched openings keep the witness from growing as 768 bytes times the number of accesses.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study John Kuszmaul, Verkle Trees; Ethereum research notes on stateless clients and Verkle tree migration; EIP-4762 witness gas analysis; and documentation on polynomial or inner-product vector commitments. These explain the proof-size target and the cryptographic primitive replacing sibling hashes.',
        'Next study Merkle trees, Merkle-Patricia tries, polynomial commitments, KZG commitments, inner-product arguments, data availability sampling, and authenticated dictionaries. The key contrast is proof size versus cryptographic and operational complexity.',
      ],
    },
  ],
};
