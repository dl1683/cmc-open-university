// OPA/Rego: policy-as-code as a decision graph over structured input,
// data documents, rules, bundles, enforcement points, and audit traces.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'opa-rego-policy-decision-graph',
  title: 'OPA Rego Policy Decision Graph',
  category: 'Security',
  summary: 'A policy-as-code primer: structured input, data documents, Rego rules, partial decisions, bundles, enforcement points, explain traces, and audit records.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['decision graph', 'policy bundle lifecycle'], defaultValue: 'decision graph' },
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

function decisionGraph(title) {
  return graphState({
    nodes: [
      { id: 'pep', label: 'PEP', x: 0.8, y: 4.0, note: 'enforce' },
      { id: 'input', label: 'input', x: 2.4, y: 2.4, note: 'JSON' },
      { id: 'data', label: 'data', x: 2.4, y: 5.6, note: 'facts' },
      { id: 'rego', label: 'Rego', x: 4.3, y: 4.0, note: 'rules' },
      { id: 'eval', label: 'eval', x: 6.0, y: 4.0, note: 'query' },
      { id: 'decision', label: 'decision', x: 7.7, y: 4.0, note: 'allow/deny' },
      { id: 'trace', label: 'trace', x: 9.1, y: 2.4, note: 'explain' },
      { id: 'audit', label: 'audit', x: 9.1, y: 5.6, note: 'record' },
    ],
    edges: [
      { id: 'e-pep-input', from: 'pep', to: 'input' },
      { id: 'e-input-rego', from: 'input', to: 'rego' },
      { id: 'e-data-rego', from: 'data', to: 'rego' },
      { id: 'e-rego-eval', from: 'rego', to: 'eval' },
      { id: 'e-eval-decision', from: 'eval', to: 'decision' },
      { id: 'e-decision-pep', from: 'decision', to: 'pep' },
      { id: 'e-eval-trace', from: 'eval', to: 'trace' },
      { id: 'e-decision-audit', from: 'decision', to: 'audit' },
    ],
  }, { title });
}

function bundleGraph(title) {
  return graphState({
    nodes: [
      { id: 'repo', label: 'policy repo', x: 0.7, y: 4.0, note: 'Rego' },
      { id: 'test', label: 'tests', x: 2.4, y: 2.4, note: 'cases' },
      { id: 'build', label: 'bundle', x: 2.4, y: 5.6, note: 'package' },
      { id: 'sign', label: 'sign', x: 4.1, y: 4.0, note: 'digest' },
      { id: 'dist', label: 'distribute', x: 5.9, y: 4.0, note: 'control plane' },
      { id: 'cache', label: 'cache', x: 7.5, y: 2.4, note: 'local OPA' },
      { id: 'serve', label: 'serve', x: 7.5, y: 5.6, note: 'sidecar/lib' },
      { id: 'metric', label: 'metrics', x: 9.1, y: 4.0, note: 'drift' },
    ],
    edges: [
      { id: 'e-repo-test', from: 'repo', to: 'test' },
      { id: 'e-repo-build', from: 'repo', to: 'build' },
      { id: 'e-test-sign', from: 'test', to: 'sign' },
      { id: 'e-build-sign', from: 'build', to: 'sign' },
      { id: 'e-sign-dist', from: 'sign', to: 'dist' },
      { id: 'e-dist-cache', from: 'dist', to: 'cache' },
      { id: 'e-cache-serve', from: 'cache', to: 'serve' },
      { id: 'e-serve-metric', from: 'serve', to: 'metric' },
    ],
  }, { title });
}

function* decisionGraphView() {
  yield {
    state: decisionGraph('OPA decouples policy decision from enforcement'),
    highlight: { active: ['pep', 'input', 'rego', 'e-pep-input', 'e-input-rego'], compare: ['decision'] },
    explanation: 'A policy enforcement point asks OPA a structured question. The service still enforces the result, but policy logic moves into Rego rules evaluated over input and data.',
  };
  yield {
    state: decisionGraph('Input plus data documents feed declarative rules'),
    highlight: { active: ['input', 'data', 'rego', 'e-input-rego', 'e-data-rego'], found: ['eval'] },
    explanation: 'Rego reasons over JSON-like input and data. Input is request-specific. Data contains policy facts such as roles, allowed registries, trusted builders, risk tiers, or network metadata.',
    invariant: 'Policy is a query over structured data, not scattered if statements.',
  };
  yield {
    state: labelMatrix(
      'Decision shapes',
      [
        { id: 'allow', label: 'allow' },
        { id: 'deny', label: 'deny' },
        { id: 'reasons', label: 'reasons' },
        { id: 'filter', label: 'filter' },
        { id: 'score', label: 'score' },
      ],
      [
        { id: 'type', label: 'output type' },
        { id: 'use', label: 'use' },
      ],
      [
        ['boolean', 'admit request'],
        ['set/list', 'explain blocks'],
        ['strings', 'audit and UI'],
        ['query result', 'data filtering'],
        ['number/object', 'risk routing'],
      ],
    ),
    highlight: { active: ['allow:type', 'deny:use', 'reasons:use'], compare: ['score:type'] },
    explanation: 'OPA decisions do not have to be only true or false. Policies can return structured outputs: deny reasons, filtered data, required approvals, or risk metadata.',
  };
  yield {
    state: decisionGraph('Explain traces make policy debuggable'),
    highlight: { active: ['eval', 'trace', 'audit', 'e-eval-trace', 'e-decision-audit'], found: ['decision'] },
    explanation: 'Policy-as-code needs observability. Store the input shape, policy bundle version, decision id, result, and important reasons without leaking secrets.',
  };
}

