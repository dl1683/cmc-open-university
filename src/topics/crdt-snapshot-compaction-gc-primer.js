// CRDT snapshot compaction and garbage collection: update logs, snapshots,
// state vectors, heads, peer lag, tombstones, and safe history rewriting.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'crdt-snapshot-compaction-gc-primer',
  title: 'CRDT Snapshot Compaction & Garbage Collection',
  category: 'Systems',
  summary: 'A local-first storage primer: fold update logs into snapshots, retain causal summaries, respect lagging peers, and garbage-collect tombstones only when sync safety allows.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['snapshot compaction', 'gc safety'], defaultValue: 'snapshot compaction' },
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

function compactGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'ops', label: 'ops', x: 0.7, y: 4.0, note: notes.ops ?? 'log' },
      { id: 'state', label: 'state', x: 2.4, y: 2.5, note: notes.state ?? 'material' },
      { id: 'summary', label: 'summary', x: 2.4, y: 5.5, note: notes.summary ?? 'heads/sv' },
      { id: 'snap', label: 'snap', x: 4.4, y: 4.0, note: notes.snap ?? 'checkpoint' },
      { id: 'tail', label: 'tail', x: 6.2, y: 2.5, note: notes.tail ?? 'recent ops' },
      { id: 'peer', label: 'peer', x: 6.2, y: 5.5, note: notes.peer ?? 'lag' },
      { id: 'gc', label: 'gc', x: 8.0, y: 4.0, note: notes.gc ?? 'drop' },
      { id: 'store', label: 'store', x: 9.3, y: 4.0, note: notes.store ?? 'smaller' },
    ],
    edges: [
      { id: 'e-ops-state', from: 'ops', to: 'state', weight: '' },
      { id: 'e-ops-summary', from: 'ops', to: 'summary', weight: '' },
      { id: 'e-state-snap', from: 'state', to: 'snap', weight: '' },
      { id: 'e-summary-snap', from: 'summary', to: 'snap', weight: '' },
      { id: 'e-snap-tail', from: 'snap', to: 'tail', weight: '' },
      { id: 'e-peer-gc', from: 'peer', to: 'gc', weight: '' },
      { id: 'e-tail-gc', from: 'tail', to: 'gc', weight: '' },
      { id: 'e-gc-store', from: 'gc', to: 'store', weight: '' },
    ],
  }, { title });
}

function* snapshotCompaction() {
  const pipelineNodes = ['ops', 'state', 'summary', 'snap', 'tail', 'peer', 'gc', 'store'];
  yield {
    state: compactGraph('CRDT storage needs snapshots plus causal summaries'),
    highlight: { active: ['ops', 'state', 'summary', 'snap', 'e-ops-state', 'e-ops-summary'], found: ['store'] },
    explanation: `The ${pipelineNodes.length}-node graph shows what must survive a compaction. You can fold old operations into a checkpoint, but the snapshot still needs a causal summary so future peers know what history it represents.`,
    invariant: `A compacted snapshot at "${pipelineNodes[3]}" must still know what history it represents.`,
  };

  const survivalRows = [
    { id: 'state', label: 'doc state' },
    { id: 'heads', label: 'heads' },
    { id: 'sv', label: 'state vec' },
    { id: 'tail', label: 'recent tail' },
  ];
  yield {
    state: labelMatrix(
      'What must survive compaction',
      survivalRows,
      [
        { id: 'why', label: 'why' },
        { id: 'breaks', label: 'if lost' },
      ],
      [
        ['fast load', 'empty doc'],
        ['frontier', 'bad sync'],
        ['clock cuts', 'resend all'],
        ['peer gaps', 'lost diff'],
      ],
    ),
    highlight: { found: ['heads:why', 'sv:why'], compare: ['tail:breaks'] },
    explanation: `Visible document bytes are only 1 of ${survivalRows.length} survival requirements (${survivalRows.map(r => r.label).join(', ')}). Heads, state vectors, and a recent tail are what let sync continue after compaction.`,
  };

  yield {
    state: compactGraph('Compaction keeps a checkpoint and recent operation tail', { snap: 'base', tail: 'after base', store: 'base+tail' }),
    highlight: { active: ['snap', 'tail', 'store', 'e-snap-tail', 'e-gc-store'], compare: ['ops'] },
    explanation: `Base plus tail is the common shape across the ${pipelineNodes.length}-node pipeline. Load the compact base, replay recent updates, and keep enough tail to serve peers that are only slightly behind.`,
  };

  const compactionStyles = [
    { id: 'merge', label: 'merge upd' },
    { id: 'snapshot', label: 'snapshot' },
    { id: 'rewrite', label: 'rewrite hist' },
    { id: 'archive', label: 'archive' },
  ];
  yield {
    state: labelMatrix(
      'Compaction styles',
      compactionStyles,
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['dedupe bytes', 'still history'],
        ['fast load', 'serve old peer'],
        ['small runtime', 'wrong deps'],
        ['audit trail', 'privacy cost'],
      ],
    ),
    highlight: { active: ['merge:benefit', 'snapshot:benefit'], compare: ['rewrite:risk'] },
    explanation: `${compactionStyles.length} compaction styles (${compactionStyles.map(s => s.label).join(', ')}) are different tools with the same danger. Rewriting history is unsafe if peers, undo, audit, or old snapshots still depend on old IDs.`,
  };

  yield {
    state: compactGraph('The store shrinks only after safety checks pass', { peer: 'known', gc: 'safe cut', store: 'compact' }),
    highlight: { active: ['peer', 'gc', 'store', 'e-peer-gc', 'e-gc-store'], found: ['snap', 'summary'] },
    explanation: `The safe cut is a protocol and product decision involving ${pipelineNodes.length} pipeline stages. Age is a hint, not proof. Known peer state, retention policy, audit requirements, privacy deletion, and snapshot reset rules decide what may disappear.`,
  };
}

