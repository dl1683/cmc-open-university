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
    explanation: 'A stateless client does not keep the whole state database. It receives a block plus a witness for the state touched by that block, then verifies the witness against a trusted root.',
    invariant: 'The witness replaces local state for verification, not consensus trust.',
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
    explanation: 'A Merkle proof carries sibling hashes. Ethereum Merkle-Patricia proofs carry encoded path nodes. A Verkle proof uses vector commitments so one proof can cover many parent-child openings more compactly.',
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
    explanation: 'Instead of sending every sibling commitment at a wide node, a Verkle witness proves that selected positions in the committed vector contain the claimed child commitments or values.',
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
    explanation: 'The chart is illustrative, not a rollout claim. The important shape is that vector-commitment witnesses aim to grow much more slowly than Merkle-Patricia witnesses for block-scale state access.',
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
    explanation: 'Verkle trees move complexity from sending many hashes into proving openings of committed vectors. That is a real trade, not free compression.',
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
    explanation: 'The stateless-client idea shifts state availability into witnesses. That affects block builders, peers, execution clients, and gas/accounting rules around state access.',
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
    explanation: 'Merkle trees are simple and robust. Merkle-Patricia tries give Ethereum authenticated key-value state. Verkle trees target a different bottleneck: witness size for stateless validation.',
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
    explanation: 'The clean mental model: Verkle trees are an authenticated-data-structure upgrade intended to make witnesses small enough for stateless or near-stateless validation, with new proving and migration costs.',
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
      heading: 'What it is',
      paragraphs: [
        'A Verkle tree is an authenticated tree that uses vector commitments instead of only hash links. The purpose in Ethereum research is to shrink witnesses so clients can verify state transitions without storing the entire state database locally. This is why the topic appears in stateless-client roadmaps rather than as a generic faster map.',
        'The contrast with Ethereum Merkle-Patricia Trie Case Study is the proof shape. In a Merkle-style tree, a verifier needs sibling hashes or encoded path nodes. In a Verkle tree, a node commits to a vector of many children, and a proof opens selected positions in that committed vector. KZG Polynomial Commitments are the natural next primer for understanding how compact algebraic openings differ from hash paths.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At a high level, a Verkle node stores a commitment to a wide vector. A witness for a key path contains the values or child commitments being opened, plus cryptographic proof material showing those openings are consistent with the root commitment. The verifier checks the proof against the trusted root and the claimed path/value.',
        'Wide fanout shortens paths, and vector commitments avoid sending every sibling at every level. Multiproofs can aggregate openings for many accessed keys. The result is aimed at block-level state witnesses: a block can carry the state evidence needed for validation instead of assuming every validator has the whole state on disk.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Verkle trees trade witness bytes for cryptographic proving and verification complexity. They also require careful state layout, migration planning, gas/accounting changes, client implementation work, and robust proof libraries. The right comparison is not "Verkle is faster than Merkle" in every dimension; it is "Verkle changes the bottleneck from large sibling/path witnesses toward vector-commitment proof work."',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'The ethereum.org roadmap describes Verkle trees as a critical step toward stateless Ethereum clients, where witnesses accompany blocks so clients need not store the full state database. Ethereum Foundation material discusses a 256-wide tree structure and the commitment-size constraints that follow from the selected cryptographic field. Research comparisons also examine Verkle trees against binary Merkle trees with SNARKs for statelessness.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A Verkle proof does not decide which root is canonical; consensus or header verification still supplies trust in the root. It also does not make state vanish. Someone must build, serve, and retain state or witnesses. Finally, roadmap status matters: treat Verkle trees as an evolving authenticated-data-structure direction, not as a completed migration unless current client documentation says so.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ethereum.org Verkle roadmap at https://ethereum.org/roadmap/verkle-trees/, Vitalik Buterin explanation at https://vitalik.eth.limo/general/2021/06/18/verkle.html, Ethereum Foundation structure post at https://blog.ethereum.org/2021/12/02/verkle-tree-structure, and a 2025 statelessness benchmark at https://arxiv.org/html/2504.14069v1. Study KZG Polynomial Commitment Opening Case Study, Merkle Tree, Ethereum Merkle-Patricia Trie Case Study, PATRICIA Trie, Byzantine Generals, and Git Internals next.',
      ],
    },
  ],
};
