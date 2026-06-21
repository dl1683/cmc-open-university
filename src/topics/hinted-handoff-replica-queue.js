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
      heading: 'The problem',
      paragraphs: [
        'A replicated database wants two properties that pull against each other. It wants writes to remain available during ordinary machine failures, and it wants replicas to converge after those failures end. With replication factor 3, a coordinator may contact replicas A, B, and C. If C is temporarily down but A and B accept the write, a quorum write can succeed for the client while C misses the mutation.',
        {type: 'callout', text: 'Hinted handoff turns a known replica miss into bounded queue state, so availability now does not erase repair intent later.'},
        'That miss is not mysterious. The coordinator knows the target replica, the mutation, and the time of the write. The question is whether the system should preserve that knowledge. Hinted handoff says yes: turn the known miss into durable queue state, replay it when the target returns, and fall back to heavier repair if the outage lasts too long.',
      ],
    },
    {
      heading: 'The naive approaches',
      paragraphs: [
        'The strict approach is to require every replica to acknowledge every write. It gives a simple story, but it makes one unavailable replica reduce write availability for the whole replica set. In a large cluster, brief restarts, network hiccups, and rolling maintenance would become user-visible failures far more often than the application wants.',
        'The loose approach is to accept the write at quorum and trust anti-entropy repair to find stale replicas later. That keeps the write path open, but it throws away precise information. Repair now has to compare ranges or Merkle trees to rediscover a mutation the coordinator already knew C missed at the time of the write.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that availability decisions and convergence work happen on different clocks. The write path needs an answer now. Repair can run later. If the system blocks the write until every replica is healthy, it sacrifices availability. If it accepts the write without remembering the miss, it creates avoidable repair cost and a longer stale window.',
        'The system also needs a bound. A node can be down for minutes, days, or forever. Infinite hint retention would turn a temporary repair optimization into an unbounded disk liability. Hinted handoff is useful only if it is treated as a real queue with durability, retry, acknowledgement, expiry, throttling, and metrics.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A hint is repair debt represented as a durable record. It usually contains the intended target replica, the mutation or a pointer to it, timestamp or version metadata, replay state, and an expiry time. The hint does not make the original write successful. The configured consistency level decides success. The hint records a later obligation to bring the missed replica closer to the acknowledged state.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of server racks in a data center', caption: 'Hinted handoff is about keeping replicas convergent despite temporary node or rack failure. Source: Wikimedia Commons, Wikimedia Foundation servers.'},
        'This is a data-structure idea as much as a distributed-systems idea. The coordinator maintains a per-target appendable queue. Items move from queued to sending to acknowledged and deleted, or from queued to expired when the window closes. The queue is valuable because it preserves exact repair intent while the failure is still narrow and recent.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A client sends a write to a coordinator. The coordinator chooses the replica set for the key and sends the mutation to those replicas. Suppose the consistency level is quorum and replicas A and B acknowledge, while intended replica C is unavailable. The coordinator can return success because the write met the client-visible acknowledgement rule, then append a durable hint for C.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Animated packet switching diagram with packets moving through a network', caption: 'Replay workers resend missed mutations much like delayed messages moving through a network. Source: Wikimedia Commons, Packet Switching.'},
        'The hint must survive coordinator restart, because a memory-only hint would disappear exactly when recovery matters. It also needs enough metadata for safe replay. In a last-write-wins store, timestamps matter. In a versioned or conflict-aware store, vector clocks, logical time, or storage-engine-specific metadata may matter. The replay path should behave like delivering the missed write late, not like inventing a new write with a new timestamp.',
        'When C becomes reachable, the coordinator drains the hint queue for C. Replay is normally throttled so that a recovering node is not buried under every missed mutation at once. Each item is deleted only after the target acknowledges it. If delivery fails, the item remains queued until another retry or until the configured hint window expires.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Hinted handoff works because many replica failures are short and localized. A process restarts, a node is rebooted, a rack link flaps, or maintenance briefly removes a replica. In those cases, the system already knows the exact mutations that missed the target. Replaying a queue is cheaper and more precise than scanning whole ranges to find differences.',
        'The invariant is modest: if the hint is durably stored, not expired, and successfully acknowledged by the target, then the target has received the mutation it missed. This does not prove the whole replica is correct. It only resolves the known miss represented by that hint. That modesty is the reason hinted handoff can coexist with read repair and anti-entropy repair instead of replacing them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a Cassandra-like cluster with replication factor 3 and a quorum write. The client writes row K through coordinator X. Replicas A and B are healthy. Replica C is down. A and B persist the mutation and acknowledge. X has enough acknowledgements to satisfy quorum, so the client sees success. X then appends a hint whose target is C, whose payload is the missed mutation for K, and whose expiry is inside the configured hint window.',
        'Ten minutes later, C returns. X or another node responsible for the hint stream sees C as reachable and starts replaying hints. It sends the mutation for K to C with the original write metadata. C applies it according to the storage engine conflict rules and acknowledges. Only then does the hint leave the durable queue. If C returns after the hint window has passed, the hint may be discarded, and the cluster relies on repair to compare the relevant token ranges.',
      ],
    },
    {
      heading: 'Animation guide',
      paragraphs: [
        'The write-path view separates the quorum decision from the repair queue. A and B are enough for the write to succeed at quorum, while C remains missing the mutation. The hint node is the important state transition: the system has converted a temporary absence into an explicit future replay item.',
        'The replay and limits view shows that the queue has lifecycle states. Queued means the target is not ready. Sending means the target is reachable and replay is in progress. Acknowledged means deletion is safe. Expired means the optimization gave up and the problem moves to scheduled repair. That transition is not a bug; it is the bound that keeps hinted handoff from becoming infinite storage.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Hints consume disk on the nodes that store them. That disk use is usually acceptable for short outages, but it can become dangerous if many targets are unavailable or if a high-write workload keeps generating hints faster than they can drain. This is why real systems define maximum hint windows, maximum file sizes, and backpressure or drop behavior.',
        'Replay consumes network, CPU, and write bandwidth on a node that may already be recovering. If every coordinator replays at full speed the moment C returns, the repair mechanism can become the next outage. Throttling, per-target scheduling, and observability are not optional details; they are part of the correctness story because overload can prevent convergence.',
        'Hints also interact with topology. If token ownership changes, if a node is decommissioned, or if replacement hardware takes over an identity, the system must know whether old hints still have a valid target. A hint should respect current cluster membership and storage semantics. It should not smuggle stale placement assumptions into a changed topology.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Hinted handoff wins for short, temporary outages in eventually consistent or tunably consistent replicated stores. It is especially good for node restarts, brief network partitions, short maintenance windows, and cases where the consistency level can still be satisfied without the missing replica.',
        'It also wins as an operational signal. A hint backlog is a concrete measure of repair debt. Operators can inspect backlog size, age, replay rate, dropped hints, and per-target concentration. Those metrics answer better questions than a generic warning that replicas may diverge.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Hinted handoff fails as a complete repair strategy for long outages. When hints expire, the system no longer has a complete precise queue of missed mutations. It must compare replica state by range, which is the job of anti-entropy repair. This is why a healthy system still schedules repair even when hinted handoff is enabled.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Hash_Tree.svg', alt: 'Hash tree diagram with hashes arranged from leaves to root', caption: 'When hints are missing or expired, anti-entropy structures such as Merkle trees can find divergent replica ranges. Source: Wikimedia Commons, Hash Tree.'},
        'It also fails when the miss is not observed on the write path. Disk corruption, lost data files, rare read paths, operator mistakes, and bugs can all create divergence without producing a neat hint. Hinted handoff can only replay what it recorded. It cannot prove that the rest of the replica is correct.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'One failure mode is unbounded queue growth. A target stays down, coordinators keep accepting writes, and hint files consume disk. Good systems cap the window and surface the risk before disk pressure becomes a second failure. Another failure mode is replay storm: the target returns and gets overloaded by a flood of old writes.',
        'A subtler failure mode is false confidence. Teams may see hints draining and assume the cluster is fully repaired. That is not guaranteed. Hints resolve the recorded misses that survived until replay. They do not validate all token ranges, all historical data, or all replicas that were affected by earlier failures. Scheduled repair remains the proof mechanism for broader convergence.',
        'A third failure mode is bad deletion discipline. If a hint is deleted before the target durably applies it, the missed mutation can be lost. If acknowledged hints are never deleted, the queue leaks storage and may replay duplicates. Replay should be idempotent or conflict-safe, but idempotence is a safety net, not an excuse for sloppy queue state.',
      ],
    },
    {
      heading: 'Design checklist',
      paragraphs: [
        'A mature hinted handoff implementation answers concrete questions. Where are hints stored, and are they durable across coordinator restart? What metadata is needed to replay without changing conflict ordering? What is the maximum hint age? How are hints grouped by target? How is replay throttled? What happens when topology changes before replay finishes?',
        'It also exposes evidence. Operators should be able to see current hint count, oldest hint age, replay throughput, failed replay attempts, expired hint count, and per-target backlogs. Without those numbers, hinted handoff becomes invisible repair debt. The mechanism is simple, but invisible queues are dangerous in distributed systems.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Apache Cassandra hinted handoff docs at https://cassandra.apache.org/doc/4.0/cassandra/operating/hints.html, Cassandra repair docs at https://cassandra.apache.org/doc/4.0/cassandra/operating/repair.html, and the Dynamo paper at https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf.',
        'Study Read/Write Quorums for the acknowledgement rule, Amazon Dynamo Case Study for hinted replicas and sloppy quorum, Cassandra Repair Case Study for the range-level fallback, Write-Ahead Log for durable append discipline, Message Queues for replay semantics, and SWIM Failure Detector for the liveness signal that starts replay.',
      ],
    },
  ],
};
