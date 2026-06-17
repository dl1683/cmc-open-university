// PostgreSQL streaming replication: WAL sender, WAL receiver, replay lag.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgres-streaming-replication-case-study',
  title: 'PostgreSQL Streaming Replication Case Study',
  category: 'Systems',
  summary: 'Physical replication in PostgreSQL: the primary writes WAL, streams records to standby servers, and standbys replay them with measurable lag.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['wal stream', 'failover lag'], defaultValue: 'wal stream' },
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

function pgGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client write', x: 0.8, y: 3.5, note: 'transaction' },
      { id: 'primary', label: 'primary', x: 2.5, y: 3.5, note: 'accepts writes' },
      { id: 'wal', label: 'WAL', x: 4.1, y: 2.0, note: 'durable log' },
      { id: 'sender', label: 'WAL sender', x: 4.1, y: 5.0, note: 'stream process' },
      { id: 'receiver', label: 'WAL receiver', x: 6.4, y: 5.0, note: 'standby process' },
      { id: 'standby', label: 'standby', x: 8.1, y: 3.5, note: 'replay WAL' },
      { id: 'read', label: 'read replica', x: 9.5, y: 2.0, note: 'may lag' },
    ],
    edges: [
      { id: 'e-client-primary', from: 'client', to: 'primary', weight: 'COMMIT' },
      { id: 'e-primary-wal', from: 'primary', to: 'wal', weight: 'write WAL' },
      { id: 'e-wal-sender', from: 'wal', to: 'sender', weight: 'send records' },
      { id: 'e-sender-receiver', from: 'sender', to: 'receiver', weight: 'stream' },
      { id: 'e-receiver-standby', from: 'receiver', to: 'standby', weight: 'write/replay' },
      { id: 'e-standby-read', from: 'standby', to: 'read', weight: 'serve reads' },
    ],
  }, { title });
}

function* walStream() {
  yield {
    state: pgGraph('The primary writes WAL before replication can stream it'),
    highlight: { active: ['client', 'primary', 'wal', 'e-client-primary', 'e-primary-wal'], compare: ['standby'] },
    explanation: 'PostgreSQL streaming replication is physical replication. The primary writes changes to WAL, and standby servers receive and replay those WAL records.',
    invariant: 'The standby becomes current by replaying the same WAL history in order.',
  };
  yield {
    state: pgGraph('WAL sender and receiver move records continuously'),
    highlight: { active: ['sender', 'receiver', 'e-wal-sender', 'e-sender-receiver'], found: ['standby'] },
    explanation: 'A WAL sender process on the primary streams records to a WAL receiver on the standby. The standby writes the records and replays them into its data files.',
  };
  yield {
    state: labelMatrix(
      'Replication modes',
      [
        { id: 'async', label: 'asynchronous' },
        { id: 'sync', label: 'synchronous' },
        { id: 'quorum', label: 'quorum sync' },
        { id: 'cascade', label: 'cascading' },
      ],
      [{ id: 'commitRule' }, { id: 'tradeoff' }],
      [
        ['primary can commit before standby', 'lower latency, possible data loss'],
        ['wait for standby ack', 'safer, higher latency'],
        ['wait for selected count', 'availability/safety balance'],
        ['standby forwards WAL', 'fanout without primary load'],
      ],
    ),
    highlight: { active: ['async:tradeoff', 'sync:tradeoff'], compare: ['quorum:commitRule'] },
    explanation: 'Replication mode changes the commit contract. Asynchronous replication favors latency; synchronous replication reduces failover data-loss windows at a cost.',
  };
  yield {
    state: labelMatrix(
      'Lag surfaces',
      [
        { id: 'sent', label: 'sent LSN' },
        { id: 'write', label: 'write LSN' },
        { id: 'flush', label: 'flush LSN' },
        { id: 'replay', label: 'replay LSN' },
      ],
      [{ id: 'meaning' }, { id: 'question' }],
      [
        ['primary sent bytes', 'network caught up?'],
        ['standby wrote bytes', 'receiver caught up?'],
        ['standby fsynced bytes', 'durable there?'],
        ['standby applied bytes', 'read replica current?'],
      ],
    ),
    highlight: { found: ['replay:question', 'flush:question'], active: ['sent:meaning'] },
    explanation: 'Replication lag is not one number. Sent, written, flushed, and replayed positions answer different operational questions.',
  };
}

