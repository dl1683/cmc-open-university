// Google F1 case study: distributed SQL over Spanner, with hierarchical schema
// and query/change-tracking layers built for AdWords-scale consistency.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'f1-distributed-sql-case-study',
  title: 'F1 Distributed SQL Case Study',
  category: 'Papers',
  summary: 'Google F1 as the distributed-SQL lesson: SQL usability over Spanner consistency, hierarchical schemas, and change publishing.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['SQL over Spanner', 'hierarchical schema latency'], defaultValue: 'SQL over Spanner' },
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

function architecture(title) {
  return graphState({
    nodes: [
      { id: 'app', label: 'AdWords apps', x: 0.7, y: 3.8, note: 'business logic' },
      { id: 'f1', label: 'F1 server', x: 2.8, y: 3.8, note: 'SQL + schema' },
      { id: 'query', label: 'query engine', x: 4.8, y: 2.2, note: 'distributed SQL' },
      { id: 'change', label: 'change stream', x: 4.8, y: 5.4, note: 'publish updates' },
      { id: 'spanner', label: 'Spanner', x: 7.0, y: 3.8, note: 'global transactions' },
      { id: 'paxos', label: 'Paxos groups', x: 9.0, y: 3.8, note: 'replication' },
    ],
    edges: [
      { id: 'e-app-f1', from: 'app', to: 'f1', weight: 'SQL/ORM' },
      { id: 'e-f1-query', from: 'f1', to: 'query', weight: 'plan' },
      { id: 'e-f1-change', from: 'f1', to: 'change', weight: 'track' },
      { id: 'e-query-spanner', from: 'query', to: 'spanner', weight: 'reads/writes' },
      { id: 'e-change-spanner', from: 'change', to: 'spanner', weight: 'commit data' },
      { id: 'e-spanner-paxos', from: 'spanner', to: 'paxos', weight: 'replicate' },
    ],
  }, { title });
}

function* sqlOverSpanner() {
  yield {
    state: architecture('F1 puts SQL and application ergonomics over Spanner'),
    highlight: { active: ['app', 'f1', 'query', 'spanner', 'e-app-f1', 'e-query-spanner'], compare: ['paxos'] },
    explanation: 'F1 was built for Google AdWords as a distributed relational database on top of Spanner. Spanner provides global transactions; F1 adds SQL, schema, indexing, query execution, and application-facing behavior.',
  };

  yield {
    state: labelMatrix(
      'Why F1 existed',
      [
        { id: 'mysql', label: 'old sharded MySQL' },
        { id: 'spanner', label: 'raw Spanner' },
        { id: 'f1', label: 'F1' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'weakness', label: 'weakness' },
      ],
      [
        ['familiar SQL', 'manual sharding/reliability pain'],
        ['global consistency', 'low-level data model for app teams'],
        ['SQL + consistency + scale', 'higher commit latency to manage'],
      ],
    ),
    highlight: { found: ['f1:strength'], compare: ['mysql:weakness', 'spanner:weakness'] },
    explanation: 'The key product requirement was not just scale. It was strong consistency and SQL usability for a business-critical application that could not tolerate ad-hoc eventual-consistency logic everywhere.',
    invariant: 'F1 inherits Spanner consistency but must design around Spanner latency.',
  };

  yield {
    state: architecture('Distributed SQL and change tracking sit above storage'),
    highlight: { active: ['query', 'change', 'spanner', 'e-f1-query', 'e-f1-change'], found: ['app'] },
    explanation: 'F1 includes a distributed SQL query engine and automatic change tracking/publishing. That makes the database a platform for both transactions and downstream systems.',
  };

  yield {
    state: labelMatrix(
      'F1 compared with adjacent systems',
      [
        { id: 'spanner', label: 'Spanner' },
        { id: 'bigtable', label: 'Bigtable' },
        { id: 'f1', label: 'F1' },
        { id: 'foundation', label: 'FoundationDB' },
      ],
      [
        { id: 'core', label: 'core layer' },
        { id: 'developer', label: 'developer contract' },
      ],
      [
        ['global transaction substrate', 'key-value/table API'],
        ['distributed sorted map', 'application-managed model'],
        ['SQL/database layer', 'relational app model'],
        ['transactional KV substrate', 'layers build models'],
      ],
    ),
    highlight: { found: ['f1:core', 'f1:developer'], compare: ['spanner:core', 'foundation:developer'] },
    explanation: 'F1 is useful because it separates substrate from product database. Spanner gives consistency; F1 gives the application teams a database model they can actually use.',
  };
}

