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
  const nodeCount = 8;
  const edgeCount = 8;
  const pipelineStages = ['PEP', 'input', 'data', 'Rego', 'eval', 'decision', 'trace', 'audit'];
  yield {
    state: decisionGraph('OPA decouples policy decision from enforcement'),
    highlight: { active: ['pep', 'input', 'rego', 'e-pep-input', 'e-input-rego'], compare: ['decision'] },
    explanation: `The policy enforcement point sends OPA a structured question at the moment it needs a decision. The full decision graph has ${nodeCount} nodes spanning ${pipelineStages.length} pipeline stages, but the service still enforces the result while Rego centralizes rule logic.`,
  };
  yield {
    state: decisionGraph('Input plus data documents feed declarative rules'),
    highlight: { active: ['input', 'data', 'rego', 'e-input-rego', 'e-data-rego'], found: ['eval'] },
    explanation: `Rego evaluates JSON-like input against data documents across ${edgeCount} edges in the decision graph. Input is the current request; data holds slower-changing facts such as roles, allowed registries, trusted builders, risk tiers, or network metadata.`,
    invariant: `Policy is a query over ${nodeCount} structured-data nodes, not scattered if statements.`,
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
    explanation: `OPA supports ${5} distinct decision types beyond simple allow or deny. A policy can return deny reasons, filtered data, required approvals, risk scores, or routing metadata that the enforcement point knows how to use.`,
  };
  yield {
    state: decisionGraph('Explain traces make policy debuggable'),
    highlight: { active: ['eval', 'trace', 'audit', 'e-eval-trace', 'e-decision-audit'], found: ['decision'] },
    explanation: `A policy decision must be explainable after the incident. The ${pipelineStages[pipelineStages.length - 2]} and ${pipelineStages[pipelineStages.length - 1]} nodes capture the input shape, policy bundle version, decision id, result, and important reasons while avoiding secret leakage.`,
  };
}

