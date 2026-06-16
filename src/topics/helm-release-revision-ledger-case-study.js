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
      heading: 'What it is',
      paragraphs: [
        'Helm is a package manager for Kubernetes. A chart contains templates, default values, metadata, optional dependencies, hooks, and schemas. Helm combines a chart with supplied values, renders Kubernetes manifests, applies them to the cluster, and records release revisions for history and rollback.',
        'Primary sources: Helm using guide at https://helm.sh/docs/intro/using_helm/, Helm chart template guide at https://helm.sh/docs/chart_template_guide/, Helm rollback command at https://helm.sh/docs/helm/helm_rollback/, and Helm history command at https://helm.sh/docs/helm/helm_history/.',
      ],
    },
    {
      heading: 'Chart rendering',
      paragraphs: [
        'The template engine is the core data transformation: chart files plus values become YAML objects. That generated YAML is what Kubernetes sees. Values files let the same chart produce different manifests for dev, staging, production, regions, tenants, or feature gates.',
        'This connects to OpenAPI Contract Schema Evolution and JSON Parser Stack in spirit: a declarative artifact becomes a machine-readable contract. Here the contract is Kubernetes object shape, not an HTTP API. Schema validation and template tests reduce bad manifest generation before the API server rejects it.',
      ],
    },
    {
      heading: 'Revision ledger',
      paragraphs: [
        'A Helm release is a named deployment instance with revision history. Install creates the first revision. Upgrade creates the next revision. Rollback chooses an older revision and applies it, creating a new revision for the rollback. That ledger is why history, audit, and rollback are possible.',
        'Revision history is not a replacement for Git. In GitOps setups, Git remains the desired source; Helm is a rendering and release abstraction. Argo CD GitOps Application Reconcile can render Helm charts while still using Git for the declaration of what should be live.',
      ],
    },
    {
      heading: 'Complete case study: failed upgrade',
      paragraphs: [
        'A service chart upgrades from revision 8 to revision 9 with a new image, ConfigMap change, and migration hook. Readiness fails after deployment. Helm rollback selects revision 8, applies the older manifests, waits for readiness, and records revision 10 as the rollback. The team then inspects the hook, values diff, and release history before attempting a fixed revision 11.',
        'The data-structure lesson is a ledger with side effects. Kubernetes objects can be patched back, but external schema changes and operational hooks need explicit idempotency and compatibility planning.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A chart is not automatically safe because it renders. Template logic can hide invalid object combinations. Values can drift across environments. Hooks can make side effects that rollback does not undo. Release history can be pruned or unavailable if storage is mismanaged. And manual cluster edits can make Helm state, Git state, and live state disagree.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Reconciliation Case Study for the cluster control loop, Argo CD GitOps Application Reconcile for desired/live drift, Flagger Progressive Delivery Canary for metric-gated rollout, Git Internals for source revisions, Transaction Savepoint Stack for rollback intuition, and Idempotency for safe hooks.',
      ],
    },
  ],
};