function* hierarchicalSchemaLatency() {
  yield {
    state: labelMatrix(
      'Hierarchical schema clusters related rows',
      [
        { id: 'customer', label: 'Customer' },
        { id: 'campaign', label: 'Campaign' },
        { id: 'adgroup', label: 'AdGroup' },
        { id: 'creative', label: 'Creative' },
      ],
      [
        { id: 'parent', label: 'parent' },
        { id: 'locality', label: 'locality' },
        { id: 'latency', label: 'latency effect' },
      ],
      [
        ['-', 'root entity', 'transaction root'],
        ['Customer', 'near parent', 'local writes when possible'],
        ['Campaign', 'near parent', 'avoid wide distributed txns'],
        ['AdGroup', 'near parent', 'business object locality'],
      ],
    ),
    highlight: { active: ['campaign:parent', 'adgroup:parent', 'creative:parent'], found: ['creative:latency'] },
    explanation: 'F1 uses a hierarchical schema model so related business entities can be stored and updated with better locality. The schema is not only logical; it is a latency-management tool.',
  };

  yield {
    state: architecture('Commit latency comes from synchronous replication'),
    highlight: { active: ['f1', 'spanner', 'paxos', 'e-query-spanner', 'e-spanner-paxos'], compare: ['app'] },
    explanation: 'Spanner synchronously replicates and gives strong consistency. F1 has to design application patterns and schemas that keep high-latency distributed commits from dominating user workflows.',
  };

  yield {
    state: labelMatrix(
      'Application design patterns',
      [
        { id: 'locality', label: 'co-locate entities' },
        { id: 'async', label: 'async workflows' },
        { id: 'changes', label: 'change publishing' },
        { id: 'sql', label: 'distributed SQL' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['reduce cross-group work', 'schema rigidity'],
        ['hide latency', 'workflow complexity'],
        ['feed downstream indexes', 'ordering and idempotency'],
        ['ad-hoc analysis', 'expensive fanout'],
      ],
    ),
    highlight: { found: ['locality:helps', 'changes:helps'], compare: ['sql:risk'] },
    explanation: 'F1 teaches an uncomfortable truth: strong consistency at global scale is possible, but application design has to participate.',
  };

  yield {
    state: labelMatrix(
      'Study connections',
      [
        { id: 'spanner', label: 'Spanner' },
        { id: 'two_phase', label: '2PC' },
        { id: 'dataflow', label: 'Dataflow' },
        { id: 'snowflake', label: 'Snowflake' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'question', label: 'question answered' },
      ],
      [
        ['global transactions', 'what is the substrate?'],
        ['commit protocol', 'how do writes coordinate?'],
        ['change publishing', 'where do updates flow?'],
        ['SQL analytics contrast', 'OLTP vs warehouse?'],
      ],
    ),
    highlight: { found: ['spanner:question', 'two_phase:question', 'dataflow:connection'], compare: ['snowflake:question'] },
    explanation: 'F1 links the relational database, distributed transaction, and streaming/change-data-capture parts of the curriculum.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'SQL over Spanner') yield* sqlOverSpanner();
  else if (view === 'hierarchical schema latency') yield* hierarchicalSchemaLatency();
  else throw new InputError('Pick an F1 view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'The animation shows F1 placing SQL semantics above Spanner. SQL is the relational query language; Spanner is Google\'s distributed storage and transaction layer. Active nodes show query or transaction stages, found nodes are committed data or indexes, and compare nodes are coordination points that add latency.',
      'The safe inference rule is locality. If related rows are stored near each other and the query can use indexes, F1 can keep the transaction small. If a query crosses many partitions, the same SQL statement becomes distributed coordination work.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Google AdWords needed strong correctness for business records while growing beyond manual shards. Ads, accounts, campaigns, budgets, and billing state are not acceptable places for eventual conflict repair. At the same time, engineers needed SQL, indexes, schema evolution, and ad hoc analysis.',
      'F1 exists because raw scalable storage was not enough. Spanner could provide external consistency and replication, but application teams still needed a relational database contract. F1 put a SQL layer and schema model on top of Spanner while exposing the cost of distributed joins and transactions.',
        {type:'callout', text:'F1 makes distributed SQL usable by placing relational semantics above Spanner while forcing locality and coordination costs back into schema and workflow design.'},
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is manual sharding. Split customers by account id, keep each account on one MySQL shard, and route application requests to the right shard. This works while most transactions stay inside one shard and resharding is rare.',
      'Another approach is NoSQL storage with application-side joins. That scales writes and simple key lookups, but it moves constraints, joins, and migration logic into application code. The database stops enforcing many facts the business actually depends on.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is that business data does not respect shard boundaries forever. Advertiser hierarchies change, reports join across entities, and secondary indexes need to answer questions not keyed by the original shard id. Resharding becomes a product risk instead of a background operation.',
      'Manual sharding also destroys a clean correctness boundary. If a budget update and an ad-serving rule update land on different shards, the application has to coordinate them. Every hand-built coordinator becomes another place for partial failure to leak into money-moving state.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Use Spanner for distributed transactions and replication, then make SQL locality an explicit schema design problem. F1 supports hierarchical schemas so child rows can be colocated with parent rows. That lets common account-scoped operations run near the data they touch.',
      'The invariant is that SQL semantics remain real even when storage is distributed. Transactions commit through Spanner, indexes are maintained consistently, and queries see a database state rather than a pile of shard-specific guesses. The trade is that bad schemas make coordination visible as latency.',
    ] },
    { heading: 'How it works', paragraphs: [
      'F1 stores relational data in Spanner tables and uses Spanner transactions for atomic updates. A query planner chooses scans, index lookups, joins, and distributed execution steps. The execution layer pushes work close to storage when it can and coordinates across partitions when it must.',
      'Hierarchical schema is the main data-layout tool. If Campaign rows are descendants of Advertiser rows, records commonly read together can share locality. Secondary indexes provide alternate access paths, but each index adds write cost because it must stay consistent with the base table.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness comes from delegating commit order to Spanner. If a transaction updates a base row and its index entries, the commit either becomes visible as one database change or not at all. F1 can expose SQL because the storage layer gives it a real transaction boundary.',
      'The schema rules make performance predictable. When parent and child records are colocated, a join over that hierarchy can behave like a local lookup. When the same query crosses many groups, F1 still returns correct SQL results, but it pays with remote reads and coordination.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Cost behaves with touched partitions, not just row count. Updating 10 rows inside one locality group may be a small transaction. Updating 10 rows spread across 10 groups needs more locks, messages, and commit coordination.',
      'Indexes trade read speed for write cost. If a table has 4 secondary indexes and one update changes indexed columns, the transaction may write the base row plus 4 index entries. At 2,000 updates per second, that can turn into 10,000 logical writes per second before replication cost.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'F1 fits business-critical systems that need SQL and global scale at the same time. Ad platforms, billing systems, inventory ledgers, and configuration databases all need strong constraints and query flexibility. The access pattern is many account-scoped operations with some cross-account analysis.',
      'The case study also shaped later distributed SQL systems. Cloud Spanner, CockroachDB, YugabyteDB, and TiDB all expose SQL over replicated distributed storage. Each system makes different choices, but all face the same tension between relational convenience and distributed coordination.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Distributed SQL fails when users expect single-node latency for cross-partition work. A join that touches 500 partitions can be correct and still too slow for an interactive path. The right fix may be schema redesign, precomputed views, or moving the query out of the serving path.',
      'It also fails when schema designers ignore locality. If every useful access path needs a global secondary index and every transaction updates several indexes, the write path becomes coordination-heavy. F1 makes those costs explicit; it does not make them disappear.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose an advertiser has 1 account row, 200 campaign rows, and 20,000 ad rows. A budget update touches the account row, 3 campaign rows, and one secondary index entry. If those rows are in one locality group, the transaction mostly pays local storage work plus one distributed commit.',
      'Now suppose a reporting query joins 1,000 advertisers by region and reads 50 rows per advertiser. That is 50,000 rows, but the bigger issue is that it crosses 1,000 locality groups. The planner can parallelize scans, yet the query now pays network fanout and result assembly.',
      'The behavior explains the design rule. Put data that changes together and reads together under the same hierarchy when possible. Use global indexes for real alternate lookups, but count each index as a write-time bill, not as free search.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: the Google Research paper "F1: A Distributed SQL Database That Scales" and the Spanner paper. Study F1 schema hierarchy, index maintenance, transaction behavior, and the AdWords migration constraints.',
      'Study next: Spanner TrueTime, two-phase commit, query planning, secondary indexes, distributed joins, and manual sharding. The central lesson is that distributed SQL gives a relational contract, while schema locality decides whether that contract is cheap.',
    ] },
  ],
};
