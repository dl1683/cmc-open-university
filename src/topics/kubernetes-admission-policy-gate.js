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
  const phases = ['authn', 'authz', 'mutate', 'schema', 'vap', 'webhook', 'audit', 'persist'];
  const preAdmissionSteps = ['client', 'authn', 'authz'];
  const compareTargets = ['mutate', 'persist'];
  yield {
    state: admissionGraph('Admission handles write requests after authn and authz'),
    highlight: { active: ['client', 'authn', 'authz', 'e-client-authn', 'e-authn-authz'], compare: compareTargets },
    explanation: `Admission is the last write gate before cluster state changes, spanning ${phases.length} phases from authentication to persistence. The request has already passed ${preAdmissionSteps.slice(1).join(' and ')} (${preAdmissionSteps.length - 1} steps), but it has not reached etcd yet. Reads do not pass through this path.`,
  };
  const mutatingActive = ['authz', 'mutate', 'schema'];
  const validationMethods = ['vap', 'webhook'];
  yield {
    state: admissionGraph('Mutating admission changes the object before validation'),
    highlight: { active: ['authz', 'mutate', 'schema', 'e-authz-mutate', 'e-mutate-schema'], compare: validationMethods },
    explanation: `Mutating admission (${mutatingActive[1]}) can add defaults or patches, but it is the wrong place for final safety decisions. Because later mutation may change the object, policy that must see final state belongs in one of the ${validationMethods.length} validation methods: ${validationMethods.join(' or ')}.`,
    invariant: 'Validate the final object, not an earlier draft.',
  };
  const validatorNodes = ['vap', 'webhook'];
  const validatorLabels = { vap: 'ValidatingAdmissionPolicy (CEL, in-process)', webhook: 'Validating webhook (HTTP, external)' };
  yield {
    state: admissionGraph('Validation can be in-process CEL or external webhook'),
    highlight: { active: ['schema', 'vap', 'webhook', 'e-schema-vap', 'e-schema-webhook'], found: ['audit'] },
    explanation: `${validatorLabels[validatorNodes[0]]} evaluates CEL expressions inside the API server. ${validatorLabels[validatorNodes[1]]} calls an HTTP service. Both ${validatorNodes.length} validators can reject the request before persistence.`,
  };
  const decisionFields = ['request', 'policy version', 'action', 'message', 'audit annotation'];
  const rejectionActive = ['vap', 'webhook', 'audit'];
  yield {
    state: admissionGraph('A rejection stops persistence and returns an error'),
    highlight: { active: ['vap', 'webhook', 'audit', 'e-vap-audit', 'e-webhook-audit'], removed: ['persist'] },
    explanation: `If any of the ${rejectionActive.length} active admission stages (${rejectionActive.join(', ')}) rejects the request, the write is blocked. The useful data structure is a decision record with ${decisionFields.length} fields: ${decisionFields.join(', ')}.`,
  };
  const matrixRows = [
    { id: 'mutate', label: 'mutate' },
    { id: 'schema', label: 'schema' },
    { id: 'vap', label: 'VAP/CEL' },
    { id: 'webhook', label: 'webhook' },
  ];
  const matrixCols = [
    { id: 'good', label: 'good for' },
    { id: 'hazard', label: 'hazard' },
  ];
  yield {
    state: labelMatrix(
      'Admission phase choices',
      matrixRows,
      matrixCols,
      [
        ['defaults', 'side effects'],
        ['API shape', 'not business policy'],
        ['fast rules', 'CEL limits'],
        ['deep checks', 'latency/outage'],
      ],
    ),
    highlight: { active: ['vap:good', 'webhook:good'], compare: ['mutate:hazard', 'webhook:hazard'] },
    explanation: `A strong design separates ${matrixRows.length} admission phases across ${matrixCols.length} dimensions (${matrixCols.map(c => c.label).join(' vs. ')}). The failure mode is ${matrixRows[matrixRows.length - 1].label}, which turns every write into a slow or fragile control-plane dependency.`,
  };
}

