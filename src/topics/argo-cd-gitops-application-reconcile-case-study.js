// Argo CD GitOps: desired manifests in Git are compared with live cluster
// state, then sync and health status drive reconciliation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'argo-cd-gitops-application-reconcile-case-study',
  title: 'Argo CD GitOps Application Reconcile Case Study',
  category: 'Systems',
  summary: 'A GitOps control-loop primer: Application specs, Git revisions, manifest generation, diff caches, sync waves, live state, health checks, and rollback paths.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sync loop', 'drift health'], defaultValue: 'sync loop' },
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

function argoGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'git', label: 'git', x: 0.65, y: 3.8, note: notes.git ?? 'rev' },
      { id: 'repo', label: 'repo', x: 2.0, y: 2.15, note: notes.repo ?? 'render' },
      { id: 'app', label: 'app', x: 2.0, y: 5.45, note: notes.app ?? 'spec' },
      { id: 'diff', label: 'diff', x: 3.85, y: 3.8, note: notes.diff ?? 'desired/live' },
      { id: 'api', label: 'api', x: 5.65, y: 2.15, note: notes.api ?? 'apply' },
      { id: 'live', label: 'live', x: 5.65, y: 5.45, note: notes.live ?? 'cluster' },
      { id: 'sync', label: 'sync', x: 7.5, y: 3.8, note: notes.sync ?? 'waves' },
      { id: 'health', label: 'health', x: 9.2, y: 3.8, note: notes.health ?? 'ready?' },
    ],
    edges: [
      { id: 'e-git-repo', from: 'git', to: 'repo', weight: '' },
      { id: 'e-git-app', from: 'git', to: 'app', weight: '' },
      { id: 'e-repo-diff', from: 'repo', to: 'diff', weight: '' },
      { id: 'e-app-diff', from: 'app', to: 'diff', weight: '' },
      { id: 'e-live-diff', from: 'live', to: 'diff', weight: '' },
      { id: 'e-diff-api', from: 'diff', to: 'api', weight: '' },
      { id: 'e-api-live', from: 'api', to: 'live', weight: '' },
      { id: 'e-diff-sync', from: 'diff', to: 'sync', weight: '' },
      { id: 'e-live-health', from: 'live', to: 'health', weight: '' },
      { id: 'e-sync-health', from: 'sync', to: 'health', weight: '' },
    ],
  }, { title });
}

