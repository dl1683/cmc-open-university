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
    explanation: 'An OpenAPI document is a graph of paths, operations, parameters, request bodies, responses, reusable schemas, security schemes, examples, and links. Tools can read that graph to produce docs, SDKs, tests, and gateway rules.',
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
    explanation: 'A contract gate compares the previous published spec with the proposed spec. It should detect changed paths, methods, parameters, request schemas, response schemas, status codes, auth requirements, and component references.',
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
      heading: 'What it is',
      paragraphs: [
        'The OpenAPI Specification describes HTTP APIs with a standard, machine-readable document. It models paths, operations, parameters, request bodies, responses, components, security, examples, callbacks, and links. A good OpenAPI file is not just prose; it is the source artifact for SDKs, docs, validators, mocks, gateways, and compatibility checks.',
        'Primary sources: the OpenAPI 3.2 specification at https://spec.openapis.org/oas/v3.2.0.html, the OpenAPI Initiative at https://www.openapis.org/, the Swagger-hosted specification reference at https://swagger.io/specification/, and Swagger docs for paths and operations at https://swagger.io/docs/specification/v3_0/paths-and-operations/.',
      ],
    },
    {
      heading: 'Contract graph',
      paragraphs: [
        'The document forms a graph. A path points to operations. Each operation points to parameters, request bodies, responses, security requirements, examples, and component schemas. Components are reusable definitions, so a single schema can affect many paths through references.',
        'This connects OpenAPI to many earlier lessons. JSON Parser Stack explains how the document is parsed. Schema Registry explains versioned schemas. Trie and Hash Table explain path and operation lookup. Distributed Tracing explains how a documented operation becomes an observable runtime span.',
      ],
    },
    {
      heading: 'Evolution gate',
      paragraphs: [
        'API evolution is a diff problem. Compare the previous published contract and the proposed contract, then classify each change. Additive response fields are usually compatible. Removing a field, changing a field type, removing a path, changing status codes, making an optional input required, or tightening an enum may break existing clients.',
        'The gate should run in CI before the spec is published. It should lint the document, resolve references, validate examples, regenerate SDKs, run contract tests, and block incompatible changes unless a major-version release path is explicit.',
      ],
    },
    {
      heading: 'Complete case study: payment API',
      paragraphs: [
        'A payment API publishes an OpenAPI contract used by web, mobile, partners, and internal services. A proposed change adds payment_method.display_name to a response, removes status_text from an older response, and makes customer_id required for refund creation. The compatibility gate allows the additive field but blocks the removal and new required input for the current major version.',
        'The release plan then becomes concrete: keep status_text as deprecated, accept missing customer_id by deriving it server-side for old clients, regenerate SDKs, update examples, run golden contract tests, and publish a deprecation window. The data structure is the spec graph; the engineering discipline is treating graph changes as client-facing migrations.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'OpenAPI is not automatically accurate. If implementation and contract drift, generated clients become a way to distribute wrong assumptions faster. Examples can also be misleading if they are not validated against schemas. A pretty documentation page is not proof that the API contract is enforceable.',
        'Compatibility is directional. Adding an optional request field is different from requiring a new request field. Adding an enum value can be safe for the server but unsafe for clients that switch exhaustively over known values. The gate needs rules that match real consumers, not only JSON Schema validity.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study JSON Parser Stack Case Study for parsing, Schema Registry Case Study for versioned schema governance, Protobuf Wire Format for a binary contract style, JSON Schema Constrained Decoding Token Mask for schema enforcement, Contract Net Agent Task Allocation for explicit task contracts, and Distributed Tracing for connecting contract operations to runtime evidence.',
      ],
    },
  ],
};
