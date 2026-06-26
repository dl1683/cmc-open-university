// Merkle Mountain Range: an append-only authenticated array. New leaves append
// on the right, equal-size peaks merge, and the current root is made by bagging
// the remaining peaks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'merkle-mountain-range-append-only-log',
  title: 'Merkle Mountain Range Append-Only Log',
  category: 'Systems',
  summary: 'An append-only Merkle accumulator: store peaks for powers-of-two ranges, merge on append, and prove old prefixes stayed intact.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['append peaks', 'proofs and audits'], defaultValue: 'append peaks' },
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

function appendFlow(title) {
  return graphState({
    nodes: [
      { id: 'leaf', label: 'leaf', x: 0.8, y: 3.2, note: 'new item' },
      { id: 'merge', label: 'merge', x: 2.7, y: 3.2, note: 'equal peaks' },
      { id: 'peaks', label: 'peaks', x: 4.6, y: 3.2, note: 'frontier' },
      { id: 'bag', label: 'bag', x: 6.5, y: 3.2, note: 'combine' },
      { id: 'root', label: 'root', x: 8.4, y: 3.2, note: 'commit' },
    ],
    edges: [
      { id: 'e-leaf-merge', from: 'leaf', to: 'merge' },
      { id: 'e-merge-peaks', from: 'merge', to: 'peaks' },
      { id: 'e-peaks-bag', from: 'peaks', to: 'bag' },
      { id: 'e-bag-root', from: 'bag', to: 'root' },
    ],
  }, { title });
}

function proofFlow(title) {
  return graphState({
    nodes: [
      { id: 'entry', label: 'entry', x: 0.8, y: 3.2, note: 'index i' },
      { id: 'path', label: 'path', x: 2.7, y: 3.2, note: 'siblings' },
      { id: 'peak', label: 'peak', x: 4.6, y: 3.2, note: 'range root' },
      { id: 'bag', label: 'bag', x: 6.5, y: 3.2, note: 'other peaks' },
      { id: 'root', label: 'root', x: 8.4, y: 3.2, note: 'verify' },
    ],
    edges: [
      { id: 'e-entry-path', from: 'entry', to: 'path' },
      { id: 'e-path-peak', from: 'path', to: 'peak' },
      { id: 'e-peak-bag', from: 'peak', to: 'bag' },
      { id: 'e-bag-root', from: 'bag', to: 'root' },
    ],
  }, { title });
}

function* appendPeaks() {
  const peakScheduleSize = 8; // n=1 through n=8
  const appendSteps = 4; // leaf, 1-merge, 2-merge, 4-merge
  const peaksAtSeven = [4, 2, 1];

  yield {
    state: appendFlow('Append-only log keeps a frontier of peaks'),
    highlight: { active: ['leaf', 'merge'], found: ['peaks', 'root'] },
    explanation: `A Merkle Mountain Range is a Merkle tree for an append-only array. Each append creates a new leaf, then repeatedly merges rightmost peaks of equal size. The ${peaksAtSeven.length} unmerged peak roots form the frontier.`,
    invariant: `The peak sizes match the 1 bits in the leaf count — ${peaksAtSeven.length} peaks for ${peaksAtSeven.length} set bits.`,
  };

  yield {
    state: labelMatrix(
      'Peak schedule',
      [
        { id: 'n1', label: 'n=1' },
        { id: 'n2', label: 'n=2' },
        { id: 'n3', label: 'n=3' },
        { id: 'n4', label: 'n=4' },
        { id: 'n5', label: 'n=5' },
        { id: 'n6', label: 'n=6' },
        { id: 'n7', label: 'n=7' },
        { id: 'n8', label: 'n=8' },
      ],
      [
        { id: 'binary', label: 'binary' },
        { id: 'peaks', label: 'peaks' },
      ],
      [
        ['001', '1'],
        ['010', '2'],
        ['011', '2+1'],
        ['100', '4'],
        ['101', '4+1'],
        ['110', '4+2'],
        ['111', '4+2+1'],
        ['1000', '8'],
      ],
    ),
    highlight: { active: ['n7:peaks'], found: ['n8:peaks'] },
    explanation: `At ${peakScheduleSize - 1} leaves the frontier has peaks for ranges ${peaksAtSeven.join(', ')}. Appending the ${peakScheduleSize}th leaf creates a carry chain: 1+1 becomes 2, 2+2 becomes 4, 4+4 becomes ${peakScheduleSize}.`,
  };

  yield {
    state: labelMatrix(
      'Append 8',
      [
        { id: 'leaf', label: 'leaf' },
        { id: 'one', label: '1 merge' },
        { id: 'two', label: '2 merge' },
        { id: 'four', label: '4 merge' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'frontier', label: 'frontier' },
      ],
      [
        ['add leaf', '4+2+1+1'],
        ['hash pair', '4+2+2'],
        ['hash pair', '4+4'],
        ['hash pair', '8'],
      ],
    ),
    highlight: { active: ['one:action', 'two:action', 'four:action'], found: ['four:frontier'] },
    explanation: `Appending is like binary addition. Most appends touch only a small suffix of the frontier; an append at a power-of-two boundary carries through all ${appendSteps} merge steps, but the amortized work stays small.`,
    invariant: `Stored nodes are immutable; appending creates new right-edge parents across up to ${appendSteps} levels and leaves old ranges intact.`,
  };

  yield {
    state: appendFlow('Bagging peaks turns the frontier into one commitment'),
    highlight: { active: ['peaks', 'bag'], found: ['root'] },
    explanation: `A verifier usually wants one digest, not ${peaksAtSeven.length} separate peaks. Bagging combines the current peak roots in a deterministic order to produce the published commitment for the whole prefix.`,
  };
}

