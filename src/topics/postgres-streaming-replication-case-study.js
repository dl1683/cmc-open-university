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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the WAL-stream view as a pipeline. Active nodes show the stage currently moving data, compare nodes show a stage that has not caught up, and found nodes show state that is durable or usable. WAL means write-ahead log: the ordered record PostgreSQL writes before it trusts changed data pages.',
        'The safe inference is about order. If the standby has replayed log sequence number 80 and the primary has committed through 100, a read from that standby can be correct internally and still be 20 log units behind. The failover view uses the same rule to show why promotion safety depends on replay position.',
        {type:'callout', text:'Streaming replication works because WAL is already an ordered history that standbys can replay, but every commit mode chooses a different point in the latency and data-loss tradeoff.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A primary database can fail while the application still needs reads and writes. Restoring a 500 GB backup may take tens of minutes before transaction log replay even starts. Streaming replication keeps another server close enough to take over or serve reads with a known staleness bound.',
        'A standby is not a backup. It copies good changes and bad changes because its job is to follow the primary history. Backups protect against operator mistakes and corruption; replicas protect availability and read pressure.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple plan is one database plus periodic backups. If the server dies, restore the newest backup and replay archived WAL until the last available point. That plan is easy to reason about and can be acceptable for small internal systems.',
        'Another simple plan is to send read traffic to the same primary. That avoids stale reads and avoids replication operations. It also means one machine owns every read, every write, and every recovery decision.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Restore time grows with database size and WAL volume. If copying the backup takes 35 minutes and replay takes 8 minutes, the outage is not a database theory problem; it is a 43 minute service outage. Backups also do nothing for read traffic while the primary is healthy.',
        'Remote users hit the same wall through latency. A user in Tokyo reading from a primary in Virginia can pay more than 150 ms before query execution. A nearby replica can reduce that latency, but only if the product accepts or controls replica lag.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The primary already creates an ordered history: WAL. Streaming replication reuses that history instead of inventing a second change protocol. A standby reaches the same physical database state by receiving WAL records and replaying them in order.',
        'The central invariant is prefix replay. A standby that has replayed through LSN X has applied the same WAL prefix as the primary through X. Anything after X is invisible there, so freshness is a measurable position rather than a vague health claim.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The primary writes WAL for a transaction and flushes enough of it for the configured commit rule. A WAL sender process streams records to a WAL receiver on the standby. The standby writes the records locally, flushes them when required, and replays them into data files.',
        'Asynchronous replication lets the primary return commit before the standby confirms receipt. Synchronous replication waits for a configured standby or quorum before reporting commit. The choice moves the system along a direct latency and data-loss tradeoff.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from deterministic replay of a single ordered log. If the standby starts from the same base backup and applies the same WAL records in the same order, it reaches the same physical state for that prefix. The standby does not need to reinterpret SQL statements or resolve write conflicts.',
        'Failover safety follows from the same prefix property. Promoting the most advanced standby minimizes lost WAL in asynchronous mode. In synchronous mode, a commit acknowledged by the required standby is present at the promotion candidate, provided the failover system fences the old primary.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Synchronous replication adds network and standby flush latency to commits. If local commit costs 2 ms and the synchronous standby adds 4 ms, every write transaction now pays about 6 ms before the client sees success. Cross-region synchronous standby latency can make that cost unacceptable.',
        'Asynchronous replication keeps write latency low but turns lag into possible data loss. If the primary generates 20 MB/s of WAL and a standby is 10 seconds behind, about 200 MB of recent history is not present there. Replication slots reduce missing-WAL risk but can fill the primary disk if a dead standby never advances.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PostgreSQL streaming replication is used for high availability, read replicas, rolling maintenance, and physical disaster recovery. Read replicas work best for queries that tolerate bounded staleness, such as dashboards, search pages, and reports that do not promise read-your-writes.',
        'The same idea appears in many systems under different logs. MySQL ships binlog events to replicas, Redis uses leader-follower replication for availability, and MongoDB replica sets elect a new primary from nodes that have followed the oplog.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Replication does not scale writes in single-leader mode because every write still enters one primary. It also does not protect against a bad migration, a dropped table, or corrupted application logic. The standby follows the same damage unless recovery uses backups or point-in-time restore.',
        'Replica reads can violate user expectations. A user creates an account, the write commits on the primary, and the next page reads from a replica that has not replayed that LSN. Fixes require primary reads after writes, LSN waiting, or product rules that allow stale reads.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider one primary P, synchronous standby S1 in the same data center, and asynchronous standby S2 in another region. A client inserts order 42, P writes WAL through LSN 1000, and S1 confirms flush at LSN 1000 after 3 ms. P returns commit after local flush plus that acknowledgment.',
        'S2 is 400 ms away and trails by 8 MB during a burst. If P crashes, promoting S1 keeps order 42 because the commit rule required S1 to flush it. If S1 had been asynchronous and only replayed through LSN 940, any committed WAL from 941 to 1000 could be missing after promotion.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL streaming replication and standby documentation at https://www.postgresql.org/docs/current/warm-standby.html, replication settings at https://www.postgresql.org/docs/current/runtime-config-replication.html, and replication monitoring views at https://www.postgresql.org/docs/current/monitoring-stats.html.',
        'Study Write-Ahead Log first because replication streams that history. Then study PostgreSQL WAL Checkpoint and Recovery, Raft leader election for failover control, CAP theorem for partition tradeoffs, and Change Data Capture for logical event streaming.',
      ],
    },
  ],
};