function* syncLoop() {
  yield {
    state: argoGraph('Git revision plus Application spec define desired state'),
    highlight: { active: ['git', 'repo', 'app', 'diff', 'e-git-repo', 'e-git-app', 'e-repo-diff', 'e-app-diff'], compare: ['live'] },
    explanation: 'Argo CD treats Git as the desired-state source. The Application object points at a repo path, revision, destination cluster, namespace, and sync policy. Manifest generation turns that revision into Kubernetes objects to compare with live state.',
  };

  yield {
    state: labelMatrix(
      'Sync',
      [
        { id: 'rev', label: 'rev' },
        { id: 'gen', label: 'gen' },
        { id: 'diff', label: 'diff' },
        { id: 'apply', label: 'apply' },
        { id: 'prune', label: 'prune' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['sha', 'wrong env'],
        ['yaml', 'bad tpl'],
        ['delta', 'noise'],
        ['patch', 'fail'],
        ['rm', 'loss'],
      ],
    ),
    highlight: { active: ['rev:state', 'gen:state', 'diff:state', 'apply:state'], compare: ['prune:risk'] },
    explanation: 'The loop is a data pipeline: choose a Git revision, generate manifests, diff desired and live objects, apply missing changes, and optionally prune objects no longer declared. Each stage needs a clear failure mode.',
    invariant: 'Sync status answers whether live state matches Git, not whether the workload is healthy.',
  };

  yield {
    state: argoGraph('Sync waves order dependent Kubernetes resources', { sync: 'wave 0..N', api: 'apply', live: 'objects', health: 'wait' }),
    highlight: { active: ['diff', 'api', 'live', 'sync', 'health', 'e-diff-api', 'e-api-live', 'e-diff-sync', 'e-sync-health'], found: ['repo'] },
    explanation: 'A serious GitOps rollout needs ordering. CRDs, namespaces, RBAC, services, deployments, migrations, and jobs may need sync waves or hooks so later resources do not race ahead of prerequisites.',
  };

  yield {
    state: labelMatrix(
      'Wave',
      [
        { id: 'crd', label: 'CRD' },
        { id: 'ns', label: 'ns' },
        { id: 'cfg', label: 'cfg' },
        { id: 'app', label: 'app' },
        { id: 'job', label: 'job' },
      ],
      [
        { id: 'order', label: 'order' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['0', 'est'],
        ['1', 'ready'],
        ['2', 'valid'],
        ['3', 'roll'],
        ['4', 'done'],
      ],
    ),
    highlight: { active: ['crd:order', 'cfg:gate', 'app:gate', 'job:gate'], compare: ['ns:order'] },
    explanation: 'Complete case study: a platform team deploys a service by syncing CRDs first, then namespace and RBAC, then ConfigMaps and Secrets, then Deployment and Service, then a post-sync smoke-test Job. Git holds intent; sync waves encode dependency order.',
  };
}

function* driftHealth() {
  yield {
    state: argoGraph('OutOfSync and Healthy are separate status dimensions', { diff: 'sync?', live: 'status', health: 'health' }),
    highlight: { active: ['diff', 'live', 'health', 'e-live-diff', 'e-live-health'], compare: ['api'] },
    explanation: 'A resource can be synced to Git but unhealthy, or healthy but out of sync with Git. Argo CD surfaces both dimensions because compliance and runtime readiness are different questions.',
  };

  yield {
    state: labelMatrix(
      'Drift',
      [
        { id: 'manual', label: 'manual' },
        { id: 'mutate', label: 'mutate' },
        { id: 'gen', label: 'gen' },
        { id: 'ignore', label: 'ignore' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['kubectl', 'revert'],
        ['webhook', 'mask'],
        ['template', 'pin'],
        ['noise', 'rule'],
      ],
    ),
    highlight: { active: ['manual:fix', 'mutate:fix', 'gen:fix'], compare: ['ignore:fix'] },
    explanation: 'Diffing is harder than comparing text. Mutating webhooks, generated fields, server defaults, and controller-owned status can create noise. Ignore rules should be narrow, or drift detection becomes meaningless.',
  };

  yield {
    state: argoGraph('Rollback is a Git revision move plus reconciliation', { git: 'old sha', repo: 'render', diff: 'delta', api: 'apply', sync: 'rollback' }),
    highlight: { active: ['git', 'repo', 'diff', 'api', 'live', 'sync', 'e-git-repo', 'e-repo-diff', 'e-diff-api', 'e-api-live'], found: ['health'] },
    explanation: 'GitOps rollback should be auditable: revert or pin the Git revision, let the controller compute the diff, apply the prior desired state, and verify health. Direct cluster edits may be necessary in emergencies but should be reconciled back into Git.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'app', label: 'app' },
        { id: 'crd', label: 'CRD' },
        { id: 'sec', label: 'sec' },
        { id: 'db', label: 'DB' },
      ],
      [
        { id: 'drift', label: 'drift' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['image', 'health'],
        ['schema', 'wave'],
        ['rot', 'mask'],
        ['mig', 'hook'],
      ],
    ),
    highlight: { active: ['app:guard', 'crd:guard', 'db:guard'], compare: ['sec:drift'] },
    explanation: 'Complete case study: a hotfix changes a Deployment image in the cluster. Argo marks it OutOfSync. The team either reverts the manual edit or commits the new image tag to Git. The sync loop restores a single source of truth and health checks prove the application is actually ready.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sync loop') yield* syncLoop();
  else if (view === 'drift health') yield* driftHealth();
  else throw new InputError('Pick an Argo CD view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Argo CD is a GitOps controller for Kubernetes. It continuously compares desired application state from Git with live state in the cluster, reports sync and health status, and can apply changes automatically or manually. The data-structure lesson is the desired/live diff graph: Git revision, generated manifests, Application spec, live Kubernetes objects, sync operation, and health assessment.',
        'Primary sources: Argo CD docs at https://argo-cd.readthedocs.io/, automated sync policy at https://argo-cd.readthedocs.io/en/latest/user-guide/auto_sync/, and resource health docs at https://argo-cd.readthedocs.io/en/latest/operator-manual/health/.',
      ],
    },
    {
      heading: 'Sync loop',
      paragraphs: [
        'An Application points to a repository, path, target revision, destination, and sync policy. Argo CD renders manifests from Git, compares them with live objects, and marks the app Synced or OutOfSync. A sync operation applies desired objects and can prune resources that are no longer declared.',
        'This is Kubernetes Reconciliation Case Study with Git as the intent store. The controller does not need a CI pipeline to call the cluster directly. A commit changes desired state; the controller detects the diff and converges the cluster.',
      ],
    },
    {
      heading: 'Health and drift',
      paragraphs: [
        'Sync status is not health status. Synced means live manifests match desired manifests. Healthy means Kubernetes status and Argo health checks suggest the workload is operational. A Deployment can be synced but unavailable, or manually changed and still serving traffic.',
        'Drift detection needs discipline. Mutating webhooks, server-side defaults, status fields, generated names, and secret rotation can create noisy diffs. Ignore rules should be precise so they hide expected controller-owned fields without hiding real configuration drift.',
      ],
    },
    {
      heading: 'Complete case study: service hotfix',
      paragraphs: [
        'A production service has a bad image. An operator patches the Deployment directly with kubectl. Argo CD soon reports OutOfSync because live state no longer matches Git. The team commits the hotfix image to Git, or rolls the cluster back to the Git-declared image. Either way, the source of truth becomes explicit again.',
        'A more mature path uses sync waves: CRDs first, namespace and RBAC next, config and secrets after that, application workloads after dependencies, and smoke-test jobs at the end. Git stores intent, sync waves encode ordering, and health checks decide whether the rollout is ready.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'GitOps is not just saving YAML in Git. It is a reconciliation contract. If people routinely mutate the cluster by hand and never update Git, the diff signal becomes background noise. If auto-prune is enabled without ownership boundaries, accidental deletion can be fast and broad. Rollback is only reliable if Git revisions, generated manifests, migrations, and external dependencies are all understood.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Git Internals for the content-addressed source of truth, Kubernetes Reconciliation Case Study for the control-loop pattern, Kubernetes Informer DeltaFIFO & Workqueue for controller mechanics, Helm Release Revision Ledger for rendered chart state, Flagger Progressive Delivery Canary for traffic-gated rollout, Feature Flag Control Plane for exposure control, and Distributed Tracing for rollout observability.',
      ],
    },
  ],
};
