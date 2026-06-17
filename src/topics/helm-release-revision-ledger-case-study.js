// Helm releases: chart templates and values render manifests, while release
// revisions preserve install, upgrade, rollback, and failure history.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'helm-release-revision-ledger-case-study',
  title: 'Helm Release Revision Ledger Case Study',
  category: 'Systems',
  summary: 'A Helm deployment primer: charts, values, templates, rendered manifests, release secrets, revision history, upgrades, rollbacks, and drift boundaries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['chart render', 'release rollback'], defaultValue: 'chart render' },
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

function helmGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'chart', label: 'chart', x: 0.75, y: 3.8, note: notes.chart ?? 'tpl' },
      { id: 'values', label: 'vals', x: 2.25, y: 2.1, note: notes.values ?? 'config' },
      { id: 'render', label: 'render', x: 2.25, y: 5.45, note: notes.render ?? 'engine' },
      { id: 'manifest', label: 'yaml', x: 4.25, y: 3.8, note: notes.manifest ?? 'objects' },
      { id: 'api', label: 'api', x: 5.95, y: 3.8, note: notes.api ?? 'apply' },
      { id: 'rev', label: 'rev', x: 7.55, y: 2.1, note: notes.rev ?? 'history' },
      { id: 'live', label: 'live', x: 7.55, y: 5.45, note: notes.live ?? 'cluster' },
      { id: 'roll', label: 'roll', x: 9.15, y: 3.8, note: notes.roll ?? 'back' },
    ],
    edges: [
      { id: 'e-chart-values', from: 'chart', to: 'values', weight: '' },
      { id: 'e-chart-render', from: 'chart', to: 'render', weight: '' },
      { id: 'e-values-render', from: 'values', to: 'render', weight: '' },
      { id: 'e-render-manifest', from: 'render', to: 'manifest', weight: '' },
      { id: 'e-manifest-api', from: 'manifest', to: 'api', weight: '' },
      { id: 'e-api-live', from: 'api', to: 'live', weight: '' },
      { id: 'e-api-rev', from: 'api', to: 'rev', weight: '' },
      { id: 'e-rev-roll', from: 'rev', to: 'roll', weight: '' },
      { id: 'e-roll-api', from: 'roll', to: 'api', weight: '' },
    ],
  }, { title });
}

