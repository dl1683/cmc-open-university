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
      heading: 'Why this exists',
      paragraphs: [
        `State-based CRDTs are attractive because they converge through a simple rule: merge states with a join operation that is associative, commutative, and idempotent. If two replicas keep exchanging full states, duplicates and reordering are harmless. The painful part is bandwidth. A one-key change in a large map can force the sender to ship the whole object again.`,
        `Delta-state CRDTs exist to keep the robustness of state-based merge while sending only the state fragment caused by a recent update. The fragment is smaller than the full object, but it is still CRDT state. That detail matters because the receiver can merge it with the same join rule instead of replaying a fragile command.`,
        {type:'callout', text:'Delta-state CRDTs save bandwidth only because every small fragment remains joinable state protected by anti-entropy, peer frontiers, and causal guards.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious approach is full-state gossip. Every so often, each replica sends its entire counter, set, map, or document metadata to peers. This is easy to reason about. If a packet is lost, another full state later repairs it. If a packet is duplicated, merge is idempotent. If packets arrive out of order, the join still moves the receiver upward in the lattice.`,
        `The second obvious approach is operation shipping: send "increment A" or "remove tag x" as an event. That is bandwidth-friendly, but it needs stronger delivery and causal guarantees. If an operation is lost, applied twice, or delivered before its dependencies, convergence can fail unless the system adds exactly the metadata it hoped to avoid.`,
      ],
    },
    {
      heading: 'Naive failure modes',
      paragraphs: [
        `A random JSON diff is not automatically a delta-state CRDT. If applying the diff twice changes the answer, it is not idempotent. If applying it before another required fragment creates an impossible state, it needs a causal guard. If the sender throws it away before slow peers receive it, anti-entropy has no repair material.`,
        `The common mistake is to keep the small message and drop the algebra. Delta-state CRDTs are useful because each message remains joinable state. When a system treats the delta as a fire-and-forget event, it inherits operation-log failure modes without admitting that it is now running an operation protocol.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to make each mutator return two things: the new local state and the compact state fragment that caused the change. The replica joins that fragment locally, stores it in a delta buffer, and later sends it to peers. The receiver joins the fragment just as it would join a full state.`,
        `This puts delta-state CRDTs between full-state CRDTs and operation-based CRDTs. They avoid sending the entire object after every edit, but they also avoid depending on one perfect delivery of each command. Duplicates and retries remain safe because the receiver is still performing a join, not executing an imperative mutation.`,
      ],
    },
    {
      heading: 'How delta mutators work',
      paragraphs: [
        `For a G-counter, an increment at replica A only changes A's component. The delta can contain that component rather than the whole vector. When another replica receives it, elementwise max merges the fragment. Sending the same fragment twice does not double-count, because max is idempotent.`,
        `For an observed-remove set or map, a delta may carry a new add tag, a tombstone for a known tag, or a compact bundle of recent cell changes. The exact structure depends on the CRDT, but the rule is the same: the fragment must live in the same semilattice as the full state, and merge must mean join.`,
      ],
    },
    {
      heading: 'How anti-entropy works',
      paragraphs: [
        `Anti-entropy is the repair loop. Each replica keeps a retained log or buffer of delta fragments, often with sequence numbers, intervals, causal bases, and peer acknowledgments. For each peer, the sender tracks what that peer is believed to know. Then it chooses a missing interval, sends it, waits for evidence, and retries or falls back when the peer is too far behind.`,
        `A delta interval is a practical batching unit. Instead of sending one tiny packet per edit, the sender coalesces adjacent fragments into one joinable state fragment. Instead of sending the full object, it sends only the recent interval the peer lacks. If the interval depends on base state the peer does not have, the sender must fill the gap or send a snapshot.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The mutator graph proves the safe path for one edit: state flows into a mutator, the mutator emits a delta, the delta is joined locally, the same delta is buffered, and later gossip sends it to another replica for the same join operation. The fragment never becomes a one-shot command that would break on duplicate delivery.`,
        `The anti-entropy graph proves that convergence is not a single send. The retained delta log, peer frontiers, causal guard, retry path, and garbage collection step are all part of the algorithm. The bandwidth plot gives the reason for the complexity: deltas track recent change mass, while full-state sync tracks total object size.`,
      ],
    },
    {
      heading: 'Why it converges',
      paragraphs: [
        `The convergence argument relies on the same merge laws as state-based CRDTs. If every update is eventually represented in state fragments that reach every live replica, and every receiver merges by join, then all replicas move toward the same least upper bound. Reordering and duplication do not matter because join is commutative and idempotent.`,
        `The extra condition is causal safety for deltas that assume prior state. Some delta intervals are self-contained; others are meaningful only if the receiver already has a base. A correct anti-entropy protocol checks that base, requests missing intervals, holds the delta until safe, or resets the peer with a snapshot. That guard is what stops small fragments from creating impossible partial states.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Delta-state CRDTs spend memory and implementation complexity to save bandwidth. The system must retain delta history, summarize peer knowledge, manage acknowledgments, detect gaps, compact old fragments, and decide when a snapshot is cheaper than repair. Full-state gossip is larger but much simpler.`,
        `There is also a tuning tradeoff. Keeping long delta history helps slow peers catch up cheaply, but it consumes memory. Compacting aggressively saves memory but forces snapshots after short outages. Larger intervals reduce packet overhead but may include unnecessary changes. Smaller intervals are precise but create more metadata and retry work.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Delta-state CRDTs win in replicated maps, counters, membership sets, feature-flag stores, shopping carts, presence systems, local-first metadata, and edge configuration systems where full-state messages become expensive but the deployment still wants retry-friendly state merge. They are especially useful when peers are intermittently connected or when network links are asymmetric.`,
        `A concrete replicated configuration map shows the pattern. A node changes feature.checkout to enabled. The map emits a key-level delta, joins it locally, stores it as d42, and records that peer B still needs d42. Peer C, which missed d40 through d42, gets an interval. A new peer gets a snapshot. Old deltas are dropped only after the relevant peers have acknowledged them or can recover from a compacted state.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most dangerous failure is early garbage collection. If the sender discards a delta before all relevant peers have received it or before a snapshot can cover it, a slow peer may never converge. A second failure is missing causal guards. Joining a fragment without its base can make a set, map, or tombstone structure disagree with its own invariants.`,
        `Other failures are operational: unbounded delta logs, peer-frontier corruption, treating a disconnected peer as permanently acknowledged, snapshot formats that do not match delta semantics, and metrics that count bytes saved while ignoring repair backlog. Bandwidth reduction is useful only if the repair loop remains correct under loss, delay, duplicates, and restarts.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study CRDTs for the algebraic merge laws, Gossip Protocol for epidemic repair, Version Vectors & Dotted Version Vectors for causal metadata, and Read/Write Quorums for a contrasting replication strategy. Merkle Tree is useful for anti-entropy designs that compare large replicated datasets by hash before sending differences.`,
        `Then study Local-First Sync Engine Case Study, Yjs Struct Store & Updates, Automerge Change Graph & Columnar Storage, CRDT Snapshot Compaction & Garbage Collection, Conflict-Free Replicated JSON, and Event Sourcing. Those topics show neighboring designs for collaborative documents, durable logs, snapshots, and peer repair.`,
      ],
    },
  ],
};
