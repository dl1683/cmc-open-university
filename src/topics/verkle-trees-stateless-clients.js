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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Witness shape" traces the data flow from a block through its witness, vector commitment, and trusted root to a stateless client. "Tradeoff map" lays out the design levers, client responsibilities, tree comparisons, and common misreadings.',
        {
          type: 'callout',
          text: 'Verkle trees keep the authenticated-state guarantee but replace sibling-hash bundles with compact vector-commitment openings.',
        },
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes mark the current proof mechanism under inspection -- the witness or commitment being verified.',
            'Found (green) nodes mark outcomes the proof has established -- a verified client or a confirmed root.',
            'Compare (orange) nodes mark alternatives being contrasted -- MPT proof size versus Verkle proof size, or one tree type against another.',
            'Removed (red) cells in the tradeoff view mark wrong mental models the reader should discard.',
          ],
        },
        'In the witness-shape view, follow left to right: the block defines which state was accessed, the witness carries proof material, the commitment binds those openings, and the client checks them against a root it already trusts. At each frame, ask what trust anchor is being used and what data the client does not need to store.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A blockchain validator confirms that a block transitions state correctly. The direct way is to keep the entire state database locally -- every account balance, every contract storage slot. As state grows, that disk cost raises the bar for participation.',
        {
          type: 'quote',
          text: 'A stateless client verifies blocks without storing the state they modify. It receives a witness -- a proof that the claimed state values are consistent with a trusted root.',
          attribution: 'The design goal driving Verkle trees',
        },
        'The witness must be small enough to fit inside a block or propagate quickly across the network. If the witness is too large, the stateless idea fails at the network layer even if the cryptography is correct.',
        {
          type: 'note',
          text: 'Ethereum state has grown past 100 GB of trie data. A single block can touch hundreds of accounts and storage slots. The witness for that block, under the current Merkle-Patricia Trie, can exceed 1 MB -- roughly the size of the block itself. Verkle trees target witnesses under 200 KB for the same workload.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use Merkle proofs. For every key the block accesses, send the path from the leaf to the root, including the sibling hashes needed to recompute each parent. This is simple, battle-tested, and easy to audit.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt: 'Binary Merkle tree with leaf hashes and a top hash', caption: 'Merkle trees anchor each leaf under a root hash, but a proof must carry sibling hashes along the path. Source: Wikimedia Commons, David Goehring, public domain.'},
        {
          type: 'diagram',
          label: 'Merkle proof for one key in a binary tree of depth d',
          text: [
            '  root',
            '   |',
            '  [H]  <-- sibling hash (must be sent)',
            '   |',
            '  [H]  <-- sibling hash (must be sent)',
            '   |',
            '  [H]  <-- sibling hash (must be sent)',
            '   |',
            '  leaf = value',
            '',
            '  Proof size per key: d sibling hashes = d * 32 bytes (SHA-256)',
            '  For Ethereum MPT (hexary, ~6 levels): each node encodes',
            '  up to 16 child hashes, so proof material is much larger.',
          ].join('\n'),
        },
        'For a single lookup this works well. The proof is O(d) hashes, verification is O(d) hash computations, and the trust model is clear: if any sibling is wrong, the recomputed root will not match.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears at block scale. A block does not access one key -- it accesses hundreds or thousands. Each access carries its own path of sibling hashes. Paths overlap (shared prefixes), but the sibling material at each divergence point is still sent separately.',
        {
          type: 'bullets',
          items: [
            'Single read: 1 state access, about 3-5 KB of MPT witness data. Manageable.',
            'Simple transfer: about 10 state accesses, about 30-50 KB. Acceptable but no longer tiny.',
            'DeFi transaction: about 50-100 state accesses, about 200-500 KB. Witness bytes grow fast.',
            'Full block: 1000+ state accesses, about 800 KB to 1.5 MB. Witnesses can exceed the block payload.',
          ],
        },
        'The growth is roughly linear in the number of accesses because sibling hashes do not compress well across unrelated paths. For the hexary Merkle-Patricia Trie, each proof node is an RLP-encoded list of 17 items (16 children plus value), making the per-access cost worse than a clean binary tree.',
        {
          type: 'note',
          text: 'The Ethereum Foundation measured average block witnesses at 800 KB to 1.2 MB under MPT. The EIP-4762 analysis showed that witness overhead would dominate block propagation time, defeating the purpose of stateless validation.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Verkle tree replaces hash-based parent-child links with vector commitments. Each internal node commits to a vector of 256 child entries using a polynomial or inner-product commitment scheme. The key idea: proving that specific positions in a committed vector hold specific values costs far less than revealing all siblings.',
        {
          type: 'diagram',
          label: 'Verkle tree structure (width 256, depth ~3 for 2^24 keys)',
          text: [
            '                     C_root',
            '                    /  |   \\',
            '                 /     |     \\',
            '              C_17   C_99   C_200     <-- 256-wide committed nodes',
            '             / | \\   / | \\   / | \\',
            '           ...........   ...........  <-- next level',
            '           /     \\       /     \\',
            '        leaf_a  leaf_b  leaf_c  leaf_d',
            '',
            '  Each C_i is a commitment to [child_0, child_1, ..., child_255].',
            '  Opening position 17 proves child_17 without revealing children 0-16, 18-255.',
            '  A multiproof opens positions across multiple nodes in one batch.',
          ].join('\n'),
        },
        'The tree is wide -- 256 children per node. This makes it shallow: 2^24 keys need only 3 levels, 2^32 keys need 4. Short paths mean fewer commitment openings per access.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Simplified witness construction for a Verkle tree access',
            '//',
            '// key:   0x11_63_A4  (3 bytes = 3 levels in a width-256 tree)',
            '// path:  [0x11, 0x63, 0xA4]',
            '//',
            '// At each level, the witness needs:',
            '//   1. The claimed child value at the accessed position',
            '//   2. A commitment opening proof for that position',
            '//',
            '// Merkle equivalent would need: 255 sibling hashes per level',
            '// Verkle opening:  one group element per level (48 bytes for BLS)',
            '//',
            '// For a block touching N keys with shared prefixes:',
            '//   Merkle witness:  O(N * depth * branching_factor) hashes',
            '//   Verkle witness:  O(distinct_nodes) openings + one batched proof',
            '//',
            '// The batched proof is the key savings:',
            '//   multiple openings across multiple commitments collapse into',
            '//   one verification equation via random linear combination.',
          ].join('\n'),
        },
        'The witness for a block collects all accessed paths, identifies every distinct committed node touched, and produces a single batched multiproof covering all the required openings. The verifier receives the claimed values, the multiproof, and checks everything against the state root in one pass.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the binding property of the vector commitment. A commitment C to vector [v_0, ..., v_255] binds the committer: no efficient adversary can produce an opening proof that position i holds some value w != v_i. If a prover lies about a child, the opening proof will fail verification against C.',
        {
          type: 'quote',
          text: 'The chain of trust in a Verkle tree is identical to a Merkle tree -- each node is bound to its children, and the root anchors the entire structure. The difference is not what is proven but how: vector-commitment openings replace sibling-hash revelation.',
          attribution: 'Kuszmaul, "Verkle Trees" (2018)',
        },
        'The invariant at each level: if the parent commitment C is correct (matches the trusted root chain), then any valid opening at position i proves the true child value at that position. Induction from the root downward establishes the leaf value.',
        {
          type: 'note',
          text: 'The batched multiproof works because vector commitment schemes (Pedersen with inner-product arguments, or KZG-style polynomial commitments) support random linear combination. The verifier picks a random challenge, combines all opening claims into one equation, and checks once. Soundness: a cheating prover would need to satisfy a random polynomial identity, which happens with negligible probability.',
        },
        'Corner case: if two keys share a prefix and diverge at the same node, their openings at that node are at different positions of the same commitment. The multiproof handles this naturally -- it opens multiple positions in one commitment vector, not just one position per commitment.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Tree depth for 2^30 keys: binary Merkle about 30 levels, hexary MPT about 8, width-256 Verkle about 4.',
            'Proof size per key: binary Merkle about 960 B, MPT about 3-5 KB of RLP nodes, Verkle about 130-150 B per opening before batching.',
            'Block witness for 1000 keys: binary Merkle about 500-800 KB, MPT about 800 KB to 1.5 MB, Verkle about 150-200 KB when batched.',
            'Verification cost shifts from fast hashing to hash decoding plus elliptic-curve operations. Verkle spends more CPU to save bandwidth.',
            'Update cost shifts from rehashing or re-encoding path nodes to recomputing commitments on the changed path.',
            'Commitment update is not free: the Verkle path needs group operations at each level, roughly four group multiplications per level in the cited design.',
          ],
        },
        'The savings come from batching. A single Verkle opening is not dramatically smaller than a Merkle path in a binary tree. The win is that a multiproof covering 1000 openings across shared tree structure compresses into a proof roughly the size of a few dozen openings, while 1000 Merkle proofs remain 1000 separate paths.',
        {
          type: 'note',
          text: 'Verification is computationally heavier per operation. Each opening check involves elliptic curve pairings or multi-scalar multiplications instead of hash evaluations. The tradeoff is explicit: smaller bandwidth cost, higher CPU cost per verification. For stateless clients on modern hardware, the CPU cost is acceptable; the bandwidth savings is what makes participation feasible.',
        },
        'Update cost matters for block producers. When a leaf changes, the commitments on the path from leaf to root must be recomputed. With 256-wide nodes and Pedersen commitments, updating one child position in a commitment is a single group scalar-multiplication plus an addition -- O(1) per level, O(depth) total. This is more expensive than rehashing but still practical.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Stateless block validation: the primary use case. A light client receives a block, a state root from the consensus layer, and a Verkle witness. It verifies the block without any local state database. Disk requirement drops from 100+ GB to effectively zero for verification.',
            'Weak subjectivity sync: a new node syncing the chain can verify recent blocks immediately using witnesses, then backfill state in the background. The node is useful before it finishes syncing.',
            'Block propagation: smaller witnesses reduce the network bandwidth required to propagate blocks with state proofs. Faster propagation means lower orphan rates and better decentralization.',
            'Cross-shard or rollup state proofs: any system that needs to prove state facts to an external verifier benefits from compact proofs. Verkle witnesses can serve as state proofs in bridge protocols.',
            'Access-pattern-friendly workloads: blocks with many accesses to keys sharing long prefixes (same contract, adjacent storage slots) benefit most, because shared internal nodes reduce the number of distinct commitments in the multiproof.',
          ],
        },
        {
          type: 'quote',
          text: 'The goal is not to make proofs faster. It is to make proofs small enough that clients who cannot afford 100 GB of state can still verify blocks independently.',
          attribution: 'Dankrad Feist, Ethereum Foundation researcher',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Not magic compression: the state still exists and must be stored somewhere. Verkle trees reduce witness size, not state size.',
            'Root trust is still required: a valid witness proves values relative to a root, not whether the root is canonical.',
            'Prover cost is real: block builders must compute witnesses for every state access, and proving latency must fit the block-time budget.',
            'Cryptographic complexity grows: elliptic-curve libraries, setup assumptions, and constant-time implementation details create more attack surface than hash-only proofs.',
            'Migration burden is large: converting live state from MPT to Verkle needs either a risky hard cutover or a complex overlay period.',
            'Scattered access patterns reduce compression: if keys share few prefixes, the multiproof drops toward the single-proof case.',
          ],
        },
        'Verkle trees are also the wrong tool when implementation maturity and auditability matter more than witness size. Hash-based Merkle proofs are understood by every engineer, implemented in every language, and built on conservative cryptographic assumptions (collision-resistant hashing). Verkle proofs depend on newer, more complex algebraic primitives.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: John Kuszmaul, "Verkle Trees," 2018. Introduced the concept of vector-commitment-based authenticated dictionaries and analyzed witness size complexity.',
            'Ethereum specification: Vitalik Buterin, Dankrad Feist, et al., EIP-6800 and the Verkle trie specification. Defines the concrete tree layout (width 256, Pedersen commitments over Bandersnatch), stem-extension structure, and multiproof format for Ethereum state.',
            'Commitment scheme: Ipa (Inner Product Argument) multiproof over Bandersnatch curve -- the scheme chosen for Ethereum Verkle. See also KZG polynomial commitments as an alternative vector commitment with different trusted-setup tradeoffs.',
            'Implementation: go-verkle (Go), verkle-crypto (Rust), and the Kaustinen testnet as the live Ethereum testbed for Verkle state.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Merkle Tree, the base authenticated-proof idea that Verkle trees generalize.',
            'Prerequisite: KZG Polynomial Commitment Opening, the vector-commitment intuition behind compact openings.',
            'Context: Ethereum Merkle-Patricia Trie, the current authenticated state structure that Verkle trees would replace.',
            'Context: PATRICIA Trie, the path-compression technique used in both MPT and Verkle stem-extension nodes.',
            'Extension: Sparse Merkle Tree Non-Membership, the absence-proof complement to authenticated membership.',
            'Foundation: Byzantine Generals, the consensus layer that makes the state root trustworthy.',
          ],
        },
      ],
    },
  ],
};
