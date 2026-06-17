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
      heading: 'Why compaction exists',
      paragraphs: [
        `CRDTs let replicas accept local edits, go offline, and merge later without a single writer. That promise is bought with history. A collaborative document does not only store the text, shapes, or records the user sees. It also stores operation identifiers, causal links, delete markers, state vectors, clocks, and enough structure to understand updates that may arrive tomorrow from a device that has been offline for weeks.`,
        `Without compaction, the cost keeps rising. Startup replays more updates, browser storage grows, sync sends larger payloads, and old tombstones stay in memory even after the visible document looks small. Compaction exists to keep the local-first contract while making old history cheaper to load, store, and transmit.`,
      ],
    },
    {
      heading: 'The tempting wrong answers',
      paragraphs: [
        `The safest answer is to keep every operation forever. That protects old peers, undo, audit, and forensic debugging, but it turns every long-lived document into a growing log. The cheap answer is to export visible JSON, save it as the new base, and delete the old metadata. That can make the document look correct while destroying the information needed for incremental merge.`,
        `A third mistake is to use age as the only deletion rule. Old does not mean unused. An operation from a year ago may still be the parent of a future remote insert, the target of an undo action, or the only proof that a peer has already seen a delete. CRDT garbage collection has to ask who can still refer to the metadata, not just how old it is.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `A safe compacted document keeps three kinds of information: the materialized state, a causal summary of the history represented by that state, and a recent tail of updates that peers may still need. The exact names vary by implementation. Yjs uses update blobs and state vectors. Automerge stores changes and columnar history. Other systems may store heads, vector clocks, or version vectors. The rule is the same: the compacted base must still explain what it has already absorbed.`,
        `Compaction changes representation. It should not change meaning. A peer that knows the compacted base should be able to ask for missing updates. A peer that is too far behind should receive a clear reset path. A new local edit should still produce an update that other replicas can place in the causal graph.`,
      ],
    },
    {
      heading: 'What a snapshot must keep',
      paragraphs: [
        `A snapshot is not just the visible document. It needs the document state, the heads or frontier that identify the latest absorbed operations, the state vector or equivalent clock summary, schema and encoding versions, and sometimes recent operation data. If the application supports undo, comments, cursors, audit history, or attachments, those references may need their own compaction rules.`,
        `The recent tail matters because not every peer is at the same point. A peer that has the base and is only slightly behind can receive tail updates. A peer that predates the base may not be able to apply the tail safely, so the protocol must tell it to download the snapshot and restart from that checkpoint.`,
      ],
    },
    {
      heading: 'How compaction works',
      paragraphs: [
        `A common design is base plus tail. The system loads the compacted base, replays recent updates, and serves diffs from the tail when another peer can identify what it already has. Periodically the base is rewritten and the tail is shortened. The compactor may merge update blobs, rewrite storage columns, deduplicate repeated structures, or produce an application-level checkpoint backed by CRDT metadata.`,
        `The compactor needs a cut point. Everything before the cut is represented by the base. Everything after the cut remains as operations. Choosing that cut is the hard part. It depends on known peer state, snapshot availability, retention policy, and whether any secondary feature can still refer to old identifiers.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The first graph separates visible state from causal summary. That is the main proof. If a compaction keeps only the state node, it has built a fast export, not a syncable CRDT snapshot. The summary node is what lets the system say which operations are already included and what kind of diff a peer should receive.`,
        `The garbage-collection view adds the second proof: deletion is blocked by future references. Offline peers, old snapshots, undo stacks, audit records, and tombstone anchors may all point at metadata that is absent from the rendered document. The visual is not arguing that history can never be removed. It is arguing that removal needs evidence and a product contract.`,
      ],
    },
    {
      heading: 'Why state vectors matter',
      paragraphs: [
        `A state vector is a compact description of what a replica has seen. Instead of sending a whole document, a peer can say, in effect, "I have updates through these clocks." The other side computes the missing difference. That is why a compacted snapshot must preserve causal summaries even when it no longer stores every old update individually.`,
        `Heads play a similar role in systems that represent history as a graph of changes. They identify the current frontier. If two replicas have different frontiers, the sync protocol can reason about what is shared and what is missing. Without that frontier information, the system falls back to expensive full transfer or, worse, accepts updates whose dependencies it no longer understands.`,
      ],
    },
    {
      heading: 'Tombstones and safe garbage collection',
      paragraphs: [
        `Tombstones are deleted objects that still occupy structural space. They may preserve ordering, identity, or a place where later remote operations attach. In collaborative text, deleting a character does not always mean its identifier can vanish immediately. A remote insert may arrive that says it belongs after that deleted character. If the anchor disappeared, the replica may place the insert incorrectly or reject a valid update.`,
        `Safe tombstone cleanup needs proof that no accepted future update can refer to the removed identifiers. Some systems get this proof from server-mediated acknowledgement, bounded offline windows, epoch resets, or explicit snapshot migration. Others avoid aggressive tombstone cleanup because their product values offline compatibility more than small storage.`,
      ],
    },
    {
      heading: 'Policy is part of the protocol',
      paragraphs: [
        `There is no universal retention rule. A regulated editor may keep archives for audit. A privacy-sensitive app may delete old data quickly after account removal. A personal notes app may allow devices to be offline for months. A public multiplayer document may prefer forcing old tabs to reload rather than carrying unlimited history.`,
        `Those choices must be encoded. The snapshot format should say which base it represents. The sync protocol should say when a peer can receive a diff and when it must reset. The UI should handle reset without data loss. The storage layer should expose watermarks, retention windows, and tombstone counts so operators can see the cost of the policy they chose.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Keeping more history maximizes compatibility, auditability, incremental sync, and debugging power. It also increases disk use, memory pressure, startup latency, wire bytes, privacy exposure, and migration cost. Aggressive compaction lowers those costs, but it can weaken undo, make old updates impossible to apply, or force peers to download full snapshots more often.`,
        `Compaction also adds engineering complexity. The system needs background jobs, crash-safe checkpoint writes, versioned encodings, corruption checks, and tests that compare compacted and uncompacted behavior. A broken compactor is worse than no compactor because it silently rewrites the ground truth of the document.`,
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        `Compaction wins in notes, documents, whiteboards, design files, local-first databases, and any workspace where documents stay alive while devices appear and disappear. It is especially useful when most edits are old, active peers are near the current frontier, and a snapshot reset is acceptable for very stale replicas.`,
        `It fails when the system cannot name its retention contract. If users expect unlimited offline editing, cross-device undo, permanent audit, and small storage all at once, the data structure cannot satisfy every demand. The design has to choose which future interactions remain supported after history is rewritten.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Yjs document updates at https://docs.yjs.dev/api/document-updates, the Yjs update API at https://github.com/yjs/yjs/blob/main/README.md, Automerge concepts at https://automerge.org/docs/reference/concepts/, the Automerge binary format at https://automerge.org/automerge-binary-format-spec/, and Automerge storage notes at https://automerge.org/blog/automerge-3/.`,
        `Study Yjs Struct Store & Updates, Automerge Change Graph & Columnar Storage, Local-First Sync Engine Case Study, Delta-State CRDT Anti-Entropy Case Study, Sequence CRDTs for Collaborative Text, Collaborative Undo/Redo Intention Stack, IndexedDB Object Store Case Study, and Write-Ahead Log next.`,
      ],
    },
  ],
};
