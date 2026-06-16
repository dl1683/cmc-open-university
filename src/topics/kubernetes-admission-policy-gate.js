// Kubernetes admission policy gate: API-server request path, mutating and
// validating phases, ValidatingAdmissionPolicy with CEL, webhooks, audit, and supply-chain checks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-admission-policy-gate',
  title: 'Kubernetes Admission Policy Gate',
  category: 'Security',
  summary: 'A control-plane case study: authenticate and authorize a write request, mutate safely, validate with CEL or webhooks, enforce image/provenance policy, and audit the decision.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['admission chain', 'CEL policy binding'], defaultValue: 'admission chain' },
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

function admissionGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.1, note: 'write request' },
      { id: 'authn', label: 'authn', x: 2.0, y: 3.0, note: 'who' },
      { id: 'authz', label: 'authz', x: 2.0, y: 5.2, note: 'may write?' },
      { id: 'mutate', label: 'mutate', x: 3.8, y: 4.1, note: 'defaults' },
      { id: 'schema', label: 'schema', x: 5.2, y: 4.1, note: 'API valid' },
      { id: 'vap', label: 'VAP/CEL', x: 6.8, y: 3.0, note: 'in-process' },
      { id: 'webhook', label: 'webhook', x: 6.8, y: 5.2, note: 'HTTP' },
      { id: 'audit', label: 'audit', x: 8.4, y: 3.0, note: 'reason' },
      { id: 'persist', label: 'persist', x: 9.3, y: 4.6, note: 'etcd' },
    ],
    edges: [
      { id: 'e-client-authn', from: 'client', to: 'authn' },
      { id: 'e-authn-authz', from: 'authn', to: 'authz' },
      { id: 'e-authz-mutate', from: 'authz', to: 'mutate' },
      { id: 'e-mutate-schema', from: 'mutate', to: 'schema' },
      { id: 'e-schema-vap', from: 'schema', to: 'vap' },
      { id: 'e-schema-webhook', from: 'schema', to: 'webhook' },
      { id: 'e-vap-audit', from: 'vap', to: 'audit' },
      { id: 'e-webhook-audit', from: 'webhook', to: 'audit' },
      { id: 'e-vap-persist', from: 'vap', to: 'persist' },
      { id: 'e-webhook-persist', from: 'webhook', to: 'persist' },
    ],
  }, { title });
}

function celGraph(title) {
  return graphState({
    nodes: [
      { id: 'policy', label: 'policy', x: 0.8, y: 3.0, note: 'logic' },
      { id: 'binding', label: 'binding', x: 0.8, y: 5.2, note: 'scope' },
      { id: 'params', label: 'params', x: 2.7, y: 5.2, note: 'config' },
      { id: 'request', label: 'request', x: 2.7, y: 3.0, note: 'object' },
      { id: 'cel', label: 'CEL eval', x: 4.7, y: 4.1, note: 'boolean' },
      { id: 'warn', label: 'Warn', x: 6.5, y: 2.6, note: 'client' },
      { id: 'audit', label: 'Audit', x: 6.5, y: 4.1, note: 'event' },
      { id: 'deny', label: 'Deny', x: 6.5, y: 5.6, note: 'reject' },
      { id: 'image', label: 'image gate', x: 8.5, y: 4.1, note: 'supply chain' },
    ],
    edges: [
      { id: 'e-policy-cel', from: 'policy', to: 'cel' },
      { id: 'e-binding-cel', from: 'binding', to: 'cel' },
      { id: 'e-params-cel', from: 'params', to: 'cel' },
      { id: 'e-request-cel', from: 'request', to: 'cel' },
      { id: 'e-cel-warn', from: 'cel', to: 'warn' },
      { id: 'e-cel-audit', from: 'cel', to: 'audit' },
      { id: 'e-cel-deny', from: 'cel', to: 'deny' },
      { id: 'e-deny-image', from: 'deny', to: 'image' },
      { id: 'e-audit-image', from: 'audit', to: 'image' },
    ],
  }, { title });
}

