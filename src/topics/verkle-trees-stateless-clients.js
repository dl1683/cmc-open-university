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
      heading: 'Why this exists',
      paragraphs: [
        'A blockchain client verifies state transitions against a state root. A full node can keep the whole state database locally, but that makes participation heavier as state grows. A stateless or near-stateless client wants to verify a block from the block data, a trusted root, and a witness for the touched state.',
        'The blocker is witness size. If a block touches many accounts and storage slots, a Merkle-style proof can carry a lot of path material. Verkle trees exist to make those witnesses small enough that clients can verify without storing the full state locally.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to keep using Merkle proofs. For every accessed key, send the path from the leaf to the root, including the sibling hashes or encoded path nodes needed to recompute the root. This is simple, robust, and easy to reason about.',
        'The wall appears at block scale. A single proof may be manageable, but a block can touch thousands of state locations. Repeated path data becomes network payload, verification work, and builder responsibility. Stateless clients need witnesses that aggregate better across many accesses.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A Verkle node commits to a vector of child positions. Instead of sending all sibling commitments at a wide node, the witness opens only the selected positions and proves that those positions match the parent commitment.',
        'Wide fanout shortens paths. Vector-commitment multiproofs aggregate many openings. The bottleneck moves from sending many hashes to producing and verifying commitment openings.',
      ],
    },
    {
      heading: 'How a Verkle witness works',
      paragraphs: [
        'The tree stores commitments, not just pointers. A key is routed through child positions at each level. For an accessed key, the witness includes the claimed value or child commitment at each selected position, plus proof material that those openings are consistent with the commitments on the path.',
        'A block witness aggregates this across the state touched by the block. The verifier starts from a trusted root, checks the openings along the accessed paths, and confirms that the claimed account or storage values are the ones committed by that root.',
      ],
    },
    {
      heading: 'Why verification works',
      paragraphs: [
        'A vector commitment binds the parent node to every child position. If the prover lies about an opened child, the proof fails against the parent commitment. If the parent commitment is wrong, its own opening fails against the next commitment up the path. The chain ends at the trusted root.',
        'This is the same root-anchoring idea as a Merkle proof, but the local proof object is different. A Merkle proof reveals sibling hashes. A Verkle proof opens entries in committed vectors. The root still supplies the trust anchor.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the witness-shape view, follow the block to the witness, then to the commitment and trusted root. The client at the end is not trusting the witness provider. It is checking whether the witness opens the right positions under the root it already accepts.',
        'In the tradeoff-map view, read the benefit and cost columns together. Smaller witnesses come from wide fanout, vector commitments, and batched openings. The costs are wider node management, cryptographic proving work, migration complexity, and new responsibilities for builders and clients.',
      ],
    },
    {
      heading: 'Worked example: two storage reads',
      paragraphs: [
        'Suppose a block reads two storage slots from the same contract and one balance from a nearby account path. In a Merkle-style witness, each access carries path material that may overlap but still includes many hashes or encoded nodes.',
        'In a Verkle-style witness, the prover opens the relevant child positions at the shared nodes and batches those openings. The shared prefix matters because several accessed keys can reuse the same committed nodes. The verifier checks the batched proof and then verifies each claimed value along its path.',
        'The example also shows the limit. If accesses are scattered across unrelated paths, there is less shared structure. The witness can still be smaller than a Merkle-Patricia witness, but the savings depend on proof aggregation, state layout, and access pattern.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The main trade is witness bytes versus cryptographic machinery. Merkle proofs are simple and hash based. Verkle proofs need vector-commitment libraries, proof aggregation, careful verification code, and a state layout that makes the commitment scheme practical.',
        'There are also protocol costs. A migration must define how old state maps into the new tree, how witnesses are charged, who serves witnesses, how clients recover from missing witnesses, and how builders handle the extra proving burden.',
      ],
    },
    {
      heading: 'Implementation consequences',
      paragraphs: [
        'A Verkle roadmap is not only a tree swap. Execution clients need storage formats for wide committed nodes, update rules for modified leaves, witness builders, witness verifiers, cache layers for hot commitments, and tooling for diagnosing failed openings. The data structure reaches into the database, networking, block production, and gas accounting.',
        'The prover side is especially important. If block builders must assemble witnesses for every state access, the system needs predictable proving latency and clear failure behavior when a witness cannot be produced. Small proof bytes are useful only if the witness can be built in time for the block pipeline.',
        'The client side needs a different debugging habit. A bad block witness may mean the value is wrong, the path is wrong, the commitment opening is wrong, the root is not the expected root, or the local verifier has a bug. Those are separate failure classes, and operational tooling should keep them separate.',
      ],
    },
    {
      heading: 'What changes for stateless clients',
      paragraphs: [
        'A stateless client still needs the block, the header chain or trusted root source, and the execution rules. What it does not need is a complete local copy of the state database for every account and storage slot. The witness supplies just the state facts touched by the block.',
        'That shift changes network economics. Instead of every verifier paying long-term disk cost, block producers or witness providers pay short-term witness construction and distribution cost. The design is attractive only if that trade makes validation easier overall rather than merely moving the burden to a more fragile place.',
        'This is why witness availability belongs in the design conversation. A compact proof that arrives too late, arrives from too few peers, or cannot be diagnosed when it fails does not deliver the participation benefit that stateless clients are supposed to create.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Verkle trees win when witness size is the binding constraint. They are strongest for stateless-client roadmaps, light verification, and block validation flows where the client can receive a compact proof instead of storing the entire state database.',
        'They also win when many accesses can share proof material. Block-level witnesses are the natural target because many state reads and writes can be aggregated into one verification object.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'They fail as a mental model if you treat them as magic state compression. The state still exists. Someone must hold it, update it, serve witnesses, and recover from missing data. The proof only lets another client verify selected facts against a trusted root.',
        'They also fail if root trust is skipped. A valid witness proves membership or value relative to a root. It does not prove that the root is canonical. Consensus, header verification, or another trust mechanism still matters.',
        'They are also the wrong answer when simplicity and implementation maturity matter more than witness size. Hash-based Merkle structures remain attractive because they are easy to audit, easy to implement across languages, and built on conservative cryptographic assumptions.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Merkle Tree for the base authenticated proof idea, Ethereum Merkle-Patricia Trie Case Study for the current authenticated-map shape, PATRICIA Trie for path compression, Sparse Merkle Tree Non-Membership for absence proofs, KZG Polynomial Commitment Opening Case Study for commitment intuition, and Byzantine Generals for the consensus layer that makes a root trustworthy.',
      ],
    },
  ],
};
