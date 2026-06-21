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
  yield {
    state: compactGraph('CRDT storage needs snapshots plus causal summaries'),
    highlight: { active: ['ops', 'state', 'summary', 'snap', 'e-ops-state', 'e-ops-summary'], found: ['store'] },
    explanation: 'The graph shows what must survive a compaction. You can fold old operations into a checkpoint, but the snapshot still needs a causal summary so future peers know what history it represents.',
    invariant: 'A compacted snapshot must still know what history it represents.',
  };

  yield {
    state: labelMatrix(
      'What must survive compaction',
      [
        { id: 'state', label: 'doc state' },
        { id: 'heads', label: 'heads' },
        { id: 'sv', label: 'state vec' },
        { id: 'tail', label: 'recent tail' },
      ],
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
    explanation: 'Visible document bytes are only one row. Heads, state vectors, and a recent tail are what let sync continue after compaction. A plain JSON export can look correct and still be useless for incremental merge.',
  };

  yield {
    state: compactGraph('Compaction keeps a checkpoint and recent operation tail', { snap: 'base', tail: 'after base', store: 'base+tail' }),
    highlight: { active: ['snap', 'tail', 'store', 'e-snap-tail', 'e-gc-store'], compare: ['ops'] },
    explanation: 'Base plus tail is the common shape. Load the compact base, replay recent updates, and keep enough tail to serve peers that are only slightly behind. Far-behind peers may need a reset from snapshot.',
  };

  yield {
    state: labelMatrix(
      'Compaction styles',
      [
        { id: 'merge', label: 'merge upd' },
        { id: 'snapshot', label: 'snapshot' },
        { id: 'rewrite', label: 'rewrite hist' },
        { id: 'archive', label: 'archive' },
      ],
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
    explanation: 'These are different tools with the same danger. Merging updates, compacting columns, or writing app snapshots can save space, but rewriting history is unsafe if peers, undo, audit, or old snapshots still depend on old IDs.',
  };

  yield {
    state: compactGraph('The store shrinks only after safety checks pass', { peer: 'known', gc: 'safe cut', store: 'compact' }),
    highlight: { active: ['peer', 'gc', 'store', 'e-peer-gc', 'e-gc-store'], found: ['snap', 'summary'] },
    explanation: 'The safe cut is a protocol and product decision. Age is a hint, not proof. Known peer state, retention policy, audit requirements, privacy deletion, and snapshot reset rules decide what may disappear.',
  };
}

function* gcSafety() {
  yield {
    state: labelMatrix(
      'Garbage collection blockers',
      [
        { id: 'offline', label: 'offline peer' },
        { id: 'snapshot', label: 'old snap' },
        { id: 'undo', label: 'undo stack' },
        { id: 'audit', label: 'audit' },
      ],
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
    explanation: 'Garbage collection is not just freeing memory. Offline peers, old snapshots, undo stacks, audit trails, and retention rules may all still reference metadata that is invisible in the current document.',
    invariant: 'If future sync can refer to it, GC cannot blindly erase it.',
  };

  yield {
    state: compactGraph('Lagging peers define a safe cut', { peer: 'min known', gc: 'cut', tail: 'keep after' }),
    highlight: { active: ['peer', 'tail', 'gc', 'e-peer-gc', 'e-tail-gc'], compare: ['ops'] },
    explanation: 'If the system knows every active peer has seen a prefix of history, it can sometimes compact before that cut. Without that knowledge, the conservative answer is to keep more history or force a resync from snapshot.',
  };

  yield {
    state: labelMatrix(
      'Tombstone cleanup',
      [
        { id: 'delete', label: 'delete mark' },
        { id: 'anchor', label: 'anchor' },
        { id: 'render', label: 'render' },
        { id: 'purge', label: 'purge' },
      ],
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
    explanation: 'Tombstones are ugly but useful: they can be the only anchor a future remote operation understands. Purging them safely requires evidence that no accepted future update can reference those IDs.',
  };

  yield {
    state: labelMatrix(
      'Policy choices',
      [
        { id: 'small', label: 'small team' },
        { id: 'offline', label: 'offline app' },
        { id: 'regulated', label: 'regulated' },
        { id: 'public', label: 'public doc' },
      ],
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
    explanation: 'There is no universal GC policy. Some products prefer durable audit history; others prefer privacy deletion or small client stores. The data structure must expose the cut points so product policy can choose.',
  };

  yield {
    state: compactGraph('Safe GC is a protocol plus product contract', { summary: 'proof', peer: 'known', gc: 'policy', store: 'retained' }),
    highlight: { active: ['summary', 'peer', 'gc', 'store'], found: ['snap'] },
    explanation: 'The final graph is the right mental model: checkpointing plus distributed sync plus product policy. Aggressive GC is fine only when the protocol says how old peers, snapshots, undo, audit, and deletion requests behave afterward.',
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
        'The animation has two views. "Snapshot compaction" traces the pipeline from raw operation log to compact store. "GC safety" traces the blockers that prevent deletion. Switch between them to see both halves of the problem.',
        {
          type: 'callout',
          text: 'A compacted CRDT snapshot is safe only when it preserves both visible state and the causal summary needed for future sync.',
        },
        'Active nodes (highlighted) are the current decision point -- the stage of the pipeline being evaluated. Found markers are outcomes the system has committed to: a checkpoint written, a cut declared safe, a store shrunk. Compare markers flag the tension: the thing that makes the step non-trivial.',
        {
          type: 'note',
          text: 'The graph is not a data-flow diagram of a running system. It is a decision map: each edge says "this output feeds that decision." Follow active-to-found to see what the compactor produces; follow compare markers to see what constrains it.',
        },
        'At each frame, ask: what information survived the step, what was discarded, and what invariant makes the discard safe.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'CRDTs buy offline-first collaboration by recording every operation with a causal identity. A peer can go offline, edit freely, come back, and merge without a central arbiter. The cost is history: each character insertion, each delete, each metadata update stays in the log so future merges can place new operations in the causal graph.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png',
          alt: 'Vector clock diagram showing causal regions and independent concurrent events',
          caption: 'Vector clocks visualize the causal summaries that compacted replicas must preserve. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Vector_Clock.svg/500px-Vector_Clock.svg.png',
        },
        {
          type: 'quote',
          text: 'If I have seen further it is by standing on the shoulders of giants -- but I do not need the giants in RAM.',
          attribution: 'The compaction problem, informally',
        },
        'A collaborative document with 50,000 edits may show 2,000 characters of visible text. Without compaction, startup replays all 50,000 operations, IndexedDB stores every tombstone and clock entry, and sync transmits metadata the receiving peer already has. Storage grows linearly with total edit count, not with document size. Compaction exists to break that link while preserving the causal information sync still needs.',
        {
          type: 'table',
          headers: ['Metric', 'Without compaction', 'With compaction'],
          rows: [
            ['Startup cost', 'Replay all N ops', 'Load snapshot + replay tail'],
            ['Storage', 'O(total ops)', 'O(doc size + tail + summary)'],
            ['Sync payload', 'Full log or expensive diff', 'Diff from state vector'],
            ['Tombstone memory', 'All deleted IDs retained', 'Only those still referenced'],
          ],
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Two obvious strategies present themselves, and both fail in instructive ways.',
        'Strategy one: keep everything. Every operation stays in the log forever. Offline peers always find their causal parents. Undo works by inverting any past operation. Audit is trivially complete. The problem is that storage and startup cost grow without bound. A year-old collaborative document with three active users may carry hundreds of megabytes of metadata for a few kilobytes of visible content.',
        'Strategy two: export and replace. Serialize the visible document to JSON, delete the CRDT metadata, and start fresh. The document looks correct on load. But the first time a peer tries to sync, it has no state vector, no heads, and no way to compute a diff. The system falls back to "send everything" or silently drops concurrent edits.',
        {
          type: 'note',
          text: 'A third tempting shortcut is age-based deletion: drop operations older than 30 days. This is unsafe because age does not imply unreferenced. An operation from six months ago may be the causal parent of a future insert from a peer that has been offline. CRDT GC must answer "who can still reference this ID," not "how old is it."',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a single invariant: a compacted snapshot must still identify which history it represents so that incremental sync remains possible.',
        'Break that invariant and the system looks fine locally -- the document renders, the user edits, everything feels normal. The failure surfaces only on sync. A remote peer sends an update whose causal parent is "operation 47 from peer B." The compacted replica no longer knows whether it has already applied operation 47. It cannot compute a diff. It cannot detect a duplicate. It cannot place the new insert in the right position.',
        {
          type: 'diagram',
          label: 'Unsafe compaction breaks incremental sync',
          text: 'Peer A (compacted, no state vector):\n  doc state = "Hello world"\n  heads     = ???\n  sv        = ???\n\nPeer B (online, sends update):\n  "Insert \'!\' after op 47 from peer A"\n\nPeer A cannot answer:\n  - Have I already applied op 47?    --> unknown\n  - Where does op 47 sit in my doc?  --> unknown\n  - Should I accept or reject this?  --> unknown\n\nResult: silent data loss, duplicate insert, or crash.',
        },
        'The wall is not performance. A slow full-sync fallback would be tolerable. The wall is correctness: without causal summaries, the replica cannot distinguish "I have this" from "I have never seen this," and merge becomes unsafe.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Safe compaction preserves three things: materialized state, causal summary, and a recent operation tail. The names vary across implementations, but the roles are universal.',
        {
          type: 'table',
          headers: ['Component', 'Yjs name', 'Automerge name', 'Role'],
          rows: [
            ['Materialized state', 'Document snapshot', 'Materialized doc', 'What the user sees -- the rendered text, map, or array'],
            ['Causal summary', 'State vector', 'Heads (change hashes)', 'Compact proof of which operations are already absorbed'],
            ['Recent tail', 'Pending updates', 'Unapplied changes', 'Operations after the snapshot that lagging peers may need'],
          ],
        },
        'The compaction pipeline works in five stages. First, the system materializes the current document state from the full operation log. Second, it records the causal summary -- in Yjs, a state vector mapping each peer to its highest known clock; in Automerge, the set of change hashes at the DAG frontier. Third, it writes the snapshot: state plus summary plus encoding version. Fourth, it determines a safe cut point by checking known peer clocks against the summary. Fifth, it discards operations before the cut and retains the tail after it.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Yjs compaction sketch\nfunction compact(ydoc) {\n  // 1. Encode full state as a single update blob\n  const snapshot = Y.encodeStateAsUpdate(ydoc);\n  // 2. Record the state vector (causal summary)\n  const sv = Y.encodeStateVector(ydoc);\n  // 3. Store snapshot + sv together\n  await db.put(\'base\', { snapshot, sv, version: 2 });\n  // 4. On next sync, compute diff from peer\'s state vector\n  //    const diff = Y.encodeStateAsUpdate(ydoc, peerSV);\n  // 5. Tail = updates arriving after this snapshot\n  await db.delete(\'ops-before\', cutClock);\n}',
        },
        'The cut point is the hard decision. Everything before it is represented by the snapshot. Everything after it stays as individual operations. A peer whose state vector is at or after the cut can receive a diff from the tail. A peer whose state vector predates the cut must download the full snapshot and restart from that checkpoint.',
        {
          type: 'diagram',
          label: 'Base plus tail storage layout',
          text: 'Time --->   op1  op2  op3  op4  op5  op6  op7  op8  op9\n            |___________________________|  |____________|\n                        |                        |\n                   compacted into            retained as\n                   base snapshot             recent tail\n                   (+ state vector)          (for lagging peers)\n\nStorage:  [base blob] [sv] [op6] [op7] [op8] [op9]\n\nPeer at op5: receives diff [op6..op9] from tail\nPeer at op2: receives full base + tail (snapshot reset)',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on a preservation argument with two parts.',
        'Part one -- sync safety: the state vector (or heads) in the snapshot is a monotonically advancing summary. Every operation absorbed into the base was counted in the summary before the base was written. After compaction, a peer presenting its own state vector gets back exactly the operations it is missing, because the diff is computed against the preserved summary, not against the discarded log. The summary is sufficient because CRDT updates are uniquely identified by (peer ID, sequence number) pairs, and the state vector records the maximum sequence number seen from each peer.',
        {
          type: 'note',
          text: 'The key monotonicity property: state vectors only advance. If sv_A says "peer B through clock 12," then every operation from B with clock <= 12 is already reflected in the materialized state. A future update from B with clock 13 can be applied without replaying 1-12. This is why the summary is a lossless compression of "what I have seen."',
        },
        'Part two -- merge safety: the compacted base and a fresh full log produce identical materialized documents when applied to an empty replica. Compaction changes representation (one blob instead of many operations), not semantics (the same set of operations is reflected). Any new operation applied to the compacted base produces the same result as applying it to the uncompacted log, because CRDTs define merge as a function of the operation set, not the operation order.',
        'The corner case is tombstones. A deleted element may still be the positional anchor for a future remote insert. The snapshot must retain tombstone identifiers until no future operation can reference them. The proof that no future operation references a tombstone ID requires knowledge of all peers -- which is why GC is harder than compaction.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Time cost', 'Space cost', 'Notes'],
          rows: [
            ['Write snapshot', 'O(doc size)', 'O(doc size + sv)', 'Proportional to materialized state, not history length'],
            ['Compute diff', 'O(tail length)', 'O(diff size)', 'Only scans operations after the cut point'],
            ['Full reset', 'O(snapshot size)', 'O(snapshot)', 'Peer downloads entire base; expensive but rare'],
            ['Tombstone scan', 'O(tombstones)', 'O(1) per check', 'Must verify no peer can reference each ID'],
            ['State vector storage', 'O(1) per peer', 'O(peers)', 'One clock entry per known peer -- typically small'],
          ],
        },
        'The tradeoff is between tail length and reset frequency. A short tail means aggressive compaction and small storage, but peers that fall slightly behind must do a full snapshot reset. A long tail means more storage but smoother incremental sync for intermittently-offline devices.',
        'Compaction itself has engineering cost: crash-safe checkpoint writes (a half-written snapshot corrupts the document), versioned encodings (old snapshots must remain readable after format upgrades), and equivalence tests (the compacted base must produce identical merge results to the uncompacted log). A broken compactor is worse than no compactor because it silently rewrites the ground truth.',
        {
          type: 'note',
          text: 'In Yjs, a document with 100,000 operations might compact to a single update blob of a few hundred kilobytes plus a state vector of a few hundred bytes. The 100,000 individual operations might have occupied several megabytes. The savings are typically 5-20x on storage and 10-50x on startup time.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Compaction is the right tool whenever documents are long-lived, most history is old, active peers are near the frontier, and a snapshot reset is acceptable for very stale replicas.',
        {
          type: 'bullets',
          items: [
            'Collaborative documents (Notion, Google Docs-style): users edit daily, history grows fast, but only the last few minutes of operations matter for real-time sync. Compaction keeps startup under a second.',
            'Local-first note apps (Obsidian Sync, Apple Notes): devices go offline for hours or days, not months. A tail of 24-48 hours covers most reconnection windows; stale devices get a snapshot reset.',
            'Design tools (Figma-style): a complex design file may have millions of operations across layers and components. Without compaction, opening a file replays the entire design history.',
            'Embedded databases (SQLite + CRDTs): IoT sensors or POS terminals sync periodically. Compaction keeps the on-device database small enough for flash storage constraints.',
            'Multiplayer whiteboards: rapid drawing produces thousands of operations per minute. Without compaction, a one-hour session generates a log larger than the visible canvas.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Compaction fails -- or becomes dangerously complex -- when the system cannot name its retention contract.',
        {
          type: 'bullets',
          items: [
            'Unlimited offline: if peers can be offline for months and still merge incrementally, the tail must cover months of operations. Compaction saves little because the tail dominates storage.',
            'Cross-device undo: if users expect to undo operations from weeks ago on a different device, the inverse operations and their causal parents must survive compaction. Aggressive GC breaks undo silently -- the undo button does nothing, with no error.',
            'Regulatory audit: financial, medical, or legal systems may require the full operation history for compliance. Compaction into an opaque blob destroys the audit trail unless the archive is kept separately.',
            'Privacy deletion (GDPR right-to-erasure): the system must remove specific user contributions from the compacted base, not just from the operation log. Surgical deletion from a merged snapshot is a hard problem with no general CRDT solution.',
            'Tombstone-heavy documents: a document where 90% of operations are deletes retains 90% of its metadata as tombstones even after compaction. The compacted base is nearly as large as the uncompacted log.',
          ],
        },
        {
          type: 'note',
          text: 'The silent failure mode: a compactor that drops tombstones too early produces no error. The document looks correct on every device that already has the full history. The bug surfaces only when a new or stale peer syncs and places an insert at the wrong position because the anchor tombstone is gone. This can take weeks to manifest.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Yjs document updates and state vectors: https://docs.yjs.dev/api/document-updates -- the primary reference for how Yjs encodes, compacts, and diffs update blobs using state vectors.',
            'Automerge binary format specification: https://automerge.org/automerge-binary-format-spec/ -- defines the columnar encoding, change hashes, and heads that make Automerge snapshots self-describing.',
            'Automerge 3.0 storage redesign: https://automerge.org/blog/automerge-3/ -- explains incremental save, lazy loading, and how the storage layer separates compacted chunks from the active change buffer.',
            'Kleppmann et al., "Making CRDTs Byzantine Fault Tolerant" (2022): https://martin.kleppmann.com/papers/bft-crdt-papoc22.pdf -- shows how causal metadata interacts with trust and GC in adversarial settings.',
            'Shapiro et al., "A Comprehensive Study of CRDTs" (2011): https://hal.inria.fr/inria-00555588/document -- the foundational survey that defines state-based and operation-based CRDTs, causal delivery, and the garbage collection problem.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic'],
          rows: [
            ['Prerequisite', 'Sequence CRDTs for Collaborative Text -- understand the operation identifiers and tombstones that compaction must preserve'],
            ['Prerequisite', 'Delta-State CRDT Anti-Entropy Case Study -- the diff protocol that state vectors enable'],
            ['Extension', 'Yjs Struct Store & Updates -- how Yjs implements the base-plus-tail pattern internally'],
            ['Extension', 'Automerge Change Graph & Columnar Storage -- how Automerge implements heads-based compaction'],
            ['Related', 'Write-Ahead Log -- the same base-plus-tail pattern in databases, with checkpoint and truncation'],
            ['Related', 'IndexedDB Object Store Case Study -- the browser storage layer where local-first apps persist compacted snapshots'],
          ],
        },
      ],
    },
  ],
};
