// GraphQL execution: selection sets become a resolver plan, then resolver
// calls are batched, authorized, traced, and assembled into a shaped response.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'graphql-resolver-execution-plan-case-study',
  title: 'GraphQL Resolver Execution Plan Case Study',
  category: 'Systems',
  summary: 'A GraphQL execution primer: parse, validate, collect fields, plan resolver work, batch data loads, preserve response shape, and report path-aware errors.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['selection tree', 'resolver batching'], defaultValue: 'selection tree' },
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

function executionGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.65, y: 3.7, note: notes.client ?? 'query' },
      { id: 'parse', label: 'parse', x: 2.0, y: 2.1, note: notes.parse ?? 'AST' },
      { id: 'valid', label: 'valid', x: 2.0, y: 5.3, note: notes.valid ?? 'schema' },
      { id: 'plan', label: 'plan', x: 3.75, y: 3.7, note: notes.plan ?? 'fields' },
      { id: 'res', label: 'res', x: 5.45, y: 2.1, note: notes.res ?? 'resolver' },
      { id: 'batch', label: 'batch', x: 5.45, y: 5.3, note: notes.batch ?? 'loader' },
      { id: 'store', label: 'store', x: 7.35, y: 3.7, note: notes.store ?? 'DB/API' },
      { id: 'resp', label: 'resp', x: 9.15, y: 3.7, note: notes.resp ?? 'shape' },
    ],
    edges: [
      { id: 'e-client-parse', from: 'client', to: 'parse', weight: '' },
      { id: 'e-client-valid', from: 'client', to: 'valid', weight: '' },
      { id: 'e-parse-plan', from: 'parse', to: 'plan', weight: '' },
      { id: 'e-valid-plan', from: 'valid', to: 'plan', weight: '' },
      { id: 'e-plan-res', from: 'plan', to: 'res', weight: '' },
      { id: 'e-plan-batch', from: 'plan', to: 'batch', weight: '' },
      { id: 'e-res-store', from: 'res', to: 'store', weight: '' },
      { id: 'e-batch-store', from: 'batch', to: 'store', weight: '' },
      { id: 'e-store-resp', from: 'store', to: 'resp', weight: '' },
      { id: 'e-res-resp', from: 'res', to: 'resp', weight: '' },
    ],
  }, { title });
}