function* failoverLag() {
  yield {
    state: labelMatrix(
      'Failover sequence',
      [
        { id: 'detect', label: 'detect primary failure' },
        { id: 'choose', label: 'choose standby' },
        { id: 'promote', label: 'promote' },
        { id: 'repoint', label: 'repoint clients' },
      ],
      [{ id: 'move' }, { id: 'risk' }],
      [
        ['health checks/timeouts', 'false positives'],
        ['best replay position', 'data loss if async lag'],
        ['standby becomes primary', 'split brain if old primary lives'],
        ['DNS/proxy/config', 'client outage window'],
      ],
    ),
    highlight: { active: ['choose:risk', 'promote:risk'], found: ['repoint:move'] },
    explanation: 'Failover is a system procedure, not just a database command. The hard parts are picking the right standby and preventing two primaries.',
  };
  yield {
    state: pgGraph('A read replica can be stale even while healthy'),
    highlight: { active: ['standby', 'read', 'e-standby-read'], compare: ['primary', 'wal'] },
    explanation: 'Standbys can serve read traffic, but reads observe the standby replay position. A lagging standby may be internally consistent yet behind the primary.',
    invariant: 'Read-your-writes through a replica requires routing or waiting for replay past the write LSN.',
  };
  yield {
    state: labelMatrix(
      'Operational controls',
      [
        { id: 'slot', label: 'replication slot' },
        { id: 'archive', label: 'WAL archive' },
        { id: 'hot', label: 'hot standby feedback' },
        { id: 'monitor', label: 'lag monitoring' },
      ],
      [{ id: 'helps' }, { id: 'failureMode' }],
      [
        ['retain needed WAL', 'disk bloat if standby dead'],
        ['recover missing WAL', 'archive gaps break restore'],
        ['avoid query conflicts', 'vacuum bloat risk'],
        ['alert on LSN/time lag', 'silent staleness'],
      ],
    ),
    highlight: { found: ['slot:failureMode', 'monitor:failureMode'], compare: ['hot:failureMode'] },
    explanation: 'Replication features protect one failure mode and often create another. Slots prevent missing WAL, but an abandoned slot can fill a disk.',
  };
  yield {
    state: labelMatrix(
      'Complete HA case study',
      [
        { id: 'write', label: 'primary writes order' },
        { id: 'stream', label: 'stream WAL' },
        { id: 'read', label: 'read from standby' },
        { id: 'fail', label: 'primary fails' },
      ],
      [{ id: 'mechanism' }, { id: 'lesson' }],
      [
        ['WAL first', 'durability source'],
        ['sender -> receiver', 'replica catches up'],
        ['replay LSN bound', 'staleness must be budgeted'],
        ['promote standby', 'RPO depends on sync choice'],
      ],
    ),
    highlight: { found: ['read:lesson', 'fail:lesson'], active: ['write:mechanism'] },
    explanation: 'The production lesson is to make lag, promotion, slots, and split-brain prevention first-class parts of the design.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'wal stream') yield* walStream();
  else if (view === 'failover lag') yield* failoverLag();
  else throw new InputError('Pick a PostgreSQL streaming-replication view.');
}

export const article = {
  sections: [
    { heading: 'Why this exists', paragraphs: [
      'A database primary is a single point of operational risk. If it fails, reads and writes stop unless another server can continue from the same durable history. PostgreSQL streaming replication exists to keep standby servers close to the primary by shipping WAL records as they are produced.',
      'The key idea is that WAL is not only crash-recovery state. It is also the replication feed. A standby becomes current by replaying the same ordered storage-level history.',
      'This is physical replication, not a logical stream of business events. The standby replays storage changes from the primary WAL. That makes failover and read replicas possible without asking every application table to invent its own synchronization protocol.',
    ] },
    { heading: 'The tempting wrong answer', paragraphs: [
      'The wrong mental model is a file copy of the data directory. A live database changes through ordered WAL records, MVCC state, checkpoints, and replay. Copying files without WAL position discipline cannot tell a standby exactly which changes it has applied.',
      'Another wrong answer is to treat a healthy standby as current. A standby can be up, accepting read traffic, and still behind the primary. Lag is part of the application contract.',
      'A third mistake is to confuse replication with backup. A replica can protect availability, but it can also faithfully replicate a bad migration, dropped table, or corrupted application write. Backups, WAL archives, point-in-time recovery, and replicas solve overlapping but different problems.',
    ] },
    { heading: 'The core idea', paragraphs: [
      'The primary writes WAL for every transaction. WAL sender processes stream records to standby WAL receivers. The standby writes, flushes, and replays those records, then may serve hot-standby reads.',
      'Replication has stages: sent LSN, written LSN, flushed LSN, and replayed LSN. Those positions answer different questions: did the primary send it, did the standby receive it, is it durable there, and can reads observe it?',
      'Asynchronous replication lets the primary commit before a standby confirms receipt, which keeps write latency low but admits a data-loss window. Synchronous replication waits for configured standby acknowledgement, which can reduce that window but adds latency and dependency on replica health. Quorum synchronous replication lets operators balance safety and availability across multiple standbys.',
    ] },
    { heading: 'What the visual is proving', paragraphs: [
      'The WAL-stream view follows the write path from client commit to WAL to sender to receiver to standby replay. Read it as an ordered log pipeline, not a generic data copy.',
      'The failover-lag view shows why high availability is a procedure. The system must detect failure, choose the best replay position, promote one standby, repoint clients, and prevent split brain if the old primary returns.',
      'The lag table is the operational center of the topic. A replica can have received WAL without replaying it. It can have flushed WAL without serving reads from it yet. Those distinctions decide whether failover loses data, whether a read replica is stale, and whether an alert should page someone.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Replication works because WAL is already the database serial history needed for crash recovery. PostgreSQL can reuse that durable ordered log as the stream that lets another server reproduce the same storage state. The standby does not need to understand application intent; it needs to replay the same records in order.',
      'The design also works because position is explicit. Log sequence numbers let the system compare primary and standby progress precisely. Application code can wait for a standby to replay past a known LSN when read-your-writes matters, and operators can measure recovery point objective from lag rather than guess.',
    ] },
    { heading: 'Where it wins', paragraphs: [
      'Streaming replication powers high availability, disaster recovery, read replicas, reporting standbys, blue-green migrations, and backup pipelines. A common design uses a synchronous local standby for low RPO failover and an asynchronous remote standby for regional disaster recovery.',
      'Read replicas can isolate analytics load from the primary, but their staleness must be budgeted. Read-your-writes through a replica requires routing to primary or waiting until replay passes the write LSN.',
      'A common production pattern is a write primary, one or more read standbys, replication slots for critical replicas, WAL archiving for recovery, and a failover manager or operator that promotes one standby. The database pieces are necessary but not sufficient; client routing and old-primary fencing matter just as much.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'Consider an order system with one primary in us-east, a synchronous standby in the same region, and an asynchronous standby in us-west. Normal writes commit after the local standby confirms the WAL position required by the synchronous policy. Reporting queries go to a hot standby, but the application routes read-after-write flows to the primary unless it can wait for replay past the transaction LSN.',
      'During a regional incident, the failover controller compares standby replay positions, promotes the best candidate, fences the old primary through infrastructure controls, and repoints clients through a proxy or service discovery update. The business recovery point is not an abstract promise; it is the difference between the promoted standby replay LSN and the last committed primary LSN the application cares about.',
      'After promotion, the work is not finished. Operators must rebuild replication topology, create or reattach standbys from the new primary, verify archives, and decide what to do with the old primary data directory. A failover that restores writes but leaves the system without a fresh standby has only moved the single point of failure.',
    ] },
    { heading: 'What to measure', paragraphs: [
      'A serious replication dashboard tracks send lag, write lag, flush lag, replay lag, replication slot retained WAL, archive success, standby query conflicts, failover drill duration, and replica read staleness by workload. One lag number is not enough because each lag surface answers a different question.',
      'The application should also record when it routes reads to replicas and when it needs read-your-writes guarantees. Otherwise a database team may see healthy replication while users see stale profiles, missing orders, or dashboards that contradict freshly written data.',
      'Failover drills should be measured like incidents. Record detection time, promotion time, client reconnection time, data-loss estimate, old-primary fencing result, and time to restore a new standby. A replication setup that has never been promoted under practice conditions is an untested assumption, not an availability plan.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Synchronous replication raises commit latency and can reduce availability if standbys are slow or unreachable. Asynchronous replication lowers write latency but can lose recent committed transactions during failover.',
      'Replication slots, WAL archiving, hot-standby feedback, vacuum behavior, and replay lag all interact. A slot can prevent missing WAL, but an abandoned slot can retain WAL until the primary disk fills.',
      'Split brain is the catastrophic failure mode. If the old primary accepts writes after a standby is promoted, the system now has two divergent histories. Replication tooling therefore needs fencing: shut down, isolate, or demote the old primary before clients can write to the new one with confidence.',
      'Write down RPO and RTO before choosing sync or async behavior. Otherwise replication mode is just a default setting wearing the costume of an availability plan.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: PostgreSQL replication configuration at https://www.postgresql.org/docs/current/runtime-config-replication.html, hot standby at https://www.postgresql.org/docs/current/hot-standby.html, and warm standby/log shipping at https://www.postgresql.org/docs/current/warm-standby.html. Study Write-Ahead Log, MVCC Internals & VACUUM, Database Indexing, and PostgreSQL Query Planner Case Study next.',
      'Then study PostgreSQL WAL Checkpoint & Recovery to separate crash restart from replica replay, and PostgreSQL Autovacuum Freeze & Wraparound to see why standby feedback and long reads can affect cleanup pressure on the primary.',
      'Finally, compare this physical model with logical replication. Physical streaming copies storage-level history for a whole database state, while logical replication sends table-level changes that can support selective replication and migrations but has different conflict and schema concerns.',
    ] },
  ],
};