function* policyBundleLifecycle() {
  yield {
    state: bundleGraph('Policy changes need the same discipline as code changes'),
    highlight: { active: ['repo', 'test', 'build', 'e-repo-test', 'e-repo-build'], compare: ['dist'] },
    explanation: 'Policy-as-code is code. It should live in reviewable files, have fixtures, run tests, and produce a bundle that can be promoted through environments.',
  };
  yield {
    state: bundleGraph('Bundles should be signed or otherwise pinned'),
    highlight: { active: ['build', 'sign', 'dist', 'e-build-sign', 'e-sign-dist'], found: ['test'] },
    explanation: 'The bundle is executable authorization logic. Treat it like a supply-chain artifact: identify it by digest, sign it when appropriate, and know which services consumed which version.',
  };
  yield {
    state: bundleGraph('Local caches avoid one central policy bottleneck'),
    highlight: { active: ['dist', 'cache', 'serve', 'e-dist-cache', 'e-cache-serve'], compare: ['repo'] },
    explanation: 'OPA can run as a sidecar, host-local daemon, embedded library, or centralized service. Local policy caches improve latency and resilience, but stale bundle behavior must be explicit.',
  };
  yield {
    state: labelMatrix(
      'Policy lifecycle hazards',
      [
        { id: 'input', label: 'input drift' },
        { id: 'bundle', label: 'bundle drift' },
        { id: 'data', label: 'data drift' },
        { id: 'shadow', label: 'shadow mode' },
        { id: 'break', label: 'break glass' },
      ],
      [
        { id: 'failure', label: 'failure' },
        { id: 'control', label: 'control' },
      ],
      [
        ['field missing', 'schema tests'],
        ['old decision', 'version pin'],
        ['stale facts', 'ttl/source'],
        ['surprise deny', 'dry run'],
        ['policy outage', 'audit path'],
      ],
    ),
    highlight: { active: ['input:control', 'bundle:control', 'shadow:control'], compare: ['break:failure'] },
    explanation: 'The hard problems are schema stability, data freshness, rollout, and incident behavior. A correct rule in the wrong bundle or data version can still make the wrong decision.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'decision graph') yield* decisionGraphView();
  else if (view === 'policy bundle lifecycle') yield* policyBundleLifecycle();
  else throw new InputError('Pick an OPA/Rego view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Open Policy Agent is a general-purpose policy engine. Rego is its declarative policy language. The data-structure view is a decision graph: a service provides structured input, OPA combines it with data documents and rules, evaluates a query, and returns a structured decision to the enforcement point.',
        'OPA documentation describes OPA as decoupling policy decision-making from policy enforcement and accepting arbitrary structured data as input: https://www.openpolicyagent.org/docs. The Rego policy-language docs describe rules over structured data and note the Datalog influence: https://www.openpolicyagent.org/docs/policy-language.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'The policy graph has nodes for input, data, modules, rules, query, decision, reasons, bundle version, enforcement point, and audit record. Edges express reads-from, evaluates, returns, enforces, and records. The model is close to a database query planner, but the result controls security or compliance behavior.',
        'OPA fits between Zanzibar Authorization Case Study and LLM Guardrail Policy Engine. Zanzibar gives a specialized relationship-authorization graph. OPA gives a domain-general policy evaluator. Guardrails can call a policy engine to decide whether a model-proposed action should proceed.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Kubernetes admission controller receives a pod creation request. The enforcement point sends OPA input containing image, namespace, labels, user, requested capabilities, and resource limits. Rego rules check that the image registry is approved, privileged mode is false, required labels are present, and the namespace policy allows the user. The decision returns allow=false plus denial reasons if any rule fails.',
        'A supply-chain gate can use the same shape. Input contains artifact digest, signer, builder id, source repo, and attestation summary. Data contains trusted builders and allowed repos. Rego evaluates whether the Software Supply Chain Provenance Graph satisfies policy. The service enforces the decision and records the bundle version for audit.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Policy-as-code is not magic centralization. Enforcement points must actually enforce decisions, pass complete input, handle failure modes, and record enough context to debug results. A policy that assumes an input field exists may silently allow or deny incorrectly if the service schema drifts.',
        'Another trap is treating policy bundles as static configuration. They are executable decision logic. They need code review, tests, versioning, staged rollout, metrics, and incident controls. Rego readability matters because policy bugs become production authorization bugs.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OPA overview at https://www.openpolicyagent.org/docs, Rego policy language at https://www.openpolicyagent.org/docs/policy-language, OPA policy testing at https://www.openpolicyagent.org/docs/policy-testing, and OPA policy performance at https://www.openpolicyagent.org/docs/policy-performance. Study Zanzibar Authorization Case Study, OAuth PKCE Token Lifecycle Case Study, LLM Guardrail Policy Engine, Software Supply Chain Provenance Graph, SLSA Build & Source Trust Ladder, Kubernetes Admission Policy Gate, Distributed Tracing, Hash Table, and JSON-RPC Protocol Case Study next.',
      ],
    },
  ],
};
