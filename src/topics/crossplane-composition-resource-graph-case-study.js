// Crossplane composition: claims and composite resources reconcile into a
// graph of managed resources through composition templates and providers.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'crossplane-composition-resource-graph-case-study',
  title: 'Crossplane Composition Resource Graph Case Study',
  category: 'Systems',
  summary: 'An infrastructure control-plane primer: claims, composite resources, XRDs, Compositions, composed managed resources, provider controllers, references, and readiness.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['composition graph', 'claim reconcile'], defaultValue: 'composition graph' },
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

function crossplaneGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'claim', label: 'claim', x: 0.65, y: 3.8, note: notes.claim ?? 'XRC' },
      { id: 'xr', label: 'XR', x: 2.25, y: 3.8, note: notes.xr ?? 'composite' },
      { id: 'xrd', label: 'XRD', x: 3.95, y: 1.75, note: notes.xrd ?? 'API' },
      { id: 'comp', label: 'comp', x: 3.95, y: 5.85, note: notes.comp ?? 'template' },
      { id: 'fn', label: 'fn', x: 5.8, y: 3.8, note: notes.fn ?? 'patch' },
      { id: 'mr1', label: 'MR1', x: 7.45, y: 2.0, note: notes.mr1 ?? 'db' },
      { id: 'mr2', label: 'MR2', x: 7.45, y: 5.6, note: notes.mr2 ?? 'net' },
      { id: 'prov', label: 'prov', x: 9.15, y: 3.8, note: notes.prov ?? 'cloud' },
    ],
    edges: [
      { id: 'e-claim-xr', from: 'claim', to: 'xr', weight: '' },
      { id: 'e-xrd-xr', from: 'xrd', to: 'xr', weight: '' },
      { id: 'e-comp-xr', from: 'comp', to: 'xr', weight: '' },
      { id: 'e-xr-fn', from: 'xr', to: 'fn', weight: '' },
      { id: 'e-fn-mr1', from: 'fn', to: 'mr1', weight: '' },
      { id: 'e-fn-mr2', from: 'fn', to: 'mr2', weight: '' },
      { id: 'e-mr1-prov', from: 'mr1', to: 'prov', weight: '' },
      { id: 'e-mr2-prov', from: 'mr2', to: 'prov', weight: '' },
    ],
  }, { title });
}

function* compositionGraph() {
  yield {
    state: crossplaneGraph('A claim points to a composite resource graph'),
    highlight: { active: ['claim', 'xr', 'xrd', 'comp', 'e-claim-xr', 'e-xrd-xr', 'e-comp-xr'], compare: ['mr1', 'mr2'] },
    explanation: 'Crossplane lets platform teams expose higher-level APIs. A namespaced claim can point to a composite resource, whose API is defined by an XRD and whose implementation is selected through a Composition.',
  };

  yield {
    state: labelMatrix(
      'XRes',
      [
        { id: 'xrd', label: 'XRD' },
        { id: 'xr', label: 'XR' },
        { id: 'xrc', label: 'XRC' },
        { id: 'comp', label: 'comp' },
        { id: 'mr', label: 'MR' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['API', 'bad ver'],
        ['state', 'stuck'],
        ['tenant', 'scope'],
        ['plan', 'drift'],
        ['cloud', 'leak'],
      ],
    ),
    highlight: { active: ['xrd:role', 'xr:role', 'comp:role', 'mr:role'], compare: ['mr:risk'] },
    explanation: 'The resource graph has clear roles: XRD defines the API, XR is the composite instance, XRC is a namespaced claim, Composition describes how to make children, and managed resources are reconciled by providers.',
    invariant: 'The platform API should expose intent, not every cloud-provider knob.',
  };

  yield {
    state: crossplaneGraph('Composition functions and patches map intent to resources', { comp: 'pipeline', fn: 'patch', mr1: 'bucket', mr2: 'policy', prov: 'AWS/GCP' }),
    highlight: { active: ['xr', 'comp', 'fn', 'mr1', 'mr2', 'e-xr-fn', 'e-fn-mr1', 'e-fn-mr2'], found: ['prov'] },
    explanation: 'A Composition transforms the composite spec into child managed resources. Patches and composition functions can copy fields, generate names, connect references, and write status back to the composite.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'db', label: 'DB' },
        { id: 'net', label: 'net' },
        { id: 'iam', label: 'IAM' },
        { id: 'app', label: 'app' },
      ],
      [
        { id: 'child', label: 'child' },
        { id: 'ready', label: 'ready' },
      ],
      [
        ['RDS', 'conn'],
        ['VPC', 'subnet'],
        ['role', 'policy'],
        ['secret', 'ref'],
      ],
    ),
    highlight: { active: ['db:child', 'net:child', 'iam:child', 'app:ready'], compare: ['net:ready'] },
    explanation: 'Complete case study: a team claims a ProductionPostgres resource. Crossplane composes a network, database instance, IAM policy, connection secret, and status conditions. The app team sees one stable API; the platform team owns the resource graph.',
  };
}

