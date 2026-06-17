// OpenAPI contracts: paths, operations, parameters, request bodies, responses,
// reusable schemas, generated clients, and compatibility gates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'openapi-contract-schema-evolution-case-study',
  title: 'OpenAPI Contract Schema Evolution Case Study',
  category: 'Systems',
  summary: 'A contract-first HTTP API primer: paths, operations, parameters, request bodies, responses, components, generated clients, diffs, and compatibility gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['contract graph', 'evolution gate'], defaultValue: 'contract graph' },
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

function contractGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'spec', label: 'spec', x: 0.65, y: 3.8, note: notes.spec ?? 'OAS' },
      { id: 'paths', label: 'paths', x: 2.1, y: 2.1, note: notes.paths ?? '/users' },
      { id: 'op', label: 'op', x: 2.1, y: 5.35, note: notes.op ?? 'GET' },
      { id: 'params', label: 'params', x: 4.0, y: 1.7, note: notes.params ?? 'query' },
      { id: 'body', label: 'body', x: 4.0, y: 3.8, note: notes.body ?? 'JSON' },
      { id: 'resp', label: 'resp', x: 4.0, y: 5.9, note: notes.resp ?? '200/4xx' },
      { id: 'schema', label: 'schema', x: 6.3, y: 3.8, note: notes.schema ?? '$ref' },
      { id: 'client', label: 'client', x: 8.9, y: 3.8, note: notes.client ?? 'SDK/test' },
    ],
    edges: [
      { id: 'e-spec-paths', from: 'spec', to: 'paths', weight: '' },
      { id: 'e-spec-op', from: 'spec', to: 'op', weight: '' },
      { id: 'e-paths-op', from: 'paths', to: 'op', weight: '' },
      { id: 'e-op-params', from: 'op', to: 'params', weight: '' },
      { id: 'e-op-body', from: 'op', to: 'body', weight: '' },
      { id: 'e-op-resp', from: 'op', to: 'resp', weight: '' },
      { id: 'e-params-schema', from: 'params', to: 'schema', weight: '' },
      { id: 'e-body-schema', from: 'body', to: 'schema', weight: '' },
      { id: 'e-resp-schema', from: 'resp', to: 'schema', weight: '' },
      { id: 'e-schema-client', from: 'schema', to: 'client', weight: '' },
    ],
  }, { title });
}

function evolutionGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'old', label: 'old', x: 0.75, y: 3.8, note: notes.old ?? 'v1' },
      { id: 'new', label: 'new', x: 2.35, y: 3.8, note: notes.new ?? 'v2' },
      { id: 'diff', label: 'diff', x: 4.0, y: 2.2, note: notes.diff ?? 'AST' },
      { id: 'compat', label: 'compat', x: 4.0, y: 5.45, note: notes.compat ?? 'rules' },
      { id: 'gate', label: 'gate', x: 5.95, y: 3.8, note: notes.gate ?? 'CI' },
      { id: 'sdk', label: 'SDK', x: 7.75, y: 2.2, note: notes.sdk ?? 'regen' },
      { id: 'tests', label: 'tests', x: 7.75, y: 5.45, note: notes.tests ?? 'contract' },
      { id: 'ship', label: 'ship', x: 9.25, y: 3.8, note: notes.ship ?? 'release' },
    ],
    edges: [
      { id: 'e-old-diff', from: 'old', to: 'diff', weight: '' },
      { id: 'e-new-diff', from: 'new', to: 'diff', weight: '' },
      { id: 'e-diff-compat', from: 'diff', to: 'compat', weight: '' },
      { id: 'e-compat-gate', from: 'compat', to: 'gate', weight: '' },
      { id: 'e-gate-sdk', from: 'gate', to: 'sdk', weight: '' },
      { id: 'e-gate-tests', from: 'gate', to: 'tests', weight: '' },
      { id: 'e-sdk-ship', from: 'sdk', to: 'ship', weight: '' },
      { id: 'e-tests-ship', from: 'tests', to: 'ship', weight: '' },
    ],
  }, { title });
}

