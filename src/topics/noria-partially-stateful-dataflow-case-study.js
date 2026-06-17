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
      heading: 'Why this exists',
      paragraphs: [
        'Read-heavy web applications spend a surprising amount of engineering effort on the same problem: a user action changes base rows, and many pages now need derived answers. A story page needs the story, author, comments, votes, and viewer-specific state. A user profile needs recent activity. A front page needs ranked stories. Recomputing every page from the database on every request wastes work, but caching every answer by hand creates invalidation bugs.',
        'Noria exists for that middle ground. It is a research system that compiles application read queries into a dataflow graph. Writes flow from base tables through operators. The graph maintains query-shaped views so reads can be served as lookups. The unusual part is that the graph can be partially stateful: it can keep hot pieces of derived state, evict cold pieces, and reconstruct missing pieces on demand with upqueries.',
        'The primary source is the OSDI 2018 paper "Noria: dynamic, partially-stateful data-flow for high-performance web applications": https://www.usenix.org/conference/osdi18/presentation/gjengset. The paper uses a Lobsters-style web workload to show the target domain: read-heavy application pages where query results are reused, but full materialization can consume too much memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is manual caching. Put story pages, vote counts, user records, or rendered fragments in Redis or an in-process cache. On writes, delete the keys that might be stale. This is simple when one table updates one page. It becomes fragile when a write to a vote table changes a story score, a user karma total, a front-page order, and several personalized views.',
        'The second reasonable approach is a materialized view. Let the database or a view-maintenance system keep the derived answer up to date. This removes much of the invalidation logic from application code. The cost is state: a fully materialized graph may keep every possible key for every view, even if most keys are cold. For web applications with skewed popularity, that is wasteful.',
        'The third approach is recomputation. Do not cache; run the query each time. This avoids stale reads and cache invalidation. It fails when the same joins and aggregations are repeated across many requests, and it gets especially expensive when read load is much higher than write load.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the application wants three properties that fight each other. Reads should be fast. Writes should update all dependent answers correctly. Memory should not grow as if every possible derived answer is equally important. Manual caches usually choose fast reads and bounded memory, but correctness moves into application invalidation code. Full materialization chooses correctness and fast reads, but state can explode.',
        'A second wall is query evolution. Real web applications add pages, alter queries, and change access patterns while serving traffic. A static dataflow graph is not enough. The system needs a way to add new maintained views, reuse existing operators, migrate state, and keep serving reads while the graph changes.',
        'The most important technical wall is reconstructability. It is not enough to say "evict cold state." If a future read asks for that state, the system must know how to rebuild exactly the missing key from upstream data. If rebuilding requires scanning the whole upstream relation, partial state has turned a memory optimization into a latency trap.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Noria treats application reads as a long-lived dataflow program. A parameterized SQL read becomes a path through base tables, joins, aggregations, projections, and a final view keyed by the read parameters. A write is not a cache invalidation event written by hand; it is a dataflow update that moves through the operators that depend on the changed rows.',
        'The core insight is partial state with upqueries. Operators and views can retain only the hot keys that are worth memory. When a read misses because a key was evicted, Noria sends an upquery backward through the graph to reconstruct the missing state from maintained or durable upstream data. The miss is not treated as "ask the application to recompute everything"; it is handled by the graph using the same dependency structure that maintains writes.',
        'This makes state a working set decision instead of an all-or-nothing decision. A query-shaped view can be maintained for popular keys, evicted for cold keys, and rebuilt when demand returns. The graph still owns the dependency logic, so the application does not need to remember every cache key affected by a vote, comment, story edit, or user update.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The application gives Noria a schema and read queries. Noria compiles those reads into an intermediate representation and a dataflow graph. Base tables hold durable rows. Operator nodes represent relational operations such as joins, filters, projections, and aggregations. Final views expose lookup-shaped answers to the application.',
        'Writes enter the base tables and produce changes. Those changes flow through the graph as updates to derived state. If the updated key is materialized in a downstream view, the view can be updated incrementally. If the key is not resident, the system may avoid doing work for that cold key until a read needs it.',
        'Reads go to views. On a hit, the view returns the maintained answer. On a miss, Noria issues an upquery. The upquery follows dependency edges upstream, using indexes where needed, to fetch the data required to rebuild the missing key. The rebuilt state can then be inserted into the view and used by later reads.',
        'Eviction controls memory. The system can discard cold state from views or operators, but only where future upqueries can reconstruct it cheaply enough. That condition is the reason the animation distinguishes hot keys, cold keys, misses, fanout, and scans. Partial state is a safe optimization only when the dependency path remains navigable.',
        'Dynamic views add another layer. Related queries can share existing operator paths rather than building separate pipelines. When a new query arrives, the system can reuse parts of the graph, migrate state, and add the new final view. This is why Noria belongs next to incremental view maintenance and streaming dataflow, but also next to application caching and schema migration.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is that a materialized answer for a key must match the result of running the corresponding query over the current base data. Incremental updates preserve that invariant for resident state. Upqueries restore the invariant for evicted state by recomputing the missing key through the graph, not by guessing from a stale cache entry.',
        'The graph makes invalidation structural. If a vote changes a story score, the dependency path from votes to score to story view is part of the dataflow plan. The application does not have to name every cache key that might include that score. The system updates maintained paths and can rebuild missing paths through the same relationships.',
        'Partial state works because many web workloads have skew. Hot stories, recent comments, active users, and current front-page entries get far more reads than old or obscure records. Keeping all state treats cold and hot keys equally. Keeping no state repeats common work. Keeping reconstructable hot state matches the access distribution.',
        'The limit is also part of the proof. Noria cannot safely make an operator partial if a missing key cannot be reconstructed without scanning too much upstream state or knowing global order. The system must either maintain more state, change the plan, or accept worse latency. Partial state is a contract, not a label.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a Lobsters-like news site. The story page query asks for one story by ID, its author, comments, vote count, tags, and viewer state. Manual caching would store a page or query result under a key such as story:42 and then delete it when comments, votes, tags, users, or moderation state change. That invalidation list grows with the product.',
        'In Noria, the query becomes a dataflow path. A write to the votes table updates the vote aggregation. The story view for story 42 is maintained if story 42 is hot. If story 42 was evicted and a reader opens it, the view misses, sends an upquery through the relevant indexes, reconstructs the answer, and inserts the hot key again.',
        'A user profile is similar. It is naturally keyed by user ID, so partial state can work well if the graph has indexes from user to stories, comments, or votes. Old inactive users can be evicted; active users stay hot. The application gets a lookup interface either way.',
        'A front-page ranking is harder. A global top list depends on many stories and their relative scores. One vote can change the order of many candidates. Reconstructing only one key may not be enough because the answer is a ranked set with global competition. This kind of view often needs fuller state, a different plan, or an approximation with explicit error and freshness bounds.',
      ],
    },
    {
      heading: 'Animation focus',
      paragraphs: [
        'The partial-state view shows the main memory decision. Hot keys remain resident and reads hit. Cold keys can be evicted to save memory. A miss does not leave the graph; it becomes an upquery that walks upstream dependencies and rebuilds the missing key.',
        'The unsafe-partial-state frame is the most important caution. Index-backed reconstruction is a good fit. A top-k operator or broad scan may not be. The question is not whether a key is cold; the question is whether the graph has enough indexed structure to rebuild that key without doing work that breaks the latency budget.',
        'The dynamic-views view shows Noria as a serving program that changes over time. SQL reads compile into graph nodes. Shared operators are reused. Migration is part of normal operation because the application will keep adding and changing reads.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Read cost is excellent on a hit: the application performs a lookup against maintained view state. Write cost is higher than a plain database write because updates must propagate through dependent operators. The system is buying cheaper repeated reads with more structured write-time maintenance.',
        'Memory cost is the central tradeoff. Full materialization can exceed base table size because joins and aggregates duplicate derived information. Partial state reduces that footprint by keeping a working set, but it adds eviction metadata, indexes for upqueries, and miss-handling machinery.',
        'Miss latency is the tax. If eviction is too aggressive, reads frequently pay reconstruction cost. If eviction is too conservative, memory approaches full materialization. The useful operating point depends on workload skew, read/write ratio, query shape, and how much state each hot key needs.',
        'Graph migration is another tax. A live system must add new queries without dropping correctness for existing ones. Reusing operators is valuable, but it makes planning and state movement more complicated than a one-query cache. Observability has to include upquery rates, eviction churn, write propagation delay, hot-key distribution, and operators that are forced to stay fully materialized.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Noria wins when reads dominate writes and the same derived answers are requested repeatedly. News sites, dashboards, profile pages, discussion pages, and feed-like applications often have this shape. Their access patterns are skewed, and many reads are parameterized by a natural key such as story ID or user ID.',
        'It also wins when manual cache invalidation is the engineering bottleneck. A dataflow graph turns invalidation into dependency maintenance. The application author describes the read query; the graph owns the propagation path from base-row changes to derived answers.',
        'It is a strong teaching example because it connects several ideas that are often studied separately: materialized views, incremental maintenance, cache eviction, indexes, streaming dataflow, and online migration. The partial-state rule shows how a system can combine them without pretending one abstraction removes all costs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Noria is a poor fit when reads are not reused. If most reads are one-off and cold, the system pays graph and upquery complexity without enough hits to justify it. A conventional database query path may be simpler and more predictable.',
        'It struggles with views that depend on global order, broad scans, or high fanout. A top-k ranking, a full-text search result, or an aggregate over nearly the whole dataset may not decompose into cheap keyed reconstruction. Those views may need full state, separate indexing systems, or different algorithms.',
        'It also does not eliminate operational complexity. The system needs memory limits, eviction policy, migration safety, query planning, backpressure, fault handling, and metrics. A bad plan can shift pain from application invalidation code into dataflow state churn.',
        'The main failure mode is treating partial state as a universal cache knob. Evicting a value is safe only if a future miss has a bounded, indexed reconstruction path and if the application can tolerate the miss latency. Otherwise the system can thrash: evict, miss, upquery, rebuild, evict again, and serve worse latency than either full materialization or direct database queries.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Differential Dataflow Incremental View Case Study for the update-propagation model, Database Indexing for the upquery requirement, Streaming Watermarks for dataflow progress, Flink Checkpointing Case Study for state recovery, and Redis-style cache eviction for the working-set side of the design.',
        'For contrast, study fully maintained materialized views, manual cache invalidation, search indexes, and query planners. Noria is easiest to understand when placed between those tools: more structured than a cache, more selective than full materialization, and more dynamic than a static database view.',
      ],
    },
  ],
};