function* claimReconcile() {
  yield {
    state: crossplaneGraph('Reconciliation propagates desired state and readiness back up', { claim: 'need DB', xr: 'spec', mr1: 'create', mr2: 'create', prov: 'API' }),
    highlight: { active: ['claim', 'xr', 'mr1', 'mr2', 'prov', 'e-claim-xr', 'e-fn-mr1', 'e-fn-mr2', 'e-mr1-prov', 'e-mr2-prov'], compare: ['xrd'] },
    explanation: 'The claim and XR hold desired state. Crossplane reconciles composed resources. Provider controllers reconcile managed resources against external cloud APIs. Readiness and connection details flow back up.',
  };

  yield {
    state: labelMatrix(
      'Ready',
      [
        { id: 'sync', label: 'sync' },
        { id: 'ready', label: 'ready' },
        { id: 'ref', label: 'ref' },
        { id: 'secret', label: 'secret' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'bad', label: 'bad' },
      ],
      [
        ['loop ok', 'API fail'],
        ['usable', 'slow ext'],
        ['link', 'missing'],
        ['conn', 'leak'],
      ],
    ),
    highlight: { active: ['sync:means', 'ready:means', 'secret:means'], compare: ['ref:bad'] },
    explanation: 'Synced and Ready are different. Synced says reconciliation ran successfully. Ready says the external resource is usable. A cloud API can accept the request while the database is still provisioning.',
  };

  yield {
    state: crossplaneGraph('Deletion requires finalizers and external cleanup', { claim: 'delete', xr: 'final', fn: 'cleanup', mr1: 'del', mr2: 'del', prov: 'cloud' }),
    highlight: { active: ['claim', 'xr', 'fn', 'mr1', 'mr2', 'prov', 'e-xr-fn', 'e-mr1-prov', 'e-mr2-prov'], removed: ['comp'] },
    explanation: 'Infrastructure controllers need deletion discipline. Finalizers keep Kubernetes objects around until external resources are cleaned up or intentionally orphaned. Otherwise a deleted object can leave cloud resources behind.',
  };

  yield {
    state: labelMatrix(
      'Ops',
      [
        { id: 'ver', label: 'ver' },
        { id: 'drift', label: 'drift' },
        { id: 'quota', label: 'quota' },
        { id: 'owner', label: 'own' },
      ],
      [
        { id: 'guard', label: 'guard' },
        { id: 'why', label: 'why' },
      ],
      [
        ['conv', 'API'],
        ['detect', 'truth'],
        ['limit', 'cost'],
        ['label', 'audit'],
      ],
    ),
    highlight: { active: ['ver:guard', 'quota:guard', 'owner:guard'], compare: ['drift:why'] },
    explanation: 'Operational case study: a platform team version-controls XRDs and Compositions, applies quotas, labels owners, observes external drift, and upgrades compositions carefully so old claims keep reconciling.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'composition graph') yield* compositionGraph();
  else if (view === 'claim reconcile') yield* claimReconcile();
  else throw new InputError('Pick a Crossplane composition view.');
}


export const article = { sections: [
  { heading: 'How to read the animation', paragraphs: [
    'The composition-graph view follows intent downward. Active nodes are the claim, composite resource, XRD, Composition, functions, and managed resources that turn a product request into provider objects.',
    'The claim-reconcile view reads status upward. Provider controllers observe external state, managed resources report conditions, the composite resource aggregates readiness, and the claim becomes useful only when the product contract is satisfied.',
  ] },
  { heading: 'Why this exists', paragraphs: [
    'Application teams often need databases, buckets, networks, identities, and secrets without learning every cloud-provider knob. Platform teams need to expose a stable product API while still owning lifecycle, policy, quotas, and provider drift.',
    'Crossplane turns Kubernetes into an infrastructure control plane. It represents infrastructure products as resources and reconciles a graph of child managed resources until observed state matches desired state.',
    {type:'callout', text:'Crossplane turns infrastructure from scattered provider knobs into a reconciled resource graph where a stable product API owns the contract and provider resources own implementation.'},
  ] },
  { heading: 'The obvious approach', paragraphs: [
    'The obvious approach is Terraform modules, cloud console access, or raw provider APIs. That can work early, but every application team now manages dependency order, credentials, deletion behavior, status, and provider quirks.',
    'Another approach is a thin internal service. It gives a friendly endpoint, but often loses Kubernetes-native reconciliation, ownership metadata, conditions, finalizers, and composition with other cluster resources.',
  ] },
  { heading: 'The wall', paragraphs: [
    'Infrastructure is a graph, not one object. A production database may need a VPC, subnet group, security policy, IAM role, parameter group, backup policy, monitoring rule, connection secret, and deletion rule.',
    'API evolution is the second wall. The platform must preserve the user-facing product contract while provider resources and implementation patterns change underneath long-lived claims.',
  ] },
  { heading: 'The core insight', paragraphs: [
    'Model the platform product as a reconciled resource graph. A claim is a namespaced request, an XR is the composite resource, an XRD defines the API, and a Composition describes the child resources that implement it.',
    'The invariant is separation of intent and implementation. Users see a small product API, while the platform owns provider-specific fields, references, readiness mapping, connection secrets, and upgrade behavior.',
  ] },
  { heading: 'How it works', paragraphs: [
    'An XRD defines schema and versions for a composite resource type. A claim or XR instance selects a Composition, and Crossplane runs patches or composition functions to produce managed resources such as cloud databases, networks, IAM policies, and secrets.',
    'Provider controllers reconcile those managed resources against external APIs. Status, conditions, references, and connection details flow back up so the claim can report whether the platform product is usable.',
  ] },
  { heading: 'Why it works', paragraphs: [
    'Reconciliation works because each controller repeatedly compares desired state with observed state and takes bounded actions to reduce the difference. Failed API calls, slow provisioning, and missing references become status, not hidden script output.',
    'The graph works because ownership is explicit. The composite resource owns composed resources, finalizers control deletion, references wire dependencies, and readiness checks decide when the product contract is met.',
  ] },
  { heading: 'Cost and complexity', paragraphs: [
    'The control-plane cost is more watches, reconciliation loops, provider credentials, API rate limits, secrets, and status propagation. A claim that creates 6 managed resources can create 6 external API loops plus the composite loop.',
    'The design cost is product API discipline. If the XRD exposes 80 provider fields, the abstraction has become a cloud console in YAML; if it exposes 3 vague fields and no useful status, users cannot debug failures.',
  ] },
  { heading: 'Real-world uses', paragraphs: [
    'Crossplane fits platform products such as ProductionPostgres, TeamBucket, NetworkBundle, ObservabilityStack, ServiceAccountWithPolicy, and AppEnvironment. The common pattern is a small stable API backed by multiple provider resources.',
    'It also fits GitOps platforms. Teams can review claims and composition revisions in Git, let controllers converge state, and use Kubernetes status as the shared operational surface.',
  ] },
  { heading: 'Where it fails', paragraphs: [
    'It fails when teams treat composition as copied YAML instead of API design. Hidden dependencies, vague readiness, unsafe deletion, missing drift policy, and poor versioning make the abstraction worse than raw cloud resources.',
    'It also fails when the platform team cannot own the promise. Someone must handle provider outages, quota errors, backup verification, secret rotation, upgrades, rollback, and finalizer stalls behind the claim.',
  ] },
  { heading: 'Worked example', paragraphs: [
    'A team creates ProductionPostgres with size=medium, region=us-east, retention=30d, and owner=payments. The Composition creates 6 children: network attachment, subnet group, database instance, parameter group, backup policy, and connection secret.',
    'If the database is ready after 9 minutes but the secret write fails, the claim is not ready. The status should say Ready=false, reason=ConnectionSecretBlocked, because the product contract is not a running database alone; it is a database plus usable connection details.',
  ] },
  { heading: 'Sources and study next', paragraphs: [
    'Primary sources: Crossplane composite resource docs, composition docs, composition functions docs, claims docs, managed resource docs, and Kubernetes controller-runtime reconciliation patterns. Study XRD versioning, readiness checks, references, and finalizers next.',
    'Then compare Kubernetes Informer Workqueue, Argo CD reconciliation, Terraform state, OpenAPI schema evolution, OPA policy graphs, and distributed tracing. The transferable idea is a graph of desired state, observed state, and ownership.',
  ] },
] };
