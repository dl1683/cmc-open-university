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

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Kubernetes reconciliation is the control-loop pattern at the heart of Kubernetes. Users write desired state to the API. Controllers watch objects, enqueue work, read current state, and keep trying to make reality match the declared spec.',
        'This is a production case study in level-triggered control. Events wake the controller, but state drives the decision. That is why the same reconcile function can run repeatedly and still be correct.',
        'The pattern is a distributed-systems answer to missed messages. A controller may miss a watch event, restart halfway through a cloud API call, or see a stale cache. The design still works because the next reconcile pass reads the object key again and derives action from durable desired state plus observed reality.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A user submits a Deployment. The API server validates and persists it in etcd. A controller observes the change, enqueues the object key, reads the latest spec and status, compares desired replicas with actual Pods, and creates or deletes objects to close the gap. Node agents then make local reality match assigned Pods.',
        'The status field records observed state. The spec field records desired state. Controllers should update status, not secretly rewrite user intent. Reconcile loops are idempotent, retryable, and protected by backoff.',
        'Ownership is explicit. Owner references connect children to parents, finalizers delay deletion until cleanup has completed, and resourceVersion conflicts force controllers to refetch before writing. These details prevent independent actors from overwriting each other while still allowing many controllers to cooperate through the API server.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The pattern creates eventual convergence, not instantaneous success. Controllers need caches, watches, work queues, rate limits, conflict retries, finalizers, status conditions, and careful ownership rules. Kubernetes Informer DeltaFIFO & Workqueue Case Study breaks down that cache/watch/queue layer. A bad controller can overload the API server or create duplicate external resources.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Kubernetes controllers manage Deployments, ReplicaSets, Jobs, Services, endpoints, nodes, certificates, storage volumes, and custom operators. The same pattern applies to cloud control planes, infrastructure-as-code systems, data pipelines, and any service that can declare desired state and converge safely.',
        'A useful complete case study is a certificate operator. The desired object says a certificate should exist for a domain. The controller creates an external order, records progress in status, waits for validation, stores the secret, renews before expiry, and uses finalizers to clean external state on deletion. Every step must survive retries.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A reconcile loop is not an event handler. It should not assume it saw every event or that the event payload is fresh. It must read current state and make safe progress. Side effects need idempotency keys, finalizers, and explicit status because retries are normal.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kubernetes Controllers documentation at https://kubernetes.io/docs/concepts/architecture/controller/ and Kubebuilder good practices at https://book.kubebuilder.io/reference/good-practices.html. Study Kubernetes Informer DeltaFIFO & Workqueue Case Study, Kubernetes Scheduler Priority Queue & Preemption Case Study, Borg Cluster Scheduler Case Study, Idempotency Keys, Backpressure, Leader Replacement, Kubernetes Admission Policy Gate, OPA Rego Policy Decision Graph, and Distributed Tracing next.',
      ],
    },
  ],
};
