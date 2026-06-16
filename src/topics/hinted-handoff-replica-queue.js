// Hinted handoff: fast-path repair state for temporarily unavailable replicas.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hinted-handoff-replica-queue',
  title: 'Hinted Handoff Replica Queue',
  category: 'Systems',
  summary: 'When a replica is down, store a durable hint for later replay: availability now, bounded repair later, anti-entropy if the outage lasts too long.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['write path', 'replay and limits'], defaultValue: 'write path' },
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

function handoffGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'cli', x: 0.4, y: 4.0, note: 'write' },
      { id: 'coord', label: 'coord', x: 2.8, y: 4.0, note: 'CL=QUORUM' },
      { id: 'a', label: 'A', x: 5.0, y: 2.0, note: 'replica' },
      { id: 'b', label: 'B', x: 5.0, y: 4.0, note: 'replica' },
      { id: 'c', label: 'C', x: 5.0, y: 6.0, note: 'down' },
      { id: 'hints', label: 'hints', x: 7.2, y: 4.0, note: 'durable' },
      { id: 'replay', label: 'replay', x: 9.2, y: 4.0, note: 'to C' },
    ],
    edges: [
      { id: 'e-client-coord', from: 'client', to: 'coord', weight: '' },
      { id: 'e-coord-a', from: 'coord', to: 'a', weight: '' },
      { id: 'e-coord-b', from: 'coord', to: 'b', weight: '' },
      { id: 'e-coord-c', from: 'coord', to: 'c', weight: '' },
      { id: 'e-coord-hints', from: 'coord', to: 'hints', weight: '' },
      { id: 'e-hints-replay', from: 'hints', to: 'replay', weight: '' },
      { id: 'e-replay-c', from: 'replay', to: 'c', weight: '' },
    ],
  }, { title });
}

