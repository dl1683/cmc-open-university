// Local-first sync engine: durable local state, CRDT change history,
// peer sync state, missing-change exchange, compaction, and transport adapters.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'local-first-sync-engine-case-study',
  title: 'Local-First Sync Engine Case Study',
  category: 'Systems',
  summary: 'How local-first apps synchronize CRDT documents with op logs, heads, peer sync state, durable storage, transports, and compaction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sync handshake', 'storage and compaction'], defaultValue: 'sync handshake' },
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

function syncGraph(title) {
  return graphState({
    nodes: [
      { id: 'edit', label: 'edit', x: 0.7, y: 4.1, note: 'txn' },
      { id: 'doc', label: 'doc', x: 2.2, y: 4.1, note: 'CRDT' },
      { id: 'log', label: 'op log', x: 3.8, y: 4.9, note: 'changes' },
      { id: 'heads', label: 'heads', x: 3.8, y: 3.3, note: 'frontier' },
      { id: 'state', label: 'peer state', x: 5.5, y: 4.1, note: 'per peer' },
      { id: 'have', label: 'have', x: 7.0, y: 4.9, note: 'summary' },
      { id: 'need', label: 'need', x: 7.0, y: 3.3, note: 'missing' },
      { id: 'wire', label: 'wire', x: 8.3, y: 4.1, note: 'transport' },
      { id: 'peer', label: 'peer', x: 9.5, y: 4.1, note: 'merge' },
    ],
    edges: [
      { id: 'e-edit-doc', from: 'edit', to: 'doc' },
      { id: 'e-doc-log', from: 'doc', to: 'log' },
      { id: 'e-doc-heads', from: 'doc', to: 'heads' },
      { id: 'e-log-state', from: 'log', to: 'state' },
      { id: 'e-heads-state', from: 'heads', to: 'state' },
      { id: 'e-state-have', from: 'state', to: 'have' },
      { id: 'e-state-need', from: 'state', to: 'need' },
      { id: 'e-have-wire', from: 'have', to: 'wire' },
      { id: 'e-need-wire', from: 'need', to: 'wire' },
      { id: 'e-wire-peer', from: 'wire', to: 'peer' },
      { id: 'e-peer-state', from: 'peer', to: 'state' },
    ],
  }, { title });
}

function storageGraph(title) {
  return graphState({
    nodes: [
      { id: 'ui', label: 'UI', x: 0.7, y: 4.1, note: 'instant' },
      { id: 'repo', label: 'repo', x: 2.2, y: 4.1, note: 'handles' },
      { id: 'idb', label: 'IDB', x: 3.8, y: 4.9, note: 'local disk' },
      { id: 'snapshot', label: 'snapshot', x: 3.8, y: 3.3, note: 'fast load' },
      { id: 'changes', label: 'changes', x: 5.5, y: 4.9, note: 'append' },
      { id: 'compact', label: 'compact', x: 5.5, y: 3.3, note: 'rewrite' },
      { id: 'queue', label: 'queue', x: 7.2, y: 4.9, note: 'send later' },
      { id: 'network', label: 'network', x: 8.6, y: 4.1, note: 'any link' },
      { id: 'remote', label: 'remote', x: 9.7, y: 4.1, note: 'peer/server' },
    ],
    edges: [
      { id: 'e-ui-repo', from: 'ui', to: 'repo' },
      { id: 'e-repo-idb', from: 'repo', to: 'idb' },
      { id: 'e-idb-snapshot', from: 'idb', to: 'snapshot' },
      { id: 'e-idb-changes', from: 'idb', to: 'changes' },
      { id: 'e-changes-compact', from: 'changes', to: 'compact' },
      { id: 'e-changes-queue', from: 'changes', to: 'queue' },
      { id: 'e-queue-network', from: 'queue', to: 'network' },
      { id: 'e-network-remote', from: 'network', to: 'remote' },
      { id: 'e-remote-repo', from: 'remote', to: 'repo' },
    ],
  }, { title });
}

