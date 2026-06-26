// Temporal workflow case study: durable execution through event history,
// replay, activities, workers, timers, and idempotent side effects.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'temporal-workflow-case-study',
  title: 'Temporal Workflow Case Study',
  category: 'Systems',
  summary: 'Durable execution for long-running business logic: event history, deterministic replay, activities, timers, retries, and workers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['durable execution', 'replay and activities'], defaultValue: 'durable execution' },
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

function temporalGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.8, y: 3.5, note: 'start workflow' },
      { id: 'service', label: 'Temporal service', x: 2.8, y: 3.5, note: 'history + queues' },
      { id: 'history', label: 'event history', x: 4.8, y: 1.7, note: 'durable log' },
      { id: 'taskq', label: 'task queue', x: 4.8, y: 5.3, note: 'workflow/activity tasks' },
      { id: 'worker', label: 'worker', x: 6.9, y: 3.5, note: 'runs code' },
      { id: 'activity', label: 'activity', x: 8.7, y: 1.7, note: 'side effect' },
      { id: 'timer', label: 'timer/signal', x: 8.7, y: 5.3, note: 'external event' },
    ],
    edges: [
      { id: 'e-client-service', from: 'client', to: 'service', weight: 'start' },
      { id: 'e-service-history', from: 'service', to: 'history', weight: 'append events' },
      { id: 'e-service-taskq', from: 'service', to: 'taskq', weight: 'schedule task' },
      { id: 'e-taskq-worker', from: 'taskq', to: 'worker', weight: 'poll' },
      { id: 'e-worker-history', from: 'worker', to: 'history', weight: 'commands become events' },
      { id: 'e-worker-activity', from: 'worker', to: 'activity', weight: 'execute' },
      { id: 'e-timer-history', from: 'timer', to: 'history', weight: 'event' },
    ],
  }, { title });
}

function* durableExecution() {
  yield {
    state: temporalGraph('Workflow state is an event history, not a live process'),
    highlight: { active: ['client', 'service', 'history', 'e-client-service', 'e-service-history'], compare: ['worker'] },
    explanation: 'Temporal starts a workflow by recording events durably. The workflow is not safe because one process stays alive; it is safe because history can replay the execution after crashes.',
  };

  yield {
    state: labelMatrix(
      'Order fulfillment workflow',
      [
        { id: 'reserve', label: 'reserve inventory' },
        { id: 'charge', label: 'charge card' },
        { id: 'ship', label: 'ship package' },
        { id: 'email', label: 'send email' },
      ],
      [
        { id: 'event', label: 'history event' },
        { id: 'failure', label: 'failure response' },
      ],
      [
        ['ActivityCompleted', 'retry or compensate'],
        ['ActivityCompleted', 'idempotent charge key'],
        ['Timer/ActivityCompleted', 'wait days if needed'],
        ['ActivityCompleted', 'safe retry'],
      ],
    ),
    highlight: { active: ['charge:event', 'ship:event'], found: ['charge:failure'] },
    explanation: 'Long-running business logic becomes a history of decisions and external events. A crash between charge and ship is recoverable because the history says what already happened.',
    invariant: 'Durable execution makes progress replayable; side effects still need idempotency.',
  };

  yield {
    state: temporalGraph('Workers poll task queues and append new decisions'),
    highlight: { active: ['taskq', 'worker', 'e-taskq-worker', 'e-worker-history'], found: ['service'] },
    explanation: 'Workers are replaceable compute. If a worker dies, another worker can poll the task queue, replay the workflow history, and continue from the next unresolved command.',
  };

  yield {
    state: labelMatrix(
      'Temporal versus common alternatives',
      [
        { id: 'cron', label: 'cron + DB rows' },
        { id: 'queue', label: 'message queue' },
        { id: 'saga', label: 'handwritten saga' },
        { id: 'temporal', label: 'Temporal workflow' },
      ],
      [
        { id: 'state', label: 'state lives in' },
        { id: 'hardpart', label: 'hard part' },
      ],
      [
        ['custom tables', 'crash recovery code'],
        ['messages', 'orchestration state'],
        ['service code', 'compensation discipline'],
        ['event history', 'deterministic replay discipline'],
      ],
    ),
    highlight: { active: ['temporal:state', 'temporal:hardpart'], compare: ['queue:hardpart', 'saga:hardpart'] },
    explanation: 'Temporal does not remove distributed-systems concerns. It centralizes workflow progress into a durable history and gives developers a programming model around replay.',
  };
}

