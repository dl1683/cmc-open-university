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
    {
      heading: 'Why this exists',
      paragraphs: [
        'AdWords needed strong correctness for business data, but also needed the productivity of SQL, secondary indexes, schema evolution, and ad-hoc querying. Manual sharding can scale storage, but it pushes transaction boundaries, joins, consistency, and resharding pain into application code.',
        'F1 is Google\'s distributed SQL database built on Spanner for AdWords. It shows that a distributed database is not just a storage substrate. The user-facing contract includes relational schema, SQL, distributed transactions, change publishing, application latency patterns, and operational migration away from hand-managed shards.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep using a traditional relational database and shard it manually. That preserves SQL locally, but global invariants become hard. Cross-shard transactions, secondary indexes, backup, migration, and analytics all turn into bespoke infrastructure.',
        'Another obvious approach is to move to a scalable key-value store and give up rich SQL. That can improve availability and scale, but it makes application teams rebuild joins, indexes, constraints, and query tooling. F1 asks for a harder target: distributed scale without giving up the relational model.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is commit latency. Spanner gives synchronous replication and globally consistent transactions, but that means writes can cross machines, zones, and Paxos groups. A naive relational schema can accidentally make every user action pay a distributed transaction cost.',
        'The second wall is developer expectation. SQL users expect joins, secondary indexes, transactions, schema evolution, and query plans. Distributed systems users expect partitions, replication, time, and failure. F1 has to make those worlds meet without pretending the distributed cost disappeared.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Put SQL and application semantics above a strongly consistent distributed substrate, but make locality visible in the schema. F1 uses Spanner for replication and transactions, then adds a SQL layer, distributed query execution, secondary indexes, hierarchical schema, and change streams.',
        'The hierarchical schema is the key teaching idea. Related business entities can be stored so common operations touch nearby data. The schema is not only logical documentation; it is a latency-management structure.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The SQL-over-Spanner view shows the layering: application SQL enters F1, F1 plans distributed work, and Spanner supplies strongly consistent storage and replication. Each layer owns a different part of the contract.',
        'The hierarchical-schema view shows why schema design is not neutral. Co-locating related entities can reduce cross-group work, while careless schema and query design can turn one logical operation into expensive fanout.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Spanner provides the distributed storage foundation: synchronous replication, transactions, and globally meaningful timestamps. F1 adds a database layer that understands schemas, SQL, indexes, query execution, and application-facing data modeling.',
        'Reads and queries can fan out across partitions. Writes may commit through distributed transaction machinery. Secondary indexes and change publishing make the system useful to applications and downstream pipelines, but they also add maintenance and consistency work.',
        'Application patterns matter. F1 used hierarchical schemas, asynchronous workflows, and change streams so common user-facing paths avoided unnecessary distributed work while still preserving strong correctness where it mattered.',
        'The query layer has to respect the storage layer. A distributed join is not just a relational algebra operator; it is a plan that may ship data, wait on remote partitions, and coordinate with transaction timestamps. The planner needs statistics, locality awareness, and execution strategies that prevent ordinary SQL from becoming accidental cluster-wide work.',
        'Schema evolution is also part of the system. A distributed SQL database for a live product cannot stop the world every time a column, index, or constraint changes. F1 had to make schema changes operationally safe enough for application teams while preserving a clear contract for readers, writers, and downstream consumers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An advertising account owns campaigns, ad groups, ads, bids, and budget rules. A flat schema that scatters those records across independent groups can make a normal campaign edit touch many distributed partitions. A hierarchical schema can keep related entities closer so common transactions pay less coordination cost.',
        'A reporting query is different. It may scan large amounts of data and join across entities. F1 can expose SQL for that, but the query planner and users still need to respect distributed execution. Rich SQL does not make fanout free.',
        'A budget update shows the difference. The product wants the user to see a correct budget and avoid overspending. That path needs strong transactional behavior. A dashboard that aggregates yesterday\'s ad performance may tolerate a different pipeline shape, using change publishing and downstream processing. F1 is educational because it separates these needs instead of pretending every access pattern is the same.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'F1 works because it does not hide Spanner; it builds on it. Strong consistency, replication, and transaction ordering come from the substrate. SQL, schema, indexes, and query planning come from F1. Application design bridges the two.',
        'The system also works because it treats migration and ecosystem as first-class concerns. AdWords could move from sharded MySQL-style systems toward a distributed SQL platform without asking every developer to hand-code distributed transaction logic.',
        'The migration lesson matters. A database architecture is not adopted by proving that one benchmark is elegant. It is adopted when application teams can move real workflows, keep correctness, preserve enough SQL productivity, understand the latency model, and debug failures. F1 made the distributed substrate usable by giving developers a familiar interface while still forcing the most important locality choices into schema and workflow design.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Strong consistency at global scale costs latency. F1 mitigates that cost with schema locality and application patterns, but developers still need to understand transaction boundaries, asynchronous flows, and expensive distributed queries.',
        'The tradeoff is worthwhile when correctness and developer productivity matter enough to pay the distributed cost. It is less attractive for pure analytics, append-only logs, or workloads where eventual consistency and denormalized storage are simpler and cheaper.',
        'The behavior is easiest to understand as a budget. Every cross-partition transaction, index maintenance step, remote scan, schema change, and change-stream consumer spends part of the latency or operational budget. F1 gives teams a powerful abstraction, but the bill still arrives through commit latency, query planning complexity, and operational coordination.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'F1 wins for business-critical OLTP data that needs SQL, transactions, indexes, and scale. It is a strong case study for globally consistent applications, distributed SQL systems, change-data-capture pipelines, and migration away from manual sharding.',
        'It also teaches an important curriculum point: the hard part of distributed SQL is not only consensus or storage. It is the whole product contract between application developers, query planners, schema design, replication, and downstream data consumers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'F1 does not make global commit latency disappear. It designs around it. A careless schema, a fanout-heavy transaction, or an unbounded distributed query can still be slow and expensive.',
        'It also is not a warehouse replacement. Analytical systems such as Snowflake optimize for different access patterns, storage layout, and workload isolation. F1 is best understood as distributed SQL for operational business data, not as one database to replace every data system.',
        'It can fail educationally when learners reduce it to "SQL on Spanner." That phrase is true but too thin. The real lesson is how storage guarantees, query planning, schema locality, application workflow, indexing, and change publishing fit together. If you miss those joints, you miss why the system was hard.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Google Research paper PDF at https://research.google.com/pubs/archive/41344.pdf and Google Research page at https://research.google/pubs/f1-a-distributed-sql-database-that-scales/. Study Spanner Case Study, Bigtable Case Study, Two-Phase Commit (2PC), FoundationDB Case Study, Google Dataflow Model Case Study, and Snowflake Warehouse Case Study next.',
      ],
    },
  ],
};