function* proofsAndAudits() {
  const auditTypes = 4; // inclusion, prefix, append-only, equivocate
  const relatedStructures = 4; // CT tree, MMR, Git DAG, WAL

  yield {
    state: proofFlow('Proofs climb to a peak, then bag with the frontier'),
    highlight: { active: ['entry', 'path', 'peak'], found: ['root'] },
    explanation: `An inclusion proof — the first of ${auditTypes} audit claims — gives the sibling hashes needed to recompute the peak containing entry i, plus the other peak roots needed to recompute the bagged root.`,
    invariant: `The verifier needs ${auditTypes} pieces: the claimed root, the leaf index, the leaf value, and a logarithmic proof path.`,
  };

  yield {
    state: labelMatrix(
      'Audit claims',
      [
        { id: 'include', label: 'inclusion' },
        { id: 'prefix', label: 'prefix' },
        { id: 'append', label: 'append-only' },
        { id: 'equiv', label: 'equivocate' },
      ],
      [
        { id: 'claim', label: 'claim' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['entry in log', 'path hashes'],
        ['old root kept', 'old peaks'],
        ['new extends old', 'consistency'],
        ['two roots conflict', 'witnesses'],
      ],
    ),
    highlight: { found: ['include:evidence', 'append:evidence'], compare: ['equiv:evidence'] },
    explanation: `The important application is not just membership. Across all ${auditTypes} audit types, a log can publish successive roots, and monitors can ask whether the later root extends the earlier prefix instead of rewriting history.`,
  };

  yield {
    state: labelMatrix(
      'Related structures',
      [
        { id: 'ct', label: 'CT tree' },
        { id: 'mmr', label: 'MMR' },
        { id: 'git', label: 'Git DAG' },
        { id: 'wal', label: 'WAL' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'job', label: 'job' },
      ],
      [
        ['history tree', 'audit log'],
        ['peak frontier', 'append proof'],
        ['hash DAG', 'snapshot id'],
        ['plain log', 'recovery'],
      ],
    ),
    highlight: { active: ['ct:job', 'mmr:job'], found: ['git:shape'], compare: ['wal:shape'] },
    explanation: `These ${relatedStructures} related structures each solve append differently: Certificate Transparency uses a Merkle history tree, MMRs use a frontier of complete subtrees, Git is a Merkle DAG over snapshots, and a write-ahead log is append-only too but not authenticated unless hashes or signatures are layered on top.`,
  };

  yield {
    state: proofFlow('Auditors compare roots over time'),
    highlight: { active: ['bag', 'root'], compare: ['path'], found: ['peak'] },
    explanation: `Transparency systems add social machinery around the data structure: logs publish signed roots, monitors fetch entries, witnesses remember roots, and clients demand proofs. The MMR supplies compact cryptographic evidence across ${auditTypes} claim types; the ecosystem decides what to do when evidence conflicts.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'append peaks') yield* appendPeaks();
  else if (view === 'proofs and audits') yield* proofsAndAudits();
  else throw new InputError('Pick a merkle-mountain-range view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The append view shows a frontier of peaks. A peak is a complete Merkle subtree, and the frontier is the ordered list of peak roots that cover the current log prefix. A new entry becomes a size-1 peak on the right.',
        'The safe inference rule is binary addition with hashes. If the two rightmost peaks have equal size, merge them into one peak twice as large, just like a carry bit. The proofs view shows an entry path climbing to its peak and then combining with other peaks to verify the published root.',
        {type: 'image', src: './assets/gifs/merkle-mountain-range-append-only-log.gif', alt: 'Animated walkthrough of the merkle mountain range append only log visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        {type: 'callout', text: 'An MMR is binary addition over Merkle peaks: appends create carry chains without moving old leaves.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Append-only logs need compact evidence that old history was not rewritten. Package registries, transparency services, timestamping systems, blockchains, and build ledgers all publish new entries over time. Readers need to verify inclusion and extension without downloading the whole log.',
        'A Merkle Mountain Range, or MMR, is an authenticated append-only array. Authenticated means hashes let a verifier check claims against a root. Append-only means new leaves are added at the right edge while old leaf positions remain stable.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A normal Merkle tree is the obvious authenticated structure. Put entries in leaves, hash upward, publish a root, and answer inclusion queries with sibling paths. It works well when the set is fixed or rebuilt in batches.',
        'A hash chain is the obvious append-friendly structure. Each entry includes the previous entry hash, so local order is easy to check. It is simple, but proving membership for entry i can require walking many links unless extra indexes are added.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'An online log does not know its final size. Rebuilding or reshaping one balanced tree after every append wastes work and complicates old prefix proofs. The system needs a shape where adding one leaf touches only a small right-edge region.',
        'A chain has the opposite problem. Appending is cheap, but random inclusion proofs are long because the structure is mostly linear. The wall is finding a layout that has chain-like append behavior and Merkle-like logarithmic proofs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent the leaf count in binary. Each 1 bit corresponds to one complete Merkle subtree in the frontier. Seven leaves is binary 111, so the frontier has peaks of sizes 4, 2, and 1; ten leaves is binary 1010, so it has peaks of sizes 8 and 2.',
        'Appending a leaf is binary increment. Add a size-1 peak, merge equal-size rightmost peaks while carries exist, and stop when peak sizes are distinct. The remaining peaks cover the whole prefix in left-to-right order without moving old leaves.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt: 'Binary hash tree with leaf blocks feeding parent hashes up to a root', caption: 'Each MMR peak is an ordinary complete Merkle subtree sealed by its root hash. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_Tree.svg.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each entry is hashed as a leaf with explicit framing so leaf bytes cannot be confused with internal-node bytes. The implementation stores the new leaf as a peak of height 0. While the previous peak has the same height, hash the pair into a parent peak and continue the carry.',
        'To publish one commitment, the system bags the current peaks. Bagging means combining peak roots in a specified order with specified hash framing. The count must be part of the checkpoint because the same peak roots without a count can be ambiguous across protocols.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Cryptographic_Hash_Function.svg', alt: 'Several inputs entering a cryptographic hash function and producing different digests', caption: 'Hash framing decides whether the verifier can distinguish leaves, internal nodes, and bagged peaks. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cryptographic_Hash_Function.svg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness starts with unique binary decomposition. For a given leaf count, there is exactly one set of powers of two that covers the prefix. If the frontier keeps those powers in order, it covers every leaf once and only once.',
        'Inside each peak, ordinary Merkle-tree reasoning applies. Changing any leaf changes the path to that peak root with overwhelming probability. Bagging commits to the ordered set of peak roots, so the final root commits to the whole prefix.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Worst-case append work is O(log n), because appending at a power-of-two boundary carries through every current peak. Amortized append work is small, like incrementing a binary counter. The live frontier stores O(log n) peak roots.',
        'Proof size is logarithmic inside the containing peak plus the peak data needed for bagging. When the log grows from 1,024 to 2,048 entries, the maximum peak height increases by one. A verifier pays one more hash on the longest path, not another thousand entries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MMRs fit append-heavy authenticated histories. Blockchain history, timestamped ledgers, package transparency, artifact registries, archival catalogs, and signed build indexes can use the shape to publish compact checkpoints and answer inclusion queries. The access pattern is append now, prove old entries later.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt: 'Directed acyclic graph arranged in topological order with edges pointing forward', caption: 'Checkpoint history should move forward in one append-only order; audits check that later roots extend earlier roots. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Topological_Ordering.svg.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'An MMR is the wrong shape for frequent deletion or mutation. Corrections can be appended as new entries, but old entries remain part of history. That is desirable for audit logs and awkward for ordinary mutable indexes.',
        'The structure also does not prevent split views by itself. A dishonest operator can show two valid append-only histories to two audiences unless witnesses, monitors, gossip, or client checkpoint exchange expose the conflict. The data structure supplies evidence; the ecosystem decides how evidence is shared.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with seven leaves. The count 7 is binary 111, so the frontier has peaks of sizes 4, 2, and 1. The published root is the deterministic bagging of those peak roots.',
        'Append the eighth leaf. The new size-1 peak meets the old size-1 peak and merges into size 2. That size-2 peak merges with the old size-2 peak, then the resulting size-4 peak merges with the old size-4 peak, leaving one size-8 peak.',
        'An inclusion proof for leaf 3 at count 8 sends the sibling hashes needed to climb inside the left size-4 range, then the hashes needed to show that range was merged into the size-8 root. If the log operator changed leaf 3, the old size-4 peak would change and the proof would not match the signed checkpoint.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Merkle trees first, then read MMR documentation from systems such as Grin and OpenTimestamps, plus Certificate Transparency RFCs for related append-only proof ideas. The stable principle is binary-count frontiers over complete Merkle peaks.',
        'Study Transparency Log Witnessing, Sparse Merkle Tree, Merkle Patricia Trie, Git Merkle DAG, and Write-Ahead Log next. They solve neighboring problems: append auditability, key-value authentication, content-addressed snapshots, and durability without necessarily providing compact cryptographic proofs.',
      ],
    },
  ],
};
