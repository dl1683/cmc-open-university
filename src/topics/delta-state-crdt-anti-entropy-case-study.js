// Delta-state CRDT anti-entropy: send joinable state fragments instead of
// whole CRDT states, then track peer intervals so unreliable gossip converges.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'delta-state-crdt-anti-entropy-case-study',
  title: 'Delta-State CRDT Anti-Entropy Case Study',
  category: 'Systems',
  summary: 'Delta-state CRDTs keep state-based convergence while sending compact delta fragments, buffered intervals, per-peer acknowledgments, and causal merge guards.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['delta mutators', 'anti-entropy protocol'], defaultValue: 'delta mutators' },
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

function deltaGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'replicaA', label: 'A', x: 0.7, y: 4.0, note: notes.replicaA ?? 'replica' },
      { id: 'state', label: 'state', x: 2.1, y: 4.0, note: notes.state ?? 'join set' },
      { id: 'mutator', label: 'mut', x: 3.5, y: 2.4, note: notes.mutator ?? 'edit' },
      { id: 'delta', label: 'delta', x: 4.8, y: 2.4, note: notes.delta ?? 'frag' },
      { id: 'buffer', label: 'buf', x: 4.8, y: 5.5, note: notes.buffer ?? 'intervals' },
      { id: 'gossip', label: 'gossip', x: 6.4, y: 4.0, note: notes.gossip ?? 'retry' },
      { id: 'merge', label: 'join', x: 8.0, y: 4.0, note: notes.merge ?? 'idem' },
      { id: 'replicaB', label: 'B', x: 9.4, y: 4.0, note: notes.replicaB ?? 'replica' },
    ],
    edges: [
      { id: 'e-a-state', from: 'replicaA', to: 'state', weight: '' },
      { id: 'e-state-mutator', from: 'state', to: 'mutator', weight: '' },
      { id: 'e-mutator-delta', from: 'mutator', to: 'delta', weight: '' },
      { id: 'e-delta-state', from: 'delta', to: 'state', weight: '' },
      { id: 'e-delta-buffer', from: 'delta', to: 'buffer', weight: '' },
      { id: 'e-buffer-gossip', from: 'buffer', to: 'gossip', weight: '' },
      { id: 'e-gossip-merge', from: 'gossip', to: 'merge', weight: '' },
      { id: 'e-merge-b', from: 'merge', to: 'replicaB', weight: '' },
    ],
  }, { title });
}

function entropyGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'log', label: 'D', x: 1.1, y: 3.8, note: notes.log ?? 'log' },
      { id: 'ackB', label: 'B', x: 2.7, y: 2.4, note: notes.ackB ?? 'ack' },
      { id: 'ackC', label: 'C', x: 2.7, y: 5.2, note: notes.ackC ?? 'ack' },
      { id: 'interval', label: 'interval', x: 4.2, y: 3.8, note: notes.interval ?? 'd[a,b]' },
      { id: 'causal', label: 'guard', x: 5.9, y: 2.4, note: notes.causal ?? 'base ok?' },
      { id: 'send', label: 'send', x: 5.9, y: 5.2, note: notes.send ?? 'retry' },
      { id: 'peer', label: 'peer', x: 7.7, y: 3.8, note: notes.peer ?? 'join' },
      { id: 'gc', label: 'GC', x: 9.2, y: 3.8, note: notes.gc ?? 'after ack' },
    ],
    edges: [
      { id: 'e-log-ackB', from: 'log', to: 'ackB', weight: '' },
      { id: 'e-log-ackC', from: 'log', to: 'ackC', weight: '' },
      { id: 'e-log-interval', from: 'log', to: 'interval', weight: '' },
      { id: 'e-interval-causal', from: 'interval', to: 'causal', weight: '' },
      { id: 'e-interval-send', from: 'interval', to: 'send', weight: '' },
      { id: 'e-causal-peer', from: 'causal', to: 'peer', weight: '' },
      { id: 'e-send-peer', from: 'send', to: 'peer', weight: '' },
      { id: 'e-peer-gc', from: 'peer', to: 'gc', weight: '' },
    ],
  }, { title });
}