function* replayAndActivities() {
  yield {
    state: labelMatrix(
      'Replay discipline',
      [
        { id: 'pure', label: 'workflow code' },
        { id: 'activity', label: 'activity code' },
        { id: 'random', label: 'random/time' },
        { id: 'version', label: 'code versioning' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'why', label: 'why' },
      ],
      [
        ['deterministic decisions', 'must match history on replay'],
        ['side effects allowed', 'record result in history'],
        ['use workflow APIs', 'replay must see same value'],
        ['patch carefully', 'old histories still replay'],
      ],
    ),
    highlight: { active: ['pure:rule', 'activity:rule'], compare: ['random:why', 'version:why'] },
    explanation: 'Replay is powerful but strict. Workflow code must make the same decisions when replaying old events; side effects belong in activities whose results are recorded.',
  };

  yield {
    state: temporalGraph('Activity results become replay inputs'),
    highlight: { active: ['worker', 'activity', 'history', 'e-worker-activity', 'e-worker-history'], found: ['service'] },
    explanation: 'An activity may call a payment API or database. On replay, the workflow does not call it again; it reads the recorded ActivityCompleted or ActivityFailed event.',
  };

  yield {
    state: labelMatrix(
      'Event history growth',
      [
        { id: 'small', label: 'short workflow' },
        { id: 'loop', label: 'large loop' },
        { id: 'continue', label: 'continue-as-new' },
        { id: 'signal', label: 'many signals' },
      ],
      [
        { id: 'history', label: 'history shape' },
        { id: 'response', label: 'response' },
      ],
      [
        ['few events', 'straight replay'],
        ['thousands of events', 'watch limits and replay time'],
        ['new run with carried state', 'trim long history'],
        ['interactive updates', 'cap and compact protocol'],
      ],
    ),
    highlight: { active: ['loop:history', 'continue:response'], compare: ['signal:history'] },
    explanation: 'The event history is durable, but not infinite. Long-lived workflows need history hygiene: continue-as-new, child workflows, batching, and bounded signal/update patterns.',
  };

  yield {
    state: labelMatrix(
      'Production design checklist',
      [
        { id: 'idempotency', label: 'idempotency keys' },
        { id: 'timeouts', label: 'timeouts' },
        { id: 'retries', label: 'retry policy' },
        { id: 'observability', label: 'observability' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'failure', label: 'failure if ignored' },
      ],
      [
        ['safe external side effects', 'double charge or duplicate send'],
        ['bounded waits', 'stuck activities'],
        ['known retry envelope', 'retry storms or silent failure'],
        ['history and traces', 'mystery workflows'],
      ],
    ),
    highlight: { found: ['idempotency:need', 'timeouts:need'], active: ['observability:failure'] },
    explanation: 'Temporal handles workflow durability, but production quality still depends on idempotent activities, timeout budgets, retry policy, and observability.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'durable execution') yield* durableExecution();
  else if (view === 'replay and activities') yield* replayAndActivities();
  else throw new InputError('Pick a Temporal workflow view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the Temporal service as the owner of durable workflow history, not as a worker process. A workflow is long-running application logic whose progress is recorded as events, while workers are replaceable interpreters that replay history and produce the next commands.',
        'The safe inference rule is that replay must make the same decisions from the same history. Activity results, timers, signals, and failures are recorded so a crash loses process memory but not workflow progress.',
        {type:'callout', text:'Temporal makes workflow state recoverable by treating event history as the durable program boundary and workers as replaceable interpreters.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/af/BPMN-AProcessWithNormalFlow.svg', alt:'BPMN process diagram with start event, timer, task, gateway, message task, and data object.', caption:'BPMN normal-flow process diagram as a visual proxy for workflow orchestration. Image: Mikelo Skarabo, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many business processes last longer than one HTTP request or one worker process. An order may reserve inventory, charge a card, wait for fraud review, ship later, and send email after external systems respond.',
        'Temporal exists to make that progress durable. It stores event history so a workflow can recover after worker crashes, deploys, retries, timers, and human delays.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a status column plus a queue. A worker reads a row, performs the next step, writes the next status, and enqueues another job.',
        'That design is simple for short flows. It also gives teams direct control over database rows, queue messages, and repair scripts.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the flow needs durable timers, retries, cancellation, human approval, visibility, and safe recovery after partial side effects. The status column becomes a hidden state machine spread across services.',
        'Crash recovery is the hardest case. If a worker charged a card and died before writing the next status, the system must know whether to charge again, ship, refund, or wait for a human.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Temporal separates deterministic workflow decisions from side-effecting activities. Workflow code decides what should happen next, while activities call external systems and record their result or failure in history.',
        'The invariant is replay determinism. Given the same event history, workflow code must issue the same commands, so direct wall-clock reads, random numbers, unrecorded I/O, and process-local decisions do not belong in workflow code.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client starts a workflow execution, and the Temporal service appends start events to history. The service schedules workflow tasks on task queues, and workers poll those queues for work.',
        'A worker replays the event history, runs workflow code, and emits commands such as schedule activity, start timer, wait for signal, request cancellation, or complete workflow. When the service accepts a command, it records the resulting event.',
        'Activities perform side effects such as payment calls, database writes, emails, or cloud API requests. On replay, a completed activity is not called again; workflow code reads the recorded ActivityCompleted event.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Replay works because history is the source of truth. If a timer fired, a signal arrived, or an activity completed before a crash, that fact is already in the event log and another worker can reconstruct local workflow state.',
        'The guarantee is about workflow progress, not magic exactly-once side effects. Activities can run more than once under retries or timeouts, so external calls need idempotency keys, conditional writes, dedupe tables, or compensation logic.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Temporal replaces handwritten recovery code with a platform and discipline. Teams must operate or buy the service, manage namespaces, tune task queues, set retry policies, monitor histories, and keep workflow code replay-compatible across deploys.',
        'History size is a real cost. A workflow that records 50,000 events will replay more slowly than one with 500 events, so long-lived flows need continue-as-new, child workflows, batching, bounded signals, and payload limits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Temporal fits payments, subscriptions, order fulfillment, claims processing, onboarding, infrastructure provisioning, ML job orchestration, data pipelines, and human approval flows. These processes need durable timers and retries more than raw low-latency execution.',
        'It also improves incident review. Instead of reconstructing state from queue messages, cron logs, database rows, and scripts, operators can inspect one workflow history for the platform view of what happened.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Temporal is too heavy for a single stateless background job or an ultra-low-latency hot path where event-history round trips and worker polling overhead are unacceptable. A queue or direct service call may be simpler.',
        'It also fails when teams ignore replay discipline. Non-deterministic workflow code, unversioned branch changes, oversized payloads, and non-idempotent activities can recreate the same reliability problems inside a more advanced platform.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an order workflow reserves inventory, charges 49.99 dollars, waits up to 72 hours for fraud review, ships the package, and emails the customer. In plain service code, a crash after charging but before writing status can leave the next worker unsure whether to charge again.',
        'With Temporal, the charge is an activity and its completion is recorded in history. If the worker crashes afterward, replay sees the charge result and moves to the fraud-review timer or signal; the payment activity still needs an order-specific idempotency key in case the payment processor saw a timed-out retry.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Temporal documentation on workflows, event histories, activities, retries, timers, signals, updates, continue-as-new, and versioning at https://docs.temporal.io/. Study durable execution, sagas, idempotency, transactional outbox, write-ahead logs, message queues, distributed tracing, and workflow versioning next.',
      ],
    },
  ],
};
