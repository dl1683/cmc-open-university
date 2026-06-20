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
      heading: 'Why this exists',
      paragraphs: [
        'Application teams often need infrastructure without wanting every cloud-provider knob. Platform teams want to expose a stable product API while still owning networks, databases, policies, secrets, quotas, and lifecycle rules.',
        'Crossplane exists to turn Kubernetes into an infrastructure control plane. It lets platform teams define composite APIs, map those APIs to managed resources through Compositions, and let provider controllers reconcile external cloud resources.',
        {type:'callout', text:'Crossplane turns infrastructure from scattered provider knobs into a reconciled resource graph where a stable product API owns the contract and provider resources own implementation.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to give application teams Terraform modules, cloud console access, or raw provider APIs. That can work early, but every app team now has to understand provider details, dependency ordering, naming, status, and deletion.',
        'Another naive approach is to hide everything behind a thin internal service. That gives a friendly API, but often loses Kubernetes-native reconciliation, status, ownership metadata, and composable policy.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Infrastructure is a graph, not a single object. A production database may need a network, subnet group, IAM role, parameter group, backup policy, monitoring hook, connection secret, and deletion rule. If those dependencies are hidden in scripts, users see failures late and operators debug by archaeology.',
        'The second wall is API evolution. A platform API must stay stable for app teams while the implementation changes underneath. Composition changes are product changes, not private refactors.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model the platform product as a resource graph. A claim or composite resource captures user intent. An XRD defines the API. A Composition describes how intent becomes managed resources. Provider controllers reconcile those managed resources against external APIs.',
        'That graph gives each piece a role: intent, schema, implementation template, child resources, external provider state, readiness, references, and connection details.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the composition-graph view, follow intent downward. The claim is the product request, the composite resource is the platform API instance, the Composition is the implementation recipe, and the managed resources are the cloud-provider objects being reconciled.",
        "In the claim-reconcile view, read status upward. Provider controllers observe external resources, Crossplane writes conditions and connection details, and the claim becomes useful only when the graph reports enough readiness for the platform contract.",
        "The highlighted references are the important data structure. Infrastructure is not a list of YAML files; it is a dependency graph with ownership, readiness, secrets, finalizers, and external state attached to nodes.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team requests `ProductionPostgres` with size `medium`, region `us-east`, retention `30d`, and owner `payments`. The XRD defines those fields as the stable product API. The Composition turns that intent into a network attachment, database instance, parameter group, backup policy, monitoring rule, and connection secret. Provider controllers then reconcile each managed resource with the external cloud API.',
        'If the database instance is created but the secret is not ready, the graph is not fully ready. If the backup policy fails because of quota, the claim should surface a useful condition rather than leave the user staring at a pending object. The composed graph is valuable only if failure states travel back to the product API.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An XRD defines the custom API. An XR is an instance of that API. A namespaced claim can request an XR from an application namespace. A Composition tells Crossplane how to produce composed resources, often managed resources controlled by cloud providers.',
        'Composition functions and patches map fields, generate names, wire references, and write status back. Provider controllers reconcile managed resources with cloud APIs. Conditions such as Synced and Ready report whether reconciliation ran and whether the resource is usable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it separates intent from implementation. App teams ask for a product-level resource. Platform teams own the graph that fulfills it, including provider-specific choices and policy.',
        'It also works because reconciliation is continuous. Desired state, observed state, readiness, references, and connection details can keep converging instead of depending on one successful provisioning script.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Crossplane does not remove cloud complexity. Provider APIs still fail, quota still matters, finalizers still matter, and external drift can occur. A leaky composition that exposes every provider knob stops being a platform API. A vague composition that hides status and ownership becomes hard to debug.',
        'Synced and Ready are different. Synced means the controller could reconcile. Ready means the resource is considered usable. A database can be synced while still provisioning or while a dependency is missing.',
        'The control-plane cost includes watches, reconciliation loops, provider credentials, external API rate limits, secrets, and status propagation. The human cost is API design: deciding which fields are product promises and which are implementation details that platform teams can change later.',
      ],
    },
    {
      heading: 'API design guidance',
      paragraphs: [
        'A strong composite API exposes business intent: durability tier, region, size class, retention, owner, environment, deletion policy, and connection contract. It hides provider-specific sprawl unless that sprawl is truly part of the product. If every AWS, GCP, or Azure field leaks through, the platform has not created an abstraction; it has moved a cloud console into Kubernetes.',
        'Version the API like a product. A new Composition can change implementation details, but changing required fields, readiness meaning, deletion behavior, or secret shape can break application teams. Composition revisions and migration plans matter because infrastructure objects are long-lived.',
      ],
    },
    {
      heading: 'Operational failure modes',
      paragraphs: [
        'The hard incidents usually happen at the graph edges. A managed resource may be ready in the provider but missing a Kubernetes reference. A secret may rotate but not propagate to consumers. A finalizer may protect deletion but leave an external resource stuck. A provider API may rate-limit reconciliation, making the Kubernetes object look slow even though the composition logic is correct.',
        'Good platform teams design for those states explicitly. They expose conditions that name the blocked dependency, write connection details predictably, document deletion behavior, and keep enough event history to explain whether the failure is schema, composition, provider, quota, credentials, or external drift.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Crossplane is useful when platform teams want Kubernetes-native infrastructure products: databases, buckets, networks, identity bundles, observability stacks, or application environments with consistent policy and status.',
        'It is strongest when the composite API is intentionally smaller than the provider API. The platform should expose intent, ownership, size, region, retention, and lifecycle guarantees, not every implementation knob.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams treat composition as copy-pasted YAML instead of API design. Bad versioning, unclear ownership, hidden dependencies, missing status, unsafe deletion, and no drift story make the abstraction worse than raw cloud resources.',
        'It also fails when external resources are changed outside the control plane and the platform has no drift detection or reconciliation policy.',
        'It is also a poor fit when a platform team is not ready to own the lifecycle. A claim gives users a product promise. Someone must own upgrades, provider outages, quota errors, backup verification, secret rotation, and deletion safety behind that promise.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An application team creates a ProductionPostgres claim with size, region, retention, and owner fields. Crossplane creates an XR, selects a Composition, produces a network, subnet group, database instance, IAM policy, monitoring resource, and connection secret, then reports readiness.',
        'The application team sees one stable API while the platform team controls the implementation graph. Later, the platform can change the composition to add backups or observability, but it must preserve compatibility for existing claims.',
        'That compatibility is the educational point. The graph is not just how resources are built. It is the contract between platform and application teams: what users request, what the platform owns, what status means, what failures look like, and how implementation can improve without forcing every consumer to relearn cloud-provider details.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Crossplane composite resources docs at https://docs.crossplane.io/latest/composition/composite-resources/, Crossplane claims docs at https://docs.crossplane.io/v1.20/concepts/claims/, and Crossplane composition docs at https://docs.crossplane.io/latest/composition/compositions/.',
        'Study Kubernetes Reconciliation Case Study, Kubernetes Informer DeltaFIFO & Workqueue, Argo CD GitOps Application Reconcile, OpenAPI Contract Schema Evolution, OPA Rego Policy Decision Graph, Feature Flag Control Plane, and Distributed Tracing next.',
      ],
    },
  ],
};
