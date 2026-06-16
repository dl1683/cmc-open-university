// Namespaced Merkle trees: sorted namespace leaves plus min/max range metadata
// let a verifier check that every share for one namespace was returned.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'namespaced-merkle-tree-namespace-proof-case-study',
  title: 'Namespaced Merkle Tree Proof Case Study',
  category: 'Systems',
  summary: 'How Celestia-style namespaced Merkle trees prove complete per-application data slices with sorted leaves, min/max namespace ranges, boundary siblings, and row/column roots.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['namespace proof', 'data square roots'], defaultValue: 'namespace proof' },
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

function nmtTree(title) {
  return graphState({
    nodes: [
      { id: 'root', label: '[A-D]', x: 5.0, y: 0.9, note: 'root' },
      { id: 'q0', label: '[A-B]', x: 3.0, y: 2.2, note: 'range' },
      { id: 'q1', label: '[B-D]', x: 7.0, y: 2.2, note: 'range' },
      { id: 'p0', label: '[A]', x: 1.4, y: 3.6, note: 'left edge' },
      { id: 'p1', label: '[B]', x: 3.2, y: 3.6, note: 'B shares' },
      { id: 'p2', label: '[B]', x: 6.2, y: 3.6, note: 'B shares' },
      { id: 'p3', label: '[C-D]', x: 8.0, y: 3.6, note: 'right edge' },
      { id: 'a0', label: 'A0', x: 0.8, y: 5.2 },
      { id: 'a1', label: 'A1', x: 2.0, y: 5.2 },
      { id: 'b0', label: 'B0', x: 2.7, y: 5.2 },
      { id: 'b1', label: 'B1', x: 3.7, y: 5.2 },
      { id: 'b2', label: 'B2', x: 5.7, y: 5.2 },
      { id: 'b3', label: 'B3', x: 6.7, y: 5.2 },
      { id: 'c0', label: 'C0', x: 7.5, y: 5.2 },
      { id: 'd0', label: 'D0', x: 8.7, y: 5.2 },
      { id: 'app', label: 'app B', x: 9.2, y: 1.2, note: 'query' },
    ],
    edges: [
      { id: 'e-root-q0', from: 'root', to: 'q0' },
      { id: 'e-root-q1', from: 'root', to: 'q1' },
      { id: 'e-q0-p0', from: 'q0', to: 'p0' },
      { id: 'e-q0-p1', from: 'q0', to: 'p1' },
      { id: 'e-q1-p2', from: 'q1', to: 'p2' },
      { id: 'e-q1-p3', from: 'q1', to: 'p3' },
      { id: 'e-p0-a0', from: 'p0', to: 'a0' },
      { id: 'e-p0-a1', from: 'p0', to: 'a1' },
      { id: 'e-p1-b0', from: 'p1', to: 'b0' },
      { id: 'e-p1-b1', from: 'p1', to: 'b1' },
      { id: 'e-p2-b2', from: 'p2', to: 'b2' },
      { id: 'e-p2-b3', from: 'p2', to: 'b3' },
      { id: 'e-p3-c0', from: 'p3', to: 'c0' },
      { id: 'e-p3-d0', from: 'p3', to: 'd0' },
      { id: 'e-root-app', from: 'root', to: 'app' },
    ],
  }, { title });
}

function dataRootFlow(title) {
  return graphState({
    nodes: [
      { id: 'blob', label: 'blobs', x: 0.7, y: 4.0, note: 'apps' },
      { id: 'shares', label: 'shares', x: 2.0, y: 4.0, note: 'split' },
      { id: 'sort', label: 'sort', x: 3.3, y: 4.0, note: 'by ns' },
      { id: 'row', label: 'row NMT', x: 4.9, y: 2.5, note: 'roots' },
      { id: 'col', label: 'col NMT', x: 4.9, y: 5.5, note: 'roots' },
      { id: 'roots', label: 'roots', x: 6.4, y: 4.0, note: '4k list' },
      { id: 'adr', label: 'ADR', x: 7.9, y: 4.0, note: 'header' },
      { id: 'light', label: 'light', x: 9.2, y: 2.6, note: 'sample' },
      { id: 'app', label: 'app', x: 9.2, y: 5.4, note: 'namespace' },
    ],
    edges: [
      { id: 'e-blob-shares', from: 'blob', to: 'shares' },
      { id: 'e-shares-sort', from: 'shares', to: 'sort' },
      { id: 'e-sort-row', from: 'sort', to: 'row' },
      { id: 'e-sort-col', from: 'sort', to: 'col' },
      { id: 'e-row-roots', from: 'row', to: 'roots' },
      { id: 'e-col-roots', from: 'col', to: 'roots' },
      { id: 'e-roots-adr', from: 'roots', to: 'adr' },
      { id: 'e-adr-light', from: 'adr', to: 'light' },
      { id: 'e-adr-app', from: 'adr', to: 'app' },
      { id: 'e-sort-light', from: 'sort', to: 'light' },
      { id: 'e-sort-app', from: 'sort', to: 'app' },
    ],
  }, { title });
}