function* celPolicyBinding() {
  const policyInputs = ['policy', 'request'];
  const celEvalOutcome = ['true', 'false'];
  yield {
    state: celGraph('A ValidatingAdmissionPolicy contains abstract logic'),
    highlight: { active: ['policy', 'request', 'cel', 'e-policy-cel', 'e-request-cel'], compare: ['binding'] },
    explanation: `ValidatingAdmissionPolicy stores CEL expressions fed by ${policyInputs.length} inputs (${policyInputs.join(' and ')}). Each expression evaluates the admission object and returns one of ${celEvalOutcome.length} outcomes: ${celEvalOutcome.join(' or ')}.`,
  };
  const actions = ['Deny', 'Warn', 'Audit'];
  const bindingActive = ['binding', 'cel', 'warn', 'audit', 'deny'];
  yield {
    state: celGraph('A binding gives the policy scope and action'),
    highlight: { active: ['binding', 'cel', 'warn', 'audit', 'deny', 'e-binding-cel', 'e-cel-warn', 'e-cel-audit', 'e-cel-deny'], compare: ['params'] },
    explanation: `A binding connects policy logic to resources and declares validation actions across ${bindingActive.length} active nodes. Kubernetes supports ${actions.length} actions for validation failures: ${actions.join(', ')}.`,
  };
  const paramExamples = ['namespace', 'owner', 'image registry', 'label', 'limit'];
  const foundResources = ['policy', 'binding'];
  yield {
    state: celGraph('Parameter resources turn generic policy into cluster policy'),
    highlight: { active: ['params', 'cel', 'e-params-cel'], found: foundResources },
    explanation: `Parameter resources let cluster administrators reuse one policy template across ${paramExamples.length} configuration dimensions (${paramExamples.join(', ')}), with ${foundResources.join(' and ')} already established.`,
  };
  const externalChecks = ['Signature', 'SLSA provenance', 'Rekor inclusion'];
  const supplyChainActive = ['image', 'deny', 'audit'];
  yield {
    state: celGraph('Supply-chain gates often need a webhook or sidecar verifier'),
    highlight: { active: ['image', 'deny', 'audit', 'e-deny-image', 'e-audit-image'], compare: ['cel'] },
    explanation: `CEL is strong for fields already in the Kubernetes object, but ${externalChecks.length} supply-chain checks (${externalChecks.join(', ')}) usually require external artifact lookups or a controller-maintained cache. The ${supplyChainActive.length} active nodes (${supplyChainActive.join(', ')}) show the downstream path after CEL.`,
    invariant: 'Put network-heavy verification behind bounded caches and clear failure policy.',
  };
  const imageChecks = [
    { id: 'digest', label: 'digest pin' },
    { id: 'sig', label: 'signature' },
    { id: 'slsa', label: 'SLSA level' },
    { id: 'identity', label: 'identity' },
    { id: 'runtime', label: 'runtime' },
  ];
  const imageCols = [
    { id: 'check', label: 'check' },
    { id: 'source', label: 'source' },
  ];
  yield {
    state: labelMatrix(
      'Image admission case study',
      imageChecks,
      imageCols,
      [
        ['image@sha256', 'object field'],
        ['valid Sigstore', 'verifier cache'],
        ['Build L3', 'provenance'],
        ['allowed workflow', 'certificate SAN'],
        ['seccomp profile', 'pod spec'],
      ],
    ),
    highlight: { active: ['digest:check', 'runtime:check'], found: ['sig:check', 'slsa:check', 'identity:check'] },
    explanation: `A complete image gate combines ${imageChecks.length} checks across ${imageCols.length} dimensions (${imageCols.map(c => c.label).join(' and ')}): ${imageChecks.map(c => c.label).join(', ')}.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'The admission-chain view follows a Kubernetes write request from client to etcd, the database that stores cluster state. Active nodes show the current phase, compare markers show alternatives, and removed markers mean persistence was blocked.',
        {
          type: 'callout',
          text: 'Admission policy turns a permitted write into a checked write before the object can become cluster state.',
        },
        'The CEL policy-binding view separates policy logic from policy scope. The policy says what condition must hold, the binding says which resources it applies to, and the action says whether failure denies, warns, or audits.',
        'The image gate marks the boundary between object-local checks and external evidence. CEL can inspect the Kubernetes object; registry signatures, provenance, and vulnerability data usually require cached evidence or a webhook.',
      
        {type: 'image', src: './assets/gifs/kubernetes-admission-policy-gate.gif', alt: 'Animated walkthrough of the kubernetes admission policy gate visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: [
        'Kubernetes is controlled through an API server. Authentication proves who sent a request, authorization proves whether that caller may write a resource type, and admission decides whether this specific object should become cluster state.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Kubernetes.png/250px-Kubernetes.png',
          alt: 'Kubernetes architecture diagram with API server, controller manager, scheduler, etcd, and worker nodes',
          caption: 'The API server is the write boundary between clients, controllers, and persistent cluster state. Source: Wikimedia Commons, File:Kubernetes.png.',
        },
        'RBAC can grant create pods in a namespace, but it cannot by itself require digest-pinned images, nonprivileged containers, or resource budgets. Admission exists so unsafe objects can be rejected before controllers, schedulers, and kubelets act on them.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a validating admission webhook. The API server sends an AdmissionReview HTTP request to an external service, the service evaluates policy, and it returns allow or deny.',
        'That design is useful because it can run arbitrary code and reach external systems. OPA Gatekeeper, Kyverno, and custom webhooks grew from this pattern because many policies need more than field checks.',
      ], },
    { heading: 'The wall', paragraphs: [
        'A webhook puts an external service on the critical write path. If it is slow, every matching write is slow; if it is unavailable, the cluster must either fail closed and block writes or fail open and skip the check.',
        'The failure is concrete: a node drain evicts the webhook pod, TLS expires, a broad match rule catches too many resources, or the webhook times out during a rollout. The control plane now depends on a service that was supposed to protect it.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Keep structural policy close to the API server when the decision only depends on the object being written. ValidatingAdmissionPolicy uses CEL, the Common Expression Language, so bounded expressions can run in-process without a network round trip.',
        'The split is architectural. CEL handles object-local rules such as labels, forbidden hostPath mounts, digest-pinned images, and immutable fields; webhooks remain for external evidence such as signature verification or registry lookup.',
      ], },
    { heading: 'How it works', paragraphs: [
        'A ValidatingAdmissionPolicy stores CEL expressions. A ValidatingAdmissionPolicyBinding attaches those expressions to resources, operations, namespaces, optional parameter objects, and actions such as Deny, Warn, or Audit.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Kubernetes_logo_without_workmark.svg/120px-Kubernetes_logo_without_workmark.svg.png',
          alt: 'Kubernetes wheel logo',
          caption: 'Kubernetes policy works best when common structural checks stay close to the API server path. Source: Wikimedia Commons, Kubernetes Authors, Apache License 2.0.',
        },
        'On a matching write, Kubernetes evaluates expressions against object, oldObject, request metadata, and optional params. If an expression fails and the binding says Deny, persistence to etcd stops and the client receives the policy message.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Correctness comes from placement and determinism. Validating admission runs after mutation and schema validation, so the policy sees the object that would be stored, and CEL expressions are bounded, deterministic, and side-effect free.',
        'Availability improves for structural checks because the evaluator is part of the API server path. There is no separate webhook Deployment, Service, TLS chain, or network timeout to keep healthy for object-local policy.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'The cost of CEL policy is expression evaluation on each matching write. The behavior is bounded, while a webhook adds network latency, queueing, TLS, service health, and timeout behavior.',
        'The complexity moves from operating a service to writing precise CEL and bindings. That is a good trade for structural policy, but not for checks that need live external state.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Platform teams use admission policy to require labels, resource limits, image digests, nonprivileged containers, safe volume types, and immutable production fields. These checks are pure functions of the submitted Kubernetes object.',
        'Supply-chain policy often combines both paths. CEL can require image references to use digests, while a webhook or controller-maintained cache verifies signatures, provenance, and vulnerability status outside the object.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'CEL cannot fetch arbitrary external data during admission. If a rule needs a registry, transparency log, vulnerability database, or another live resource, use a webhook or precompute evidence into a Kubernetes object that CEL can read.',
        'Admission is also not reconciliation. It gates a single write at one time; it does not repair old objects, detect later drift, or enforce invariants that span many resources unless another controller supplies that state.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Suppose a cluster receives 10,000 Pod creates per hour, and policy says every container image must contain @sha256:. A CEL expression checks object.spec.containers.all(c, c.image.contains("@sha256:")) inside the API server.',
        'If 9,700 Pods pass and 300 use mutable tags, the 300 are denied before etcd persistence. A webhook could make the same decisions, but at 10 ms per call it adds about 100 seconds of aggregate waiting per hour before queueing and failures.',
        'Now add signature verification. The digest check stays in CEL, while signature evidence is checked by a webhook or cached by a controller, because the API object alone does not contain the transparency-log proof.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources: Kubernetes documentation for Admission Controllers, Dynamic Admission Control, ValidatingAdmissionPolicy, CEL expression language support, and Admission Webhook Good Practices. The boundary to remember is object-local validation versus outside evidence.',
        'Study Kubernetes reconciliation next, because admission explains what happens before persistence and controllers explain what happens after. Then study RBAC, Pod Security Admission, OPA Gatekeeper, Kyverno, Sigstore, and SLSA provenance.',
      ], },
  ],
};
