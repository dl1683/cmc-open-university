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

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Crossplane extends Kubernetes into an infrastructure control plane. Platform teams define custom composite APIs, map them to managed resources through Compositions, and let provider controllers reconcile external cloud resources. The data-structure lesson is a resource graph: claim, composite resource, XRD, Composition, composed managed resources, provider, status, and connection secrets.',
        'Primary sources: Crossplane composite resources docs at https://docs.crossplane.io/latest/composition/composite-resources/, Crossplane claims docs at https://docs.crossplane.io/v1.20/concepts/claims/, and Crossplane composition docs at https://docs.crossplane.io/latest/composition/compositions/.',
      ],
    },
    {
      heading: 'Composition graph',
      paragraphs: [
        'An XRD defines the custom API. An XR is an instance of that API. A namespaced claim can request an XR from an application namespace. A Composition tells Crossplane how to produce composed resources, often managed resources controlled by cloud providers. References and patches connect the graph.',
        'This is Kubernetes Reconciliation Case Study applied to infrastructure products. The desired state is not just a Pod or Service; it may be a database, network, policy, bucket, secret, and status bundle presented as one platform API.',
      ],
    },
    {
      heading: 'Readiness and references',
      paragraphs: [
        'Crossplane resources report conditions such as Synced and Ready. Synced means the controller could reconcile. Ready means the resource is considered usable. A resource can be synced but not ready while a cloud database is still provisioning or a dependency is missing.',
        'Connection details and references are part of the contract. A composed database may write a connection secret. A network resource may expose IDs that downstream resources need. The graph should make those dependencies explicit rather than hiding them in naming conventions.',
      ],
    },
    {
      heading: 'Complete case study: platform database',
      paragraphs: [
        'An application team creates a ProductionPostgres claim with size, region, retention, and owner fields. Crossplane creates an XR, selects a Composition, produces a network, subnet group, database instance, IAM policy, monitoring resource, and connection secret, then reports readiness. The application team sees one stable API while the platform team controls the implementation graph.',
        'The platform can later change the composition to add backups or observability, but it must preserve compatibility for existing claims. Composition versioning is API evolution, not a private refactor.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Crossplane is not a magic abstraction over every cloud problem. Provider APIs still fail, quota still matters, deletion still needs finalizers, and external drift can occur. A leaky composition that exposes every provider knob stops being a platform API. A vague composition that hides status and ownership becomes hard to debug.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Reconciliation Case Study, Kubernetes Informer DeltaFIFO & Workqueue, Argo CD GitOps Application Reconcile, OpenAPI Contract Schema Evolution, OPA Rego Policy Decision Graph, Feature Flag Control Plane, and Distributed Tracing next.',
      ],
    },
  ],
};
