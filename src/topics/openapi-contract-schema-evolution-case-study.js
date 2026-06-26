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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation treats an OpenAPI document as a contract graph. A contract is a machine-readable promise about paths, methods, parameters, request bodies, response shapes, status codes, examples, and security rules. A graph means those objects point to one another through references.',
        'Active nodes are contract nodes being compared between old and new versions. Compare nodes are shared schemas or operations whose compatibility is being checked. Found nodes are safe additive changes. Removed nodes are client-visible breaks that must be blocked or versioned.',
        'The safe inference rule is directional. Adding an optional response field is usually safe for old clients because they can ignore it. Removing a response field or making an old optional request field required is unsafe because deployed clients can still depend on the old shape.',
        {type:'callout', text:'An OpenAPI contract is a dependency graph where schema edits must be diffed by client-visible compatibility rather than by line changes.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'OpenAPI exists because an HTTP API is not only server code. It is a public or internal contract used by clients, SDK generators, documentation, gateways, mocks, tests, and monitoring. If the contract is hidden in handler code, every consumer must infer behavior by trial and error.',
        'A schema is the part of the contract that describes data shape. It says which fields exist, which are required, which types are allowed, and which values are valid. Once clients generate code from that schema, changing a field becomes a migration problem.',
        'The practical need is release safety. A server can compile after a field rename while old mobile clients still parse the old field. Contract evolution asks which existing clients can observe the change, not whether the new server is internally tidy.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to write API documentation after implementation. Engineers change handlers, update examples when they remember, and rely on humans to notice risky edits in review. That can work for one team and one client.',
        'Another obvious approach is URL versioning alone. A team keeps /v1 stable in name but changes a response, narrows an enum, or adds a required request field. The URL did not change, but the generated client contract did.',
        'Both approaches confuse documentation with compatibility. A nice page can be stale. A green server test can still break a parser, an exhaustive switch, a gateway validator, or a partner integration.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is shared dependency. One component schema can be referenced by many operations. A small edit to Customer may change checkout, refund, search, export, and webhook payloads at once.',
        'Text diff is the wrong unit. YAML formatting, key order, and comments can change without affecting clients. A one-line schema edit can be a breaking change if it removes a required response field or changes amount from integer cents to decimal dollars.',
        'Compatibility is also consumer-specific. Adding an enum value is often safe for a loose JSON client but risky for a generated TypeScript or Java client with an exhaustive switch. Public APIs, mobile apps, and partner integrations need slower migration than controlled internal services.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Read the OpenAPI file as a graph of observable contract nodes. Paths point to operations. Operations point to parameters, request bodies, responses, security rules, examples, and schemas. $ref edges connect shared components to many operations.',
        'Schema evolution is graph diff plus policy. The diff finds which nodes changed. The policy classifies each change as safe, breaking, or review-required from the old client point of view. The release gate acts on that classification before the server ships.',
        'The strongest workflow treats the compatibility report as a build artifact. It should name the changed path or component, the old and new shape, the rule that allowed or blocked the change, and the migration action if needed.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A canonical OpenAPI document lives in the repository or contract registry. CI parses it, resolves references, validates schemas and examples, then compares the proposed document with the last published document. The comparison is structural, not line-based.',
        'The gate allows changes such as new endpoints, new optional request fields, new optional response fields, and additional examples. It blocks or requires versioning for removed endpoints, removed response fields, newly required inputs, type changes, response status removals, and stricter authentication.',
        'After the diff, the pipeline regenerates SDKs, runs contract tests, validates examples, and checks gateway rules. Runtime telemetry such as operation id, client version, validation failures, and status code can show whether deprecated shapes are still used.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation of old-client behavior. If every old request that was valid remains accepted, and every old response field that clients could read remains present with compatible type, then deployed clients keep working under the new server.',
        'Additive changes work because old clients ignore what they do not know, as long as they are tolerant readers. Breaking changes fail because old clients cannot send newly required data, parse changed types, or read removed fields.',
        'The graph view prevents hidden blast radius. If a shared component changes, the diff follows references to every affected operation. Reviewers see the consumer surface, not only the component file.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is process. Engineers must maintain schemas, operation ids, error envelopes, examples, compatibility policy, generated clients, and deprecation windows. That feels heavier than changing a handler directly.',
        'The behavior changes once the API has many clients. A blocked contract diff costs minutes in CI. A broken mobile release can cost weeks because old app versions remain installed. Contract discipline is a small fixed cost that prevents large recovery costs.',
        'Tooling cost grows with graph size. If 40 operations share 12 component schemas, a component edit may require a full affected-operation report. That cost is useful because it is the exact dependency structure clients already experience.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Public payment APIs use this pattern because partners and mobile clients cannot upgrade on the server team schedule. A compatibility gate can block a removed status_text field while allowing a new optional display_name field.',
        'Internal platform APIs also benefit when generated SDKs are common. The contract report can tell service owners whether a proposed change requires a major version, a dual-write period, a client migration, or only regenerated docs.',
        'Gateways use OpenAPI contracts for validation, routing, authentication, and documentation. When the spec and gateway drift apart, callers see behavior that neither docs nor server tests explain.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the spec is not tested against the implementation. A contract can be perfectly written and still false if the server accepts different fields or returns undocumented errors. Contract tests must compare real behavior with the published document.',
        'It fails when examples are not validated. Broken examples teach impossible requests and can be copied into SDK tests, docs, and partner code. Examples are part of the contract surface.',
        'It fails when policy is too generic. Enum additions, auth changes, rate-limit headers, error shapes, and stricter string formats can be safe in one domain and breaking in another. The gate needs domain rules, not only JSON Schema rules.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A payments API has 4,000 active mobile clients on /v1/refunds. The proposed spec adds payment_method.display_name to the refund response, removes status_text, and makes customer_id required in the refund request.',
        'The graph diff finds three changed nodes. The new response field is additive, so it passes. Removing status_text is blocked because old clients may display it. Making customer_id required is blocked because old clients send requests without it.',
        'The release plan becomes concrete. Keep status_text for 90 days, accept missing customer_id for old client versions, emit deprecation telemetry, regenerate SDKs, and publish a migration note. The gate turned a vague review debate into three client-visible decisions.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the OpenAPI Specification, JSON Schema documentation, Swagger tooling docs, and compatibility guidance from API design systems. Use the specification for object meanings and tooling docs for examples, validation, and generated-client behavior.',
        'Study JSON Schema for data contracts, Schema Registry for versioned compatibility policy, Protobuf Wire Format for binary evolution, Distributed Tracing for operation-level runtime evidence, and Backward Compatibility for migration design.',
      ],
    },
  ],
};