function* namespaceProof() {
  yield {
    state: labelMatrix(
      'Namespace order turns scattered app data into one interval',
      [
        { id: 'p1', label: 'pos 1' },
        { id: 'p2', label: 'pos 2' },
        { id: 'p3', label: 'pos 3' },
        { id: 'p4', label: 'pos 4' },
        { id: 'p5', label: 'pos 5' },
        { id: 'p6', label: 'pos 6' },
        { id: 'p7', label: 'pos 7' },
        { id: 'p8', label: 'pos 8' },
      ],
      [
        { id: 'ns', label: 'ns' },
        { id: 'share', label: 'cell' },
        { id: 'role', label: 'role' },
      ],
      [
        ['A', 'A0', 'left'],
        ['A', 'A1', 'left'],
        ['B', 'B0', 'return'],
        ['B', 'B1', 'return'],
        ['B', 'B2', 'return'],
        ['B', 'B3', 'return'],
        ['C', 'C0', 'right'],
        ['D', 'D0', 'right'],
      ],
    ),
    highlight: { active: ['p3:share', 'p4:share', 'p5:share', 'p6:share'], compare: ['p2:role', 'p7:role'] },
    explanation: 'A namespaced Merkle tree starts with sorted leaves. All shares for namespace B become a contiguous interval, so the proof can talk about both inclusion and completeness.',
    invariant: 'Completeness comes from order plus boundary evidence, not from trusting the server.',
  };

  yield {
    state: nmtTree('Leaves hash namespace id plus share bytes'),
    highlight: { active: ['a0', 'a1', 'b0', 'b1', 'b2', 'b3', 'c0', 'd0'], found: ['root'] },
    explanation: 'A normal Merkle leaf commits to bytes. An NMT leaf commits to namespace plus bytes. If a share moves to a different namespace, the leaf hash changes and the root changes.',
  };

  yield {
    state: nmtTree('Each internal node carries a namespace range'),
    highlight: { active: ['p0', 'p1', 'p2', 'p3', 'q0', 'q1', 'root', 'e-root-q0', 'e-root-q1'], compare: ['app'] },
    explanation: 'Internal nodes carry n_min, n_max, and a hash value. The range says which namespaces exist below the node, while the hash commits to the children and their ranges.',
    invariant: 'A skipped subtree is safe to skip only when its range does not include the requested namespace.',
  };

  yield {
    state: nmtTree('A complete B proof returns B leaves plus boundary siblings'),
    highlight: {
      active: ['b0', 'b1', 'b2', 'b3', 'p1', 'p2', 'q0', 'q1', 'root', 'e-q0-p1', 'e-q1-p2', 'e-root-q0', 'e-root-q1'],
      compare: ['p0', 'p3'],
      found: ['app'],
    },
    explanation: 'For namespace B, the server returns B0 to B3 plus sibling commitments on the left and right. The boundary siblings say the skipped data is A on the left and C-D on the right.',
  };

  yield {
    state: nmtTree('An incomplete B response is detectable'),
    highlight: {
      active: ['b0', 'b1', 'p1', 'q0', 'root'],
      compare: ['q1'],
      removed: ['b2', 'b3', 'p2'],
      found: ['app'],
    },
    explanation: 'If the server omits B2 and B3, it must treat q1 as a sibling. But q1 has range [B-D], which still intersects namespace B. The verifier rejects the proof as incomplete.',
    invariant: 'A proof cannot hide requested data inside a sibling whose range overlaps the request.',
  };

  yield {
    state: labelMatrix(
      'Verifier checklist',
      [
        { id: 'sort', label: 'leaf order' },
        { id: 'hash', label: 'hash path' },
        { id: 'left', label: 'left edge' },
        { id: 'right', label: 'right edge' },
        { id: 'root', label: 'trusted root' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'rejects', label: 'rejects if' },
      ],
      [
        ['nondecreasing ns', 'misordered'],
        ['recompute root', 'tampered'],
        ['max < target', 'hidden B'],
        ['min > target', 'hidden B'],
        ['header match', 'wrong block'],
      ],
    ),
    highlight: { active: ['hash:check', 'left:check', 'right:check', 'root:check'], compare: ['left:rejects', 'right:rejects'] },
    explanation: 'The verifier checks the same Merkle root as usual, then checks range boundaries. That second check is the new data-structure idea: a namespace proof is a range proof.',
  };
}