function* selectionTree() {
  yield {
    state: executionGraph('A GraphQL request becomes a validated field tree'),
    highlight: { active: ['client', 'parse', 'valid', 'plan', 'e-client-parse', 'e-client-valid', 'e-parse-plan', 'e-valid-plan'], compare: ['res', 'batch'] },
    explanation: 'GraphQL execution starts before any database call. The operation is parsed into an AST, validated against the schema, and reduced to the fields that must appear in the response shape.',
    invariant: 'Invalid operations should fail before resolver side effects begin.',
  };

  yield {
    state: labelMatrix(
      'Sel',
      [
        { id: 'root', label: 'root' },
        { id: 'field', label: 'field' },
        { id: 'frag', label: 'frag' },
        { id: 'arg', label: 'arg' },
        { id: 'alias', label: 'alias' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['entry', 'big fanout'],
        ['edge', 'N+1 calls'],
        ['reuse', 'type guard'],
        ['filter', 'bad input'],
        ['rename', 'path mixup'],
      ],
    ),
    highlight: { active: ['root:role', 'field:role', 'arg:role'], compare: ['field:risk', 'alias:risk'] },
    explanation: 'The selection set is a tree-shaped data structure. It carries fields, nested selections, fragments, aliases, arguments, directives, and type conditions. The engine must preserve the requested response shape while deciding how to fetch data.',
  };

  yield {
    state: executionGraph('Resolvers run along the collected field plan', { plan: 'collect', res: 'field fn', batch: 'keys', store: 'sources', resp: 'JSON' }),
    highlight: { active: ['plan', 'res', 'batch', 'store', 'resp', 'e-plan-res', 'e-plan-batch', 'e-res-store', 'e-batch-store', 'e-store-resp'], found: ['valid'] },
    explanation: 'Each field delegates to a resolver. Resolvers may call services, databases, search indexes, caches, or other resolvers. The useful mental model is a work graph: the query tree determines response shape; the resolver graph determines how work is scheduled.',
  };

  yield {
    state: labelMatrix(
      'Err',
      [
        { id: 'syntax', label: 'syntax' },
        { id: 'schema', label: 'schema' },
        { id: 'auth', label: 'auth' },
        { id: 'null', label: 'null' },
        { id: 'cost', label: 'cost' },
      ],
      [
        { id: 'where', label: 'where' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['parse', 'no run'],
        ['valid', 'no run'],
        ['res', 'hide'],
        ['resp', 'bubble'],
        ['gate', 'cap'],
      ],
    ),
    highlight: { active: ['syntax:lesson', 'schema:lesson', 'cost:lesson'], compare: ['null:where'] },
    explanation: 'GraphQL errors are path-aware. A syntax or validation error blocks execution; a resolver error may produce a partial response with an error path. Non-null fields can bubble null upward, which makes nullability part of the data-structure contract.',
  };
}

function* resolverBatching() {
  yield {
    state: executionGraph('DataLoader-style batching turns field fanout into key sets', { plan: 'users.posts', res: 'per user', batch: 'post ids', store: 'one query', resp: 'nested' }),
    highlight: { active: ['plan', 'res', 'batch', 'store', 'e-plan-res', 'e-plan-batch', 'e-batch-store'], compare: ['e-res-store'] },
    explanation: 'The classic GraphQL performance bug is N+1 fetching: one resolver call loads a list, then one child resolver call per item loads related records. A request-scoped batch loader turns many small key lookups into one grouped lookup.',
  };

  yield {
    state: labelMatrix(
      'N1',
      [
        { id: 'plain', label: 'plain' },
        { id: 'batch', label: 'batch' },
        { id: 'cache', label: 'cache' },
        { id: 'scope', label: 'scope' },
      ],
      [
        { id: 'calls', label: 'calls' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['1 + N', 'p99 jump'],
        ['1 + 1', 'key order'],
        ['memo', 'stale leak'],
        ['per req', 'tenant leak'],
      ],
    ),
    highlight: { active: ['plain:calls', 'batch:calls', 'cache:calls'], compare: ['scope:risk'] },
    explanation: 'Batching is a data-structure move: collect keys, deduplicate them, issue a bulk fetch, then scatter results back to callers in the original key order. The cache should usually be request scoped so one tenant cannot read another tenant data from a shared loader.',
  };

  yield {
    state: executionGraph('Production execution adds cost, auth, cache, and trace state', { client: 'viewer', valid: 'policy', plan: 'cost', res: 'auth fn', batch: 'memo', store: 'SQL/API', resp: 'path errs' }),
    highlight: { active: ['valid', 'plan', 'res', 'batch', 'store', 'resp', 'e-valid-plan', 'e-plan-res', 'e-plan-batch', 'e-store-resp'], found: ['client'] },
    explanation: 'A production GraphQL server is not just a resolver tree. It needs depth and cost limits, authorization at the right boundary, request-scoped caches, per-field tracing, persisted query registries, and safe error formatting.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'feed', label: 'feed' },
        { id: 'shop', label: 'shop' },
        { id: 'dash', label: 'dash' },
        { id: 'cms', label: 'CMS' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['posts', 'ids'],
        ['cart', 'gate'],
        ['KPIs', 'pq'],
        ['blocks', 'frag'],
      ],
    ),
    highlight: { active: ['feed:fix', 'shop:fix', 'dash:fix', 'cms:fix'], compare: ['feed:shape'] },
    explanation: 'Complete case study: a dashboard query asks for viewer, teams, projects, incidents, owners, and cost totals. The execution plan validates the selection tree, checks viewer authorization, batches owner and incident lookups, applies cost limits, emits trace spans, and returns exactly the requested nested shape.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'selection tree') yield* selectionTree();
  else if (view === 'resolver batching') yield* resolverBatching();
  else throw new InputError('Pick a GraphQL execution view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'GraphQL is a typed query language and execution model for APIs. The client sends an operation with a selection set; the server validates it against a schema and executes resolvers to produce a response with the same shape. The data-structure lesson is that the request is a tree, but the work behind it is often a graph of services, caches, indexes, and authorization decisions.',
        'Primary sources: the GraphQL specification at https://spec.graphql.org/October2021/, the official execution guide at https://graphql.org/learn/execution/, and the validation guide at https://graphql.org/learn/validation/. GraphQL.js also has a practical resolver anatomy guide at https://www.graphql-js.org/docs/resolver-anatomy/.',
      ],
    },
    {
      heading: 'Selection tree and resolver graph',
      paragraphs: [
        'The visible structure is a selection tree: root fields, nested fields, fragments, aliases, arguments, directives, and type conditions. Execution collects the fields that apply, then invokes resolver functions. The response must mirror the requested tree, so aliases and paths are not cosmetic; they are how the client correlates returned data and errors.',
        'The hidden structure is a resolver dependency graph. A field may need SQL rows, document store objects, search results, remote RPC calls, feature flags, policy checks, or cached aggregates. That graph should connect to Database Indexing, Distributed Tracing, Cache Invalidation, and Rate Limiting rather than living as unobserved application code.',
      ],
    },
    {
      heading: 'Batching and the N plus 1 problem',
      paragraphs: [
        'The classic GraphQL failure mode is N plus 1 fetching. A list field returns N users, then a child field separately loads posts for each user. A DataLoader-style batcher collects keys during one execution turn, deduplicates them, performs a bulk lookup, and resolves each pending field in key order.',
        'That is a Hash Table and Queue lesson disguised as API design. The loader maps key to waiters, flushes a batch, and scatters results back. The cache should normally be request scoped. A process-global cache can leak authorization context, tenant boundaries, and stale values unless it is deliberately keyed and invalidated.',
      ],
    },
    {
      heading: 'Complete case study: product dashboard',
      paragraphs: [
        'A product analytics dashboard asks for viewer, organizations, projects, active incidents, owners, spend totals, and recent events. Without planning, the query fans out across identity, billing, incidents, search, and event stores. With an execution plan, the server validates the operation, estimates cost, checks viewer scope, batches owner and project IDs, sends trace spans per resolver group, and returns partial errors with paths if a noncritical service fails.',
        'The same dashboard links to several lessons in this repo. JSON Parser Stack explains parsing. Graph BFS and Topological Sort help explain field traversal and dependency scheduling. Schema Registry and OpenAPI Contract Evolution explain how API contracts become durable artifacts. Distributed Tracing makes resolver cost visible. Tail Latency explains why one slow child resolver can dominate the user experience.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'GraphQL is not automatically efficient. It gives clients shape control, which can accidentally give them cost control unless the server enforces depth, complexity, pagination, and persisted-query policy. It is also not an authorization model. Authorization has to be placed where data actually crosses trust boundaries, often inside or below resolvers rather than only at the top-level route.',
        'Errors also require discipline. A resolver can fail while the server still returns useful partial data. Non-null fields change that behavior by bubbling null upward. This means nullability, error paths, and client fallback logic are part of the contract, not incidental response formatting.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study JSON Parser Stack Case Study for parsing, Hash Table for request-scoped loader maps, Queue for batching, Graph BFS for traversal, Topological Sort for dependency planning, Database Indexing for backend access paths, Distributed Tracing for resolver visibility, Rate Limiter for API guardrails, and OpenAPI Contract Schema Evolution for a contrasting HTTP contract style.',
      ],
    },
  ],
};
