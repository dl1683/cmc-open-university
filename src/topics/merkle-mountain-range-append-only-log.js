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
      heading: 'Why this exists',
      paragraphs: [
        'An append-only log is useful only if readers can trust its past. Package registries, timestamping services, transparency logs, blockchain histories, audit ledgers, and build artifact indexes all promise the same basic contract: new entries may appear at the right edge, but old entries must not be edited, removed, or reordered without being detected.',
        'A plain file or database table can accept appends, but it gives weak evidence. A server can show one client one version of history and another client a different version. It can replace an old row and claim the row was always there. It can also publish a short digest that says almost nothing unless clients know how that digest was computed.',
        'A Merkle Mountain Range, or MMR, is an authenticated append-only array. It keeps a compact frontier of complete Merkle subtrees called peaks. Each append creates a new leaf on the right. Equal-size peaks merge. The remaining peaks are combined in a fixed order to publish one commitment for the whole current prefix.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious authenticated approach is a normal balanced Merkle tree. Put the entries in leaves, hash pairs upward, publish the root, and answer inclusion queries with sibling hashes. That works well when the set is fixed or when updates arrive in large batches.',
        'The wall is online growth. An audit log does not know its final length. It may publish a checkpoint after every entry, every block, or every few seconds. Rebuilding a balanced tree after each append wastes work, and reshaping the tree makes it harder to reason about old prefixes. The log needs a shape that accepts one more leaf without moving earlier leaves.',
        'The other weak approach is a chained hash: every entry includes the previous entry hash. That proves local order, but membership proofs are linear unless extra indexes are added. A client that wants proof for entry 50 million should not need 50 million links. The MMR keeps the append-friendly nature of a chain while recovering logarithmic Merkle proofs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core invariant is that the frontier contains one complete subtree for each 1 bit in the binary representation of the leaf count. Seven leaves is binary `111`, so the frontier has peaks of sizes 4, 2, and 1. Ten leaves is binary `1010`, so the frontier has peaks of sizes 8 and 2. This is the same decomposition every integer has into powers of two.',
        'Appending is binary addition implemented with hashes. Add a size-1 peak for the new leaf. If the two rightmost peaks have the same size, hash them into a parent peak twice as large. Continue while there is a carry. When the rightmost peak sizes differ, the frontier again matches the 1 bits of the count.',
        'This insight keeps old ranges stable. A later append may merge an old peak into a larger peak, but it never edits the leaves inside that peak. The peak root acts like a sealed summary of that range. Any change to an old entry changes the peak root and then changes every later commitment that includes it.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The append-peaks view shows the MMR as a small state machine. The new leaf enters as a one-entry subtree. The merge node represents the carry rule. The peaks node is the live frontier, and the root node is the public commitment after bagging. The important shift is from thinking about one giant tree to thinking about a frontier of sealed complete subtrees.',
        'The peak schedule table turns the rule into arithmetic. When the count moves from seven to eight, the table shows `4+2+1+1`, then `4+2+2`, then `4+4`, then `8`. That is exactly a binary carry chain. Most appends stop quickly, but a power-of-two boundary carries through the whole frontier.',
        'The proofs-and-audits view separates two jobs. A membership proof climbs from an entry to the peak that contains it. A whole-log verification then combines that peak with the other peaks to match the published root. An append-only audit asks a different question: can the newer commitment be derived by extending the older frontier instead of changing it?',
      ],
    },
    {
      heading: 'Append mechanism',
      paragraphs: [
        'Each entry is first turned into a leaf hash. Production systems normally use domain separation so a leaf hash cannot be confused with an internal-node hash. A common pattern is to prefix leaf input with one tag and internal-node input with another tag before hashing.',
        'The append operation stores the new leaf as a size-1 peak at the right edge. While the newest peak has the same size as the peak immediately to its left, the implementation removes both peaks and inserts their parent. The parent hash commits to left child, right child, and often the range size or node kind, depending on the proof format.',
        'The frontier can be stored as an array of peaks ordered by position, or as slots indexed by height. The count tells the implementation which heights are currently occupied. The append path creates only the nodes on the carry chain. All older internal nodes can be retained in a proof index, written to a content-addressed store, or regenerated from archived leaves if that is acceptable for the system.',
        'Publishing a root requires bagging the peaks. Bagging means combining all current peak roots in a deterministic order so clients see one digest rather than a list. The order and hash framing must be specified. If one implementation bags left to right and another bags right to left, they will disagree even when they store the same leaves.',
      ],
    },
    {
      heading: 'Proofs and audits',
      paragraphs: [
        'An inclusion proof identifies the leaf index, the leaf value or leaf hash, the sibling hashes needed to climb to the containing peak, and the other peak roots needed to recompute the bagged commitment. The verifier hashes upward inside the peak, then bags the result with the rest of the frontier and compares it with the signed root.',
        'A consistency or append-only proof compares two checkpoints. The old checkpoint commits to an old prefix. The new checkpoint should contain that prefix plus later leaves. The proof shows where the old peaks appear in the newer structure: either still as peaks, or as descendants inside newer merged peaks. If an old entry was changed, the old peak root cannot be preserved.',
        'The evidence is compact compared with replaying the whole log. A proof grows with the height of the containing peak and with the number of peaks needed for the bagged root. That is why MMRs are useful for clients that store a small checkpoint but do not mirror the entire log.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument starts with the uniqueness of the binary decomposition. For a given leaf count, there is only one set of peak sizes. If the append algorithm maintains those sizes and preserves left-to-right order, the shape of the frontier is deterministic.',
        'Inside each peak, ordinary Merkle-tree reasoning applies. The peak root commits to every leaf under it because changing any leaf changes the hash path to the peak root. Bagging extends that commitment to the whole prefix by committing to the ordered set of peak roots.',
        'Append-only history follows from immutability plus position. Appending creates new right-edge material and may create parents above older peaks, but it cannot alter an old sealed subtree without changing the old peak root. A signed checkpoint gives auditors a stable value to compare against later checkpoints.',
      ],
    },
    {
      heading: 'Costs and implementation guidance',
      paragraphs: [
        'Worst-case append work is `O(log n)` because a carry can merge peaks at every height. Across many appends, the amortized number of merges is small, just like binary counters. The live frontier stores `O(log n)` peak roots. Inclusion proofs are logarithmic in the range that contains the leaf, plus the extra peak data needed to verify the bagged root.',
        'The implementation details matter more than the small algorithm suggests. Specify leaf hash framing, internal hash framing, peak ordering, bagging order, index base, byte encoding, hash function, checkpoint format, and signature format. A verifier should reject proofs with ambiguous encodings or unexpected node kinds.',
        'Plan storage around proof serving. The frontier alone is enough to append, but it is not enough to answer arbitrary old inclusion queries. A log that promises proofs must keep leaves and internal nodes, or keep enough auxiliary indexes to reconstruct paths. Pruning can be valid, but only if another archival party or checkpoint policy covers the proofs the system still advertises.',
        'Operationally, publish signed checkpoints with a count and root. Monitors should fetch entries, request random proofs, and compare checkpoint chains over time. Witnesses can remember roots from multiple logs or clients. Client policy should define what happens when a proof is missing, malformed, or inconsistent with a previous checkpoint.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an artifact registry publishes one log entry for every package build. After seven builds, the frontier has peaks of sizes 4, 2, and 1. A client stores a signed checkpoint containing count 7 and the bagged root.',
        'The eighth build arrives. The registry hashes the new entry as a size-1 leaf. The two size-1 peaks merge into a size-2 peak. That size-2 peak merges with the existing size-2 peak. The resulting size-4 peak merges with the existing size-4 peak. The new frontier is one size-8 peak.',
        'Later, a client asks whether build 3 is included at count 8. The server returns the sibling path from build 3 up to the old size-4 peak, then enough data to show how that old range was merged into the size-8 peak. If the registry changed build 3, the first peak root would differ. If it showed two clients different count-8 roots, witnesses or monitors could expose the conflict by comparing signed checkpoints.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'MMRs win when the natural operation is append and the system needs compact cryptographic evidence. Good fits include timestamping services, blockchain history, package indexes, artifact registries, archival catalogs, replicated audit ledgers, and logs used by independent verifiers.',
        'They are also useful when readers are light clients. A client can remember a small checkpoint, request an inclusion proof for one entry, and ask whether a later checkpoint extends the earlier one. The client does not need to download every log entry to catch many forms of rewriting.',
        'The pattern also teaches transparency systems more broadly. Certificate Transparency uses a Merkle history tree rather than this exact MMR layout, but the surrounding practice is shared: signed roots, inclusion proofs, consistency evidence, monitors, witnesses, and clients that refuse unverifiable history.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'An MMR is a poor shape for frequent deletion, mutation, or insertion in the middle. You can append corrections, tombstones, revocations, or superseding entries, but the historical record remains. That is a feature for audit logs and a bad fit for mutable indexes.',
        'The structure also does not stop split views by itself. A dishonest operator can publish one valid append-only history to one audience and another valid append-only history to a different audience. Detecting that requires witnesses, gossip, checkpoint exchange, monitor coverage, and client policy that makes equivocation costly.',
        'Proof formats can become a source of bugs. Ambiguous serialization, missing domain separation, unclear peak order, weak hash choices, and inconsistent count handling can break interoperability or create verification gaps. Treat the format as a protocol, not as a helper function hidden inside one codebase.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study ordinary Merkle trees first, then compare MMRs with Certificate Transparency history trees. Then study sparse Merkle trees for key-value membership, Merkle Patricia tries for authenticated maps, Git object graphs for content-addressed snapshots, and write-ahead logs for durability without authentication.',
        'Good primary references include OpenTimestamps MMR notes, Grin MMR documentation, Certificate Transparency RFC 6962, Certificate Transparency version 2 in RFC 9162, and real transparency-log witness designs. The next practical exercise is to write a verifier that rejects malformed proofs before it checks the final root.',
      ],
    },
  ],
};