function* admissionChain() {
  yield {
    state: admissionGraph('Admission handles write requests after authn and authz'),
    highlight: { active: ['client', 'authn', 'authz', 'e-client-authn', 'e-authn-authz'], compare: ['mutate', 'persist'] },
    explanation: 'Kubernetes admission runs after a request is authenticated and authorized, and before the write is persisted. Reads do not pass through admission control.',
  };
  yield {
    state: admissionGraph('Mutating admission changes the object before validation'),
    highlight: { active: ['authz', 'mutate', 'schema', 'e-authz-mutate', 'e-mutate-schema'], compare: ['vap', 'webhook'] },
    explanation: 'Mutating admission can add defaults or side effects. Because later mutation may change the object, policy that must see final state belongs in the validating phase.',
    invariant: 'Validate the final object, not an earlier draft.',
  };
  yield {
    state: admissionGraph('Validation can be in-process CEL or external webhook'),
    highlight: { active: ['schema', 'vap', 'webhook', 'e-schema-vap', 'e-schema-webhook'], found: ['audit'] },
    explanation: 'ValidatingAdmissionPolicy evaluates CEL expressions inside the API server. Validating webhooks call an HTTP service. Both can reject the request before persistence.',
  };
  yield {
    state: admissionGraph('A rejection stops persistence and returns an error'),
    highlight: { active: ['vap', 'webhook', 'audit', 'e-vap-audit', 'e-webhook-audit'], removed: ['persist'] },
    explanation: 'If any admission controller rejects the request, the write is rejected. The useful data structure is a decision record: request, policy version, action, message, and audit annotation.',
  };
  yield {
    state: labelMatrix(
      'Admission phase choices',
      [
        { id: 'mutate', label: 'mutate' },
        { id: 'schema', label: 'schema' },
        { id: 'vap', label: 'VAP/CEL' },
        { id: 'webhook', label: 'webhook' },
      ],
      [
        { id: 'good', label: 'good for' },
        { id: 'hazard', label: 'hazard' },
      ],
      [
        ['defaults', 'side effects'],
        ['API shape', 'not business policy'],
        ['fast rules', 'CEL limits'],
        ['deep checks', 'latency/outage'],
      ],
    ),
    highlight: { active: ['vap:good', 'webhook:good'], compare: ['mutate:hazard', 'webhook:hazard'] },
    explanation: 'A strong design separates cheap structural checks, in-process policy, and expensive external verification. One admission hook should not become an unbounded control-plane dependency.',
  };
}