function* writePath() {
  yield {
    state: handoffGraph('One replica is unavailable during a quorum write'),
    highlight: { active: ['client', 'coord', 'a', 'b', 'e-client-coord', 'e-coord-a', 'e-coord-b'], removed: ['c'] },
    explanation: 'With replication factor 3 and quorum writes, the coordinator can succeed after A and B acknowledge even while C is unavailable. The write remains available, but C has missed the mutation.',
    invariant: 'Hinted handoff repairs missed replicas; it is not the same thing as the quorum acknowledgment.',
  };

  yield {
    state: handoffGraph('The coordinator stores a durable hint for C'),
    highlight: { active: ['coord', 'hints', 'e-coord-hints'], compare: ['c'], found: ['a', 'b'] },
    explanation: 'A hint records enough information to replay the mutation to the intended replica later: target node, mutation data or pointer, timestamp, and metadata needed for safe delivery.',
  };

  yield {
    state: labelMatrix(
      'Hint record shape',
      [
        { id: 'target', label: 'target' },
        { id: 'mutation', label: 'mutation' },
        { id: 'time', label: 'timestamp' },
        { id: 'ttl', label: 'expiry' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['replica C', 'handoff destination'],
        ['row update', 'what C missed'],
        ['write time', 'conflict ordering'],
        ['hint window', 'bound disk growth'],
      ],
    ),
    highlight: { active: ['target:stores', 'mutation:stores'], found: ['ttl:why'] },
    explanation: 'A hint is queue state, not a mystical consistency guarantee. It must be durable enough to survive coordinator restarts, but bounded enough that a long outage cannot consume the cluster.',
  };

  yield {
    state: labelMatrix(
      'Where hinted handoff fits',
      [
        { id: 'quorum', label: 'quorum write' },
        { id: 'hint', label: 'hinted handoff' },
        { id: 'read', label: 'read repair' },
        { id: 'anti', label: 'anti-entropy' },
      ],
      [
        { id: 'time', label: 'when' },
        { id: 'scope', label: 'scope' },
      ],
      [
        ['write path', 'required acks'],
        ['after write miss', 'target replica'],
        ['read path', 'touched replicas'],
        ['scheduled', 'token ranges'],
      ],
    ),
    highlight: { active: ['hint:time', 'hint:scope'], compare: ['anti:scope'] },
    explanation: 'Hinted handoff is the fast repair path for short outages. It complements read repair and Merkle-tree anti-entropy; it does not replace them.',
  };

  yield {
    state: handoffGraph('Availability now, convergence later'),
    highlight: { active: ['client', 'coord', 'hints'], found: ['a', 'b'], removed: ['c'] },
    explanation: 'The system accepted the write because enough replicas acknowledged. The hint preserves a plan to heal C when it returns. That is the core availability trade: do not block the write, but remember the debt.',
  };
}

function* replayAndLimits() {
  yield {
    state: handoffGraph('C returns and hints drain toward it'),
    highlight: { active: ['c', 'hints', 'replay', 'e-hints-replay', 'e-replay-c'], found: ['a', 'b'] },
    explanation: 'When C is reachable again, the coordinator drains its hint queue and sends missed mutations. Replay must be throttled so recovery traffic does not overload the recovering node.',
  };

  yield {
    state: labelMatrix(
      'Replay queue states',
      [
        { id: 'queued', label: 'queued' },
        { id: 'sending', label: 'sending' },
        { id: 'acked', label: 'acked' },
        { id: 'expired', label: 'expired' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'action', label: 'action' },
      ],
      [
        ['waiting for target', 'keep durable'],
        ['target reachable', 'stream with throttle'],
        ['target applied', 'delete hint'],
        ['too old', 'require repair'],
      ],
    ),
    highlight: { active: ['sending:action', 'acked:action'], found: ['expired:action'] },
    explanation: 'The queue needs ordinary data-structure discipline: durable append, retry state, acknowledgement, deletion, expiry, and metrics. Otherwise hints become an invisible backlog.',
  };

  yield {
    state: labelMatrix(
      'Limits and failure modes',
      [
        { id: 'window', label: 'max window' },
        { id: 'disk', label: 'disk budget' },
        { id: 'throttle', label: 'throttle' },
        { id: 'topology', label: 'topology change' },
      ],
      [
        { id: 'protects', label: 'protects' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['unbounded age', 'missed old writes'],
        ['coordinator disk', 'hint loss or pressure'],
        ['recovering node', 'slow catch-up'],
        ['wrong target', 'stale ownership'],
      ],
    ),
    highlight: { active: ['window:risk', 'disk:risk'], found: ['throttle:protects'] },
    explanation: 'Hints are deliberately bounded. If a node is down beyond the hint window, the system needs anti-entropy repair, not infinite queue growth.',
  };

  yield {
    state: handoffGraph('Expired hints hand off the problem to repair'),
    highlight: { removed: ['hints', 'e-hints-replay'], active: ['c'], compare: ['replay'], found: ['a', 'b'] },
    explanation: 'When hints expire or cannot be replayed, C may remain stale for some ranges. Cassandra-style repair then compares replicas and streams differences deliberately.',
  };

  yield {
    state: labelMatrix(
      'Complete case study checklist',
      [
        { id: 'write', label: 'write accepted' },
        { id: 'hint', label: 'hint stored' },
        { id: 'recover', label: 'replica returns' },
        { id: 'drain', label: 'queue drains' },
        { id: 'repair', label: 'repair verifies' },
      ],
      [
        { id: 'evidence', label: 'evidence' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['W acks', 'availability goal met'],
        ['durable hint file', 'record repair debt'],
        ['membership alive', 'start replay'],
        ['hints acked', 'fast convergence'],
        ['range clean', 'do not trust hope'],
      ],
    ),
    highlight: { active: ['hint:lesson', 'drain:evidence'], found: ['repair:lesson'] },
    explanation: 'A mature system treats hinted handoff as an observable queue. The write path, replay path, and later repair evidence all matter.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'write path') yield* writePath();
  else if (view === 'replay and limits') yield* replayAndLimits();
  else throw new InputError('Pick a hinted handoff view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Hinted handoff is a fast repair mechanism for replicated stores. When a replica that should receive a write is temporarily unavailable, a live node stores a hint so the missed write can be replayed later. The system can keep accepting writes while recording repair debt.',
        'In Cassandra, the coordinator stores hints locally for unavailable replicas and later applies them when those replicas return. In Dynamo-style sloppy quorum, a fallback node may temporarily hold a hinted replica. The common idea is the same: availability now, bounded catch-up later.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client writes through a coordinator. The coordinator sends the mutation to the replica set. If enough replicas acknowledge to satisfy the consistency level but one intended replica is down, the coordinator appends a durable hint for that target. When the target becomes reachable, the hint queue drains and the mutation is replayed.',
        'The hint needs metadata: target replica, mutation, timestamp or ordering information, expiry, and retry state. That makes hinted handoff a queue and log problem, not just a replication slogan.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Hints consume disk and replay bandwidth. A recovering node can be overloaded if every coordinator dumps hints at full speed. Operators therefore need hint windows, throttles, metrics, and a plan for expired hints.',
        'Hinted handoff is not a full correctness proof. It is best for short outages. If a node is unavailable for too long, if hints expire, or if topology changes make hints unsafe, anti-entropy repair must compare replicas and stream missing data.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Cassandra-like cluster has replication factor 3. Replica C pauses during a write, while A and B acknowledge. The coordinator returns success at quorum and stores a hint for C. C later returns; the coordinator detects it through membership state, drains hints with throttling, and deletes each hint only after C acknowledges.',
        'If C was down beyond the hint window, the hint may expire. The cluster then needs repair to compare token ranges and synchronize stale data. The case study is deliberately humble: a hint is a short-term catch-up queue, not a replacement for repair.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Cassandra hinted handoff docs: https://cassandra.apache.org/doc/4.0/cassandra/operating/hints.html. Cassandra repair docs: https://cassandra.apache.org/doc/4.0/cassandra/operating/repair.html. Dynamo paper: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf. Study Read/Write Quorums, Amazon Dynamo Case Study, Cassandra Repair Case Study, Write-Ahead Log, Message Queues, and SWIM Failure Detector next.',
      ],
    },
  ],
};
