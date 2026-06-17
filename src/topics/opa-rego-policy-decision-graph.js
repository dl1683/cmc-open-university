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
    explanation: 'The policy enforcement point sends OPA a structured question at the moment it needs a decision. The service still enforces the result, but the rule logic is centralized in Rego instead of scattered through request handlers.',
  };
  yield {
    state: decisionGraph('Input plus data documents feed declarative rules'),
    highlight: { active: ['input', 'data', 'rego', 'e-input-rego', 'e-data-rego'], found: ['eval'] },
    explanation: 'Rego evaluates JSON-like input against data documents. Input is the current request; data holds slower-changing facts such as roles, allowed registries, trusted builders, risk tiers, or network metadata.',
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
    explanation: 'OPA decisions can be richer than allow or deny. A policy can return deny reasons, filtered data, required approvals, risk scores, or routing metadata that the enforcement point knows how to use.',
  };
  yield {
    state: decisionGraph('Explain traces make policy debuggable'),
    highlight: { active: ['eval', 'trace', 'audit', 'e-eval-trace', 'e-decision-audit'], found: ['decision'] },
    explanation: 'A policy decision must be explainable after the incident. Record the input shape, policy bundle version, decision id, result, and important reasons while avoiding secret leakage.',
  };
}

function* policyBundleLifecycle() {
  yield {
    state: bundleGraph('Policy changes need the same discipline as code changes'),
    highlight: { active: ['repo', 'test', 'build', 'e-repo-test', 'e-repo-build'], compare: ['dist'] },
    explanation: 'Policy-as-code is production code. It should live in reviewable files, use fixtures, run tests, and build a bundle that can be promoted through environments.',
  };
  yield {
    state: bundleGraph('Bundles should be signed or otherwise pinned'),
    highlight: { active: ['build', 'sign', 'dist', 'e-build-sign', 'e-sign-dist'], found: ['test'] },
    explanation: 'The bundle is executable authorization logic. Treat it like a supply-chain artifact: identify it by digest, sign it when appropriate, and know which services consumed which version.',
  };
  yield {
    state: bundleGraph('Local caches avoid one central policy bottleneck'),
    highlight: { active: ['dist', 'cache', 'serve', 'e-dist-cache', 'e-cache-serve'], compare: ['repo'] },
    explanation: 'OPA can run as a sidecar, host-local daemon, embedded library, or centralized service. Local caches avoid a central bottleneck, but every service needs an explicit stale-bundle policy.',
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
      heading: 'Why This Exists',
      paragraphs: [
        "Authorization and compliance rules tend to spread through a system as request-handler if statements, configuration flags, firewall exceptions, deployment scripts, and emergency patches. Each local rule may look reasonable, but the whole policy becomes hard to review. When an auditor asks why a request was allowed, the team has to reconstruct behavior from scattered code paths.",
        "Open Policy Agent, usually called OPA, exists to separate policy decision-making from policy enforcement. A service, gateway, controller, or CI job remains responsible for enforcement. OPA receives structured input, evaluates Rego rules over that input and slower-changing data documents, and returns a decision the caller knows how to apply.",
      ],
    },
    {
      heading: 'Naive Approach',
      paragraphs: [
        "The naive approach is to keep policy beside the business operation. A handler checks whether the user owns the tenant, whether the image registry is approved, whether a namespace has the right label, or whether a workflow has a required approval. For a small service, that is direct and easy to understand.",
        "The design fails as soon as the same policy must be shared across services. One service calls the field image, another calls it container_image, and a third forgets to include the digest. A deny rule is added to one codebase but not another. A rule change requires application redeploys. A production incident leaves no single policy version to replay.",
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        "The wall is not just duplication. The wall is loss of invariants. A policy is supposed to mean the same thing wherever it is enforced, but application-local checks drift with schema changes, team ownership, emergency exceptions, and partial rollouts. Security bugs often come from one forgotten path, not from the main path everyone reviewed.",
        "Centralizing policy introduces its own wall. OPA can only decide from the input and data it receives. If the enforcement point sends incomplete input, uses stale data, ignores the deny result, or falls open after a timeout, the policy engine can look correct while the system is unsafe. Policy-as-code improves reviewability, but it does not remove the need for enforcement discipline.",
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        "The core insight is that a policy decision is a query over structured data. The input document describes the current request: subject, action, resource, environment, and relevant metadata. Data documents describe slower-changing facts: roles, group membership, trusted builders, approved registries, risk tiers, namespace settings, or service ownership.",
        "Rego rules define derived facts and decision values over those documents. The useful mental model is a decision graph. Input and data flow into rules. Rules feed an evaluation query. The query produces a structured decision. The enforcement point applies that decision. Explain traces and decision logs preserve enough of the graph to debug it later.",
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        "At request time, the policy enforcement point builds an input document. For API authorization, that might include user id, tenant id, groups, method, path, resource owner, request time, device posture, and source network. For Kubernetes admission, it might include pod spec, image digests, namespace labels, user identity, and requested capabilities.",
        "OPA evaluates a query against input, data, and loaded Rego modules. The result does not have to be a single boolean. It can be allow or deny, a set of deny reasons, a filtered data document, a required-approval object, a risk score, or routing metadata. The caller must know exactly which result shape it asked for and how to enforce it.",
        "For production rollout, policies are packaged as bundles. A bundle contains Rego modules and optional data. It should move through review, test fixtures, build, signing or digest pinning, distribution, local cache, staged rollout, and metrics. Decision logs should include a decision id, bundle version, input shape, result, and key reasons while avoiding secret leakage.",
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        "OPA works because it makes hidden policy dependencies explicit. The rules cannot silently read arbitrary application state. They read declared input, declared data, and other declared rules. That makes it possible to test policies with fixtures, review rules without reading the whole service, and replay a decision after an incident.",
        "The graph is also compositional. A policy can derive helper facts such as trusted_image, production_namespace, admin_actor, or missing_required_label, then use those facts to compute allow or deny reasons. This is easier to review than one large imperative branch because intermediate decisions can be named and tested.",
        "Bundle versioning makes policy decisions reproducible. If a request was denied under bundle v42 and data snapshot d17, the team can replay the same input against the same policy state. That is the policy equivalent of using a write-ahead log or event log: preserve the ordered artifact that explains what happened.",
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        "Consider a Kubernetes admission controller. A developer submits a pod creation request. The admission webhook is the enforcement point. It builds input with the user, namespace, labels, service account, image registry, image digest, security context, requested capabilities, resource limits, and whether the namespace is production.",
        "OPA receives that input plus data documents listing approved registries, required labels, trusted service accounts, and production namespace constraints. Rego rules compute deny reasons: image registry not approved, privileged mode requested, missing owner label, or production deployment without required service account. If the deny set is empty, allow is true. If it is not empty, the admission controller rejects the request and returns the reasons.",
        "The same structure works for a supply-chain gate. Input contains artifact digest, signer, source repository, builder id, branch, and attestation summary. Data contains trusted builders, allowed repositories, and minimum SLSA level. Rego evaluates whether the artifact satisfies policy. The CI gate enforces the result and records the bundle version for audit.",
      ],
    },
    {
      heading: 'What The Animation Teaches',
      paragraphs: [
        "The decision-graph view shows the runtime flow. A policy enforcement point sends input. OPA combines input with data documents and Rego rules. Evaluation produces a decision. The decision returns to the caller. Trace and audit nodes are not decorative; they are what make a production denial explainable after the fact.",
        "The bundle-lifecycle view shows the control plane. Policies begin in a repository, pass tests, build into bundles, receive a digest or signature, distribute to services, land in local caches, and emit metrics. This view matters because many OPA failures are rollout failures rather than rule-language failures.",
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        "OPA adds latency, schema discipline, policy tests, bundle distribution, cache freshness, decision logging, and operational ownership. The main cost is usually not learning Rego syntax. The main cost is keeping input contracts stable and making every enforcement point handle denial, timeout, stale bundle, and logging behavior deliberately.",
        "Deployment shape is a tradeoff. A sidecar, host-local daemon, or embedded library keeps policy decisions close to the caller and avoids a central bottleneck, but each instance needs bundle freshness and failover rules. A centralized OPA service is easier to update and observe, but it can become a dependency on the critical request path.",
        "Rich decisions are useful but dangerous if callers interpret them inconsistently. If one caller treats missing deny reasons as allow and another treats missing allow as deny, the policy contract is unclear. The decision schema should be tested the same way an API schema is tested.",
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        "OPA wins when many components need shared, reviewable policy. Common uses include Kubernetes admission control, API authorization, infrastructure-as-code checks, CI gates, software supply-chain policy, data filtering, feature gates, service-mesh authorization, and model-action guardrails.",
        "It is strongest when policies are declarative, input schemas are explicit, rule modules are small enough to review, data freshness is known, and tests cover both allow and deny behavior. It also helps organizations that need explainability: a denial can point to policy version, rule, input field, and reason instead of a buried branch in one service.",
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        "OPA fails when enforcement is optional. If services can bypass the policy call, ignore a denial, or fall open after a timeout without an explicit risk decision, central policy becomes theater. The enforcement point is part of the algorithm, not an implementation detail.",
        "It also fails when rules become a second unmaintainable codebase. Tangled modules, unclear data ownership, unbounded helper rules, untested input shapes, and broad exceptions can make policy-as-code harder to reason about than application code. Rego improves policy expression, but it cannot compensate for weak software engineering.",
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        "Important failure modes include input drift, stale bundle drift, stale data drift, accidental fail-open behavior, missing decision logs, secret leakage in logs, shadow-mode differences, unreviewed emergency exceptions, and decision schema mismatch between policy and caller. Each one can produce wrong authorization even when the rule text looks reasonable.",
        "The mitigation pattern is boring and necessary: schema tests for input, fixtures for policy behavior, staged rollout, digest-pinned bundles, clear data-source ownership, dry-run or shadow mode for risky policy changes, metrics for deny rates by slice, and an audited break-glass path for emergencies.",
      ],
    },
    {
      heading: 'Sources And Study Next',
      paragraphs: [
        "Primary sources are the OPA documentation, the Rego policy-language guide, the OPA testing guide, and OPA performance guidance. Those sources explain the product contract: decouple policy decisions from enforcement, evaluate rules over structured data, test policies with fixtures, and pay attention to query and data shape.",
        "Study Zanzibar Authorization Case Study for relationship authorization, OAuth PKCE Token Lifecycle Case Study and JWT Verification for identity inputs, LLM Guardrail Policy Engine for model-action policy, Software Supply Chain Provenance Graph and SLSA Build and Source Trust Ladder for artifact gates, Kubernetes Admission Policy Gate for a common OPA deployment, Distributed Tracing for decision observability, and Hash Table or JSON data modeling for the underlying structured lookups.",
      ],
    },
  ],
};
