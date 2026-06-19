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
        "Read the animation as the execution trace for Local-First Sync Engine Case Study. How local-first apps synchronize CRDT documents with op logs, heads, peer sync state, durable storage, transports, and compaction..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `A CRDT merge rule is not an application. It tells you how concurrent edits can converge, but it does not tell you how an editor saves local work, resumes after a crash, finds missing changes, avoids resending the whole document, or protects a private note from the wrong peer. A local-first sync engine is the runtime around the merge rule.`,
        `The user promise is simple: the local copy is primary, not a cache waiting for server permission. The engineering promise is stricter: local edits must be durable before the UI claims success, peers must exchange only what they are missing, and restart must not lose the history needed for future reconciliation.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The obvious design makes the server the source of truth and treats the client as a cache. The app sends an edit to the server, waits for acceptance, then updates local state. That design is easy to reason about while every device is online, the server is close, and the product does not need instant response.`,
        `It fails the moment the product expects offline work, low-latency editing, multi-tab continuity, or peer-to-peer collaboration. If the server is in the acknowledgement path for every useful edit, a train tunnel can become a write outage. If the client cache is not the real store, a tab crash can lose work the user already saw on screen.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is to treat document history as data, not as a side effect of the latest document snapshot. A CRDT change names its dependencies. Concurrent changes can produce multiple heads. Heads are the frontier of known history. If two peers report different heads, they are not merely "stale"; they know different branches of the change graph.`,
        `Sync then becomes a gap-filling problem. Each peer summarizes what it has, asks for what it lacks, applies missing changes in causal order when possible, and updates its frontier. The document value is the materialized result of the history, but the history is what lets peers converge after partitions.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A local edit first updates the in-memory document and appends a durable change record. The engine also updates the heads set and queues sync work for known peers. The network is not required for the local acknowledgement. That is the difference between local-first and a web form with optimistic UI.`,
        `When a peer appears, the engine compares sync state. It remembers what heads the peer reported, which changes were already sent, which requests are in flight, and whether the peer is too far behind for a small incremental message. The transport carries sync messages; the engine decides what those messages mean. WebSocket, WebRTC, BroadcastChannel, file export, or a relay can all be adapters.`,
      ],
    },
    {
      heading: `Storage and restart`,
      paragraphs: [
        `Local-first is only honest if local storage is real. IndexedDB, SQLite, filesystem storage, or another durable store must receive the change before the app implies that the edit is safe. The engine needs a restart path that can load a snapshot, replay recent changes, rebuild heads, and resume the outbox without duplicating effects.`,
        `The append-only change log is excellent for merge and audit, but bad as an unbounded startup path. Snapshots solve that by storing a compact materialized document plus enough causal summary to continue syncing. Compaction is not deletion for convenience; it is a correctness-preserving rewrite with a contract.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The handshake graph shows the local edit entering the document, change log, and heads set before it reaches the wire. That ordering is the point. Local usefulness does not wait for remote permission. Sync explains already-durable local history to other replicas.`,
        `The storage graph separates UI, repository, local disk, snapshots, change tail, compaction, queue, and network because each one has a different failure mode. If storage and transport blur together, offline support becomes a demo. If snapshots and causal summaries blur together, compaction can make old peers impossible to repair.`,
      ],
    },
    {
      heading: `Why convergence works`,
      paragraphs: [
        `CRDT convergence depends on operations or states that can be merged without a single total order. In an operation-based design, each change carries enough dependency information for replicas to apply it consistently. In a state-based or delta-state design, replicas exchange joinable states or deltas. Either way, the sync engine must preserve the mathematical assumptions of the CRDT.`,
        `That is why peer state matters. Without remembered peer knowledge, every reconnect becomes a full document transfer or a resend loop. With peer state, the next message can be a targeted request for the missing part of history. The engine is a data-structure problem: logs, frontiers, version summaries, durable queues, and compacted snapshots.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Local-first systems trade central simplicity for edge bookkeeping. Every device needs durable storage, migration logic, quota handling, conflict visibility, and sync observability. Every document may need encryption, share permissions, tombstone strategy, garbage collection, and a way to repair a peer that missed old changes.`,
        `The payoff is responsiveness and resilience. Notes, design tools, field apps, offline forms, personal knowledge bases, project planners, and collaborative editors can keep accepting work under bad Wi-Fi or no Wi-Fi. A central server can still relay messages, store encrypted blobs, perform access checks, and help devices discover each other. It is useful infrastructure, not the only place truth can exist.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `This architecture wins when user trust depends on continuity. A writer should not wonder whether a paragraph typed on a plane counted. A field worker should not lose an inspection because a warehouse had bad coverage. A designer should not wait for a round trip on every shape movement. The local repository accepts the work first and reconciles later.`,
        `It also wins when multiple local surfaces need coordination. Tabs, workers, native shells, mobile background tasks, and browser storage can all see different timing. A sync engine with explicit heads, outboxes, and peer state gives the product a shared truth model across those surfaces instead of ad hoc cache invalidation.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The hardest failures are often outside the merge law: lost local writes, broken compaction, stale peer state that resends forever, unauthorized peers receiving data, quota exhaustion, schema drift, clock assumptions, and invisible stuck queues. A correct CRDT can still produce a bad product if users cannot tell whether work is saved locally, syncing, synced, blocked, or at risk.`,
        `Security needs its own design. Sharing rules, authentication, encryption or capability discipline, revocation, device loss, and audit logs do not appear automatically because the merge function converges. Observability matters too. Engineers need per-peer sync traces, reset tools, compaction metrics, queue depth, storage pressure, and enough event history to debug a replica that refuses to catch up.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Build the local write path first: apply the edit, append the change, update heads, persist the outbox, then notify the UI and transports. Make peer state explicit and resettable. Make snapshot fallback part of the protocol, not a manual recovery step. Keep transport adapters boring; merge decisions belong in the sync engine.`,
        `Test with hostile timelines. Restart after an edit but before send. Reconnect two peers that edited offline. Compact while an old peer is still missing changes. Fill storage. Revoke access while messages are queued. Open two tabs and close one mid-sync. Those tests reveal whether the system is truly local-first or only optimistic while the happy path holds.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Sequence CRDTs for Collaborative Text, Delta-State CRDT Anti-Entropy Case Study, Yjs Struct Store & Updates, Automerge Change Graph & Columnar Storage, CRDT Snapshot Compaction & Garbage Collection, Peritext Rich-Text CRDT Case Study, Collaborative Awareness Presence CRDT, Collaborative Undo/Redo Intention Stack, IndexedDB Object Store Case Study, Background Sync Outbox Queue, Web Push Subscription Delivery, Browser Message Channels & Broadcast Coordination, Web Locks API Lock Manager, Service Workers, Message Queue, Transactional Outbox, and Cloudflare Durable Objects Case Study.`,
        `Primary sources worth reading are Local-First Software at https://www.inkandswitch.com/essay/local-first/, the local-first paper at https://martin.kleppmann.com/papers/local-first.pdf, Automerge documentation at https://automerge.org/docs/hello/ and https://automerge.org/docs/reference/concepts/, Automerge sync module documentation at https://automerge.org/automerge/automerge/sync/index.html, and Byzantine Eventual Consistency at https://arxiv.org/abs/2012.00472.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for local-first-sync-engine-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

