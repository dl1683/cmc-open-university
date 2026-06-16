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
    explanation: 'A CRDT update log can grow forever. Snapshot compaction folds old operations into a materialized checkpoint while preserving enough causal summary for future sync.',
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
    explanation: 'Snapshotting only visible document bytes is not enough. The sync protocol needs causal frontiers such as heads or state vectors so peers can ask for the right missing changes.',
  };

  yield {
    state: compactGraph('Compaction keeps a checkpoint and recent operation tail', { snap: 'base', tail: 'after base', store: 'base+tail' }),
    highlight: { active: ['snap', 'tail', 'store', 'e-snap-tail', 'e-gc-store'], compare: ['ops'] },
    explanation: 'A practical store can keep a compact base snapshot plus recent update tail. Loading applies the tail over the base; syncing can still serve peers that are near the current frontier.',
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
    explanation: 'Yjs-style update merging, Automerge-style compact storage, and application snapshots are all compaction tools. The unsafe version is rewriting history while forgetting which peers or snapshots still rely on it.',
  };

  yield {
    state: compactGraph('The store shrinks only after safety checks pass', { peer: 'known', gc: 'safe cut', store: 'compact' }),
    highlight: { active: ['peer', 'gc', 'store', 'e-peer-gc', 'e-gc-store'], found: ['snap', 'summary'] },
    explanation: 'The compaction cut should be a protocol decision, not a cron job that deletes files by age. Age helps, but known peer state, retention policy, audit requirements, and privacy rules decide what can disappear.',
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
    explanation: 'CRDT garbage collection is not just memory cleanup. Offline peers, snapshots, undo, audit, and legal retention can all require old identifiers or operations to remain available.',
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
    explanation: 'Sequence CRDT tombstones or deleted structs can be anchors for future operations. Removing them may be safe only after the system can prove no future update will reference them.',
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
    explanation: 'The right mental model is database checkpointing plus distributed sync. You can compact aggressively only if the protocol and product contract say what old peers, old snapshots, undo, audit, and deletion requests are allowed to do.',
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
      heading: 'What it is',
      paragraphs: [
        'CRDT snapshot compaction is the practice of reducing a growing local-first history into a smaller representation without breaking future sync. A collaborative document may store every insert, delete, mark, move, and map update. That history is valuable for offline sync and versioning, but it can become too large to load or transmit naively.',
        'Garbage collection is the harder sibling. A deleted character or operation may still be needed by an offline peer, an undo stack, an old snapshot, or an audit workflow. The question is not merely "can I save space?" It is "which future conversations does this retained metadata still support?"',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A compacted representation usually keeps a materialized document snapshot plus a causal summary: heads, state vectors, change hashes, or equivalent frontier metadata. Recent operations after the snapshot remain as a tail. Loading applies the tail over the base. Sync uses the causal summary to decide what peers are missing.',
        'Yjs exposes APIs for merging updates, computing state vectors from updates, and diffing updates against state vectors. Automerge documents compact binary storage for complete history and Automerge Repo handles compression decisions around concurrent reads and writes. Both systems illustrate the same rule: compaction must preserve the information the sync protocol needs.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The costs are disk, memory, startup time, wire bytes, privacy, and product semantics. Keeping every operation forever maximizes compatibility with lagging peers and history tools, but it can hurt load time and retention obligations. Aggressive compaction lowers cost but may force old peers to resync from a snapshot or lose ability to apply old incremental updates.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A local-first notes app stores Yjs updates in IndexedDB. Every hour it merges recent updates and writes a compact snapshot blob plus a state vector. It keeps a recent tail for active peers. If a peer reconnects with a state vector near the tail, the server sends a diff. If the peer is months behind, the server sends the latest snapshot and asks it to reset that document. Product policy decides whether this is acceptable.',
        'An Automerge app might instead persist the full change history in compact columnar form and rely on repository-level compression. The product can still define archive and deletion rules, but it should do so with explicit knowledge of heads, sync state, and history-retention requirements.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest mistake is deleting old CRDT metadata because it is not visible. Invisible does not mean unnecessary. A tombstone may be the only thing preventing a future remote insert from landing in the wrong place. Another mistake is treating snapshots as plain JSON exports. A plain export may show the right text but lack the causal metadata needed for future merges.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Yjs document updates at https://docs.yjs.dev/api/document-updates, Yjs README update API at https://github.com/yjs/yjs/blob/main/README.md, Automerge concepts at https://automerge.org/docs/reference/concepts/, Automerge binary format at https://automerge.org/automerge-binary-format-spec/, and Automerge 3.0 storage discussion at https://automerge.org/blog/automerge-3/. Study Yjs Struct Store & Updates, Automerge Change Graph & Columnar Storage, Local-First Sync Engine Case Study, Delta-State CRDT Anti-Entropy Case Study, Sequence CRDTs for Collaborative Text, Collaborative Undo/Redo Intention Stack, IndexedDB Object Store Case Study, and Write-Ahead Log next.',
      ],
    },
  ],
};
