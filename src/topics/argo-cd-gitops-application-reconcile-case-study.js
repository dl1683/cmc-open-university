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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the sync-loop view as a controller pipeline. Active nodes show desired state being rendered, compared, applied, and checked against live Kubernetes objects.',
        'Read the drift-health view as two different questions. Sync says whether live objects match Git, while health says whether those objects appear ready to serve traffic.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes lets teams declare resources, but it does not decide which copy of a declaration is the source of truth. A Deployment can exist in Git, a Helm render, a CI job, and a manual cluster patch at the same time.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Kubernetes_logo_without_workmark.svg', alt: 'Kubernetes logo', caption: 'ArgoCD runs as a Kubernetes controller, continuously reconciling cluster state against Git-declared desired state. Source: Wikimedia Commons, CNCF, Apache 2.0' },
        'Argo CD exists to make desired state explicit and continuously checked. It compares a Git revision plus an Application spec with live cluster state, then reports drift and applies changes through a reconciliation loop.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious deployment design is a CI script that renders YAML and runs kubectl apply. It is simple, fast, and useful for small teams because the same job builds and deploys the application.',
        'Another obvious design is direct cluster operation during incidents. An operator patches a Deployment, scales replicas, or rolls back an image because the cluster is where the outage is happening.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is drift. A CI job may push once and stop watching, while manual edits, mutating webhooks, generated fields, autoscalers, and failed rollouts keep changing live state after deployment.',
        'The second wall is ordering and readiness. Applying a CRD, custom resource, Secret, Deployment, migration Job, and Service at the same time can race prerequisites, and matching YAML does not prove the workload is healthy.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make deployment a control loop. Git stores desired state, the cluster stores live state, and Argo CD repeatedly compares the two.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Kubernetes_logo.svg', alt: 'Kubernetes with text', caption: 'GitOps treats Git as the single source of truth — every cluster change is a Git commit, auditable and reversible. Source: Wikimedia Commons, CNCF, Apache 2.0' },
        { type: 'callout', text: 'The reconciliation loop is the heart of GitOps: compare desired state (Git) with actual state (cluster), compute the diff, and apply only what changed. ArgoCD runs this loop continuously.' },
        'The key invariant is that managed cluster state should be explainable from Git plus explicit ignore rules. If live state differs, Argo CD should surface the difference instead of letting it become hidden operational folklore.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An Application names a Git repository, path, target revision, destination cluster, destination namespace, and sync policy. The repo server renders manifests, and the controller compares those desired objects with live objects from the Kubernetes API.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Server infrastructure', caption: 'ArgoCD watches Git repositories and Kubernetes clusters simultaneously, detecting drift between declared and actual state. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0' },
        'If objects differ, the Application is OutOfSync. A sync applies desired objects, optionally prunes undeclared live objects, and uses hooks or waves to order dependent resources.',
        { type: 'callout', text: 'Sync waves and hooks give ArgoCD ordered deployment: databases before apps, migrations before services, health checks before traffic shifts. Without ordering, a GitOps push can break dependencies.' },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from a repeated set comparison. Each tracked resource is synced, out of sync, missing, extra, or ignored by an explicit rule, and a sync operation tries to reduce that difference.',
        'Git gives the loop durable intent history. A rollback is not a special hidden state; it is a commit, revert, or revision move that makes an older desired object set current again.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Argo CD adds a controller, render cache, RBAC design, diff customization, sync policy, and operational conventions. The cost is mostly semantic hygiene rather than raw CPU.',
        'When applications double, the controller does more comparisons and stores more state, but the harder growth is policy. Teams must define ownership, prune safety, field ignores, secret generation, environment promotion, and emergency override rules.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Argo CD fits Kubernetes delivery across many services, namespaces, and clusters. Git history becomes the deployment ledger, review becomes part of operations, and drift becomes visible.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Multi-cluster network', caption: 'ArgoCD can manage hundreds of clusters from a single control plane, scaling GitOps across global infrastructure. Source: Wikimedia Commons, The Opte Project, CC BY 2.5' },
        'It also fits platform teams that want CI to build artifacts without holding broad cluster credentials. Argo CD can own convergence while CI updates images or manifests through Git.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'GitOps fails when Git is treated as a suggestion. If operators routinely patch live resources without committing the result, Argo CD becomes an alarm that everyone learns to ignore.',
        { type: 'callout', text: 'Drift detection is not optional — it is the whole point. If someone kubectl-edits a resource directly, ArgoCD detects the divergence and can auto-heal or alert, depending on policy.' },
        'It also fails when the real dependency is outside declarative state. Databases, queues, DNS, cloud resources, and business migrations can make a Synced Application broken unless they are modeled or checked separately.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A service release contains 8 objects: a CRD, namespace, RBAC, ConfigMap, Secret reference, Deployment, Service, and smoke-test Job. Without ordering, the custom resource can appear before the CRD exists and the Job can run before endpoints are ready.',
        'The team uses wave 0 for the CRD, wave 1 for namespace and RBAC, wave 2 for config, wave 3 for Deployment and Service, and a post-sync Job after health. If a hotfix changes the image directly in the cluster, Argo CD marks OutOfSync until Git is updated or the cluster is restored.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Use the Argo CD overview, automated sync, sync phases and waves, diff customization, and resource health documentation as primary sources. Those pages define the controller model and the exact deployment state machine.',
        'Study Kubernetes reconciliation, informers and workqueues, Helm release history, progressive delivery, feature flags, and distributed tracing next. Then trace one Git commit through render, diff, sync, health, and rollback.',
      ],
    },
  ],
};