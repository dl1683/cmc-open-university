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
    { heading: 'How to read the animation', paragraphs: [
      'Read this as a local write path plus a peer sync path. Active nodes show the durable record or message now being handled, compare nodes show peer state, and found nodes are changes safely stored or merged.',
      {type: 'callout', text: 'Local-first sync makes history durable first, then uses peer state to move only missing changes.'},
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt: 'Directed acyclic graph with edges flowing through a topological ordering from earlier nodes to later nodes.', caption: 'Topological ordering of a directed acyclic graph by David Eppstein, Wikimedia Commons, CC0.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Local-first software lets users read and write while offline, then synchronize later. A conflict-free replicated data type (CRDT) can merge concurrent edits, but the product still needs storage, sync discovery, transport, compaction, and access control.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is server-authoritative state. The client sends each edit to a server, waits for acknowledgement, and renders whatever the server later returns.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is offline trust. If the user sees an edit on screen but the tab crashes before server acknowledgement, the edit may be gone.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Treat history as data. Every edit becomes an immutable change with an id, actor, sequence number, operations, and dependencies on earlier changes.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A local write applies the CRDT operation, appends the change to durable storage, advances the heads set, and queues the change for sync. A sync round exchanges heads, computes missing changes, sends only those changes, buffers dependencies if needed, and recomputes heads.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument uses CRDT convergence. If operations are commutative and idempotent, then all peers with the same change set converge even when delivery order and duplicates vary.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is local state on every device: document, change log, snapshots, per-peer sync state, outbox, retry metadata, and sometimes encryption material. Cost grows with edit history, peer count, and time spent offline.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Local-first sync fits notes, design tools, whiteboards, field data collection, end-to-end encrypted collaboration, browser offline mode, and peer-to-peer tools. The shared need is low-latency local edits plus later convergence.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when actions need central authority before being shown, such as money transfer or inventory decrement. It also fails when business conflicts require human choice rather than automatic merge semantics.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Device A starts with heads {c1} and writes c2, while Device B also starts with {c1} and writes c3 offline. When they reconnect, A sends c2, B sends c3, and both recompute heads as {c2,c3}.',
      'If each change is 300 bytes, the sync sends about 600 bytes instead of a 50 KB document snapshot. The cost follows divergence, not total document size.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study Local-First Software at https://www.inkandswitch.com/local-first/, Shapiro et al. on CRDTs at https://inria.hal.science/inria-00555588/document, Automerge at https://automerge.org/, and Yjs at https://docs.yjs.dev/.',
      'Next, study CRDTs, vector clocks, version vectors, Merkle trees, Bloom filters, append-only logs, compaction, causal consistency, end-to-end encryption, and collaborative-editor conflict resolution.',
    ] },
  ],
};