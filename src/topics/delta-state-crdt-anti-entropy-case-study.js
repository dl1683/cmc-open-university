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
    explanation: 'A delta mutator changes the local replica and returns the small state fragment that caused the change. The important detail in the graph is that the fragment is joined locally before it is buffered or sent, so resend and duplicate delivery still use normal CRDT merge.',
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
    explanation: 'For a G-counter, the delta is only A\'s changed component. The receiver does not run a special operation; it joins the fragment with elementwise max. That is why a tiny message keeps the same idempotent behavior as full-state sync.',
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
    explanation: 'The table places delta-state CRDTs between full-state and op-based designs. They send small change-shaped fragments, but the fragment is still state. You get retry tolerance without broadcasting the entire object after every edit.',
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
    explanation: 'Anti-entropy is the repair loop that keeps convergence from depending on one perfect delivery. The graph highlights the real data structures: a retained delta log plus per-peer knowledge of which intervals are already known or acknowledged.',
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
    explanation: 'A delta interval coalesces adjacent retained deltas. That gives the sender a practical retry unit: fewer packets than one-per-edit, less waste than a full snapshot, and still one joinable state fragment at the receiver.',
  };

  yield {
    state: entropyGraph('Causal merge guards prevent impossible partial states', { interval: 'd3..d4', causal: 'has base?', send: 'hold/retry', peer: 'join when safe' }),
    highlight: { active: ['interval', 'causal', 'peer', 'e-interval-causal', 'e-causal-peer'], compare: ['send'] },
    explanation: 'The guard is where delta sync stops being a simple diff stream. A receiver should join an interval only if it already contains the base state that interval assumes. If not, the safe moves are hold it, request the gap, or switch to a snapshot.',
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
    explanation: 'This table is the production heart of anti-entropy. Each peer can be at a different frontier, so the sender chooses per peer: send a missing interval, do nothing, or reset a far-behind peer from a snapshot.',
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
    explanation: 'The config-map case study shows the complete loop: emit a cell-level delta, join it locally, retain it, send intervals to peers, repair laggards with snapshots, and drop old deltas only after peer evidence says they are no longer needed.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The delta-mutator view shows one replica changing local state and emitting a small fragment. A CRDT is a replicated data type whose merge rule makes replicas converge despite reordering and duplicate delivery. Active nodes show the local mutator, emitted delta, buffer, and gossip path; found nodes show state that has become known to a peer.',
        'The anti-entropy view shows the repair loop. Anti-entropy means repeated exchange of missing state until replicas agree. The safe inference rule is that a delta may be joined only when it is valid CRDT state and any causal base it assumes is already present or supplied by repair.',
        {type:'callout', text:'Delta-state CRDTs save bandwidth only because every small fragment remains joinable state protected by anti-entropy, peer frontiers, and causal guards.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'State-based CRDTs are attractive because merge is simple: replicas periodically exchange state and join it. Join means the least upper bound in a semilattice, a structure where merge is associative, commutative, and idempotent. Duplicate packets, reordered packets, and retries do not change the final answer.',
        'The cost is bandwidth. A one-key update in a large replicated map can force the sender to ship the whole map. Delta-state CRDTs exist to keep state-based convergence while sending only the small state fragment created by a recent update.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is full-state gossip. Every replica sends the entire counter, set, or map to every peer on a schedule. It is wasteful but robust because any later full state repairs missed earlier packets.',
        'A second approach is operation shipping. Send commands such as increment A or remove tag x. This is compact, but it needs causal delivery, dedupe, and replay protection because applying the same operation twice or before its dependency can change the result.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a random diff is not a CRDT state fragment. If applying it twice changes the answer, it is not idempotent. If applying it before required base state creates an impossible set or map, it needs a causal guard.',
        'There is also a retention wall. If a sender discards a delta before a slow peer receives it, anti-entropy has no repair material. Full-state gossip can repair by sending everything; delta gossip must track what each peer has seen or fall back to a snapshot.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make each mutator return a joinable state fragment, not a command. The replica joins that fragment locally, stores it in a retained buffer, and later sends it to peers. The receiver uses the same join operation it would use for a full-state merge.',
        'This keeps the algebra while reducing message size. A G-counter increment at replica A can send only A\'s component. An observed-remove set can send a new add tag or tombstone. The fragment is small, but it remains state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A replica numbers or groups emitted deltas into intervals. For each peer, it records a frontier: the newest interval the peer is known to have, plus any pending gaps. The sender chooses a missing interval, sends it, waits for acknowledgment or evidence of receipt, and retries when needed.',
        'Causal guards handle fragments that assume earlier state. If peer B receives interval d3..d4 but lacks the base from d1..d2, the safe choices are to hold d3..d4, request the gap, or send a snapshot. Garbage collection waits until old deltas are acknowledged, compacted into a snapshot, or no longer needed for any live peer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Convergence follows from the state-based CRDT laws. If every update is eventually represented in a joinable fragment that reaches every live replica, and each receiver merges by join, replicas move toward the same least upper bound. Reordering and duplicates are harmless because join is commutative and idempotent.',
        'The extra condition is delivery through anti-entropy. Delta-state CRDTs are not correct because one packet arrives. They are correct because retained deltas, peer frontiers, causal checks, retries, and snapshots make missing state eventually available.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Bandwidth behaves with recent change mass instead of total object size. If a map has 1,000,000 keys and one key changes, full-state gossip may ship the whole map, while delta gossip ships one cell plus metadata. If 10,000 keys change between syncs, the delta interval grows with those 10,000 changes.',
        'The cost is memory and protocol logic. The system stores delta history, peer acknowledgments, interval metadata, causal bases, and snapshots. Keeping long history helps slow peers catch up cheaply; compacting early saves memory but forces larger snapshots after outages.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Delta-state CRDTs fit replicated counters, maps, feature flags, membership sets, shopping carts, presence systems, edge configuration, and local-first metadata. They are strongest when links are unreliable but full-state messages are too large.',
        'A configuration map is a typical example. Changing feature.checkout to enabled emits a key-level delta, joins it locally, buffers it as interval d42, and sends it to peers that lack it. A new peer gets a snapshot because it has no useful frontier.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when implementations keep the small message and drop the algebra. A JSON patch that is not idempotent is an operation protocol in disguise. It needs operation-protocol guarantees, not CRDT-state guarantees.',
        'It also fails under early garbage collection or corrupted peer frontiers. If the sender believes peer B has d40..d42 when it does not, B may never converge. Metrics must track delta backlog, snapshot fallbacks, frontier lag, and repair failures, not only bytes saved.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Replica A holds a G-counter state {A: 2, B: 1, C: 0}, whose value is 3. A increments once, producing delta {A: 3}. A joins the delta locally, so its state becomes {A: 3, B: 1, C: 0} and value 4.',
        'A sends {A: 3} to B twice because the first acknowledgment is lost. B computes elementwise max with its state. The first delivery raises A\'s component to 3; the second delivery changes nothing. The same delta is compact, retry-safe, and convergent.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Almeida, Shoker, and Baquero on delta-state CRDTs, state-based CRDT semilattices, dotted version vectors, and anti-entropy protocols. The important source question is whether a message is joinable state or a command with delivery requirements.',
        'Inside this curriculum, study CRDTs, Gossip Protocol, Version Vectors, Merkle Tree, Local-First Sync Engine Case Study, Yjs Struct Store and Updates, Automerge Change Graph, CRDT Snapshot Compaction, and Event Sourcing. These topics separate algebraic merge, causal metadata, and durable repair.',
      ],
    },
  ],
};
