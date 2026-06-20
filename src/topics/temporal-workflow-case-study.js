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
      heading: 'Why this exists',
      paragraphs: [
        'Many business processes last longer than one process, one request, or one deploy. An order may wait for payment, fraud review, inventory, shipment, and customer email. An infrastructure job may wait for cloud APIs, retries, approvals, and timeouts. If that logic is spread across queues, cron jobs, status rows, and repair scripts, the system becomes hard to reason about after a crash.',
        'Temporal exists to make long-running logic durable. It records workflow progress as an event history. Workers can crash, restart, scale down, or be replaced because the workflow state is reconstructed from history rather than from live process memory.',
        'The hard problem is not just running code later. It is preserving the boundary between decisions already made, side effects already completed, timers already fired, signals already received, and work that still needs to happen.',
        {type:'callout', text:'Temporal makes workflow state recoverable by treating event history as the durable program boundary and workers as replaceable interpreters.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/af/BPMN-AProcessWithNormalFlow.svg', alt:'BPMN process diagram with start event, timer, task, gateway, message task, and data object.', caption:'BPMN normal-flow process diagram as a visual proxy for workflow orchestration. Image: Mikelo Skarabo, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The naive baseline and the wall',
      paragraphs: [
        'The obvious approach is a status column plus a queue. A worker reads a row, performs the next step, writes a new status, and enqueues the next job. For small flows, this works well enough and is easy to debug at first.',
        'The wall appears as soon as the flow needs durable timers, retries, cancellation, human approval, visibility, and repair. The status column grows into a hidden state machine. Each service invents its own retry rules. Operators need scripts to find stuck rows and guess whether side effects already happened.',
        'Crash recovery is the sharp edge. If a worker charged a card and died before writing the next status, the system must know whether to charge again, ship, refund, wait, or ask for review. Plain code with direct network calls, time reads, randomness, and partial database writes cannot safely reconstruct that boundary.',
      ],
    },
    {
      heading: 'Core insight and invariant',
      paragraphs: [
        'The core idea is durable execution through replay. Workflow code describes decisions. Activities perform side effects. The Temporal service records the events that make those decisions recoverable: starts, activity completions, failures, timers, signals, cancellations, retries, and workflow completions.',
        'The invariant is strict: workflow code must derive the same commands from the same event history. Anything that would make replay diverge, such as direct wall-clock reads, random numbers, sleeps, process-local state, or unrecorded network calls, must use workflow-safe APIs or move into activities.',
        'The event history becomes the source of truth. A worker is not the owner of workflow state. It is a replaceable interpreter of a durable history.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The durable-execution view points attention away from the worker process. The service owns history and task queues. Workers poll, run code, emit commands, and can disappear. The workflow survives because its history survives.',
        'The order-fulfillment matrix shows why results must become events. Charging a card, reserving inventory, and sending email are not pure decisions that can be replayed by calling the world again. Their activity results become replay inputs.',
        'The replay-and-activities view shows the main boundary. Workflow code decides what should happen next. Activity code touches external systems. Replay stays safe only when the workflow side is deterministic and the activity side is idempotent or otherwise duplicate-safe.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A client starts a workflow execution. The Temporal service appends start events to history and schedules workflow tasks on a task queue. A worker polls the queue, replays the history, runs workflow code, and produces commands such as schedule activity, start timer, wait for signal, request cancellation, or complete workflow.',
        'Commands become events when the service accepts them. An activity task is scheduled, a worker runs the activity, and the result or failure is recorded in history. On replay, workflow code does not call the activity again for a completed result. It reads the recorded event.',
        'Timers are history-backed. A workflow can wait for minutes, months, or years without holding a process thread. When the timer fires, the service records the timer event and schedules another workflow task.',
        'Signals and updates are also events. They let external callers interact with a running workflow without reaching into process memory. The workflow consumes those events during replay and continues with deterministic code.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'Replay works because the same history should lead workflow code to the same commands. If a previous activity result is already in history, replay reads that result. If a timer already fired, replay sees the timer event. If a signal arrived, replay sees the signal payload in order.',
        'This gives a strong recovery story for workflow progress. A crash loses volatile worker memory, not the workflow state. Another worker can replay history, reconstruct local workflow state, and continue from the next unresolved command.',
        'Correctness still depends on external side-effect design. An activity may be retried after a timeout even if the remote system eventually performed the operation. Payment, email, shipping, and database activities need idempotency keys, conditional writes, dedupe tables, or other duplicate-suppression mechanisms.',
        'Code changes are part of correctness. Old histories may replay under new code after a deploy. Versioning and patching patterns keep old histories compatible while new runs move to the new behavior.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Temporal replaces handwritten reliability code, but it adds a platform and a programming model. Workflow code must be deterministic. Activities must be safe under retries. Histories can grow, so long workflows need continue-as-new, child workflows, batching, or bounded signal and update patterns.',
        'Teams must operate or buy the service, manage namespaces and retention, size task queues, monitor workers, tune retry policies, define timeout budgets, and inspect workflow histories during incidents.',
        'The tradeoff is centralization. Instead of many services each inventing partial workflow state, Temporal becomes the durable source of workflow truth. That improves recovery and visibility, but it also makes workflow design and platform health shared concerns.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider an order workflow: reserve inventory, charge the card, wait for fraud review if needed, ship the package, and send a confirmation email. In ordinary service code, a crash after the charge can leave the system unsure whether to charge again, ship, refund, or wait for a human.',
        'With Temporal, reserve inventory and charge card are activities. Their completions are recorded in history. If the worker crashes after the charge activity completes, replay sees the recorded charge result and moves to the next decision instead of charging again from workflow replay.',
        'If fraud review takes three days, the workflow waits on a timer or signal. No worker has to stay alive for those three days. When the signal arrives, history records it, a workflow task is scheduled, and any available worker can continue.',
        'The charge activity still needs an order-specific payment idempotency key. The payment processor may receive a retry after a timeout. Temporal can avoid replaying a completed activity result, but it cannot make an external payment API exactly-once by itself.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Temporal fits order fulfillment, payments, onboarding, subscriptions, claims processing, infrastructure provisioning, ML training orchestration, human approval flows, data pipelines, and any process that can run for seconds, days, or years.',
        'It is especially useful when product logic wants sequential-looking code but the system needs durable timers, retries, cancellation, signals, visibility, and recovery. The workflow can read like a program while the platform stores progress as history.',
        'It also helps incident response. Instead of asking which queue message, cron run, status row, and retry script touched an order, operators can inspect the workflow history and see what the platform believes happened.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Temporal is not just a message queue. A queue stores work items. Temporal stores workflow history and replays deterministic code. If the problem is a single stateless background job, a queue may be simpler and cheaper.',
        'Temporal is not magic exactly-once side effects. Activities can run more than once. A timeout can hide a remote success. Workers can crash after making a call. External systems need idempotency, conditional writes, or compensation logic.',
        'Temporal is not a fit for ultra-low-latency hot paths where event-history round trips and worker polling overhead are too expensive. It is also a poor fit for teams that cannot follow replay discipline, code-versioning rules, or operational ownership of the service.',
        'History growth is a real limit. A workflow that loops forever, receives unbounded signals, or records huge payloads can become slow to replay or hit service limits. Design long-lived workflows with continue-as-new, child workflows, payload limits, and compaction points.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep workflow code deterministic. Use workflow APIs for time, sleep, randomness, cancellation, and async behavior. Move network calls, database writes, file I/O, and other side effects into activities.',
        'Design every activity with retry behavior in mind. Give payment calls idempotency keys, make email sending dedupe-safe where possible, use conditional writes for databases, and record external operation identifiers so a retry can query rather than blindly repeat.',
        'Set explicit timeouts and retry policies. Schedule-to-start, start-to-close, heartbeat, and overall retry settings are part of the business contract. A workflow that waits forever without a clear timeout is just a stuck row with better tooling.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Monitor task queues, worker pollers, workflow failure rates, activity latency, retry counts, timeout rates, history size, and replay latency. Durable execution moves state into the platform, so platform visibility becomes part of application health.',
        'Plan deployments around replay compatibility. New code may replay old histories. Use versioning patterns when a workflow decision branch changes, and keep old workers or compatibility code long enough for old runs to finish or continue as new.',
        'Treat histories as audit data. They are useful during incidents, but they can contain business payloads. Configure retention, payload codecs, encryption, and search attributes with data handling rules in mind.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Temporal workflow execution, Temporal event history, activities, retries, timers, signals, updates, continue-as-new, workflow versioning, the saga pattern, idempotency, transactional outbox, write-ahead logs, message queues, and distributed tracing. These topics explain the line between durable orchestration and the external systems it coordinates.',
      ],
    },
  ],
};
