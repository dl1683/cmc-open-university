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
    explanation: 'Admission is the last write gate before cluster state changes. The request has already passed authentication and authorization, but it has not reached etcd yet. Reads do not pass through this path.',
  };
  yield {
    state: admissionGraph('Mutating admission changes the object before validation'),
    highlight: { active: ['authz', 'mutate', 'schema', 'e-authz-mutate', 'e-mutate-schema'], compare: ['vap', 'webhook'] },
    explanation: 'Mutating admission can add defaults or patches, but it is the wrong place for final safety decisions. Because later mutation may change the object, policy that must see final state belongs in validation.',
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
    explanation: 'A strong design separates cheap structural checks, in-process policy, and expensive external verification. The failure mode is a webhook that turns every write into a slow or fragile control-plane dependency.',
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
      heading: 'The Problem Admission Solves',
      paragraphs: [
        "Kubernetes is an API-driven system. Almost every meaningful change to a cluster begins as a write request to the API server: create a Pod, update a Deployment, patch a Secret, delete a RoleBinding, or scale a workload. Authentication answers who is calling. Authorization answers whether that caller may perform the verb on the resource. Admission answers a different question: should this particular object, in this particular shape, be allowed to become cluster state?",
        "That third question exists because RBAC is intentionally coarse. A team may be allowed to create Pods in its namespace, but that does not mean every Pod spec is safe. One Pod may use an approved image digest and a restricted runtime profile. Another may use a mutable latest tag, mount the host filesystem, run privileged, or reference an image whose provenance cannot be verified. Both are create pods requests. RBAC cannot express the full object-level policy without becoming a brittle application-specific language.",
        "The naive design is to let every controller, scheduler, runtime, or security scanner reject bad state later. That fails because bad objects have already entered etcd. Once unsafe desired state is persisted, other controllers may observe it, users may build automation around it, and security tooling has to race the system. Admission moves the decision to the write boundary. If a request fails admission, it never becomes the cluster's desired state."
      ],
    },
    {
      heading: 'Core insight: gate the request path',
      paragraphs: [
        "A write request reaches the API server as an authenticated HTTP request. The API server decodes the object, authenticates the caller, checks authorization, and then runs admission before persistence. Admission is not used for ordinary reads. It protects mutations: create, update, delete, connect, and related subresource operations depending on the resource and controller.",
        "The path has two broad admission phases. Mutating admission runs first. Mutating controllers can add defaults, inject sidecars, set fields, or apply patches. After mutation, Kubernetes performs schema and object validation. Then validating admission runs. Validating controllers decide whether the final object is acceptable. That ordering is central. A security rule that must inspect the final Pod spec belongs in validating admission, not in an early mutating step that might see a draft object.",
        "If any admission controller rejects the request, the API server returns an error and does not write the object to etcd. If a controller allows the request but emits warnings or audit annotations, the object may still be persisted while leaving evidence for users and operators. The decision record is the useful mental model: caller, operation, namespace, object, old object for updates, policy version, decision, message, warning, audit annotations, and persistence outcome."
      ],
    },
    {
      heading: 'Mutating Admission And Its Limits',
      paragraphs: [
        "Mutating admission is best for mechanical normalization. A namespace might require labels, default resource requests, a runtime class, a sidecar, or an image pull secret. A platform team may use mutation to save application teams from repeating boilerplate. Built-in Kubernetes admission plugins also use this phase for defaulting and service account behavior.",
        "The wall appears when mutation becomes policy enforcement. Mutation can hide problems instead of rejecting them. It can also create ordering hazards: two mutating webhooks may patch the same field, or a later mutator may change the field that an earlier check assumed was safe. Kubernetes reinvocation helps some cases, but it does not turn mutation into a clean final-state verifier.",
        "A good rule is simple: mutate to make valid intent explicit; validate to reject unsafe intent. If a Pod omits a seccomp profile and the platform has a harmless default, mutation may fill it in. If a Pod explicitly asks for privileged mode in a restricted namespace, validation should reject it with a precise reason. The caller should understand what policy was violated and how to fix the object."
      ],
    },
    {
      heading: 'ValidatingAdmissionPolicy And CEL',
      paragraphs: [
        "ValidatingAdmissionPolicy is Kubernetes' in-process policy mechanism based on CEL, the Common Expression Language. A policy stores validation expressions. A binding attaches that policy to a resource scope and chooses actions such as Deny, Warn, or Audit. Optional parameter resources let the same policy logic use different settings in different namespaces or environments.",
        "CEL is a strong fit when the required facts are already in the admission request. A policy can inspect object fields, oldObject fields during updates, request user information, namespace data made available to admission, and parameter values. For example, a policy can require image references to use digests, reject hostPath volumes, require labels, limit replica counts, or enforce that a field may only change in one direction.",
        "This works because the policy is evaluated inside the API server process. There is no network call to a webhook service, no separate deployment to keep alive, and no extra serialization round trip. The tradeoff is that CEL is deliberately bounded. It should not call registries, fetch transparency logs, query vulnerability databases, or perform long-running cryptographic verification against remote state. The policy language is for fast, deterministic checks over local request data.",
        "A clean design separates policy logic, binding, and parameters. The policy says what condition must hold. The binding says where it applies and what happens on failure. Parameters say which registries, labels, owners, or limits are acceptable for a particular environment. This split lets one platform rule serve dev, staging, and production without copying policy text."
      ],
    },
    {
      heading: 'Webhook Admission',
      paragraphs: [
        "Admission webhooks extend the API server with HTTP callbacks. Mutating webhooks return patches. Validating webhooks return allow or deny decisions. They are useful when policy needs application-specific logic, shared libraries, external evidence, or integrations that do not fit CEL.",
        "The price is operational risk. A validating webhook is on the write path for matching requests. If it is slow, the API server waits until timeout. If it is down, the configured failurePolicy decides whether matching requests fail closed or are allowed to proceed. If the webhook has broad match rules, a small service outage can block cluster-wide writes. If it performs unbounded network calls, every deployment can become dependent on registry latency, database latency, or an external security service.",
        "Production webhooks need narrow match rules, short timeouts, explicit failure policy, high availability, metrics, and careful dependency control. They should return precise messages. They should avoid side effects in validation. They should be versioned like any other control-plane component. A webhook that checks ten unrelated policies and returns policy denied is not an enforcement system; it is an outage and debugging machine.",
        "For supply-chain checks, the best shape is often a verifier cache. A separate controller watches image references or release artifacts, verifies signatures and provenance out of band, and stores bounded evidence locally. Admission can then make a fast decision from cached verification state. That keeps expensive registry, Rekor, certificate, or SLSA lookups away from the hottest part of the API server write path."
      ],
    },
    {
      heading: 'Concrete Image Gate',
      paragraphs: [
        "Consider a production namespace that requires four things before any Pod can run. Images must be pinned by digest, not by mutable tags. Images must be signed by the organization's release workflow. Provenance must show the artifact came from an approved repository and hardened builder. The Pod must use restricted runtime settings such as non-root execution, no privileged mode, and an approved seccomp profile.",
        "The admission design should divide those checks by evidence location. CEL can reject image strings that do not contain @sha256. CEL can reject privileged containers, host namespace sharing, missing seccomp configuration, and disallowed volume types because those facts are in the Pod spec. A webhook or cached verifier should handle signature, certificate identity, transparency-log inclusion, and SLSA provenance because those facts live outside the object.",
        "On success, the request is persisted and audit annotations can record the policy version and verification summary. On failure, the message should name the exact missing link: image must be pinned by digest, signature identity did not match release workflow, provenance builder was not approved, or container requests privileged mode. Operators should also be able to answer how many requests were denied, which namespaces fail most often, how old verifier cache entries are, and whether failurePolicy was ever used to allow a request during verifier outage."
      ],
    },
    {
      heading: 'Failure Modes And Tradeoffs',
      paragraphs: [
        "Admission is not a replacement for reconciliation. Admission makes a bounded decision about one request. Controllers handle long-running work, retries, cleanup, repair, status, and convergence. If policy needs to create cloud resources, scan images asynchronously, rotate certificates, or repair drift, that belongs in a controller. Admission may block unsafe writes or require a reference to existing evidence, but it should not become a general workflow engine.",
        "The hardest tradeoff is fail open versus fail closed. Fail closed protects the cluster when the verifier is unavailable, but it can stop deployments and emergency fixes. Fail open preserves availability but admits objects that were not fully checked. Warn or Audit actions are useful during rollout, but they are not enforcement. Mature systems choose by risk tier: fail closed for production namespaces and privileged resources, warn for migration windows, and fail open only when the residual risk is explicit and monitored.",
        "Evaluation signals are concrete. Track admission latency by policy and webhook. Track rejection counts by reason. Track timeout and error rates. Track cache hit rate and evidence age for external verification. Track policy version adoption. Review audit annotations for high-risk allows. Load-test the webhook under deployment bursts. Run dry-run or warn mode before enforcing new rules. A policy that is theoretically correct but frequently bypassed, timed out, or misunderstood is not doing its job."
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        "Primary sources are the Kubernetes Admission Control, Dynamic Admission Control, and ValidatingAdmissionPolicy documentation. The next concepts to study are Kubernetes Reconciliation for what happens after accepted state enters the cluster, OPA/Rego for richer policy-decision graphs, Sigstore keyless signing for image identity, SLSA for provenance expectations, seccomp for runtime containment, and Zanzibar-style authorization for relationship-based access control. Together they show the boundary between who may ask, what object shape is safe, what evidence supports the artifact, and how the system converges after the write."
      ],
    },
  ],
};
