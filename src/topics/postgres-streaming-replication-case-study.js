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
    { heading: 'What it is', paragraphs: [
      'PostgreSQL streaming replication copies WAL records from a primary server to standby servers. It is physical replication: the standby replays the same log of storage-level changes to keep a database cluster copy current.',
      'This case study connects Write-Ahead Log, Database Indexing, MVCC Internals & VACUUM, PostgreSQL Query Planner Case Study, and failover patterns. WAL is not only crash recovery; it is also the replication feed.',
      'Streaming replication is used for high availability, disaster recovery, read scaling, maintenance, and migration. The key operational variable is lag: how far the standby is behind at each stage.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The primary writes WAL for every transaction. WAL sender processes stream records to standby WAL receivers. The standby writes, flushes, and replays those records, then can serve hot-standby reads if configured.',
      'Asynchronous replication lets the primary commit before a standby confirms. Synchronous replication can wait for one or more standby acknowledgments. Cascading replication lets a standby forward WAL to other standbys.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Synchronous replication raises commit latency and can reduce availability if standbys are slow or unreachable. Asynchronous replication lowers write latency but can lose recent committed transactions during failover.',
      'Replication slots, WAL archiving, hot-standby feedback, vacuum behavior, and replay lag all interact. A slot can save a lagging standby from missing WAL, but it can also retain WAL until the primary disk fills.',
      'Read replicas also change application semantics. A request that writes on the primary and immediately reads from a standby may not see its own write unless the application waits for replay past the commit LSN or routes that read to the primary.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Streaming replication powers read replicas, failover clusters, reporting standbys, blue-green migrations, backup pipelines, and geographically separate disaster-recovery copies.',
      'A complete case study is a primary database with one synchronous local standby and one asynchronous remote standby. The local standby protects RPO for failover; the remote standby protects regional disaster recovery with accepted lag.',
      'Another case is analytics isolation. A standby can run expensive reports without loading the primary, but long queries on the standby can conflict with WAL replay or increase bloat if feedback delays cleanup.',
    ] },
    { heading: 'Pitfalls and misconceptions', paragraphs: [
      'A healthy standby can still be stale. A promoted standby can cause split brain if the old primary continues accepting writes. Read scaling through replicas needs consistency-aware routing for read-your-writes behavior.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: PostgreSQL replication configuration at https://www.postgresql.org/docs/current/runtime-config-replication.html, hot standby at https://www.postgresql.org/docs/current/hot-standby.html, and warm standby/log shipping at https://www.postgresql.org/docs/current/warm-standby.html. Study Write-Ahead Log, MVCC Internals & VACUUM, Database Indexing, and PostgreSQL Query Planner Case Study next.',
      'Then study PostgreSQL WAL Checkpoint & Recovery to separate crash restart from replica replay, and PostgreSQL Autovacuum Freeze & Wraparound to see why standby feedback and long reads can affect cleanup pressure on the primary.',
    ] },
  ],
};
