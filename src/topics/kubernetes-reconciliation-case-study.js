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
      heading: 'Why this exists',
      paragraphs: [
        "Kubernetes exists to run desired state, not to run one command and hope the cluster stays that way. A user says there should be three replicas, a service endpoint, a certificate, a volume, or a namespace policy. The cluster then has to keep that intent true while nodes fail, containers crash, networks partition, and operators change objects at the same time.",
        "Reconciliation is the control-loop pattern that makes this possible. Desired state is stored in the API server and etcd. Controllers observe that state, compare it with actual state, and make small repairs. If reality already matches the spec, the controller does nothing. If reality has drifted, the controller issues another create, update, delete, or status write.",
        "The important shift is that Kubernetes treats failure as normal. A controller can miss a watch event, crash after creating a child object, see a stale cache, or lose a race with another writer. The system still has a path back to correctness because the next reconcile pass reads durable state again and computes the gap from scratch.",
        {type:"callout", text:"Reconciliation works because the desired state survives worker failure and every retry recomputes the gap from durable cluster truth."}
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        "The naive approach is an event handler. When the user creates a Deployment, run code that creates three Pods. When the user updates the replica count, run code that adds or removes Pods. When a Pod dies, run code that replaces it. This sounds natural because most application code is written around events.",
        "It breaks because distributed systems do not deliver a clean single story. Events can be duplicated, delayed, coalesced, or missed during reconnects. The handler may crash after making a side effect but before recording that it did so. The object may have changed by the time the handler runs. A second controller may write a related object. If the handler trusts the event payload as truth, it can repair the wrong world.",
        "Another naive approach is a command runner. Submit a script that creates the resources and exits. That works for initial setup, but it has no answer for day two. If a node disappears, if an external load balancer loses configuration, or if a human deletes a child object, the command is gone. The cluster needs a loop, not a receipt."
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is level-triggered control. The controller should care about the current level of the world, not the edge that woke it up. An event says something might have changed. It is only a hint to enqueue work. The reconcile function should then read the current object, read or list the related objects it owns, compare desired and observed state, and decide the next safe action.",
        "This is why idempotency is not optional. A reconcile function may run many times for the same object while nothing changes. It may also run again after only half of its previous work succeeded. Creating a child object should be safe when the object already exists. Updating status should reflect observed facts, not advance a hidden local state machine. Retrying should move the system toward the same target instead of multiplying side effects."
      ],
    },
    {
      heading: 'The mechanism',
      paragraphs: [
        "A typical controller is built from a watch, a cache, a work queue, and a reconcile function. The watch notices changes to relevant objects. The cache keeps local copies so the controller does not hammer the API server for every observation. The work queue stores object keys, often namespace and name, and applies deduplication and rate limiting. The reconcile function receives a key and reads fresh enough state before acting.",
        "For a Deployment, the desired state is the replica count and pod template. The observed state is the set of owned Pods and their readiness. If the spec wants three replicas and only one ready Pod exists, the controller creates more child objects. If too many exist, it deletes or scales down. The kubelet then runs the assigned Pods on nodes, and other controllers update endpoints, service routing, or status conditions.",
        "Kubernetes separates spec from status because users and controllers have different jobs. Spec is intent and should usually be written by a user, higher-level controller, or API client. Status is observation and should be written by the controller responsible for the resource. Generation numbers, observedGeneration, resourceVersion, owner references, and finalizers are part of the same contract: cooperate through shared state without pretending there is only one writer."
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        "The first visual proves that Kubernetes is not a direct path from user to Pod. The user writes intent to the API server. etcd stores it. A watch stream wakes controllers. A queue holds work. The controller writes more API objects or updates status. The kubelet makes local node reality match assigned work. The Pod is the end of a loop, not the immediate result of a command.",
        "The matrix view proves the delta calculation. Desired replicas equal three. Observed ready Pods equal one. The missing two replicas become the next action. That action is not a special case for this event; it is the result of comparing two pieces of state. Run the loop again before the Pods appear and the decision is still safe. Run it after the Pods appear and the delta becomes zero.",
        "The failure view proves why the work queue matters. Conflicts cause refetch and retry. External API failures cause backoff. Controller crashes are survivable because the desired object remains in the API and the key can be requeued. A stale cache is not fatal if the controller reads before writing and treats optimistic concurrency conflicts as ordinary."
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        "Reconciliation works because it stores the target outside the worker that is trying to reach it. If the controller process dies, the spec remains. If a watch disconnects, a relist can rebuild the cache. If two writers race, resourceVersion detects the conflict. If a child object is deleted, the parent still expresses the need for it. The target is durable, and the loop can be restarted.",
        "The invariant is simple: each successful reconcile step should either reduce the difference between desired and observed state, record a truthful status about why it cannot do so yet, or decide that no action is needed. The loop does not need to remember every prior event. It only needs enough state to make the next operation safe.",
        "This is also why status conditions are useful. They turn invisible waiting into visible system state. A controller can say that a certificate is waiting for DNS validation, a volume is waiting for provisioning, or a Deployment is progressing but not available. Status is not decoration. It is how a long-running convergence process becomes inspectable."
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        "The cost is latency and machinery. Reconciliation gives eventual convergence, not instant success. A user can apply a YAML file and then wait while controllers notice, enqueue, read, write, and wait for lower-level agents. The system becomes robust, but the path from intent to reality is indirect.",
        "Controllers also put load on the API server. Bad watches, hot loops, broad relists, and status updates on every tiny observation can overload the control plane. Work queues, rate limits, exponential backoff, caches, and careful predicates are not optional performance tweaks. They are the difference between convergence and a controller storm.",
        "External side effects are the hardest tax. Creating a cloud database, sending an email, charging a card, or ordering a certificate cannot be treated like creating a Kubernetes object. The controller needs idempotency keys, durable external IDs, finalizers, and status checkpoints. Otherwise a retry can create duplicate resources or lose track of cleanup."
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        "Built-in Kubernetes controllers use this pattern for Deployments, ReplicaSets, Jobs, Services, endpoints, nodes, persistent volumes, garbage collection, and namespace cleanup. Custom operators use the same shape for databases, queues, certificates, machine learning jobs, backups, and application rollouts.",
        "A certificate operator is a clean example. The spec says a certificate should exist for a domain. The controller creates or reuses an external order, records the order ID in status, waits for validation, writes a Secret when the certificate is ready, renews before expiry, and uses a finalizer to clean external state when the object is deleted. Every step can be retried after a crash.",
        "The same design appears outside Kubernetes. Cloud control planes, infrastructure-as-code systems, data pipelines, device management platforms, and workflow engines all benefit when users can declare a target and workers continuously repair drift."
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "The most common mistake is writing an event handler and calling it a controller. If the code assumes it saw every event, trusts the event payload, or stores progress only in memory, it will fail under ordinary restart and reconnect behavior.",
        "The second mistake is non-idempotent side effects. A reconcile loop that always creates a new external resource, always sends a notification, or always mutates a child object without checking current state will multiply work. The retry model turns small bugs into expensive incidents.",
        "The third mistake is spec and status confusion. A controller that rewrites user intent can fight the user. A user that writes status can hide reality from other controllers. A good API makes ownership obvious and keeps observed facts separate from desired configuration."
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study Kubernetes controllers, informers, DeltaFIFO, work queues, owner references, finalizers, conditions, and optimistic concurrency next. The nearby data-structure topics are Backpressure, Idempotency Keys, Leader Replacement, Distributed Tracing, OPA Rego Policy Decision Graph, Kubernetes Admission Policy Gate, Kubernetes Scheduler Priority Queue and Preemption Case Study, and Borg Cluster Scheduler Case Study.",
        "The transfer lesson is bigger than Kubernetes. When a system must survive missed messages, crashes, and concurrent writers, store desired state durably, make workers stateless enough to restart, make actions retryable, and report observed state honestly."
      ],
    },
  ],
};
