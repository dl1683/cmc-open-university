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
      heading: 'What it is',
      paragraphs: [
        'F1 is Google\'s distributed SQL database built on Spanner for AdWords. It combines SQL usability, relational schema, distributed query execution, change publishing, and Spanner-backed strong consistency.',
        'The case study matters because it shows that a distributed database is not only a storage substrate. Application-facing semantics, schema design, latency management, and downstream data flows are part of the product.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Spanner provides synchronous replication and global transactions. F1 adds SQL, a distributed query engine, secondary indexing, hierarchical schema support, and change tracking. Applications talk to F1 rather than building consistency and sharding logic around a lower-level store.',
        'The hierarchical schema groups related entities so common transactions touch fewer independent groups. That mitigates commit latency from synchronous replication and gives application developers a more predictable data model.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Strong consistency at global scale costs latency. F1 mitigates that cost with schema locality and application patterns, but developers still need to understand transaction boundaries, asynchronous flows, and expensive distributed queries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'F1 was designed for AdWords, where business correctness and developer productivity were both critical. Its lessons apply to distributed SQL systems, globally consistent applications, change-data-capture pipelines, and database migration away from manual sharding.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'F1 does not make global commit latency disappear. It designs around it. Another misconception is that SQL is merely a query language here; in F1, SQL and schema are also application contracts over a distributed transaction substrate.',
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
