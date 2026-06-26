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
  const rf = 3;
  const healthy = ['a', 'b'];
  const down = ['c'];
  const quorum = Math.floor(rf / 2) + 1;

  yield {
    state: handoffGraph('One replica is unavailable during a quorum write'),
    highlight: { active: ['client', 'coord', 'a', 'b', 'e-client-coord', 'e-coord-a', 'e-coord-b'], removed: ['c'] },
    explanation: `With replication factor ${rf} and quorum writes (need ${quorum} of ${rf}), the coordinator can succeed after ${healthy.map(n => n.toUpperCase()).join(' and ')} acknowledge even while ${down.map(n => n.toUpperCase()).join(', ')} is unavailable. The write remains available with ${healthy.length} acks, but ${down.length} replica has missed the mutation.`,
    invariant: 'Hinted handoff repairs missed replicas; it is not the same thing as the quorum acknowledgment.',
  };

  const hintFields = ['target node', 'mutation data or pointer', 'timestamp', 'metadata'];

  yield {
    state: handoffGraph('The coordinator stores a durable hint for C'),
    highlight: { active: ['coord', 'hints', 'e-coord-hints'], compare: ['c'], found: ['a', 'b'] },
    explanation: `A hint records enough information to replay the mutation to the intended replica later. It captures ${hintFields.length} pieces: ${hintFields.join(', ')} — everything needed for safe delivery to ${down.map(n => n.toUpperCase()).join(', ')}.`,
  };

  const hintRows = [
    { id: 'target', label: 'target' },
    { id: 'mutation', label: 'mutation' },
    { id: 'time', label: 'timestamp' },
    { id: 'ttl', label: 'expiry' },
  ];
  const hintCols = [
    { id: 'stores', label: 'stores' },
    { id: 'why', label: 'why' },
  ];

  yield {
    state: labelMatrix(
      'Hint record shape',
      hintRows,
      hintCols,
      [
        ['replica C', 'handoff destination'],
        ['row update', 'what C missed'],
        ['write time', 'conflict ordering'],
        ['hint window', 'bound disk growth'],
      ],
    ),
    highlight: { active: ['target:stores', 'mutation:stores'], found: ['ttl:why'] },
    explanation: `A hint is queue state with ${hintRows.length} fields across ${hintCols.length} dimensions (what it stores and why). It must be durable enough to survive coordinator restarts, but bounded enough that a long outage cannot consume the cluster's ${hintCols.map(c => c.label).join('/')} capacity.`,
  };

  const repairMechanisms = ['hinted handoff', 'read repair', 'anti-entropy'];
  const fitRows = [
    { id: 'quorum', label: 'quorum write' },
    { id: 'hint', label: 'hinted handoff' },
    { id: 'read', label: 'read repair' },
    { id: 'anti', label: 'anti-entropy' },
  ];

  yield {
    state: labelMatrix(
      'Where hinted handoff fits',
      fitRows,
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
    explanation: `Hinted handoff is the fast repair path for short outages. It is one of ${repairMechanisms.length} convergence mechanisms (${repairMechanisms.join(', ')}); each covers a different ${fitRows.length > 1 ? 'time horizon and scope' : 'scope'}, and none replaces the others.`,
  };

  const activeNodes = ['client', 'coord', 'hints'];

  yield {
    state: handoffGraph('Availability now, convergence later'),
    highlight: { active: activeNodes, found: ['a', 'b'], removed: ['c'] },
    explanation: `The system accepted the write because ${healthy.length} of ${rf} replicas acknowledged — meeting the quorum of ${quorum}. The hint preserves a plan to heal ${down.map(n => n.toUpperCase()).join(', ')} when it returns. That is the core availability trade: do not block the write, but remember the debt across ${activeNodes.length} active components.`,
  };
}

