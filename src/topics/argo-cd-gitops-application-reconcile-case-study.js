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
      heading: 'Why this exists',
      paragraphs: [
        `Kubernetes gives teams an API for declaring resources, but it does not by itself answer a harder operational question: which copy of the declaration is the source of truth? If a deployment exists in Git, in a rendered Helm chart, in a CI job, in a cluster, and in an emergency kubectl patch, the system can be running while nobody knows which state is intended.`,
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Kubernetes_logo_without_workmark.svg', alt: 'Kubernetes logo', caption: 'ArgoCD runs as a Kubernetes controller, continuously reconciling cluster state against Git-declared desired state. Source: Wikimedia Commons, CNCF, Apache 2.0' },
        `Argo CD exists to make that question explicit. It is a Kubernetes controller that compares desired application state from a Git revision with live state in a cluster. When live state deviates from the desired target, the application becomes OutOfSync. A sync operation applies the desired manifests, optionally prunes objects no longer declared, and then health checks decide whether the workload is actually ready.`,
        `The data-structure lesson is a reconciliation graph. The nodes are Git revision, Application spec, manifest generator, desired object set, live object set, diff result, sync operation, and health status. The edges are not just deployment steps. They preserve the contract that Git says what should exist, the cluster says what does exist, and the controller keeps comparing the two.`,
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        `The first deployment design is a script or CI pipeline that runs kubectl apply. It is simple and useful. A commit triggers a job, the job renders YAML, the job talks to the cluster, and the cluster stores the result. Many teams start here because it has few moving parts and gives fast feedback.`,
        `The second design is direct cluster administration. Operators patch resources during incidents, scale deployments by hand, edit ConfigMaps, or roll back images with kubectl. This is also reasonable in an emergency. The cluster is the system of record for what is serving traffic right now, so direct edits feel like the shortest path from problem to fix.`,
        `Both approaches break down when they become normal practice. A CI apply job may succeed once and then stop watching. A manual patch may fix production but never reach Git. A rollback may restore an old Deployment while leaving a migration, Secret, or CRD in a newer shape. The missing piece is continuous comparison between intended state and actual state.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is drift. Live state changes after deployment because people patch it, controllers mutate it, webhooks default fields, status fields change, secrets rotate, autoscalers update replica counts, and failed rollouts leave partial state behind. If the deployment system only pushes changes, it may never notice that the cluster has wandered away from Git.`,
        `The second wall is that matching YAML does not mean a healthy service. A Deployment can be Synced and still have no available replicas. A StatefulSet can match the desired manifest while waiting on storage. A Job can be applied but failed. Compliance and readiness are separate questions, so a useful GitOps controller must report both sync status and health status.`,
        `The third wall is ordering. Kubernetes resources are not all independent. CRDs should exist before custom resources. Namespaces and RBAC should exist before workloads that use them. Config, Secrets, database migrations, Deployments, Services, and smoke-test Jobs may need phases, hooks, or sync waves. A flat apply of all manifests can race its own prerequisites.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to turn deployment into a control loop. Git is the desired-state store. The cluster is the live-state store. Argo CD repeatedly renders the desired manifests, reads live Kubernetes objects, computes a diff, and drives the live state back toward the desired state when a sync is requested or automation is enabled.`,
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Kubernetes_logo.svg', alt: 'Kubernetes with text', caption: 'GitOps treats Git as the single source of truth — every cluster change is a Git commit, auditable and reversible. Source: Wikimedia Commons, CNCF, Apache 2.0' },
        { type: 'callout', text: 'The reconciliation loop is the heart of GitOps: compare desired state (Git) with actual state (cluster), compute the diff, and apply only what changed. ArgoCD runs this loop continuously.' },
        `This is the same reconciliation pattern used by Kubernetes controllers, but the intent source is outside the cluster. The Application object tells Argo CD where to find the repo, which path and revision to render, and where to apply the result. That separates change approval from cluster mutation. A commit changes intent; the controller performs convergence.`,
        `The important split is sync versus health. Sync asks whether live objects match desired manifests. Health asks whether those objects appear operational according to resource-specific checks. A GitOps system that collapses those two signals can say "deployed" when it only means "applied."`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `An Argo CD Application combines desired source and destination. The source names a Git repository, path, and target revision. The destination names a Kubernetes cluster and namespace. The sync policy controls whether Argo CD applies changes automatically or waits for a manual sync. The controller and repo server turn the selected revision into manifests, then compare those manifests with live objects from the Kubernetes API.`,
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Server infrastructure', caption: 'ArgoCD watches Git repositories and Kubernetes clusters simultaneously, detecting drift between declared and actual state. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0' },
        `If desired and live state differ, Argo CD reports OutOfSync. A sync operation applies missing or changed desired objects. If pruning is enabled, it can delete objects that are live but no longer declared. Sync options, hooks, and waves refine this basic operation by controlling apply behavior and resource ordering. Health assessment runs separately and rolls resource health into the Application health view.`,
        { type: 'callout', text: 'Sync waves and hooks give ArgoCD ordered deployment: databases before apps, migrations before services, health checks before traffic shifts. Without ordering, a GitOps push can break dependencies.' },
        `A rollback is the same loop in reverse. Instead of treating rollback as a special cluster command, the team moves Git intent to an older known-good revision or commits a revert. Argo CD renders that desired state, computes the diff from current live state, applies the change, and checks health. Emergency direct edits can still happen, but they become visible drift until Git is updated or the cluster is reconciled back.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument is an invariant over desired and live object sets. After each comparison, every tracked resource is either in sync, out of sync, missing, extra, or ignored by an explicit rule. A sync operation attempts to reduce that difference by applying desired resources and optionally pruning extras. Because the controller keeps running, reconciliation is not a one-shot deployment event.`,
        `Git gives the loop a durable intent history. A commit has an author, timestamp, review trail, and content-addressed identity. That makes deployment state easier to audit than a sequence of unrecorded cluster edits. The controller does not need the CI system to keep a privileged cluster token and remember every object it touched. The commit is the input; the controller owns convergence.`,
        `Health checks complete the argument by preventing a false success signal. Applying a Deployment object only proves the API server accepted the manifest. Health waits for observed generation, updated replicas, availability, or custom resource logic depending on type. The sync loop answers "does the cluster match Git"; health answers "does the matched thing appear ready."`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `A platform team deploys a service with a CRD-backed operator. The desired repo contains the CRD, namespace, RBAC, ConfigMap, Secret reference, Deployment, Service, and a post-sync smoke-test Job. If all of those objects are applied at once, the custom resource may be submitted before the CRD exists, the Deployment may start before config is valid, and the smoke test may run before the service has endpoints.`,
        `The team adds ordering. The CRD goes in an early wave. Namespace and RBAC follow. Config and Secret references come next. The Deployment and Service roll after their prerequisites. The post-sync Job runs after the workload is expected to be available. Git stores the desired state, sync waves encode dependency order, and health checks decide whether the rollout can be trusted.`,
        `Now a production incident occurs. An operator patches the Deployment image directly to stop an outage. Argo CD marks the Application OutOfSync because live state no longer matches Git. The team has two honest choices: commit the hotfix image to Git, making it the new desired state, or revert the cluster to the Git-declared image. Either way, drift is not allowed to become invisible tradition.`,
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        `The sync-loop view follows the dataflow from Git revision and Application spec into rendered manifests, then into the desired/live diff, sync operation, Kubernetes API, live objects, and health assessment. The matrix names the risk at each stage: wrong revision, bad template, noisy diff, failed apply, or dangerous prune.`,
        `The drift-health view separates two axes that learners often merge. OutOfSync is a comparison result. Healthy is a runtime assessment. The rollback frame shows that GitOps rollback is not a panic button hidden outside the model; it is another desired-state change that the reconciliation loop applies and verifies.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Argo CD adds a controller, repo rendering, cache state, RBAC design, and operational policy. The payoff is continuous comparison, but the cost is that every source of mutation now needs a clear owner. If another controller or operator changes fields that Argo CD thinks it owns, the app can flap between OutOfSync and Synced. If ignore rules are too broad, real drift disappears inside an exception.`,
        `Automatic sync reduces manual deployment work but increases the blast radius of a bad commit. Auto-prune keeps clusters clean but can delete resources quickly if ownership boundaries are wrong. Sync waves reduce dependency races but add rollout modeling work. Hooks can encode migrations and smoke tests, but failed hooks become part of the deployment state machine.`,
        `The dominant cost in practice is not CPU time. It is semantic hygiene. Teams must decide which resources are managed by Argo CD, which fields are controller-owned, how secrets are generated, how environments are promoted, who can override live state, and how emergency changes are reconciled back into Git.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Argo CD wins when teams need auditable Kubernetes delivery across many services or clusters. Git history becomes the deployment ledger. Review workflows become part of operations. A cluster that drifts from Git is visible. A rollback can be expressed as a revision move rather than a manually reconstructed command sequence.`,
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Multi-cluster network', caption: 'ArgoCD can manage hundreds of clusters from a single control plane, scaling GitOps across global infrastructure. Source: Wikimedia Commons, The Opte Project, CC BY 2.5' },
        `It also wins when platform teams want separation of duties. CI can build images and update manifests without holding broad cluster credentials. Argo CD can run inside the cluster or management plane with the permissions needed to reconcile applications. That makes deployment less dependent on one CI runner being both builder and cluster administrator.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `GitOps fails when Git is treated as a suggestion. If operators routinely patch live resources and never commit the result, Argo CD becomes a drift alarm that everyone learns to ignore. If generated manifests are not deterministic, the diff signal becomes noisy. If secrets, external databases, DNS, and cloud resources are outside the model, a Synced app can still fail because its real dependencies are not represented.`,
        `It is also the wrong tool for changes that cannot be safely represented as declarative desired state. Some incident actions are exploratory. Some data migrations require transactional application logic. Some rollbacks cannot undo external side effects. Argo CD can orchestrate hooks and surface health, but it cannot make an unsafe operational plan safe by putting YAML in Git.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The first failure mode is diff noise. Mutating webhooks, server defaults, managed fields, status updates, and generated values can make every comparison look dirty. The fix is narrow diff customization, not hiding whole resources. The second is prune loss. If a manifest disappears because of a bad path, branch, or generator error, automated pruning can delete live resources that were still needed.`,
        { type: 'callout', text: 'Drift detection is not optional — it is the whole point. If someone kubectl-edits a resource directly, ArgoCD detects the divergence and can auto-heal or alert, depending on policy.' },
        `The third is false health. A resource may pass a built-in health check while the application is still broken at the business level. Smoke-test Jobs, progressive delivery, metrics, and tracing can add evidence, but they need to be modeled explicitly. The fourth is rollback illusion. Reverting manifests does not automatically revert databases, queues, external APIs, or customer-visible side effects.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Argo CD overview at https://argo-cd.readthedocs.io/, automated sync policy at https://argo-cd.readthedocs.io/en/latest/user-guide/auto_sync/, sync phases and waves at https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/, and resource health at https://argo-cd.readthedocs.io/en/latest/operator-manual/health/.`,
        `Study Git Internals for the source-of-truth ledger, Kubernetes Reconciliation Case Study for the controller pattern, Kubernetes Informer DeltaFIFO and Workqueue for controller mechanics, Helm Release Revision Ledger for rendered chart history, Flagger Progressive Delivery Canary for traffic-gated rollout, Feature Flag Control Plane for exposure control, and Distributed Tracing for verifying a rollout beyond Kubernetes status.`,
      ],
    },
  ],
};
