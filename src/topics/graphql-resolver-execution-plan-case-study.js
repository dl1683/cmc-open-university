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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the query as a tree of requested response fields, then read the execution plan as the work graph that produces those fields. The tree defines shape, while resolvers, loaders, authorization checks, caches, and backend calls define behavior.',
        'The safe inference is that a nested field is not free because it looks local in the schema. If fifty parent objects each call a child resolver separately, one clean query can turn into fifty backend lookups.',
        {type:'callout', text:'GraphQL flexibility comes from splitting response shape from execution work: the query tree defines output, while the resolver plan controls batching, policy, and errors.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'GraphQL lets clients ask for a shaped response instead of choosing from fixed endpoints. A mobile screen can request exactly the nested fields it needs without overfetching a large REST payload or underfetching and making follow-up calls.',
        'The resolver execution plan exists because server control still matters. The server must validate the request, enforce schema and authorization rules, batch backend access, preserve response paths, and return partial errors safely.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious implementation makes every field resolver a small function. The project resolver returns projects, the owner resolver loads an owner, and the comments resolver loads comments.',
        'That feels natural because it mirrors the schema. It fails when many local-looking resolvers call databases, services, or caches independently inside one request.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the N plus 1 problem. A query loads fifty projects, then each project.owner field performs one user lookup, so one list query becomes fifty-one backend calls before other child fields are counted.',
        'A second wall is policy. If authorization, depth limits, pagination, and cost checks are not part of the execution plan, a valid-looking query can become expensive or leak nested data across tenant boundaries.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate response shape from work scheduling. The GraphQL operation says what the JSON response should look like, while the execution plan decides how to validate, authorize, batch, cache, trace, and assemble the result.',
        'Batching changes the unit of backend work. Instead of resolving owner one project at a time, request-scoped loaders collect owner IDs, deduplicate them, fetch them in bulk, and scatter results back to the original response paths.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The server parses the query text into an abstract syntax tree. Validation checks field names, argument types, fragments, directives, variables, leaf selections, object selections, and schema rules before side effects begin.',
        'Execution groups fields by response key, handles aliases and fragments, and calls resolvers with parent value, arguments, request context, and execution info. Resolvers may return scalars, objects, lists, promises, or errors.',
        'A DataLoader-style queue records keys during an execution turn. At the batch boundary, it performs one bulk lookup, aligns results by key, and resolves the waiting field promises under their original paths.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Validation works because the schema is a contract for every field. The executor knows which fields exist, which arguments are allowed, which type each resolver must complete, and whether null is permitted.',
        'Batching is correct when the loader preserves key identity and response path. If callers request user IDs [7, 3, 7, 9], the batch may fetch unique IDs [7, 3, 9], but it must return the right user to each waiting resolver.',
        'Path-aware errors are also part of correctness. A failure at viewer.projects.3.owner can be reported at that path, and non-null rules decide whether null bubbles to a parent or only that field is absent.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'GraphQL moves cost from endpoint count to execution planning. Depth limits, node limits, timeouts, persisted queries, pagination, rate limits, and query complexity estimates are needed because a legal query can still be too expensive.',
        'The cost behavior is multiplicative when resolver fanout is uncontrolled. Fifty projects times three nested backend fields can produce 150 child lookups, while one batched plan can reduce that to three bulk calls.',
        'Caching is subtle because authorization is part of the key. A request-scoped loader is usually safe, while a process-wide loader can leak tenant data or serve stale values after mutations.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits product dashboards, mobile APIs, CMS pages, developer platforms, analytics consoles, and admin tools where clients need shaped nested data. It is especially useful when the same backend objects appear in many UI shapes.',
        'Resolver planning also supports observability. Per-field tracing can show whether latency comes from identity, billing, search, permissions, incidents, or a single expensive nested field.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams assume GraphQL is automatically efficient. The schema may be elegant while a single query walks too deeply, returns too many nodes, or triggers expensive joins behind friendly field names.',
        'It also fails when authorization is only checked at the top level. Nested fields often cross object, organization, or tenant boundaries, so the policy must be enforced where data is fetched or exposed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A dashboard asks for 50 projects with each owner, last incident, and monthly spend. The naive plan does one project list call, then 50 owner calls, 50 incident calls, and 50 billing calls, for 151 backend calls.',
        'A planned execution uses three request-scoped loaders. It fetches the 50 projects once, batches unique owner IDs into one user call, batches project IDs into one incident call, and batches project IDs into one billing call, for four backend calls.',
        'If each backend round trip is 20 ms and the naive calls serialize by field group, the child work alone can cost about 3,000 ms. With batching, three 20 ms bulk calls can run in parallel after the project list, so the same shape can complete near tens of milliseconds plus backend processing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references are the GraphQL specification at https://spec.graphql.org/, GraphQL execution guidance at https://graphql.org/learn/execution/, GraphQL validation guidance at https://graphql.org/learn/validation/, and GraphQL.js DataLoader material at https://www.graphql-js.org/docs/n1-dataloader/. These define the request, validation, and execution contracts.',
        'Study parser stacks, ASTs, queues, hash tables, batching, database indexes, cache invalidation, distributed tracing, rate limiters, and API contract evolution next. The practical exercise is to instrument one resolver tree and count backend calls before and after batching.',
      ],
    },
  ],
};