function* gcSafety() {
  const gcBlockers = [
    { id: 'offline', label: 'offline peer' },
    { id: 'snapshot', label: 'old snap' },
    { id: 'undo', label: 'undo stack' },
    { id: 'audit', label: 'audit' },
  ];
  yield {
    state: labelMatrix(
      'Garbage collection blockers',
      gcBlockers,
      [
        { id: 'needs', label: 'needs' },
        { id: 'blocks', label: 'blocks' },
      ],
      [
        ['missing ops', 'op purge'],
        ['old IDs', 'tomb purge'],
        ['inverse ops', 'delete GC'],
        ['history', 'rewrite'],
      ],
    ),
    highlight: { active: ['offline:blocks', 'undo:blocks'], compare: ['audit:blocks'] },
    explanation: `Garbage collection has ${gcBlockers.length} blockers (${gcBlockers.map(b => b.label).join(', ')}). It is not just freeing memory. Offline peers, old snapshots, undo stacks, and audit trails may all still reference metadata invisible in the current document.`,
    invariant: `All ${gcBlockers.length} blocker categories must be checked: if future sync can refer to it, GC cannot blindly erase it.`,
  };

  yield {
    state: compactGraph('Lagging peers define a safe cut', { peer: 'min known', gc: 'cut', tail: 'keep after' }),
    highlight: { active: ['peer', 'tail', 'gc', 'e-peer-gc', 'e-tail-gc'], compare: ['ops'] },
    explanation: `If the system knows every active peer has seen a prefix of history, it can compact before that cut. Without that knowledge across all ${gcBlockers.length} blocker types, the conservative answer is to keep more history or force a resync from snapshot.`,
  };

  const tombstoneRoles = [
    { id: 'delete', label: 'delete mark' },
    { id: 'anchor', label: 'anchor' },
    { id: 'render', label: 'render' },
    { id: 'purge', label: 'purge' },
  ];
  yield {
    state: labelMatrix(
      'Tombstone cleanup',
      tombstoneRoles,
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hide elem', 'metadata'],
        ['future refs', 'lost insert'],
        ['skip elem', 'cheap'],
        ['remove ids', 'bad peer'],
      ],
    ),
    highlight: { found: ['delete:role', 'anchor:role'], compare: ['purge:risk'] },
    explanation: `Tombstones serve ${tombstoneRoles.length} lifecycle roles (${tombstoneRoles.map(r => r.label).join(', ')}). They are ugly but useful: they can be the only anchor a future remote operation understands. Purging them safely requires evidence that no future update can reference those IDs.`,
  };

  const policies = [
    { id: 'small', label: 'small team' },
    { id: 'offline', label: 'offline app' },
    { id: 'regulated', label: 'regulated' },
    { id: 'public', label: 'public doc' },
  ];
  yield {
    state: labelMatrix(
      'Policy choices',
      policies,
      [
        { id: 'policy', label: 'policy' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['keep more', 'simple'],
        ['snap reset', 'large store'],
        ['archive', 'privacy'],
        ['truncate old', 'break old tabs'],
      ],
    ),
    highlight: { active: ['offline:policy', 'regulated:policy'], compare: ['public:tradeoff'] },
    explanation: `${policies.length} deployment contexts (${policies.map(p => p.label).join(', ')}) need different GC policies. Some products prefer durable audit history; others prefer privacy deletion or small client stores.`,
  };

  yield {
    state: compactGraph('Safe GC is a protocol plus product contract', { summary: 'proof', peer: 'known', gc: 'policy', store: 'retained' }),
    highlight: { active: ['summary', 'peer', 'gc', 'store'], found: ['snap'] },
    explanation: `The final graph is the right mental model: checkpointing plus distributed sync plus product policy. Aggressive GC is fine only when the protocol addresses all ${gcBlockers.length} blocker categories.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'snapshot compaction') yield* snapshotCompaction();
  else if (view === 'gc safety') yield* gcSafety();
  else throw new InputError('Pick a CRDT compaction view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Snapshot compaction" traces the pipeline from a raw operation log to a compact store. "GC safety" traces the blockers that prevent safe deletion of old metadata. Switch between them to see both halves of the problem.',
        {
          type: 'callout',
          text: 'A compacted CRDT snapshot is safe only when it preserves both visible state and the causal summary needed for future sync.',
        },
        'Active nodes (highlighted) mark the current decision point -- the stage of the pipeline being evaluated right now. Found markers are outcomes the system has committed to: a checkpoint written, a cut declared safe, a store shrunk. Compare markers flag the tension between what the step wants to discard and what correctness requires it to keep.',
        'At each frame, ask three questions: what information survived the step, what was discarded, and what invariant makes that discard safe. If you cannot answer the third question, the step is not safe. That framing is the entire intellectual content of compaction.',
        {type: 'image', src: './assets/gifs/crdt-snapshot-compaction-gc-primer.gif', alt: 'Animated walkthrough of the crdt snapshot compaction gc primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Follow the animation through both views before reading on. The rest of the article explains what the animation shows, but seeing the pipeline first gives you a scaffold for the details.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A CRDT (Conflict-free Replicated Data Type) lets multiple replicas of a document edit independently and merge without a central coordinator. Each operation -- every character typed, every field changed, every element deleted -- gets a causal identity: a unique tag that records who created it and what it depends on. That identity is what lets two peers merge without conflict resolution logic: operations are placed in the causal graph by their identities, and the merge function is defined over the set of operations, not their arrival order.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png',
          alt: 'Vector clock diagram showing causal regions and independent concurrent events',
          caption: 'Vector clocks visualize the causal summaries that compacted replicas must preserve. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png',
        },
        'The cost of this design is history. Every operation must remain in the log so that future merges can locate causal parents and place new operations correctly. A collaborative document with 50,000 edits may show only 2,000 characters of visible text. Without compaction, opening that document replays all 50,000 operations, the browser\'s IndexedDB stores every tombstone (a marker that says "this element was deleted") and every clock entry, and syncing with another peer transmits metadata the receiver already has.',
        'Storage grows linearly with total edit count, not with document size. A one-year-old document touched daily by three users can easily carry hundreds of megabytes of metadata for a few kilobytes of visible content. Compaction exists to break that proportionality while preserving the causal information that sync still needs.',
        'The problem is not merely engineering convenience. On mobile browsers, IndexedDB has storage quotas. On embedded devices, flash storage is finite. And startup time -- the time from "user opens document" to "user can type" -- is bounded by how fast the system can replay the operation log. Compaction turns a linear replay into a constant-time snapshot load plus a short tail replay.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Two strategies present themselves immediately, and both fail in instructive ways.',
        'Strategy one: keep everything forever. Every operation stays in the log. Offline peers always find their causal parents when they reconnect. Undo works by inverting any past operation. Audit trails are trivially complete. The problem is that storage and startup cost grow without bound. There is no mechanism to reclaim space, and the growth rate is proportional to edit activity, not to document size. A whiteboard app generating 1,000 operations per minute of drawing will consume gigabytes within hours.',
        'Strategy two: export and replace. Serialize the visible document state to JSON, delete all CRDT metadata, and start the CRDT log fresh. The document looks correct on load -- the text is right, the fields are right, everything renders. But the first time a peer tries to sync, the system has no state vector (the compact summary of "which operations I have already seen"), no heads (the frontier of the causal DAG), and no way to compute a diff. It must fall back to sending the entire document, or it silently drops concurrent edits it cannot place.',
        'A third tempting shortcut is age-based deletion: drop operations older than 30 days. This is unsafe because age does not imply unreferenced. An operation from six months ago may be the causal parent of a future insert from a peer that went offline in January and came back in July. CRDT garbage collection must answer "who can still reference this ID," not "how old is it."',
        'Each of these failures points at the same constraint: you cannot discard causal metadata unless you can prove that no future sync will need it. The question is how to make that proof tractable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a single invariant: a compacted snapshot must still identify which history it represents so that incremental sync remains possible. Specifically, the snapshot must carry enough information to answer the question "given a remote peer\'s state vector, which operations am I missing and which do I already have?"',
        'Break that invariant and the system looks fine locally. The document renders, the user edits, everything feels normal. The failure surfaces only on sync. A remote peer sends an update whose causal parent is "operation 47 from peer B." The compacted replica no longer knows whether it has already applied operation 47. It cannot compute a diff. It cannot detect a duplicate. It cannot place the new insert at the right position in the document.',
        'The result is one of three outcomes, all bad: silent data loss (the update is discarded because the system cannot verify it), duplicate insertion (the update is applied again because the system cannot recognize it), or a crash (the system detects inconsistency and gives up). None of these produce a user-visible error before the damage is done.',
        'The wall is not performance. A slow full-sync fallback would be tolerable -- inefficient but correct. The wall is correctness: without causal summaries, the replica cannot distinguish "I have already applied this" from "I have never seen this," and merge becomes semantically undefined. No amount of clever engineering can recover from a missing causal summary; the information is simply gone.',
        'This is why naive compaction (strategies one and two above) always fails eventually. The challenge is to discard the operation log while retaining a compact proof of what it contained.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that you do not need the operations themselves to prove what you have seen. You only need a summary that maps each peer to the highest operation number you have absorbed from that peer. This summary is called a state vector (in Yjs) or a set of heads (in Automerge), and it is a lossless compression of "which operations are reflected in my state."',
        'A state vector with three entries -- {Alice: 47, Bob: 31, Carol: 12} -- tells you that this replica has absorbed all of Alice\'s operations through number 47, all of Bob\'s through 31, and all of Carol\'s through 12. That is 24 bytes of metadata that summarizes an arbitrarily large operation log. When a peer presents its own state vector, you compare the two vectors entry by entry and send only the operations it is missing.',
        'The compression works because CRDT operations are uniquely identified by (peer ID, sequence number) pairs, and each peer\'s sequence numbers are monotonically increasing. You never need to enumerate every operation you have seen; you only need the frontier -- the maximum from each peer. Everything below the frontier is implicitly included.',
        'This is the same principle behind a write-ahead log checkpoint in a database. The checkpoint captures materialized state plus a log sequence number. Operations before that number are represented by the checkpoint; operations after it are replayed from the log tail. The checkpoint does not contain the operations -- it contains their effect plus a proof of which ones contributed to that effect.',
        'Once you see this, compaction becomes a mechanical procedure: materialize the document, record the state vector, write both as a snapshot, and discard operations that the state vector proves are already reflected. The hard part shifts from "how to compact" to "when is it safe to garbage-collect the metadata that compaction preserved."',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Safe compaction preserves three things: materialized state, causal summary, and a recent operation tail. The materialized state is what the user sees -- the rendered text, map, or array. The causal summary is the state vector or heads that proves which operations are reflected. The recent tail is the set of operations that arrived after the snapshot was taken, kept as individual entries so that lagging peers can receive incremental diffs.',
        'The compaction pipeline has five stages. First, materialize the current document state from the full operation log. Second, record the causal summary -- in Yjs, a state vector mapping each peer to its highest known clock; in Automerge, the set of change hashes at the DAG frontier. Third, write the snapshot atomically: state plus summary plus an encoding version number. Fourth, determine a safe cut point by examining known peer clocks against the summary. Fifth, discard operations before the cut and retain the tail after it.',
        'The cut point is the hard decision. Everything before it is represented by the snapshot. Everything after it stays as individual operations in the tail. A peer whose state vector is at or past the cut can receive a diff computed from the tail -- fast and incremental. A peer whose state vector predates the cut must download the full snapshot and restart from that checkpoint -- slow but correct.',
        'In practice, the cut point is set to the minimum clock value across all known peers. If Alice is at clock 47, Bob at 31, and Carol at 12, the cut is at Carol\'s position. Operations through clock 12 from each peer are safe to fold into the snapshot because every known peer has already seen them. Operations 13 through 47 stay in the tail. If Carol reconnects, she receives the diff from 12 onward. If a completely unknown peer appears, it gets the full snapshot.',
        'Garbage collection goes one step further than compaction. Compaction folds operations into a snapshot but retains their identities as tombstones (for deletes) and positional anchors. GC removes even those identities, freeing memory that tombstones occupied. GC is safe only when no peer -- including unknown future peers -- can reference the deleted identifiers. This requires a stronger guarantee than compaction: either a closed membership set (you know every peer) or a protocol that forces stale peers to reset from the snapshot.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on a preservation argument with two parts: sync safety and merge safety.',
        'Sync safety: the state vector in the snapshot is a monotonically advancing summary. Every operation absorbed into the base was counted in the summary before the base was written. After compaction, a peer presenting its own state vector gets back exactly the operations it is missing, because the diff is computed against the preserved summary, not against the discarded log. The summary is sufficient because CRDT updates are uniquely identified by (peer ID, sequence number) pairs, and the state vector records the maximum sequence number seen from each peer. If my state vector says "Bob through 31," then operations 1 through 31 from Bob are reflected in my materialized state, and I will never request or re-apply them.',
        'Merge safety: the compacted base and the original full operation log produce identical materialized documents when applied to an empty replica. Compaction changes representation -- one blob instead of thousands of individual operations -- but not semantics. The same set of operations is reflected. Any new operation applied to the compacted base produces the same result as applying it to the uncompacted log, because CRDTs define merge as a function of the operation set, not the operation order or representation.',
        'The corner case that makes GC harder than compaction is tombstones. When a character is deleted in a sequence CRDT, the operation is not removed from the log; instead, a tombstone marker replaces it. That tombstone must remain as long as any peer might insert a new character adjacent to the deleted one, because the insert references the tombstone\'s ID as its positional anchor. If the tombstone is garbage-collected and a peer later sends an insert anchored to it, the system cannot determine where to place the new character.',
        'The proof that a tombstone is safe to collect requires knowledge of all peers. If every peer\'s state vector is past the point where the tombstone was created, no peer can generate a new operation that references it. In an open-membership system where peers can appear at any time, this proof is impossible without additional protocol machinery -- which is why many CRDT systems never garbage-collect tombstones, or do so only with explicit epoch boundaries that force stale peers to reset.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Writing a snapshot costs O(document size) in time and space -- proportional to the materialized state, not to the length of the operation history. For a 2,000-character document that accumulated 50,000 operations, the snapshot is roughly 2 KB plus a state vector of perhaps 100 bytes (a few entries of 8 bytes each). The 50,000 operations might have occupied 5 MB. That is a 2,500x reduction in storage.',
        'Computing a diff for a syncing peer costs O(tail length). The system scans only operations after the cut point and filters by the peer\'s state vector. If the tail holds 500 operations and the peer is missing 50, the diff contains those 50. A full snapshot reset -- required for peers whose state vector predates the cut -- costs O(snapshot size) to transmit and apply.',
        'The tradeoff is between tail length and reset frequency. A short tail (say, 1 hour of operations) means aggressive compaction and small storage, but peers that fall just two hours behind must do a full snapshot reset. A long tail (48 hours) means more storage but smoother incremental sync for devices that go offline overnight. The right tail length is a product decision that depends on how your users actually behave.',
        'Compaction itself has engineering cost beyond the algorithm. Crash safety requires atomic checkpoint writes -- a half-written snapshot corrupts the document. Versioned encodings are needed so that old snapshots remain readable after format upgrades. Equivalence testing must verify that the compacted base produces identical merge results to the uncompacted log. In Yjs, a document with 100,000 operations typically compacts to a single update blob of a few hundred kilobytes plus a state vector under 1 KB, saving 5-20x on storage and 10-50x on startup time.',
        'GC adds its own cost: a tombstone scan that checks every deleted identifier against every known peer\'s state vector. With T tombstones and P peers, the scan is O(T * P). In practice P is small (tens of peers), but T can be large in deletion-heavy documents. The scan must be conservative -- if any peer\'s state vector is unknown or stale, no tombstones touching that peer\'s causal region can be collected.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Collaborative document editors like those built on Yjs or Automerge are the canonical use case. Users edit daily, history grows fast, but only the last few minutes of operations matter for real-time sync. Without compaction, opening a heavily-edited Google Docs-style document would require replaying the entire edit history. With compaction, startup loads a snapshot and replays only the recent tail. Notion, for instance, uses a CRDT-based system where compaction keeps document open times under one second even for documents with tens of thousands of edits.',
        'Local-first note-taking apps face a related but slightly different challenge. Devices go offline for hours or days -- a laptop closed overnight, a phone in airplane mode. A tail of 24-48 hours of operations covers most reconnection windows. Devices that have been offline for weeks get a snapshot reset, which is acceptable because it happens rarely and the user does not notice (the document content is identical; only the sync mechanism restarts).',
        'Design tools like Figma-style applications generate millions of operations across layers, components, and frames. A complex design file might accumulate 5 million operations over its lifetime while the visible canvas holds perhaps 10,000 objects. Without compaction, opening the file requires replaying the full design history. Compaction reduces this to loading a snapshot of the current canvas state plus a short tail of recent changes.',
        'Embedded and IoT systems use CRDTs for edge synchronization -- point-of-sale terminals syncing inventory, medical devices syncing patient records, industrial sensors syncing readings. These devices have constrained flash storage (often single-digit megabytes) and intermittent connectivity. Compaction keeps the on-device CRDT store within hardware limits while preserving the ability to sync incrementally when connectivity returns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Compaction fails or becomes dangerously complex when the system cannot bound its retention obligations. The clearest case is unlimited offline: if peers can disappear for months and still merge incrementally when they return, the tail must cover months of operations. Compaction saves little because the tail dominates storage. The system is effectively back to "keep everything."',
        'Cross-device undo is a subtler failure. If users expect to undo operations from weeks ago on a different device, the inverse operations and their causal parents must survive compaction. Aggressive GC silently breaks undo -- the undo button does nothing, produces no error, and the user has no way to know that the undo history was garbage-collected on a different replica.',
        'Regulatory and legal requirements can make compaction architecturally incompatible. Financial systems, medical records, and legal documents may require the full operation history for audit compliance. Compacting into an opaque snapshot blob destroys the audit trail. The workaround -- keeping a separate audit archive alongside the compacted working copy -- is viable but adds significant complexity and storage cost, partially defeating the purpose of compaction.',
        'GDPR right-to-erasure creates perhaps the hardest problem. The system must surgically remove a specific user\'s contributions from the compacted snapshot, not just from the operation log. But the snapshot is a merged result of all users\' operations -- untangling one user\'s edits from the materialized state is, in the general case, computationally intractable. No general CRDT solution exists for this problem.',
        'Tombstone-heavy documents expose compaction\'s limits directly. A document where 90% of operations are deletions retains 90% of its metadata as tombstones even after compaction. The compacted snapshot is nearly as large as the uncompacted log because every deletion anchor must survive. The only escape is GC, which requires the closed-membership proof that most systems cannot make.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three peers -- Alice, Bob, and Carol -- collaborate on a shared shopping list implemented as a Yjs array. Each peer has a peer ID and a local clock that increments with each operation. Alice inserts "milk" (Alice:1), "eggs" (Alice:2), and "bread" (Alice:3). Bob inserts "butter" (Bob:1) and deletes "eggs" (Bob:2, creating a tombstone for Alice:2). Carol inserts "cheese" (Carol:1). The operation log has 6 entries. The visible list is: milk, bread, butter, cheese.',
        'The state vector after all operations sync is {Alice:3, Bob:2, Carol:1}. This 3-entry vector is a complete summary of which operations are reflected in the materialized state. To compact, the system writes a snapshot containing the visible list ["milk", "bread", "butter", "cheese"], the state vector {Alice:3, Bob:2, Carol:1}, and a tombstone entry for Alice:2 (because Bob:2 deleted it and a future insert might anchor to it). The snapshot is roughly 200 bytes. The 6 original operations might have been 600 bytes -- a 3x reduction. In a real document with 50,000 operations, the ratio would be far more dramatic.',
        'Now Carol goes offline. Alice and Bob continue editing. Alice adds "juice" (Alice:4) and Bob adds "ham" (Bob:3). These two operations go into the tail. The state vector advances to {Alice:4, Bob:3, Carol:1}, but the snapshot still says {Alice:3, Bob:2, Carol:1}. The cut point is min(3, 2, 1) = 1 across all peers -- meaning only operations through clock 1 from every peer are safe to fold into the snapshot. The system keeps operations Alice:2, Alice:3, Bob:2, Alice:4, and Bob:3 in the tail because Carol (at Carol:1) might need them.',
        'When Carol reconnects, she presents her state vector {Alice:3, Bob:2, Carol:1} (she had synced everything before going offline). The system compares this to its current state vector {Alice:4, Bob:3, Carol:1} and computes the diff: Alice:4 and Bob:3. It sends Carol just those two operations (roughly 200 bytes), not the full snapshot. Carol applies them and her document matches.',
        'Now suppose a fourth peer, Dave, appears for the first time. Dave has no state vector -- he has never seen this document. The system cannot compute a diff from nothing, so it sends Dave the full snapshot plus the tail. Dave loads the snapshot, applies the tail operations, and arrives at the current state. From this point forward, Dave is a known peer with state vector {Alice:4, Bob:3, Carol:1}, and future syncs are incremental. The snapshot reset cost Dave roughly 400 bytes; without compaction, he would have downloaded the full 6-operation log (600 bytes) -- and in a real system, the difference would be megabytes versus kilobytes.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The Yjs documentation on document updates and state vectors (docs.yjs.dev/api/document-updates) is the primary reference for how Yjs encodes, compacts, and diffs update blobs using state vectors. It covers the wire format, the encoding API, and the relationship between state vectors and incremental sync.',
        'The Automerge binary format specification (automerge.org/automerge-binary-format-spec/) defines the columnar encoding, change hashes, and heads that make Automerge snapshots self-describing. The Automerge 3.0 storage redesign blog post (automerge.org/blog/automerge-3/) explains incremental save, lazy loading, and how the storage layer separates compacted chunks from the active change buffer.',
        'Kleppmann et al., "Making CRDTs Byzantine Fault Tolerant" (2022), published at PaPoC, shows how causal metadata interacts with trust and garbage collection in adversarial network settings. It demonstrates that GC safety requires assumptions about peer behavior, not just peer knowledge.',
        'Shapiro et al., "A Comprehensive Study of CRDTs" (INRIA 2011) is the foundational survey that defines state-based and operation-based CRDTs, specifies causal delivery requirements, and frames the garbage collection problem as a fundamental limitation of coordination-free systems.',
        'For related topics, study sequence CRDTs for collaborative text to understand the operation identifiers and tombstones that compaction must preserve, delta-state CRDT anti-entropy to see the diff protocol that state vectors enable, and write-ahead logs in databases to see the same base-plus-tail checkpoint pattern in a different domain.',
      ],
    },
  ],
};