function* replayAndLimits() {
  const returningNode = 'C';
  const healthyReplicas = ['a', 'b'];
  const replayPipeline = ['c', 'hints', 'replay'];

  yield {
    state: handoffGraph('C returns and hints drain toward it'),
    highlight: { active: ['c', 'hints', 'replay', 'e-hints-replay', 'e-replay-c'], found: healthyReplicas },
    explanation: `When ${returningNode} is reachable again, the coordinator drains its hint queue through a ${replayPipeline.length}-stage pipeline (${replayPipeline.join(' → ')}). Replay must be throttled so recovery traffic does not overload the recovering node while ${healthyReplicas.length} healthy replicas (${healthyReplicas.map(n => n.toUpperCase()).join(', ')}) continue serving.`,
  };

  const queueStates = [
    { id: 'queued', label: 'queued' },
    { id: 'sending', label: 'sending' },
    { id: 'acked', label: 'acked' },
    { id: 'expired', label: 'expired' },
  ];
  const queueDisciplines = ['durable append', 'retry state', 'acknowledgement', 'deletion', 'expiry', 'metrics'];

  yield {
    state: labelMatrix(
      'Replay queue states',
      queueStates,
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
    explanation: `The queue cycles through ${queueStates.length} states (${queueStates.map(s => s.label).join(' → ')}) and needs ${queueDisciplines.length} disciplines: ${queueDisciplines.join(', ')}. Without them, hints become an invisible backlog.`,
  };

  const limitTypes = [
    { id: 'window', label: 'max window' },
    { id: 'disk', label: 'disk budget' },
    { id: 'throttle', label: 'throttle' },
    { id: 'topology', label: 'topology change' },
  ];
  const repairFallbacks = ['hinted handoff', 'read repair', 'anti-entropy'];

  yield {
    state: labelMatrix(
      'Limits and failure modes',
      limitTypes,
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
    explanation: `Hints are deliberately bounded by ${limitTypes.length} limits (${limitTypes.map(l => l.label).join(', ')}). If a node is down beyond the hint window, the system falls back through ${repairFallbacks.length} repair tiers (${repairFallbacks.join(' → ')}), not infinite queue growth.`,
  };

  const expiredComponents = ['hints', 'e-hints-replay'];
  const rf = 3;

  yield {
    state: handoffGraph('Expired hints hand off the problem to repair'),
    highlight: { removed: expiredComponents, active: ['c'], compare: ['replay'], found: healthyReplicas },
    explanation: `When hints expire (${expiredComponents.length} components removed from the graph), ${returningNode} may remain stale for some ranges. With ${rf} replicas total, Cassandra-style repair then compares ${healthyReplicas.length} healthy replicas against ${returningNode} and streams differences deliberately.`,
  };

  const checklistRows = [
    { id: 'write', label: 'write accepted' },
    { id: 'hint', label: 'hint stored' },
    { id: 'recover', label: 'replica returns' },
    { id: 'drain', label: 'queue drains' },
    { id: 'repair', label: 'repair verifies' },
  ];
  const evidencePaths = ['write path', 'replay path', 'repair evidence'];

  yield {
    state: labelMatrix(
      'Complete case study checklist',
      checklistRows,
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
    explanation: `A mature system treats hinted handoff as an observable queue spanning ${checklistRows.length} lifecycle milestones. All ${evidencePaths.length} evidence paths (${evidencePaths.join(', ')}) matter for full convergence.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the write path and replay queue separately. A quorum decision can succeed while one intended replica misses the mutation. The hint records that exact miss for later replay.',
        {type: 'image', src: './assets/gifs/hinted-handoff-replica-queue.gif', alt: 'Animated walkthrough of the hinted handoff replica queue visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Replicated databases want writes to stay available during ordinary failures and replicas to converge afterward. If replica C is down but replicas A and B acknowledge a quorum write, the client can succeed while C misses the update. Hinted handoff preserves that known miss as repair state.',
        {type: 'callout', text: 'Hinted handoff turns a known replica miss into bounded queue state, so availability now does not erase repair intent later.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The strict approach requires every replica to acknowledge every write. That simplifies convergence but makes one down replica reduce availability. The loose approach accepts quorum and relies only on later repair, but throws away exact miss information.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The write path needs an answer now, while repair can happen later. Blocking sacrifices availability, and forgetting the miss creates avoidable stale time. The queue also needs bounds because a node can be down forever.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A hint is repair debt made explicit. It records target replica, mutation or pointer, original timestamp or version metadata, replay state, and expiry. The consistency level decides client success; the hint records later obligation.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of server racks in a data center', caption: 'Hinted handoff is about keeping replicas convergent despite temporary node or rack failure. Source: Wikimedia Commons, Wikimedia Foundation servers.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A coordinator sends a write to the replica set. If A and B acknowledge while C is unavailable, quorum succeeds and the coordinator appends a durable hint for C. When C returns, a replay worker sends the mutation with original metadata and deletes the hint only after acknowledgement.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Animated packet switching diagram with packets moving through a network', caption: 'Replay workers resend missed mutations much like delayed messages moving through a network. Source: Wikimedia Commons, Packet Switching.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is narrow: a durable, unexpired hint that is replayed and acknowledged repairs that recorded miss. It does not prove the whole replica is correct. That is why hinted handoff complements read repair and anti-entropy repair instead of replacing them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Hints consume disk on the holder and replay bandwidth on recovery. If writes arrive at 20,000 per second while C is down for 10 minutes, 12,000,000 hints can accumulate. If replay drains 40,000 per second, clearing takes at least 5 minutes before normal load.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Hinted handoff fits eventually consistent or tunably consistent stores during short node restarts, maintenance, and brief network partitions. A hint backlog is also an operational signal: size, age, replay rate, and drops measure repair debt.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a complete repair strategy for long outages or unobserved divergence. Expired hints, disk corruption, stale topology, and operator mistakes need broader range repair. Hints can only replay what they recorded.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt: 'Hash tree diagram with hashes arranged from leaves to root', caption: 'When hints are missing or expired, anti-entropy structures such as Merkle trees can find divergent replica ranges. Source: Wikimedia Commons, Hash Tree.'},
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use replication factor 3 and quorum writes. A client writes key K through coordinator X to replicas A, B, and C. C is down, but A and B persist and acknowledge, so quorum is satisfied and X returns success.',
        'X stores a hint for C with key K, the mutation, original metadata, and a 3-hour expiry. Ten minutes later C returns, X replays the hint, C acknowledges, and X deletes it. If C returns after 4 hours, the hint may expire and scheduled repair must compare ranges.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the Amazon Dynamo paper for hinted replicas and sloppy quorum, plus Apache Cassandra hinted handoff and repair docs. Study quorums, Dynamo replication, Cassandra repair, Merkle trees, write-ahead logs, queues, vector clocks, and failure detectors next.',
      ],
    },
  ],
};
