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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "admission chain" view traces a write request from client through authentication, authorization, mutating admission, schema validation, validating admission (in-process CEL or external webhook), audit logging, and finally persistence to etcd. Active nodes are the current phase. Compare markers show upstream or downstream phases that contrast with the active one.',
        {
          type: 'callout',
          text: 'Admission policy turns a permitted write into a checked write before the object can become cluster state.',
        },
        'The "CEL policy binding" view shows how a ValidatingAdmissionPolicy object, a binding, parameter resources, and the incoming request feed into the CEL evaluator, which produces Warn, Audit, or Deny outcomes. The supply-chain gate at the end highlights where CEL stops and external verification begins.',
        'In both views, removed markers mean persistence was blocked. Found markers mean a decision outcome is now determined. Follow the edges to see which inputs feed each decision point.',
      
        {type: 'image', src: './assets/gifs/kubernetes-admission-policy-gate.gif', alt: 'Animated walkthrough of the kubernetes admission policy gate visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes is API-driven. Every cluster mutation -- create a Pod, update a Deployment, patch a Secret -- enters through the API server as an HTTP request. Authentication identifies the caller. Authorization (RBAC) decides whether that caller may perform the verb on the resource. But RBAC is intentionally coarse: it grants "create Pods in namespace X," not "create Pods whose images are digest-pinned and whose containers are non-privileged." A team allowed to create Pods can submit a spec that mounts the host filesystem, runs as root, and pulls an unsigned image with a mutable tag.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Kubernetes.png/250px-Kubernetes.png',
          alt: 'Kubernetes architecture diagram with API server, controller manager, scheduler, etcd, and worker nodes',
          caption: 'The API server is the write boundary between clients, controllers, and persistent cluster state. Source: Wikimedia Commons, File:Kubernetes.png.',
        },
        'Admission controllers exist to answer the question RBAC cannot: given that this caller is allowed to write this resource type, should this particular object be allowed to become cluster state? They sit on the write path between authorization and etcd. If admission rejects a request, the object never persists. No controller ever sees it. No automation can build on it. The unsafe state simply does not exist.',
        'Without admission, security becomes a race. Scanners, runtime policies, and controllers all try to detect and remediate bad state after it has already been committed. Every tool that reacts to persisted state instead of preventing it is slower, more complex, and easier to bypass than a gate at the write boundary.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first generation of Kubernetes policy enforcement used admission webhooks: external HTTP services that the API server calls for every matching write request. A team deploys a webhook service (often OPA/Gatekeeper or Kyverno), registers a ValidatingWebhookConfiguration, and writes policy in Rego or YAML. The webhook receives the admission review, evaluates it, and returns allow or deny.',
        'This works, and thousands of clusters run it today. Webhooks can execute arbitrary logic: call a registry, verify a signature, query an external database, run a Rego program with hundreds of rules. The ecosystem is mature, the tooling is battle-tested, and the policy languages are expressive.',
        {
          type: 'bullets',
          items: [
            'Raw admission webhook: any language, external pod, network round trip plus policy evaluation, and a fail-open or block-all choice when the service is down.',
            'OPA or Gatekeeper: Rego policy in an external controller path, mature tooling, plus webhook availability and synchronization risk.',
            'Kyverno: YAML-native policy with its own controller path, strong cluster ergonomics, and the same external-service dependency for matching writes.',
            'ValidatingAdmissionPolicy: CEL inside the API server process, no network hop, bounded evaluation, and GA as of Kubernetes 1.30.',
          ],
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Webhooks put an external HTTP service on the critical write path of the API server. Every matching request -- every Pod create, every Deployment update -- blocks until the webhook responds or times out. The invariant that must hold: the webhook service must be reachable, healthy, and fast for every write in the cluster, at all times, including during upgrades, node failures, and burst deployments.',
        'That invariant breaks in practice. A webhook pod gets evicted during a node drain. The webhook service has a memory leak and starts timing out. A broad match rule (all resources, all namespaces) turns a single-service outage into a cluster-wide write freeze. The failurePolicy setting forces a binary choice: Fail (block all matching writes when the webhook is down) or Ignore (allow unchecked writes). Neither is good. Fail-closed causes outages. Fail-open defeats the policy.',
        'The deeper problem is architectural. Webhooks require deploying, monitoring, scaling, and upgrading a separate service that sits between the API server and etcd. That service becomes the most critical dependency in the cluster after etcd itself, but it gets less operational attention. Every webhook is a latency tax on every matching write and a reliability risk during control-plane instability -- exactly when you most need policy enforcement to work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'ValidatingAdmissionPolicy (KEP-3488, GA in Kubernetes 1.30) moves policy evaluation inside the API server process. No webhook. No network call. No external service to keep alive.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Kubernetes_logo_without_workmark.svg/120px-Kubernetes_logo_without_workmark.svg.png',
          alt: 'Kubernetes wheel logo',
          caption: 'Kubernetes policy works best when common structural checks stay close to the API server path. Source: Wikimedia Commons, Kubernetes Authors, Apache License 2.0.',
        },
        {
          type: 'diagram',
          label: 'Admission flow',
          text: 'Client ---> API Server: [AuthN] ---> [AuthZ] ---> [Mutating Admission] ---> [Schema Validation] ---> [Validating Admission: CEL + Webhooks] ---> [Audit Log] ---> etcd',
        },
        'The mechanism uses three Kubernetes objects. A ValidatingAdmissionPolicy defines one or more CEL expressions that evaluate the admission request and return true (allow) or false (deny). A ValidatingAdmissionPolicyBinding connects the policy to a resource scope (which namespaces, which resource types, which operations) and declares the enforcement action: Deny, Warn, or Audit. An optional parameter resource (any cluster object referenced by the binding) supplies environment-specific values like allowed registries, required labels, or replica limits.',
        'When a matching write request arrives, the API server evaluates the CEL expressions in-process. The expression has access to object (the incoming resource), oldObject (the previous version on update), request (metadata like user, operation, namespace), and params (the referenced parameter resource). If any expression returns false, the action fires: Deny rejects the request, Warn returns the object but attaches a warning header, Audit persists the object but writes an audit annotation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on two properties. First, validating admission sees the final object. Mutating admission and schema validation have already run. No later phase will change the object before persistence. A CEL expression that checks object.spec.containers[0].image sees exactly what will be stored in etcd if the request is allowed. Second, CEL is deterministic and bounded. It has no side effects, no network access, no unbounded loops, and a compile-time cost estimate. The API server can enforce a maximum evaluation cost per policy, preventing a malicious or buggy expression from blocking the control plane.',
        'The availability argument is equally important. Because CEL runs inside the API server, it is available whenever the API server is available. There is no external dependency to fail, no network timeout to hit, no separate deployment to scale. The failure mode of the policy engine is the same as the failure mode of the API server itself. If you can write to the cluster, the policy is evaluated. That eliminates the entire class of "webhook is down, should we fail open or closed" problems.',
        'The limitation is explicit: CEL can only inspect data available in the admission request. It cannot fetch external state. Signature verification, provenance checks, vulnerability scans, and anything that requires a network call still needs a webhook or a cached-evidence pattern. CEL handles the "is this object shaped correctly" question. Webhooks handle the "does external evidence support this object" question.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CEL policy evaluation adds microseconds to the write path -- comparable to schema validation, orders of magnitude faster than a webhook round-trip (typically 5-50ms). The API server estimates CEL expression cost at compile time and rejects policies that exceed the cost budget, so evaluation time is bounded regardless of expression complexity.',
        'Operational cost is where the real savings appear. A webhook requires a Deployment, a Service, TLS certificates, health checks, resource requests, monitoring, PodDisruptionBudgets, and upgrade coordination. A ValidatingAdmissionPolicy requires two to three YAML objects. No pods to deploy. No TLS to rotate. No availability to monitor. For structural checks -- label requirements, image digest pinning, resource limit enforcement, field immutability -- the total cost of ownership drops sharply.',
        'The complexity tradeoff: CEL is less expressive than Rego or a general-purpose language. Complex policy graphs with cross-resource reasoning (e.g., "allow this Pod only if a matching NetworkPolicy exists") require either a webhook or a controller that pre-computes the answer into a label or annotation that CEL can inspect. The right split is usually CEL for object-local checks and webhooks for evidence that lives outside the admission request.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Shift-left security policies that inspect the object itself. Requiring image digests instead of tags, blocking privileged containers, enforcing resource limits, requiring specific labels, preventing hostPath mounts, enforcing field immutability on updates -- these are all pure functions of the admission request and are natural CEL expressions.',
        {
          type: 'code',
          language: 'yaml',
          text: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: require-digest-pinned-images
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["pods"]
  validations:
    - expression: >-
        object.spec.containers.all(c,
          c.image.contains('@sha256:'))
      message: "All container images must be pinned by digest (@sha256:), not by tag."`,
        },
        'Platform teams managing multi-tenant clusters benefit most. One ValidatingAdmissionPolicy with parameterized bindings per namespace replaces dozens of duplicated webhook rules. Dev gets lenient parameters, staging gets moderate ones, production gets strict ones -- all from the same policy object. Policy changes are standard Kubernetes API operations with RBAC, audit logging, and dry-run support built in.',
        'Organizations migrating from OPA/Gatekeeper or Kyverno can adopt ValidatingAdmissionPolicy incrementally. Start with Warn or Audit actions to verify the CEL expressions match existing policy behavior, then promote to Deny. The two systems can coexist during migration.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CEL cannot replace webhooks for checks that require external state. Image signature verification needs a call to a registry or Sigstore transparency log. SLSA provenance verification needs to fetch and validate an attestation bundle. Vulnerability scanning needs a database lookup. These require either a webhook or a controller that pre-caches verification results for CEL to inspect.',
        'Cross-resource policy is awkward. "Allow this Deployment only if a matching HorizontalPodAutoscaler exists" cannot be expressed in CEL because the admission request contains only the object being written. Workarounds exist (a controller that stamps a label, a parameter resource that lists approved combinations), but they add indirection. Rego and Kyverno handle cross-resource reasoning more naturally.',
        'Admission is not reconciliation. It makes a point-in-time decision about a single write request. It cannot detect drift, repair state, handle async workflows, or enforce invariants that span multiple objects over time. A Pod that passes admission today may become non-compliant tomorrow if the policy changes. Continuous compliance requires a controller that watches existing resources and flags or remediates violations -- admission only gates new writes.',
        {
          type: 'note',
          text: 'The fail-open vs. fail-closed tradeoff still exists for webhook-based checks. For CEL policies, the question disappears: the policy engine is always available because it runs inside the API server. This is the strongest operational argument for moving structural checks to CEL.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'KEP-3488: ValidatingAdmissionPolicy -- the design document for in-process CEL admission (kubernetes/enhancements repository).',
            'Kubernetes documentation: Admission Controllers, Dynamic Admission Control, ValidatingAdmissionPolicy (kubernetes.io/docs).',
            'CEL specification and Kubernetes CEL library reference for expression syntax and available functions.',
            'OPA/Gatekeeper documentation for comparison with Rego-based policy (openpolicyagent.org).',
            'Kyverno documentation for comparison with YAML-native policy (kyverno.io).',
            'Sigstore (sigstore.dev) for keyless image signing and verification patterns that feed webhook-based admission.',
          ],
        },
        'Study Kubernetes reconciliation next to understand what happens after an object passes admission and enters etcd. Study OPA/Rego if your policy requires cross-resource reasoning or complex decision graphs that exceed CEL expressiveness. Study Sigstore and SLSA provenance to understand the supply-chain verification that webhooks handle and CEL cannot. Study seccomp and AppArmor profiles to connect admission-time container restrictions to kernel-level runtime enforcement.',
      ],
    },
  ],
};
