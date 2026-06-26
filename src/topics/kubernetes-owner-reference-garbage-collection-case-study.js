// Kubernetes garbage collection: owner references create a dependency graph,
// finalizers delay deletion, and propagation policy controls cleanup order.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-owner-reference-garbage-collection-case-study',
  title: 'Kubernetes Owner Reference Garbage Collection Case Study',
  category: 'Systems',
  summary: 'How ownerReferences form a dependency graph, finalizers block deletion for cleanup, and foreground, background, or orphan propagation decide dependent-object collection.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['owner graph', 'finalizer cleanup'], defaultValue: 'owner graph' },
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

function gcGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'owner', label: 'owner', x: 0.7, y: 4.2, note: notes.owner ?? 'Deployment' },
      { id: 'rs', label: 'RS', x: 2.6, y: 2.8, note: notes.rs ?? 'dependent' },
      { id: 'pod', label: 'Pod', x: 4.4, y: 2.8, note: notes.pod ?? 'child' },
      { id: 'svc', label: 'Svc', x: 2.6, y: 5.6, note: notes.svc ?? 'separate' },
      { id: 'oref', label: 'ownerRef', x: 4.4, y: 5.6, note: notes.oref ?? 'uid' },
      { id: 'delete', label: 'delete', x: 6.2, y: 4.2, note: notes.delete ?? 'timestamp' },
      { id: 'gc', label: 'GC', x: 7.8, y: 4.2, note: notes.gc ?? 'sweep' },
      { id: 'done', label: 'done', x: 9.3, y: 4.2, note: notes.done ?? 'removed' },
    ],
    edges: [
      { id: 'e-owner-rs', from: 'owner', to: 'rs' },
      { id: 'e-rs-pod', from: 'rs', to: 'pod' },
      { id: 'e-rs-oref', from: 'rs', to: 'oref' },
      { id: 'e-pod-oref', from: 'pod', to: 'oref' },
      { id: 'e-svc-oref', from: 'svc', to: 'oref' },
      { id: 'e-oref-delete', from: 'oref', to: 'delete' },
      { id: 'e-delete-gc', from: 'delete', to: 'gc' },
      { id: 'e-gc-done', from: 'gc', to: 'done' },
    ],
  }, { title });
}

