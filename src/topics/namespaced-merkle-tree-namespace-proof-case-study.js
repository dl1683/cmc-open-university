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
      heading: 'Why this exists',
      paragraphs: [
        `A namespaced Merkle tree exists because a shared data layer has a different proof problem from a single-application database. Many applications publish shares into the same block. A rollup, payment app, game, or bridge usually wants only its own data, but it must know that the server did not omit one of its shares. A normal Merkle proof can prove that one returned leaf is in the committed tree. It cannot, by itself, prove that all leaves for one application were returned.`,
        `Celestia-style data availability makes that completeness question central. Light nodes sample random coordinates to test whether block data is available, while applications fetch complete namespace slices for their own blobs. The shared root has to support both questions. The tree must authenticate bytes, authenticate namespace order, and give a verifier enough boundary evidence to reject a partial namespace response.`,
        {type:'callout', text:`Namespaced Merkle trees turn selective retrieval into an interval proof: sorted namespaces and min-max ranges let a verifier reject hidden shares without scanning the whole block.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt:'Binary hash tree with leaves and parent hashes up to a top hash.', caption:'A Merkle tree authenticates leaves through parent hashes; namespaced Merkle trees add namespace ranges to make skipped subtrees checkable. Source: Wikimedia Commons, Azaghal and David Gothberg, CC0'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is to keep one Merkle tree per application. Then an app can ask for its root and verify every share in its own tree. That works until the block producer needs one canonical commitment for a mixed block and light nodes need to sample the whole data square. Per-app roots fragment the commitment and make the header carry application-specific structure that may change every block.`,
        `The next approach is to put every share in one ordinary Merkle tree and return inclusion proofs for the shares an app asks for. That proves the returned leaves are real, but it still does not prove completeness. A malicious or faulty server can return B0 and B1 while hiding B2 and B3. Each returned leaf verifies. The missing leaves are invisible because the proof says nothing about the namespace range inside skipped siblings.`,
        `The failure is that inclusion is weaker than interval completeness. If leaves are unordered, the verifier cannot know whether another B leaf is hiding elsewhere without scanning the whole block. If internal nodes carry only hashes, a skipped subtree is opaque. Data availability also needs one commitment to serve random coordinate sampling, complete namespace retrieval, and efficient full-node construction at the same time.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to sort leaves by namespace and commit to the namespace range of every subtree. Each leaf includes a namespace identifier and share bytes. Each internal node stores or derives a minimum namespace, a maximum namespace, and a hash over its children and their ranges. Sorting turns all shares for namespace B into one contiguous interval. Range metadata makes every skipped subtree inspectable without opening it.`,
        `Completeness then becomes a boundary proof. The server returns the B leaves plus the sibling commitments needed to recompute the root. The verifier accepts skipped siblings only when their namespace interval is entirely left of B or entirely right of B. If a skipped sibling says its range is [B-D], it might contain hidden B shares, so the proof is incomplete and must be rejected.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Construction starts by tagging shares with namespace identifiers and ordering them lexicographically by namespace. A leaf hash commits to the namespace and share data with leaf-domain separation. An internal node combines child commitments with internal-domain separation and carries the minimum and maximum namespace below it. The root is still a compact commitment, but it now commits to both data bytes and the namespace layout.`,
        `A namespace proof has two jobs. First, it proves inclusion for the returned leaves by allowing the verifier to recompute the trusted root. Second, it proves completeness by showing that the immediate skipped material on both sides cannot contain the target namespace. Absence is similar: if namespace B is missing, the proof must show the neighboring ranges that bracket where B would have appeared in sorted order.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The first view proves why ordering matters. Once shares are sorted by namespace, all B shares form one interval rather than scattered leaves. The boundary cells labeled left and right are not decoration. They are the evidence that the returned interval is complete. If the left boundary has a maximum below B and the right boundary has a minimum above B, no B share can be hiding just outside the returned slice.`,
        `The tree view proves why range-carrying siblings matter. A normal Merkle sibling only says "trust this hash while recomputing the root." An NMT sibling also says which namespace interval it covers. The incomplete-response frame shows the key rejection rule: a server cannot replace missing B leaves with a sibling whose range still overlaps B. The range exposes the omission.`,
        `The data-square view proves the system context. Celestia-like blocks arrange shares into an extended data square, commit to rows and columns with NMT roots, and commit to those roots in the header. Coordinate sampling and namespace retrieval are different queries over the same committed data, so the proof format must serve both light-node availability checks and app-specific retrieval.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is a sorted-interval argument plus a Merkle argument. The Merkle argument says the returned leaves and sibling commitments recompute the trusted root, so the proof is about the committed tree rather than a made-up tree. The sorted-interval argument says that if all leaves are ordered by namespace, every occurrence of namespace B must lie between the leftmost and rightmost B position.`,
        `Range metadata connects those arguments. Any skipped subtree whose range does not include B cannot contain B because its min and max namespaces exclude it. Any skipped subtree whose range does include B is unsafe to skip. Therefore a verifier that receives all B leaves and only non-overlapping skipped siblings has a complete namespace response relative to the accepted root.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `After sorting, tree construction is linear in the number of shares for hashing purposes. A single coordinate proof is logarithmic in the tree size. A namespace proof is roughly the returned slice size plus boundary and path data, often described as O(k + log n) for k shares in the namespace. The important behavior is that an app pays for its own data and a small authentication envelope, not for every other app's blob.`,
        `The tradeoff is stricter serialization and verification. Namespace size, namespace ordering, share format, leaf hashing, internal hashing, domain separation, parity namespace handling, and proof rules must be identical across producers and verifiers. The tree also carries more metadata than a plain Merkle tree. That extra metadata is the price of completeness proofs.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Namespaced Merkle trees win in multi-tenant commitments. A modular data availability layer can put many applications into one block while letting each application fetch only its own namespace. A rollup full node can verify that it received all shares for its namespace without trusting the peer that served them. A light node can still use compact row or column proofs while sampling coordinates.`,
        `The pattern also teaches a broader data-structure lesson. When clients need selective completeness, a plain hash tree may not carry enough semantic information. Adding order and range metadata turns an opaque subtree into a safely skippable subtree. The same idea appears in interval trees, authenticated dictionaries, sparse Merkle non-membership proofs, and database indexes that use key ranges to skip pages.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `An NMT is not a full data availability protocol by itself. It authenticates shares and namespace ranges relative to a root. The network still needs erasure coding, block propagation, sampling, repair, retention, and a trusted header. It also does not prove transaction validity. A rollup still needs its own execution checks, fraud proofs, validity proofs, or verifier rules.`,
        `The verifier can lose the main guarantee by checking only the hash path. If it ignores min and max namespaces, a partial namespace proof degenerates into ordinary inclusion proofs. Other failures are implementation-level: inconsistent namespace ordering, malformed reserved namespaces, incorrect parity-share handling, unsafe compact proofs, root mismatch, stale headers, or accepting shares from the wrong block height.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Merkle Tree for ordinary inclusion proofs, Sparse Merkle Tree Non-Membership for absence proofs, Reed-Solomon Erasure Coding for recoverable shares, Data Availability Sampling for light-node availability checks, Content-Addressed Merkle DAG Object Store for hash-linked object identity, KZG Polynomial Commitments for a contrasting commitment family, and Reservoir Sampling for the random-sampling intuition behind availability checks. Then return to NMTs and ask which guarantee comes from hashing, which comes from ordering, and which comes from the accepted root.`,
      ],
    },
  ],
};