function* syncHandshake() {
  yield {
    state: syncGraph('A local edit updates the document and the change log'),
    highlight: { active: ['edit', 'doc', 'log', 'heads', 'e-edit-doc', 'e-doc-log', 'e-doc-heads'], compare: ['peer'] },
    explanation: 'The first edge is the local-first promise: apply the edit now, then durably record the CRDT change. The network is not in the acknowledgement path for local usefulness.',
    invariant: 'The local copy is primary, not a cache waiting for server permission.',
  };

  yield {
    state: syncGraph('Heads summarize the document frontier'),
    highlight: { active: ['doc', 'heads', 'state', 'e-doc-heads', 'e-heads-state'], compare: ['log'] },
    explanation: 'Heads are the compact summary of a change DAG frontier. If two peers report different heads, they are not just "out of date"; they know different branches of history, and the sync engine can ask for the missing changes.',
  };

  yield {
    state: syncGraph('Peer sync state remembers the other side'),
    highlight: { active: ['state', 'have', 'need', 'e-state-have', 'e-state-need'], compare: ['wire'] },
    explanation: 'Per-peer state prevents sync from becoming repeated full-document transfer. It remembers reported heads, in-flight changes, and summaries already exchanged so the next message can be a targeted gap fill.',
  };

  yield {
    state: syncGraph('The transport carries sync messages, not application truth'),
    highlight: { active: ['have', 'need', 'wire', 'peer', 'e-have-wire', 'e-need-wire', 'e-wire-peer'], found: ['state'] },
    explanation: 'The wire is deliberately boring. WebSocket, WebRTC, BroadcastChannel, file exchange, or a relay can carry the same sync messages. The transport moves bytes; the change DAG and peer state decide what those bytes mean.',
  };

  yield {
    state: labelMatrix(
      'Sync engine records',
      [
        { id: 'change', label: 'change DAG' },
        { id: 'heads', label: 'heads set' },
        { id: 'state', label: 'peer state' },
        { id: 'have', label: 'have summary' },
        { id: 'queue', label: 'outbox' },
      ],
      [
        { id: 'contains', label: 'contains' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['ops + deps', 'merge history'],
        ['frontier hashes', 'find divergence'],
        ['peer memory', 'avoid resend loops'],
        ['known changes', 'request only gaps'],
        ['unsent bytes', 'survive offline'],
      ],
    ),
    highlight: { active: ['change:contains', 'heads:why', 'state:why', 'queue:why'] },
    explanation: 'This table is the engine in miniature. Local-first sync is not magic; it is explicit records for history, frontier, peer memory, gap summaries, and an outbox that survives bad networks.',
  };
}

function* storageAndCompaction() {
  yield {
    state: storageGraph('Storage is the source of restart safety'),
    highlight: { active: ['ui', 'repo', 'idb', 'e-ui-repo', 'e-repo-idb'], compare: ['network'] },
    explanation: 'Immediate UI acknowledgement is only honest if the edit is written locally first. IndexedDB, SQLite, or filesystem-backed storage turns "saved locally" into a real durability state instead of a spinner promise.',
  };

  yield {
    state: storageGraph('Snapshots make large documents load quickly'),
    highlight: { active: ['idb', 'snapshot', 'changes', 'e-idb-snapshot', 'e-idb-changes'], compare: ['compact'] },
    explanation: 'Keeping every change forever is useful for merge, history, and audit, but startup should not replay an unbounded log. A snapshot plus recent changes gives a fast load path.',
  };

  yield {
    state: storageGraph('Compaction is a correctness-preserving rewrite'),
    highlight: { active: ['changes', 'compact', 'snapshot', 'e-changes-compact'], found: ['idb'] },
    explanation: 'Compaction is a rewrite with a contract. It may fold old changes into a snapshot or compact format, but it must keep the causal summary needed for peers that still need to sync.',
  };

  yield {
    state: storageGraph('Offline sends use the same queue discipline as any outbox'),
    highlight: { active: ['changes', 'queue', 'network', 'remote', 'e-changes-queue', 'e-queue-network', 'e-network-remote'], compare: ['ui'] },
    explanation: 'When offline, the repository keeps accepting local changes and queues sync work. When the network returns, it sends incremental messages. Message Queue, Transactional Outbox, Background Sync Outbox Queue, and Service Workers all teach the same reliability shape.',
  };

  yield {
    state: labelMatrix(
      'Local-first failure modes',
      [
        { id: 'stale', label: 'stale peer state' },
        { id: 'lost', label: 'lost local change' },
        { id: 'bloat', label: 'history bloat' },
        { id: 'leak', label: 'privacy leak' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'control', label: 'control' },
      ],
      [
        ['re-sends forever', 'peer-state reset'],
        ['edit vanishes', 'write before ack'],
        ['slow load', 'safe compaction'],
        ['wrong peer gets doc', 'doc URLs + auth'],
      ],
    ),
    highlight: { active: ['lost:control', 'bloat:control', 'leak:control'], compare: ['stale:symptom'] },
    explanation: 'The failure table shows the layers around the algorithm. A correct sync protocol still fails users if local writes disappear, history bloats, unauthorized peers receive data, or engineers cannot inspect stuck peer state.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sync handshake') yield* syncHandshake();
  else if (view === 'storage and compaction') yield* storageAndCompaction();
  else throw new InputError('Pick a local-first sync-engine view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Sync handshake" traces a local edit flowing through the CRDT document, change log, heads set, peer sync state, have/need summaries, transport wire, and remote peer. "Storage and compaction" traces how the same edit reaches durable local storage, snapshots, the change tail, compaction, the offline queue, and the network.',
        {
          type: 'bullets',
          items: [
            'Active (highlighted) nodes are the current stage of the pipeline: the field being written, the summary being computed, or the message being sent.',
            'Compare nodes show the component that this stage is measured against -- usually the remote peer or the network layer.',
            'Found nodes are confirmed durable outcomes: a persisted change, a compacted snapshot, or a successfully merged remote state.',
          ],
        },
        'In the matrix views, rows are sync records or failure modes, and columns are properties (what is stored, why it matters, what symptom appears, or what control exists). Watch the "why it matters" column: every record exists to prevent a specific class of resend, data loss, or bloat.',
        {type: 'callout', text: 'Local-first sync makes history durable first, then uses peer state to move only missing changes.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt: 'Directed acyclic graph with edges flowing through a topological ordering from earlier nodes to later nodes.', caption: 'Topological ordering of a directed acyclic graph by David Eppstein, Wikimedia Commons, CC0.'},
        {
          type: 'note',
          text: 'The animation uses a single document with two peers for clarity. Production sync engines manage hundreds of documents across dozens of peers, with per-document heads, per-peer sync state, and per-transport retry policies. The data structures are the same; the bookkeeping multiplies.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'When we are offline, we want to continue to read and write data, knowing that we can sync with others at a later time. We want to see the data as it was last time we synced, not have the entire app lock up and become unresponsive because of a network issue.',
          attribution: 'Kleppmann et al., "Local-First Software: You Own Your Data, in spite of the Cloud" (2019), Section 1',
        },
        'A CRDT merge rule tells you how two concurrent edits converge to the same result on every replica. It does not tell you how to save that edit to disk before the tab crashes, how to discover which changes a peer is missing, how to avoid resending the entire document on every reconnect, how to reclaim storage after the change log grows to millions of entries, or how to revoke access from a device that was lost.',
        'A local-first sync engine is the runtime that surrounds the merge rule. It manages durable local storage, change history, document frontier tracking, per-peer sync state, gap-filling message exchange, offline queuing, compaction, and transport abstraction. The CRDT provides convergence; the sync engine provides the seven properties that Kleppmann et al. identified as essential: fast, multi-device, offline, collaboration, longevity, privacy, and user ownership.',
        {
          type: 'table',
          headers: ['Property', 'What the CRDT alone provides', 'What the sync engine must add'],
          rows: [
            ['Fast', 'Nothing -- merge is post-hoc', 'Local-first write path: apply edit, persist, ack UI, sync later'],
            ['Multi-device', 'Deterministic merge on arrival', 'Discovery, transport adapters, peer state tracking'],
            ['Offline', 'Merge works whenever changes arrive', 'Durable local storage, offline queue, retry on reconnect'],
            ['Collaboration', 'Concurrent edits converge', 'Real-time transport, presence, awareness cursors'],
            ['Longevity', 'Nothing', 'Export, migration, format stability, no server dependency for reads'],
            ['Privacy', 'Nothing', 'Encryption, access control, capability URLs, revocation'],
            ['User ownership', 'Nothing', 'Local repo is canonical; server is optional relay, not gatekeeper'],
          ],
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious architecture puts truth on the server and treats every client as a cache. The app sends an edit to the server over HTTP or WebSocket, waits for an acknowledgement, then updates local state. This is the standard model for web applications: the database is the source of truth, the API is the write path, and the client renders whatever the server last returned.',
        {
          type: 'diagram',
          text: 'Server-authoritative model:\n\n  Client A        Server          Client B\n     |               |               |\n     |-- PUT edit --> |               |\n     |               |-- validate --> |\n     |               |-- store -----> |\n     |<-- 200 OK --- |               |\n     |               |-- push ----->>|\n     |               |               |-- render\n\n  Latency: round-trip to server before UI confirms\n  Offline: edit is lost or queued without guarantee\n  Crash:   if tab dies before 200 OK, edit is gone',
          label: 'The server sits in the acknowledgement path for every write',
        },
        'This design works when every device has a fast, stable connection to the server and the product does not need sub-100ms write latency. It is simple to reason about: one writer of record, one conflict resolution policy (last-write-wins or server-side merge), one place to enforce permissions.',
        'It fails the moment the product needs offline editing (field inspection apps, airplane note-taking, rural data collection), low-latency collaboration (design tools, shared whiteboards), multi-tab coordination (browser apps with workers), or peer-to-peer sync without a central server (end-to-end encrypted messaging, local network tools).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The server-authoritative model has two walls, and they compound.',
        {
          type: 'table',
          headers: ['Wall', 'Trigger', 'Consequence'],
          rows: [
            ['Write availability', 'Network partition, slow server, offline user', 'UI spinner or silent data loss; user sees edit on screen but it never persists'],
            ['Sync efficiency', 'Reconnection after offline period', 'Without change tracking, the client must send the full document or the server must diff two snapshots; neither scales to large documents with frequent edits'],
          ],
        },
        'The write-availability wall is the more painful one. A user types a paragraph on a plane. The app shows the text on screen. The tab crashes. On restart, the paragraph is gone because the app never persisted it locally -- it was waiting for the server. The user saw the edit, believed it was saved, and lost it. This is not an edge case; it is the normal experience of any web app that treats the client as a stateless view.',
        {
          type: 'diagram',
          text: 'The compound failure:\n\n  1. User edits offline      --> app has no local persistence\n  2. Tab crashes              --> in-memory state is gone\n  3. User reopens online      --> server has no record of the edit\n  4. Edit is permanently lost --> user trusted the UI, UI lied\n\n  Even WITH local persistence but WITHOUT change tracking:\n\n  1. User edits offline on device A and device B\n  2. Both come online\n  3. Server receives two full documents\n  4. Server must diff or pick one --> last-write-wins destroys the other\n  5. User loses work silently',
          label: 'Without history-as-data, offline work is a liability',
        },
        'The sync-efficiency wall appears at scale. If the only representation is the current document snapshot, every reconnection requires transferring or diffing the entire document. A 50-page collaborative document with 10,000 edits cannot afford to send 50 pages on every sync. The system needs a way to ask: "What changed since we last talked?"',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat document history as data, not as a side effect of the latest snapshot. Every edit becomes a named, immutable change with explicit causal dependencies. The document is the materialized result of applying all changes; the change graph is the structure that enables sync, merge, undo, audit, and compaction.',
        {
          type: 'diagram',
          text: 'Change DAG (directed acyclic graph):\n\n  c1 (init "Hello")\n   |\n  c2 (insert " world", depends on c1)\n   |\\______________\n   |                \\\n  c3 (insert "!", depends on c2)   c4 (delete "world", insert "there", depends on c2)\n   |                                |\n   (device A head: c3)             (device B head: c4)\n\n  Both heads are valid. Neither is "wrong" or "stale".\n  They represent two branches of history that have not yet met.\n  Sync means: send c3 to B, send c4 to A, merge both.',
          label: 'Heads are the frontier of the change DAG, not a version number',
        },
        'The key data structure is the heads set: the set of change hashes that have no descendants yet. If two peers report the same heads, they have the same history. If they report different heads, the difference tells the sync engine exactly which branches are missing. This is fundamentally different from a version counter or timestamp, which can only say "you are behind" but not "here is what you are missing."',
        {
          type: 'code',
          language: 'javascript',
          text: '// A change in the DAG\nconst change = {\n  hash: "a1b2c3",         // content-addressed identity\n  deps: ["x9y8z7"],       // parent change hashes (causal deps)\n  actor: "device-A",      // which replica created this\n  seq: 42,                // per-actor sequence number\n  ops: [                   // the actual edits\n    { action: "insert", path: ["text", 12], value: "!" }\n  ],\n  timestamp: 1718700000   // wall clock (advisory, not authoritative)\n};\n\n// Heads = changes with no children\n// If heads(A) = {c3} and heads(B) = {c4},\n// A is missing c4 and B is missing c3.\n// Sync exchanges exactly those changes.',
        },
        {
          type: 'note',
          text: 'This is the same insight behind Git. A Git commit names its parent commits. The branch pointer is a head. Merging two branches means applying the changes from one branch to the other. The difference is that Git requires manual conflict resolution for overlapping edits, while CRDTs define automatic merge semantics.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The sync engine has five subsystems: the local write path, the change DAG, the peer sync protocol, the storage layer, and the transport abstraction.',
        {
          type: 'code',
          language: 'javascript',
          text: '// 1. Local write path\nfunction applyEdit(doc, edit) {\n  const ops = doc.crdt.generateOps(edit);   // CRDT creates ops\n  const change = {\n    hash: contentHash(ops, doc.heads),\n    deps: [...doc.heads],                   // causal dependency\n    actor: doc.actorId,\n    seq: doc.nextSeq++,\n    ops,\n  };\n  doc.crdt.apply(change);                   // update in-memory state\n  doc.log.append(change);                   // durable append\n  doc.heads = [change.hash];                // advance frontier\n  doc.outbox.enqueue(change);               // queue for sync\n  return change;                            // UI gets instant ack\n}',
        },
        'The local write path is the foundation. The edit is applied to the in-memory CRDT, a durable change record is appended to the log, the heads set advances, and the change is queued for sync. The network is not in the acknowledgement path. The UI can confirm the edit before any peer knows about it.',
        {
          type: 'diagram',
          text: 'Sync handshake (Automerge-style):\n\n  Peer A                              Peer B\n    |                                    |\n    |-- syncMsg(myHeads, myNeed) ------->|\n    |                                    |-- compute missing changes\n    |                                    |-- compute what A is missing\n    |<-- syncMsg(yourMissing, myHeads) --|\n    |                                    |\n    |-- apply changes, update heads      |\n    |-- syncMsg(myHeads, done) --------->|\n    |                                    |-- apply, update heads\n    |<-- syncMsg(myHeads, done) ---------|\n    |                                    |\n    (heads now equal: synced)            (heads now equal: synced)',
          label: 'Two to four messages reach convergence without transferring the full document',
        },
        'The sync protocol works in rounds. Each peer sends its current heads and, optionally, a Bloom filter summarizing the changes it has. The other peer computes the set difference: which changes does it have that the sender is missing? It sends those changes back along with its own heads. After one or two round trips, both peers have the same change set and the same heads.',
        {
          type: 'code',
          language: 'javascript',
          text: '// 2. Peer sync state (per remote peer)\nclass PeerState {\n  constructor(peerId) {\n    this.peerId = peerId;\n    this.theirHeads = null;   // last reported heads from this peer\n    this.sentChanges = new Set(); // hashes we already sent\n    this.haveFilter = null;   // Bloom filter of our changes\n    this.inFlight = 0;        // messages awaiting ack\n  }\n\n  generateSyncMessage(doc) {\n    this.haveFilter = bloomFilter(doc.log.allHashes());\n    const missing = this.theirHeads\n      ? doc.log.changesSince(this.theirHeads)\n          .filter(c => !this.sentChanges.has(c.hash))\n      : [];  // first contact: send heads only, let peer request\n    missing.forEach(c => this.sentChanges.add(c.hash));\n    return { heads: doc.heads, changes: missing, have: this.haveFilter };\n  }\n\n  receiveSyncMessage(doc, msg) {\n    this.theirHeads = msg.heads;\n    for (const change of msg.changes) {\n      if (!doc.log.has(change.hash)) {\n        doc.crdt.apply(change);\n        doc.log.append(change);\n      }\n    }\n    doc.heads = doc.log.computeHeads();\n  }\n}',
        },
        'Per-peer state prevents sync from degrading into repeated full-document transfers. Each peer remembers: the remote heads last reported, which changes were already sent, which Bloom filter was exchanged, and how many messages are in flight. On reconnection, the engine can resume from where it left off instead of starting over.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Convergence rests on two properties of CRDTs: commutativity and idempotency. Operations can arrive in any order (commutativity) and be applied more than once without harm (idempotency). The sync engine does not need to guarantee exactly-once delivery or total ordering -- it only needs to ensure that every change eventually reaches every peer.',
        {
          type: 'table',
          headers: ['Property', 'What it guarantees', 'What the sync engine must preserve'],
          rows: [
            ['Commutativity', 'apply(a, b) = apply(b, a)', 'Changes can arrive out of causal order; buffer until deps are satisfied'],
            ['Idempotency', 'apply(a, a) = apply(a)', 'Re-sending a change is safe; dedup by hash is sufficient'],
            ['Causal consistency', 'If a depends on b, b is applied first', 'Buffer changes whose deps have not arrived; deliver in causal order'],
            ['Convergence', 'All replicas with the same change set have the same state', 'Ensure every change eventually reaches every peer -- that is the sync engine\'s entire job'],
          ],
        },
        {
          type: 'quote',
          text: 'A CRDT is a data type whose operations are designed so that they are commutative, associative, and idempotent -- so the order of execution does not matter. Any two replicas that have received the same set of updates are guaranteed to be in the same state.',
          attribution: 'Shapiro et al., "Conflict-Free Replicated Data Types" (2011)',
        },
        'The invariant the sync engine preserves is: after a sync round completes, both peers have identical heads sets. If heads(A) = heads(B), then A and B have applied the same set of changes, and by the CRDT convergence property, their document states are identical. The sync engine never needs to compare document content -- it only needs to compare change hashes.',
        'The corner case is causal buffering. If change c4 depends on c3, and a peer receives c4 before c3, it must buffer c4 until c3 arrives. Automerge handles this by including all transitive dependencies in each sync message when feasible. Yjs handles it by structuring operations with contiguous ID ranges so that missing ranges are detectable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Dimension', 'Server-authoritative', 'Local-first sync engine'],
          rows: [
            ['Write latency', '50-300ms (network round trip)', '<1ms (local apply + persist)'],
            ['Offline writes', 'Lost or queued without durability', 'Durable immediately; synced on reconnect'],
            ['Storage per device', 'Minimal (server holds state)', 'Full document + change log + peer state + snapshots'],
            ['Sync message size', 'Full document or server-computed diff', 'Only missing changes (identified by heads comparison)'],
            ['Implementation complexity', 'Standard REST/WebSocket CRUD', 'CRDT library + change DAG + peer state + compaction + transport adapters'],
            ['Conflict handling', 'Last-write-wins or manual merge', 'Automatic CRDT merge; no user-visible conflicts for supported types'],
          ],
        },
        'Storage is the primary ongoing cost. Every device stores the full document, the change log (or a compacted version), per-peer sync state, and snapshots. A collaborative text document with 100,000 edits might have a 2MB change log even if the current document is 50KB. Without compaction, storage grows monotonically with edit history.',
        {
          type: 'diagram',
          text: 'Storage growth without compaction:\n\n  Edits:     1K     10K     100K     1M\n  Log size:  20KB   200KB   2MB      20MB\n  Doc size:  5KB    15KB    50KB     200KB\n  Ratio:     4x     13x     40x      100x\n\n  The log grows with edit count.\n  The document grows with content.\n  The ratio diverges over time.\n  Compaction folds old changes into a snapshot to cap log growth.',
          label: 'Change log grows with edit history, not document size',
        },
        'Sync message cost depends on divergence. Two peers that sync every few seconds exchange a few changes per round -- often under 1KB. Two peers that diverged for a week might need to exchange thousands of changes. The Bloom filter optimization (used by Automerge) lets peers estimate the set difference cheaply: the filter is O(n) bits where n is the number of local changes, and false positives cause at most a few redundant change transmissions.',
        {
          type: 'note',
          text: 'Automerge columnar encoding compresses change data by 50-90% compared to naive JSON. A change that is 200 bytes as JSON might be 40 bytes in columnar format. Yjs uses a different binary encoding that is similarly compact. The encoding choice directly affects storage cost, sync bandwidth, and cold-start load time.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace two devices editing the same document offline, then syncing.',
        {
          type: 'diagram',
          text: 'Initial state (both devices synced):\n\n  Document: "Hello"\n  Change log: [c1: init "Hello"]\n  Heads: {c1}\n\nDevice A goes offline, types " world":\n\n  A applies:  c2 = insert " world" at pos 5, deps=[c1]\n  A log:      [c1, c2]\n  A heads:    {c2}\n  A outbox:   [c2]\n\nDevice B goes offline, types "!":\n\n  B applies:  c3 = insert "!" at pos 5, deps=[c1]\n  B log:      [c1, c3]\n  B heads:    {c3}\n  B outbox:   [c3]',
          label: 'Two branches of history diverge from the same parent',
        },
        {
          type: 'table',
          headers: ['Step', 'Actor', 'Action', 'Heads after', 'Document after'],
          rows: [
            ['1', 'A+B', 'Both start synced', '{c1}', '"Hello"'],
            ['2', 'A', 'Insert " world", offline', '{c2}', '"Hello world"'],
            ['3', 'B', 'Insert "!", offline', '{c3}', '"Hello!"'],
            ['4', 'A->B', 'A sends syncMsg(heads={c2}, changes=[c2])', '--', '--'],
            ['5', 'B', 'B receives c2, applies it, merges', '{c2, c3}', '"Hello world!"'],
            ['6', 'B->A', 'B sends syncMsg(heads={c2,c3}, changes=[c3])', '--', '--'],
            ['7', 'A', 'A receives c3, applies it, merges', '{c2, c3}', '"Hello world!"'],
            ['8', 'A+B', 'Heads match: sync complete', '{c2, c3}', '"Hello world!"'],
          ],
        },
        'At step 5, device B has two heads: c2 and c3. The CRDT merge rule determines that " world" was inserted at position 5 and "!" was also inserted at position 5, and it uses a deterministic tiebreaker (actor ID comparison) to order them. Both devices apply the same tiebreaker, so both arrive at "Hello world!" -- the same result regardless of which change arrived first.',
        {
          type: 'code',
          language: 'javascript',
          text: '// After sync, both devices have:\nconst syncedState = {\n  log: [c1, c2, c3],        // all changes from both branches\n  heads: new Set(["c2-hash", "c3-hash"]),  // two heads (will merge to one on next edit)\n  document: "Hello world!",  // CRDT merge result\n  peerState: {\n    "device-A": { theirHeads: ["c2-hash", "c3-hash"], sentChanges: ["c2", "c3"] },\n    "device-B": { theirHeads: ["c2-hash", "c3-hash"], sentChanges: ["c3", "c2"] },\n  },\n};\n// The next edit by either device will have deps=[c2, c3],\n// collapsing the two heads into one and advancing the frontier.',
        },
        {
          type: 'note',
          text: 'The two-head state is normal, not an error. It means the document has two branches of history that have been merged in content but not yet superseded by a new edit. The next change by either device will depend on both c2 and c3, creating a single new head and collapsing the fork.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Product', 'Sync engine approach', 'Why local-first fits'],
          rows: [
            ['Figma', 'Custom CRDT with central relay', 'Design moves generate hundreds of ops/second; round-trip latency for each would make the tool unusable'],
            ['Linear', 'Fractional indexing + local SQLite', 'Issue tracker must work offline and sync instantly across devices; reordering is the dominant operation'],
            ['Obsidian Sync', 'File-level CRDT with vault sync', 'Personal notes must survive offline editing on phone, tablet, and desktop simultaneously'],
            ['Ink & Switch prototypes', 'Automerge (change DAG + columnar storage)', 'Research platform for local-first design patterns; Pushpin, Pixelpusher, Cambria'],
            ['Expo/React Native offline apps', 'SQLite + custom sync layer', 'Field data collection in areas with intermittent connectivity; inspections, surveys, inventories'],
            ['Apple Notes / iCloud', 'Operational transform with CloudKit', 'Multi-device editing where the user expects instant local persistence and background sync'],
          ],
        },
        'Local-first wins when the user promise is "your work is saved the moment you see it on screen." Any product where the user edits content on a device that might lose connectivity -- note-taking, design, field inspection, collaborative documents, personal databases, project management -- benefits from a write path that does not depend on the network.',
        'It also wins for multi-surface coordination. A browser app with multiple tabs, a service worker, and a native shell all need to see the same document state. Without a local sync engine, each surface maintains its own cache with ad hoc invalidation. With a sync engine, each surface is a peer with explicit heads and an outbox, and the BroadcastChannel or SharedWorker is just another transport.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Transport adapter pattern: same sync protocol, different wires\nconst transports = [\n  new WebSocketTransport("wss://relay.example.com"),\n  new BroadcastChannelTransport("doc-sync"),  // same-origin tabs\n  new WebRTCTransport(signalingServer),        // peer-to-peer\n  new FileExportTransport("/exports/"),        // offline share via USB/AirDrop\n];\n\n// All transports use the same sync message format.\n// The engine generates messages; the transport delivers bytes.\nfor (const transport of transports) {\n  transport.onMessage((peerId, msg) => {\n    peerStates[peerId].receiveSyncMessage(doc, msg);\n    const reply = peerStates[peerId].generateSyncMessage(doc);\n    transport.send(peerId, reply);\n  });\n}',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The hardest failures are around the merge rule, not inside it.',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Root cause', 'Mitigation'],
          rows: [
            ['Lost local write', 'User sees edit, it vanishes after restart', 'App acked UI before persisting to IndexedDB/SQLite', 'Write-ahead: persist change before updating UI'],
            ['Infinite resend loop', 'Bandwidth spikes, sync never settles', 'Peer state was not updated after receiving changes', 'Update theirHeads on every received sync message'],
            ['History bloat', 'App startup takes 10+ seconds on mobile', 'Change log grew to 500K entries without compaction', 'Periodic snapshot + compaction; keep causal summary for peers'],
            ['Compaction breaks old peers', 'Peer that was offline for months cannot sync', 'Compaction discarded changes the old peer still needs', 'Keep a causal frontier per known peer; compact only past all known frontiers'],
            ['Schema drift', 'Old peer sends ops for a field that no longer exists', 'Document schema evolved; old ops reference stale paths', 'Schema migration as a change in the DAG; version-aware op application'],
            ['Unauthorized data leak', 'Revoked user still receives document updates', 'Sync engine has no access control layer', 'Capability-based access; relay server enforces share rules; encrypt at rest'],
            ['Clock skew', 'Timestamps in change log are nonsensical', 'Device clocks differ by hours or days', 'Use timestamps for display only; causal order comes from deps, not clocks'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Observability gap: engineers cannot debug sync without per-peer traces, queue depth metrics, compaction logs, and head-comparison tools. Most CRDT libraries provide merge correctness but not operational visibility.',
            'Quota exhaustion: mobile browsers limit IndexedDB to 50-200MB per origin. A document with a large change log can hit this limit silently, and the next write fails with an opaque DOMException.',
            'Garbage collection of tombstones: deleted elements in a CRDT become tombstones that must persist until all peers have seen the deletion. If a peer is offline indefinitely, tombstones accumulate forever.',
            'User-visible conflict: CRDTs resolve conflicts deterministically, but the result may not match user intent. Two users simultaneously changing a cell in a spreadsheet to different values get a merged result that neither intended. The sync engine converges; the product still needs a conflict-awareness UI.',
          ],
        },
        {
          type: 'note',
          text: 'Security is not a feature of CRDTs. Encryption, access control, device revocation, and audit logging must be designed separately. End-to-end encryption is possible (encrypt changes before sync, decrypt on receipt), but key management, group membership changes, and forward secrecy add significant complexity on top of the sync protocol.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Kleppmann et al., "Local-First Software" (2019), inkandswitch.com/local-first', 'The foundational essay: seven ideals for local-first software, survey of existing approaches, evaluation criteria'],
            ['Kleppmann, "Making CRDTs Byzantine Fault Tolerant" (2022), arxiv:2012.00472', 'Extending CRDT sync to adversarial environments; hash graphs for integrity verification'],
            ['Automerge documentation, automerge.org/docs', 'Reference implementation: change graph, columnar storage, sync protocol, TypeScript/Rust API'],
            ['Automerge sync protocol, automerge.org/automerge/automerge/sync', 'Detailed sync module docs: generateSyncMessage, receiveSyncMessage, SyncState, Bloom filters'],
            ['Yjs documentation, docs.yjs.dev', 'Alternative CRDT framework: struct store, update encoding, awareness protocol, provider pattern'],
            ['Figma multiplayer blog post (2019), figma.com/blog/how-figmas-multiplayer-technology-works', 'Production case study: custom CRDT with central relay, why they chose CRDTs over OT'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Sequence CRDTs for Collaborative Text to understand the merge rules that the sync engine wraps.',
            'Deep dive: study Automerge Change Graph & Columnar Storage for the specific data structures behind one major sync engine implementation.',
            'Complementary: study Delta-State CRDT Anti-Entropy Case Study for the state-based alternative to operation-based sync.',
            'Storage layer: study IndexedDB Object Store Case Study for the browser-side durable storage that most web-based sync engines use.',
            'Offline queue: study Background Sync Outbox Queue and Transactional Outbox for the reliability patterns that keep sync durable across crashes.',
            'Production extension: study Cloudflare Durable Objects Case Study for a server-side primitive that can serve as a relay and coordination point for local-first architectures.',
          ],
        },
      ],
    },
  ],
};