function* chartRender() {
  yield {
    state: helmGraph('A chart plus values renders Kubernetes manifests'),
    highlight: { active: ['chart', 'values', 'render', 'manifest', 'e-chart-render', 'e-values-render', 'e-render-manifest'], compare: ['api'] },
    explanation: 'Helm packages Kubernetes resources as charts. A chart contains templates and defaults; values files and CLI overrides customize them; rendering produces concrete manifests sent to the Kubernetes API.',
  };

  yield {
    state: labelMatrix(
      'Chart',
      [
        { id: 'tpl', label: 'tpl' },
        { id: 'vals', label: 'vals' },
        { id: 'dep', label: 'dep' },
        { id: 'hook', label: 'hook' },
        { id: 'schema', label: 'schema' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['shape', 'bad gen'],
        ['input', 'drift'],
        ['sub', 'pin'],
        ['job', 'side fx'],
        ['guard', 'miss'],
      ],
    ),
    highlight: { active: ['tpl:role', 'vals:role', 'schema:role'], compare: ['hook:risk'] },
    explanation: 'The chart is a parameterized data structure. Templates define object shape, values supply environment-specific inputs, dependencies compose charts, hooks add lifecycle jobs, and schemas can catch bad values early.',
    invariant: 'Rendered manifests, not templates, are what the Kubernetes API receives.',
  };

  yield {
    state: helmGraph('Install and upgrade write a release revision ledger', { api: 'install', rev: 'v1/v2', live: 'objects' }),
    highlight: { active: ['manifest', 'api', 'rev', 'live', 'e-manifest-api', 'e-api-rev', 'e-api-live'], found: ['render'] },
    explanation: 'Helm tracks a release as a named series of revisions. Each install or upgrade records the rendered release state so history and rollback can refer to concrete prior revisions.',
  };

  yield {
    state: labelMatrix(
      'Rel',
      [
        { id: 'install', label: 'install' },
        { id: 'upgrade', label: 'upgrade' },
        { id: 'test', label: 'test' },
        { id: 'hist', label: 'hist' },
      ],
      [
        { id: 'obj', label: 'obj' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['rev 1', 'wait'],
        ['rev 2', 'atomic'],
        ['job', 'check'],
        ['list', 'audit'],
      ],
    ),
    highlight: { active: ['install:obj', 'upgrade:guard', 'hist:guard'], compare: ['test:obj'] },
    explanation: 'Complete case study: a service chart installs revision 1, upgrades to revision 2 with a changed image and values, records release history, runs tests, and can roll back if the new revision fails readiness or smoke tests.',
  };
}

function* releaseRollback() {
  yield {
    state: helmGraph('Rollback selects an older revision and reapplies it', { rev: 'v1 <- v3', roll: 'select', api: 'patch', live: 'restore' }),
    highlight: { active: ['rev', 'roll', 'api', 'live', 'e-rev-roll', 'e-roll-api', 'e-api-live'], compare: ['chart'] },
    explanation: 'Helm rollback is revision-based. The operator chooses a release revision, Helm renders or retrieves the stored release state, applies it to Kubernetes, and creates a new revision representing the rollback operation.',
  };

  yield {
    state: labelMatrix(
      'Back',
      [
        { id: 'pick', label: 'pick' },
        { id: 'apply', label: 'apply' },
        { id: 'wait', label: 'wait' },
        { id: 'record', label: 'record' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['rev', 'wrong'],
        ['patch', 'hook'],
        ['ready', 'hang'],
        ['new rev', 'audit'],
      ],
    ),
    highlight: { active: ['pick:state', 'apply:state', 'record:state'], compare: ['wait:risk'] },
    explanation: 'Rollback is not time travel for every external dependency. It can restore Kubernetes manifests, but database migrations, queues, object storage, and external services need their own compatibility plan.',
  };

  yield {
    state: helmGraph('GitOps plus Helm separates desired chart state from live state', { chart: 'chart', values: 'values', manifest: 'render', live: 'actual', rev: 'ledger' }),
    highlight: { active: ['chart', 'values', 'manifest', 'rev', 'live'], found: ['api'] },
    explanation: 'When Helm is used under GitOps, Git usually stores chart reference and values. The GitOps controller renders or invokes Helm and reconciles live state. Helm release history remains useful, but Git is still the desired-state source.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'img', label: 'img' },
        { id: 'cfg', label: 'cfg' },
        { id: 'db', label: 'DB' },
        { id: 'hook', label: 'hook' },
      ],
      [
        { id: 'change', label: 'change' },
        { id: 'safe', label: 'safe' },
      ],
      [
        ['tag', 'yes'],
        ['env', 'maybe'],
        ['mig', 'no'],
        ['job', 'idem'],
      ],
    ),
    highlight: { active: ['img:safe', 'db:safe', 'hook:safe'], compare: ['cfg:safe'] },
    explanation: 'Complete rollback case study: rolling back an image tag is usually safe, rolling back configuration may need feature compatibility, rolling back database schema is not automatic, and hooks must be idempotent because install, upgrade, and rollback can all execute operational jobs.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'chart render') yield* chartRender();
  else if (view === 'release rollback') yield* releaseRollback();
  else throw new InputError('Pick a Helm release view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes gives operators a powerful object API, but raw YAML does not by itself solve packaging, environment-specific configuration, upgrade history, or rollback. A real service usually needs a Deployment, Service, ConfigMap, Secret references, ingress or gateway configuration, service accounts, probes, autoscaling, and sometimes hooks or jobs. Copying those manifests between environments quickly turns into drift: one cluster has a different image tag, another changed a probe, and a third carries a manual hotfix nobody can explain.',
        'Helm exists to make that deployment shape reusable and to keep a release ledger for a named installation. A chart is a package of templates, defaults, metadata, optional dependencies, schema, and lifecycle hooks. Values customize the chart for a tenant, region, stage, or cluster. Rendering turns chart plus values into concrete Kubernetes manifests. Install, upgrade, history, and rollback then operate on a release: a named sequence of revisions for one deployment instance.',
        'The data-structure idea is not just "templates for YAML." It is a render pipeline plus an append-only release ledger. The render pipeline explains what Kubernetes should receive. The ledger explains what Helm believes it has released before and which previous revision can be reapplied during rollback.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The naive approach is to keep a directory of YAML files and run kubectl apply. That can work for a small service in one cluster. It becomes fragile when the same application has dev, staging, production, regional overrides, canary settings, and customer-specific options. People copy files, edit literal values, and lose track of which differences are intentional.',
        'A second naive approach is to generate YAML with a script and treat the output as disposable. This reduces duplication, but it often loses release identity. After an outage, the operator needs to know which exact chart version, values, image tag, and rendered objects were applied. A script that prints YAML does not automatically answer "what changed between revision 23 and revision 24?" or "which previous version should we roll back to?"',
        'A third naive approach is to rely on Git alone as rollback. Git is essential for desired state, but Git history and cluster release history are not the same object. A Git revert changes a repository. A Helm rollback applies a previous release revision to a live cluster and records a new revision.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to separate reusable package shape from release instances. The chart describes a parameterized application. Values describe one desired configuration. Rendering produces the Kubernetes objects for that configuration. The release ledger records the sequence of applied rendered states for a named release. This lets one chart support many deployments without pretending they are all the same deployment.',
        'A Helm revision is not a Git commit number or Kubernetes resource version. It is Helm\'s record of a release operation. Install creates revision 1. Upgrade creates revision 2, revision 3, and so on. Rollback selects an older revision, applies that older release state, and records another revision representing the rollback. The history tells what Helm did to this release.',
        'That ledger is why rollback can be a command rather than an archeology project. The operator can list release history, inspect prior values or manifests, choose a revision, and ask Helm to apply it. The command still works through the Kubernetes API; it writes a new desired object state into a cluster that may also contain controllers, hooks, manual edits, and external systems.',
      ],
    },
    {
      heading: 'How rendering works',
      paragraphs: [
        'A chart contains files that describe the package: Chart metadata, default values, templates, optional dependencies, tests, schema, and hooks. Templates are usually written with Go template syntax and helper functions. Values are layered from chart defaults, values files, and command-line overrides. Rendering evaluates the templates with the merged values and produces ordinary Kubernetes YAML.',
        'The Kubernetes API never receives the template as a template. It receives rendered manifests: Deployments, Services, ConfigMaps, Jobs, RBAC objects, CRDs, or whatever the chart emits. This boundary matters. A chart can be elegant and still render invalid or unsafe YAML. Schema validation, helm lint, template tests, dry runs, and admission policies all exist because the generated manifest is the real contract with the cluster.',
        'Values are powerful because they let the same chart express different environments. They are dangerous for the same reason. A boolean might disable a NetworkPolicy, a string might change an image repository, and a list might replace tolerations. Chart authors should treat values as an API.',
        'Dependencies compose charts. Hooks run jobs around install, upgrade, test, rollback, or delete events. Hooks help with migrations and smoke tests, but they are side effects. Helm can order and record hooks, but it cannot make arbitrary side effects reversible.',
      ],
    },
    {
      heading: 'How the ledger works',
      paragraphs: [
        'A release is identified by name and namespace. Helm stores release records in the cluster using its configured storage backend, commonly Kubernetes Secrets in Helm 3 defaults. Each record contains enough information for Helm commands such as history, status, get values, get manifest, upgrade, and rollback to reason about the release. Operators can also limit or prune history, so the ledger is useful but not infinite by default.',
        'On install, Helm renders the chart with values, sends the manifests to Kubernetes, runs hooks according to their lifecycle, and records revision 1. On upgrade, Helm renders a new target state, applies changes, and records the next revision. Options such as --wait and --atomic define when Helm treats the operation as successful and what happens after failure.',
        'Rollback selects a previous revision and applies that previous release state. The rollback itself creates a new revision. If revision 8 was good, revision 9 failed, and the operator rolls back to 8, the release may now show revision 10 as the rollback operation. That is not a contradiction. The current release state resembles revision 8, but the ledger also remembers that a rollback happened after revision 9.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The release ledger works because Helm treats a deployment as a named sequence of rendered states, not as a set of disconnected kubectl commands. Each revision records enough chart, values, manifest, and status information to explain what Helm tried to install or upgrade. That history gives rollback a concrete target instead of asking operators to reconstruct the last working YAML by memory.',
        'The invariant is revision order. A release name points to an ordered chain of attempts: deployed, superseded, failed, rolled back, or uninstalled. When an upgrade fails, Helm can compare the failed revision with the previous deployed revision and apply the older manifest set again. The ledger does not make Kubernetes resources magically safe, but it gives the operator a durable control-plane record to recover from.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The chart-render view is proving that there are two transformations before Kubernetes acts. First, chart and values combine into rendered manifests. Second, those manifests are applied through the Kubernetes API and reconciled by controllers. A value change can alter the rendered object even when the chart is unchanged; a template change can alter object shape with the same values.',
        'The release-ledger view is proving that history is tied to a named release, not to a generic chart. The chart may have many installations. Each installation has its own values, namespace, current revision, and prior revisions. Rollback chooses from that release\'s ledger. It does not ask "what did this chart look like somewhere else?" It asks "what previous state did this release record?"',
        'The rollback view is proving the boundary between Kubernetes objects and external reality. Helm can reapply an older manifest set, but it cannot automatically reverse a database migration, delete messages already sent to a queue, or undo writes made by a hook. The path from revision to API to live state is real, but it is not the whole production system.',
      ],
    },
    {
      heading: 'Failed upgrade case study',
      paragraphs: [
        'Consider a payments service chart running as revision 18. The team upgrades to revision 19 with a new image tag, a ConfigMap value, and a pre-upgrade migration hook. Readiness fails because the new image expects a feature flag absent in one region. Helm history now shows the failed or pending revision according to how the operation completed, and the live cluster may contain a mix of old and new resources.',
        'A careful rollback starts by choosing the last known good revision, not by guessing at YAML. The operator runs history, inspects values and manifest differences if needed, then rolls back to revision 18 with readiness checks. Helm applies the older release state and records a new revision for the rollback. Kubernetes controllers converge the workload toward that state.',
        'The hard part is the migration hook. If revision 19 changed a database schema compatibly, revision 18 may still run. If it made a destructive change, manifest rollback is not enough. Serious charts treat hooks as idempotent, observable, and compatible across rollback windows.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Helm reduces repetition, but it introduces a chart API that must be maintained. Values need names, defaults, validation, documentation, and compatibility discipline. Too many conditionals become a programming language hidden inside YAML. Too few options force forks.',
        'Release history and failure flags are tradeoffs. Keeping many revisions helps audit and rollback but consumes storage; pruning saves space but removes targets. Flags such as --wait, --timeout, --atomic, and --cleanup-on-fail define when an operation is successful and what cleanup happens after failure.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'The most common failure mode is template complexity. Charts can render valid YAML that expresses unsafe combinations: a disabled probe, an impossible resource request, a missing selector, or a value that changes immutable fields. Kubernetes may reject some errors, but many bad combinations are valid objects with bad operational behavior. Linting and schema help, but they do not replace review of the rendered manifest.',
        'The second failure mode is drift. Manual kubectl edits, mutating webhooks, controller-added fields, GitOps reconciliation, and emergency patches can make live state diverge from Helm\'s release record. Operators must know whether Helm, GitOps, or a platform controller owns each field.',
        'The third failure mode is assuming rollback equals recovery. Rollback is useful for bad images, bad environment variables, bad ConfigMaps, and many workload mistakes. It is weak for irreversible side effects, external services, data migrations, queue consumers, and CRD schema transitions. Production readiness means testing rollback paths and designing changes to be compatible across at least one release window.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references are the Helm using guide at https://helm.sh/docs/intro/using_helm/, the chart template guide at https://helm.sh/docs/chart_template_guide/, helm upgrade at https://helm.sh/docs/helm/helm_upgrade/, helm rollback at https://helm.sh/docs/helm/helm_rollback/, and helm history at https://helm.sh/docs/helm/helm_history/. In this curriculum, study Kubernetes Reconciliation Case Study, Kubernetes Deployment Rolling Update State Machine Case Study, Argo CD GitOps Application Reconcile Case Study, Flagger Progressive Delivery Canary Case Study, Git Internals, Transaction Savepoint Stack, Idempotency & Exactly-Once Delivery, and OpenAPI Contract Schema Evolution.',
      ],
    },
  ],
};
