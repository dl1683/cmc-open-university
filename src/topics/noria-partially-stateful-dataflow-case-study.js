// Noria partially-stateful dataflow: web-application reads as maintained,
// query-shaped views with eviction, upqueries, and dynamic graph change.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'noria-partially-stateful-dataflow-case-study',
  title: 'Noria Partially Stateful Dataflow Case Study',
  category: 'Papers',
  summary: 'Noria as a web-systems lesson: compile parameterized SQL reads into a partially stateful dataflow graph that maintains hot view state and reconstructs cold state on demand.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['partial state', 'dynamic views'], defaultValue: 'partial state' },
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

function noriaGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'writes', label: 'writes', x: 0.7, y: 4.8, note: notes.writes ?? 'base rows' },
      { id: 'base', label: 'base tbl', x: 2.3, y: 4.8, note: notes.base ?? 'durable' },
      { id: 'join', label: 'join', x: 4.2, y: 3.0, note: notes.join ?? 'dataflow' },
      { id: 'agg', label: 'agg', x: 5.9, y: 3.0, note: notes.agg ?? 'maintain' },
      { id: 'view', label: 'view', x: 7.6, y: 3.0, note: notes.view ?? 'hot keys' },
      { id: 'read', label: 'read', x: 9.2, y: 3.0, note: notes.read ?? 'lookup' },
      { id: 'upquery', label: 'upquery', x: 5.9, y: 6.0, note: notes.upquery ?? 'rebuild key' },
      { id: 'evict', label: 'evict', x: 7.6, y: 1.2, note: notes.evict ?? 'cold' },
    ],
    edges: [
      { id: 'e-writes-base', from: 'writes', to: 'base', weight: 'insert/update' },
      { id: 'e-base-join', from: 'base', to: 'join', weight: 'diffs' },
      { id: 'e-join-agg', from: 'join', to: 'agg', weight: 'rows' },
      { id: 'e-agg-view', from: 'agg', to: 'view', weight: 'materialize' },
      { id: 'e-view-read', from: 'view', to: 'read', weight: 'answer' },
      { id: 'e-read-upquery', from: 'read', to: 'upquery', weight: 'miss' },
      { id: 'e-upquery-base', from: 'upquery', to: 'base', weight: 'lookup' },
      { id: 'e-view-evict', from: 'view', to: 'evict', weight: 'free' },
    ],
  }, { title });
}

function migrationGraph(title) {
  return graphState({
    nodes: [
      { id: 'sql', label: 'SQL reads', x: 0.7, y: 3.5, note: 'params' },
      { id: 'mir', label: 'MIR', x: 2.5, y: 3.5, note: 'graph' },
      { id: 'reuse', label: 'reuse', x: 4.3, y: 2.0, note: 'shared ops' },
      { id: 'mig', label: 'migrate', x: 4.3, y: 5.0, note: 'online' },
      { id: 'domains', label: 'domains', x: 6.4, y: 3.5, note: 'workers' },
      { id: 'views', label: 'views', x: 8.5, y: 3.5, note: 'lookups' },
    ],
    edges: [
      { id: 'e-sql-mir', from: 'sql', to: 'mir', weight: 'compile' },
      { id: 'e-mir-reuse', from: 'mir', to: 'reuse', weight: 'share' },
      { id: 'e-mir-mig', from: 'mir', to: 'mig', weight: 'change' },
      { id: 'e-reuse-domains', from: 'reuse', to: 'domains', weight: 'place' },
      { id: 'e-mig-domains', from: 'mig', to: 'domains', weight: 'update' },
      { id: 'e-domains-views', from: 'domains', to: 'views', weight: 'serve' },
    ],
  }, { title });
}

function* partialState() {
  yield {
    state: noriaGraph('Noria materializes read queries as a dataflow graph'),
    highlight: { active: ['writes', 'base', 'join', 'agg', 'view', 'e-base-join', 'e-agg-view'], found: ['read'] },
    explanation: 'Noria compiles parameterized SQL reads into a dataflow graph. Writes update base tables, flow through operators, and maintain view state so reads become fast lookups.',
    invariant: 'The view is query-shaped state, not an unrelated cache key invented by application code.',
  };

  yield {
    state: labelMatrix(
      'Partial state ledger',
      [
        { id: 'hot', label: 'hot' },
        { id: 'cold', label: 'cold' },
        { id: 'miss', label: 'miss' },
        { id: 'fan', label: 'fanout' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'action', label: 'action' },
      ],
      [
        ['kept', 'hit'],
        ['evict', 'mem'],
        ['miss', 'upq'],
        ['wide', 'full'],
      ],
    ),
    highlight: { active: ['hot:action', 'cold:action'], found: ['miss:action'], compare: ['fan:action'] },
    explanation: 'Partial state means the system can keep only hot keys in memory. A miss sends an upquery upstream to reconstruct the missing key instead of forcing all state to stay resident forever.',
  };

  yield {
    state: noriaGraph('Upqueries reconstruct evicted state on demand', { view: 'miss', upquery: 'key=story42', read: 'wait' }),
    highlight: { active: ['read', 'upquery', 'base', 'e-read-upquery', 'e-upquery-base'], found: ['view'] },
    explanation: 'If a read asks for an evicted key, Noria traces dependencies upstream through indexes and reconstructs the needed state. This is the core difference from a naive cache miss.',
  };

  yield {
    state: labelMatrix(
      'When partial state is unsafe',
      [
        { id: 'idx', label: 'index' },
        { id: 'topk', label: 'top-k' },
        { id: 'desc', label: 'desc' },
        { id: 'scan', label: 'scan' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'result', label: 'result' },
      ],
      [
        ['index', 'part'],
        ['rank', 'full'],
        ['child', 'safe'],
        ['scan', 'off'],
      ],
    ),
    highlight: { active: ['idx:result'], compare: ['topk:result', 'scan:result'], found: ['desc:need'] },
    explanation: 'Partial state works only when the system can answer upqueries efficiently. If reconstruction requires scanning all upstream state, the operator needs fuller materialization.',
  };
}

