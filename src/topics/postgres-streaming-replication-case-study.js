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
        'The WAL-stream view shows the write path as a pipeline: client commit, primary WAL write, WAL sender, WAL receiver, standby replay, and read replica. Active highlights mark the current stage of WAL propagation. Found highlights mark stages where data is durable or committed.',
        'The replication-modes matrix compares asynchronous, synchronous, quorum, and cascading replication. Each row is one commit contract between the primary and its standbys. The lag-surfaces matrix breaks replication position into four distinct measurements: sent, written, flushed, and replayed LSN.',
        'The failover-lag view traces what happens when the primary dies. Each row is one step in the promotion sequence. Risk columns name the failure mode at each step. Read the whole sequence top to bottom to see why failover is a procedure, not a toggle.',
        {type:'callout', text:'Streaming replication works because WAL is already an ordered history that standbys can replay, but every commit mode chooses a different point in the latency and data-loss tradeoff.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A single database server is a single point of failure. If it dies, every read and write stops until someone restores from backup and replays transaction logs. Even if backups are recent, that recovery window can be minutes to hours, depending on data volume.',
        'Replication solves three problems at once. First, availability: if the primary fails, a standby that has been tracking its WAL can take over in seconds. Second, read scaling: standbys can serve read queries, spreading load that would otherwise saturate one server. Third, geographic distribution: a standby in another region can serve local reads with lower latency than a cross-continent round trip.',
        'Database replication is not backup. A replica faithfully copies the primary state, including bad migrations and dropped tables. Backups protect against human error and corruption. Replicas protect against hardware failure and read bottlenecks. Production systems need both.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Run one database server. Take periodic backups. If the server dies, restore the latest backup and replay any archived transaction logs to bring the database forward to the point of failure.',
        'This works. It protects data. For many applications it is sufficient. The approach is simple, well understood, and requires no coordination between multiple live servers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A single server is a single point of failure for availability. When it goes down, the application goes down. Backup restore takes time proportional to data size: a 500 GB database can take 30 minutes just to copy back, plus WAL replay. During that window, no reads, no writes, no service.',
        'Backups also cannot help with read scaling. If one server handles 10,000 queries per second and the application needs 30,000, adding more backups changes nothing. The read load hits one machine.',
        'Geographic latency is the third wall. Users in Tokyo querying a server in Virginia pay 150+ ms per round trip. No amount of query optimization fixes the speed of light.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Single-leader replication is the most common model. One server (the primary or leader) accepts all writes. It ships its write-ahead log to one or more followers (standbys, replicas), which replay the log to maintain a copy of the data. PostgreSQL uses streaming replication: a WAL sender process on the primary streams log records over a TCP connection to a WAL receiver on each standby. MySQL uses binary log (binlog) replication: the primary writes changes to a binlog, and replicas pull and replay binlog events. MongoDB replica sets follow the same pattern, with the primary streaming its oplog to secondaries.',
        'Synchronous replication means the primary waits for at least one standby to confirm it received (or flushed) the WAL before telling the client the transaction committed. This guarantees zero data loss on failover but adds one network round trip to every commit. PostgreSQL supports synchronous_standby_names to require confirmation from specific standbys or a quorum.',
        'Asynchronous replication means the primary commits locally and streams WAL without waiting. Commits are faster, but if the primary dies before the standby receives the latest WAL, those transactions are lost. The gap between primary and standby is replication lag.',
        'Replication lag has direct consequences for application correctness. Read-your-writes consistency breaks: a user writes to the primary, then reads from a lagging replica and sees stale data. Monotonic reads break: two consecutive reads from different replicas can go backward in time if one replica is further behind than the other. Applications that route reads to replicas must account for this.',
        'Multi-leader replication allows writes at more than one node. CockroachDB ranges, Galera Cluster for MySQL, and PlanetScale use variants of this approach. The advantage is write availability when leaders are in different regions. The cost is conflict resolution: two leaders can accept conflicting writes to the same row, and the system must detect and resolve them. Galera uses certification-based conflict detection; CockroachDB uses serializable isolation with timestamp ordering.',
        'Leaderless replication, used by Amazon DynamoDB and Apache Cassandra, sends writes to multiple nodes simultaneously and reads from multiple nodes. Consistency comes from quorum arithmetic: if W nodes confirm a write and R nodes are read, then W + R > N (total nodes) guarantees at least one read hits a node with the latest value. The tradeoff is that conflict resolution falls to the application via mechanisms like last-writer-wins or vector clocks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Single-leader replication works because WAL already serializes all changes. The standby replays the same ordered history and reaches the same state. No coordination protocol is needed beyond shipping the log. The correctness argument is simple: same input sequence, deterministic replay, same output state.',
        'Quorum-based systems (both multi-leader and leaderless) work because of overlap arithmetic. If a write reaches W nodes and a read contacts R nodes, and W + R > N, at least one node in the read set has the latest write. This is the same majority-overlap argument that powers Raft and Paxos. The quorum size controls the tradeoff: larger W means slower writes but fresher reads; larger R means slower reads but cheaper writes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Synchronous replication adds one network round trip per commit. For an in-region standby this might be 1-2 ms. For a cross-region standby, 50-150 ms. That latency directly hits every write transaction.',
        'Asynchronous replication adds no write latency but creates a lag window. During normal operation, lag is typically under a second. Under load spikes, long-running queries on the standby, or network congestion, lag can grow to minutes. The lag window is the maximum data loss on failover (the recovery point objective).',
        'Multi-leader conflict resolution is the hardest cost. Last-writer-wins is simple but silently drops writes. Application-level merge functions are correct but complex to implement and test. Conflict-free replicated data types (CRDTs) solve specific data shapes but do not generalize to arbitrary SQL.',
        'Split brain is the catastrophic failure. If the old primary comes back after a standby has been promoted, the system has two writers with divergent histories. Fencing the old primary (shutting it down or blocking its network) is not optional. PostgreSQL tooling like Patroni, pg_auto_failover, and repmgr all include fencing steps for this reason.',
        'Bandwidth scales with write throughput. Every byte written to WAL must be shipped to every synchronous standby. A primary doing 100 MB/s of WAL generation needs 100 MB/s of network to each replica, plus disk I/O on the standby side for writing and replaying.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PostgreSQL offers both physical streaming replication (the standby replays WAL byte-for-byte) and logical replication (the standby receives decoded row changes). Streaming replication is the standard for high availability and read replicas. Logical replication supports selective table replication and cross-version upgrades.',
        'MySQL binlog replication has powered read scaling at scale for decades. GitHub, Shopify, and most large MySQL deployments use a primary with multiple read replicas behind a query router like ProxySQL or Vitess.',
        'MongoDB replica sets elect a new primary automatically when the current one fails. Reads can be routed to secondaries with configurable read preferences, trading freshness for load distribution.',
        'Redis uses leader-follower replication for read scaling and as the foundation for Redis Sentinel (automated failover) and Redis Cluster (sharded replication). Replication is asynchronous by default; WAIT can force synchronous acknowledgement for specific writes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cross-region synchronous replication makes every commit pay intercontinental latency. A write that takes 2 ms locally takes 150+ ms when the primary must wait for a replica in another continent. Most applications cannot tolerate this for every transaction.',
        'Conflict resolution in multi-leader setups is genuinely hard. Two users edit the same document row at two leaders simultaneously. Last-writer-wins picks one and discards the other with no notification. Custom merge logic is correct but difficult to test exhaustively. Many teams choose single-leader replication specifically to avoid this problem.',
        'Replication lag means replicas serve stale data. A user creates an account on the primary, then is routed to a replica for the next page load and sees "account not found." Fixing this requires either routing reads to the primary after writes, or waiting for the replica to catch up past the write LSN before serving the read. Both add complexity.',
        'Replication does not help with write scaling. Every write still goes through one leader (in single-leader mode) or must be conflict-resolved (in multi-leader mode). Write-heavy workloads need sharding, not more replicas.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A 3-node PostgreSQL cluster: one primary (P), one synchronous standby (S1, same data center), one asynchronous standby (S2, remote region). synchronous_standby_names = \'S1\'.',
        'A client commits INSERT INTO orders VALUES (42, ...) on P. PostgreSQL writes the WAL record to P\'s local disk. Before returning "COMMIT" to the client, the WAL sender ships the record to S1. S1\'s WAL receiver writes and flushes the record, then acknowledges. P now tells the client the transaction committed. Meanwhile, S2 receives the same WAL record asynchronously, with no effect on commit timing.',
        'P crashes. The failover controller (Patroni, pg_auto_failover, or an operator) detects the failure. S1 has every committed WAL record because it was the synchronous standby. S1 is promoted to primary. S2 re-attaches to S1 as the new primary and catches up from its last received LSN. Clients are rerouted to S1 via DNS update or connection proxy. Order 42 is safe. Zero data loss.',
        'If instead S1 had been asynchronous, it might be a few transactions behind P at the moment of crash. Those in-flight transactions would be lost. The recovery point is the gap between P\'s last committed LSN and S1\'s last received LSN.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'PostgreSQL replication documentation: https://www.postgresql.org/docs/current/runtime-config-replication.html. MySQL replication: https://dev.mysql.com/doc/refman/en/replication.html. Kleppmann, "Designing Data-Intensive Applications," chapters 5 and 9 cover replication and consistency models with clarity that most textbooks lack.',
        'Prerequisites: Write-Ahead Log (the mechanism being shipped), CAP Theorem (why you cannot have consistency, availability, and partition tolerance simultaneously).',
        'Extensions: consensus protocols (Raft, Paxos) for automatic leader election during failover, sharding for write scaling beyond one leader, CRDTs for conflict-free multi-leader data types.',
        'Contrasts: Two-Phase Commit (coordinating transactions across shards, not replicas), Change Data Capture / Debezium (logical event streams from the WAL, not physical replication).',
      ],
    },
  ],
};

