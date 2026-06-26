// Kubernetes reconciliation: controllers continuously move observed state
// toward declared desired state.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-reconciliation-case-study',
  title: 'Kubernetes Reconciliation Case Study',
  category: 'Systems',
  summary: 'Desired state, observed state, controller work queues, idempotent reconcile loops, and eventual convergence in Kubernetes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['desired vs actual', 'controller failures'], defaultValue: 'desired vs actual' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function controlPlane(title) {
  return graphState({
    nodes: [
      { id: 'user', label: 'kubectl/API client', x: 0.6, y: 3.8, note: 'declares intent' },
      { id: 'api', label: 'API server', x: 2.4, y: 3.8, note: 'validates writes' },
      { id: 'etcd', label: 'etcd state store', x: 4.2, y: 3.8, note: 'desired state' },
      { id: 'watch', label: 'watch stream', x: 5.8, y: 2.3, note: 'events' },
      { id: 'queue', label: 'work queue', x: 7.0, y: 2.3, note: 'keys to reconcile' },
      { id: 'controller', label: 'controller', x: 7.0, y: 4.7, note: 'reconcile loop' },
      { id: 'kubelet', label: 'kubelet', x: 8.8, y: 4.7, note: 'node agent' },
      { id: 'pod', label: 'Pod reality', x: 9.4, y: 2.3, note: 'actual state' },
    ],
    edges: [
      { id: 'e-user-api', from: 'user', to: 'api', weight: 'apply YAML' },
      { id: 'e-api-etcd', from: 'api', to: 'etcd', weight: 'persist spec' },
      { id: 'e-etcd-watch', from: 'etcd', to: 'watch', weight: 'watch' },
      { id: 'e-watch-queue', from: 'watch', to: 'queue', weight: 'enqueue key' },
      { id: 'e-queue-controller', from: 'queue', to: 'controller', weight: 'reconcile' },
      { id: 'e-controller-api', from: 'controller', to: 'api', weight: 'create/update objects' },
      { id: 'e-controller-kubelet', from: 'controller', to: 'kubelet', weight: 'scheduled Pod' },
      { id: 'e-kubelet-pod', from: 'kubelet', to: 'pod', weight: 'start container' },
    ],
  }, { title });
}

