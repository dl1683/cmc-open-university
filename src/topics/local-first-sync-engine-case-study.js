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
    explanation: 'A local-first app applies the edit immediately and records a durable CRDT change. The visible document is current locally before the network has done anything.',
    invariant: 'The local copy is primary, not a cache waiting for server permission.',
  };

  yield {
    state: syncGraph('Heads summarize the document frontier'),
    highlight: { active: ['doc', 'heads', 'state', 'e-doc-heads', 'e-heads-state'], compare: ['log'] },
    explanation: 'A document history is a DAG of changes. The heads are the current frontier: the latest changes that are not ancestors of another known change. They make divergence and incremental sync tractable.',
  };

  yield {
    state: syncGraph('Peer sync state remembers the other side'),
    highlight: { active: ['state', 'have', 'need', 'e-state-have', 'e-state-need'], compare: ['wire'] },
    explanation: 'Each connection keeps per-peer sync state: what heads the peer reported, what changes are in flight, and what summaries have already been exchanged. The engine should send missing changes, not the whole document.',
  };

  yield {
    state: syncGraph('The transport carries sync messages, not application truth'),
    highlight: { active: ['have', 'need', 'wire', 'peer', 'e-have-wire', 'e-need-wire', 'e-wire-peer'], found: ['state'] },
    explanation: 'The protocol can run over WebSocket, WebRTC, MessageChannel, BroadcastChannel, file exchange, or a central relay. The transport moves bytes; the CRDT and sync state decide which changes are still missing.',
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
    explanation: 'The sync engine is mostly bookkeeping. The visible product feels magical because the records are explicit: change DAG, heads, peer state, summaries, and outbox.',
  };
}

function* storageAndCompaction() {
  yield {
    state: storageGraph('Storage is the source of restart safety'),
    highlight: { active: ['ui', 'repo', 'idb', 'e-ui-repo', 'e-repo-idb'], compare: ['network'] },
    explanation: 'The UI can acknowledge edits immediately only if the repository persists them locally. IndexedDB, filesystem adapters, or SQLite-backed storage make the local replica restart-safe.',
  };

  yield {
    state: storageGraph('Snapshots make large documents load quickly'),
    highlight: { active: ['idb', 'snapshot', 'changes', 'e-idb-snapshot', 'e-idb-changes'], compare: ['compact'] },
    explanation: 'Keeping every change forever is useful for merge, history, and audit, but startup should not replay an unbounded log. A snapshot plus recent changes gives a fast load path.',
  };

  yield {
    state: storageGraph('Compaction is a correctness-preserving rewrite'),
    highlight: { active: ['changes', 'compact', 'snapshot', 'e-changes-compact'], found: ['idb'] },
    explanation: 'Compaction can fold old changes into a compact storage representation or snapshot. It must preserve the causal information needed for peers that have not yet seen those changes.',
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
    explanation: 'The sync algorithm is only one layer. A real product also needs durable local writes, compaction, access control, encryption or capability discipline, and observability.',
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
      heading: 'What it is',
      paragraphs: [
        'A local-first sync engine is the runtime that makes a CRDT document usable as an application database. The CRDT defines how changes merge. The sync engine stores those changes locally, remembers which peers have which history, sends only missing changes, receives remote changes, updates the document, and keeps working when the network is gone.',
        'The local-first software essay argues for apps where the user can work offline, own local data, and still collaborate across devices: https://www.inkandswitch.com/essay/local-first/. Automerge describes itself as a library of data structures for collaborative applications where devices can update local state independently, sync later, and converge: https://automerge.org/docs/hello/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A CRDT document has a history of changes, often shaped like a DAG because concurrent changes can have different parents. The current frontier of that DAG is the heads set. When two peers sync, each side needs to learn what the other already has and what is missing. Automerge documents its sync module as a loop where peers maintain state for each connection, exchange sync messages, and continue until neither side has more to send: https://automerge.org/automerge/automerge/sync/index.html.',
        'Automerge Repo adds the application plumbing: storage adapters, network adapters, document handles, and repositories. Its concepts page says repositories communicate using an efficient transport-agnostic sync protocol and that networking and storage are pluggable: https://automerge.org/docs/reference/concepts/. The JavaScript packages page draws the same boundary between core CRDT/sync/storage format and repo-level networking/storage plumbing: https://automerge.org/docs/reference/the-js-packages/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core records are a change DAG, heads set, peer-state map, message queue, durable local store, snapshot record, and compaction plan. The change DAG stores each operation and its dependencies. The heads set summarizes the current frontier. The peer-state map remembers what each connected peer has reported, so the engine avoids resending the same history forever. The outbox survives offline intervals. Snapshots make startup fast.',
        'This is why local-first belongs in a data-structures course. It combines CRDTs, Logical Clocks, IndexedDB Object Store Case Study, Background Sync Outbox Queue, Web Push Subscription Delivery, Message Queue, Transactional Outbox, Service Workers, and Content-Defined Chunking. The CRDT tells replicas how to merge; the sync engine decides what bytes move, when they move, and what survives restart.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a local-first project notebook. The browser loads a document handle from IndexedDB and renders immediately. The user edits a checklist offline. The repository applies the transaction, appends the CRDT change to local storage, updates the heads set, and schedules sync work. Later a WebSocket connection opens. The peer-state record says the server has old heads. The sync engine sends only the missing changes. The server applies them and returns changes from another device. Both devices converge without the browser ever treating the server as the only truth.',
        'A central server can still be useful. It can relay messages, store encrypted blobs, keep devices discoverable, or host a Cloudflare Durable Objects room for active collaborators. But the server is no longer the master copy of every edit. The local repository is allowed to accept work first, and the merge algorithm plus sync state make the later conversation correct.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first mistake is assuming CRDT convergence solves product security. A CRDT can merge unauthorized data perfectly. The sync layer still needs document sharing rules, authentication, encryption, and revocation strategy. The second mistake is letting history grow forever without a load-time strategy. Keeping all changes is useful, but the application needs snapshots, compressed storage, and safe compaction.',
        'The third mistake is hiding sync state. Users need meaningful states such as saved locally, syncing, synced, conflict surfaced, blocked by permission, and storage quota risk. Engineers need peer sync traces. A local-first app can be offline-first and still be observable.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Local-First Software at https://www.inkandswitch.com/essay/local-first/, local-first PDF at https://martin.kleppmann.com/papers/local-first.pdf, Automerge introduction at https://automerge.org/docs/hello/, Automerge concepts at https://automerge.org/docs/reference/concepts/, Automerge sync module at https://automerge.org/automerge/automerge/sync/index.html, and Byzantine Eventual Consistency at https://arxiv.org/abs/2012.00472. Study Sequence CRDTs for Collaborative Text, Delta-State CRDT Anti-Entropy Case Study, Yjs Struct Store & Updates, Automerge Change Graph & Columnar Storage, CRDT Snapshot Compaction & Garbage Collection, Peritext Rich-Text CRDT Case Study, Collaborative Awareness Presence CRDT, Collaborative Undo/Redo Intention Stack, IndexedDB Object Store Case Study, Background Sync Outbox Queue, Web Push Subscription Delivery, Browser Message Channels & Broadcast Coordination, Web Locks API Lock Manager, Service Workers, Message Queue, Transactional Outbox, and Cloudflare Durable Objects Case Study next.',
      ],
    },
  ],
};
