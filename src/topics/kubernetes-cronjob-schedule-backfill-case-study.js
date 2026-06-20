// Kubernetes CronJob: a schedule cursor creates Jobs, handles missed starts,
// concurrency policy, suspension, history limits, and time zone behavior.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-cronjob-schedule-backfill-case-study',
  title: 'Kubernetes CronJob Schedule Backfill Case Study',
  category: 'Systems',
  summary: 'How CronJob stores a schedule cursor, creates Jobs, handles missed starts, startingDeadlineSeconds, concurrencyPolicy, suspension, and history cleanup.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['schedule cursor', 'concurrency policy'], defaultValue: 'schedule cursor' },
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

function cronGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'cron', label: 'Cron', x: 0.7, y: 3.8, note: notes.cron ?? '* * * * *' },
      { id: 'cursor', label: 'cursor', x: 2.5, y: 3.8, note: notes.cursor ?? 'last run' },
      { id: 'tick1', label: 't1', x: 4.2, y: 2.1, note: notes.tick1 ?? 'due' },
      { id: 'tick2', label: 't2', x: 4.2, y: 3.8, note: notes.tick2 ?? 'missed' },
      { id: 'tick3', label: 't3', x: 4.2, y: 5.5, note: notes.tick3 ?? 'now' },
      { id: 'policy', label: 'policy', x: 6.2, y: 3.8, note: notes.policy ?? 'allow' },
      { id: 'job', label: 'Job', x: 8.0, y: 3.0, note: notes.job ?? 'create' },
      { id: 'hist', label: 'hist', x: 8.0, y: 5.0, note: notes.hist ?? 'cleanup' },
      { id: 'status', label: 'status', x: 9.5, y: 3.8, note: notes.status ?? 'record' },
    ],
    edges: [
      { id: 'e-cron-cursor', from: 'cron', to: 'cursor' },
      { id: 'e-cursor-tick1', from: 'cursor', to: 'tick1' },
      { id: 'e-cursor-tick2', from: 'cursor', to: 'tick2' },
      { id: 'e-cursor-tick3', from: 'cursor', to: 'tick3' },
      { id: 'e-tick3-policy', from: 'tick3', to: 'policy' },
      { id: 'e-policy-job', from: 'policy', to: 'job' },
      { id: 'e-policy-hist', from: 'policy', to: 'hist' },
      { id: 'e-job-status', from: 'job', to: 'status' },
      { id: 'e-hist-status', from: 'hist', to: 'status' },
    ],
  }, { title });
}