function* policyBundleLifecycle() {
  const lifecycleStages = ['repo', 'test', 'build', 'sign', 'dist', 'cache', 'serve', 'metric'];
  const stageCount = lifecycleStages.length;
  const deploymentModes = ['sidecar', 'host-local daemon', 'embedded library', 'centralized service'];
  yield {
    state: bundleGraph('Policy changes need the same discipline as code changes'),
    highlight: { active: ['repo', 'test', 'build', 'e-repo-test', 'e-repo-build'], compare: ['dist'] },
    explanation: `Policy-as-code is production code. The bundle lifecycle spans ${stageCount} stages from repo to metrics, and each stage should live in reviewable files, use fixtures, run tests, and build a bundle that can be promoted through environments.`,
  };
  yield {
    state: bundleGraph('Bundles should be signed or otherwise pinned'),
    highlight: { active: ['build', 'sign', 'dist', 'e-build-sign', 'e-sign-dist'], found: ['test'] },
    explanation: `The bundle is executable authorization logic passing through ${lifecycleStages[2]}, ${lifecycleStages[3]}, and ${lifecycleStages[4]}. Treat it like a supply-chain artifact: identify it by digest, sign it when appropriate, and know which services consumed which version.`,
  };
  yield {
    state: bundleGraph('Local caches avoid one central policy bottleneck'),
    highlight: { active: ['dist', 'cache', 'serve', 'e-dist-cache', 'e-cache-serve'], compare: ['repo'] },
    explanation: `OPA can run in ${deploymentModes.length} modes: ${deploymentModes.join(', ')}. Local caches avoid a central bottleneck, but every service needs an explicit stale-bundle policy.`,
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
    explanation: `The matrix lists ${5} lifecycle hazards across the ${stageCount}-stage pipeline. The hard problems are schema stability, data freshness, rollout, and incident behavior. A correct rule in the wrong bundle or data version can still make the wrong decision.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the decision graph as a request path. The policy enforcement point, or PEP, sends structured input to OPA; OPA evaluates Rego rules with input and data documents; the decision returns to the PEP for enforcement. Active nodes show the current boundary, and audit nodes show what must be retained for replay.',
        'Read the bundle lifecycle as the control plane for policy code. Rego files move through tests, bundle build, digest or signature, distribution, local cache, serving, and metrics. A safe inference is that a correct rule in a stale bundle can still make the wrong decision.',
        {type: 'callout', text: 'OPA turns authorization into a replayable data query: input, data, rules, decision, and enforcement all have named boundaries.'},
        {type: 'image', src: 'https://developer.gs.com/blog/blog-posts/scaling-opa-through-oces/oces_1_v2.png', alt: 'Open Policy Agent policy decision point in a service request path', caption: 'OPA separates the policy decision point from the application code that enforces the result. Source: Goldman Sachs Developer Blog.'},
        {type: 'image', src: './assets/gifs/opa-rego-policy-decision-graph.gif', alt: 'Animated walkthrough of the opa rego policy decision graph visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Authorization rules often spread through request handlers, deployment scripts, CI checks, firewall rules, and emergency exceptions. Each local check may be understandable, but the organization loses one reviewable policy surface. When an auditor asks why a request was allowed, engineers reconstruct behavior from scattered code.',
        'Open Policy Agent, or OPA, exists to separate policy decisions from enforcement. Rego is the declarative policy language used by OPA. The caller still enforces the answer, but the policy logic becomes a query over named input and data instead of hidden branches across services.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to put policy beside the operation. An API handler checks tenant ownership, a deploy script checks image registry, and a CI job checks approvals. For one service with one team, that direct style is fast and understandable.',
        'This approach works until the same rule must be shared across many services. One caller sends image, another sends container_image, and another forgets the digest. A deny rule lands in one repository but not another, and the incident trail has no single policy version to replay.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is invariant loss. A policy is supposed to mean the same thing wherever it is enforced, but application-local checks drift with schema changes, ownership changes, exceptions, and partial rollouts. Security bugs usually come from one forgotten path, not from the main path everyone reviewed.',
        'Central policy creates a second wall: OPA can only decide from the input and data it receives. If the enforcement point omits a field, ignores a denial, falls open on timeout, or uses stale data, the rule can be correct while the system is unsafe. The enforcement boundary is part of the design.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A directed graph is the right mental model for policy evaluation: input facts feed derived facts, and derived facts feed decisions. Source: Wikimedia Commons, David W., public domain.'},
        'The core insight is that a policy decision is a data query. Input describes the current request: subject, action, resource, environment, and metadata. Data documents describe slower-changing facts such as roles, groups, approved registries, trusted builders, risk tiers, or namespace labels.',
        'Rego rules derive facts from those documents and return a decision shape. That shape can be a boolean allow, deny reasons, filtered data, required approvals, risk scores, or routing metadata. The useful mental model is a decision graph from facts to derived facts to enforceable result.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At request time, the PEP builds an input document and asks OPA a query. OPA evaluates loaded Rego modules against input and data, then returns the result. The caller must know exactly which result schema it asked for and how to apply it.',
        'Policies are usually packaged as bundles for production. A bundle contains Rego modules and optional data, moves through tests, receives a digest or signature, and is distributed to OPA instances. Decision logs should include decision id, bundle version, selected input shape, result, and reasons without leaking secrets.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Decision_tree_model.png', alt: 'Decision tree diagram with branch conditions and outcomes', caption: 'A decision tree is not Rego, but it makes the policy shape visible: branch over facts, produce a constrained outcome, then enforce it. Source: Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'OPA works when the policy boundary is explicit. Rules read declared input, declared data, and declared helper rules rather than arbitrary application state. That makes policies testable with fixtures and replayable after incidents.',
        'Correctness is a contract across two sides. The policy must compute the intended decision from its documents, and the PEP must enforce that decision consistently. If both contracts hold, the same input and bundle version reproduce the same result.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'OPA adds request latency, input-schema maintenance, policy tests, bundle distribution, cache freshness, logs, and ownership. The main cost is usually not Rego syntax; it is keeping input contracts stable and making every enforcement point handle deny, timeout, stale bundle, and break-glass behavior deliberately.',
        'Deployment shape changes cost. Sidecars and embedded libraries keep decisions local but require cache and rollout management per service. A central service is easier to observe but can become a critical-path dependency and a bottleneck.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'OPA fits Kubernetes admission control, API authorization, infrastructure-as-code checks, CI gates, software supply-chain policy, service-mesh authorization, data filtering, and model-action guardrails. It is strongest when many components need the same reviewable policy and decisions need audit context.',
        'A common production pattern is a supply-chain gate. Input contains artifact digest, signer, source repository, builder id, branch, and attestation summary. Data contains trusted builders and allowed repositories, and Rego returns allow or a set of deny reasons.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'OPA fails when enforcement is optional. If a service can bypass the policy call, ignore a denial, or fail open without an explicit risk decision, central policy becomes paperwork. A policy engine does not secure a path that the application does not actually enforce.',
        'It also fails when rule modules become an unmaintainable second codebase. Tangled helper rules, unclear data ownership, stale bundles, untested input shapes, broad exceptions, and secret-heavy logs can make policy-as-code harder to trust than local code.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a Kubernetes admission request for a pod in namespace prod-payments. Input says user = dana, image = registry.example/pay:v7, digest = sha256:abc, privileged = true, labels = {owner: payments}, and service_account = default. Data says approved registries include registry.example, privileged is forbidden in prod, and prod service accounts must be deployer-payments.',
        'Rules compute deny reasons. The registry check passes because registry.example is approved. The privileged check adds deny because privileged = true in prod, and the service account check adds deny because default is not deployer-payments. Since the deny set has two strings, allow is false and the admission controller rejects the request with those reasons and bundle version.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the OPA documentation, Rego policy-language guide, OPA testing guide, bundle documentation, decision-log documentation, and Kubernetes admission-controller examples that use OPA or Gatekeeper.',
        'Study Zanzibar-style authorization, JWT verification, OAuth token lifecycle, Kubernetes admission policy, SLSA supply-chain provenance, distributed tracing, and schema versioning next. The durable lesson is that policy correctness is a data contract plus an enforcement contract.',
      ],
    },
  ],
};