function* desiredVsActual() {
  yield {
    state: controlPlane('User declares desired state; controllers make it real'),
    highlight: { active: ['user', 'api', 'etcd', 'e-user-api', 'e-api-etcd'], compare: ['controller', 'pod'] },
    explanation: 'Kubernetes is not a command runner. Users declare desired state in the API. Controllers watch that state and keep trying to move actual cluster reality toward it.',
  };

  yield {
    state: labelMatrix(
      'Deployment wants three replicas; reality has one',
      [
        { id: 'spec', label: 'Deployment spec' },
        { id: 'observed', label: 'observed Pods' },
        { id: 'delta', label: 'delta' },
        { id: 'action', label: 'controller action' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['replicas=3', 'desired state'],
        ['ready=1', 'actual state'],
        ['missing=2', 'work to do'],
        ['create two Pods', 'converge'],
      ],
    ),
    highlight: { active: ['spec:value', 'observed:value', 'delta:value'], found: ['action:meaning'] },
    explanation: 'A reconcile loop compares desired and observed state, computes the delta, and issues idempotent operations. If it runs again before the world changes, it should make the same safe decision.',
    invariant: 'Reconcile functions must be safe to retry.',
  };

  yield {
    state: controlPlane('Events enqueue work; reconcile reads fresh state'),
    highlight: { active: ['watch', 'queue', 'controller', 'e-watch-queue', 'e-queue-controller'], found: ['api', 'etcd'] },
    explanation: 'Events are hints, not truth. A controller usually enqueues a key, then reads current state from the API server during reconcile. That avoids acting on stale event payloads.',
  };

  yield {
    state: labelMatrix(
      'Controller design rules',
      [
        { id: 'idempotent', label: 'idempotent' },
        { id: 'level', label: 'level-triggered' },
        { id: 'status', label: 'status subresource' },
        { id: 'backoff', label: 'backoff' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'failure', label: 'failure if absent' },
      ],
      [
        ['retries are normal', 'duplicate side effects'],
        ['state, not edge events', 'missed event breaks system'],
        ['separate observed state', 'spec/status conflict'],
        ['avoid hot loops', 'API server overload'],
      ],
    ),
    highlight: { found: ['idempotent:why', 'level:why', 'backoff:why'], compare: ['status:failure'] },
    explanation: 'The pattern generalizes beyond Kubernetes: declare intent, observe reality, reconcile safely, retry with backoff, and record status separately from desired spec.',
  };
}

function* controllerFailures() {
  yield {
    state: labelMatrix(
      'Failure surfaces in reconciliation',
      [
        { id: 'api', label: 'API conflict' },
        { id: 'external', label: 'external dependency' },
        { id: 'crash', label: 'controller crash' },
        { id: 'stale', label: 'stale cache' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['resourceVersion changed', 'refetch and retry'],
        ['cloud call failed', 'requeue with backoff'],
        ['loop stops briefly', 'work queue restores'],
        ['acts on old state', 'read before write'],
      ],
    ),
    highlight: { active: ['api:response', 'external:response', 'stale:response'], compare: ['crash:response'] },
    explanation: 'Controllers assume failure. Conflicts, stale caches, crashes, and external API errors are ordinary. The loop survives by making every action retryable and state-based.',
  };

  yield {
    state: controlPlane('The work queue absorbs retries and rate limits'),
    highlight: { active: ['queue', 'controller', 'e-queue-controller'], compare: ['api', 'etcd'] },
    explanation: 'A work queue gives the controller a buffer, deduplication point, and backoff surface. Without it, a noisy object or failing dependency can become an API-server hot loop.',
    invariant: 'Backpressure is part of the controller contract.',
  };

  yield {
    state: labelMatrix(
      'Spec versus status',
      [
        { id: 'spec', label: 'spec' },
        { id: 'status', label: 'status' },
        { id: 'generation', label: 'generation' },
        { id: 'conditions', label: 'conditions' },
      ],
      [
        { id: 'owner', label: 'written by' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['user', 'desired state'],
        ['controller', 'observed state'],
        ['API server', 'spec version'],
        ['controller', 'explain readiness'],
      ],
    ),
    highlight: { found: ['spec:purpose', 'status:purpose'], compare: ['conditions:purpose'] },
    explanation: 'Separating spec and status prevents controllers from fighting users. Users say what should exist. Controllers report what does exist and what is blocking convergence.',
  };

  yield {
    state: labelMatrix(
      'Case-study lesson',
      [
        { id: 'borg', label: 'Borg' },
        { id: 'k8s', label: 'Kubernetes' },
        { id: 'operator', label: 'custom operator' },
        { id: 'app', label: 'your app' },
      ],
      [
        { id: 'pattern', label: 'pattern' },
        { id: 'danger', label: 'danger' },
      ],
      [
        ['cluster desired state', 'scheduler complexity'],
        ['API object reconciliation', 'controller storms'],
        ['domain-specific controller', 'bad idempotency'],
        ['business workflow', 'hidden side effects'],
      ],
    ),
    highlight: { active: ['k8s:pattern', 'operator:pattern'], compare: ['app:danger'] },
    explanation: 'The reconciliation pattern is powerful because it turns one-shot commands into convergence. The danger is side effects: if reconcile sends emails, charges cards, or creates cloud resources, idempotency must be explicit.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'desired vs actual') yield* desiredVsActual();
  else if (view === 'controller failures') yield* controllerFailures();
  else throw new InputError('Pick a Kubernetes reconciliation view.');
}

