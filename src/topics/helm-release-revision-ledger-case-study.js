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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the visual as two connected data structures. The render path turns chart templates and values into Kubernetes manifests, while the release ledger records each named install, upgrade, failure, and rollback as a numbered revision.',
        'Active nodes are the current operation. A safe inference is that rollback chooses a previous Helm revision as input, applies that stored release state, and then records a new revision for the rollback operation.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes gives operators an object API, but raw YAML does not solve packaging, environment overrides, upgrade history, or rollback. A real service may need a Deployment, Service, ConfigMap, Secret references, probes, RBAC, ingress, hooks, jobs, and autoscaling.',
        'Helm exists to package that shape and keep a release ledger for one named installation. A chart is the reusable package; a release is one installed instance with its own values, namespace, status, and revision history.',
        {type:'callout', text:'Helm makes deployment recoverable by pairing a render pipeline with a release ledger: templates produce manifests, revisions preserve prior applied states.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep a directory of YAML files and run kubectl apply. That works for a small service in one cluster because the operator can still understand every object by inspection.',
        'A second simple approach is to generate YAML from a script. That reduces duplication, but it often loses release identity unless the script also records what it rendered, what it applied, and what prior state can be restored.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is drift plus recovery. Dev, staging, production, regional overrides, canary settings, and customer-specific patches create many nearly identical manifests that differ in ways nobody can audit quickly during an incident.',
        'Git history is not the same object as live release history. A Git revert changes a repository, while a cluster rollback must apply a previous release state to running Kubernetes resources and record that recovery action.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate package shape from release instances. The chart describes a parameterized application, values choose one configuration, rendering produces ordinary Kubernetes objects, and the release ledger records applied rendered states.',
        'A Helm revision is Helm\'s record of a release operation, not a Git commit and not a Kubernetes resource version. Install creates revision 1, upgrade creates later revisions, and rollback creates another revision that applies an older stored state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A chart contains metadata, default values, templates, optional dependencies, schema, tests, and hooks. Values are layered from chart defaults, values files, and command-line overrides, then templates render into Kubernetes manifests.',
        'The Kubernetes API never receives the chart as a chart. It receives rendered Deployments, Services, ConfigMaps, Jobs, RBAC objects, CRDs, or other resources, so validation must examine the rendered output.',
        'Helm stores release records in the cluster through its configured storage backend, commonly Kubernetes Secrets in Helm 3. Commands such as history, status, get values, get manifest, upgrade, and rollback read that ledger.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The ledger works because a release name points to an ordered sequence of attempts. Each revision records enough chart, values, manifest, and status information for Helm to reason about what it tried to install or upgrade.',
        'Rollback is correct for Helm-owned manifests because it has a concrete target: the earlier rendered release state. Kubernetes controllers then converge objects toward that state just as they would after any other apply.',
        'The correctness boundary is important. Helm can restore Kubernetes object definitions, but it cannot automatically undo a database migration, reverse a queue side effect, or make an unsafe hook reversible.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is maintaining a chart API. Values need names, defaults, schema, documentation, compatibility discipline, and tests, because users depend on those keys as much as they depend on function parameters.',
        'Revision history also has cost. Keeping 50 revisions gives better audit and rollback options than keeping 5, but it consumes cluster storage and can preserve old sensitive values if secret handling is careless.',
        'Flags such as wait, timeout, atomic, cleanup-on-fail, and history-max change behavior under failure. Those flags are not decoration; they define when an upgrade is considered successful and what cleanup is attempted after a bad release.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Helm fits platform teams that ship the same service shape into many clusters or environments. It is common for ingress controllers, monitoring stacks, databases, operators, internal services, and vendor packages.',
        'It also fits teams that need human-readable release history during incidents. Operators can ask which chart version and values produced revision 24, compare it with revision 23, and roll back without reconstructing YAML by hand.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Helm fails when templates become a hidden programming language. Too many conditionals make rendered behavior hard to predict, while too few options force users to fork the chart.',
        'It also fails when ownership is unclear. Manual kubectl edits, mutating webhooks, GitOps controllers, and platform operators can change live fields in ways the Helm ledger did not produce.',
        'Rollback fails as recovery when the release included irreversible side effects. Destructive migrations, external API writes, CRD schema breaks, and non-idempotent hooks need their own rollback design.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A payments chart is deployed as revision 18 with image pay:v18 and replicas set to 6. The team upgrades to revision 19 with image pay:v19, a new ConfigMap key, and a pre-upgrade migration hook.',
        'Readiness fails in one region because pay:v19 expects a feature flag that is absent. The operator checks history, chooses revision 18, and runs rollback; Helm reapplies the stored revision-18 manifest set and records revision 20 as the rollback action.',
        'The worked number is the ledger sequence: 18 is the last good state, 19 is the failed upgrade, and 20 is the rollback event. The current manifest may resemble 18, but the history still proves that 19 happened and that 20 reversed it at the Kubernetes-object layer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the Helm using guide, chart template guide, helm upgrade documentation, helm rollback documentation, and helm history documentation. Read them with the distinction between rendered manifest and release record in mind.',
        'Study Kubernetes Reconciliation, Kubernetes Deployment Rolling Update State Machine, Argo CD GitOps Application Reconcile, Progressive Delivery Canary, Transaction Savepoint Stack, Idempotency, and OpenAPI Contract Schema Evolution next.',
      ],
    },
  ],
};
