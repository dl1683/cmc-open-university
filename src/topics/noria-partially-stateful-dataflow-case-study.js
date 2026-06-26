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
    { heading: 'How to read the animation', paragraphs: ['Read the graph as a dataflow query plan. A dataflow node receives changes from its parents, updates any state it keeps, and sends derived changes to its children.', 'The active edge is the change currently moving through the plan. A materialized node stores hot results, while a partially stateful node can reconstruct a missing key by asking upstream for only the data it needs.', {type:'callout', text:'Noria makes cached reads structural by keeping query-shaped hot state and rebuilding cold keys through indexed upqueries.'}] },
    { heading: 'Why this exists', paragraphs: ['Read-heavy applications often cache database query results. The hard part is keeping those cached results correct after writes change the base tables.', 'Noria exists to make cache maintenance part of the dataflow plan. Instead of invalidating whole query results by hand, updates move through operators that know how derived views depend on base rows.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is application-managed caching. A request checks Redis or memory, falls back to SQL on a miss, and deletes cache entries after writes.', 'That works while dependencies are simple. It breaks when one write changes many query results or when invalidation misses a derived view that a future read will trust.'] },
    { heading: 'The wall', paragraphs: ['The wall is update fanout. Fully materializing every derived query can make writes expensive, because one base-row change may touch many views and keys.', 'The opposite wall is cold-miss latency. If nothing is materialized, every read rebuilds the query from base tables and loses the point of a cache.'] },
    { heading: 'The core insight', paragraphs: ['Noria keeps state only where it pays for future reads. Hot keys can be materialized, while cold keys can be reconstructed through indexed upqueries from upstream operators.', 'An upquery is a targeted request from a downstream node to its parents for the missing input needed to answer one key. This lets the system trade memory for recomputation at key granularity.'] },
    { heading: 'How it works', paragraphs: ['A query is compiled into operators such as filters, joins, aggregates, and projections. Base-table writes become positive or negative records that flow through the graph and update materialized state.', 'When a read asks for a missing key, the leaf node issues an upquery. Upstream indexes return the rows needed for that key, downstream operators rebuild the result, and the system may keep the result if the key becomes hot.'] },
    { heading: 'Why it works', paragraphs: ['The correctness argument is change conservation. If each operator applies every base-table delta to exactly the derived records that depend on it, then materialized results stay equivalent to rerunning the query on current base data.', 'Partial state preserves that argument by using indexes for missing keys. A cold key is not guessed; it is reconstructed from upstream state that follows the same delta rules.'] },
    { heading: 'Cost and complexity', paragraphs: ['Memory cost behaves with the number of materialized keys and the size of each result. If 1 million hot user profiles each cache 2 KB of joined data, the hot state alone is about 2 GB before indexes and metadata.', 'Write cost behaves with dependency fanout. A write that affects one user profile is cheap, while a write that changes a popular shared object may update many cached results and become the dominant cost.'] },
    { heading: 'Real-world uses', paragraphs: ['This pattern fits read-heavy web services with repeated parameterized queries, such as timelines, profile summaries, dashboards, and permission-filtered lists. The access pattern has stable hot keys and writes that should update derived results without full cache invalidation.', 'It is also useful for teaching incremental view maintenance. Students can see a query as a graph of stateful operators rather than a string sent to a database.'] },
    { heading: 'Where it fails', paragraphs: ['It fails when queries are highly ad hoc and keys do not repeat. Partial materialization pays for indexes and planning without enough cache hits to recover the cost.', 'It also fails when operations are hard to make incremental. Complex transactions, non-deterministic functions, external side effects, or weak source ordering can make the derived state hard to reason about.'] },
    { heading: 'Worked example', paragraphs: ['A service reads /user/42/feed 1,000 times per minute and stores a 50-item feed result at 4 KB. Keeping that one hot key costs 4 KB, while recomputing it from posts, follows, and blocks on every request would cost 1,000 query runs per minute.', 'A new post by author 7 arrives, and 10,000 followers might see it. If only 800 follower feeds are hot, Noria updates those materialized keys and lets the other 9,200 cold keys rebuild later through upqueries.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources are the Noria paper and implementation materials from MIT PDOS. Read them beside incremental view maintenance literature to understand what is materialized and what is reconstructed.', 'Study dataflow graphs, materialized views, differential dataflow, LSM trees, indexes, cache invalidation, and database joins next. The practical skill is measuring when state is cheaper than recomputation.'] },
  ],
};