function* ownerGraph() {
  yield {
    state: gcGraph('Owner references turn objects into a cleanup graph'),
    highlight: { active: ['owner', 'rs', 'pod', 'oref', 'e-owner-rs', 'e-rs-pod'], compare: ['svc'] },
    explanation: 'Kubernetes ownerReferences record which object owns another object. Garbage collection uses that graph to clean dependents when their owner is deleted.',
    invariant: 'Labels select related objects; ownerReferences express cleanup authority.',
  };

  yield {
    state: labelMatrix(
      'Owner reference fields',
      [
        { id: 'uid', label: 'uid' },
        { id: 'kind', label: 'kind' },
        { id: 'name', label: 'name' },
        { id: 'ctrl', label: 'ctrl' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'why', label: 'why' },
      ],
      [
        ['abc123', 'identity'],
        ['ReplicaSet', 'type'],
        ['web-7cc', 'debug'],
        ['true', 'main owner'],
      ],
    ),
    highlight: { active: ['uid:why', 'ctrl:why'], found: ['kind:why', 'name:why'] },
    explanation: 'The UID matters because names can be reused. A dependent should point at the exact owner instance, not merely another object that later received the same name.',
  };

  yield {
    state: labelMatrix(
      'Propagation policy',
      [
        { id: 'fg', label: 'foreground' },
        { id: 'bg', label: 'background' },
        { id: 'orphan', label: 'orphan' },
        { id: 'default', label: 'default' },
      ],
      [
        { id: 'order', label: 'order' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['children first', 'wait'],
        ['owner first', 'GC later'],
        ['keep kids', 'detach'],
        ['resource', 'varies'],
      ],
    ),
    highlight: { active: ['fg:effect', 'bg:effect', 'orphan:effect'], compare: ['default:order'] },
    explanation: 'Deletion propagation controls order. Foreground deletion waits on dependents, background deletion lets garbage collection continue after the owner is gone, and orphaning leaves dependents behind.',
  };

  yield {
    state: gcGraph('Complete case: deleting a Deployment cleans ReplicaSets and Pods', { delete: 'foreground', gc: 'children first', done: 'tree gone' }),
    highlight: { active: ['owner', 'rs', 'pod', 'delete', 'gc', 'done'], found: ['e-delete-gc', 'e-gc-done'] },
    explanation: 'Deleting a Deployment can cascade to ReplicaSets and Pods through the owner graph. The garbage collector follows references rather than guessing from labels alone.',
  };
}

function* finalizerCleanup() {
  yield {
    state: gcGraph('A finalizer turns delete into a two-phase operation', { delete: 'timestamp', gc: 'blocked', done: 'wait' }),
    highlight: { active: ['delete', 'gc'], removed: ['done'], found: ['owner'] },
    explanation: 'When an object has finalizers, deletion sets deletionTimestamp but does not remove the object immediately. A controller must finish cleanup and remove its finalizer key.',
  };

  yield {
    state: labelMatrix(
      'Finalizer ledger',
      [
        { id: 'mark', label: 'mark' },
        { id: 'clean', label: 'clean' },
        { id: 'remove', label: 'remove' },
        { id: 'collect', label: 'collect' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'owner', label: 'actor' },
      ],
      [
        ['timestamp', 'API'],
        ['external', 'ctrl'],
        ['finalizer', 'ctrl'],
        ['object', 'GC'],
      ],
    ),
    highlight: { active: ['mark:state', 'clean:state', 'remove:state'], found: ['collect:state'] },
    explanation: 'Finalizers are not callbacks executed by Kubernetes. They are keys that tell controllers to do cleanup before the API server is allowed to complete deletion.',
  };

  yield {
    state: gcGraph('Stuck finalizers are visible but require ownership review', { delete: 'old mark', gc: 'blocked', done: 'stuck' }),
    highlight: { active: ['delete', 'gc'], removed: ['done'], compare: ['svc'] },
    explanation: 'A stale finalizer can leave objects terminating forever. Removing it manually may leak external resources, so operators need to know which controller owns the key and what cleanup is pending.',
  };

  yield {
    state: labelMatrix(
      'Pitfalls',
      [
        { id: 'label', label: 'label' },
        { id: 'uid', label: 'name only' },
        { id: 'cross', label: 'cross-ns' },
        { id: 'final', label: 'finalizer' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['not ownership', 'ownerRef'],
        ['wrong object', 'use UID'],
        ['invalid owner', 'scope rules'],
        ['stuck delete', 'controller'],
      ],
    ),
    highlight: { active: ['label:bad', 'uid:bad'], found: ['cross:fix', 'final:fix'] },
    explanation: 'The cleanup graph is only as good as its edges. Confusing labels with ownership, ignoring UID, or adding finalizers without a reliable controller creates deletion debt.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'owner graph') yield* ownerGraph();
  else if (view === 'finalizer cleanup') yield* finalizerCleanup();
  else throw new InputError('Pick a Kubernetes garbage-collection view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The owner-graph view draws Kubernetes objects as nodes and ownerReferences as directed edges. A directed edge means the child object stores metadata naming the owner object and its UID. Follow those UID edges, not labels, when deciding cleanup.',
        'The finalizer view shows deletion as a state machine. A deletionTimestamp means the object is marked for deletion but still stored. The safe inference is that physical removal waits until every finalizer key has been removed by the responsible controller.',
        {type:'callout', text:'Owner references encode cleanup authority as UID edges, while finalizers preserve deletion work that garbage collection cannot perform alone.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes objects rarely live alone. A Deployment creates ReplicaSets, a ReplicaSet creates Pods, and a custom operator can create Secrets, Jobs, Services, and cloud resources. Deleting the parent should not leave children behind or guess which objects to remove.',
        'Garbage collection exists to turn lifetime into explicit metadata. Owner references cover dependent Kubernetes objects. Finalizers cover cleanup work that must happen before the object disappears, especially work outside the Kubernetes API.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to delete children by label or name. A controller could delete every Pod with app=web when the Deployment is deleted. In a small demo, labels often look like ownership.',
        'That approach is unsafe because labels are selectors, not lifetime contracts. A Service, monitor, NetworkPolicy, and dashboard may all use app=web without owning those Pods. Names are also unsafe because a new object can reuse an old name after the old UID is gone.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is overlapping relationships. One Pod can be selected by a Service, watched by metrics, matched by policy, and owned by a ReplicaSet. Only one of those relationships should control lifetime.',
        'Deletion also crosses crashes and time. A controller can create children and crash before cleanup. A parent can be deleted while dependents remain. A cleanup system needs durable identity and an explicit edge, not a fresh search over mutable labels.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Owner references form a directed dependency graph stored on dependents. Each edge records the owner API version, kind, name, UID, and control flags. The UID is the identity that prevents name reuse from transferring ownership to a different object.',
        'Finalizers are a second ledger, not another edge type. A finalizer key says deletion must pause while some controller performs cleanup. The controller removes its key only when it has finished or deliberately chosen not to do that cleanup.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A delete request usually marks the object with deletionTimestamp before storage removes it. The garbage collector watches objects, builds a graph from ownerReferences, and applies the deletion propagation policy. Background deletion can remove the owner first, foreground deletion keeps the owner until blocking dependents are gone, and orphan deletion detaches dependents.',
        'When finalizers are present, deletion becomes two phase. The API server records the timestamp and keeps the object visible. Controllers observe the terminating object, perform idempotent cleanup, and remove their finalizer key; only then can storage remove the object.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness starts with immutable identity. Because the edge points to a UID, the garbage collector follows the exact owner instance that created or adopted the dependent. A later object with the same name does not inherit that edge.',
        'The deletion state is monotonic. Once deletionTimestamp is set, the object is terminating, and controllers should treat cleanup as retryable. Removing the finalizer is the commit point saying the object no longer needs to stay stored for that cleanup job.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost is watch traffic, graph maintenance, and cleanup work. If a cluster has 100,000 objects and many controllers churn dependents, the garbage collector must keep an accurate dependency graph rather than update one local pointer. Foreground deletion can also hold the user-facing delete operation open until dependents are gone.',
        'Finalizers add user-space latency. A finalizer controlled by a broken operator can leave an object stuck in Terminating for hours. Cost as behavior means deletion speed now depends on controller health, RBAC, external APIs, and retry logic.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Owner references work for in-cluster lifetime chains such as Deployment to ReplicaSet to Pod, Job to Pod, and custom resource to child ConfigMaps or Secrets. They let Kubernetes clean up objects after parent deletion without a controller remembering every child in memory.',
        'Finalizers work for external or ordered cleanup. A database operator can keep a Database object visible while it snapshots, deletes a cloud disk, or archives a backup bucket. The finalizer makes the cleanup obligation visible and restart-safe.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Owner references are not a general relationship model. Routing, observation, selection, and policy are not ownership. Cross-namespace owner references also have scope rules, so not every object can own every other object.',
        'Finalizers fail when operators disappear or permissions change. Manual finalizer removal can be the right emergency action, but it skips the cleanup the key was protecting. That can leak load balancers, disks, DNS records, buckets, or child systems.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Database custom resource creates 1 StatefulSet, 2 Services, 1 Secret, and 1 cloud backup bucket. The StatefulSet, Services, and Secret are Kubernetes objects, so the operator sets ownerReferences to the Database UID. The bucket is external, so the operator adds finalizer example.com/delete-backup-bucket to the Database.',
        'When the user deletes the Database, the API server sets deletionTimestamp. The operator sees the terminating object, writes a final backup, deletes the bucket, and removes its finalizer. Then the garbage collector can remove the Database and cascade through the UID edges to the owned Kubernetes children.',
        'If the operator crashes after deleting the bucket but before removing the finalizer, retry must be safe. On restart, the operator should see that the bucket is already gone and remove the finalizer. That idempotence is what makes the deletion protocol reliable rather than lucky.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kubernetes garbage collection at https://kubernetes.io/docs/concepts/architecture/garbage-collection/, owners and dependents at https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/, and finalizers at https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/.',
        'Study Kubernetes controllers and reconciliation, Deployment rollout ownership, Reference Counting, Write-Ahead Log, Saga Pattern, idempotent cleanup, and cloud resource lifecycle management next. The core lesson is to separate selection from ownership and cleanup obligation.',
      ],
    },
  ],
};