function* scheduleCursor() {
  yield {
    state: cronGraph('A CronJob turns schedule ticks into Jobs'),
    highlight: { active: ['cron', 'cursor', 'tick3', 'policy', 'job', 'e-cron-cursor', 'e-policy-job'], compare: ['hist'] },
    explanation: 'A CronJob does not run the workload itself. It compares the schedule cursor with current time, applies policy, then creates one-time Jobs from the jobTemplate.',
    invariant: 'CronJob correctness is schedule state plus Job creation, not a long-running process.',
  };

  yield {
    state: labelMatrix(
      'Schedule ledger',
      [
        { id: 'sched', label: 'sched' },
        { id: 'zone', label: 'zone' },
        { id: 'last', label: 'last' },
        { id: 'name', label: 'name' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cron', 'bad'],
        ['TZ', 'drift'],
        ['cursor', 'miss'],
        ['prefix', 'long'],
      ],
    ),
    highlight: { active: ['sched:role', 'last:role'], found: ['name:risk'] },
    explanation: 'The schedule and time zone define candidate ticks. The last-schedule cursor prevents repeated creation for the same tick, and name limits matter because generated Jobs and Pods add suffixes.',
  };

  yield {
    state: cronGraph('Missed starts are bounded by deadline policy', { tick1: 'old', tick2: 'miss', tick3: 'due', policy: 'deadline' }),
    highlight: { active: ['tick2', 'tick3', 'policy', 'e-tick3-policy'], compare: ['tick1'] },
    explanation: 'If the controller was down or the CronJob was suspended, several ticks may be missed. startingDeadlineSeconds decides whether a delayed start is still worth creating.',
  };

  yield {
    state: labelMatrix(
      'Complete case: nightly backup',
      [
        { id: 'due', label: 'due' },
        { id: 'late', label: 'late' },
        { id: 'job', label: 'job' },
        { id: 'hist', label: 'hist' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'why', label: 'why' },
      ],
      [
        ['02:00', 'tick'],
        ['03:10', 'skip'],
        ['backup', 'run'],
        ['3 ok', 'keep'],
      ],
    ),
    highlight: { active: ['due:state', 'job:state', 'hist:why'], compare: ['late:why'] },
    explanation: 'A nightly backup CronJob should not launch stale backups all morning after an outage. Deadline and history settings encode how much backfill and retained evidence are acceptable.',
  };
}

function* concurrencyPolicy() {
  yield {
    state: cronGraph('Concurrency policy decides what happens if the prior Job is still active', { policy: 'Forbid?', job: 'maybe' }),
    highlight: { active: ['policy', 'job', 'e-policy-job'], compare: ['tick2', 'tick3'] },
    explanation: 'A slow Job can overlap the next scheduled tick. concurrencyPolicy chooses Allow, Forbid, or Replace rather than leaving the result implicit.',
  };

  yield {
    state: labelMatrix(
      'Concurrency modes',
      [
        { id: 'allow', label: 'Allow' },
        { id: 'forbid', label: 'Forbid' },
        { id: 'replace', label: 'Repl' },
        { id: 'susp', label: 'Susp' },
      ],
      [
        { id: 'act', label: 'act' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['new', 'overlap'],
        ['skip', 'miss'],
        ['kill', 'loss'],
        ['pause', 'backlog'],
      ],
    ),
    highlight: { active: ['allow:act', 'forbid:act', 'replace:act'], compare: ['susp:risk'] },
    explanation: 'The policy is the overlap rule. Allow admits another Job, Forbid records a missed run, Replace trades the old active Job for a fresh one, and suspension stops new Job creation.',
  };

  yield {
    state: cronGraph('History limits clean old success and failure Jobs', { hist: 'keep 3/1', status: 'bounded' }),
    highlight: { active: ['hist', 'status', 'e-hist-status'], found: ['job'] },
    explanation: 'CronJobs can create unbounded control-plane objects if old Jobs are never cleaned. Successful and failed history limits bound retained evidence.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'slow', label: 'slow' },
        { id: 'ctrl', label: 'ctrl' },
        { id: 'quota', label: 'quota' },
        { id: 'name', label: 'name' },
      ],
      [
        { id: 'sym', label: 'sym' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['overlap', 'policy'],
        ['miss', 'deadln'],
        ['many', 'quota'],
        ['too long', 'short'],
      ],
    ),
    highlight: { active: ['slow:fix', 'quota:fix'], found: ['ctrl:sym'] },
    explanation: 'CronJobs fail operationally through overlap, missed starts, too many retained Jobs, and generated names that exceed limits. The fix is policy, quota, history cleanup, and short names.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'schedule cursor') yield* scheduleCursor();
  else if (view === 'concurrency policy') yield* concurrencyPolicy();
  else throw new InputError('Pick a Kubernetes CronJob view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many production tasks are finite but repeated: nightly backups, hourly reports, certificate refreshes, cleanup passes, and scheduled exports. A plain Job can run one occurrence, but it does not remember the next due time.',
        'A CronJob adds a schedule ledger around Jobs. It stores the cron expression, evaluates due ticks, creates Jobs from a template, and keeps enough history to debug recent successes and failures.',
        {type:'callout', text:'A CronJob is a schedule ledger, not a running loop: each due tick is judged against cursor, deadline, concurrency, and history policy before a Job is created.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple approach is to put cron inside a container, run a sleep loop, or have a human create the next Job. That works until the process dies, the cluster controller restarts, the clock crosses a time-zone edge, or the previous run is still active when the next tick arrives.',
        'The wall is ambiguity. After downtime, should the system run every missed tick, only the latest tick, or none because the work is stale? If a backup is still running, should the next one overlap, be skipped, or replace it?',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'The data structure is a schedule cursor plus a Job history ledger. The controller compares current time with the schedule and last scheduled time, finds missed starts, applies startingDeadlineSeconds, checks concurrencyPolicy, creates or skips a Job, records status, and trims old successful and failed Jobs.',
        'The official CronJob documentation covers schedule syntax, deadlines, concurrency policy, suspension, history limits, time zones, name limits, and missed-start behavior: https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/. The automated task guide shows the basic pattern of a CronJob creating Jobs: https://kubernetes.io/docs/tasks/job/automated-tasks-with-cron-jobs/.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the schedule-cursor view, follow the controller's question: which scheduled times exist between the last recorded schedule and now, and which of those times are still fresh enough to create a Job? The cursor is what keeps a controller restart from becoming amnesia.",
        "In the concurrency-policy view, the active Job list is the state that matters. `Allow` creates a new Job even if an older one is still running. `Forbid` skips the new run. `Replace` deletes the older run and starts a fresh one. Each option encodes a different answer to what overlap means for the workload.",
        "The highlighted skips are not bugs by themselves. A skipped tick can be the correct outcome when work is stale, when the CronJob is suspended, or when concurrency policy says overlapping work would be unsafe.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a report CronJob should run every hour. The controller last scheduled 10:00, then it is unavailable until 12:20. On the next reconciliation, it sees missed ticks at 11:00 and 12:00. With a 30-minute starting deadline, 11:00 is stale and 12:00 may still be eligible. With no deadline, both may be considered, subject to Kubernetes missed-schedule limits.',
        'Now add `concurrencyPolicy: Forbid` and an 11:00 Job that is still active. The 12:00 tick is not created because the old run has not finished. With `Replace`, the controller treats the new tick as more important and replaces the active Job. With `Allow`, the two runs overlap. None of those choices is universally correct; the right policy depends on whether the task is idempotent, whether results are time-sensitive, and whether overlap can corrupt shared state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that each schedule tick is judged against the same ledger before any Job is created. A tick may be eligible, too late, blocked by an active Job, replaced, or skipped because the CronJob is suspended. The decision is recorded through Job creation and history, not left in a running process memory.',
        'This design is intentionally approximate, not exactly-once execution. Kubernetes bounds missed-start recovery and documents that too many missed schedules are skipped rather than replayed forever. That protects the control plane from a backlog storm after long downtime.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Controller work grows with CronJobs, missed ticks to evaluate, active Jobs, and retained history. A bad schedule can create many API objects, and a stuck Job can convert a harmless schedule into repeated skips or overlapping work depending on concurrencyPolicy.',
        'startingDeadlineSeconds is both a freshness rule and a safety valve. Very small deadlines can miss the controller polling window, while very large deadlines can backfill stale work. ResourceQuota is a cluster-level guard because poorly configured CronJobs can create too many Jobs in a namespace: https://kubernetes.io/docs/concepts/policy/resource-quotas/.',
      ],
    },
    {
      heading: 'Operational review checklist',
      paragraphs: [
        'Review a CronJob as a small controller design. The schedule says when work becomes eligible. The deadline says how long that eligibility remains useful. The concurrency policy says what to do when time and reality disagree. History limits say how much evidence to keep. Resource requests and limits say how much cluster capacity each run can consume.',
        'The workload container needs its own safeguards. CronJob does not make side effects exactly once. Use idempotent writes, external locks, unique run ids, checkpoints, or compare-and-swap guards when repeated execution can damage data. A retry-safe Job matters more than a tidy schedule string.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'CronJob wins when the work is time-triggered, finite, and safe to express as independent Job runs. Backups, report generation, cleanup, cache warming, certificate renewal, and scheduled exports are natural fits because each occurrence has a clear due time and terminal result.',
        'It is especially useful when the schedule policy is part of operations: do not overlap backups, do not backfill stale reports after an outage, and keep only enough Job history for audit.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CronJob is a poor fit for exactly-once money movement, workflows with dependencies, high-frequency event processing, and tasks whose next run depends on the previous run output. Use a queue, workflow engine, or application scheduler when time ticks are not the real unit of work.',
        'The common operational failures are overlap, missed starts, unbounded history, name length surprises, and stale backfills. The workload itself must still be idempotent because retries, replacement, or manual reruns can repeat effects.',
        'It also fails when the schedule is used as a hidden dependency graph. If task B must wait for task A, or if a missed task must trigger compensation, the system needs explicit workflow state. CronJob gives you time-based eligibility and Job creation, not a durable model of multi-step business progress.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A nightly backup runs at 02:00 with Forbid concurrency, a one-hour starting deadline, and history limits of three successes and one failure. If the previous backup is still active, the 02:00 run is skipped rather than overlapping against the same database. If the controller restarts at 03:10, the missed 02:00 run is too late and is skipped. The history ledger retains enough Jobs for audit without accumulating forever.',
        'The review is a policy review, not just a YAML review: schedule, time zone, deadline, overlap behavior, suspend behavior, history limits, resource quota, and whether backup writes are safe under retry.',
        'A second example is an hourly cache warmer. It may use `Allow` because overlapping runs are harmless and freshness matters more than strict serialization. A certificate renewal job may use a long deadline because missing a renewal is worse than running late. A billing export may avoid CronJob entirely if downstream accounting requires a workflow ledger with approvals, retries, and reconciliation.',
        'These examples show why the controller knobs are business semantics. The same missed tick can mean "run late," "skip because stale," or "page someone because the task is critical." A good CronJob article, runbook, or code review should name that meaning directly.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Job Indexed Completion Ledger for the Jobs a CronJob creates, Kubernetes ResourceQuota and LimitRange Admission for namespace caps, Queue and Rate Limiter for controller pacing, and Write-Ahead Log for retry-safe scheduled side effects.',
      ],
    },
  ],
};
