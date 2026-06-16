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
      heading: 'What it is',
      paragraphs: [
        'Kubernetes garbage collection removes dependent objects when their owners are deleted. The control plane follows ownerReferences, not just labels, to understand which objects are dependents.',
        'The garbage collection documentation explains owners and dependents and how owner references tell the control plane which objects depend on others: https://kubernetes.io/docs/concepts/architecture/garbage-collection/. Owner-reference semantics are described at https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The data structure is a directed dependency graph keyed by object UID. A dependent object stores ownerReferences with API version, kind, name, UID, controller flag, and blockOwnerDeletion flag. Deletion adds deletionTimestamp and propagation policy.',
        'Finalizers add a second layer. They are keys on resources that delay physical removal until a controller completes cleanup and removes the key: https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A Deployment owns a ReplicaSet, and the ReplicaSet owns Pods. Deleting the Deployment with foreground propagation marks the owner for deletion and waits for dependents to be deleted. If a cloud resource custom object has a finalizer, deletion pauses until its controller deletes the external resource and removes the finalizer.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Labels are not owner references. A Service may select Pods by label without owning them. Names are not enough because object names can be reused; UID carries identity. Finalizers are not code hooks, so a missing controller can leave resources stuck.',
        'Study next: Kubernetes Reconciliation for controller cleanup, Kubernetes Deployment Rolling Update for owner chains, Write-Ahead Log for deletion durability, and Reference Counting for the simpler in-process analogy.',
      ],
    },
  ],
};