function bytesPlot(title) {
  const edits = [0, 10, 20, 40, 80, 120, 160];
  return plotState({
    axes: { x: { label: 'edits', min: 0, max: 170 }, y: { label: 'KB sent', min: 0, max: 180 } },
    series: [
      { id: 'full', label: 'full', points: edits.map((x) => ({ x, y: 8 + x * 0.9 })) },
      { id: 'delta', label: 'dlt', points: edits.map((x) => ({ x, y: x === 0 ? 1 : 3 + x * 0.08 })) },
      { id: 'ops', label: 'op', points: edits.map((x) => ({ x, y: x === 0 ? 1 : 2 + x * 0.05 })) },
    ],
    markers: [
      { id: 'gap', x: 90, y: 89, label: 'gap' },
      { id: 'guard', x: 135, y: 14, label: 'log' },
    ],
  }, { title });
}

function* deltaMutators() {
  yield {
    state: deltaGraph('A delta mutator returns a joinable state fragment'),
    highlight: { active: ['replicaA', 'state', 'mutator', 'delta', 'e-state-mutator', 'e-mutator-delta'], compare: ['gossip'] },
    explanation: 'A delta-state CRDT update returns two things: the new local state after join, and a small delta-state that can be sent to peers. The delta is not a fragile operation; it is itself mergeable CRDT state.',
    invariant: 'Delta-state CRDTs keep state-based idempotent merge while reducing message size.',
  };

  yield {
    state: matrixState({
      title: 'G-counter increment as a delta',
      rows: [
        { id: 'before', label: 'before A' },
        { id: 'delta', label: 'delta' },
        { id: 'afterA', label: 'A joins' },
        { id: 'afterB', label: 'B joins' },
      ],
      columns: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'sum', label: 'sum' },
      ],
      values: [
        [2, 1, 0, 3],
        [3, 0, 0, 3],
        [3, 1, 0, 4],
        [3, 1, 0, 4],
      ],
    }),
    highlight: { active: ['delta:a', 'afterA:a', 'afterB:a'], found: ['afterA:sum', 'afterB:sum'] },
    explanation: 'For a G-counter, the delta for A incrementing is just the changed A component. Joining it locally and remotely uses the same elementwise max as full-state CRDT merge.',
  };

  yield {
    state: labelMatrix(
      'OR-set delta fragments',
      [
        { id: 'add', label: 'add milk' },
        { id: 'rm', label: 'remove milk' },
        { id: 'join', label: 'join peer' },
        { id: 'read', label: 'read set' },
      ],
      [
        { id: 'delta', label: 'delta' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['tag a7', 'add seen'],
        ['tomb a1', 'rm seen tag'],
        ['max sets', 'idempotent'],
        ['live tags', 'value'],
      ],
    ),
    highlight: { active: ['add:delta', 'rm:delta', 'join:effect'], found: ['read:effect'] },
    explanation: 'For sets and maps, a delta can carry a new add tag, a tombstone, or a compact group of changes. The receiver still performs a join, so duplicates and retries stay harmless.',
  };

  yield {
    state: labelMatrix(
      'CRDT message styles',
      [
        { id: 'state', label: 'state' },
        { id: 'op', label: 'op' },
        { id: 'delta', label: 'delta' },
      ],
      [
        { id: 'msg', label: 'msg' },
        { id: 'network', label: 'net' },
        { id: 'caveat', label: 'risk' },
      ],
      [
        ['whole', 'loss ok', 'large'],
        ['op', 'causal', 'strict'],
        ['diff', 'retry', 'log'],
      ],
    ),
    highlight: { active: ['delta:msg', 'delta:network'], compare: ['state:msg', 'op:network'] },
    explanation: 'Delta-state CRDTs sit between the two classic designs: smaller messages like operation-based CRDTs, but merge semantics that tolerate retry, reordering, and duplicate delivery like state-based CRDTs.',
  };

  yield {
    state: bytesPlot('Deltas keep bandwidth closer to edits than to total state'),
    highlight: { active: ['delta', 'gap'], compare: ['full'], found: ['ops', 'guard'] },
    explanation: 'The plot is illustrative: full-state sync grows with object size, while delta sync grows with recent changes. The price is retaining enough delta history and causal metadata to repair missed peers.',
  };

  yield {
    state: deltaGraph('A delta must be joined locally before it is sent', { delta: 'join first', buffer: 'save', gossip: 'later', merge: 'same join' }),
    highlight: { active: ['delta', 'state', 'buffer', 'e-delta-state', 'e-delta-buffer'], found: ['gossip', 'merge'] },
    explanation: 'A durable implementation treats a delta as part of state evolution, not as a transient packet. The replica joins it locally, buffers it for peers, and can retransmit or coalesce it without changing the merge result.',
  };
}

