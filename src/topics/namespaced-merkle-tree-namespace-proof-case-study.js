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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a namespaced Merkle tree, which is a Merkle tree where each subtree also records the minimum and maximum namespace under it. A namespace is a tag that says which application or rollup owns a share of data.',
        'Active nodes show hashes or namespace ranges being checked, compare marks a skipped subtree whose range must exclude the target namespace, and found marks a proof element accepted by the verifier. The safe inference rule is this: a verifier can skip a subtree only when its min-max namespace range proves the target namespace cannot be inside it.',
        {type:'callout', text:`Namespaced Merkle trees turn selective retrieval into an interval proof: sorted namespaces and min-max ranges let a verifier reject hidden shares without scanning the whole block.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt:'Binary hash tree with leaves and parent hashes up to a top hash.', caption:'A Merkle tree authenticates leaves through parent hashes; namespaced Merkle trees add namespace ranges to make skipped subtrees checkable. Source: Wikimedia Commons, Azaghal and David Gothberg, CC0'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Data-availability systems publish large blocks that contain data for many applications. A light client may care about one namespace and should not download the entire block to know whether its data is present.',
        'A normal Merkle root proves that a leaf belongs to a block, but it does not prove that all leaves for one namespace were returned. Namespaced Merkle trees exist to prove both inclusion and absence over a sorted namespace interval.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to put all shares in a Merkle tree and ask for the leaves matching the namespace. That proves each returned leaf is authentic because every leaf has a path to the root.',
        'It does not prove completeness. A malicious server can return two valid leaves and hide a third leaf with the same namespace somewhere else in the tree.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is hidden omission. Inclusion proofs answer "is this leaf in the tree", while namespace retrieval needs "are these all the leaves in this namespace".',
        'Downloading the whole block would solve the problem but destroys the point of light clients. The proof needs enough structure to rule out hidden matching leaves without scanning every share.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sort leaves by namespace and store each subtree minimum and maximum namespace in the hashed node. Now every subtree carries an interval commitment in addition to its cryptographic hash.',
        'A proof for namespace N returns the matching leaves plus boundary siblings whose ranges are entirely below or above N. Those boundary ranges prove there are no more matching leaves hidden next to the returned interval.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each leaf is hashed with its namespace and data. Each internal node stores the hash of its children plus min_namespace and max_namespace computed from the child ranges.',
        'To prove a namespace, the server returns all leaves in the sorted run for that namespace and the sibling hashes needed to rebuild the root. It also returns enough neighboring ranges to show that the run starts after lower namespaces and ends before higher namespaces.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on two invariants: hashes bind the tree shape and data, while min-max namespace ranges bind the sorted interval under each node. If either data or range changes, the recomputed root changes.',
        'Completeness follows from sorted order. If every skipped sibling range excludes namespace N, and the returned leaves cover the only interval where N can appear, then no hidden matching leaf can exist without contradicting a range or hash in the proof.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'An ordinary Merkle proof costs O(log n) sibling hashes for one leaf. A namespace proof costs O(k + log n), where k is the number of leaves in that namespace, because the proof must return the whole matching run plus boundary paths.',
        'If n doubles, the boundary proof grows by about one hash level, but k grows with the application data size. The storage cost also rises because every internal node carries namespace min and max in addition to a hash.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Namespaced Merkle trees fit modular blockchain data availability, rollup data retrieval, and any shared log where clients care about one tagged subset. The access pattern is selective reads with public commitment to the whole block.',
        'They are useful when many applications share one data layer. Each application can verify its own shares without trusting the full node to honestly filter the block.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The structure relies on sorted namespaces. If leaves are not ordered correctly, min-max ranges no longer prove absence, so construction and verification must enforce ordering.',
        'It also does not prove that the underlying data is available to everyone by itself. Data availability sampling, erasure coding, and network retrieval still matter for detecting withheld block data.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a block has 16 shares sorted by namespace, and namespace 42 occupies leaves 6, 7, and 8. A proof returns those 3 leaves plus sibling hashes on the boundary paths, about 4 levels because log2(16) = 4.',
        'The verifier accepts only if the left boundary sibling has max namespace below 42 and the right boundary sibling has min namespace above 42. If a fourth namespace-42 leaf were hidden outside leaves 6 to 8, one of those boundary intervals would have to include 42 and the proof would fail.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Celestia documentation on namespaced Merkle trees and data availability sampling, plus Merkle tree references for inclusion proofs. Study the implementation rules for exact namespace ordering and node encoding.',
        'Study next: Merkle trees, interval proofs, sparse Merkle trees, erasure coding, data availability sampling, light clients, and rollup data publication.',
      ],
    },
  ],
};