function* contractGraphView() {
  yield {
    state: contractGraph('OpenAPI turns an HTTP API into a navigable contract'),
    highlight: { active: ['spec', 'paths', 'op', 'params', 'body', 'resp', 'e-spec-paths', 'e-spec-op', 'e-paths-op'], compare: ['schema', 'client'] },
    explanation: 'Read the spec as a graph, not a brochure. Paths lead to operations; operations point to inputs, responses, schemas, security, and examples. Tools can traverse that graph to generate docs, SDKs, tests, and gateway rules.',
  };

  yield {
    state: labelMatrix(
      'Spec',
      [
        { id: 'path', label: 'path' },
        { id: 'op', label: 'op' },
        { id: 'param', label: 'param' },
        { id: 'body', label: 'body' },
        { id: 'comp', label: 'comp' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'ds', label: 'DS' },
      ],
      [
        ['route', 'trie'],
        ['method', 'map'],
        ['input', 'schema'],
        ['payload', 'schema'],
        ['reuse', 'ref graph'],
      ],
    ),
    highlight: { active: ['path:ds', 'op:ds', 'comp:ds'], found: ['param:role', 'body:role'] },
    explanation: 'OpenAPI looks like documentation, but it is also a machine-readable data structure. Paths behave like a route trie, operations like keyed records, and components like a reference graph shared across operations.',
  };

  yield {
    state: contractGraph('Components make schemas reusable but create dependency edges', { schema: 'components', client: 'docs+SDK' }),
    highlight: { active: ['params', 'body', 'resp', 'schema', 'client', 'e-params-schema', 'e-body-schema', 'e-resp-schema', 'e-schema-client'], found: ['op'] },
    explanation: 'The components section stores reusable schemas, parameters, responses, examples, security schemes, and related objects. That reuse is powerful, but one schema change can affect every path that references it.',
  };

  yield {
    state: labelMatrix(
      'Gen',
      [
        { id: 'docs', label: 'docs' },
        { id: 'sdk', label: 'SDK' },
        { id: 'mock', label: 'mock' },
        { id: 'test', label: 'test' },
        { id: 'gw', label: 'gw' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['render', 'stale'],
        ['types', 'break'],
        ['ex', 'fake'],
        ['assert', 'thin'],
        ['policy', 'drift'],
      ],
    ),
    highlight: { active: ['sdk:risk', 'test:uses', 'gw:uses'], compare: ['docs:risk'] },
    explanation: 'The same OpenAPI contract often feeds human docs, generated clients, mocks, contract tests, schema validators, and gateway policies. That is why contract drift becomes a production problem, not a documentation problem.',
  };
}

function* evolutionGate() {
  yield {
    state: evolutionGraph('Schema evolution starts by diffing old and new contracts'),
    highlight: { active: ['old', 'new', 'diff', 'compat', 'e-old-diff', 'e-new-diff', 'e-diff-compat'], compare: ['gate'] },
    explanation: 'The gate starts with a structural diff, not a human skim. It compares old and new specs across paths, methods, parameters, request schemas, response schemas, status codes, auth requirements, and shared references.',
    invariant: 'Compatibility is about existing clients, not only whether the new server compiles.',
  };

  yield {
    state: labelMatrix(
      'Diff',
      [
        { id: 'add', label: 'add' },
        { id: 'rm', label: 'remove' },
        { id: 'req', label: 'req in' },
        { id: 'enum', label: 'enum' },
        { id: 'type', label: 'type' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['low', 'add ok'],
        ['high', 'major'],
        ['high', 'break'],
        ['med', 'clients'],
        ['high', 'break'],
      ],
    ),
    highlight: { active: ['add:rule', 'rm:risk', 'req:rule', 'type:rule'], compare: ['enum:risk'] },
    explanation: 'Adding an optional response field is usually safe. Removing a field, changing a type, narrowing an enum unexpectedly, or making an input required can break existing clients. The rule table is the heart of the gate.',
  };

  yield {
    state: evolutionGraph('The gate should regenerate clients and run contract tests', { diff: 'rules', compat: 'policy', gate: 'block?', sdk: 'typed SDK', tests: 'golden', ship: 'publish' }),
    highlight: { active: ['compat', 'gate', 'sdk', 'tests', 'ship', 'e-compat-gate', 'e-gate-sdk', 'e-gate-tests', 'e-sdk-ship', 'e-tests-ship'], found: ['diff'] },
    explanation: 'A useful gate does more than lint YAML. It regenerates typed clients, validates examples, runs compatibility checks, and executes contract tests against a mock or staging server before publishing the new spec.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'pay', label: 'pay' },
        { id: 'mobile', label: 'mobile' },
        { id: 'partner', label: 'partner' },
        { id: 'mesh', label: 'mesh' },
      ],
      [
        { id: 'change', label: 'change' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['add', 'allow'],
        ['req', 'block'],
        ['rm', 'major'],
        ['auth', 'review'],
      ],
    ),
    highlight: { active: ['pay:gate', 'mobile:gate', 'partner:gate', 'mesh:gate'], compare: ['mobile:change'] },
    explanation: 'Complete case study: a payment API adds payment_method.display_name, removes status_text, and makes customer_id required on a refund request. The gate allows the additive response field, blocks the removed response field and new required input, regenerates SDK types, and forces a major-version release plan.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'contract graph') yield* contractGraphView();
  else if (view === 'evolution gate') yield* evolutionGate();
  else throw new InputError('Pick an OpenAPI contract view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'OpenAPI exists because an HTTP API is more than server code. It is a contract between callers, servers, documentation, generated clients, test suites, gateways, and operators. A path, method, request body, response schema, status code, authentication rule, and example all shape what clients believe they can send and receive. If that contract lives only in prose or in scattered handler code, every consumer has to infer behavior from implementation details.',
        'A good OpenAPI document makes the contract machine-readable. It describes paths, operations, parameters, request bodies, responses, schemas, security, examples, callbacks, and reusable components. Tools can then generate SDKs, render docs, validate requests, build mocks, run contract tests, and check compatibility before a release. The practical reason is simple: once many clients depend on an API, changing a field is a migration problem, not just a code change.',
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The naive approach is to treat the API contract as documentation written after implementation. Engineers ship server behavior, then update a page when they remember. This fails because generated clients, mobile applications, partner integrations, and internal services need a stable contract before humans read release notes. A pretty documentation page can be stale. A handler that passes server tests can still break old clients.',
        'Another naive approach is to version only by URL and ignore compatibility inside a version. A team may keep `/v1` but remove a response field, make an optional request field required, or narrow an enum. From the server view, the change may look clean. From the client view, a parser breaks, a generated type no longer matches, or an exhaustive switch falls into an error path. Compatibility is about deployed consumers, not only about whether the new server compiles.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to read an OpenAPI file as a graph. The root document points to paths. Each path points to operations such as GET, POST, or DELETE. Each operation points to parameters, request bodies, response objects, security rules, examples, and schemas. Components create reusable schema nodes, and `$ref` edges connect those nodes to many operations. This graph structure is why one schema edit can affect several client surfaces at once.',
        'Schema evolution is a graph diff problem. The safe question is not "what lines changed?" It is "which published contract nodes changed, which consumers can observe those changes, and are the changes compatible with existing clients?" Adding an optional response field is usually safe because old clients can ignore it. Removing a response field is risky because old clients may read it. Making a request field required is risky because old clients will omit it. Changing a type is almost always a breaking change.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'A contract workflow starts with a canonical spec in the repository or contract registry. CI parses it, resolves references, validates schemas, checks examples, and compares the proposed spec with the last published spec. The diff should be structural, not text-only. YAML formatting changes do not matter. Removing a path, changing a response schema, adding a required parameter, changing auth requirements, or altering a shared component can matter a lot.',
        'The compatibility gate classifies each diff under policy. It can allow additive response fields, new optional request fields, new endpoints, and additional examples. It can block removed fields, removed endpoints, type changes, newly required inputs, response status removals, and unexpected enum narrowing. It can mark some changes as review-only, such as authentication changes, rate-limit headers, or new enum values that may break clients with strict switches.',
        'A useful gate then exercises the artifacts that depend on the graph. It regenerates typed SDKs, validates that examples match schemas, runs contract tests against a mock or staging server, checks gateway rules, and publishes a compatibility report. The report should say what changed, why it is allowed or blocked, and which paths or components are affected. This makes API evolution a build artifact instead of a meeting debate.',
        'Runtime evidence closes the loop. Gateways and services can log operation ids, status codes, validation failures, and client versions. That data tells maintainers which endpoints are still used, which clients send deprecated shapes, and whether a planned removal is safe. Without usage evidence, deprecation windows are guesses. With usage evidence, the contract graph can be tied to real consumers.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The contract-graph view proves that a path and method do not stand alone. They depend on input schemas, output schemas, response codes, examples, security, and reusable components. The same component can be referenced by many operations, which is efficient until a careless edit changes every operation that uses it. The data-structure lesson is reference management: reuse creates dependency edges, and dependency edges create migration risk.',
        'The evolution-gate view proves that compatibility is directional. Old spec and new spec feed a diff. The diff feeds rules. The rules feed a gate that either allows the release, blocks it, or forces a versioned migration plan. This is stronger than a human skim because it applies the same policy every time and produces a report that downstream teams can inspect.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'OpenAPI does not guarantee truth by existing. If handlers drift from the spec, generated clients distribute wrong assumptions faster. If examples are not validated, docs can teach impossible requests. If a gateway enforces one schema and the service accepts another, the contract is split across systems. Contract-first work requires a feedback loop: tests should prove that implementation behavior still matches the published spec.',
        'Compatibility rules also need domain knowledge. Adding an enum value may be legal for the server but dangerous for clients that switch over known values. Removing a field from an error response can break retry logic. Tightening a string format can break callers even when JSON Schema accepts the new rule. Different consumers have different tolerance. A public partner API, a mobile app with slow upgrade cycles, and an internal service controlled by one team do not carry the same migration risk.',
      ],
    },
    {
      heading: 'Real uses and failure modes',
      paragraphs: [
        'A payment API shows the pattern. The current contract is used by web, mobile, partners, and internal services. A proposed change adds `payment_method.display_name` to a response, removes `status_text`, and makes `customer_id` required on refund creation. The gate allows the additive response field, blocks the removed response field, and blocks the new required input for the current major version. The release plan becomes concrete: keep `status_text` deprecated, accept missing `customer_id` for old clients, regenerate SDKs, update examples, and publish a deprecation window.',
        'Failure modes cluster around drift and ownership. A team can change implementation without updating the spec. Another team can update the spec without proving the server implements it. A shared component can change more operations than intended. Generated SDKs can lag behind the published contract. A compatibility gate can be bypassed for urgent releases and then become ceremonial. The defense is to make the spec, generated artifacts, compatibility report, examples, and contract tests part of the same release pipeline.',
      ],
    },
    {
      heading: 'Costs, tradeoffs, and next study',
      paragraphs: [
        'The cost of OpenAPI discipline is process and tooling. Engineers must maintain schemas, examples, operation ids, error shapes, version policy, and generated artifacts. Spec reviews can feel slower than changing handlers directly. The payoff arrives when the API has multiple clients: fewer surprise breaks, safer SDK generation, clearer docs, better gateway validation, and a repeatable way to tell additive change from breaking change.',
        'The tradeoff is also cultural. Teams must agree that the published contract is a product surface, not a side file. That means naming operation ids carefully, documenting error envelopes, preserving old behavior during deprecation windows, and treating compatibility failures as real release blockers. The discipline is heavier than informal HTTP, but it is lighter than repairing broken clients after release.',
        'Study JSON Parser Stack Case Study for parsing, Schema Registry Case Study for versioned schema governance, Protobuf Wire Format for a binary contract style, JSON Schema Constrained Decoding Token Mask for schema enforcement, Contract Net Agent Task Allocation for explicit task contracts, and Distributed Tracing for connecting contract operations to runtime evidence. Primary external references are the OpenAPI Specification, OpenAPI Initiative materials, and Swagger documentation for paths, operations, schemas, and reusable components.',
      ],
    },
  ],
};