function* antiEntropyProtocol() {
  yield {
    state: entropyGraph('Anti-entropy tracks deltas per peer'),
    highlight: { active: ['log', 'ackB', 'ackC', 'interval'], compare: ['peer'] },
    explanation: 'Anti-entropy is the background repair loop. Each replica keeps a delta log and per-neighbor knowledge about which delta sequence each peer has acknowledged or is believed to contain.',
    invariant: 'Convergence comes from repeated repair, not from one perfect delivery attempt.',
  };

  yield {
    state: labelMatrix(
      'Delta interval log',
      [
        { id: 'd1', label: 'd1' },
        { id: 'd2', label: 'd2' },
        { id: 'd3', label: 'd3' },
        { id: 'd4', label: 'd4' },
      ],
      [
        { id: 'base', label: 'base' },
        { id: 'delta', label: 'delta' },
        { id: 'sendB', label: 'send B' },
      ],
      [
        ['s0', 'add a', 'acked'],
        ['s1', 'add b', 'acked'],
        ['s2', 'rm a', 'send'],
        ['s3', 'add c', 'send'],
      ],
    ),
    highlight: { active: ['d3:sendB', 'd4:sendB'], found: ['d1:sendB', 'd2:sendB'] },
    explanation: 'Instead of shipping one packet per edit forever, the sender can combine a continuous range of deltas into a delta interval. The receiver joins the interval as one mergeable state fragment.',
  };

  yield {
    state: entropyGraph('Causal merge guards prevent impossible partial states', { interval: 'd3..d4', causal: 'has base?', send: 'hold/retry', peer: 'join when safe' }),
    highlight: { active: ['interval', 'causal', 'peer', 'e-interval-causal', 'e-causal-peer'], compare: ['send'] },
    explanation: 'Causal delta merging means a peer should join a delta interval only after it already reflects the base state for that interval. Otherwise the receiver can hold, request earlier deltas, or fall back to a larger state transfer.',
  };

  yield {
    state: labelMatrix(
      'Per-peer send table',
      [
        { id: 'B', label: 'peer B' },
        { id: 'C', label: 'peer C' },
        { id: 'D', label: 'peer D' },
        { id: 'new', label: 'new peer' },
      ],
      [
        { id: 'known', label: 'known' },
        { id: 'pending', label: 'pending' },
        { id: 'action', label: 'action' },
      ],
      [
        ['d2', 'd3..d4', 'send'],
        ['d4', '-', 'idle'],
        ['d1', 'd2..d4', 'send'],
        ['none', 'all', 'snap'],
      ],
    ),
    highlight: { active: ['B:action', 'D:action'], found: ['new:action'], compare: ['C:action'] },
    explanation: 'The table is the production data structure. Different peers can be at different points, so the sender chooses an interval, an idle response, or a snapshot fallback per peer.',
  };

  yield {
    state: entropyGraph('Garbage collection waits for peer evidence', { log: 'old deltas', ackB: 'd4', ackC: 'd4', interval: 'min ack', gc: 'drop d1..d3' }),
    highlight: { active: ['ackB', 'ackC', 'gc', 'e-peer-gc'], found: ['log'] },
    explanation: 'Delta history is not free. Once every relevant peer has acknowledged or otherwise subsumed old deltas, the sender can compact them into a snapshot or discard them safely.',
  };

  yield {
    state: labelMatrix(
      'Complete case study: replicated config map',
      [
        { id: 'edit', label: 'edit' },
        { id: 'delta', label: 'delta' },
        { id: 'buf', label: 'buffer' },
        { id: 'send', label: 'send' },
        { id: 'repair', label: 'repair' },
        { id: 'gc', label: 'gc' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['put', 'key?'],
        ['cell', 'size'],
        ['d42', 'lost'],
        ['int', 'base'],
        ['snap', 'lag'],
        ['ack', 'early'],
      ],
    ),
    highlight: { active: ['delta:state', 'send:state', 'repair:state'], compare: ['gc:risk'] },
    explanation: 'A replicated in-memory config map should not gossip megabytes after one key changes. It emits a map-cell delta, buffers it, sends intervals to peers, repairs laggards with snapshots, and only garbage-collects deltas after acknowledgments make that safe.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'delta mutators') yield* deltaMutators();
  else if (view === 'anti-entropy protocol') yield* antiEntropyProtocol();
  else throw new InputError('Pick a delta-state CRDT view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A delta-state CRDT is a state-based CRDT that sends compact state fragments instead of shipping the entire replicated object after every update. The delta is still state: it is joined into the local replica, stored for peers, retried if necessary, and merged at the receiver with the same idempotent algebra as the full object.',
        'This fills the gap between the CRDTs primer and the Local-First Sync Engine Case Study. CRDTs explain why merge converges. Delta-state anti-entropy explains how a production system keeps the messages small without depending on exactly-once reliable operation broadcast.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A normal state-based CRDT mutator changes the local state. A delta mutator returns a smaller state fragment that represents the effect of the update. The replica joins that delta into its own state and records it in a delta log. Peers later receive either one delta or a delta interval, which is a coalesced range of deltas, and join it into their own state.',
        'The important distinction is that a delta is not merely an operation. If a delta is delivered twice, joining it twice is harmless. If deltas arrive through gossip retries, the semilattice laws still absorb duplication and reordering, subject to the causal merge requirements of the data type.',
      ],
    },
    {
      heading: 'Anti-entropy data structures',
      paragraphs: [
        'A practical delta-state CRDT implementation needs a delta log, sequence numbers, per-peer acknowledgment or known-state summaries, pending intervals, causal-base checks, snapshot fallback, and garbage-collection watermarks. These are the operational records that turn a mathematical merge into a reliable synchronization loop.',
        'The causal delta-merging condition says that a delta interval should be joined only into a state that already reflects the base state from which the interval starts. Without that guard, a receiver can temporarily observe an order that the original state-based CRDT would not allow. Implementations handle this by holding intervals, requesting older deltas, or falling back to a snapshot.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a replicated in-memory configuration map across a cluster. A node updates key feature.checkout to enabled. Sending the whole map to every peer would grow with the total configuration size. A delta-state map emits a small delta for that key, joins it locally, and stores it as d42. The anti-entropy loop sends d42, or a coalesced interval around it, to each peer that has not acknowledged it.',
        'If peer B missed d40 and d41, the sender can transmit d40..d42 as one interval. If peer D is new or too far behind, the sender can use a compact snapshot instead of replaying an unbounded delta log. After all relevant peers have acknowledged or subsumed d42, old deltas can be compacted. The platform gets small messages, eventual convergence, and explicit repair paths.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat deltas as fire-and-forget events. If a peer misses a delta, the system needs retry, interval replay, or snapshot repair. Do not garbage-collect the delta log only because the local replica has joined the delta; lagging peers may still need it. Do not assume smaller messages are free; per-peer state and causal guards become part of the correctness boundary.',
        'Also do not confuse delta-state CRDTs with application diffs. A JSON patch that mutates a document is not automatically a CRDT delta. A real delta must be a state fragment that can be joined under the CRDT merge law and preserve the intended convergence guarantees.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Delta State Replicated Data Types at https://arxiv.org/abs/1603.01529, the journal PDF at https://members.loria.fr/CIgnat/files/replication/Delta-CRDT.pdf, CRDT glossary at https://crdt.tech/glossary, Akka Distributed Data delta-CRDT docs at https://doc.akka.io/libraries/akka-core/current/typed/distributed-data.html, and Apache Pekko Distributed Data delta-CRDT docs at https://pekko.apache.org/docs/pekko/current/typed/distributed-data.html. Study CRDTs, Gossip Protocol, Local-First Sync Engine Case Study, Yjs Struct Store & Updates, Automerge Change Graph & Columnar Storage, CRDT Snapshot Compaction & Garbage Collection, Version Vectors & Dotted Version Vectors, and Read/Write Quorums next.',
      ],
    },
  ],
};