function* celPolicyBinding() {
  yield {
    state: celGraph('A ValidatingAdmissionPolicy contains abstract logic'),
    highlight: { active: ['policy', 'request', 'cel', 'e-policy-cel', 'e-request-cel'], compare: ['binding'] },
    explanation: 'ValidatingAdmissionPolicy stores CEL expressions. The expression evaluates the admission object and returns true or false for each validation.',
  };
  yield {
    state: celGraph('A binding gives the policy scope and action'),
    highlight: { active: ['binding', 'cel', 'warn', 'audit', 'deny', 'e-binding-cel', 'e-cel-warn', 'e-cel-audit', 'e-cel-deny'], compare: ['params'] },
    explanation: 'A binding connects policy logic to resources and declares validation actions. Kubernetes supports Deny, Warn, and Audit actions for validation failures.',
  };
  yield {
    state: celGraph('Parameter resources turn generic policy into cluster policy'),
    highlight: { active: ['params', 'cel', 'e-params-cel'], found: ['policy', 'binding'] },
    explanation: 'Parameter resources let cluster administrators reuse one policy template with different namespace, owner, image registry, label, or limit settings.',
  };
  yield {
    state: celGraph('Supply-chain gates often need a webhook or sidecar verifier'),
    highlight: { active: ['image', 'deny', 'audit', 'e-deny-image', 'e-audit-image'], compare: ['cel'] },
    explanation: 'CEL is strong for fields already in the Kubernetes object. Signature, SLSA provenance, and Rekor inclusion checks usually require external artifact lookups or a controller-maintained cache.',
    invariant: 'Put network-heavy verification behind bounded caches and clear failure policy.',
  };
  yield {
    state: labelMatrix(
      'Image admission case study',
      [
        { id: 'digest', label: 'digest pin' },
        { id: 'sig', label: 'signature' },
        { id: 'slsa', label: 'SLSA level' },
        { id: 'identity', label: 'identity' },
        { id: 'runtime', label: 'runtime' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'source', label: 'source' },
      ],
      [
        ['image@sha256', 'object field'],
        ['valid Sigstore', 'verifier cache'],
        ['Build L3', 'provenance'],
        ['allowed workflow', 'certificate SAN'],
        ['seccomp profile', 'pod spec'],
      ],
    ),
    highlight: { active: ['digest:check', 'runtime:check'], found: ['sig:check', 'slsa:check', 'identity:check'] },
    explanation: 'A complete image gate combines object fields with external evidence: digest pinning, signature verification, provenance level, signing identity, and runtime security profile.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'admission chain') yield* admissionChain();
  else if (view === 'CEL policy binding') yield* celPolicyBinding();
  else throw new InputError('Pick a Kubernetes admission view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Kubernetes admission control is the API-server gate for object writes. It runs after authentication and authorization, before the object is persisted. Admission controllers can mutate incoming objects, validate them, reject them, emit audit annotations, or call external webhooks.',
        'The data-structure view is a decision pipeline: request object, user, operation, namespace, mutating patches, schema validation, CEL policy, parameter resources, webhook responses, validation action, audit annotations, and final persist-or-reject decision.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Admission proceeds in phases. Mutating controllers run first and may alter the object. After object validation, validating admission policies and validating webhooks can reject the request. If any controller rejects, the entire request fails and the object is not persisted.',
        'ValidatingAdmissionPolicy is an in-process alternative to validating admission webhooks for many declarative checks. It uses CEL expressions, optional parameter resources, policy bindings, match constraints, validation actions, audit annotations, and messages.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main structures are AdmissionReview, operation tuple, object snapshot, namespace selector, object selector, match conditions, CEL expression, parameter resource, validation action, webhook configuration, timeout, failure policy, audit annotation, and policy decision record.',
        'This topic connects Kubernetes Reconciliation Case Study to OPA Rego Policy Decision Graph. Reconciliation explains desired-state convergence after writes. Admission explains the write gate before state enters etcd. Supply-chain image gates connect to Sigstore Keyless Signing Transparency and SLSA Build & Source Trust Ladder.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A production namespace requires every Pod image to be digest-pinned, signed by the release workflow, backed by SLSA Build L3 provenance, and run with a non-default seccomp profile. CEL policy rejects mutable image tags and missing runtime fields directly from the Pod spec. A validating webhook or verifier cache checks Sigstore signature, Rekor evidence, and SLSA provenance. The decision returns Deny with a precise message when any link fails and writes audit annotations for later investigation.',
        'If the verifier service is slow, the admission design must decide whether to fail closed, fail open with audit, use cached allow decisions, or block only high-risk namespaces. That failure policy is part of the security model, not an operational footnote.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Admission is not a replacement for controllers. It should make bounded decisions about a request. Long-running repair, cleanup, external resource creation, and drift correction belong in reconciliation loops with retries and status.',
        'Another mistake is putting broad network calls on the admission hot path. Webhooks are part of the control plane. They need timeouts, small request scopes, failure policy, metrics, and a clear plan for outages. CEL policies are faster and simpler when the needed facts are already in the object.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kubernetes Admission Control at https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/, Dynamic Admission Control at https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/, and Validating Admission Policy at https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/. Study Kubernetes Reconciliation Case Study, Kubernetes Scheduler Priority Queue & Preemption Case Study, OPA Rego Policy Decision Graph, Software Supply Chain Provenance Graph, Sigstore Keyless Signing Transparency, SLSA Build & Source Trust Ladder, Seccomp BPF Sandbox Policy, and Zanzibar Authorization Case Study next.',
      ],
    },
  ],
};
