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
      heading: 'What it is',
      paragraphs: [
        'Temporal is a durable execution platform for long-running application logic. Instead of scattering workflow state across ad hoc database rows, cron jobs, queues, and retry scripts, Temporal records a durable event history for each workflow execution. If a worker crashes, another worker can replay the history and continue from the next unresolved decision.',
        'Temporal docs describe a Workflow Execution as a durable, reliable, scalable function execution: https://docs.temporal.io/workflow-execution. The Event History page explains that the Temporal service stores the complete event history for the lifecycle of a workflow execution and uses it for replay: https://docs.temporal.io/workflow-execution/event.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client starts a workflow. The Temporal service appends events to history and schedules workflow tasks on task queues. Workers poll those queues, run workflow code, and emit commands such as schedule activity, start timer, or complete workflow. Commands become durable events. Activities perform side effects such as charging a card, calling a service, or writing a database. Their results are recorded so replay does not repeat the side effect.',
        'The central trick is deterministic replay. Workflow code must make the same decisions when replaying the same event history. Time, randomness, external calls, and side effects must go through Temporal APIs or activities so the history remains the source of truth. This lets code look sequential while the platform handles crashes, timers, retries, and worker replacement.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Temporal replaces a lot of handwritten reliability code, but it imposes its own discipline. Workflow code must be deterministic. Activity side effects must be idempotent because retries happen. Event histories can grow large, so long-running workflows need continue-as-new, child workflows, batching, or other history-management patterns. Temporal documents event history limits and warnings, including termination after maximum event-history limits are exceeded: https://docs.temporal.io/workflow-execution/event.',
        'Operationally, teams must run or buy the Temporal service, manage task queues, monitor workers, set retry policies, define timeout budgets, and inspect workflow histories. The benefit is that these concerns become platform concepts rather than bespoke code in every service.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Durable workflows fit order fulfillment, payments, onboarding, subscriptions, claims processing, infrastructure provisioning, data pipelines, ML training orchestration, human approval flows, and anything that can run for seconds, days, or years. The Uber Cadence project, Temporal ancestor, describes itself as a distributed, scalable, durable, highly available orchestration engine for asynchronous long-running business logic: https://github.com/cadence-workflow/cadence.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Temporal is not just a message queue. A queue stores work items; Temporal stores workflow history and replays deterministic code. It is also not magic exactly-once side effects. Activities can be retried, so payment, email, shipping, and database writes still need idempotency keys or conditional updates. Another trap is changing workflow code without considering old histories. A new version must still replay workflows that started under older code, or use versioning patterns.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: Temporal Workflow Execution docs at https://docs.temporal.io/workflow-execution, Temporal Event History docs at https://docs.temporal.io/workflow-execution/event, and Cadence repository at https://github.com/cadence-workflow/cadence. Study Saga Pattern, Idempotency & Exactly-Once Delivery, Message Queue, Write-Ahead Log, Transactional Outbox, Retries, Backoff & Jitter, and Distributed Tracing next.',
      ],
    },
  ],
};