function* dataSquareRoots() {
  yield {
    state: labelMatrix(
      'Blobs become namespace-tagged shares',
      [
        { id: 'pay', label: 'payments' },
        { id: 'dex', label: 'dex' },
        { id: 'game', label: 'game' },
        { id: 'parity', label: 'parity' },
      ],
      [
        { id: 'namespace', label: 'ns' },
        { id: 'shares', label: 'cells' },
        { id: 'consumer', label: 'use' },
      ],
      [
        ['A', 'A0,A1', 'pay'],
        ['B', 'B0-3', 'dex'],
        ['C', 'C0', 'game'],
        ['P', 'repair', 'net'],
      ],
    ),
    highlight: { active: ['dex:namespace', 'dex:shares', 'dex:consumer'], compare: ['parity:shares'] },
    explanation: 'A modular DA layer stores blobs for many apps in one block. Namespace tags let each app ask for its own shares without reading every other app blob.',
  };

  yield {
    state: dataRootFlow('Rows and columns each receive NMT commitments'),
    highlight: { active: ['blob', 'shares', 'sort', 'row', 'col', 'e-blob-shares', 'e-shares-sort', 'e-sort-row', 'e-sort-col'], compare: ['adr'] },
    explanation: 'Celestia arranges erasure-coded shares into an extended data square. Each row and each column is committed with an NMT root, so sampling coordinates and namespace ranges are both provable.',
  };

  yield {
    state: dataRootFlow('The header commits to the list of row and column roots'),
    highlight: { active: ['row', 'col', 'roots', 'adr', 'e-row-roots', 'e-col-roots', 'e-roots-adr'], found: ['light', 'app'] },
    explanation: 'The available data root in the header is a Merkle commitment over the row and column NMT roots. A verifier starts from that trusted header root before checking a share proof.',
    invariant: 'NMT proofs are meaningful only relative to a root the verifier already accepts.',
  };

  yield {
    state: dataRootFlow('DAS samples coordinates; apps request namespaces'),
    highlight: { active: ['adr', 'light', 'app', 'sort', 'e-adr-light', 'e-adr-app', 'e-sort-light', 'e-sort-app'], compare: ['roots'] },
    explanation: 'Light nodes sample random coordinates to test availability. Apps request complete namespace slices. Both flows need authenticated shares, but they answer different questions.',
  };

  yield {
    state: labelMatrix(
      'Two proof questions',
      [
        { id: 'coord', label: 'coordinate' },
        { id: 'ns', label: 'namespace' },
        { id: 'valid', label: 'validity' },
        { id: 'archive', label: 'archive' },
      ],
      [
        { id: 'asks', label: 'asks' },
        { id: 'proof object', label: 'proof object' },
      ],
      [
        ['is cell there?', 'share + path'],
        ['is all B here?', 'range proof'],
        ['is tx correct?', 'rollup proof'],
        ['is old data kept?', 'retention'],
      ],
    ),
    highlight: { active: ['coord:proof object', 'ns:proof object'], removed: ['valid:proof object', 'archive:proof object'] },
    explanation: 'NMTs help with coordinate and namespace retrieval. They do not prove execution correctness and they do not guarantee permanent archival by themselves.',
  };

  yield {
    state: labelMatrix(
      'Production checklist',
      [
        { id: 'order', label: 'order' },
        { id: 'range', label: 'range tags' },
        { id: 'parity', label: 'parity ns' },
        { id: 'proof', label: 'proof data' },
        { id: 'root', label: 'root source' },
        { id: 'retain', label: 'retention' },
      ],
      [
        { id: 'must keep' },
        { id: 'breaks if' },
      ],
      [
        ['lex ns sort', 'mixed leaves'],
        ['min and max', 'bad boundary'],
        ['special rule', 'long proofs'],
        ['sibling ranges', 'hidden shares'],
        ['header root', 'wrong block'],
        ['providers', 'early prune'],
      ],
    ),
    highlight: { active: ['order:must keep', 'range:must keep', 'proof:must keep', 'root:must keep'], compare: ['proof:breaks if'] },
    explanation: 'The implementation is small enough to explain, but correctness lives in the serialization contract: namespace size, ordering, range hashing, parity namespace handling, and proof verification rules.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'namespace proof') yield* namespaceProof();
  else if (view === 'data square roots') yield* dataSquareRoots();
  else throw new InputError('Pick a namespaced-merkle-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A namespaced Merkle tree is a Merkle tree whose leaves are sorted by namespace and whose internal nodes store three fields: minimum namespace, maximum namespace, and hash value. The root still commits to the bytes below it, but it also commits to the namespace interval covered by every subtree.',
        'The extra range metadata changes the proof question. A normal Merkle proof can show that one leaf is included. An NMT proof can show that all leaves for namespace B have been returned, because any skipped sibling whose range still overlaps B exposes an incomplete response.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The producer first tags each share with a namespace identifier and sorts shares lexicographically by namespace. A leaf hash includes a leaf domain byte, the namespace, and the raw share data. An internal hash includes an internal-node domain byte, the child ranges, and the child hash values. The parent range is derived from the child ranges.',
        'To prove a namespace, the server returns the leaves in that namespace plus sibling commitments needed to recompute the root. The verifier checks the root hash, then checks that the left boundary has a maximum namespace lower than the target and the right boundary has a minimum namespace higher than the target. If a sibling range intersects the target namespace, the proof skipped data it was supposed to return.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Celestia uses NMTs inside its data availability layer. Shares are arranged into an extended data square with Reed-Solomon erasure coding. Every row and every column gets an NMT root, and the block header commits to the row and column roots through the available data root. Light nodes sample shares to test availability, while applications retrieve complete namespace slices for their own blobs.',
        'This is the teaching bridge from Merkle Tree to Data Availability Sampling. Merkle Tree explains hash paths. Reed-Solomon Erasure Coding explains why a block can be reconstructed from enough shares. Data Availability Sampling explains random coordinate checks. Namespaced Merkle Tree Proof Case Study explains how one app proves it got all of its own data without downloading everyone else data.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tree construction is O(n) hashing after shares are sorted. A single leaf proof is O(log n) sibling data. A namespace proof is O(k + log n) in the common mental model: k returned leaves for the namespace plus boundary and path data. The exact proof format depends on implementation details, but the asymptotic lesson is stable: the app pays for its own data slice plus a small authentication boundary.',
        'The range metadata makes absence and completeness efficient. If namespace B does not appear, the proof can show neighboring ranges that bracket where B would have been. If B appears, the proof must include every B leaf or else a skipped sibling range will still contain B.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An NMT is not a data availability protocol by itself. It authenticates shares and namespace ranges. The network still needs data distribution, sampling, repair, retention, and a trusted header root. It also does not prove transaction validity; rollup execution proofs or fraud proofs handle that layer.',
        'The serialization contract is security-critical. Implementations must define namespace size, lexicographic ordering, leaf and internal domain separation, parity namespace handling, compact-root rules, and proof verification exactly. A proof verifier that only recomputes the hash but ignores boundary ranges has lost the main NMT guarantee.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Celestia data-structure specification at https://celestiaorg.github.io/celestia-app/data_structures.html, Celestia data availability docs at https://docs.celestia.org/learn/celestia-101/data-availability/, Celestia NMT glossary at https://celestia.org/glossary/namespaced-merkle-tree/, celestiaorg/nmt implementation at https://github.com/celestiaorg/nmt, LazyLedger paper at https://arxiv.org/abs/1905.09274, and Fraud and Data Availability Proofs at https://arxiv.org/abs/1809.09044.',
        'Study Merkle Tree first for root and proof paths. Then read Sparse Merkle Tree Non-Membership for absence proofs, Reed-Solomon Erasure Coding for recoverable shares, Data Availability Sampling & Erasure Coding Case Study for the DA layer, Content-Addressed Merkle DAG Object Store for hash-linked object identity, KZG Polynomial Commitments for the Ethereum blob commitment contrast, and Reservoir Sampling for the randomness intuition behind DAS.',
      ],
    },
  ],
};
