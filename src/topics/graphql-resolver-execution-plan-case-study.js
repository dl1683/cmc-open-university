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
    explanation: 'The first animation step is intentionally before storage. GraphQL parses the operation, validates it against the schema, and collects the field tree so bad operations fail before resolver side effects begin.',
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
    explanation: 'The crossed-out mental model is one child resolver call per parent row. The batch loader collects those keys during the execution turn and turns N little backend trips into one grouped lookup.',
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
      heading: 'Why this exists',
      paragraphs: [
        `GraphQL exists because many clients need a shaped view of server data, and fixed REST endpoints often force a bad choice. One endpoint may underfetch and require follow-up calls. Another may overfetch and ship fields the screen does not need. A mobile app, dashboard, or CMS page wants to ask for a nested shape and receive that shape back.`,
        `The server still needs control. It must parse the request, validate it against a schema, execute resolver functions, enforce authorization, batch backend access, preserve response paths, and report errors in a way the client can understand. The request is a tree, but the work behind it is often a graph of databases, services, caches, indexes, policy checks, and traces.`,
        {type:`callout`, text:`GraphQL flexibility comes from splitting response shape from execution work: the query tree defines output, while the resolver plan controls batching, policy, and errors.`},
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The naive implementation treats every field resolver as an independent function that can call whatever backend it needs. The root resolver loads a list. Each child resolver loads its own children. Each nested object repeats the pattern. This is easy to write because it matches the shape of the schema.`,
        `The wall is the N plus 1 problem. A query asks for 50 projects and each project owner. The project resolver loads 50 projects, then the owner resolver runs 50 separate user lookups. Add incidents, comments, permissions, and cost totals, and one friendly query becomes a storm of backend calls.`,
        `The second wall is control. If the client can choose any nested shape, the client can accidentally choose expensive work. If authorization runs only at the top-level route, nested resolvers may leak fields. If errors are formatted without paths, the client cannot tell which part failed. A resolver tree without an execution plan is flexible, but it is also easy to abuse.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to separate response shape from work scheduling. The selection tree says what the response must look like. The execution plan says how to collect, authorize, batch, cache, trace, and assemble the data. Those are related, but they are not the same object.`,
        `GraphQL execution begins before resolvers run. The server parses the document, validates fields and selection sets against the schema, applies fragments and directives, groups fields by response key, and only then executes resolvers. Invalid operations should fail before side effects begin.`,
        `Batching turns field fanout into key sets. A DataLoader-style layer collects keys during an execution turn, deduplicates them, performs one bulk lookup, and scatters results back to waiting resolvers in the original key order. That is a queue and hash table inside the resolver system.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `A request starts as text. The parser builds an operation AST. Validation checks that requested fields exist on the relevant types, leaf fields are leaves, object fields have selection sets, fragment spreads are legal, arguments have valid shapes, and variables are used correctly. This stage rejects bad requests before resolver code performs work.`,
        `Execution then collects fields. Aliases matter because they define response keys. Fragments and type conditions matter because they decide which selections apply to which runtime object types. Directives can include or skip fields. The executor walks the grouped field set and calls the resolver for each field that should produce a value.`,
        `A resolver receives the parent object, field arguments, request context, and execution info. It may return a scalar, object, list, promise, or value that needs completion against the GraphQL type. Batch loaders sit beside resolvers: they collect keys, issue one lookup, and return results under the requested response paths.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The selection-tree visual proves the contract path. Client query, parse, validation, field collection, resolver execution, backend access, and response assembly are separate stages. The response node is not arbitrary JSON. It must mirror the operation's requested shape, including aliases and nested paths.`,
        `The resolver-batching visual proves the performance path. Direct resolver-to-store calls create backend fanout. The batch node changes the shape of the work: collect keys, deduplicate, fetch in bulk, and scatter results back. The visual also shows where cost limits, auth, cache scope, and tracing belong. They have to wrap the execution plan, not appear after the incident.`,
      ],
    },
    {
      heading: 'Batching and the N plus 1 problem',
      paragraphs: [
        `The N plus 1 problem is the most common GraphQL performance trap because the schema encourages local resolver code. A parent list returns N objects. A child field runs once per object. If each child resolver calls the backend separately, latency and load grow with the size of the list.`,
        `A batcher changes the unit of backend work. Instead of calling loadUser once for each project owner, each resolver calls a request-local loader. The loader records the key and returns a pending result. At the end of the execution turn, it sends one lookup for all collected keys, maps results back by key, and resolves each waiter.`,
        `The key order contract matters. If callers ask for IDs [7, 3, 7, 9], the batch function must return aligned values or scatter through a map. Request scope matters too. A shared process cache can leak data across users or serve stale data after a mutation, while a request-scoped loader deduplicates inside one operation and one authorization context.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `GraphQL execution works because the schema gives the executor a contract for every field. The server knows which fields exist, which arguments they accept, which type they return, and whether the result may be null. That type information lets validation reject impossible requests and lets execution complete returned values into the promised response shape.`,
        `Batching works because many sibling or nearby resolver calls ask for the same kind of backend object. The executor may see a tree, but the loader sees a set of keys. Turning many local calls into one grouped lookup preserves the response contract while changing backend access from repeated random work to a bulk operation.`,
        `Path-aware errors work because every field has a position in the response tree. A resolver failure can attach to a path such as viewer.projects.3.owner. Non-null fields change propagation: if a non-null child fails, null can bubble to the nearest nullable parent. That means nullability is part of the correctness contract, not just documentation.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `GraphQL trades endpoint sprawl for execution complexity. The client gets shape control. The server must provide cost control. Depth limits, node limits, query complexity estimates, pagination requirements, timeouts, persisted queries, and rate limits are common guardrails because a legal query can still be expensive.`,
        `Resolver abstraction can hide latency. One screen query may touch identity, billing, projects, incidents, search, and notifications. If each resolver looks small in isolation, the combined p95 or p99 can surprise the team. Distributed tracing and per-field metrics are necessary because the expensive part is often the composition, not one resolver.`,
        `Caching is subtle. Request-scoped loaders reduce duplicate work safely. Cross-request caches need invalidation, tenant-aware keys, and authorization-aware policy. Schema design is another cost: once clients depend on fields, aliases, nullability, and enum values, the schema becomes a contract with deprecation and usage-tracking needs.`,
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        `Imagine a product analytics dashboard that asks for viewer, organizations, projects, owners, active incidents, spend totals, feature flags, and recent events. Without planning, this single operation fans out across identity, billing, incidents, event storage, search, permissions, and cache layers.`,
        `A disciplined execution plan validates the operation, checks depth and complexity, requires pagination, creates request-scoped loaders, and carries viewer identity through context. Project IDs and owner IDs are batched. Incident lookups are grouped. Trace spans record resolver groups. If a nullable recent-events service fails, the response can include the rest of the dashboard plus a path-aware error.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first failure mode is assuming GraphQL is automatically efficient. A legal query can walk too deeply, ask for too many nodes, or trigger expensive joins. The second is misplaced authorization. Top-level auth may confirm login, but nested fields can cross tenant, organization, or object boundaries. Authorization belongs where the data is fetched or exposed.`,
        `The third failure mode is global loader state. A process-wide loader can mix authorization contexts or serve stale data after mutations. The fourth is schema drift. Clients build around nullable behavior, aliases, enum values, and partial errors. Changing those casually can break production clients even if the backend code still compiles.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study JSON Parser Stack for parsing, Hash Table for loader maps, Queue for batching, Graph BFS for traversal, Topological Sort for dependency planning, Database Indexing for backend access paths, Cache Invalidation for loader and response caches, Distributed Tracing for resolver visibility, Rate Limiter for guardrails, and OpenAPI Contract Evolution for a contrasting API style.`,
        `For primary references, read the GraphQL specification sections on validation and execution, the official GraphQL execution and validation guides, and the GraphQL.js guide to DataLoader and the N plus 1 problem. Then build a small resolver tree and instrument every backend call. The first time one query creates dozens of calls, the execution-plan lesson becomes concrete.`,
      ],
    },
  ],
};