function* dynamicViews() {
  yield {
    state: migrationGraph('Parameterized reads become an evolving dataflow program'),
    highlight: { active: ['sql', 'mir', 'reuse', 'domains', 'e-sql-mir', 'e-mir-reuse'], found: ['views'] },
    explanation: 'Noria maps application read queries into an internal dataflow graph. Related queries can share operators and state instead of each building a private cache pipeline.',
  };

  yield {
    state: labelMatrix(
      'Cache versus Noria',
      [
        { id: 'redis', label: 'cache' },
        { id: 'mv', label: 'matview' },
        { id: 'noria', label: 'Noria' },
        { id: 'diff', label: 'DiffDF' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'hard', label: 'hard part' },
      ],
      [
        ['keys', 'invalid'],
        ['full', 'refresh'],
        ['partial', 'upq'],
        ['traces', 'front'],
      ],
    ),
    highlight: { active: ['noria:state', 'noria:hard'], compare: ['redis:hard'], found: ['diff:state'] },
    explanation: 'Noria sits between manual caches and fully maintained dataflow. It keeps query-shaped view state but can evict and reconstruct pieces to avoid state explosion.',
  };

  yield {
    state: migrationGraph('Online graph change is part of the system design'),
    highlight: { active: ['mir', 'mig', 'domains', 'e-mir-mig', 'e-mig-domains'], compare: ['reuse'], found: ['views'] },
    explanation: 'Web applications change queries over time. Noria treats query addition and graph migration as a first-class runtime operation instead of a full offline rebuild.',
    invariant: 'A long-lived serving graph needs a migration protocol, not only a fast steady state.',
  };

  yield {
    state: labelMatrix(
      'Complete web-read case study',
      [
        { id: 'story', label: 'story' },
        { id: 'votes', label: 'votes' },
        { id: 'front', label: 'frontpg' },
        { id: 'user', label: 'user' },
      ],
      [
        { id: 'query', label: 'query' },
        { id: 'state', label: 'state' },
      ],
      [
        ['id', 'hot'],
        ['story', 'part'],
        ['top', 'full'],
        ['prof', 'look'],
      ],
    ),
    highlight: { active: ['story:state', 'votes:state', 'user:state'], compare: ['front:state'] },
    explanation: 'A Lobsters-like site has story pages, vote counts, user profiles, and front-page rankings. Some views are naturally keyed and partial; global ranked lists are harder.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'partial state') yield* partialState();
  else if (view === 'dynamic views') yield* dynamicViews();
  else throw new InputError('Pick a Noria view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Noria is a research system for high-performance read-heavy web applications. It compiles application read queries into a dynamic, partially stateful dataflow graph. Writes update base tables, dataflow operators maintain derived state, and reads become direct lookups into query-shaped views.',
        'This topic extends Differential Dataflow Incremental View Case Study, Google Dataflow Model Case Study, MillWheel Streaming Case Study, Flink Checkpointing Case Study, Database Indexing, and Mesa Warehouse Case Study. Those topics explain streaming, checkpoints, frontiers, indexing, and materialized views. Noria adds partial state and web-service query evolution.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An application supplies a relational schema and parameterized queries. Noria compiles those queries into a dataflow graph that maintains materialized output state. Incoming writes are propagated through the graph so dependent views stay current.',
        'The distinctive idea is partially stateful dataflow. Operators and views do not have to keep all possible keys resident. Cold state can be evicted. If a later read needs an evicted key, Noria issues an upquery upstream to reconstruct just the missing state.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core structures are base tables, operator nodes, view state, indexes for upqueries, partial materializations, eviction metadata, dependency paths, and graph-migration state. Related queries can share operators so the graph avoids duplicating computation and state.',
        'Partial state is constrained by reconstructability. If a missing key can be rebuilt through indexed lookups, partial state is attractive. If reconstruction requires a full upstream scan, the operator may need full state or a different plan.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Lobsters-like news site has story pages, comments, vote counts, user profiles, and a front page. Manual caching requires application code to remember every invalidation path. Noria compiles the read queries into a dataflow graph so writes to votes, stories, and users update the views automatically.',
        'Story-by-id and votes-by-story views are naturally keyed. They can keep hot keys in memory and reconstruct cold keys on demand. A global top stories view is harder because each update can affect the ordering of many stories; that kind of operator may require fuller state.',
      ],
    },
    {
      heading: 'Cost and pitfalls',
      paragraphs: [
        'Noria does not make arbitrary materialized views cheap. Fanout still matters, global ranking is difficult, and partial state works only when upqueries can be served efficiently. The system also needs migration machinery because real web applications add and change queries while serving traffic.',
        'The operational tradeoff is memory versus miss latency. Evict too little and state explodes. Evict too aggressively and reads pay reconstruction cost. A production service needs observability around hot keys, upquery frequency, graph changes, and operators that cannot safely stay partial.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: USENIX OSDI 2018 Noria page at https://www.usenix.org/conference/osdi18/presentation/gjengset, OSDI paper PDF at https://www.usenix.org/system/files/osdi18-gjengset.pdf, and Noria repository at https://github.com/mit-pdos/noria. Study Differential Dataflow Incremental View Case Study, Streaming Watermarks, Google Dataflow Model Case Study, Flink Checkpointing Case Study, Database Indexing, Mesa Warehouse Case Study, Redis LRU Cache Case Study, and Kubernetes Reconciliation Case Study next.',
      ],
    },
  ],
};
