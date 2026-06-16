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
  yield {
    state: appendFlow('Append-only log keeps a frontier of peaks'),
    highlight: { active: ['leaf', 'merge'], found: ['peaks', 'root'] },
    explanation: 'A Merkle Mountain Range is a Merkle tree for an append-only array. Each append creates a new leaf, then repeatedly merges rightmost peaks of equal size. The unmerged peak roots form the frontier.',
    invariant: 'The peak sizes match the 1 bits in the leaf count.',
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
    explanation: 'At seven leaves the frontier has peaks for ranges 4, 2, and 1. Appending the eighth leaf creates a carry chain: 1+1 becomes 2, 2+2 becomes 4, 4+4 becomes 8.',
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
    explanation: 'Appending is like binary addition. Most appends touch only a small suffix of the frontier; an append at a power-of-two boundary carries farther, but the amortized work stays small.',
    invariant: 'Stored nodes are immutable; appending creates new right-edge parents and leaves old ranges intact.',
  };

  yield {
    state: appendFlow('Bagging peaks turns the frontier into one commitment'),
    highlight: { active: ['peaks', 'bag'], found: ['root'] },
    explanation: 'A verifier usually wants one digest, not several peaks. Bagging combines the current peak roots in a deterministic order to produce the published commitment for the whole prefix.',
  };
}

function* proofsAndAudits() {
  yield {
    state: proofFlow('Proofs climb to a peak, then bag with the frontier'),
    highlight: { active: ['entry', 'path', 'peak'], found: ['root'] },
    explanation: 'An inclusion proof gives the sibling hashes needed to recompute the peak containing entry i, plus the other peak roots needed to recompute the bagged root.',
    invariant: 'The verifier needs the claimed root, the leaf index, the leaf value, and a logarithmic proof path.',
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
    explanation: 'The important application is not just membership. A log can publish successive roots, and monitors can ask whether the later root extends the earlier prefix instead of rewriting history.',
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
    explanation: 'Certificate Transparency uses a Merkle history tree. MMRs use a frontier of complete subtrees. Git is a Merkle DAG over snapshots. A write-ahead log is append-only too, but it is not authenticated unless hashes or signatures are layered on top.',
  };

  yield {
    state: proofFlow('Auditors compare roots over time'),
    highlight: { active: ['bag', 'root'], compare: ['path'], found: ['peak'] },
    explanation: 'Transparency systems add social machinery around the data structure: logs publish signed roots, monitors fetch entries, witnesses remember roots, and clients demand proofs. The MMR supplies compact cryptographic evidence; the ecosystem decides what to do when evidence conflicts.',
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
      heading: 'What it is',
      paragraphs: [
        'A Merkle Mountain Range is an append-only authenticated array. Like a Merkle Tree, it hashes leaves and internal nodes so one root commits to many entries. Unlike a fixed balanced tree, it does not need the final size in advance. It keeps a frontier of complete subtree roots called peaks. As new leaves arrive on the right, equal-size peaks merge, and the remaining peaks represent the whole prefix.',
        'This makes MMRs a good mental model for transparency logs, blockchain history, and timestamping systems: data only grows, old ranges should remain immutable, and clients want small proofs instead of downloading the whole log.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The peak sizes are the powers of two in the binary representation of the leaf count. Seven leaves is binary 111, so the frontier has peaks of sizes 4, 2, and 1. Appending the eighth leaf is binary addition: create a size-1 peak, merge 1+1 into 2, merge 2+2 into 4, and merge 4+4 into 8. Most appends only merge a short suffix; occasional carry chains do more work.',
        'To publish one commitment, implementations bag the peaks: combine the peak roots in a deterministic order to produce one digest. To prove inclusion, a server sends the sibling hashes up to the relevant peak plus the other peak roots needed to recompute the bagged root. To prove append-only behavior, the server shows that an older prefix root is preserved inside the later frontier.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Append cost is O(log n) in the worst case and O(1) amortized merges if you count frontier carries over many appends. Inclusion proofs are O(log n) hashes. The frontier itself needs O(log n) peak roots. Stored history is still O(n), because old leaves and internal nodes must remain available for future proofs. The tricky parts are not big-O; they are serialization, hash domain separation, proof format, peak ordering, pruning policy, and root-version bookkeeping.',
      ],
    },
    {
      heading: 'Real-world case studies',
      paragraphs: [
        'Certificate Transparency defines Merkle audit paths and consistency proofs so browsers and monitors can check whether certificates are included and whether a later log root extends an earlier one. The RFC 6962 and RFC 9162 designs use Merkle history trees rather than the exact MMR layout, but the proof vocabulary is the same: inclusion, prefix consistency, signed roots, monitors, and witnesses.',
        'OpenTimestamps describes Merkle Mountain Ranges as a way to keep a deterministic digest for an append-only timestamping log. Grin uses MMRs for blockchain data such as outputs, kernels, and rangeproofs, because nodes can append while still supporting compact proofs over historical state. These systems show the core tradeoff: one compact root is easy to publish, but robust auditing also needs proof serving, root gossip, and long-term storage.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An MMR does not make deletion cheap; it is explicitly append-only. Pruning old leaves may be possible in an application, but then proof availability changes and somebody must retain enough data to satisfy audits. It also does not stop a dishonest operator from publishing two different roots to two audiences by itself. Witnesses, gossip, signed checkpoints, and client policy are needed to expose equivocation.',
        'Do not confuse append-only ordering with database durability. A Write-Ahead Log recovers recent writes after a crash. An MMR authenticates a history so outsiders can verify membership and prefix consistency. Many real systems use both ideas, but they solve different problems.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references: OpenTimestamps MMR notes at https://github.com/opentimestamps/opentimestamps-server/blob/master/doc/merkle-mountain-range.md, Grin MMR documentation at https://docs.grin.mw/wiki/chain-state/merkle-mountain-range/, Certificate Transparency RFC 6962 at https://www.rfc-editor.org/info/rfc6962/, Certificate Transparency v2 RFC 9162 at https://datatracker.ietf.org/doc/html/rfc9162, and the CT overview at https://certificate.transparency.dev/howctworks/. Study Merkle Tree, Git Internals, Transparency Log Witnessing Case Study, Write-Ahead Log (WAL), Byzantine Generals, and Ethereum Merkle-Patricia Trie Case Study next.',
      ],
    },
  ],
};
